var express = require('express');
var router = express.Router();
// var bcrypt = require('bcryptjs')
// var escapeshellarg = require('escapeshellarg')

var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];

var plugins = CONFIG.plugins;

if (plugins === undefined) {
    plugins = [];
}

var plugins_modules = {};
var plugins_info = [];

for (var i = 0; i < plugins.length; i++) {
    if(plugins[i]['admin']) {
        continue;
    }
    plugins_modules[plugins[i].name] = require('../plugins/' + plugins[i].name);
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name});
}

// var cookieParser = require('cookie-parser')

var goldap = require('../routes/goldap.js');
var notif = require('../routes/notif_'+MAILER+'.js');
var fdbs = require('../routes/database.js');
var fwebs = require('../routes/web.js');
var fusers = require('../routes/users.js');

const filer = require('../routes/file.js');
var utils = require('../routes/utils.js');

// var get_ip = require('ipware')().get_ip;

/*
var monk = require('monk');
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db);
var users_db = db.get('users');
var groups_db = db.get('groups');
var reservation_db = db.get('reservations');
var events_db = db.get('events');
*/

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;
var mongo_groups = null;
var mongo_events = null;
var mongo_reservations = null;
var ObjectID = require('mongodb').ObjectID;


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
    mongo_users = mongodb.collection('users');
    mongo_groups = mongodb.collection('groups');
    mongo_events = mongodb.collection('events');
    mongo_reservations = mongodb.collection('reservations');
};
mongo_connect();

// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
// eslint-disable-next-line no-unused-vars
var STATUS_EXPIRED = 'Expired';

var createExtraGroup = async function (ownerName) {
    let mingid = await utils.getGroupAvailableId();
    let fid = new Date().getTime();
    let group = { name: 'tp' + mingid, gid: mingid, owner: ownerName };
    await mongo_groups.insertOne(group);

    await goldap.add_group(group, fid);
    try {
        let created_file = await filer.user_add_group(group, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Add Group Failed for: ' + group.name, error);
    }
    group.fid = fid;
    return group;
};


var deleteExtraGroup = async function (group) {
    if (group === undefined || group === null) {
        return false;
    }
    let group_to_remove = await mongo_groups.findOne({'name': group.name});
    if(!group_to_remove) {
        return false;
    }
    await mongo_groups.removeOne({ 'name': group.name });
    let fid = new Date().getTime();
    await goldap.delete_group(group, fid);
    try {
        let created_file = await  filer.user_delete_group(group, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Delete Group Failed for: ' + group.name, error);
    }

    await utils.freeGroupId(group.gid);
    await mongo_events.insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name + '.' + fid + '.update'] });
    return true;
};

var create_tp_users_db = function (owner, quantity, duration, end_date, userGroup) {
    // Duration in days
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        logger.debug('create_tp_users ', owner, quantity, duration);
        let minuid = 1000;

        let users = [];
        for(let i=0;i<quantity;i++){
            logger.debug('create user ', CONFIG.tp.prefix + minuid);
            let user = {
                status: STATUS_PENDING_APPROVAL,
                uid: CONFIG.tp.prefix + minuid,
                firstname: CONFIG.tp.prefix,
                lastname: minuid,
                email: CONFIG.tp.prefix + minuid + '@fake.' + CONFIG.tp.fake_mail_domain,
                address: '',
                lab: '',
                responsible: owner,
                group: userGroup.name,
                secondarygroups: [],
                maingroup: CONFIG.general.default_main_group,
                home: '',
                why: 'TP/Training',
                ip: '',
                regkey: '',
                is_internal: false,
                is_fake: true,
                uidnumber: minuid,
                gidnumber: userGroup.gid,
                duration: duration,
                expiration: end_date + 1000*3600*24*(duration+CONFIG.tp.extra_expiration),
                loginShell: '/bin/bash',
                history: []
            };
            user.home = fusers.user_home(user);
            users.push(user);
            minuid++;
        }
        Promise.all(users.map(function(user){
            logger.debug('map users to create_tp_user_db ', user);
            return create_tp_user_db(user);
        })).then(function(results){
            logger.debug('now activate users');
            return activate_tp_users(owner, results);
        }).then(function(activated_users){
            resolve(activated_users);
        });
    });
};

