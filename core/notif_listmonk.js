const winston = require('winston');
const logger = winston.loggers.get('gomngr');
//const request = require('request');
const axios = require('axios');
const nodemailer = require('nodemailer');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const https = require('https');

var mail_set = false;

var transporter = null;

const listMonkAgent = new https.Agent({  
    rejectUnauthorized: CONFIG.listmonk.force_tls ? true : false
});

if(CONFIG.nodemailer){
    transporter = nodemailer.createTransport({
        host: CONFIG.nodemailer.host,
        port: CONFIG.nodemailer.port,
        secure: false, // upgrade later with STARTTLS
    });
}

let auth = {};

if(CONFIG.listmonk && CONFIG.listmonk.host && CONFIG.listmonk.host !== 'fake' && CONFIG.listmonk.optin){
    mail_set = true;
    auth = {
        username: CONFIG.listmonk.user,
        password: CONFIG.listmonk.password
    };

}

async function create_user(user) {
    try {
        let new_user = await axios.post(CONFIG.listmonk.host+'/api/subscribers', user, {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
        return new_user.data.data;
    } catch (err) {
        console.error('[create_user] error', err);
        return null;
    }
    
}

async function delete_user(user) {
    try {
        await axios.delete(CONFIG.listmonk.host+`/api/subscribers/${user.id}`, {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
    } catch (err) {
        console.error('[delete_user] error', err);
        return null;
    }
    return user;
}

async function get_user(email) {
    let res = null;
    try {
        res = await axios.get(CONFIG.listmonk.host+'/api/subscribers', {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
    } catch(err) {
        console.error('[get_user] error', err);
        return null;   
    }
    let users = res.data.data.results;
    for(let i=0;i<users.length;i++){
        let user = users[i];
        if (user.email === email) {
            let ulists = [];
            for(let l=0;l<user.lists.length;l++){
                let list = user.lists[l];
                ulists.push(list.id);
            }
            user.lists = ulists;
            return user;
        }
    }
    return null;
}

async function join_list(user, lists) {
    let add_lists = [];
    for(let l=0;l<lists.length;l++){
        let list = await get_list(lists[l]);
        if(!list) {
            console.error('list not found', lists[l]);
            continue;
        }
        add_lists.push(list.id);
    }
    
    let changed = false;
    for(let l=0;l<add_lists.length;l++){
        if (user.lists.indexOf(add_lists[l])<0) {
            user.lists.push(add_lists[l]);
            changed = true;
        }
    }
    if(!changed) {
        console.debug('[join_list] no modification');
        return true;
    }

    try {
        await axios.put(CONFIG.listmonk.host+`/api/subscribers/${user.id}`, user, {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
        // ask for optin
        await axios.post(CONFIG.listmonk.host+`/api/subscribers/${user.id}/optin`, {}, {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
    } catch(err) {
        console.error('[join_list] error', err);
        return false;   
    }
    return true;
}

async function quit_list(user, lists) {

    let del_lists = [];
    for(let l=0;l<lists.length;l++){
        let list = await get_list(lists[l]);
        if(!list) {
            console.error('list not found', lists[l]);
            continue;
        }
        del_lists.push(list.id);
    }

    let changed = false;
    let new_list = [];
    for(let l=0;l<user.lists.length;l++){
        if (del_lists.indexOf(user.lists[l])<0) {
            new_list.push(user.lists[l]);
            changed = true;
        }
    }
    if(!changed) {
        console.debug('[join_list] no modification');
        return true;
    }

    user.lists = new_list;

    try {
        await axios.put(CONFIG.listmonk.host+`/api/subscribers/${user.id}`, user, {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
    } catch(err) {
        console.error('[quit_list] error', err);
        return false;   
    }
    return true;
}

async function update_user(user) {
    try {
        await axios.put(CONFIG.listmonk.host+`/api/subscribers/${user.id}`, user, {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
    } catch(err) {
        console.error('[update_user] error', err);
        return false;   
    }
    return true;
}

async function get_lists() {
    try {
        let lists = await axios.get(CONFIG.listmonk.host+'/api/lists', {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent
        });
        return lists.data.data.results;
    } catch(err) {
        console.error('[get_lists] error', err);
        return null;        
    }
}

async function get_list(list_name) {
    let lists = await get_lists();
    for(let i=0;i<lists.length;i++) {
        let list = lists[i];
        if (list.name === list_name) {
            return list;
        }
    }
    return null;
}

async function get_list_members(list_id) {
    try {
        let members = await axios.get(CONFIG.listmonk.host+'/api/subscribers', {
            auth: auth,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: listMonkAgent,
            params: {
                list_id: list_id
            }
        });
        return members.data.data.results;
    } catch(err) {
        console.error('[get_list_members] error', err);
        return []; 
    }
}

module.exports = {

    mailSet: function(){
        return mail_set;
    },

    subscribed: async function(email) {
        if(email.indexOf('@fake')>-1){
            return false;
        }
        if(! mail_set){
            return false;
        }
        try {
            let user = await get_user(email);
            if(user === null) {
                return false;
            }
            let nb_subscribed = 0;
            for(let l=0;l<CONFIG.listmonk.optout.length;l++) {
                let list = await get_list(CONFIG.listmonk.optout[l]);
                let members = await get_list_members(list.id);
                for(let m=0;m<members.length;m++) {
                    if(members[m]['id'] === user['id']) {
                        nb_subscribed++;
                        break;
                    }
                }
            }
            if (nb_subscribed == CONFIG.listmonk.optout.length) {
                return true;
            }
            return false;
        }
        catch(err) {
            return false;
        }
    },

    // eslint-disable-next-line no-unused-vars
    getMembers: async function(_list) {
        if(! mail_set){
            logger.error('Mail is not set properly');
            return false;
        }
        return [];
    },

    getLists: async function(){
        if(! mail_set){
            logger.error('Mail is not set properly');
            return [];
        }
        return [];
    },

    add: async function(email, uid) {
        if(email===undefined ||email===null || email=='' || ! mail_set) {
            logger.error('[notif][add] email not valid');
            return;
        }
        if(email.indexOf('@fake')>-1){
            return;
        }

        let user = await get_user(email);
        if(user == null) {
            user = await create_user({
                email: email,
                name: uid || '',
                status: 'enabled',
                lists: [],
                attribs: {
                    'groups': []
                }
            });
        }
        let ok = await join_list(user, CONFIG.listmonk.optin);
        if (ok) {
            dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'add ' + email + ' to mailing list ' +  CONFIG.listmonk.optin.join(','), 'logs': []});
        } else {
            dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'subscription error ' + email + ' to mailing list ' + CONFIG.listmonk.optin.join(',') , 'logs': []});
        }
    },

    // eslint-disable-next-line no-unused-vars
    create: async function(_name) {
        return;
    },

    remove: async function(email) {
        if(email===undefined ||email===null || email=='' || ! mail_set) {
            return;
        }
        if(email.indexOf('@fake')>-1){
            return;
        }


        let user = await get_user(email);
        if(user == null) {
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'unsubscribe error with ' + email + 'in mailing list' , 'logs': []});
            logger.error('Failed to remove ' + email + ' from mailing list');
            return;
        }

        
        let ok = await quit_list(user, CONFIG.listmonk.optout);
        if (ok) {
            dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'remove ' + email + ' from mailing list ' + CONFIG.listmonk.optout.join(',') , 'logs': []});
        } else {
            dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'unsubscribe error ' + email + ' from mailing list ' + CONFIG.listmonk.optout.join(',') , 'logs': []});
        }
    },

    delete: async function(email) {
        if(email===undefined ||email===null || email=='' || ! mail_set) {
            return;
        }
        if(email.indexOf('@fake')>-1){
            return;
        }
        let user = await get_user(email);
        if(user != null) {
            delete_user(user);
        }
    },

    modify: async function(oldemail, newemail, uid) {
        logger.debug('Update email ' + oldemail + ' ==> ' + newemail);
        if(newemail===undefined ||newemail===null || newemail=='' || ! mail_set ) {
            return;
        }
        if(newemail.indexOf('@fake')>-1){
            return;
        }

        if(newemail === oldemail){
            return;
        }

        let olduser = await get_user(oldemail);
        if(olduser) {
            // change
            olduser.name = uid;
            olduser.email = newemail;
            let ok = await update_user(olduser);
            if(!ok) {
                await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'subscription update error with ' + oldemail + 'in mailing list' , 'logs': []});
                logger.error('Failed to update ' + oldemail + ' to mailing list ' );
            }
        } else {
            let user = await create_user({
                email: newemail,
                name: uid,
                status: 'enabled',
                lists: [],
                attribs: {
                    'groups': []
                }
            });

            let ok = await join_list(user, CONFIG.listmonk.optin);
            if (ok) {
                dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'add ' + newemail + ' to mailing list ' +  CONFIG.listmonk.optin.join(','), 'logs': []});
            } else {
                dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'subscription error ' + newemail + ' to mailing list ' + CONFIG.listmonk.optin.join(',') , 'logs': []});
            }
        }

    },

    sendUser: async function(mailOptions) {
        if(transporter === null) {
            logger.error('[notif][sendUser] no transport');
        }
        let sbjtag = (CONFIG.nodemailer.prefix ? CONFIG.nodemailer.prefix : CONFIG.general.name);

        if (sbjtag.length > 0) {
            sbjtag = '[' + sbjtag + '] ';
        }

        let info =  {
            from: mailOptions.origin,
            to: mailOptions.destinations.join(),
            subject: sbjtag + mailOptions.subject,
            html: mailOptions.html_message
        };

        if (CONFIG.general.support) {
            info.replyTo= CONFIG.general.support;
        }

        try {
            await transporter.sendMail(info);
            logger.info('Message sent to ' + mailOptions.destinations.join() + ':' + mailOptions.subject);

        }
        catch (error) {
            logger.error(error);
        }
    },

    // eslint-disable-next-line no-unused-vars
    sendList: async function(_mailing_list, _mailOptions) {
        return ('no listmonk direct sending', false);
    }
};
