var CONFIG = require('config');
/*
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    events_db = db.get('events');
*/
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const request = require('request');

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_events = null;

var mongo_connect = async function() {
    let url = CONFIG.mongo.url;
    let client = null;
    if(!url) {
        client = new MongoClient(`mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}`);
    } else {
        client = new MongoClient(CONFIG.mongo.url);
    }
    await client.connect();
    mongodb = client.db(CONFIG.general.db);
    mongo_events = mongodb.collection('events');
};
mongo_connect();


var mail_set = false;

if(CONFIG.gomail.api_secret && CONFIG.gomail.host && CONFIG.gomail.host !== 'fake' && CONFIG.gomail.api_root && CONFIG.gomail.main_list && CONFIG.gomail.origin){
    mail_set = true;
    var baseRequest = request.defaults({
        baseUrl: CONFIG.gomail.host + CONFIG.gomail.api_root,
        headers: {'Authorization': CONFIG.gomail.api_secret},
        json: true,
        timeout: 1500,
    });
}

module.exports = {

    mailSet: function(){
        return mail_set;
    },

    subscribed: function(email, callback) {
        if(email.indexOf('@fake')>-1){
            callback(false);
            return;
        }
        if(! mail_set){
            callback(false);
            return;
        }
        const options = {
            uri: '/mail/opt/' + CONFIG.gomail.main_list + '/' + email,
        };

        baseRequest(options, function(err, res, body) {
            if(err || res.statusCode !== 200){
                callback(false);
                return;
            }
            callback(body['status']);
            return;
        });
    },

    getMembers: function(list, callback) {
        if(! mail_set){
            logger.error('Mail is not set properly');
            callback(false);
            return;
        }
        const options = {
            uri: '/list/' + list,
        };

        baseRequest(options, function(err, res, body) {
            if(err || res.statusCode !== 200){
                callback([]);
                return;
            }
            callback(body['members']);
            return;
        });
    },

    getLists: function(callback){
        if(! mail_set){
            logger.error('Mail is not set properly');
            callback([]);
            return;
        }
        const options = {
            uri: '/list',
        };
        baseRequest(options, function(err, res, body) {
            if(err || res.statusCode !== 200){
                callback([]);
                return;
            }
            //Return all lists if no tag set
            var listOfLists = [];
            for ( var i = 0; i < body['lists'].length; i++){
                var name_list = body['lists'][i];
                if( ! CONFIG.gomail.tag ){
                    listOfLists.push({'list_name':name_list , 'config': body['info'][name_list]});
                    continue;
                }
                if (body['info'][name_list]['tags'] && body['info'][name_list]['tags'].indexOf(CONFIG.gomail.tag) >= 0){
                    listOfLists.push({'list_name':name_list , 'config': body['info'][name_list]});
                }
            }
            callback(listOfLists);
            return;
        });
    },

    add: function(email, callback) {
        if(email==undefined ||email==null || email=='' || ! mail_set) {
            callback();
            return;
        }
        if(email.indexOf('@fake')>-1){
            callback();
            return;
        }

        const options = {
            uri: '/mail/opt/' + CONFIG.gomail.main_list,
            body: {'email': [email], 'message': CONFIG.gomail.optin_message, 'message_html': CONFIG.gomail.optin_message_html}
        };

        // eslint-disable-next-line no-unused-vars
        baseRequest.put(options, async function(err, res, body) {
            if(err || res.statusCode !== 200){
                await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'subscription error ' + email + ' to mailing list' , 'logs': []});
                logger.error('Failed to add ' + email + ' to mailing list');
                logger.error(res);
                callback();
                return;
            }
            await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'add ' + email + 'to mailing list' , 'logs': []});
            callback();
        });
    },

    create: function(name, callback) {
        if(!name) {
            callback();
            return;
        }
        const options = {
            uri: '/list/' + name,
            body: {'name': name, 'tags': []}
        };

        // eslint-disable-next-line no-unused-vars
        baseRequest.post(options, async function(err, res, body) {
            if(err || res.statusCode !== 200){
                logger.error('Failed to create list ' + name);
                callback();
                return;
            }
            await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'create list ' + name , 'logs': []});
            callback();
        });
    },

    remove: function(email, callback) {
        if(email==undefined ||email==null || email=='' || ! mail_set) {
            callback();
            return;
        }
        if(email.indexOf('@fake')>-1){
            callback();
            return;
        }

        const options = {
            uri: '/mail/opt/' + CONFIG.gomail.main_list,
            body: {'email': [email], 'message': CONFIG.gomail.optout_message, 'message_html': CONFIG.gomail.optout_message_html}
        };

        // eslint-disable-next-line no-unused-vars
        baseRequest.delete(options, async function(err, res, body) {
            if(err || res.statusCode !== 200){
                await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'unsubscribe error with ' + email + 'in mailing list' , 'logs': []});
                logger.error('Failed to remove ' + email + ' from mailing list');
                callback();
                return;
            }
            await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'unsubscribe ' + email + ' from mailing list' , 'logs': []});
            callback();
        });

    },

    modify: function(oldemail, newemail, callback) {
        logger.debug('Update email ' + oldemail + ' ==> ' + newemail);
        if(newemail==undefined ||newemail==null || newemail=='' || ! mail_set ) {
            callback();
            return;
        }
        if(newemail.indexOf('@fake')>-1){
            callback();
            return;
        }

        if(newemail === oldemail){
            callback();
            return;
        }

        const options = {
            uri: '/mail/opt/' + CONFIG.gomail.main_list,
            body: {'email': [newemail], 'skip':true}
        };

        // eslint-disable-next-line no-unused-vars
        baseRequest.put(options, async function(err, res, body) {
            if(err){
                await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'subscription error with ' + newemail + 'in mailing list' , 'logs': []});
                logger.error('Failed to add ' + newemail + ' to mailing list : ' + err );
                callback();
                return;
            }
            if(res.statusCode !== 200){
                await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'subscription error with ' + newemail + 'in mailing list' , 'logs': []});
                logger.error('Failed to add ' + newemail + ' to mailing list : error code ' + res.statusCode);
                callback();
                return;
            }
            options.body = {'email': [oldemail], 'skip':'true'};
            // eslint-disable-next-line no-unused-vars
            baseRequest.delete(options, async function(err, res, body) {
                if(err){
                    await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'unsubscribe error with ' + oldemail + 'in mailing list' , 'logs': []});
                    logger.error('Failed to unsubscribe ' + oldemail + ': ' + err);
                    callback();
                    return;
                }
                if(res.statusCode !== 200){
                    await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'unsubscribe error with ' + oldemail + 'in mailing list' , 'logs': []});
                    logger.error('Failed to unsubscribe ' + oldemail + ': error code ' + res.statusCode);
                    callback();
                    return;
                }
                await mongo_events.insertOne({'date': new Date().getTime(), 'action': 'update ' + newemail + 'in mailing list' , 'logs': []});
                logger.info(oldemail+' unsubscribed');
                callback();
            });
        });
    },

    sendUser: function(mailOptions, callback) {
        const options = {
            uri: '/mail',
            body: mailOptions
        };

        // eslint-disable-next-line no-unused-vars
        baseRequest.post(options, function(err, res, body) {
            if(err){
                logger.error('Failed to send mail : ' + err);
                callback('Failed to send mail : ' + err, false);
                return;
            }
            if(res.statusCode !== 200){
                logger.error('Failed to send mail : error code ' + res.statusCode);
                callback('Failed to send mail : error code ' + res.statusCode, false);
                return;
            }

            callback('', false);
        });

    },

    sendList: function(mailing_list, mailOptions, callback) {
        const options = {
            uri: '/mail/' + mailing_list,
            body: mailOptions
        };
        // eslint-disable-next-line no-unused-vars
        baseRequest.post(options, function(err, res, body) {
            if(err){
                logger.error('Failed to send mail : ' + err);
                callback('Failed to send mail : ' + err, false);
                return;
            }
            if(res.statusCode !== 200){
                logger.error('Failed to send mail : error code ' + res.statusCode);
                callback('Failed to send mail : error code ' + res.statusCode, false);
                return;
            }

            callback('', true);
        });

    }
};
