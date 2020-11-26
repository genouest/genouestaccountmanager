/* eslint-disable require-atomic-updates */
/*jslint es6 */
var express = require('express');
var router = express.Router();
var markdown = require('markdown').markdown;
var htmlToText = require('html-to-text');
var validator = require('email-validator');

var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const filer = require('../routes/file.js');
const conf = require('../routes/conf.js');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var goldap = require('../routes/goldap.js');
var utils = require('../routes/utils.js');

const MAILER = CONFIG.general.mailer;
var notif = require('../routes/notif_'+MAILER+'.js');

var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

let day_time = 1000 * 60 * 60 * 24;
let duration_list = conf.get_conf().duration;
//const runningEnv = process.env.NODE_ENV || 'prod';

function get_group_home (user) {
    let group_path = CONFIG.general.home+'/'+user.group;
    if(user.maingroup!='' && user.maingroup!=null) {
        group_path = CONFIG.general.home+'/'+user.maingroup+'/'+user.group;
    }
    return group_path.replace(/\/+/g, '/');
}

function get_user_home (user) {
    // todo check  or not if user.uid exist
    let user_home = CONFIG.general.home + '/' + user.uid;
    if(CONFIG.general.use_group_in_path) {
        user_home = get_group_home(user) + '/' + user.uid;
    }
    return user_home.replace(/\/+/g, '/');
}


router.user_home = function (user) {
    return get_user_home(user);
};


var create_group = async function(group_name, owner_name){
    let mingid = await utils.getGroupAvailableId();
    let fid = new Date().getTime();
    let group = {name: group_name, gid: mingid, owner: owner_name};
    try {
        await utils.mongo_groups().insertOne(group);
        await goldap.add_group(group, fid);
    }
    catch(e) {
        logger.error(e);
        throw 'group creation failed';
    }
    try {
        let created_file = await filer.user_add_group(group, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Create Group Failed for: ' + group.name, error);
        throw 'group creation failed';
    }

    await utils.mongo_events().insertOne({'owner': owner_name, 'date': new Date().getTime(), 'action': 'create group ' + group_name , 'logs': [group_name + '.' + fid + '.update']});


    return group;

};

var create_extra_user = async function(user_name, group, internal_user){
    let password = Math.random().toString(36).slice(-10);
    if(process.env.MY_ADMIN_PASSWORD){
        password = process.env.MY_ADMIN_PASSWORD;
    }
    else {
        logger.info('Generated admin password:' + password);
    }

    let user = {
        status: STATUS_ACTIVE,
        uid: user_name,
        firstname: user_name,
        lastname: user_name,
        email: process.env.MY_ADMIN_EMAIL || CONFIG.general.support,
        address: '',
        lab: '',
        responsible: '',
        group: (CONFIG.general.disable_user_group) ? '' : group.name,
        secondarygroups: [],
        maingroup: '',
        home: '',
        why: '',
        ip: '',
        regkey: Math.random().toString(36).slice(-10),
        is_internal: internal_user,
        is_fake: false,
        uidnumber: -1,
        gidnumber: -1,
        cloud: false,
        duration: '1 year',
        expiration: new Date().getTime() + day_time*360,
        loginShell: '/bin/bash',
        history: [],
        password: password
    };
    let minuid = await utils.getUserAvailableId();
    user.uidnumber = minuid;
    user.gidnumber = (CONFIG.general.disable_user_group) ? -1 : group.gid;
    user.home = get_user_home(user);
    let fid = new Date().getTime();
    try {
        await goldap.add(user, fid);
    } catch(err) {
        logger.error('Failed to create extra user', user, err);
        throw err;
    }
    logger.debug('user added to ldap');

    delete user.password;
    // eslint-disable-next-line no-unused-vars
    await utils.mongo_users().insertOne(user);
    try {
        let created_file = await filer.user_create_extra_user(user, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Create User Failed for: ' + user.uid, error);
        throw error;
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

    try {
        let plugins_info = utils.plugins_info();
        await Promise.all(plugins_info.map(function(plugin_info){
            return plugin_call(plugin_info, user.uid, user, 'auto');
        }));
    } catch(err) {
        logger.error('failed to create extra user', user, err);
    }
    return user;
};

router.create_admin = async function(default_admin, default_admin_group){
    let user = await utils.mongo_users().findOne({'uid': default_admin});
    if(user){
        logger.info('admin already exists, skipping');
    }
    else {
        logger.info('should create admin');
        let group = await utils.mongo_groups().findOne({name: default_admin_group});
        if(group){
            logger.info('group already exists');
            // eslint-disable-next-line no-unused-vars
            await create_extra_user(default_admin, group, true);
            logger.info('admin user created');
        }
        else {
            logger.info('need to create admin group');
            let group = await create_group(default_admin_group, default_admin);
            logger.info('admin group created', group);
            let user = await create_extra_user(default_admin, group, true);
            logger.info('admin user created', user);
        }
    }
};

router.get('/user/:id/apikey', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    try {
        session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'not found'});
        res.end();
        return;
    }

    if(session_user.uid !== req.params.id && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user= await utils.mongo_users().findOne({uid: req.params.id});
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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    let message = req.body.message;
    let subject = req.body.subject;

    try {
        await utils.send_notif_mail({
            'name': null,
            'destinations': [user.email],
            'subject': subject,
            'markdown': message,
        }, {});
    } catch(error) {
        logger.error(error);
        res.status(500).send({message: 'message error', error: error});
        res.end();
        return;
    }
    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'message: ' + subject , 'logs': []});

    res.send({message: 'message sent'});
    res.end();
});

