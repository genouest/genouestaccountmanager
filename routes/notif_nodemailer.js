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
        logger.warn("add: no mailing list configured", email);
        callback();
        return;
    },

    create: function(name, callback) {
        logger.warn("create: no mailing list configured", name);
        callback();
        return;
    },

    remove: function(email, callback) {
        logger.warn("remove: no mailing list configured", email);
        callback();
        return;
    },

    modify: function(oldemail, newemail, callback) {
        logger.warn("remove: no mailing list configured", oldemail, newemail);
        callback();
        return;
    },

    sendUser: function(mailOptions, callback) {
        logger.error("sendUser: Nodemailer not yet implemented in My");
        callback("Nodemailer not yet implemented in My" , true);
        return;
    },

    sendList: function(mailing_list, mailOptions, callback) {
        logger.warn("sendList: no mailing list configured", mailing_list, mailOptions);
        callback("no mailing list configured", true);
        return;
    }
};
