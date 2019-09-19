const CONFIG = require('config');
const fs = require('fs');
const monk = require('monk'),
      db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
      web_db = db.get('web'),
      users_db = db.get('users'),
      events_db = db.get('events');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const request = require('request');
const nodemailer = require("nodemailer");

var mail_set = false;
// mailset should be a isnull on transporter (or not)
var transporter = null;

if(CONFIG.nodemailer){
    transporter = nodemailer.createTransport({
        host: CONFIG.nodemailer.host,
        port: CONFIG.nodemailer.port,
        secure: false, // upgrade later with STARTTLS
    });

    transporter.verify(function(error, success) {
        if (error) {
            console.log(error);
        } else {
            mail_set =true;
            console.log("Smtp Server is ready to take our messages");
        }
    });
}

module.exports = {

    mailSet: function(){
        return mail_set;
    },

    subscribed: function(email, callback) {
        logger.warn("subscribed: no mailing list configured", email);
        callback(false);
        return;
    },

    getMembers: function(list, callback) {
        logger.warn("getMembers: no mailing list configured", list);
        callback(false);
        return;
    },

    getLists: function(callback){
        logger.warn("getLists: no mailing list configured");
        callback([]);
        return;
    },

    add: function(email, callback) {
        if(email==undefined ||email==null || email=='' || ! mail_set) {
            callback();
            return;
        }
        if (CONFIG.nodemailer.list) {
            transporter.sendMail({
            from: CONFIG.nodemailer.origin,
            to: CONFIG.nodemailer.list.cmd_address,
            subject: CONFIG.nodemailer.list.cmd_add + ' ' + CONFIG.nodemailer.list.address + ' ' + email
            });
            logger.info("user added to " + CONFIG.nodemailer.list.address, email);
        }
        callback();
        events_db.insert({'date': new Date().getTime(), 'action': 'add ' + email + 'to mailing list' , 'logs': []}, function(err){});
        return;
    },

    create: function(name, callback) {
        logger.warn("create: no mailing list configured", name);
        callback();
        return;
    },

    remove: function(email, callback) {
        if(email==undefined ||email==null || email=='' || ! mail_set) {
            callback();
            return;
        }
        if (CONFIG.nodemailer.list) {
            transporter.sendMail({
                from: CONFIG.nodemailer.origin,
                to: CONFIG.nodemailer.list.cmd_address,
                subject: CONFIG.nodemailer.list.cmd_del + ' ' + CONFIG.nodemailer.list.address + ' ' + email
            });
            logger.warn("user deleted from " + CONFIG.nodemailer.list.address, email);
        }
        events_db.insert({'date': new Date().getTime(), 'action': 'unsubscribe ' + email + ' from mailing list' , 'logs': []}, function(err){});
        callback();
        return;
    },

    modify: function(oldemail, newemail, callback) {
        logger.debug("Update email " + oldemail + " ==> " + newemail);
        if (newemail==undefined ||newemail==null || newemail=='' || ! mail_set ) {
            callback();
            return;
        }
        this.add(newemail, function(err){});
        this.remove(oldemail, function(err){});
        callback();
        return;
    },

    sendUser: function(mailOptions, callback) {
        let sbjtag = (CONFIG.nodemailer.prefix ? CONFIG.nodemailer.prefix : CONFIG.general.name);

        if (sbjtag.length > 0) {
            sbjtag = "[" + sbjtag + "] ";
        }

        let info =  transporter.sendMail({
            from: mailOptions.origin,
            to: mailOptions.destinations.join(),
            subject: sbjtag + mailOptions.subject,
            html: mailOptions.html_message
        });

        logger.info("Message sent to " + mailOptions.destinations.join() + ":" + mailOptions.subject);

        callback("" , true);
        return;
    },

    sendList: function(mailing_list, mailOptions, callback) {
        logger.warn("sendList: no mailing list configured", mailing_list, mailOptions);
        callback("no mailing list configured", true);
        return;
    }
};
