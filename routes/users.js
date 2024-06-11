/* eslint-disable require-atomic-updates */
/*jslint es6 */
const express = require('express');
var router = express.Router();
const markdown = require('markdown').markdown;
const htmlToText = require('html-to-text');
const validator = require('email-validator');
const crypto = require('crypto');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;
var GENERAL_CONFIG = CONFIG.general;

const goldap = require('../core/goldap.js');
const dbsrv = require('../core/db.service.js');
const maisrv = require('../core/mail.service.js');
const plgsrv = require('../core/plugin.service.js');
const sansrv = require('../core/sanitize.service.js');
const filer = require('../core/file.js');

const MAILER = CONFIG.general.mailer;
const notif = require('../core/notif_'+MAILER+'.js');

var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

let day_time = 1000 * 60 * 60 * 24;
let duration_list = CONFIG.duration;
//const runningEnv = process.env.NODE_ENV || 'prod';

const grpsrv = require('../core/group.service.js');
const usrsrv = require('../core/user.service.js');
const rolsrv = require('../core/role.service.js');

router.get('/user/:id/apikey', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(session_user.uid !== req.params.id && !isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user= await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    if (user.apikey === undefined) {
        res.send({apikey: ''});
        res.end();
        return;
    } else {
        res.send({apikey: user.apikey});
        res.end();
        return;
    }
});


router.post('/user/:id/notify', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {

        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    let message = req.body.message;
    let subject = req.body.subject;
    let msg_destinations = [user.email];
    if (user.send_copy_to_support) {
        msg_destinations.push(CONFIG.general.support);
    }


    try {
        await maisrv.send_notif_mail({
            'name': null,
            'destinations': msg_destinations,
            'subject': subject,
            'markdown': message,
        }, {});
    } catch(error) {
        logger.error(error);
        res.status(500).send({message: 'message error', error: error});
        res.end();
        return;
    }
    await dbsrv.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'message: ' + subject , 'logs': []});

    res.send({message: 'message sent'});
    res.end();
});

router.post('/user/:id/apikey', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(session_user.uid !== req.params.id && !isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    //let apikey = Math.random().toString(36).slice(-10);
    let apikey = usrsrv.new_random(10);
    await dbsrv.mongo_users().updateOne({uid: req.params.id}, {'$set':{'apikey': apikey}});
    res.send({apikey: apikey});
    res.end();
});


router.put('/user/:id/subscribe', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let isadmin = false;
    try {
        let user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    // if not user nor admin
    if (req.locals.logInfo.id !== req.params.id && !isadmin) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.email == undefined || user.email == '' || user.is_fake){
        res.send({subscribed: false});
        res.end();
    } else {
        await notif.add(user.email);
        res.send({subscribed: true});
        res.end();
    }

});

router.put('/user/:id/unsubscribe', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let isadmin = false;
    try {
        let user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    // if not user nor admin
    if (req.locals.logInfo.id !== req.params.id && !isadmin) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.email == undefined || user.email == '' || user.is_fake){
        res.send({unsubscribed: false});
        res.end();
    } else {
        await notif.remove(user.email);
        res.send({unsubscribed: true});
        res.end();
    }

});


router.get('/user/:id/subscribed', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.email == undefined || user.email == '' || user.is_fake){
        res.send({subscribed: false});
        res.end();
    } else {
        let is_subscribed = await notif.subscribed(user.email);
        res.send({subscribed: is_subscribed});
        res.end();
    }
});

router.get('/ip', function(req, res) {
    let ip = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    res.json({ip: ip});
});

router.post('/message', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    if(! notif.mailSet()){
        res.status(403).send({message: 'Mail provider is not set'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let message = req.body.message;
    let html_message = req.body.message;

    if(req.body.input === 'Markdown'){
        html_message = markdown.toHTML(req.body.message);
        message =  htmlToText.fromString(html_message);
    } else if (req.body.input === 'HTML'){
        message =  htmlToText.fromString(html_message);
    }
    let mailOptions = {
        //origin: MAIL_CONFIG.origin,
        origin: req.body.from,
        subject: req.body.subject,
        message: message,
        html_message: html_message
    };
    await notif.sendList(req.body.list, mailOptions);
    res.send({message: ''});
    return;
});

// Get users listing - for admin
router.get('/user', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let users = await dbsrv.mongo_users().find({}).toArray();
    res.json(users);
});


router.post('/user/:id/group/:group', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id, req.params.group])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user){
        res.status(401).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let uid = req.params.id;
    let secgroup = req.params.group;

    try {
        await usrsrv.add_user_to_group(uid, secgroup, session_user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }

    res.send({message: 'User added to group'});
    res.end();
    return;

});

