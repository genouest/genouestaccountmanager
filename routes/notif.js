var CONFIG = require('config');
var fs = require('fs');
var mcapi = require('mailchimp-api/mailchimp');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

mc = null;
if(CONFIG.mailchimp.apikey){
    mc = new mcapi.Mailchimp(CONFIG.mailchimp.apikey);
}

module.exports = {

    subscribed: function(email, callback) {
        if(email.indexOf("@fake")>-1){
            callback(false);
            return;
        }
        if(mc == null){
            callback(false);
            return;
        }
        mc.lists.memberInfo({id: CONFIG.mailchimp.list, emails:[{email: email}]}, function(data) {
            if(data && data.success_count == 1 && data.data[0].status == 'subscribed'){
                callback(true);
                return;
            }
            else {
                callback(false);
                return;
            }
        });

    },

  add: function(email, callback) {
    if(email==undefined ||email==null || email=='' || mc==null) {
      callback();
      return;
    }
    if(email.indexOf("@fake")>-1){
        callback();
        return;
    }
    mc.lists.subscribe({id: CONFIG.mailchimp.list, email:{email: email}, double_optin: false, update_existing: true, send_welcome: true }, function(data) {
      events_db.insert({'date': new Date().getTime(), 'action': 'add ' + email + 'to mailing list' , 'logs': []}, function(err){});
      callback();
    }, function(error) {
      events_db.insert({'date': new Date().getTime(), 'action': 'subscription error ' + email + ' to mailing list' , 'logs': []}, function(err){});
      logger.error("Failed to add "+email+" to mailing list");
    });
  },
  remove: function(email, callback) {
    if(email==undefined ||email==null || email=='' || mc==null) {
      callback();
      return;
    }
    if(email.indexOf("@fake")>-1){
        callback();
        return;
    }
    try {
        mc.lists.unsubscribe({id: CONFIG.mailchimp.list, email:{email: email}, delete_member: true}, function(data) {
            events_db.insert({'date': new Date().getTime(), 'action': 'unsubscribe ' + email + ' from mailing list' , 'logs': []}, function(err){});
            callback();
        });
    }
    catch(err) {
        callback();
    }

  },
  modify: function(oldemail, newemail, callback) {
    logger.debug("Update email " + oldemail + " ==> " + newemail);
    if(newemail==undefined ||newemail==null || newemail=='' || mc==null) {
      callback();
      return;
    }
    if(newemail.indexOf("@fake")>-1){
        callback();
        return;
    }
    mc.lists.subscribe({id: CONFIG.mailchimp.list, email:{email: newemail}, double_optin: false, update_existing: true, send_welcome: true }, function(data) {
      logger.info(newemail+' subscribed');
      mc.lists.unsubscribe({id: CONFIG.mailchimp.list, email:{email: oldemail}, delete_member: true, send_notify: false }, function(data) {
        events_db.insert({'date': new Date().getTime(), 'action': 'update ' + newemail + 'in mailing list' , 'logs': []}, function(err){});
        logger.info(oldemail+' unsubscribed');
        callback();
      }, function(error){
          events_db.insert({'date': new Date().getTime(), 'action': 'unsubscribe error with ' + oldemail + 'in mailing list' , 'logs': []}, function(err){});
          logger.error("Failed to unsubscribe " + oldemail + ": "+ error);
      });
    }, function(error) {
      events_db.insert({'date': new Date().getTime(), 'action': 'subscription error with ' + newemail + 'in mailing list' , 'logs': []}, function(err){});
      logger.error("Failed to add "+newemail+" to mailing list");
    });
  },
  send: function(subject, msg, callback) {
    mc.campaigns.create({type: 'plaintext',
                         options: {
                          list_id: CONFIG.mailchimp.list,
                          subject: subject,
                          from_email: CONFIG.general.support,
                          from_name: 'GenOuest Platform'
                        },
                        content: {
                          text: msg
                        }
                        }, function(data){
                              mc.campaigns.send({cid: data.id}, function(data){
                                callback();
                              });

                          });

  }

};
