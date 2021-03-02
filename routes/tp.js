/* TODO : create a core/tps.service.js and move all method in it */

var express = require('express');
var router = express.Router();
var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

// var cookieParser = require('cookie-parser')

var fdbs = require('../routes/database.js');
var fwebs = require('../routes/web.js');
var fusers = require('../routes/users.js');
const grpsrv = require('../core/group.service.js');
const usrsrv = require('../core/user.service.js');

const goldap = require('../core/goldap.js');
const filer = require('../core/file.js');
const utils = require('../core/utils.js');

var ObjectID = require('mongodb').ObjectID;

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
    await utils.mongo_groups().insertOne(group);

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
    let group_to_remove = await utils.mongo_groups().findOne({'name': group.name});
    if(!group_to_remove) {
        return false;
    }
    await utils.mongo_groups().removeOne({ 'name': group.name });
    let fid = new Date().getTime();
    await goldap.delete_group(group, fid);
    try {
        let created_file = await  filer.user_delete_group(group, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Delete Group Failed for: ' + group.name, error);
    }

    await utils.freeGroupId(group.gid);
    await utils.mongo_events().insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name + '.' + fid + '.update'] });
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
                group: (CONFIG.general.disable_user_group) ? '' : userGroup.name,
                secondarygroups: (CONFIG.general.disable_user_group) ? [userGroup.name] : [],
                maingroup: CONFIG.general.default_main_group,
                home: '',
                why: 'TP/Training',
                ip: '',
                regkey: '',
                is_internal: false,
                is_fake: true,
                uidnumber: minuid,
                gidnumber: (CONFIG.general.disable_user_group) ? -1 : userGroup.gid,
                duration: duration,
                expiration: end_date + 1000*3600*24*(duration+CONFIG.tp.extra_expiration),
                loginShell: '/bin/bash',
                history: []
            };
            user.home = usrsrv.get_user_home(user);
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
        user.home = usrsrv.get_user_home(user);
        await utils.mongo_users().insertOne(user);
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
    let group = (CONFIG.general.disable_user_group) ? users[0].secondarygroups[0] : users[0].group;
    let from = new Date(from_date);
    let to = new Date(to_date);

    let credentials_html = '<table border="0" cellpadding="0" cellspacing="15"><thead><tr><th align="left" valign="top">Login</th><th align="left" valign="top">Password</th><th>Fake email</th></tr></thead><tbody>';
    for(let i=0;i<users.length;i++){
        credentials_html += '<tr><td align="left" valign="top">' + users[i].uid + '</td><td align="left" valign="top">' + users[i].password + '</td><td align="left" valign="top">' + users[i].email + '</td></tr>';
    }
    credentials_html += '</tbody></table>';

    let user_owner = await utils.mongo_users().findOne({'uid': owner});
    try {
        await utils.send_notif_mail({
            'name': 'tps_password',
            'destinations': [user_owner.email, CONFIG.general.accounts],
            'subject': '[TP accounts reservation] ' + owner
        }, {
            '#FROMDATE#':  from.toDateString(),
            '#TODATE#':  to.toDateString(),
            '#EXPIRATION#': CONFIG.tp.extra_expiration,
            '#CREDENTIALS#': credentials_html, // should be converted by utils.send_notif_mail in plain text for text mail
            '#GROUP#': group,
            '#URL#': CONFIG.general.url,
            '#SUPPORT#': CONFIG.general.support

        });
    } catch(error) {
        logger.error(error);
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
                return usrsrv.delete_user(user, admin_id);
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
    let reservation = await utils.mongo_reservations().findOne({'_id': reservation_id});
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
        await utils.mongo_reservations().updateOne({'_id': reservation_id}, {'$set': {'accounts': reservation.accounts, 'group': newGroup}});
        logger.debug('reservation ', reservation);
        await utils.mongo_events().insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'create reservation for ' + reservation.owner , 'logs': [] });
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

    await utils.mongo_reservations().insertOne(reservation);
    logger.debug('reservation ', reservation);
    return reservation;
};

var insert_ldap_user = async function(user, fid){
    logger.debug('prepare ldap scripts');
    try {
        await goldap.add(user, fid);
        logger.debug('switch to ACTIVE');
        await utils.mongo_users().updateOne({uid: user.uid},{'$set': {status: STATUS_ACTIVE}});
        return user;
    } catch(err) {
        logger.error(err);
        throw user;
    }
};

var activate_tp_user = async function(user, adminId){
    let db_user = await utils.mongo_users().findOne({'uid': user.uid});
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
            let plugins_modules = utils.plugins_modules();
            plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                resolve(true);
            });
        });
    };
    let plugins_info = utils.plugins_info();
    await Promise.all(plugins_info.map(function(plugin_info){
        return plugin_call(plugin_info, user.uid, ldap_user, adminId);
    }));
    return ldap_user;

};

router.get('/tp', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    let reservations = await utils.mongo_reservations().find({}).toArray();
    res.send(reservations);
    res.end();
});

router.post('/tp', async function(req, res) {
    if(req.body.quantity === undefined || req.body.quantity === null || req.body.quantity<=0){
        res.status(403).send({message: 'Quantity must be >= 1'});
        return;
    }
    if(req.body.about === undefined || req.body.about == ''){
        res.status(403).send({message: 'Tell us why you need some tp accounts'});
        return;
    }

    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    tp_reservation(user.uid, req.body.from, req.body.to, req.body.quantity, req.body.about).then(function(reservation){
        res.send({reservation: reservation, message: 'Reservation done'});
        res.end();
        return;
    });
});

router.get('/tp/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await utils.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to get this reservation'});
        res.end();
        return;
    }
    res.send({reservation: reservation});
    res.end();
});

router.delete('/tp/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await utils.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to delete this reservation'});
        res.end();
        return;
    }

    if(reservation.over){
        res.status(403).send({message: 'Reservation is already closed'});
        res.end();
        return;
    }

    if(reservation.created){
        res.status(403).send({message: 'Reservation accounts already created, reservation will be closed after closing date'});
        res.end();
        return;
    }
    await utils.mongo_reservations().updateOne({'_id': ObjectID.createFromHexString(req.params.id)},{'$set': {'over': true}});
    res.send({message: 'Reservation cancelled'});
    res.end();
    return;
});

router.put('/tp/:id/reserve/stop', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await utils.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to delete this reservation'});
        res.end();
        return;
    }

    let users = await reservation.accounts.map(function(user){
        return utils.mongo_users().findOne({'uid': user});
    });
    if (users) {
        await router.delete_tp_users(users, reservation.group, 'auto');
    }
    logger.info('Close reservation', req.params.id);
    await utils.mongo_events().insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'close reservation for ' + reservation.owner , 'logs': [] });
    await utils.mongo_reservations().updateOne({'_id': reservation._id},{'$set': {'over': true}});
    res.send({message: 'Reservation closed'});
    res.end();
});

router.put('/tp/:id/reserve/now', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await utils.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to reserve now this reservation'});
        res.end();
        return;
    }

    let newresa = await router.exec_tp_reservation(reservation._id, 'auto');
    logger.debug('set reservation as done', newresa);
    await utils.mongo_reservations().updateOne({'_id': reservation._id},{'$set': {'created': true}});
    newresa.created = true;
    res.send({reservation: newresa});
    res.end();
});

module.exports = router;