router.delete('/user/:id/group/:group', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id, req.params.group])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user || !isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let uid = req.params.id;
    let secgroup = req.params.group;

    try {
        await usrsrv.remove_user_from_group(uid, secgroup, session_user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }

    res.send({message: 'User removed from Group'});
    res.end();


});


router.delete('/user/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user || !isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let uid = req.params.id;
    let mail_message = '';
    let mail_send = false;
    if (req.body.message) {
        mail_message = req.body.message;
    }
    if (req.body.sendmail) {
        mail_send = req.body.sendmail;
    }

    let user = await dbsrv.mongo_users().findOne({uid: uid});
    if(!user) {
        res.send({message: 'User not found ' + uid});
        res.end();
        return;
    }
    if(user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL){
        usrsrv.delete_user(user, session_user.uid, mail_message, mail_send).then(function(){
            res.send({message: 'User deleted'});
            res.end();
            return;
        });

    }
    else {
        // Must check if user has databases and sites
        // Do not remove in this case, owners must be changed before
        let databases = await dbsrv.mongo_databases().find({owner: uid}).toArray();
        if(databases && databases.length>0) {
            res.send({message: 'User owns some databases, please change owner first!'});
            res.end();
            return;
        }
        let websites = await dbsrv.mongo_web().find({owner: uid}).toArray();
        if(websites && websites.length>0) {
            res.send({message: 'User owns some web sites, please change owner first!'});
            res.end();
            return;
        }
        usrsrv.delete_user(user, session_user.uid, mail_message, mail_send).then(function(){
            res.send({message: 'User deleted'});
            res.end();
            return;
        });
    }
});

// activate user
router.get('/user/:id/activate', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.status(403).send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.maingroup == undefined || user.group == undefined) {
        res.status(403).send({message: 'Group or main group directory are not set'});
        res.end();
        return;
    }

    try {
        user = await usrsrv.activate_user(user, session_user.uid);
    } catch(error) {
        logger.error(error);
        res.status(error.code).send({message: error.message});
        res.end();
        return;
    }

    try {
        let msg_destinations = [user.email];
        if (user.send_copy_to_support) {
            msg_destinations.push(CONFIG.general.support);
        }

        await maisrv.send_notif_mail({
            'name' : 'activation',
            'destinations': msg_destinations,
            'subject': 'account activation'
        }, {
            '#UID#':  user.uid,
            '#PASSWORD#': user.password,
            '#IP#': user.ip
        });
    } catch(error) {
        logger.error(error);
    }

    let error = false;
    try {
        error = await plgsrv.run_plugins('activate', user.uid, user, session_user.uid);
    } catch(err) {
        logger.error('activation errors', err);
        error = true;
    }

    if(!user.is_fake) {
        try {
            await notif.add(user.email);
        } catch (err) {
            logger.error('[notif][error=add][mail=' + user.email + ']');
        }
    }

    if (error) {
        res.send({message: 'Activation error', error: []});
        res.end();
    } else {
        res.send({message: 'Activation in progress', error: []});
        res.end();
    }
});

// Get user - for logged user or admin
router.get('/user/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized, need to login first'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;

    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user) {
        res.status(401).send({message: 'Not authorized, need to login first'});
        return;
    }

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(user.is_fake===undefined) {
        user.is_fake = false;
    }
    if(user.never_expire===undefined) {
        user.never_expire = false;
    }


    user.quota = [];
    for(let k in GENERAL_CONFIG.quota) {
        user.quota.push(k);
    }

    if(session_user._id.str == user._id.str || isadmin){
        res.json(user);
    }
    else {
        res.status(401).send({message: 'Not authorized to access this user info'});
    }
});

