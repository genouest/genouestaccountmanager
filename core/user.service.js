const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const CONFIG = require('config')

const goldap = require('../core/goldap.js');
const utils = require('../core/utils.js');
const filer = require('../core/file.js');

const grpsrv = require('../core/group.service.js')

/* TODO : find somewhere smart to put this */
const STATUS_PENDING_EMAIL = 'Waiting for email approval';
const STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
const STATUS_ACTIVE = 'Active';
const STATUS_EXPIRED = 'Expired';

// module exports
exports.get_user_home = get_user_home;
// exports.create_extra_user = create_extra_user; // todo check exports is needed
exports.create_admin = create_admin;
exports.add_user_to_group = add_user_to_group;
exports.add_user_to_project = add_user_to_project;
exports.delete_user = delete_user;


// module functions
function get_user_home(user) {
    // todo check  or not if user.uid exist
    let user_home = CONFIG.general.home + '/' + user.uid;
    if(CONFIG.general.use_group_in_path) {
        user_home = grpsrv.get_group_home(user) + '/' + user.uid;
    }
    return user_home.replace(/\/+/g, '/');
}


// todo should be factorysed with "normal" user creation
async function create_extra_user(user_name, group, internal_user){
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


async function create_admin(default_admin, default_admin_group){
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
            let group = await grpsrv.create_group(default_admin_group, default_admin);
            logger.info('admin group created', group);
            let user = await create_extra_user(default_admin, group, true);
            logger.info('admin user created', user);
        }
    }
};


async function add_user_to_group(uid, secgroup, action_owner) {
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


async function add_user_to_project(newproject, uid, action_owner) {
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

async function delete_user(user, action_owner_id, message){
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

    grpsrv.clear_user_groups(user, action_owner_id);

    await utils.mongo_events().insertOne({
        'owner': action_owner_id,
        'date': new Date().getTime(),
        'action': 'delete user ' + user.uid ,
        'logs': [user.uid + '.' + fid + '.update']
    });

    let msg_destinations =  [CONFIG.general.accounts];
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
