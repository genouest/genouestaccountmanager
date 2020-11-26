import { environment } from '../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
var express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const conf = require('../routes/conf.js');
var CONFIG = conf.get_conf();
var GENERAL_CONFIG = CONFIG.general;

// var cookieParser = require('cookie-parser');
// var goldap = require('../routes/goldap.js');

const filer = require('../routes/file.js');
var utils = require('./utils');

let day_time = 1000 * 60 * 60 * 24;

router.get('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if (GENERAL_CONFIG.admin.indexOf(user.uid) < 0) {
        if (!user.projects) {
            res.send([]);
            return;
        } else {
            let projects = await utils.mongo_projects().find({ id: { $in: user.projects } }).toArray();
            res.send(projects);
            return;
        }
    } else {
        if (req.query.all === 'true') {
            let projects = await utils.mongo_projects().find({}).toArray();
            res.send(projects);
            return;
        } else {
            if (!user.projects) {
                res.send([]);
                return;
            } else {
                let projects = await utils.mongo_projects().find({ id: { $in: user.projects } }).toArray();
                res.send(projects);
                return;
            }
        }
    }
});

router.get('/project/:id', async function(req, res){
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
        res.status(401).send({message: 'Admin only'});
        return;
    }
    let project = await utils.mongo_projects().findOne({ 'id': req.params.id });

    if (!project) {
        logger.error('failed to get project', req.params.id);
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }
    res.send(project);
});

router.post('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.body.id])) {
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
    let owner = await utils.mongo_users().findOne({'uid': req.body.owner});
    if(!owner){
        res.status(404).send({message: 'Owner not found'});
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.body.id});
    if(project){
        res.status(403).send({message: 'Not authorized or project already exists'});
        return;
    }
    let new_project = {
        'id': req.body.id,
        'owner': req.body.owner,
        'group': req.body.group,
        'size': req.body.size,
        'expire': (req.body.expire) ? req.body.expire : new Date().getTime() + CONFIG.project.default_expire * day_time,
        'description': req.body.description,
        'path': req.body.path,
        'orga': req.body.orga,
        'access': req.body.access
    };
    await utils.mongo_projects().insertOne(new_project);
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_add_project(new_project, fid);
        logger.debug('Created file', created_file);
    } catch (error) {
        logger.error('Add Project Failed for: ' + new_project.id, error);
        res.status(500).send({message: 'Add Project Failed'});
        return;
    }
    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'new project creation: ' + req.body.id , 'logs': []});
    res.send({message: 'Project created'});
    return;
});

router.delete('/project/:id', async function(req, res){
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
    await utils.mongo_projects().deleteOne({ 'id': req.params.id });
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_delete_project({ 'id': req.params.id }, fid);
        logger.debug('Created file', created_file);
    } catch (error) {
        logger.error('Delete Project Failed for: ' + req.params.id, error);
        res.status(500).send({message: 'Delete Project Failed'});
        return;
    }

    await utils.mongo_events().insertOne({ 'owner': user.uid, 'date': new Date().getTime(), 'action': 'remove project ' + req.params.id, 'logs': [] });

    res.send({message: 'Project deleted'});

});

router.post('/project/:id', async function(req, res){
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
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(401).send({message: 'Not authorized or project not found'});
        return;
    }
    let new_project = { '$set': {
        'owner': req.body.owner,
        'group': req.body.group,
        'size': req.body.size,
        'expire': (req.body.expire) ? req.body.expire : new Date().getTime() +  CONFIG.project.default_expire * day_time,
        'description': req.body.description,
        'access': req.body.access,
        'orga': req.body.orga,
        'path': req.body.path
    }};
    await utils.mongo_projects().updateOne({'id': req.params.id}, new_project);
    let fid = new Date().getTime();
    new_project.id = req.params.id;
    try {
        let created_file = await filer.project_update_project(new_project, fid);
        logger.debug('Created file', created_file);
    } catch (error) {
        logger.error('Update Project Failed for: ' + new_project.id, error);
        res.status(500).send({message: 'Add Project Failed'});
        return;
    }

    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'update project ' + req.params.id , 'logs': []});
    res.send({message: 'Project updated'});
});

