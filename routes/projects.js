var express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];

// var cookieParser = require('cookie-parser');
// var goldap = require('../routes/goldap.js');

const filer = require('../routes/file.js');
var notif = require('../routes/notif_'+MAILER+'.js');
var utils = require('./utils');

router.get('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        if (! user.projects) {
            res.send([]);
            return;
        } else {
            let projects = await utils.mongo_projects().find({id: {$in : user.projects}}).toArray();
            res.send(projects);
            return;
        }
    } else {
        if (req.query.all === 'true'){
            let projects = await utils.mongo_projects().find({}).toArray();
            res.send(projects);
            return;
        } else {
            if (! user.projects) {
                res.send([]);
                return;
            } else {
                let projects = await utils.mongo_projects().find({id: {$in : user.projects}}).toArray();
                res.send(projects);
                return;
            }
        }
    }
});

router.get('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Admin only');
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});

    if (! project){
        logger.error('failed to get project', req.params.id);
        res.status(404).send('Project ' + req.params.id + ' not found');
        return;
    }
    res.send(project);
});

router.post('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.body.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
    }
    let owner = await utils.mongo_users().findOne({'uid': req.body.owner});
    if(!owner){
        res.status(404).send('Owner not found');
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.body.id});
    if(project){
        res.status(403).send('Not authorized or project already exists');
        return;
    }
    let new_project = {
        'id': req.body.id,
        'owner': req.body.owner,
        'group': req.body.group,
        'size': req.body.size,
        'expire': req.bodyexpire,
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
    } catch(error) {
        logger.error('Add Project Failed for: ' + new_project.id, error);
        res.status(500).send('Add Project Failed');
        return;
    }
    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'new project creation: ' + req.body.id , 'logs': []});
    res.send({'message': 'Project created'});
    return;
});

router.delete('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
    }
    await utils.mongo_projects().deleteOne({'id': req.params.id});
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_delete_project({'id': req.params.id}, fid);
        logger.debug('Created file', created_file);
    } catch(error){
        logger.error('Delete Project Failed for: ' + req.params.id, error);
        res.status(500).send('Delete Project Failed');
        return;
    }

    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'remove project ' + req.params.id , 'logs': []});

    res.send({'message': 'Project deleted'});

});

router.post('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(401).send('Not authorized or project not found');
        return;
    }
    let new_project = { '$set': {
        'owner': req.body.owner,
        'group': req.body.group,
        'size': req.body.size,
        'expire': req.body.expire,
        'description': req.body.description,
        'access': req.body.access,
        'orga': req.body.orga,
        'path': req.body.path
    }};
    await utils.mongo_projects().updateOne({'id': req.params.id}, new_project);
    let fid = new Date().getTime();
    new_project.id =  req.params.id;
    try {
        let created_file = await filer.project_update_project(new_project, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Update Project Failed for: ' + new_project.id, error);
        res.status(500).send('Add Project Failed');
        return;
    }

    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'update project ' + req.params.id , 'logs': []});
    res.send({'message': 'Project updated'});
});

router.post('/project/:id/request', async function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(404).send('Project ' + req.params.id + ' not found');
        return;
    }
    //Add to request list
    if(! user.uid === project.owner ){
        res.status(401).send('User ' + user.uid + ' is not project manager for project ' + project.id);
        return;
    }
    let newuser = await utils.mongo_users().findOne({'uid': req.body.user});
    if(!newuser){
        res.status(404).send('User ' + req.body.user + ' not found');
        return;
    }
    if(newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.body.request === 'add'){
        res.status(403).send('User ' + req.body.user + ' is already in project : cannot add');
        return;
    }
    //Backward compatibility
    if (! project.add_requests){
        project.add_requests = [];
    }
    if (! project.remove_requests){
        project.remove_requests = [];
    }
    if ( project.add_requests.indexOf(req.body.user) >= 0 || project.remove_requests.indexOf(req.body.user) >= 0){
        res.status(403).send('User ' + req.body.user + 'is already in a request : aborting');
        return;
    }
    if (req.body.request === 'add'){
        project.add_requests.push(req.body.user);
    } else if (req.body.request === 'remove') {
        project.remove_requests.push(req.body.user);
    }
    let new_project = { '$set': {
        'add_requests': project.add_requests,
        'remove_requests': project.remove_requests
    }};
    await utils.mongo_projects().updateOne({'id': req.params.id}, new_project);
    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'received request ' + req.body.request + ' for user ' + req.body.uid + ' in project ' + project.id , 'logs': []});
    res.send({'message': 'Request sent'});
});

//Admin only, remove request
router.put('/project/:id/request', async function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(401).send('Not authorized or project not found');
        return;
    }
    if (! req.body.user || ! req.body.request){
        res.status(403).send('User and request type are needed');
        return;
    }
    let temp_requests = [];
    if(req.body.request === 'add' ){
        for(let i=0;i<project.add_requests.length;i++){
            if( project.add_requests[i] !== req.body.user ){
                temp_requests.push(project.add_requests[i]);
            }
        }
        project.add_requests = temp_requests;
    } else if (req.body.request === 'remove' ){
        for(let i=0;i<project.remove_requests.length;i++){
            if( project.remove_requests[i] !== req.body.user){
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
    res.send({'message': 'Request removed'});
});

//Return all projects using this group
router.get('/group/:id/projects', async function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
    }
    let projects_with_group = await utils.mongo_projects().find({'group': req.params.id}).toArray();
    res.send(projects_with_group);
    res.end();
});

router.post('/ask/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
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
    let msg_destinations =  [GENERAL_CONFIG.accounts, user.email];

    let msg_ask = CONFIG.message.ask_project.join('\n')
        .replace(/#UID#/g, user.uid)
        .replace(/#NAME#/g, req.body.id)
        .replace(/#SIZE#/g, req.body.size)
        .replace(/#ORGA#/g, req.body.orga)
        .replace(/#DESC#/g, req.body.description)
        + '\n' + CONFIG.message.footer.join('\n');
    let msg_ask_html = CONFIG.message.ask_project_html.join('')
        .replace(/#UID#/g, user.uid)
        .replace(/#NAME#/g, req.body.id)
        .replace(/#SIZE#/g, req.body.size)
        .replace(/#ORGA#/g, req.body.orga)
        .replace(/#DESC#/g, req.body.description)
        + '<br/>' + CONFIG.message.footer_html.join('<br/>');

    let mailOptions = {
        origin: MAIL_CONFIG.origin, // sender address
        destinations:  msg_destinations, // list of receivers
        subject: 'Project creation request: ' + req.body.id, // Subject line
        message: msg_ask, // plaintext body
        html_message: msg_ask_html // html body
    };

    // logger.info(mailOptions);

    if(notif.mailSet()) {
        // eslint-disable-next-line no-unused-vars
        await notif.sendUser(mailOptions);
    }

    res.end();
    return;
});

module.exports = router;