router.post('/user/:id/apikey', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(session_user.uid !== req.params.id && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let apikey = Math.random().toString(36).slice(-10);
    await utils.mongo_users().updateOne({uid: req.params.id}, {'$set':{'apikey': apikey}});
    res.send({apikey: apikey});
    res.end();
});


router.put('/user/:id/subscribe', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    // if not user nor admin
    if (req.locals.logInfo.id !== req.params.id && GENERAL_CONFIG.admin.indexOf(req.locals.logInfo.id) < 0) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.email == undefined || user.email == ''){
        res.send({subscribed: false});
        res.end();
    } else {
        notif.add(user.email, function() {
            res.send({subscribed: true});
            res.end();
        });
    }

});

router.put('/user/:id/unsubscribe', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    // if not user nor admin
    if (req.locals.logInfo.id !== req.params.id && GENERAL_CONFIG.admin.indexOf(req.locals.logInfo.id) < 0) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.email == undefined || user.email == ''){
        res.send({unsubscribed: false});
        res.end();
    } else {
        notif.remove(user.email, function() {
            res.send({unsubscribed: true});
            res.end();
        });
    }

});


router.get('/user/:id/subscribed', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user.email == undefined || user.email == ''){
        res.send({subscribed: false});
        res.end();
    } else {
        notif.subscribed(user.email, function(is_subscribed) {
            res.send({subscribed: is_subscribed});
            res.end();
        });
    }
});

router.get('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let users_in_group = await utils.mongo_users().find({'$or': [{'secondarygroups': req.params.id}, {'group': req.params.id}]}).toArray();
    res.send(users_in_group);
    res.end();
});

router.delete_group = async function(group, admin_user_id){
    await utils.mongo_groups().deleteOne({'name': group.name});
    let fid = new Date().getTime();
    await goldap.delete_group(group, fid);
    try {
        let created_file = await filer.user_delete_group(group, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Delete Group Failed for: ' + group.name, error);
        return false;
    }

    await utils.mongo_events().insertOne({'owner': admin_user_id, 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name + '.' + fid + '.update']});
    await utils.freeGroupId(group.gid);
    return true;
};

router.clear_user_groups = async function(user, admin_user_id){
    let allgroups = user.secondarygroups;
    if (user.group && user.group != '') {
        allgroups.push(user.group);
    }
    for(let i=0;i < allgroups.length;i++){
        let group = await utils.mongo_groups().findOne({name: allgroups[i]});
        if(group){
            let users_in_group = await utils.mongo_users().find({'$or': [{'secondarygroups': group.name}, {'group': group.name}]}).toArray();
            if(users_in_group && users_in_group.length == 0){
                router.delete_group(group, admin_user_id);
            }
        }
    }
};


router.delete('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let group = await utils.mongo_groups().findOne({name: req.params.id});
    if(!group) {
        res.status(403).send({message: 'Group does not exist'});
        return;
    }
    let users_in_group = await utils.mongo_users().find({'$or': [{'secondarygroups': req.params.id}, {'group': req.params.id}]}).toArray();
    if(users_in_group && users_in_group.length > 0){
        res.status(403).send({message: 'Group has some users, cannot delete it'});
        return;
    }
    router.delete_group(group, user.uid).then(function(){
        res.send({message: 'group ' + req.params.id + ' deleted'});
        res.end();
    });
});


router.put('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!session_user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let owner = req.body.owner;
    let user = await utils.mongo_users().findOne({uid: owner});
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        res.end();
        return;
    }
    let group = await utils.mongo_groups().findOne({name: req.params.id});
    if(! group) {
        res.status(404).send({message: 'Group does not exist'});
        return;
    }
    await utils.mongo_events().insertOne({
        'owner': user.uid,
        'date': new Date().getTime(),
        'action': 'group owner modification ' + group.name + ' to ' +owner,
        'logs': []});

    let data = await utils.mongo_groups().updateOne({name: group.name}, {'$set':{'owner': owner}});
    res.send(data);
    res.end();
});

