/* eslint-disable require-atomic-updates */
/*jslint es6 */
var express = require('express');
var router = express.Router();
// var cookieParser = require('cookie-parser');
// var session = require('express-session');
var goldap = require('../routes/goldap.js');
// var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const u2f = require('u2f');
var jwt = require('jsonwebtoken');

var CONFIG = require('config');
const APP_ID= CONFIG.general.url;
var GENERAL_CONFIG = CONFIG.general;

const MAILER = CONFIG.general.mailer;

var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
// eslint-disable-next-line no-unused-vars
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';


var notif = require('../routes/notif_'+MAILER+'.js');

var utils = require('./utils');

var attemps = {};

let bansec = 3600;

if(CONFIG.general.bansec) {
    bansec = CONFIG.general.bansec;
}

router.get('/logout', function(req, res) {
    req.session.destroy();
    res.send({});
    //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});

router.get('/mail/auth/:id', async function(req, res) {
    // Request email token
    if(!req.locals.logInfo.is_logged){
        return res.status(401).send({message: 'You need to login first'});
    }

    if(! notif.mailSet()){
        return res.status(403).send({message: 'No mail provider set : cannot send mail'});
    }
    let password = Math.random().toString(36).slice(-10);
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        return res.status(404).send({message: 'User not found'});
    }

    let expire = new Date().getTime() + 60*10*1000;
    req.session.mail_token = {'token': password, 'expire': expire, 'user': user._id};
    let mail_token = {'token': password, 'expire': expire, 'user': user._id};
    let usertoken = jwt.sign(
        { user: user._id, isLogged: true, mail_token: mail_token },
        CONFIG.general.secret,
        {expiresIn: '2 days'}
    );

    try {
        await utils.send_notif_mail({
            'name': 'mail_token',
            'destinations': [user.email],
            'subject': 'Authentication mail token request'
        }, {
            '#TOKEN#': password
        });
    } catch(err) {
        logger.error('failed to send notif', err);
        return res.send({status: false});
    }
    res.send({status: true, token: usertoken});
});


router.post('/mail/auth/:id', async function(req, res) {
    // Check email token
    if(!req.locals.logInfo.is_logged){
        return res.status(401).send({message: 'You need to login first'});
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        return res.status(404).send({message: 'User not found'});
    }
    let usertoken = jwt.sign(
        { user: user._id, isLogged: true },
        CONFIG.general.secret,
        {expiresIn: '2 days'}
    );
    let sess = req.session;
    let now = new Date().getTime();
    if(!req.locals.logInfo.mail_token || user._id != req.locals.logInfo.mail_token['user'] || req.body.token != req.locals.logInfo.mail_token['token'] || now > sess.mail_token['expire']) {
        return res.status(403).send({message: 'Invalid or expired token'});
    }
    sess.gomngr = sess.mail_token['user'];
    sess.mail_token = null;

    if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
        user.is_admin = true;
    }
    else {
        user.is_admin = false;
    }
    res.send({user: user, token: usertoken});
    res.end();
    return;
});

router.get('/u2f/auth/:id', async function(req, res) {
    // challenge
    if(!req.locals.logInfo.is_logged){
        return res.status(401).send({message: 'You need to login first'});
    }
    req.session.u2f = null;
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let keyHandle = user.u2f.keyHandler;
    const authRequest = u2f.request(APP_ID, keyHandle);
    req.session.u2f = user._id;
    return res.send({authRequest: authRequest});

});

router.post('/u2f/auth/:id', async function(req, res) {
    if(!req.locals.logInfo.is_logged){
        return res.status(401).send({message: 'You need to login first'});
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!req.locals.logInfo.u2f || req.locals.logInfo.u2f != user._id){
        res.status(401).send({message: 'U2F not challenged or invalid user'});
    }
    let publicKey = user.u2f.publicKey;
    const result = u2f.checkSignature(req.body.authRequest, req.body.authResponse, publicKey);

    let sess = req.session;
    if (result.successful) {
        // Success!
        // User is authenticated.
        let usertoken = jwt.sign(
            { user: user._id, isLogged: true },
            CONFIG.general.secret,
            {expiresIn: '2 days'}
        );
        sess.gomngr = sess.u2f;
        sess.u2f = null;
        return res.send({token: usertoken, user: user});
    }
    else {
        sess.gomngr = null;
        sess.u2f = null;
        return res.send(result);
    }
});

router.get('/u2f/register/:id', async function(req, res) {
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!req.locals.logInfo.id || req.locals.logInfo.id.str!=user._id.str) {
        return res.status(401).send({message: 'You need to login first'});
    }
    if(user.u2f !== undefined && user.u2f.keyHandle!=null){
        res.status(403).send({message: 'A key is already defined'});
    }
    const registrationRequest = u2f.request(APP_ID);
    return res.send({registrationRequest: registrationRequest});
});

