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
const notif = require('../core/notif_' + MAILER + '.js');

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
const idsrv = require('../core/id.service.js');

router.get('/user/:id/apikey', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (session_user.uid !== req.params.id && !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }

    if (user.apikey === undefined) {
        return res.send({ apikey: '' });
    } else {
        return res.send({ apikey: user.apikey });
    }
});

router.post('/user/:id/notify', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (
        !req.body.message || req.body.message.trim() === '' ||
        !req.body.subject || req.body.subject.trim() === '' ||
        !user.email || user.email.trim() === ''
    ) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let msg_destinations = [user.email];
    if (user.send_copy_to_support) {
        msg_destinations.push(CONFIG.general.support);
    }
    try {
        await maisrv.send_notif_mail(
            {
                name: null,
                destinations: msg_destinations,
                subject: req.body.subject,
                markdown: req.body.message,
            },
            {}
        );
    } catch (error) {
        logger.error(error);
        return res.status(500).send({ message: 'message error', error: error });
    }
    await dbsrv.mongo_events().insertOne({
        owner: user.uid,
        date: new Date().getTime(),
        action: 'message: ' + req.body.subject,
        logs: []
    });

    return res.send({ message: 'message sent' });
});

router.post('/user/:id/apikey', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (session_user.uid !== req.params.id && !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }

    //let apikey = Math.random().toString(36).slice(-10);
    let apikey = usrsrv.new_random(10);
    await dbsrv.mongo_users().updateOne({ uid: req.params.id }, { $set: { apikey: apikey } });
    return res.send({ apikey: apikey });
});

router.put('/user/:id/subscribe', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    // if not user nor admin
    if (session_user.uid !== req.params.id && !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (user.email == undefined || user.email == '' || user.is_fake) {
        return res.send({ subscribed: false });
    } else {
        await notif.add(user.email, user.uid);
        return res.send({ subscribed: true });
    }
});

router.put('/user/:id/unsubscribe', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    // if not user nor admin
    if (session_user.uid !== req.params.id && !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (user.email == undefined || user.email == '' || user.is_fake) {
        return res.send({ unsubscribed: false });
    } else {
        await notif.remove(user.email);
        return res.send({ unsubscribed: true });
    }
});

router.get('/user/:id/subscribed', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (user.email == undefined || user.email == '' || user.is_fake) {
        return res.send({ subscribed: false });
    } else {
        let is_subscribed = await notif.subscribed(user.email);
        return res.send({ subscribed: is_subscribed });
    }
});

router.get('/ip', function (req, res) {
    let ip =
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    return res.json({ ip: ip });
});

router.post('/message', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    if (!notif.mailSet()) {
        return res.status(403).send({ message: 'Mail provider is not set' });
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let message = req.body.message;
    let html_message = req.body.message;

    if (req.body.input === 'Markdown') {
        html_message = markdown.toHTML(req.body.message);
        message = htmlToText.fromString(html_message);
    } else if (req.body.input === 'HTML') {
        message = htmlToText.fromString(html_message);
    }
    let mailOptions = {
        //origin: MAIL_CONFIG.origin,
        origin: req.body.from,
        subject: req.body.subject,
        message: message,
        html_message: html_message
    };
    await notif.sendList(req.body.list, mailOptions);
    return res.send({ message: '' });
});

// Get users listing - for admin
router.get('/user', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let users;

    if (req.query.short === 'true') {
        users = await dbsrv
            .mongo_users()
            .find({})
            .project({ history: 0 })
            .toArray();
    } else {
        users = await dbsrv.mongo_users().find({}).toArray();
    }
    return res.json(users);
});

router.post('/user/:id/group/:group', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id, req.params.group])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(401).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let uid = req.params.id;
    let secgroup = req.params.group;

    try {
        await usrsrv.add_user_to_group(uid, secgroup, session_user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }

    return res.send({ message: 'User added to group' });
});

router.delete('/user/:id/group/:group', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id, req.params.group])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user || !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let uid = req.params.id;
    let secgroup = req.params.group;

    try {
        await usrsrv.remove_user_from_group(uid, secgroup, session_user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }

    return res.send({ message: 'User removed from Group' });
});

