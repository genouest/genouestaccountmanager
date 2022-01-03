const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const filer = require('../core/file.js');
const maisrv = require('../core/mail.service.js');
const usrsrv = require('../core/user.service.js');

let day_time = 1000 * 60 * 60 * 24;

exports.create_project = create_project;
exports.remove_project = remove_project;
exports.update_project = update_project;
exports.create_project_request = create_project_request;
exports.remove_project_request = remove_project_request;

async function create_project(new_project, uuid, action_owner = 'auto') {
    logger.info('Create Project ' + new_project.id + ' uuid ' + uuid);
    new_project.created_at = new Date().getTime();
    if (!new_project.expire) {
        new_project.expire = new Date().getTime() + CONFIG.project.default_expire * day_time;
    }
    if (!new_project.size) {
        new_project.size = CONFIG.project.default_size;
    }
    if (!new_project.path) {
        new_project.path = CONFIG.project.default_path + '/' + new_project.id;
    }
    await dbsrv.mongo_projects().insertOne(new_project);
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_add_project(new_project, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Add Project Failed for: ' + new_project.id, error);
        throw {code: 500, message: 'Add Project Failed'};
    }

    if (uuid) {
        await dbsrv.mongo_pending_projects().deleteOne({ uuid: uuid });
    }
    await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'new project creation: ' + new_project.id , 'logs': []});

    try {
        if (new_project.owner) {
            await usrsrv.add_user_to_project(new_project.id, new_project.owner);
        }
    }
    catch(error) {
        logger.error(error);
    }
    return new_project;
}

async function remove_project(id, action_owner = 'auto') {
    logger.info('Remove Project ' + id);
    await dbsrv.mongo_projects().deleteOne({'id': id});
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_delete_project({'id': id}, fid);
        logger.debug('Created file', created_file);
    } catch(error){
        logger.error('Delete Project Failed for: ' + id, error);
        throw {code: 500, message: 'Delete Project Failed'};
    }

    await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'remove project ' + id , 'logs': []});

}

async function update_project(id, project, action_owner = 'auto') {
    logger.info('Update Project ' + id);
    project.expiration_notif = 0;
    await dbsrv.mongo_projects().updateOne({'id': id},  {'$set': project});
    let fid = new Date().getTime();
    project.id =  id;
    try {
        let created_file = await filer.project_update_project(project, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Update Project Failed for: ' + project.id, error);
        throw {code: 500, message: 'Update Project Failed'};
    }

    await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'update project ' + project.id , 'logs': []});

}

async function create_project_request(asked_project, user) {
    logger.info('Create Project Request' + asked_project.id + ' for ' + user.uid);
    asked_project.uuid = (new Date().getTime()).toString();

    await dbsrv.mongo_pending_projects().insertOne(asked_project);
    await dbsrv.mongo_events().insertOne({
        owner: user.uid,
        date: new Date().getTime(),
        action: 'new pending project creation: ' + asked_project.id,
        logs: [],
    });

    let msg_destinations =  [CONFIG.general.accounts, user.email];
    if (user.send_copy_to_support) {
        msg_destinations.push(CONFIG.general.support);
    }

    try {
        await maisrv.send_notif_mail({
            'name': 'ask_project',
            'destinations': msg_destinations,
            'subject': 'Project creation request: ' + asked_project.id
        }, {
            '#UID#':  user.uid,
            '#NAME#': asked_project.id,
            '#SIZE#': asked_project.size,
            '#CPU#': asked_project.cpu,
            '#ORGA#': asked_project.orga,
            '#DESC#': asked_project.description
        });
    } catch(error) {
        logger.error(error);
    }
}


async function remove_project_request(uuid, action_owner = 'auto') {
    logger.info('Remove Project Request' + uuid);
    const result = await dbsrv.mongo_pending_projects().deleteOne({ uuid: uuid });
    if (result.deletedCount === 1) {
        await dbsrv.mongo_events().insertOne({
            owner: action_owner,
            date: new Date().getTime(),
            action: 'remove Pending project ' + uuid,
            logs: [],
        });
    }
    else {
        throw {code: 404, message: 'No pending project found'};
    }

}
