// const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const goldap = require('../core/goldap.js');
const dbsrv = require('../core/db.service.js');
const idsrv = require('../core/id.service.js');
const filer = require('../core/file.js');
const usrsrv = require('../core/user.service.js');

// module exports
exports.get_group_home = get_group_home; // todo : move this one in users.services ? or not
exports.create_group = create_group;
exports.delete_group = delete_group;
exports.clear_user_groups = clear_user_groups; // todo : move this one in users.services ? or not
exports.remove_from_group = remove_from_group;

// module functions

// remove a user from a secondary group
async function remove_from_group(uid, secgroup) {
    let user = await dbsrv.mongo_users().findOne({uid: uid});
    if(secgroup == user.group) {
        throw 'Group is user main\'s group: '+user.group;
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
        throw 'group is not set';
    }
    user.secondarygroups = newgroup;
    let fid = new Date().getTime();
    // Now add group
    await goldap.change_user_groups(user, [], [secgroup], fid);
    try {
        await dbsrv.mongo_users().updateOne({_id: user._id}, {'$set': { secondarygroups: user.secondarygroups}});
    } catch(err) {
        throw 'Could not update user';
    }

    try {
        let created_file = await filer.user_change_group(user, [], [secgroup], fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Group Change Failed for: ' + user.uid, error);
        throw 'Change Group Failed';
    }
}


function get_group_home(user) {
    let group_path = CONFIG.general.home+'/' + user.group;
    if(user.maingroup!='' && user.maingroup!=null) {
        group_path = CONFIG.general.home+'/' + user.maingroup+'/' + user.group;
    }
    return group_path.replace(/\/+/g, '/');
}


async function create_group(group_name, owner_name, action_owner = 'auto', add_owner=true) {
    let mingid = await idsrv.getGroupAvailableId();
    let fid = new Date().getTime();
    let group = {name: group_name, gid: mingid, owner: owner_name};
    try {
        await dbsrv.mongo_groups().insertOne(group);
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

    await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'create group ' + group_name , 'logs': [group_name + '.' + fid + '.update']});

    try {
        if (group.owner && add_owner) {
            await usrsrv.add_user_to_group(group.owner, group.name);
        }
    } catch(error) {
        logger.error(error);
    }
    return group;

}


async function delete_group(group, action_owner = 'auto') {
    await dbsrv.mongo_groups().deleteOne({'name': group.name});
    if (CONFIG.general.prevent_reuse === undefined || CONFIG.general.prevent_reuse) {
        await dbsrv.mongo_oldgroups().insertOne({
            'name': group.name
        });
    }
    let fid = new Date().getTime();
    await goldap.delete_group(group, fid);
    try {
        let created_file = await filer.user_delete_group(group, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Delete Group Failed for: ' + group.name, error);
        return false;
    }

    await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name + '.' + fid + '.update']});
    await idsrv.freeGroupId(group.gid);
    return true;
}


async function clear_user_groups(user, action_owner = 'auto') {
    let allgroups = user.secondarygroups ? user.secondarygroups : [];
    if (user.group && user.group != '') {
        allgroups.push(user.group);
    }
    for(let i=0;i < allgroups.length;i++){
        let group = await dbsrv.mongo_groups().findOne({name: allgroups[i]});
        if(group){
            let users_in_group = await dbsrv.mongo_users().find({'$or': [{'secondarygroups': group.name}, {'group': group.name}]}).toArray();
            if(users_in_group && users_in_group.length == 0){
                delete_group(group, action_owner);
            }
        }
    }
}