router.delete('/user/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user || !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
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

    let user = await dbsrv.mongo_users().findOne({ uid: uid });
    if (!user) {
        return res.status(404).send({ message: 'User not found ' + uid });
    }
    if (user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL) {
        usrsrv.delete_user(user, session_user.uid, mail_message, mail_send).then(function () {
            return res.send({ message: 'User deleted' });
        });
    } else {
        // Must check if user has databases and sites
        // Do not remove in this case, owners must be changed before
        let databases = await dbsrv.mongo_databases().find({ owner: uid }).toArray();
        if (databases && databases.length > 0) {
            return res.status(403).send({ message: 'User owns some databases, please change owner first!' });
        }
        let websites = await dbsrv.mongo_web().find({ owner: uid }).toArray();
        if (websites && websites.length > 0) {
            return res.status(403).send({ message: 'User owns some web sites, please change owner first!' });
        }
        let projects = await dbsrv.mongo_projects().find({ owner: uid }).toArray();
        if (projects && projects.length > 0) {
            return res.status(403).send({ message: 'User owns some projects, please change owner first!' });
        }
        const allprojects = user.projects ? user.projects : [];
        let empty_projects = [];
        for (let project_name of allprojects) {
            const users_in_project = await dbsrv.mongo_users().find({ projects: project_name }).count();
            if (users_in_project <= 1) {
                empty_projects.push(project_name);
            }
        }
        if (empty_projects.length) {
            empty_projects = empty_projects.join(', ');
            return res.status(403).send({ message: 'User is the last member of project(s) ${empty_projects}' });
        }
        usrsrv.delete_user(user, session_user.uid, mail_message, mail_send).then(function () {
            return res.send({ message: 'User deleted' });
        });
    }
});

// activate user
router.get('/user/:id/activate', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(403).send({ message: 'User does not exist' });
    }
    if (user.maingroup == undefined || user.group == undefined) {
        return res.status(403).send({ message: 'Group or main group directory are not set' });
    }

    try {
        user = await usrsrv.activate_user(user, session_user.uid);
    } catch (error) {
        logger.error(error);
        return res.status(error.code).send({ message: error.message });
    }

    try {
        let msg_destinations = [user.email];
        if (user.send_copy_to_support) {
            msg_destinations.push(CONFIG.general.support);
        }

        await maisrv.send_notif_mail(
            {
                name: 'activation',
                destinations: msg_destinations,
                subject: 'account activation'
            },
            {
                '#UID#': user.uid,
                '#PASSWORD#': user.password,
                '#IP#': user.ip
            }
        );
    } catch (error) {
        logger.error(error);
    }

    let error = false;
    try {
        error = await plgsrv.run_plugins('activate', user.uid, user, session_user.uid);
    } catch (err) {
        logger.error('activation errors', err);
        error = true;
    }

    if (!user.is_fake) {
        try {
            await notif.add(user.email, user.uid);
        } catch (err) {
            logger.error('[notif][error=add][mail=' + user.email + ']');
        }
    }

    if (error) {
        return res.status(500).send({ message: 'Activation error', error: [] });
    } else {
        return res.send({ message: 'Activation in progress', error: [] });
    }
});

// Get user - for logged user or admin
router.get('/user/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized, need to login first' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(401).send({ message: 'Not authorized, need to login first' });
    }

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (user.is_fake === undefined) {
        user.is_fake = false;
    }
    if (user.never_expire === undefined) {
        user.never_expire = false;
    }

    user.quota = [];
    for (let k in GENERAL_CONFIG.quota) {
        user.quota.push(k);
    }

    user.is_locked = await idsrv.user_locked(user.uid);

    if (session_user._id.toString() == user._id.toString() || isadmin) {
        return res.send(user);
    } else {
        return res.status(401).send({ message: 'Not authorized to access this user info' });
    }
});

