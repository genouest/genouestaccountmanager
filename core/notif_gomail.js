const winston = require('winston');
const logger = winston.loggers.get('gomngr');
//const request = require('request');
const axios = require('axios');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');

var mail_set = false;

if(CONFIG.gomail.api_secret && CONFIG.gomail.host && CONFIG.gomail.host !== 'fake' && CONFIG.gomail.api_root && CONFIG.gomail.main_list && CONFIG.gomail.origin){
    mail_set = true;
    axios.defaults.baseURL = CONFIG.gomail.host + CONFIG.gomail.api_root;
    axios.defaults.headers = {
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
            let resp = await axios.get('/mail/opt/' + CONFIG.gomail.main_list + '/' + email);
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
            let resp = await axios.get('/list/' + list);
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
            let resp = await axios.get('/list');
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

    add: async function(email) {
        if(email===undefined ||email===null || email=='' || ! mail_set) {
            logger.error('[notif][add] email not valid');
            return;
        }
        if(email.indexOf('@fake')>-1){
            return;
        }

        try {
            await axios.put(
                '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    'email': [email],
                    'message': CONFIG.gomail.optin_message,
                    'message_html': CONFIG.gomail.optin_message_html
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
            await axios.post('/list/' + name, {'name': name, 'tags': []});
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'create list ' + name , 'logs': []});
        } catch (err) {
            logger.error('Failed to create list ' + name, err);
        }
    },

    remove: async function(email) {
        if(email===undefined ||email===null || email=='' || ! mail_set) {
            return;
        }
        if(email.indexOf('@fake')>-1){
            return;
        }

        try {
            await axios.delete(
                '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    data: {
                        'email': [email],
                        'message': CONFIG.gomail.optout_message,
                        'message_html': CONFIG.gomail.optout_message_html
                    }
                }
            );
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'unsubscribe ' + email + ' from mailing list' , 'logs': []});

        } catch (err) {
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'unsubscribe error with ' + email + 'in mailing list' , 'logs': []});
            logger.error('Failed to remove ' + email + ' from mailing list', err);
        }
    },

    modify: async function(oldemail, newemail) {
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
                '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    'email': [newemail],
                    'skip': true
                }
            );
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'update ' + newemail + 'in mailing list' , 'logs': []});
            await axios.delete(
                '/mail/opt/' + CONFIG.gomail.main_list,
                {
                    'data': {
                        'email': [oldemail],
                        'skip': true
                    }
                }
            );
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'remove ' + oldemail + 'from mailing list' , 'logs': []});
            logger.info(oldemail+' unsubscribed');
        } catch(err) {
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'subscription update error with ' + newemail + 'in mailing list' , 'logs': []});
            logger.error('Failed to update ' + newemail + ' to mailing list : ' + err );
        }
    },

    sendUser: async function(mailOptions) {
        try {
            await axios.post('/mail', mailOptions);
        } catch(err) {
            logger.error('Failed to send mail : ' + err);
        }
    },

    sendList: async function(mailing_list, mailOptions) {
        try {
            await axios.post('/mail/' + mailing_list, mailOptions);
            return ('', true);
        } catch(err) {
            logger.error('Failed to send mail : ' + err);
            return ('Failed to send mail : ' + err, false);
        }
    }
};
