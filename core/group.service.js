// const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const CONFIG = require('config');

const goldap = require('../core/goldap.js');
const dbsrv = require('../core/db.service.js');
const idsrv = require('../core/id.service.js');
const filer = require('../core/file.js');


// module exports
exports.get_group_home = get_group_home; // todo : move this one in users.services ? or not
exports.create_group = create_group;
exports.delete_group = delete_group;
exports.clear_user_groups = clear_user_groups; // todo : move this one in users.services ? or not


// module functions
function get_group_home(user) {
    let group_path = CONFIG.general.home+'/' + user.group;
    if(user.maingroup!='' && user.maingroup!=null) {
        group_path = CONFIG.general.home+'/' + user.maingroup+'/' + user.group;
    }
    return group_path.replace(/\/+/g, '/');
}


async function create_group(group_name, owner_name){
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

    await dbsrv.mongo_events().insertOne({'owner': owner_name, 'date': new Date().getTime(), 'action': 'create group ' + group_name , 'logs': [group_name + '.' + fid + '.update']});

    return group;

}


async function delete_group(group, admin_user_id){
    await dbsrv.mongo_groups().deleteOne({'name': group.name});
    let fid = new Date().getTime();
    await goldap.delete_group(group, fid);
    try {
        let created_file = await filer.user_delete_group(group, fid);
        logger.info('File Created: ', created_file);
    } catch(error){
        logger.error('Delete Group Failed for: ' + group.name, error);
        return false;
    }

    await dbsrv.mongo_events().insertOne({'owner': admin_user_id, 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name + '.' + fid + '.update']});
    await idsrv.freeGroupId(group.gid);
    return true;
}


async function clear_user_groups(user, admin_user_id){
    let allgroups = user.secondarygroups;
    if (user.group && user.group != '') {
        allgroups.push(user.group);
    }
    for(let i=0;i < allgroups.length;i++){
        let group = await dbsrv.mongo_groups().findOne({name: allgroups[i]});
        if(group){
            let users_in_group = await dbsrv.mongo_users().find({'$or': [{'secondarygroups': group.name}, {'group': group.name}]}).toArray();
            if(users_in_group && users_in_group.length == 0){
                delete_group(group, admin_user_id);
            }
        }
    }
}
