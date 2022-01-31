const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const axios = require('axios');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const filer = require('../core/file.js');
const maisrv = require('../core/mail.service.js');
const idsrv = require('../core/id.service.js');
const { token } = require('morgan');
const { response } = require('express');

let day_time = 1000 * 60 * 60 * 24;

exports.create_project = create_project;
exports.remove_project = remove_project;
exports.update_project = update_project;
exports.create_project_request = create_project_request;
exports.remove_project_request = remove_project_request;
exports.auth_from_opidor = auth_from_opidor;
exports.opidor_token_refresh = opidor_token_refresh;

async function create_project(new_project, uuid, action_owner) {
    logger.info('Create Project ' + new_project.id + ' uuid ' + uuid);
    new_project.created_at = new Date().getTime();
    if (!new_project.expire) {
        new_project.expire = new Date().getTime() + CONFIG.project.default_expire * day_time;
    }
    await dbsrv.mongo_projects().insertOne(new_project);
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_add_project(new_project, fid);
        logger.debug('Created file', created_file);
    } catch (error) {
        logger.error('Add Project Failed for: ' + new_project.id, error);
        throw { code: 500, message: 'Add Project Failed' };
    }

    await dbsrv.mongo_pending_projects().deleteOne({ uuid: uuid });
    await dbsrv.mongo_events().insertOne({ 'owner': action_owner, 'date': new Date().getTime(), 'action': 'new project creation: ' + new_project.id, 'logs': [] });
}

async function remove_project(id, action_owner) {
    logger.info('Remove Project ' + id);
    await dbsrv.mongo_projects().deleteOne({ 'id': id });
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_delete_project({ 'id': id }, fid);
        logger.debug('Created file', created_file);
    } catch (error) {
        logger.error('Delete Project Failed for: ' + id, error);
        throw { code: 500, message: 'Delete Project Failed' };
    }

    await dbsrv.mongo_events().insertOne({ 'owner': action_owner, 'date': new Date().getTime(), 'action': 'remove project ' + id, 'logs': [] });

}

async function update_project(id, project, action_owner) {
    logger.info('Update Project ' + id);
    await dbsrv.mongo_projects().updateOne({ 'id': id }, { '$set': project });
    let fid = new Date().getTime();
    project.id = id;
    try {
        let created_file = await filer.project_update_project(project, fid);
        logger.debug('Created file', created_file);
    } catch (error) {
        logger.error('Update Project Failed for: ' + project.id, error);
        throw { code: 500, message: 'Update Project Failed' };
    }

    await dbsrv.mongo_events().insertOne({ 'owner': action_owner, 'date': new Date().getTime(), 'action': 'update project ' + project.id, 'logs': [] });

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

    let msg_destinations = [CONFIG.general.accounts, user.email];

    try {
        await maisrv.send_notif_mail({
            'name': 'ask_project',
            'destinations': msg_destinations,
            'subject': 'Project creation request: ' + asked_project.id
        }, {
            '#UID#': user.uid,
            '#NAME#': asked_project.id,
            '#SIZE#': asked_project.size,
            '#CPU#': asked_project.cpu,
            '#ORGA#': asked_project.orga,
            '#DESC#': asked_project.description
        });
    } catch (error) {
        logger.error(error);
    }
}


async function remove_project_request(uuid, action_owner) {
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
        throw { code: 404, message: 'No pending project found' };
    }

}
async function auth_from_opidor() {
    const data = {

        "grant_type": "client_credentials",

        "client_id": "b00dadbf-f8c8-422f-9a81-ae798c527613",

        "client_secret": "12bc248b-5875-4cb6-9fe9-ec083cfda000"

    };

    const options = {
        headers: {
            "Content-Type": "application/json",
            accept: "application/json",
        }
    };
    let response_data = null;
    await axios.post('https://opidor-preprod.inist.fr/api/v1/authenticate', data, options).then((response) => {
        response_data = response.data;
    }, (error) => {
        return error;
    });
    console.log(response_data);
    return response_data;
}

async function opidor_token_refresh() {
    let redis_client = idsrv.redis();
    console.log('get tokens');
    let token = null;
    let expiration = null;
    let current_time = Math.floor((new Date()).getTime() / 1000);
    redis_client.get('my:dmp:token', function (err, value){
        if (err) {
            console.log("no token saved")
            token = null;
        }
        else {
            console.log("token saved!")
            token = value;
        }
    });

    redis_client.get('my:dmp:expiration', function (err, value){
        if (err) {
            expiration = null;
        }
        else {
            expiration = value;
        }
    });
    console.log("---");
    console.log(token);
    if (token != null && expiration != null && expiration > current_time) {
        console.log('tokens were found!');
        console.log(expiration);
    }
    else {
        console.log('tokens were not valid');
        auth_from_opidor().then(response => {
            let resp = response;
            console.log(resp);
            token = resp.access_token;
            console.log("token:")
            console.log(token);
            console.log("expires:")
            console.log(resp.expires_in);
            // redis_client.set('my:dmp:token', token);
            // redis_client.set('my:dmp:expiration', resp.expires_in);
        })
            .catch(error => {
                console.log('ERROR');
                console.log(error);
                return error;
            });
    }
    return token;
}