// Registration mail confirmation
router.get('/user/:id/confirm', async function(req, res) {
    let uid = req.params.id;
    let regkey = req.query.regkey;
    if(! sansrv.sanitizeAll([uid])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: uid});
    if(! user) {
        res.status(401).send({message: 'Invalid user'});
        return;
    }
    else {
        if(user.regkey == regkey) {
            //if(user.status == STATUS_PENDING_APPROVAL) {
            if(user.status != STATUS_PENDING_EMAIL) {
                // Already pending or active
                res.redirect(GENERAL_CONFIG.url+'/manager2/pending');
                res.end();
                return;
            }
            let account_event = {action: 'email_confirm', date: new Date().getTime()};
            await dbsrv.mongo_users().updateOne(
                { _id: user._id},
                {
                    $set: {status: STATUS_PENDING_APPROVAL},
                    $push: {history: account_event}
                });

            let link = GENERAL_CONFIG.url + encodeURI('/manager2/user/'+user.uid);
            try {
                await maisrv.send_notif_mail({
                    'name': 'registration',
                    'destinations': [GENERAL_CONFIG.accounts],
                    'subject': 'account registration: '+uid
                }, {
                    '#UID#':  user.uid,
                    '#LINK#': link
                });
            } catch(error) {
                logger.error(error);
            }

            await dbsrv.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user confirmed email:' + req.params.id , 'logs': []});
            res.redirect(GENERAL_CONFIG.url+'/manager2/pending');
            res.end();
        }
        else {
            res.status(401).send({message: 'Invalid registration key'});
            return;
        }
    }
});



// Register
router.post('/user/:id', async function(req, res) {
    logger.info('New register request for '+req.params.id);
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    if(req.body.firstname=='' || req.body.firstname===null || req.body.firstname===undefined) {
        res.send({status: 1, message: 'Missing field: firstname'});
        return;
    }

    if(req.body.lastname=='' || req.body.lastname===null || req.body.lastname===undefined) {
        res.send({status: 1, message: 'Missing field: lastname'});
        return;
    }

    if(req.body.team=='' || req.body.team===null || req.body.team===undefined) {
        res.send({status: 1, message: 'Missing field: team'});
        return;
    }
    if (!req.body.team.match(/^[0-9a-z_]+$/)) {
        res.send({status: 1, message: 'Team name must be alphanumeric and lowercase [0-9a-z_]'});
        res.end();
        return;
    }

    if(req.body.lab=='' || req.body.lab===null || req.body.lab===undefined) {
        res.send({status: 1, message: 'Missing field: lab'});
        return;
    }
    if(req.body.address=='' || req.body.address===null || req.body.address===undefined) {
        res.send({status: 1, message: 'Missing field: address'});
        return;
    }

    if(req.body.responsible=='' || req.body.responsible===null || req.body.responsible===undefined) {
        res.send({status: 1, message: 'Missing field: Responsible/Manager'});
        return;
    }
    if(!req.params.id.match(/^[0-9a-z]+$/)){
        res.send({status: 1, message: 'invalid data identifier, numeric and lowercase letters only'});
        return;
    }

    let usermaxlen = 12;
    if (CONFIG.general.username_max_length) {
        usermaxlen = CONFIG.general.username_max_length;
    }
    if (req.params.id.length > usermaxlen) {
        res.send({status: 1, message: 'user id too long, must be < ' + usermaxlen + ' characters'});
        res.end();
        return;
    }

    if(req.body.why=='' || req.body.why===null || req.body.why===undefined) {
        res.send({status: 1, message: 'Missing field: Why do you need an account'});
        return;
    }

    if(!validator.validate(req.body.email)) {
        res.send({status: 1, message: 'Invalid email format'});
        return;
    }

    if (!req.body.is_fake) {
        let user_email = await dbsrv.mongo_users().findOne({email: req.body.email, is_fake: false});
        if(user_email){
            res.send({status: 1, message: 'User email already exists'});
            return;
        }
    }

    if (!(req.body.duration in duration_list))
    {
        res.send({status: 1, message: 'Invalid duration format'});
        return;
    }

    let userexists = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(userexists){
        res.send({status: 1, message: 'User id already exists'});
        return;
    }

    let uidMd5 = crypto.createHash('md5').update(req.params.id).digest('hex');
    let userexisted = await dbsrv.mongo_oldusers().findOne({uid: uidMd5});
    if(userexisted && (CONFIG.general.prevent_reuse === undefined || CONFIG.general.prevent_reuse)){
        logger.error(`User uid ${req.params.id} already used in the past, preventing reuse`);
        res.send({status: 1, message: 'User id already used'});
        return;
    }

    let user = {
        uid: req.params.id,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        send_copy_to_support: req.body.send_copy_to_support,
        create_imap_mailbox: req.body.create_imap_mailbox,
        address: req.body.address,
        lab: req.body.lab,
        responsible: req.body.responsible,
        team: req.body.team,
        why: req.body.why,
        ip: req.body.ip,
        is_fake: req.body.is_fake,
        duration: req.body.duration,
        history: [{action: 'register', date: new Date().getTime()}],
        extra_info: req.body.extra_info || []
    };

    // check if register user is done by admin or by anonymouse user
    let action_owner = user.uid;
    if (req.locals.logInfo) {
        try {
            let session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
            if (session_user) {
                action_owner = session_user.uid;
            }
        } catch(e) {
            logger.error(e);
        }
    }

    try {
        user = await usrsrv.create_user(user, action_owner);
    } catch (error) {
        logger.error(error);
    }

    let link = GENERAL_CONFIG.url + encodeURI('/user/' + user.uid + '/confirm?regkey=' + user.regkey);
    try {
        let msg_destinations = [user.email];
        if (user.send_copy_to_support) {
            msg_destinations.push(CONFIG.general.support);
        }
        await maisrv.send_notif_mail({
            'name' : 'confirmation',
            'destinations': msg_destinations,
            'subject': 'account confirmation'
        }, {
            '#UID#':  user.uid,
            '#LINK#': link
        });
    } catch(error) {
        logger.error(error);
    }

    res.send({status: 0, message: 'Could not send an email, please contact the support.'});
    res.end();
    return;

});