var create_tp_user_db = async function (tp_user) {
    let user = {...tp_user};
    logger.debug('create_tp_user_db', user.uid);
    try {
        let uid = await utils.getUserAvailableId();
        user.uid = CONFIG.tp.prefix + uid;
        user.lastname = uid;
        user.email = CONFIG.tp.prefix + uid + '@fake.' + CONFIG.tp.fake_mail_domain;
        user.uidnumber = uid;
        user.home = fusers.user_home(user);
        await mongo_users.insertOne(user);
        user.password = Math.random().toString(36).slice(-10);
        return user;
    }
    catch(exception){
        logger.error(exception);
        throw exception;
    }
};

var send_user_passwords = async function(owner, from_date, to_date, users){
    logger.debug('send_user_passwords');
    let from = new Date(from_date);
    let to = new Date(to_date);
    let msg = 'TP account credentials from ' + from.toDateString() + ' to ' + to.toDateString() + '\n\n';
    let msg_html = '<h2>Date</h2>';
    msg_html += '<table border="0" cellpadding="0" cellspacing="15" align="left"><thead><tr><th align="left" valign="top">Start date</th><th align="left" valign="top">End date</th></tr></thead>';
    msg_html += '<tbody><tr><td align="left" valign="top">" + from.toDateString()+ "</td><td align="left" valign="top">" + to.toDateString()+ "</td></tr></tbody></table>';
    msg_html += '<p>Accounts will remain available for <b>" + CONFIG.tp.extra_expiration + " extra days </b>for data access</p>';
    msg_html += '<hr>';
    msg_html += '<h2>Credentials</h2>';
    msg_html += '<table border="0" cellpadding="0" cellspacing="15"><thead><tr><th align="left" valign="top">Login</th><th align="left" valign="top">Password</th><th>Fake email</th></tr></thead><tbody>';

    for(let i=0;i<users.length;i++){
        msg += users[i].uid + ' / ' + users[i].password + ', fake email: ' + users[i].email + '\n';
        msg_html += '<tr><td align="left" valign="top">' + users[i].uid + '</td><td align="left" valign="top">' + users[i].password + '</td><td align="left" valign="top">' + users[i].email + '</td></tr>';
    }
    msg_html += '</tbody></table>';
    msg += 'New TP group: ' + users[0].group + '\n';
    msg_html += '<hr><p>Users are in the group <strong>' + users[0].group + '</strong></p>';
    msg += 'Users can create an SSH key at ' + CONFIG.general.url + ' in SSH Keys section\n';
    msg_html += '<hr>';
    msg_html += '<h2>Access</h2>';
    msg_html += '<p>Users can create an SSH key at ' + CONFIG.general.url + ' in SSH Keys section</p>';
    msg += 'Accounts will remain available for ' + CONFIG.tp.extra_expiration + ' extra days for data access.\n\n';
    msg += 'In case of issue, you can contact us at ' + CONFIG.general.support + '\n\n';
    msg_html += '<hr>';
    msg_html += '<p>In case of issue, you can contact us at ' + CONFIG.general.support + '</p>';

    let user_owner = await mongo_users.findOne({'uid': owner});
    if( notif.mailSet()){
        let mailOptions = {
            origin: MAIL_CONFIG.origin, // sender address
            destinations: [user_owner.email, CONFIG.general.accounts], // list of receivers
            subject: '[TP accounts reservation] ' + owner,
            message: msg,
            html_message: msg_html
        };
        await notif.sendUser(mailOptions);
    }
    return users;
};

var activate_tp_users = function(owner, users){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        Promise.all(users.map(function(user){
            return activate_tp_user(user, owner);
        })).then(function(users){
            // logger.debug("activate_tp_users", users);
            resolve(users);
        });
    });
};

var delete_tp_user = function(user, admin_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        logger.debug('delete_tp_user', user.uid);
        try{
            fdbs.delete_dbs(user).then(function(db_res){
                return db_res;
            // eslint-disable-next-line no-unused-vars
            }).then(function(db_res){
                return fwebs.delete_webs(user);
            // eslint-disable-next-line no-unused-vars
            }).then(function(web_res){
                return fusers.delete_user(user, admin_id);
            }).then(function(){
                resolve(true);
            });

        }
        catch(exception){
            logger.error(exception);
            resolve(false);
        }
    });
};

router.delete_tp_users = function(users, group, admin_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        Promise.all(users.map(function(user){
            return delete_tp_user(user, admin_id);
        })).then(function(users){
            logger.debug('deleted tp_users');
            deleteExtraGroup(group).then(function(){
                resolve(users);
            });
        });
    });

};