// Registration mail confirmation
router.get('/user/:id/confirm', async function (req, res) {
    let uid = req.params.id;
    let regkey = req.query.regkey;
    if (!sansrv.sanitizeAll([uid])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: uid });
    if (!user) {
        return res.status(401).send({ message: 'Invalid user' });
    } else {
        if (user.regkey == regkey) {
            //if (user.status == STATUS_PENDING_APPROVAL) {
            if (user.status != STATUS_PENDING_EMAIL) {
                // Already pending or active
                return res.redirect(GENERAL_CONFIG.url + '/manager2/pending');
            }
            let account_event = { action: 'email_confirm', date: new Date().getTime() };
            await dbsrv.mongo_users().updateOne(
                { _id: user._id },
                {
                    $set: { status: STATUS_PENDING_APPROVAL },
                    $push: { history: account_event }
                }
            );

            let link = GENERAL_CONFIG.url + encodeURI('/manager2/user/' + user.uid);
            try {
                await maisrv.send_notif_mail(
                    {
                        name: 'registration',
                        destinations: [GENERAL_CONFIG.accounts],
                        subject: 'account registration: ' + uid
                    },
                    {
                        '#UID#': user.uid,
                        '#LINK#': link
                    }
                );
            } catch (error) {
                logger.error(error);
            }

            await dbsrv.mongo_events().insertOne({
                owner: user.uid,
                date: new Date().getTime(),
                action: 'user confirmed email:' + req.params.id,
                logs: []
            });
            return res.redirect(GENERAL_CONFIG.url + '/manager2/pending');
        } else {
            return res.status(401).send({ message: 'Invalid registration key' });
        }
    }
});