router.get('/user/:id/expire', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if (!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    session_user.is_admin = isadmin;

    if(session_user.is_admin){
        //let new_password = Math.random().toString(36).slice(-10);
        let new_password = usrsrv.new_password(10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch(err) {
            res.send({message: 'Error during operation'});
            return;
        }
        user.history.push({'action': 'expire', date: new Date().getTime()});
        // eslint-disable-next-line no-unused-vars
        await dbsrv.mongo_users().updateOne({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}});

        try {
            let created_file = await filer.user_expire_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch(error){
            logger.error('Expire User Failed for: ' + user.uid, error);
            res.status(500).send({message: 'Expire User Failed'});
            return;
        }

        await dbsrv.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user expired by ' + session_user.uid , 'logs': [user.uid + '.' + fid + '.update']});

        // Now remove from mailing list
        try {
            // eslint-disable-next-line no-unused-vars
            await notif.remove(user.email);
            await plgsrv.run_plugins('deactivate', user.uid, user, session_user.uid);
            res.send({message: 'Operation in progress', fid: fid, error: []});
            res.end();
        }
        catch(error) {
            res.send({message: 'Operation in progress, user not in mailing list', fid: fid, error: error});
            res.end();
            return;
        }
        return;

    }
    else {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
});


router.post('/user/:id/passwordreset', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user || session_user.uid != req.params.id && !isadmin) {
        res.send({message: 'Not authorized'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.status(404).send({message: 'User does not exist:'+req.params.id});
        res.end();
        return;
    }
    if(user.status != STATUS_ACTIVE){
        res.status(401).send({message: 'Your account is not active'});
        res.end();
        return;
    }

    user.password=req.body.password;
    await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.params.id + ' password update request', 'logs': []});
    let fid = new Date().getTime();
    try {
        await goldap.reset_password(user, fid);
    } catch(err) {
        res.send({message: 'Error during operation'});
        return;
    }

    try {
        let created_file = await filer.user_reset_password(user, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Reset Password Failed for: ' + user.uid, error);
        res.status(500).send({message: 'Reset Password Failed'});
        return;
    }

    res.send({message:'Password updated'});
    return;
});


//app.get('/user/:id/passwordreset', users);
router.get('/user/:id/passwordreset', async function(req, res){
    //let key = Math.random().toString(36).substring(7);
    let key = usrsrv.new_random(7);
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.status != STATUS_ACTIVE){
        res.status(401).send({message: 'Your account is not active'});
        res.end();
        return;
    }

    if(user.is_fake){
        res.status(403).send({message: 'Password reset not allowed for fake accounts'});
        res.end();
        return;
    }

    try {
        await dbsrv.mongo_users().updateOne({uid: req.params.id},{'$set': {regkey: key}});
    } catch(err) {
        res.status(404).send({message: 'User cannot be updated'});
        res.end();
        return;
    }

    user.password='';
    // Now send email
    let link = CONFIG.general.url + encodeURI('/user/'+req.params.id+'/passwordreset/'+key);

    try {
        let msg_destinations = [user.email];
        if (user.send_copy_to_support) {
            msg_destinations.push(CONFIG.general.support);
        }
        await maisrv.send_notif_mail({
            'name' : 'password_reset_request',
            'destinations': msg_destinations,
            'subject': 'account password reset request'
        }, {
            '#UID#':  user.uid,
            '#LINK#': link
        });
    } catch(error) {
        logger.error(error);
    }

    await dbsrv.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.params.id + ' password reset request', 'logs': []});

    if(notif.mailSet()) {
        res.send({message: 'Password reset requested, check your inbox for instructions to reset your password.'});
    }
    else {
        res.send({message: 'Could not send an email, please contact the support'});
    }
});

