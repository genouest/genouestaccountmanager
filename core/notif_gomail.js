const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const https = require('https');
//const request = require('request');
const axios = require('axios');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');

var mail_set = false;

const gomailAgent = new https.Agent({
    rejectUnauthorized: CONFIG.gomail.force_tls ? true : false
});

let gomailHeaders = {};
let gomailUrl = '';

if(CONFIG.gomail.api_secret && CONFIG.gomail.host && CONFIG.gomail.host !== 'fake' && CONFIG.gomail.api_root && CONFIG.gomail.main_list && CONFIG.gomail.origin){
    mail_set = true;
    gomailUrl = CONFIG.gomail.host + CONFIG.gomail.api_root;
    gomailHeaders = {
        'Authorization': CONFIG.gomail.api_secret,
        'Accept': 'application/json',
        'Content-Type': 'application/json'

    };
    axios.defaults.timeout = 1500;
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
            let resp = await axios.get(gomailUrl + '/mail/opt/' + CONFIG.gomail.main_list + '/' + email, {
                headers: gomailHeaders,
                httpsAgent: gomailAgent
            });
            return resp.data.status;
        }
        catch(err) {
            return false;
        }
    },

    getMembers: async function(list) {
        if(! mail_set){
            logger.error('Mail is not set properly');
            return false;
        }
        try {
            let resp = await axios.get(gomailUrl + '/list/' + list, {
                headers: gomailHeaders,
                httpsAgent: gomailAgent
            });
            return resp.data.members;
        } catch (err) {
            return [];
        }
    },

    getLists: async function(){
        if(! mail_set){
            logger.error('Mail is not set properly');
            return [];
        }
        try {
            let resp = await axios.get(gomailUrl + '/list', {
                headers: gomailHeaders,
                httpsAgent: gomailAgent
            });
            let lists = resp.data.lists;
            let listOfLists = [];
            for ( let i = 0; i < lists.length; i++){
                let name_list = lists[i];
                if( ! CONFIG.gomail.tag ){
                    listOfLists.push({'list_name':name_list , 'config': resp.data.info[name_list]});
                    continue;
                }
                if (resp.data.info[name_list]['tags'] && resp.data.info[name_list]['tags'].indexOf(CONFIG.gomail.tag) >= 0){
                    listOfLists.push({'list_name':name_list , 'config': resp.data.info[name_list]});
                }
            }
            return listOfLists;
        } catch (err) {
            return [];
        }
    },

    // eslint-disable-next-line no-unused-vars
    add: async function(email, uid) {
        if(email===undefined ||email===null || email=='' || ! mail_set) {
            logger.error('[notif][add] email not valid');
            return;
        }
        if(email.indexOf('@fake')>-1){
            return;
        }

        try {
            await axios.put(
                gomailUrl + '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    'email': [email],
                    'message': CONFIG.gomail.optin_message,
                    'message_html': CONFIG.gomail.optin_message_html
                },
                {
                    headers: gomailHeaders,
                    httpsAgent: gomailAgent
                }
            );
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'add ' + email + ' to mailing list' , 'logs': []});
        } catch (err) {
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'subscription error ' + email + ' to mailing list' , 'logs': []});
            logger.error('Failed to add ' + email + ' to mailing list', err);
        }
    },

    create: async function(name) {
        if(!name) {
            return;
        }
        try {
            await axios.post(gomailUrl + '/list/' + name, {'name': name, 'tags': []}, {
                headers: gomailHeaders,
                httpsAgent: gomailAgent
            });
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'create list ' + name , 'logs': []});
        } catch (err) {
            logger.error('Failed to create list ' + name);
        }
    },

    remove: async function(email, sendmail=true) {
        if(email===undefined ||email===null || email=='' || ! mail_set) {
            return;
        }
        if(email.indexOf('@fake')>-1){
            return;
        }

        let data = {
            'email': [email],
            'message': CONFIG.gomail.optout_message,
            'message_html': CONFIG.gomail.optout_message_html,
        };

        if (!sendmail){
            data['skip'] = true;
        }

        try {
            await axios.delete(
                gomailUrl + '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    data: data,
                    headers: gomailHeaders,
                    httpsAgent: gomailAgent
                }
            );
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'unsubscribe ' + email + ' from mailing list' , 'logs': []});

        } catch (err) {
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'unsubscribe error with ' + email + 'in mailing list' , 'logs': []});
            logger.error('Failed to remove ' + email + ' from mailing list');
        }
    },

    // eslint-disable-next-line no-unused-vars
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

        try {
            await axios.put(
                gomailUrl + '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    'email': [newemail],
                    'skip': true
                }, {
                    headers: gomailHeaders,
                    httpsAgent: gomailAgent
                }
            );
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'update ' + newemail + 'in mailing list' , 'logs': []});
            await axios.delete(
                gomailUrl + '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    'data': {
                        'email': [oldemail],
                        'skip': true
                    },
                    headers: gomailHeaders,
                    httpsAgent: gomailAgent
                }
            );

            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'remove ' + oldemail + 'from mailing list' , 'logs': []});
            logger.info(oldemail+' unsubscribed');
        } catch(err) {
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'subscription update error with ' + newemail + 'in mailing list' , 'logs': []});
            logger.error('Failed to update ' + newemail + ' to mailing list');
        }
    },

    sendUser: async function(mailOptions) {
        try {
            await axios.post(gomailUrl + '/mail', mailOptions, {
                headers: gomailHeaders,
                httpsAgent: gomailAgent
            });
        } catch(err) {
            logger.error('Failed to send mail : ' + err);
        }
    },

    sendList: async function(mailing_list, mailOptions) {
        try {
            await axios.post(gomailUrl + '/mail/' + mailing_list, mailOptions, {
                headers: gomailHeaders,
                httpsAgent: gomailAgent
            });
        } catch(err) {
            logger.error('Failed to send mail : ' + err);
        }
    }
};
