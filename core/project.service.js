const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const crypto = require('crypto');

const CONFIG = require('config');

const goldap = require('../core/goldap.js');
const dbsrv = require('../core/db.service.js');
const filer = require('../core/file.js');

const grpsrv = require('../core/group.service.js');

let day_time = 1000 * 60 * 60 * 24;

exports.create_project = create_project;
exports.remove_project = remove_project;
exports.update_project = update_project;

async function create_project(new_project, uuid, action_owner) {
    new_project.created_at = new Date().getTime();
    if (!new_project.expire) {
        new_project.expire = new Date().getTime() + CONFIG.project.default_expire * day_time;
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

    await dbsrv.mongo_pending_projects().deleteOne({ uuid: uuid });
    await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'new project creation: ' + new_project.id , 'logs': []});
}

async function remove_project(id, action_owner) {
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

async function update_project(id, project, action_owner) {
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