router.get('/user/:id/passwordreset/:key', async function(req, res){
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(req.params.key == user.regkey) {
        // reset the password
        //let new_password = Math.random().toString(36).slice(-10);
        let new_password = usrsrv.new_password(10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch(err) {
            res.send({message: 'Error during operation'});
            return;
        }
        user.history.push({'action': 'password reset', date: new Date().getTime()});
        await dbsrv.mongo_users().updateOne({uid: user.uid},{'$set': {history: user.history}});

        // Todo: find if we need another template (or not)
        try {
            let created_file = await filer.user_reset_password(user, fid);
            logger.info('File Created: ', created_file);
        } catch(error){
            logger.error('Reset Password Failed for: ' + user.uid, error);
            res.status(500).send({message: 'Reset Password Failed'});
            return;
        }

        // disable previous link sent
        //let new_key = Math.random().toString(36).substring(7);
        let new_key = usrsrv.new_random(7);
        await dbsrv.mongo_users().updateOne({uid: req.params.id},{'$set': {regkey: new_key}});

        // Now send email
        try {
            let msg_destinations = [user.email];
            if (user.send_copy_to_support) {
                msg_destinations.push(CONFIG.general.support);
            }
            await maisrv.send_notif_mail({
                'name' : 'password_reset',
                'destinations': msg_destinations,
                'subject': 'account password reset'
            }, {
                '#UID#':  user.uid,
                '#PASSWORD#': user.password
            });
        } catch(error) {
            logger.error(error);
        }

        await dbsrv.mongo_events().insertOne({'owner': user.uid,'date': new Date().getTime(), 'action': 'user password ' + req.params.id + ' reset confirmation', 'logs': [user.uid + '.' + fid + '.update']});

        if(notif.mailSet()) {
            res.redirect(GENERAL_CONFIG.url+'/manager2/passwordresetconfirm');
            res.end();
        }
        else {
            res.send({message: 'Could not send an email, please contact the support'});
        }
    }
    else {
        res.status(401).send({message: 'Invalid authorization key.'});
        return;
    }
});


/**
 * Extend validity period if active
 */
router.get('/user/:id/renew/:regkey', async function(req, res){
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(user.status != STATUS_ACTIVE) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let regkey = req.params.regkey;
    if(user.regkey == regkey) {
        user.history.push({'action': 'extend validity period', date: new Date().getTime()});
        let expiration = new Date().getTime() + day_time*duration_list[user.duration];
        await dbsrv.mongo_users().updateOne({uid: user.uid},{'$set': {
            expiration: expiration,
            expiration_notif: 0,
            history: user.history
        }});
        await dbsrv.mongo_events().insertOne({'owner': user.uid,'date': new Date().getTime(), 'action': 'Extend validity period: ' + req.params.id , 'logs': []});
        let accept = req.accepts(['json', 'html']);
        if(accept == 'json') {
            res.send({message: 'validity period extended', expiration: expiration});
            res.end();
            return;
        }
        res.redirect(GENERAL_CONFIG.url+'/manager2/user/' + user.uid + '/renew/' + regkey);
        res.end();
        return;
    }
    else {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
});

// reactivate user
router.get('/user/:id/renew', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    session_user.is_admin = isadmin;

    if(session_user.is_admin){
        //let new_password = Math.random().toString(36).slice(-10);
        let new_password = usrsrv.new_password(10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch(err) {
            res.send({message: 'Error during operation'});
            return;
        }
        user.history.push({'action': 'reactivate', date: new Date().getTime()});
        await dbsrv.mongo_users().updateOne({uid: user.uid},{'$set': {
            status: STATUS_ACTIVE,
            expiration: (new Date().getTime() + day_time*duration_list[user.duration]),
            expiration_notif: 0,
            history: user.history
        }});

        try {
            let created_file = await filer.user_renew_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch(error){
            logger.error('Renew User Failed for: ' + user.uid, error);
            res.status(500).send({message: 'Renew User Failed'});
            return;
        }

        await dbsrv.mongo_events().insertOne({'owner': user.uid,'date': new Date().getTime(), 'action': 'user reactivated by ' + session_user.uid , 'logs': [user.uid + '.' + fid + '.update']});


        try {
            let msg_destinations = [user.email];
            if (user.send_copy_to_support) {
                msg_destinations.push(CONFIG.general.support);
            }
            await maisrv.send_notif_mail({
                'name' : 'reactivation',
                'destinations': msg_destinations,
                'subject': 'account reactivation'
            }, {
                '#UID#':  user.uid,
                '#PASSWORD#': user.password,
                '#IP#': user.ip
            });
        } catch(error) {
            logger.error(error);
        }

        let error = false;
        try {
            error = await plgsrv.run_plugins('activate', user.uid, user, session_user.uid);
        } catch(err) {
            logger.error('activation errors', err);
            error = true;
        }

        if(!user.is_fake) {
            try {
                await notif.add(user.email);
            } catch (err) {
                logger.error('[notif][error=add][mail=' + user.email + ']');
            }
        }

        if(error) {
            res.send({message: 'Activation Error', fid: fid, error: []});
            res.end();
        } else {
            res.send({message: 'Activation in progress', fid: fid, error: []});
            res.end();
        }
        return;
    }
    else {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
});


router.put('/user/:id/ssh', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    session_user.is_admin = isadmin;

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    // If not admin nor logged user
    if(!session_user.is_admin && user._id.str != req.locals.logInfo.id.str) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let key = req.body.ssh;
    if(!key) {
        res.status(403).send({message: 'Invalid SSH Key'});
        return;
    }
    // Remove carriage returns if any
    // Escape some special chars for security
    user.ssh = key.replace(/[\n\r]+/g, '').replace(/(["'$`\\])/g,'\\$1');
    if (sansrv.sanitizeSSHKey(user.ssh) === undefined) {
        res.status(403).send({message: 'Invalid SSH Key'});
        return;
    }
    if (sansrv.sanitizePath(user.home) === undefined) {
        res.status(403).send({message: 'Invalid home directory'});
        return;
    }
    // Update SSH Key
    await dbsrv.mongo_users().updateOne({_id: user._id}, {'$set': {ssh: key}});
    let fid = new Date().getTime();
    // user.ssh = escapeshellarg(req.body.ssh);
    try {
        let created_file = await filer.user_add_ssh_key(user, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Add Ssh Key Failed for: ' + user.uid, error);
        res.status(500).send({message: 'Ssh Key Failed'});
        return;
    }

    await dbsrv.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'SSH key update: ' + req.params.id , 'logs': [ user.uid + '.' + fid + '.update']});

    user.fid = fid;
    res.send(user);
    res.end();
    return;
});


router.get('/user/:id/usage', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let usage = JSON.parse(JSON.stringify(CONFIG.usage));
    let usages = [];
    for(let i=0;i<usage.length;i++){
        usage[i]['link'] = usage[i]['link'].replace('#USER#', req.params.id);
        usages.push(usage[i]);
    }
    res.send({usages: usages});
    res.end();
    return;
});

// Update user info
router.put('/user/:id', async function(req, res) {

    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});

    if(!user){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    // If not admin nor logged user
    if(!session_user.is_admin && user._id.str != req.locals.logInfo.id.str) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    if(req.body.firstname) {
        user.firstname = req.body.firstname;
    }
    if(req.body.lastname) {
        user.lastname = req.body.lastname;
    }
    if(req.body.email) {
        user.oldemail = user.email;
        user.email = req.body.email;
    } else {
        user.oldemail = user.email;
    }
    if(user.is_fake === undefined) {
        user.is_fake = false;
    }
    let userWasFake = user.is_fake;

    if(session_user.is_admin){
        if (req.body.is_fake !== undefined) {
            user.is_fake = req.body.is_fake;
        }
        if (req.body.never_expire !== undefined) {
            user.never_expire = req.body.never_expire;
        }
        if(req.body.is_trainer !== undefined ){
            user.is_trainer = req.body.is_trainer;
        }
        if(req.body.send_copy_to_support !== undefined ){
            user.send_copy_to_support = req.body.send_copy_to_support;
        }
    }

    if(user.email == '' || user.firstname == '' || user.lastname == '') {
        if(! user.is_fake) {
            res.status(403).send({message: 'Some mandatory fields are empty'});
            return;
        }
    }
    if (req.body.loginShell) {
        user.loginShell = req.body.loginShell.trim();
    }
    if(req.body.address) {
        user.address = req.body.address;
    }
    if(req.body.lab) {
        user.lab = req.body.lab;
    }
    if(req.body.responsible) {
        user.responsible = req.body.responsible;
    }
    if(req.body.why) {
        user.why = req.body.why;
    }
    if(req.body.duration) {
        if (!(req.body.duration in duration_list))
        {
            res.status(403).send({message: 'Duration is not valid'});
            return;
        }
        // update expiration if duration have changed
        if (user.duration != req.body.duration) {
            user.expiration = new Date().getTime() + day_time*duration_list[req.body.duration];
        }

        user.duration = req.body.duration;


    }
    if(req.body.team) {
        user.team = req.body.team;
    }
    if(req.body.extra_info) {
        user.extra_info = req.body.extra_info;
    }

    user.history.push({'action': 'update info', date: new Date().getTime()});

    user.oldgroup = user.group;
    user.oldgidnumber = user.gidnumber;
    user.oldmaingroup = user.maingroup;
    user.oldhome = user.home;
    // user.group = '';
    // user.gidnumber = -1;
    if(session_user.is_admin){
        user.group = '';
        user.gidnumber = -1;
        if ( !CONFIG.general.disable_user_group) {
            let group = await dbsrv.mongo_groups().findOne({'name': req.body.group});

            if(!group) {
                res.status(403).send({message: 'Group ' + req.body.group + ' does not exist, please create it first'});
                return;
            }

            if(user.secondarygroups.indexOf(group.name) != -1) {
                res.status(403).send({message: 'Group ' + req.body.group + ' is already a secondary group, please remove user from secondary group first!'});
                return;
            }
            user.group = req.body.group;
            user.gidnumber = group.gid;
            if(user.group == '' || user.group == null) {
                res.status(403).send({message: 'Some mandatory fields are empty'});
                return;
            }
        }

        user.ip = req.body.ip;
        if (req.body.is_internal !== undefined) {
            user.is_internal = req.body.is_internal;
        }
        if (req.body.maingroup) {
            user.maingroup = req.body.maingroup;
        }
        user.home = usrsrv.get_user_home(user);

    }

    try {
        await plgsrv.run_plugins('update', user.uid, user, session_user.uid);
    } catch(err) {
        logger.error('update errors', err);
    }

    let is_admin = false;
    if(session_user.is_admin) {
        is_admin = true;
    }
    let admin_update_expired = false;
    if(user.status == STATUS_EXPIRED && is_admin) {
        admin_update_expired = true;
    }
    if(user.status == STATUS_ACTIVE || admin_update_expired){
        await dbsrv.mongo_users().replaceOne({_id: user._id}, user);
        if(is_admin) {
            user.is_admin = true;
        }
        let fid = new Date().getTime();
        try {
            await goldap.modify(user, fid);
        } catch(err) {
            res.status(403).send({message: 'User update failed'});
            return;
        }

        try {
            let created_file = await filer.user_modify_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch(error){
            logger.error('Modify User Failed for: ' + user.uid, error);

        }

        if(is_admin && CONFIG.general.use_group_in_path) {
            if(user.oldgroup != user.group || user.oldmaingroup != user.maingroup) {
                // If group modification, change home location
                await dbsrv.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'change group from ' + user.oldmaingroup + '/' + user.oldgroup + ' to ' + user.maingroup + '/' + user.group , 'logs': []});
            }
        }

        await dbsrv.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'User info modification: ' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']});
        let users_in_group = await dbsrv.mongo_users().find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}).toArray();
        if(users_in_group && users_in_group.length == 0){
            let oldgroup = await dbsrv.mongo_groups().findOne({name: user.oldgroup});
            if(oldgroup){
                grpsrv.delete_group(oldgroup, session_user.uid);
            }
        }

        user.fid = fid;
        // Change mail registration only when user is active
        // as expired users are removed from mailing list
        if(user.status == STATUS_ACTIVE) {
            if(user.oldemail!=user.email && !user.is_fake) {
                await notif.modify(user.oldemail, user.email);
            } else if(userWasFake && !user.is_fake) {
                await notif.add(user.email);
            }else if (!userWasFake && user.is_fake) {
                await notif.remove(user.email);
            }
        }
        res.send(user);
    }
    else {
        await dbsrv.mongo_users().replaceOne({_id: user._id}, user);
        await dbsrv.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'Update user info ' + req.params.id , 'logs': []});
        let users_in_group = await dbsrv.mongo_users().find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}).toArray();
        if(users_in_group && users_in_group.length == 0){
            let oldgroup = await dbsrv.mongo_groups().findOne({name: user.oldgroup});
            if(oldgroup){
                await grpsrv.delete_group(oldgroup, session_user.uid);
            }
        }
        user.fid = null;
        res.send(user);
    }
});