router.post('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(session_user == null){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let owner = req.body.owner;
    let user = await utils.mongo_users().findOne({uid: owner});
    if(!user) {
        res.status(404).send({message: 'Owner user does not exist'});
        res.end();
        return;
    }
    let group = await utils.mongo_groups().findOne({name: new RegExp('^' + req.params.id + '$', 'i')});
    if(group) {
        res.status(403).send({message: 'Group already exists'});
        return;
    }

    try {
        group = await create_group(req.params.id , owner);
    } catch(error){
        logger.error('Add Group Failed for: ' + req.params.id, error);
        res.status(500).send({message: 'Add Group Failed'});
        return;
    }

    res.send(group);
    res.end();
    return;
});

router.get('/ip', function(req, res) {
    let ip = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    res.json({ip: ip});
});

router.get('/group', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let groups = await utils.mongo_groups().find().toArray();
    res.send(groups);
    return;
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
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
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
    // eslint-disable-next-line no-unused-vars
    notif.sendList(req.body.list, mailOptions, function(err, response) {
        res.send({message: ''});
        return;
    });
});

// Get users listing - for admin
router.get('/user', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let users = await utils.mongo_users().find({}).toArray();
    res.json(users);
});

var add_user_to_group = async function (uid, secgroup, action_owner) {
    logger.info('Adding user ' + uid + ' to group ' + secgroup);
    let user = await utils.mongo_users().findOne({uid: uid});
    if(!user){
        throw {code: 404, message:'User not found'};
    }
    if(secgroup == user.group) {
        throw {code: 208, message: 'Group is user main\'s group: '+user.group};
    }
    if(!user.secondarygroups) {
        user.secondarygroups = [];
    }
    for(let g=0;g < user.secondarygroups.length;g++){
        if(secgroup == user.secondarygroups[g]) {
            throw {code: 208, message: 'group is already set'};
        }
    }
    user.secondarygroups.push(secgroup);
    let fid = new Date().getTime();
    // Now add group
    await goldap.change_user_groups(user, [secgroup], [], fid);
    try {
        await utils.mongo_users().updateOne({_id: user._id}, {'$set': { secondarygroups: user.secondarygroups}});
    } catch(err) {
        throw {code: 500, message: 'Could not update user'};
    }

    try {
        let created_file = await filer.user_change_group(user, fid);
        logger.info('File Created: ', created_file);
        await utils.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'add user ' + uid + ' to secondary  group ' + secgroup , 'logs': [created_file]});
    } catch(error){
        logger.error('Group Change Failed for: ' + user.uid, error);
        throw {code: 500, message:'Change Group Failed'};
    }


};