router.exec_tp_reservation = async function(reservation_id){
    // Create users for reservation
    let reservation = await mongo_reservations.findOne({'_id': reservation_id});
    logger.debug('create a reservation group', reservation._id);
    let newGroup = await createExtraGroup(reservation.owner);
    logger.debug('create reservation accounts', reservation._id);
    let activated_users = await create_tp_users_db(
        reservation.owner,
        reservation.quantity,
        Math.ceil((reservation.to-reservation.from)/(1000*3600*24)),
        reservation.to, newGroup
    );
    for(let i=0;i<activated_users.length;i++){
        logger.debug('activated user ', activated_users[i].uid);
        reservation.accounts.push(activated_users[i].uid);
    }
    try{
        await send_user_passwords(reservation.owner, reservation.from, reservation.to, activated_users);
        await mongo_reservations.updateOne({'_id': reservation_id}, {'$set': {'accounts': reservation.accounts, 'group': newGroup}});
        logger.debug('reservation ', reservation);
        return reservation;
    }
    catch(exception){
        logger.error(exception);
        throw exception;
    }
};

var tp_reservation = async function(userId, from_date, to_date, quantity, about){
    // Create a reservation
    let reservation = {
        'owner': userId,
        'from': from_date,
        'to': to_date,
        'quantity': quantity,
        'accounts': [],
        'about': about,
        'created': false,
        'over': false
    };

    await mongo_reservations.insertOne(reservation);
    logger.debug('reservation ', reservation);
    return reservation;
};

var insert_ldap_user = async function(user, fid){
    logger.debug('prepare ldap scripts');
    try {
        await goldap.add(user, fid);
        logger.debug('switch to ACTIVE');
        await mongo_users.updateOne({uid: user.uid},{'$set': {status: STATUS_ACTIVE}});
        return user;
    } catch(err) {
        logger.error(err);
        throw user;
    }
};

var activate_tp_user = async function(user, adminId){
    let db_user = await mongo_users.findOne({'uid': user.uid});
    if(!db_user) {
        logger.error('failure:',user.uid);
        throw `user activation failed ${user.uid}`;
    }
    logger.debug('activate', user.uid);
    let fid = new Date().getTime();
    let ldap_user = await insert_ldap_user(user, fid);
    try {
        let created_file = await filer.user_add_user(ldap_user, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Add User Failed for: ' + user.uid, error);
    }


    let plugin_call = function(plugin_info, userId, data, adminId){
        // eslint-disable-next-line no-unused-vars
        return new Promise(function (resolve, reject){
            plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                resolve(true);
            });
        });
    };
    await Promise.all(plugins_info.map(function(plugin_info){
        return plugin_call(plugin_info, user.uid, ldap_user, adminId);
    }));
    return ldap_user;

};

router.get('/tp', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await mongo_users.findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({msg: 'User does not exist'});
        res.end();
        return;
    }
    let reservations = await mongo_reservations.find({}).toArray();
    res.send(reservations);
    res.end();
});

router.post('/tp', async function(req, res) {
    if(req.body.quantity<=0){
        res.status(403).send('Quantity must be >= 1');
        return;
    }
    if(req.body.about === undefined || req.body.about == ''){
        res.status(403).send('Tell us why you need some tp accounts');
        return;
    }

    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await mongo_users.findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({msg: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send('Not authorized');
        return;
    }
    tp_reservation(user.uid, req.body.from, req.body.to, req.body.quantity, req.body.about).then(function(reservation){
        res.send({'reservation': reservation, 'msg': 'Reservation done'});
        res.end();
        return;
    });
});

router.delete('/tp/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await mongo_users.findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({msg: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send('Not authorized');
        return;
    }

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: req.params.id};
    }
    else{
        filter = {_id: req.params.id, owner: user.uid};
    }
    let reservation = await mongo_reservations.findOne(filter);
    if(!reservation){
        res.status(403).send({'msg': 'Not allowed to delete this reservation'});
        res.end();
        return;
    }

    if(reservation.over){
        res.status(403).send({'msg': 'Reservation is already closed'});
        res.end();
        return;
    }

    if(reservation.created){
        res.status(403).send({'msg': 'Reservation accounts already created, reservation will be closed after closing date'});
        res.end();
        return;
    }
    await mongo_reservations.updateOne({'_id': ObjectID.createFromHexString(req.params.id)},{'$set': {'over': true}});
    res.send({'msg': 'Reservation cancelled'});
    res.end();
    return;
});



module.exports = router;
