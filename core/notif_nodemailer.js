const CONFIG = require('config');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
// const request = require('request');
const nodemailer = require('nodemailer');

const dbsrv= require('../core/db.service.js');

var mail_set = false;
var mail_verified = false;
// mailset should be a isnull on transporter (or not)
var transporter = null;

if(CONFIG.nodemailer){
    transporter = nodemailer.createTransport({
        host: CONFIG.nodemailer.host,
        port: CONFIG.nodemailer.port,
        secure: false, // upgrade later with STARTTLS
    });

    verify_transport();
}


async function verify_transport () {
    // eslint-disable-next-line no-unused-vars
    try {
        await transporter.verify();
        mail_set =true;
        logger.info('Smtp Server is ready to take our messages');
    }
    catch (error) {
        logger.error(error);
    }
    mail_verified = true;

}


module.exports = {

    mailSet: async function(){
        if (!mail_verified) {
            await verify_transport();
        }
        return mail_set;
    },

    subscribed: async function(email, callback) {
        if (CONFIG.nodemailer.list) {
            let user = await dbsrv.mongo_users().findOne({email: email});
            if(!user) {
                logger.error('User does not exist', email);
                callback(false);
                return;
            }
            callback(user.subscribed);
            return;
        }
        return;
    },

    getMembers: function(list, callback) {
        logger.warn('getMembers: no mailing list configured', list);
        callback(false);
        return;
    },

    getLists: function(callback){
        logger.warn('getLists: no mailing list configured');
        callback([]);
        return;
    },

    add: async function(email, callback) {
        if (CONFIG.nodemailer.list) {
            if(email===undefined ||email===null || email=='' || ! mail_set) {
                callback();
                return;
            }
            let user = await dbsrv.mongo_users().findOne({email: email});
            if(!user) {
                logger.error('User does not exist', email);
                callback();
                return;
            }
            transporter.sendMail({
                from: CONFIG.nodemailer.origin,
                to: CONFIG.nodemailer.list.cmd_address,
                subject: CONFIG.nodemailer.list.cmd_add + ' ' + CONFIG.nodemailer.list.address + ' ' + email
            });
            logger.info('user added to ' + CONFIG.nodemailer.list.address, email);

            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'add ' + email + 'to mailing list' , 'logs': []});
            await dbsrv.mongo_users().updateOne({email: email}, {'$set':{'subscribed': true}});
        }
        callback();
        return;
    },

    create: function(name, callback) {
        logger.warn('create: no mailing list configured', name);
        callback();
        return;
    },

    // todo: should be factorized with add, as there is only small difference
    remove: async function(email, callback) {
        if (CONFIG.nodemailer.list) {
            if(email===undefined ||email===null || email=='' || ! mail_set) {
                callback();
                return;
            }
            let user = await dbsrv.mongo_users().findOne({email: email});
            if(!user) {
                logger.error('User does not exist', email);
                callback();
                return;
            }
            transporter.sendMail({
                from: CONFIG.nodemailer.origin,
                to: CONFIG.nodemailer.list.cmd_address,
                subject: CONFIG.nodemailer.list.cmd_del + ' ' + CONFIG.nodemailer.list.address + ' ' + email
            });
            logger.warn('user deleted from ' + CONFIG.nodemailer.list.address, email);
            await dbsrv.mongo_events().insertOne({'date': new Date().getTime(), 'action': 'unsubscribe ' + email + ' from mailing list' , 'logs': []});
            await dbsrv.mongo_users().updateOne({email: email}, {'$set':{'subscribed': false}});
        }
        callback();
        return;
    },

    modify: function(oldemail, newemail, callback) {
        logger.debug('Update email ' + oldemail + ' ==> ' + newemail);
        if (newemail===undefined ||newemail===null || newemail=='' || ! mail_set ) {
            callback();
            return;
        }
        this.add(newemail, function(){});
        this.remove(oldemail, function(){});
        callback();
        return;
    },

    sendUser: async function(mailOptions) {
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

    sendList: function(mailing_list, mailOptions, callback) {
        logger.warn('sendList: no mailing list configured', mailing_list, mailOptions);
        callback('no mailing list configured', true);
        return;
    }
};