router.post('/user/:id/project/:project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id, req.params.project])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let newproject = req.params.project;
    let uid = req.params.id;

    let session_user = null;
    let isadmin = false;
    let project = null;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
        project = await dbsrv.mongo_projects().findOne({id:newproject});
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user) {
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!project) {
        res.status(404).send({message: 'Project not found'});
        res.end();
        return;
    }

    if(!isadmin && session_user.uid != project.owner ) {
        res.status(401).send({message: 'Not authorized'});
        res.end();
        return;
    }

    try {
        await usrsrv.add_user_to_project(newproject, uid, session_user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }

    res.send({message: 'User added to project'});
    res.end();

});

router.delete('/user/:id/project/:project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id, req.params.project])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let oldproject = req.params.project;
    let uid = req.params.id;
    let force = (req.query.force) ? true : false;

    let session_user = null;
    let isadmin = false;
    let project = null;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
        project = await dbsrv.mongo_projects().findOne({id:oldproject});
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user) {
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!project) {
        res.status(404).send({message: 'Project not found'});
        res.end();
        return;
    }

    if(!isadmin && session_user.uid != project.owner && session_user.uid != uid) {
        res.status(401).send({message: 'Not authorized'});
        res.end();
        return;
    }

    try {
        await usrsrv.remove_user_from_project(oldproject, uid, session_user.uid, force);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }

    res.send({message: 'User removed from project'});
    res.end();
});

router.get('/list/:list', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.list])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user || !isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let list_name = req.params.list;
    let members = await notif.getMembers(list_name);
    res.send(members);
    res.end();
});


router.get('/lists', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user || !isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let listOfLists = await notif.getLists();
    res.send(listOfLists);
    res.end();
});

module.exports = router;