router.post('/user/:id/group/:group', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.group])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!session_user){
        res.status(401).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let uid = req.params.id;
    let secgroup = req.params.group;

    try {
        await add_user_to_group(uid, secgroup, session_user.uid);
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
    if(! utils.sanitizeAll([req.params.id, req.params.group])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(! session_user || GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let uid = req.params.id;
    let secgroup = req.params.group;
    let user = await utils.mongo_users().findOne({uid: uid});
    if(secgroup == user.group) {
        res.send({message: 'Group is user main\'s group: '+user.group});
        res.end();
        return;
    }
    let present = false;
    let newgroup = [];
    for(let g=0;g < user.secondarygroups.length;g++){
        if(secgroup == user.secondarygroups[g]) {
            present = true;
        }
        else {
            newgroup.push(user.secondarygroups[g]);
        }
    }
    if(! present) {
        res.send({message: 'group is not set'});
        res.end();
        return;
    }
    user.secondarygroups = newgroup;
    let fid = new Date().getTime();
    // Now add group
    await goldap.change_user_groups(user, [], [secgroup], fid);
    try {
        await utils.mongo_users().updateOne({_id: user._id}, {'$set': { secondarygroups: user.secondarygroups}});
    } catch(err) {
        res.send({message: 'Could not update user'});
        res.end();
        return;
    }

    try {
        let created_file = await filer.user_change_group(user, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Group Change Failed for: ' + user.uid, error);
        res.status(500).send({message: 'Change Group Failed'});
        return;
    }

    await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove user ' + req.params.id + ' from secondary  group ' + req.params.group , 'logs': [user.uid + '.' + fid + '.update']});
    let users_in_group = await utils.mongo_users().find({'$or': [{'secondarygroups': secgroup}, {'group': secgroup}]}).toArray();
    if(users_in_group && users_in_group.length > 0){
        res.send({message: 'User removed from group', fid: fid});
        res.end();
        return;
    }
    // If group is empty, delete it
    let group = await utils.mongo_groups().findOne({name: secgroup});
    if(!group) {
        res.send({message: 'User removed from group', fid: fid});
        res.end();
        return;
    }
    router.delete_group(group, session_user.uid).then(function(){
        res.send({message: 'User removed from group. Empty group ' + secgroup + ' was deleted'});
        res.end();
        return;
    });
});

router.delete_user = async function(user, action_owner_id, message){
    let user_is_activ = true;

    if(user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL){
        user_is_activ = false;
    }

    let fid = new Date().getTime();
    // Remove user from groups
    let allgroups = user.secondarygroups;
    if (user.group && user.group != '') {
        allgroups.push(user.group);
    }
    if(user_is_activ){
        await goldap.change_user_groups(user, [], allgroups, fid);

        try {
            let created_file = await filer.user_delete_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch(error){
            logger.error('Delete User Failed for: ' + user.uid, error);
            return false;
        }
    }

    try {
        await utils.mongo_users().deleteOne({_id: user._id});
    } catch(err) {
        return false;
    }

    router.clear_user_groups(user, action_owner_id);

    await utils.mongo_events().insertOne({
        'owner': action_owner_id,
        'date': new Date().getTime(),
        'action': 'delete user ' + user.uid ,
        'logs': [user.uid + '.' + fid + '.update']
    });

    let msg_destinations =  [GENERAL_CONFIG.accounts];
    let mail_message=  'no explaination provided !';
    if (message && message.length > 1) {
        mail_message = message;
        msg_destinations.push(user.email);
    }

    try {
        await utils.send_notif_mail({
            'name': 'user_deletion',
            'destinations': msg_destinations,
            'subject': 'account deletion: ' + user.uid
        }, {
            '#UID#': user.uid,
            '#USER#': action_owner_id,
            '#MSG#': mail_message
        });
    } catch(error) {
        logger.error(error);
    }

    if(user_is_activ){
        // Call remove method of plugins if defined
        let plugin_call = function(plugin_info, userId, user, adminId){
            // eslint-disable-next-line no-unused-vars
            return new Promise(function (resolve, reject){
                let plugins_modules = utils.plugins_modules();
                if(plugins_modules[plugin_info.name].remove === undefined) {
                    resolve(true);
                }
                plugins_modules[plugin_info.name].remove(userId, user, adminId).then(function(){
                    resolve(true);
                });
            });
        };
        let plugins_info = utils.plugins_info();
        await Promise.all(plugins_info.map(function(plugin_info){
            return plugin_call(plugin_info, user.uid, user, action_owner_id);
        }));
    }

    await utils.freeUserId(user.uidnumber);
    return true;
};

router.delete('/user/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!session_user || GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let uid = req.params.id;
    let mail_message = '';
    if (req.body.message) {
        mail_message = req.body.message;
    }

    let user = await utils.mongo_users().findOne({uid: uid});
    if(!user) {
        res.send({message: 'User not found ' + uid});
        res.end();
        return;
    }
    if(user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL){
        router.delete_user(user, session_user.uid, mail_message).then(function(){
            res.send({message: 'User deleted'});
            res.end();
            return;
        });

    }
    else {
        // Must check if user has databases and sites
        // Do not remove in this case, owners must be changed before
        let databases = await utils.mongo_databases().find({owner: uid}).toArray();
        if(databases && databases.length>0) {
            res.send({message: 'User owns some databases, please change owner first!'});
            res.end();
            return;
        }
        let websites = await utils.mongo_web().find({owner: uid}).toArray();
        if(websites && websites.length>0) {
            res.send({message: 'User owns some web sites, please change owner first!'});
            res.end();
            return;
        }
        router.delete_user(user, session_user.uid, mail_message).then(function(){
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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!session_user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
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
    user.password = Math.random().toString(36).slice(-10);
    let minuid = await utils.getUserAvailableId();
    user.uidnumber = minuid;
    user.gidnumber = -1;
    if (!CONFIG.general.disable_user_group) {
        let data = await utils.mongo_groups().findOne({'name': user.group});
        if(!data) {
            if (CONFIG.general.auto_add_group) {
                try {
                    await create_group(user.group, user.uid);
                } catch(error){
                    logger.error('Add Group Failed for: ' + user.group, error);
                    res.status(500).send({message: 'Add Group Failed'});
                    return;
                }

                data = await utils.mongo_groups().findOne({'name': user.group});
            } else {

                res.status(403).send({message: 'Group ' + user.group + ' does not exist, please create it first'});
                res.end();
                return;
            }
        }
        user.gidnumber = data.gid;
    }

    user.home = get_user_home(user);
    let fid = new Date().getTime();
    try {
        await goldap.add(user, fid);
        let created_file = await filer.user_add_user(user, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Add User Failed for: ' + user.uid, error);
        res.status(500).send({message: 'Add User Failed'});
        return;
    }

    await utils.mongo_users().updateOne({uid: req.params.id},{'$set': {status: STATUS_ACTIVE, uidnumber: minuid, gidnumber: user.gidnumber, expiration: new Date().getTime() + day_time*duration_list[user.duration]}, '$push': { history: {action: 'validation', date: new Date().getTime()}} });

    try {
        await utils.send_notif_mail({
            'name' : 'activation',
            'destinations': [user.email],
            'subject': 'account activation'
        }, {
            '#UID#':  user.uid,
            '#PASSWORD#': user.password,
            '#IP#': user.ip
        });
    } catch(error) {
        logger.error(error);
    }

    await utils.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'activate user ' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']});

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
    Promise.all(plugins_info.map(function(plugin_info){
        return plugin_call(plugin_info, user.uid, user, session_user.uid);
        // eslint-disable-next-line no-unused-vars
    })).then(function(results){
        notif.add(user.email, function() {
            res.send({message: 'Activation in progress', fid: fid, error: []});
            res.end();
        });
        return;
    }, function(err){
        notif.add(user.email, function() {
            res.send({message: 'Activation Error', fid: fid, error: err});
            res.end();
        });
        return;
    });


});

// Get user - for logged user or admin
router.get('/user/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized, need to login first'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(user.is_fake===undefined) {
        user.is_fake = false;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        user.is_admin = true;
    }
    else {
        user.is_admin = false;
    }
    user.quota = [];
    for(let k in GENERAL_CONFIG.quota) {
        user.quota.push(k);
    }

    if(session_user._id.str == user._id.str || GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0){
        res.json(user);
        return;
    }
    else {
        res.status(401).send({message: 'Not authorized to access this user info'});
        return;
    }
});

// Registration mail confirmation
router.get('/user/:id/confirm', async function(req, res) {
    let uid = req.params.id;
    let regkey = req.query.regkey;
    if(! utils.sanitizeAll([uid])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: uid});
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
            await utils.mongo_users().updateOne(
                { _id: user._id},
                {
                    $set: {status: STATUS_PENDING_APPROVAL},
                    $push: {history: account_event}
                });

            let link = GENERAL_CONFIG.url + encodeURI('/manager2/user/'+user.uid);
            try {
                await utils.send_notif_mail({
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

            await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user confirmed email:' + req.params.id , 'logs': []});
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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
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

    if (!(req.body.duration in duration_list))
    {
        res.send({status: 1, message: 'Invalid duration format'});
        return;
    }

    let user_email = await utils.mongo_users().findOne({email: req.body.email, is_fake: false});
    if(user_email){
        res.send({status: 1, message: 'User email already exists'});
        return;
    }
    let userexists = await utils.mongo_users().findOne({uid: req.params.id});
    if(userexists){
        res.send({status: 1, message: 'User id already exists'});
        return;
    }

    let regkey = Math.random().toString(36).substring(7);
    let default_main_group = GENERAL_CONFIG.default_main_group || '';
    let group = '';
    if (!CONFIG.general.disable_user_group) {
        switch (CONFIG.general.registration_group) {
        case 'username':
            group = req.params.id;
            break;
        case 'main':
            group = default_main_group;
            break;
        case 'team': // use the team by default for retro-compatibility
        default:
            group = req.body.team;
            break;
        }
    }

    let user = {
        status: STATUS_PENDING_EMAIL,
        uid: req.params.id,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        address: req.body.address,
        lab: req.body.lab,
        responsible: req.body.responsible,
        team: req.body.team,
        group: group,
        secondarygroups: [],
        maingroup: default_main_group,
        home: '',
        why: req.body.why,
        ip: req.body.ip,
        regkey: regkey,
        is_internal: false,
        is_fake: false,
        uidnumber: -1,
        gidnumber: -1,
        cloud: false,
        duration: req.body.duration,
        expiration: new Date().getTime() + day_time*duration_list[req.body.duration],
        loginShell: '/bin/bash',
        history: [{action: 'register', date: new Date().getTime()}]
    };
    // user[CONFIG.general.internal_flag] = false,
    user.home = get_user_home(user);

    await utils.mongo_events().insertOne({'owner': req.params.id, 'date': new Date().getTime(), 'action': 'user registration ' + req.params.id , 'logs': []});


    await utils.mongo_users().insertOne(user);
    let uid = req.params.id;
    let link = GENERAL_CONFIG.url + encodeURI('/user/'+uid+'/confirm?regkey='+regkey);
    try {
        await utils.send_notif_mail({
            'name' : 'confirmation',
            'destinations': [user.email],
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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if (!session_user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if (!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        // eslint-disable-next-line require-atomic-updates
        session_user.is_admin = true;
    }
    else {
        // eslint-disable-next-line require-atomic-updates
        session_user.is_admin = false;
    }
    if(session_user.is_admin){
        let new_password = Math.random().toString(36).slice(-10);
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
        await utils.mongo_users().updateOne({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}});

        try {
            let created_file = await filer.user_expire_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch(error){
            logger.error('Expire User Failed for: ' + user.uid, error);
            res.status(500).send({message: 'Expire User Failed'});
            return;
        }

        await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'user expiration:' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']});

        // Now remove from mailing list
        try {
            // eslint-disable-next-line no-unused-vars
            notif.remove(user.email, function(err){
                let plugin_call = function(plugin_info, userId, user, adminId){
                    // eslint-disable-next-line no-unused-vars
                    return new Promise(function (resolve, reject){
                        let plugins_modules = utils.plugins_modules();
                        plugins_modules[plugin_info.name].deactivate(userId, user, adminId).then(function(){
                            resolve(true);
                        });
                    });
                };
                let plugins_info = utils.plugins_info();
                Promise.all(plugins_info.map(function(plugin_info){
                    return plugin_call(plugin_info, user.uid, user, session_user.uid);
                    // eslint-disable-next-line no-unused-vars
                })).then(function(data){
                    res.send({message: 'Operation in progress', fid: fid, error: []});
                    res.end();
                    return;
                }, function(errs){
                    res.send({message: 'Operation in progress', fid: fid, error: errs});
                    res.end();
                });
            });
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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!session_user || session_user.uid != req.params.id && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0) {
        res.send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
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
    await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.params.id + ' password update request', 'logs': []});
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
    let key = Math.random().toString(36).substring(7);
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = await utils.mongo_users().findOne({uid: req.params.id});
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

    try {
        await utils.mongo_users().updateOne({uid: req.params.id},{'$set': {regkey: key}});
    } catch(err) {
        res.status(404).send({message: 'User cannot be updated'});
        res.end();
        return;
    }

    user.password='';
    // Now send email
    let link = CONFIG.general.url + encodeURI('/user/'+req.params.id+'/passwordreset/'+key);

    try {
        await utils.send_notif_mail({
            'name' : 'password_reset_request',
            'destinations': [user.email],
            'subject': 'account password reset request'
        }, {
            '#UID#':  user.uid,
            '#LINK#': link
        });
    } catch(error) {
        logger.error(error);
    }

    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.params.id + ' password reset request', 'logs': []});

    if(notif.mailSet()) {
        res.send({message: 'Password reset requested, check your inbox for instructions to reset your password.'});
    }
    else {
        res.send({message: 'Could not send an email, please contact the support'});
    }
});

router.get('/user/:id/passwordreset/:key', async function(req, res){
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(req.params.key == user.regkey) {
        // reset the password
        let new_password = Math.random().toString(36).slice(-10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch(err) {
            res.send({message: 'Error during operation'});
            return;
        }
        user.history.push({'action': 'password reset', date: new Date().getTime()});
        await utils.mongo_users().updateOne({uid: user.uid},{'$set': {history: user.history}});

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
        let new_key = Math.random().toString(36).substring(7);
        await utils.mongo_users().updateOne({uid: req.params.id},{'$set': {regkey: new_key}});

        // Now send email
        try {
            await utils.send_notif_mail({
                'name' : 'password_reset',
                'destinations': [user.email],
                'subject': 'account password reset'
            }, {
                '#UID#':  user.uid,
                '#PASSWORD#': user.password
            });
        } catch(error) {
            logger.error(error);
        }

        await utils.mongo_events().insertOne({'owner': user.uid,'date': new Date().getTime(), 'action': 'user password ' + req.params.id + ' reset confirmation', 'logs': [user.uid + '.' + fid + '.update']});

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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
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
        await utils.mongo_users().updateOne({uid: user.uid},{'$set': {expiration: expiration, history: user.history}});
        await utils.mongo_events().insertOne({'owner': user.uid,'date': new Date().getTime(), 'action': 'Extend validity period: ' + req.params.id , 'logs': []});
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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    if(session_user.is_admin){
        let new_password = Math.random().toString(36).slice(-10);
        user.password = new_password;
        let fid = new Date().getTime();
        try {
            await goldap.reset_password(user, fid);
        } catch(err) {
            res.send({message: 'Error during operation'});
            return;
        }
        user.history.push({'action': 'reactivate', date: new Date().getTime()});
        await utils.mongo_users().updateOne({uid: user.uid},{'$set': {status: STATUS_ACTIVE, expiration: (new Date().getTime() + day_time*duration_list[user.duration]), history: user.history}});

        try {
            let created_file = await filer.user_renew_user(user, fid);
            logger.info('File Created: ', created_file);
        } catch(error){
            logger.error('Renew User Failed for: ' + user.uid, error);
            res.status(500).send({message: 'Renew User Failed'});
            return;
        }

        await utils.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'Reactivate user ' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']});


        try {
            await utils.send_notif_mail({
                'name' : 'reactivation',
                'destinations': [user.email],
                'subject': 'account reactivation'
            }, {
                '#UID#':  user.uid,
                '#PASSWORD#': user.password,
                '#IP#': user.ip
            });
        } catch(error) {
            logger.error(error);
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
        Promise.all(plugins_info.map(function(plugin_info){
            return plugin_call(plugin_info, user.uid, user, session_user.uid);
            // eslint-disable-next-line no-unused-vars
        })).then(function(results){
            notif.add(user.email, function() {
                res.send({message: 'Activation in progress', fid: fid, error: []});
                res.end();
            });
            return;
        }, function(err){
            notif.add(user.email, function() {
                res.send({message: 'Activation Error', fid: fid, error: err});
                res.end();
            });
            return;
        });

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
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    // If not admin nor logged user
    if(!session_user.is_admin && user._id.str != req.locals.logInfo.id.str) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let key = req.body.ssh;
    // Remove carriage returns if any
    // Escape some special chars for security
    user.ssh = key.replace(/[\n\r]+/g, '').replace(/(["'$`\\])/g,'\\$1');
    if (utils.sanitizeSSHKey(user.ssh) === undefined) {
        res.status(403).send({message: 'Invalid SSH Key'});
        return;
    }
    if (utils.sanitizePath(user.home) === undefined) {
        res.status(403).send({message: 'Invalid home directory'});
        return;
    }
    // Update SSH Key
    await utils.mongo_users().updateOne({_id: user._id}, {'$set': {ssh: key}});
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

    await utils.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'SSH key update: ' + req.params.id , 'logs': [ user.uid + '.' + fid + '.update']});

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
    if(! utils.sanitizeAll([req.params.id])) {
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

    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if (!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});

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
        if(req.body.is_trainer !== undefined ){
            user.is_trainer = req.body.is_trainer;
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
            let group = await utils.mongo_groups().findOne({'name': req.body.group});

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
        user.home = get_user_home(user);

    }


    let plugin_call = function(plugin_info, userId, data, adminId){
        // eslint-disable-next-line no-unused-vars
        return new Promise(function (resolve, reject){
            let plugins_modules = utils.plugins_modules();
            if (plugins_modules[plugin_info.name].update !== undefined) {
                plugins_modules[plugin_info.name].update(userId, data, adminId).then(function(){
                    resolve(true);
                });
            } else {
                resolve(true);
            }
        });
    };

    try {
        let plugins_info = utils.plugins_info();
        await Promise.all(plugins_info.map(function(plugin_info){
            return plugin_call(plugin_info, user.uid, user, session_user.uid);
        }));
    } catch(err) {
        logger.error('failed to update user', user, err);
    }


    if(user.status == STATUS_ACTIVE){
        await utils.mongo_users().replaceOne({_id: user._id}, user);
        if(session_user.is_admin) {
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

        if(session_user.is_admin && CONFIG.general.use_group_in_path) {
            if(user.oldgroup != user.group || user.oldmaingroup != user.maingroup) {
                // If group modification, change home location
                await utils.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'change group from ' + user.oldmaingroup + '/' + user.oldgroup + ' to ' + user.maingroup + '/' + user.group , 'logs': []});
            }
        }

        await utils.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'User info modification: ' + req.params.id , 'logs': [user.uid + '.' + fid + '.update']});
        let users_in_group = await utils.mongo_users().find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}).toArray();
        if(users_in_group && users_in_group.length == 0){
            let oldgroup = await utils.mongo_groups().findOne({name: user.oldgroup});
            if(oldgroup){
                router.delete_group(oldgroup, session_user.uid);
            }
        }

        user.fid = fid;
        if(user.oldemail!=user.email && !user.is_fake) {
            notif.modify(user.oldemail, user.email, function() {
                res.send(user);
            });
        } else if(userWasFake && !user.is_fake) {
            notif.add(user.email, function() {
                res.send(user);
            });
        }else if (!userWasFake && user.is_fake) {
            notif.remove(user.email, function(){
                res.send(user);
            });
        } else {
            res.send(user);
        }
    }
    else {
        await utils.mongo_users().replaceOne({_id: user._id}, user);
        await utils.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'Update user info ' + req.params.id , 'logs': []});
        let users_in_group = await utils.mongo_users().find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}).toArray();
        if(users_in_group && users_in_group.length == 0){
            let oldgroup = await utils.mongo_groups().findOne({name: user.oldgroup});
            if(oldgroup){
                await router.delete_group(oldgroup, session_user.uid);
            }
        }
        user.fid = null;
        res.send(user);
    }
});

router.get('/project/:id/users', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let users_in_project = await utils.mongo_users().find({'projects': req.params.id}).toArray();
    res.send(users_in_project);
    res.end();
});

var add_user_to_project = async function (newproject, uid, action_owner) {
    logger.info('Adding user ' + uid + ' to project ' + newproject);

    let fid = new Date().getTime();
    let user = await utils.mongo_users().findOne({uid: uid});
    if(!user) {
        throw {code: 404, message: 'User does not exist'};
    }
    if (!user.projects){
        user.projects = [];
    }
    for(let g=0; g < user.projects.length; g++){
        if(newproject == user.projects[g]) {
            throw {code: 208, message: 'User is already in project : nothing was done.'};
        }
    }
    user.projects.push(newproject);
    try {
        await utils.mongo_users().updateOne({_id: user._id}, {'$set': { projects: user.projects}});
    } catch(err) {
        throw {code: 500, message: 'Could not update user'};
    }

    try {
        let created_file = await filer.project_add_user_to_project({id: newproject}, user, fid);
        logger.info('File Created: ', created_file);
        await utils.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'add user ' + uid + ' to project ' + newproject , 'logs': [created_file]});
    } catch(error){
        logger.error(error);
        throw {code: 500, message:'Add User to Project Failed for: ' + newproject};
    }

    let project = await utils.mongo_projects().findOne({id:newproject});
    let msg_destinations = [user.email];
    let owner = await utils.mongo_users().findOne({uid:project.owner});
    if (owner) {
        msg_destinations.push(owner.email);
    }

    try {
        await utils.send_notif_mail({
            'name': 'add_to_project',
            'destinations': msg_destinations,
            'subject': 'account ' + user.uid + ' added to project : ' + project.id
        }, {
            '#UID#': user.uid,
            '#NAME#': project.id,
            '#SIZE#': project.size,
            '#DESC#': project.description,
            '#PATH#': project.path
        });
    } catch(error) {
        logger.error(error);
    }

    if (CONFIG.project === undefined || CONFIG.project.enable_group) {
        try {
            await add_user_to_group(user.uid, project.group, action_owner);
        } catch (error) {
            logger.error(error);
            // as it may throw any 20* http ok code...
            if (!error.code || error.code >= 300) {
                throw {code: 500, message:'Add User to group;' + project.group + ' Failed for project: ' + project.id};
            }
        }
    }
};

router.post('/user/:id/project/:project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.project])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!session_user || GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        res.end();
        return;
    }

    let newproject = req.params.project;
    let uid = req.params.id;

    try {
        await add_user_to_project(newproject, uid, session_user.uid);
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
    if(! utils.sanitizeAll([req.params.id, req.params.project])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(!session_user || GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        res.end();
        return;
    }
    let oldproject = req.params.project;
    let uid = req.params.id;
    let fid = new Date().getTime();
    let user = await utils.mongo_users().findOne({uid: uid});
    if(! user) {
        res.status(404).send({message: 'User ' + uid + ' not found'});
        res.end();
        return;
    }
    let project = await utils.mongo_projects().findOne({id:oldproject});
    if(!project){
        logger.info('project not found', oldproject);
        res.status(500).send({message: 'Error, project not found'});
        res.end();
        return;
    }
    if(uid === project.owner && ! req.query.force){
        res.status(403).send({message: 'Cannot remove project owner. Please change the owner before deletion'});
        res.end();
        return;
    }
    let tempprojects = [];
    for(let g=0; g < user.projects.length; g++){
        if(oldproject != user.projects[g]) {
            tempprojects.push(user.projects[g]);
        }
    }
    try {
        await utils.mongo_users().updateOne({_id: user._id}, {'$set': { projects: tempprojects}});
    } catch(err) {
        res.status(403).send({message: 'Could not update user'});
        res.end();
        return;
    }
    try {
        let created_file = await filer.project_remove_user_from_project(project, user, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Remove User from Project Failed for: ' + oldproject, error);
        res.status(500).send({message: 'Remove from Project Failed'});
        return;
    }

    await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove user ' + req.params.id + ' from project ' + oldproject , 'logs': []});
    res.send({message: 'User removed from project', fid: fid});
    res.end();
});

router.get('/list/:list', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.list])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(!session_user || GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let list_name = req.params.list;
    notif.getMembers(list_name, function(members) {
        res.send(members);
        return;
    });
});


router.get('/lists', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(!session_user || GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    notif.getLists(function(listOfLists) {
        res.send(listOfLists);
        return;
    });
});

module.exports = router;