router.post('/project/:id/request', async function(req, res){
    if(! req.locals.logInfo.is_logged){
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
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }
    //Add to request list
    if(! user.uid === project.owner ){
        res.status(401).send({message: 'User ' + user.uid + ' is not project manager for project ' + project.id});
        return;
    }
    let newuser = await utils.mongo_users().findOne({'uid': req.body.user});
    if(!newuser){
        res.status(404).send({message: 'User ' + req.body.user + ' not found'});
        return;
    }
    if(newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.body.request === 'add'){
        res.status(403).send({message: 'User ' + req.body.user + ' is already in project : cannot add'});
        return;
    }
    //Backward compatibility
    if (!project.add_requests) {
        project.add_requests = [];
    }
    if (!project.remove_requests) {
        project.remove_requests = [];
    }
    if ( project.add_requests.indexOf(req.body.user) >= 0 || project.remove_requests.indexOf(req.body.user) >= 0){
        res.status(403).send({message: 'User ' + req.body.user + 'is already in a request : aborting'});
        return;
    }
    if (req.body.request === 'add') {
        project.add_requests.push(req.body.user);
    } else if (req.body.request === 'remove') {
        project.remove_requests.push(req.body.user);
    }
    let new_project = {
        '$set': {
            'add_requests': project.add_requests,
            'remove_requests': project.remove_requests
        }
    };
    await utils.mongo_projects().updateOne({ 'id': req.params.id }, new_project);
    await utils.mongo_events().insertOne({ 'owner': user.uid, 'date': new Date().getTime(), 'action': 'received request ' + req.body.request + ' for user ' + req.body.user + ' in project ' + project.id, 'logs': [] });

    try {
        await utils.send_notif_mail({
            'name': 'ask_project_user',
            'destinations': [GENERAL_CONFIG.accounts],
            'subject': 'Project ' + req.body.request + ' user request: ' + req.body.user
        }, {
            '#UID#': user.uid,
            '#NAME#': project.id,
            '#USER#': req.body.user,
            '#REQUEST#': req.body.request

        });
    } catch (error) {
        logger.error(error);
    }


    res.send({message: 'Request sent'});
});

//Admin only, remove request
router.put('/project/:id/request', async function(req, res){
    if(! req.locals.logInfo.is_logged){
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
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(401).send({message: 'Not authorized or project not found'});
        return;
    }
    if (! req.body.user || ! req.body.request){
        res.status(403).send({message: 'User and request type are needed'});
        return;
    }
    let temp_requests = [];
    if (req.body.request === 'add') {
        for (let i = 0; i < project.add_requests.length; i++) {
            if (project.add_requests[i] !== req.body.user) {
                temp_requests.push(project.add_requests[i]);
            }
        }
        project.add_requests = temp_requests;
    } else if (req.body.request === 'remove') {
        for (let i = 0; i < project.remove_requests.length; i++) {
            if (project.remove_requests[i] !== req.body.user) {
                temp_requests.push(project.remove_requests[i]);
            }
        }
        project.remove_requests = temp_requests;
    }
    let new_project = { '$set': {
        'add_requests': project.add_requests,
        'remove_requests': project.remove_requests
    }};
    await utils.mongo_projects().updateOne({'id': req.params.id}, new_project);
    res.send({message: 'Request removed'});
});

//Return all projects using this group
router.get('/group/:id/projects', async function(req, res){
    if(! req.locals.logInfo.is_logged){
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
    let projects_with_group = await utils.mongo_projects().find({ 'group': req.params.id }).toArray();
    res.send(projects_with_group);
    res.end();
});

router.post('/ask/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    /* // New Project Structure :
    let new_project = {
        'id': req.body.id,
        'size': req.body.size,
        'description': req.body.description,
        'orga': req.body.orga,
    };
    */

    // logger.info(new_project);

    // todo: find a way to use cc
    let msg_destinations = [GENERAL_CONFIG.accounts, user.email];

    try {
        await utils.send_notif_mail({
            'name': 'ask_project',
            'destinations': msg_destinations,
            'subject': 'Project creation request: ' + req.body.id
        }, {
            '#UID#': user.uid,
            '#NAME#': req.body.id,
            '#SIZE#': req.body.size,
            '#ORGA#': req.body.orga,
            '#DESC#': req.body.description
        });
    } catch (error) {
        logger.error(error);
    }


    res.end();
    return;
});


router.get('/dmp/ping', async function (req, res) {
    let online = this.http.get(
        environment.opidorUrl + '/api/v1/heartbeat'
    );
    if ( online['code'] != 200) {
        res.status(404).send('Can\'t reach Opidor API');
        return;
    }
    
    let DMP_data = { error: '', ping: true };

    res.send(DMP_data);
    res.end();
});



router.post('/dmp/download', async function (req, res) {
    let online = this.http.get(
        environment.opidorUrl + '/api/v1/heartbeat'
    );
    if ( online['code'] != 200) {
        res.status(404).send('Can\'t reach Opidor API');
        return;
    }
    let httpOptions = {
        headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Accept': 'application/json'
        }
    };
    let auth_data = {'grant_type':'client_credentials','client_id':CONFIG.dmp.client_id,'client_secret':CONFIG.dmp.client_secret};
    let auth = this.http.post(
        environment.opidorUrl + '/api/v1/authenticate',
        auth_data,
        httpOptions
    );
    if ( auth['code'] != 200) {
        res.status(401).send('Not Authorized ');
        return;
    }
    httpOptions = {
        headers: auth_data
        
    };
    let DMP_data = this.http.get(
        environment.opidorUrl + '/api/v1/authenticate',
        httpOptions
    );
    if ( auth['code'] != 200) {
        res.status(401).send('Not Authorized ');
        return;
    }
    
    await utils.mongo_projects().updateOne({ 'id': req.params.id },);

    
    res.send(DMP_data);
    res.end();
});



router.post;
module.exports = router;