router.post('/u2f/register/:id', async function(req, res) {
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user || !req.locals.logInfo.id || req.locals.logInfo.id.str!=user._id.str) {
        return res.status(401).send({message: 'You need to login first'});
    }
    const registrationRequest = req.body.registrationRequest;
    const registrationResponse = req.bodyregistrationResponse;
    const result = u2f.checkRegistration(registrationRequest, registrationResponse);
    if (result.successful) {
        await utils.mongo_users().updateOne({uid: req.params.id},{'$set': {'u2f.keyHandler': result.keyHandle, 'u2f.publicKey': result.publicKey}});
        return res.send({publicKey: result.publicKey});
    }
    else{
        return res.send(result);
    }
});

router.get('/auth', async function(req, res) {
    if(req.locals.logInfo.id) {
        let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
        if(!user) {
            res.send({user: null, message: 'user not found'});
            return;
        }
        let token = jwt.sign(
            { user: user._id, isLogged: true },
            CONFIG.general.secret,
            {expiresIn: '2 days'}
        );
        if(user.u2f) {user.u2f.keyHankdle = null;}

        if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
            user.is_admin = true;
        }
        else {
            user.is_admin = false;
        }
        if(user.status == STATUS_PENDING_EMAIL){
            res.send({token: token, user: user, message: 'Your account is waiting for email approval, check your mail inbox'});
            return;
        }
        if(user.status == STATUS_PENDING_APPROVAL){
            res.send({token: token, user: user, message: 'Your account is waiting for admin approval'});
            return;
        }
        if(user.status == STATUS_EXPIRED){
            res.send({token: token, user: user, message: 'Your account is expired, please contact the support for reactivation at '+GENERAL_CONFIG.support});
            return;
        }
        res.send({token: token, user: user, message: ''});
    }
    else {
        res.send({user: null, message: 'User does not exist'});
    }
});

router.post('/auth/:id', async function(req, res) {
    let apikey = req.headers['x-my-apikey'] || '';
    if(apikey === ''){
        if(req.body.password === undefined || req.body.password === null || req.body.password == '') {
            res.status(401).send({message: 'Missing password'});
            return;
        }
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(! user) {
        res.status(404).send({message: 'User not found'});
        return;
    }
    let usertoken = jwt.sign(
        { user: user._id, isLogged: true, u2f: user._id },
        CONFIG.general.secret,
        {expiresIn: '2 days'}
    );
    let sess = req.session;
    if (apikey !== '' && apikey === user.apikey) {
        user.is_admin = false;
        if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
            user.is_admin = true;
        }
        sess.gomngr = user._id;
        sess.apikey = true;
        res.send({token: usertoken, user: user, message: '', double_auth: false});
        res.end();
        return;
    }
    if(attemps[user.uid] != undefined && attemps[user.uid]['attemps']>=2) {
        let diffTime = (new Date()).getTime() - attemps[user.uid]['last'].getTime();
        if(diffTime < 1000 * bansec) {
            res.status(401).send({message: 'You have reached the maximum of login attemps, your account access is blocked for ' + Math.floor((1000 * bansec - diffTime)/ 60000) + ' minutes'});
            return;
        }
        else {
            attemps[user.uid]['attemps'] = 0;
        }
    }
    // Check bind with ldap
    sess.is_logged = true;
    let need_double_auth = false;

    if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
        user.is_admin = true;
        if(CONFIG.general.double_authentication_for_admin){
            need_double_auth = true;
        }
        else {
            sess.gomngr = user._id;
        }
    }
    else {
        user.is_admin = false;
        sess.gomngr = user._id;
    }

    if(need_double_auth) {
        usertoken = jwt.sign(
            { isLogged: true, u2f: user._id },
            CONFIG.general.secret,
            {expiresIn: '2 days'}
        );
    }

    let ip = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
    if((user.is_admin && GENERAL_CONFIG.admin_ip.indexOf(ip) >= 0) || process.env.gomngr_auth=='fake') {
        // Skip auth
        res.send({token: usertoken, user: user, message: '', double_auth: need_double_auth});
        res.end();
        return;
    }
    else {
        if(attemps[user.uid] == undefined) {
            attemps[user.uid] = { attemps: 0};
        }
        try {
            let token = await goldap.bind(user.uid, req.body.password);
            user['token'] = token;
            attemps[user.uid]['attemps'] = 0;
            if (!user.apikey) {
                let apikey = Math.random().toString(36).slice(-10);
                user.apikey = apikey;
                await utils.mongo_users().updateOne({uid: user.uid}, {'$set':{'apikey': apikey}});
                res.send({token: usertoken, user: user, message: '', double_auth: need_double_auth});
                res.end();
                return;

            } else {
                res.send({token: usertoken, user: user, message: '', double_auth: need_double_auth});
                res.end();
                return;
            }

        } catch(err) {
            if(req.session !== undefined){
                req.session.destroy();
            }
            attemps[user.uid]['attemps'] += 1;
            attemps[user.uid]['last'] = new Date();
            res.send({user: null, message: 'Login error, remains ' + (3-attemps[user.uid]['attemps']) + ' attemps.'});
            res.end();
            return;
        }
    }
});


module.exports = router;