// Register
router.post('/user/:id', async function (req, res) {
    logger.info('New register request for ' + req.params.id);
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    if (req.body.firstname == '' || req.body.firstname === null || req.body.firstname === undefined) {
        return res.send({ status: 1, message: 'Missing field: firstname' });
    }
    if (req.body.lastname == '' || req.body.lastname === null || req.body.lastname === undefined) {
        return res.send({ status: 1, message: 'Missing field: lastname' });
    }
    if (req.body.team == '' || req.body.team === null || req.body.team === undefined) {
        return res.send({ status: 1, message: 'Missing field: team' });
    }
    if (!req.body.team.match(/^[0-9a-z_]+$/)) {
        return res.send({ status: 1, message: 'Team name must be alphanumeric and lowercase [0-9a-z_]' });
    }
    if (req.body.lab == '' || req.body.lab === null || req.body.lab === undefined) {
        return res.send({ status: 1, message: 'Missing field: lab' });
    }
    if (req.body.address == '' || req.body.address === null || req.body.address === undefined) {
        return res.send({ status: 1, message: 'Missing field: address' });
    }
    if (req.body.responsible == '' || req.body.responsible === null || req.body.responsible === undefined) {
        return res.send({ status: 1, message: 'Missing field: Responsible/Manager' });
    }
    if (!req.params.id.match(/^[0-9a-z]+$/)) {
        return res.send({ status: 1, message: 'invalid data identifier, numeric and lowercase letters only' });
    }
    let usermaxlen = 12;
    if (CONFIG.general.username_max_length) {
        usermaxlen = CONFIG.general.username_max_length;
    }
    if (req.params.id.length > usermaxlen) {
        return res.send({ status: 1, message: 'user id too long, must be < ' + usermaxlen + ' characters' });
    }
    if (req.body.why == '' || req.body.why === null || req.body.why === undefined) {
        return res.send({ status: 1, message: 'Missing field: Why do you need an account' });
    }
    if (!validator.validate(req.body.email)) {
        return res.send({ status: 1, message: 'Invalid email format' });
    }
    if (!req.body.is_fake) {
        let user_email = await dbsrv.mongo_users().findOne({ email: req.body.email, is_fake: false });
        if (user_email) {
            return res.send({ status: 1, message: 'User email already exists' });
        }
    }
    if (!(req.body.duration in duration_list)) {
        return res.send({ status: 1, message: 'Invalid duration format' });
    }

    let userexists = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (userexists) {
        return res.send({ status: 1, message: 'User id already exists' });
    }

    let uidMd5 = crypto.createHash('md5').update(req.params.id).digest('hex');
    let userexisted = await dbsrv.mongo_oldusers().findOne({ uid: uidMd5 });
    if (userexisted && (CONFIG.general.prevent_reuse === undefined || CONFIG.general.prevent_reuse)) {
        logger.error(`User uid ${req.params.id} already used in the past, preventing reuse`);
        return res.send({ status: 1, message: 'User id already used' });
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
        history: [{ action: 'register', date: new Date().getTime() }],
        extra_info: req.body.extra_info || [],
        registration: new Date().getTime()
    };

    // check if register user is done by admin or by anonymouse user
    let action_owner = user.uid;
    if (req.locals.logInfo) {
        try {
            let session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
            if (session_user) {
                action_owner = session_user.uid;
            }
        } catch (e) {
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
        await maisrv.send_notif_mail(
            {
                name: 'confirmation',
                destinations: msg_destinations,
                subject: 'account confirmation'
            },
            {
                '#UID#': user.uid,
                '#LINK#': link
            }
        );
    } catch (error) {
        logger.error(error);
    }
    return res.send({ status: 0, message: 'Could not send an email, please contact the support.' });
});

router.get('/user/:id/expire', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let sendmail = req.query.sendmail === 'false' ? false : true;

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(404).send({ message: 'User not found' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    session_user.is_admin = isadmin;

    if (session_user.is_admin) {
        //let new_password = Math.random().toString(36).slice(-10);
        let new_password = usrsrv.new_password(10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch (err) {
            return res.status(500).send({ message: 'Error during operation' });
        }
        user.history.push({ action: 'expire', date: new Date().getTime() });
        // eslint-disable-next-line no-unused-vars
        await dbsrv
            .mongo_users()
            .updateOne(
                { uid: user.uid },
                {
                    $set: {
                        status: STATUS_EXPIRED,
                        expiration: new Date().getTime(),
                        history: user.history,
                        expiration_notif: 0
                    }
                }
            );

        try {
            let created_file = await filer.user_expire_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch (error) {
            logger.error('Expire User Failed for: ' + user.uid, error);
            return res.status(500).send({ message: 'Expire User Failed' });
        }

        await dbsrv.mongo_events().insertOne({
            owner: user.uid,
            date: new Date().getTime(),
            action: 'user expired by ' + session_user.uid,
            logs: [user.uid + '.' + fid + '.update']
        });

        // Now remove from mailing list
        try {
            // eslint-disable-next-line no-unused-vars
            await notif.remove(user.email, sendmail);
            await plgsrv.run_plugins('deactivate', user.uid, user, session_user.uid);
            return res.send({ message: 'Operation in progress', fid: fid, error: [] });
        } catch (error) {
            return res.send({ message: 'Operation in progress, user not in mailing list', fid: fid, error: error });
        }
    } else {
        return res.status(401).send({ message: 'Not authorized' });
    }
});

router.post('/user/:id/passwordreset', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user || (session_user.uid != req.params.id && !isadmin)) {
        return res.status(403).send({ message: 'Not authorized' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist:' + req.params.id });
    }
    if (user.status != STATUS_ACTIVE) {
        return res.status(401).send({ message: 'Your account is not active' });
    }

    user.password = req.body.password;
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.*\s).{12,}$/;
    if (!passwordRegex.test(user.password)) {
        return res.status(400).send({
            message: 'Password does not meet the required format: 12 characters min, including 1 digit, 1 lowercase, 1 uppercase, and 1 special character, and no spaces.'
        });
    }

    await dbsrv.mongo_events().insertOne({
        owner: session_user.uid,
        date: new Date().getTime(),
        action: 'user ' + req.params.id + ' password update request',
        logs: []
    });
    let fid = new Date().getTime();
    try {
        await goldap.reset_password(user, fid);
    } catch (err) {
        return res.status(500).send({ message: 'Error during operation' });
    }

    try {
        let created_file = await filer.user_reset_password(user, fid);
        logger.info('File Created: ', created_file);
    } catch (error) {
        logger.error('Reset Password Failed for: ' + user.uid, error);
        return res.status(500).send({ message: 'Reset Password Failed' });
    }

    return res.send({ message: 'Password updated' });
});

//app.get('/user/:id/passwordreset', users);
router.get('/user/:id/passwordreset', async function (req, res) {
    //let key = Math.random().toString(36).substring(7);
    let key = usrsrv.new_random(7);
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (user.status != STATUS_ACTIVE) {
        return res.status(401).send({ message: 'Your account is not active' });
    }

    if (user.is_fake) {
        return res.status(403).send({ message: 'Password reset not allowed for fake accounts' });
    }

    try {
        await dbsrv.mongo_users().updateOne({ uid: req.params.id }, { $set: { regkey: key } });
    } catch (err) {
        return res.status(404).send({ message: 'User cannot be updated' });
    }

    user.password = '';
    // Now send email
    let link = CONFIG.general.url + encodeURI('/user/' + req.params.id + '/passwordreset/' + key);

    try {
        let msg_destinations = [user.email];
        if (user.send_copy_to_support) {
            msg_destinations.push(CONFIG.general.support);
        }
        await maisrv.send_notif_mail(
            {
                name: 'password_reset_request',
                destinations: msg_destinations,
                subject: 'account password reset request'
            },
            {
                '#UID#': user.uid,
                '#LINK#': link
            }
        );
    } catch (error) {
        logger.error(error);
    }

    await dbsrv.mongo_events().insertOne({
        owner: user.uid,
        date: new Date().getTime(),
        action: 'user ' + req.params.id + ' password reset request',
        logs: []
    });

    if (notif.mailSet()) {
        return res.send({ message: 'Password reset requested, check your inbox for instructions to reset your password.' });
    } else {
        return res.send({ message: 'Could not send an email, please contact the support' });
    }
});

router.get('/user/:id/passwordreset/:key', async function (req, res) {
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (req.params.key == user.regkey) {
        // reset the password
        //let new_password = Math.random().toString(36).slice(-10);
        let new_password = usrsrv.new_password(10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch (err) {
            return res.status(500).send({ message: 'Error during operation' });
        }
        user.history.push({ action: 'password reset', date: new Date().getTime() });
        await dbsrv.mongo_users().updateOne({ uid: user.uid }, { $set: { history: user.history } });

        // Todo: find if we need another template (or not)
        try {
            let created_file = await filer.user_reset_password(user, fid);
            logger.info('File Created: ', created_file);
        } catch (error) {
            logger.error('Reset Password Failed for: ' + user.uid, error);
            return res.status(500).send({ message: 'Reset Password Failed' });
        }

        // disable previous link sent
        //let new_key = Math.random().toString(36).substring(7);
        let new_key = usrsrv.new_random(7);
        await dbsrv.mongo_users().updateOne({ uid: req.params.id }, { $set: { regkey: new_key } });

        // Now send email
        try {
            let msg_destinations = [user.email];
            if (user.send_copy_to_support) {
                msg_destinations.push(CONFIG.general.support);
            }
            await maisrv.send_notif_mail(
                {
                    name: 'password_reset',
                    destinations: msg_destinations,
                    subject: 'account password reset'
                },
                {
                    '#UID#': user.uid,
                    '#PASSWORD#': user.password
                }
            );
        } catch (error) {
            logger.error(error);
        }

        await dbsrv.mongo_events().insertOne({
            owner: user.uid,
            date: new Date().getTime(),
            action: 'user password ' + req.params.id + ' reset confirmation',
            logs: [user.uid + '.' + fid + '.update']
        });

        if (notif.mailSet()) {
            return res.redirect(GENERAL_CONFIG.url + '/manager2/passwordresetconfirm');
        } else {
            return res.send({ message: 'Could not send an email, please contact the support' });
        }
    } else {
        return res.status(401).send({ message: 'Invalid authorization key.' });
    }
});

/**
 * Extend validity period if active
 */
router.get('/user/:id/renew/:regkey', async function (req, res) {
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (user.status != STATUS_ACTIVE) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let regkey = req.params.regkey;
    if (user.regkey == regkey) {
        user.history.push({ action: 'extend validity period', date: new Date().getTime() });
        let expiration = new Date().getTime() + day_time * duration_list[user.duration];
        await dbsrv.mongo_users().updateOne(
            { uid: user.uid },
            {
                $set: {
                    expiration: expiration,
                    expiration_notif: 0,
                    history: user.history
                }
            }
        );
        await dbsrv.mongo_events().insertOne({
            owner: user.uid,
            date: new Date().getTime(),
            action: 'Extend validity period: ' + req.params.id,
            logs: []
        });
        let accept = req.accepts(['json', 'html']);
        if (accept == 'json') {
            return res.send({ message: 'validity period extended', expiration: expiration });
        }
        return res.redirect(GENERAL_CONFIG.url + '/manager2/user/' + user.uid + '/renew/' + regkey);
    } else {
        return res.status(401).send({ message: 'Not authorized' });
    }
});

// reactivate user
router.get('/user/:id/renew', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    session_user.is_admin = isadmin;

    if (session_user.is_admin) {
        //let new_password = Math.random().toString(36).slice(-10);
        let new_password = usrsrv.new_password(10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch (err) {
            return res.status(500).send({ message: 'Error during operation' });
        }
        user.history.push({ action: 'reactivate', date: new Date().getTime() });
        await dbsrv.mongo_users().updateOne(
            { uid: user.uid },
            {
                $set: {
                    status: STATUS_ACTIVE,
                    expiration: new Date().getTime() + day_time * duration_list[user.duration],
                    expiration_notif: 0,
                    history: user.history
                }
            }
        );

        try {
            let created_file = await filer.user_renew_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch (error) {
            logger.error('Renew User Failed for: ' + user.uid, error);
            return res.status(500).send({ message: 'Renew User Failed' });
        }

        await dbsrv.mongo_events().insertOne({
            owner: user.uid,
            date: new Date().getTime(),
            action: 'user reactivated by ' + session_user.uid,
            logs: [user.uid + '.' + fid + '.update']
        });

        try {
            let msg_destinations = [user.email];
            if (user.send_copy_to_support) {
                msg_destinations.push(CONFIG.general.support);
            }
            await maisrv.send_notif_mail(
                {
                    name: 'reactivation',
                    destinations: msg_destinations,
                    subject: 'account reactivation'
                },
                {
                    '#UID#': user.uid,
                    '#PASSWORD#': user.password,
                    '#IP#': user.ip
                }
            );
        } catch (error) {
            logger.error(error);
        }

        let error = false;
        try {
            error = await plgsrv.run_plugins('activate', user.uid, user, session_user.uid);
        } catch (err) {
            logger.error('activation errors', err);
            error = true;
        }

        if (!user.is_fake) {
            try {
                await notif.add(user.email, user.uid);
            } catch (err) {
                logger.error('[notif][error=add][mail=' + user.email + ']');
            }
        }

        if (error) {
            return res.status(500).send({ message: 'Activation Error', fid: fid, error: [] });
        } else {
            return res.send({ message: 'Activation in progress', fid: fid, error: [] });
        }
    } else {
        return res.status(401).send({ message: 'Not authorized' });
    }
});

router.put('/user/:id/ssh', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    session_user.is_admin = isadmin;

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'Not found' });
    }
    // If not admin nor logged user
    if (!session_user.is_admin && user._id.toString() != req.locals.logInfo.id.toString()) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let key = req.body.ssh;
    if (!key) {
        return res.status(403).send({ message: 'Invalid SSH Key' });
    }
    // Remove carriage returns if any
    // Escape some special chars for security
    user.ssh = key.replace(/[\n\r]+/g, '').replace(/(["'$`\\])/g, '\\$1');
    if (sansrv.sanitizeSSHKey(user.ssh) === undefined) {
        return res.status(403).send({ message: 'Invalid SSH Key' });
    }
    if (sansrv.sanitizePath(user.home) === undefined) {
        return res.status(403).send({ message: 'Invalid home directory' });
    }
    // Update SSH Key
    await dbsrv.mongo_users().updateOne({ _id: user._id }, { $set: { ssh: key } });
    let fid = new Date().getTime();
    // user.ssh = escapeshellarg(req.body.ssh);
    try {
        let created_file = await filer.user_add_ssh_key(user, fid);
        logger.info('File Created: ', created_file);
    } catch (error) {
        logger.error('Add Ssh Key Failed for: ' + user.uid, error);
        return res.status(500).send({ message: 'Ssh Key Failed' });
    }

    await dbsrv.mongo_events().insertOne({
        owner: session_user.uid,
        date: new Date().getTime(),
        action: 'SSH key update: ' + req.params.id,
        logs: [user.uid + '.' + fid + '.update']
    });

    user.fid = fid;
    return res.send(user);
});

router.get('/user/:id/usage', function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let usage = JSON.parse(JSON.stringify(CONFIG.usage));
    let usages = [];
    for (let i = 0; i < usage.length; i++) {
        usage[i]['link'] = usage[i]['link'].replace('#USER#', req.params.id);
        usages.push(usage[i]);
    }
    return res.send({ usages: usages });
});

// Update user info
router.put('/user/:id', async function (req, res) {
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    session_user.is_admin = isadmin;

    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });

    if (!user) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    // If not admin nor logged user
    if (!session_user.is_admin && user._id.toString() != req.locals.logInfo.id.toString()) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    if (req.body.firstname) {
        user.firstname = req.body.firstname;
    }
    if (req.body.lastname) {
        user.lastname = req.body.lastname;
    }
    if (req.body.email) {
        user.oldemail = user.email;
        user.email = req.body.email;
    } else {
        user.oldemail = user.email;
    }
    if (user.is_fake === undefined) {
        user.is_fake = false;
    }
    let userWasFake = user.is_fake;

    if (session_user.is_admin) {
        if (req.body.is_fake !== undefined) {
            user.is_fake = req.body.is_fake;
        }
        if (req.body.never_expire !== undefined) {
            user.never_expire = req.body.never_expire;
        }
        if (req.body.is_trainer !== undefined) {
            user.is_trainer = req.body.is_trainer;
        }
        if (req.body.send_copy_to_support !== undefined) {
            user.send_copy_to_support = req.body.send_copy_to_support;
        }
    }

    if (user.email == '' || user.firstname == '' || user.lastname == '') {
        if (!user.is_fake) {
            return res.status(403).send({ message: 'Some mandatory fields are empty' });
        }
    }
    if (req.body.loginShell) {
        user.loginShell = req.body.loginShell.trim();
    }
    if (req.body.address) {
        user.address = req.body.address;
    }
    if (req.body.lab) {
        user.lab = req.body.lab;
    }
    if (req.body.responsible) {
        user.responsible = req.body.responsible;
    }
    if (req.body.why) {
        user.why = req.body.why;
    }
    if (req.body.duration) {
        if (!(req.body.duration in duration_list)) {
            return res.status(403).send({ message: 'Duration is not valid' });
        }
        // update expiration if duration have changed
        if (user.duration != req.body.duration) {
            user.expiration = new Date().getTime() + day_time * duration_list[req.body.duration];
        }

        user.duration = req.body.duration;
    }
    if (req.body.team) {
        user.team = req.body.team;
    }
    if (req.body.extra_info) {
        user.extra_info = req.body.extra_info;
    }

    user.history.push({ action: 'update info', date: new Date().getTime() });

    user.oldgroup = user.group;
    user.oldgidnumber = user.gidnumber;
    user.oldmaingroup = user.maingroup;
    user.oldhome = user.home;
    // user.group = '';
    // user.gidnumber = -1;
    if (session_user.is_admin) {
        user.group = '';
        user.gidnumber = -1;
        if (!CONFIG.general.disable_user_group) {
            let group = await dbsrv.mongo_groups().findOne({ name: req.body.group });

            if (!group) {
                return res.status(403).send({
                    message: 'Group ' + req.body.group + ' does not exist, please create it first'
                });
            }

            if (user.secondarygroups.indexOf(group.name) != -1) {
                return res.status(403).send({
                    message: 'Group ' + req.body.group + ' is already a secondary group, please remove user from secondary group first!'
                });
            }
            user.group = req.body.group;
            user.gidnumber = group.gid;
            if (user.group == '' || user.group == null) {
                return res.status(403).send({ message: 'Some mandatory fields are empty' });
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
    } catch (err) {
        logger.error('update errors', err);
    }

    let is_admin = false;
    if (session_user.is_admin) {
        is_admin = true;
    }
    let admin_update_expired = false;
    if (user.status == STATUS_EXPIRED && is_admin) {
        admin_update_expired = true;
    }
    if (user.status == STATUS_ACTIVE || admin_update_expired) {
        await dbsrv.mongo_users().replaceOne({ _id: user._id }, user);
        if (is_admin) {
            user.is_admin = true;
        }
        let fid = new Date().getTime();
        try {
            await goldap.modify(user, fid);
        } catch (err) {
            return res.status(403).send({ message: 'User update failed' });
        }

        try {
            let created_file = await filer.user_modify_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch (error) {
            logger.error('Modify User Failed for: ' + user.uid, error);
        }

        if (is_admin && CONFIG.general.use_group_in_path) {
            if (user.oldgroup != user.group || user.oldmaingroup != user.maingroup) {
                // If group modification, change home location
                await dbsrv.mongo_events().insertOne({
                    owner: session_user.uid,
                    date: new Date().getTime(),
                    action: 'change group from ' + user.oldmaingroup + '/' + user.oldgroup + ' to ' + user.maingroup + '/' + user.group,
                    logs: []
                });
            }
        }

        await dbsrv.mongo_events().insertOne({
            owner: session_user.uid,
            date: new Date().getTime(),
            action: 'User info modification: ' + req.params.id,
            logs: [user.uid + '.' + fid + '.update']
        });
        let users_in_group = await dbsrv
            .mongo_users()
            .find({ $or: [{ secondarygroups: user.oldgroup }, { group: user.oldgroup }] })
            .toArray();
        if (users_in_group && users_in_group.length == 0) {
            let oldgroup = await dbsrv.mongo_groups().findOne({ name: user.oldgroup });
            if (oldgroup) {
                grpsrv.delete_group(oldgroup, session_user.uid);
            }
        }

        user.fid = fid;
        // Change mail registration only when user is active
        // as expired users are removed from mailing list
        if (user.status == STATUS_ACTIVE) {
            if (user.oldemail != user.email && !user.is_fake) {
                await notif.modify(user.oldemail, user.email, user.uid);
            } else if (userWasFake && !user.is_fake) {
                await notif.add(user.email, user.uid);
            } else if (!userWasFake && user.is_fake) {
                await notif.remove(user.email);
            }
        }
        return res.send(user);
    } else {
        await dbsrv.mongo_users().replaceOne({ _id: user._id }, user);
        await dbsrv.mongo_events().insertOne({
            owner: session_user.uid,
            date: new Date().getTime(),
            action: 'Update user info ' + req.params.id,
            logs: []
        });
        let users_in_group = await dbsrv
            .mongo_users()
            .find({ $or: [{ secondarygroups: user.oldgroup }, { group: user.oldgroup }] })
            .toArray();
        if (users_in_group && users_in_group.length == 0) {
            let oldgroup = await dbsrv.mongo_groups().findOne({ name: user.oldgroup });
            if (oldgroup) {
                await grpsrv.delete_group(oldgroup, session_user.uid);
            }
        }
        user.fid = null;
        return res.send(user);
    }
});

router.post('/user/:id/project/:project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id, req.params.project])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let newproject = req.params.project;
    let uid = req.params.id;

    let session_user = null;
    let isadmin = false;
    let project = null;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
        project = await dbsrv.mongo_projects().findOne({ id: newproject });
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!project) {
        return res.status(404).send({ message: 'Project not found' });
    }

    if (!isadmin && session_user.uid != project.owner) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    try {
        await usrsrv.add_user_to_project(newproject, uid, session_user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }

    return res.send({ message: 'User added to project' });
});

router.delete('/user/:id/project/:project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id, req.params.project])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let oldproject = req.params.project;
    let uid = req.params.id;
    let force = req.query.force ? true : false;

    let session_user = null;
    let isadmin = false;
    let project = null;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
        project = await dbsrv.mongo_projects().findOne({ id: oldproject });
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!project) {
        return res.status(404).send({ message: 'Project not found' });
    }

    if (!isadmin && session_user.uid !== project.owner && (!project.managers || !project.managers.includes(session_user.uid)) && session_user.uid != uid) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    try {
        await usrsrv.remove_user_from_project(oldproject, uid, session_user.uid, session_user.is_admin, force);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }

    return res.send({ message: 'User removed from project' });
});

router.get('/list/:list', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.list])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user || !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let list_name = req.params.list;
    let members = await notif.getMembers(list_name);
    return res.send(members);
});

router.get('/lists', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user || !isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let listOfLists = await notif.getLists();
    return res.send(listOfLists);
});

router.get('/user/:id/unlock', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(404).send({ message: 'User not found' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    session_user.is_admin = isadmin;

    if (session_user.is_admin) {
        try {
            await idsrv.user_unlock(user.uid);
        } catch (err) {
            return res.status(500).send({ message: 'Error during operation' });
        }
        return res.send({ message: 'User was unlocked' });
    } else {
        return res.status(401).send({ message: 'Not authorized' });
    }
});

module.exports = router;
