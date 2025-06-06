/* TODO : create a core/project.service.js and move all methods into it */

const express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');
const prjsrv = require('../core/project.service.js');
const usrsrv = require('../core/user.service.js');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;
 
router.get('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        if (! user.projects) {
            res.send([]);
            return;
        } else {
            let projects = await dbsrv.mongo_projects().find({id: {$in : user.projects}}).toArray();
            res.send(projects);
            return;
        }
    } else {
        if (req.query.all === 'true'){
            let projects = await dbsrv.mongo_projects().find({}).toArray();
            res.send(projects);
            return;
        } else {
            if (! user.projects) {
                res.send([]);
                return;
            } else {
                let projects = await dbsrv.mongo_projects().find({id: {$in : user.projects}}).toArray();
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
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Admin only'});
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({'id': req.params.id});

    if (! project){
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
    if(! sansrv.sanitizeAll([req.body.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let owner = await dbsrv.mongo_users().findOne({'uid': req.body.owner});
    if(!owner){
        res.status(404).send({message: 'Owner not found'});
        return;
    }

    if (!usrsrv.is_active(owner)) {
        res.status(403).send({message: 'Owner account is not active'});
        return;
    }

    let project = await dbsrv.mongo_projects().findOne({'id': req.body.id});
    if(project){
        res.status(403).send({message: 'Not authorized or project already exists'});
        return;
    }

    try {
        await prjsrv.create_project({
            'id': req.body.id,
            'owner': req.body.owner,
            'group': req.body.group,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'expire': req.body.expire,
            'description': req.body.description,
            'path': req.body.path,
            'orga': req.body.orga,
            'access': req.body.access
        }, req.body.uuid, user.uid);
    } catch(e) {
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

    res.send({message: 'Project created'});
    return;
});

router.put('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        res.end();
        return;
    }
    if(! sansrv.sanitizeAll([req.body.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        res.end();
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }
    if(!user){
        res.status(404).send({message: 'User not found'});
        res.end();
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        res.end();
        return;
    }
    let owner = await dbsrv.mongo_users().findOne({'uid': req.body.owner});
    if(!owner){
        res.status(404).send({message: 'Owner not found'});
        res.end();
        return;
    }

    let project = await dbsrv.mongo_pending_projects().findOne({'uuid': req.body.uuid});

    if (!project){
        res.status(403).send({message: 'Project does not exist'});
        res.end();
        return;
    }

    let related_project = await dbsrv.mongo_projects().findOne({'id': req.body.id});

    if(related_project && !(project.uuid == related_project.uuid)){
        res.status(403).send({message: 'A project with that name already exists'});
        res.end();
        return;
    }

    try {
        await prjsrv.edit_project({
            'id': req.body.id,
            'owner': req.body.owner,
            'group': req.body.group,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'expire': req.body.expire,
            'description': req.body.description,
            'path': req.body.path,
            'orga': req.body.orga,
            'access': req.body.access
        }, req.body.uuid, user.uid);
    } catch(e) {
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

    res.send({message: 'Project updated'});
    return;
});

router.delete('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    try {
        await prjsrv.remove_project(req.params.id, user.uid);
    } catch(e) {
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
    res.send({message: 'Project deleted'});

});

router.post('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(401).send({message: 'Not authorized or project not found'});
        return;
    }
    try {
        await prjsrv.update_project(req.params.id, {
            'owner': req.body.owner,
            'group': req.body.group,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'expire': req.body.expire,
            'description': req.body.description,
            'access': req.body.access,
            'orga': req.body.orga,
            'path': req.body.path
        }, user.uid);
    } catch(e) {
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
    res.send({message: 'Project updated'});
});

router.post('/project/:id/request/user', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }

    if((!project.manager || !project.managers.includes(user.uid)) && user.uid != project.owner) {
        res.status(401).send({message: 'User ' + user.uid + ' is not project manager for project ' + project.id});
        return;
    }
    let newuser = await dbsrv.mongo_users().findOne({'uid': req.body.user});
    if(!newuser){
        res.status(404).send({message: 'User ' + req.body.user + ' not found'});
        return;
    }
    if(newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.body.request === 'add'){
        res.status(403).send({message: 'User ' + req.body.user + ' is already in project : cannot add'});
        return;
    }

    try {
        if (req.body.request === 'add'){
            await usrsrv.add_user_to_project(project.id, req.body.user, user.uid);
        } else if (req.body.request === 'remove') {
            await usrsrv.remove_user_from_project(project.id, req.body.user, user.uid, user.is_admin, false);
        }
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

    res.send({message: req.body.request + ' ' + req.body.user + ' done'});
});


router.post('/project/:id/add/manager/:uid', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user) {
        res.status(404).send({message: 'User not found'});
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({'id': req.params.id});
    if(!project) {
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }
    if(user.uid != project.owner) {
        res.status(401).send({message: 'User ' + user.uid + ' is not the owner of project ' + project.id});
        return;
    }
    const new_manager = await dbsrv.mongo_users().findOne({'uid': req.params.uid});
    if(!new_manager) {
        res.status(404).send({message: 'User ' + req.params.uid + ' not found'});
        return;
    }
    if(!(new_manager.projects && new_manager.projects.indexOf(project.id) >= 0)) {
        res.status(403).send({message: 'User ' + req.params.uid + ' is not in project ' + project.id});
        return;
    }
    if(project.managers && project.managers.includes(new_manager.uid)) {
        res.status(403).send({message: 'User ' + req.params.uid + ' is already a manager of project ' + project.id});
        return;
    }

    try {
        if (! project.managers){
            project.managers = [];
        }
        project.managers.push(new_manager.uid);
        await dbsrv.mongo_projects().updateOne({'id': project.id},  {'$set': { 'managers': project.managers } });
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            return;
        }
    }
    res.send({message: req.body.request + ' ' + req.body.user + ' done'});
});


router.post('/project/:id/remove/manager/:uid', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user) {
        res.status(404).send({message: 'User not found'});
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({'id': req.params.id});
    if(!project) {
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }
    if(user.uid != project.owner) {
        res.status(401).send({message: 'User ' + user.uid + ' is not the owner of project ' + project.id});
        return;
    }
    const ex_manager = await dbsrv.mongo_users().findOne({'uid': req.params.uid});
    if(!ex_manager) {
        res.status(404).send({message: 'User ' + req.params.uid + ' not found'});
        return;
    }
    if(!(ex_manager.projects && ex_manager.projects.indexOf(project.id) >= 0)) {
        res.status(403).send({message: 'User ' + req.params.uid + ' is not in project ' + project.id});
        return;
    }
    if(!project.managers || !project.managers.includes(ex_manager.uid)) {
        res.status(403).send({message: 'User ' + req.params.uid + ' is not a manager of project ' + project.id});
        return;
    }

    try {
        project.managers.splice(project.managers.indexOf(ex_manager.uid), 1);
        await dbsrv.mongo_projects().updateOne({'id': project.id},  {'$set': { 'managers': project.managers } });
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            return;
        }
    }
    res.send({message: req.body.request + ' ' + req.body.user + ' done'});
});


router.post('/ask/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    if (!req.body.id) {
        res.status(403).send({'message': 'Project name empty'});
        return;
    }

    if (!req.body.description) {
        res.status(403).send({'message': 'Project description empty'});
        return;
    }

    if (req.body.description.length < 30) {
        res.status(403).send({'message': 'Project description length should at least be 30 char'});
        return;
    }

    let p = await dbsrv.mongo_projects().findOne({id: req.body.id});
    if(p) {
        res.status(403).send({'message': 'Project already exists'});
        return;
    }


    try {
        await prjsrv.create_project_request({
            'id': req.body.id,
            'owner': user.uid,
            'group': user.group,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'expire': req.body.expire,
            'description': req.body.description,
            'orga': req.body.orga
        }, user);
    } catch(e) {
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
    res.send({ message: 'Pending Project created'});
    return;
});

router.get('/pending/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (!isadmin) {
        if (!user.pending) {
            res.send([]);
            return;
        } else {
            let pendings = await dbsrv.mongo_pending_projects().find({ id: { $in: user.pending } }).toArray();
            res.send(pendings);
            return;
        }
    } else {
        if (req.query.all === 'true') {
            let pendings = await dbsrv.mongo_pending_projects().find({}).toArray();
            res.send(pendings);
            return;
        } else {
            if (!user.pending) {
                res.send([]);
                return;
            } else {
                let pendings = await dbsrv.mongo_pending_projects().find({ id: { $in: user.pending } }).toArray();
                res.send(pendings);
                return;
            }
        }
    }
});

router.delete('/pending/project/:uuid', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (!isadmin) {
        res.status(401).send('Not authorized');
        return;
    }

    let mail_message = '';
    let mail_send = false;
    if (req.body.message) {
        mail_message = req.body.message;
    }
    if (req.body.sendmail) {
        mail_send = req.body.sendmail;
    }

    try {
        await prjsrv.remove_project_request(req.params.uuid, user.uid, mail_message, mail_send);
    } catch(e) {
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
    res.send({ message: 'Pending Project deleted'});

});

router.get('/project/:id/users', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = null;
    let isadmin = false;

    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    if (!user.projects) {
        user.projects = [];
    }

    if (user.projects.includes(req.params.id) || isadmin) {

        let users_in_project = await dbsrv.mongo_users().find({'projects': req.params.id}).toArray();
        res.send(users_in_project);
        res.end();
        return;
    }
    res.status(401).send({message: 'Not authorized'});
});


router.get('/project/:id/extend', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    let project = await dbsrv.mongo_projects().findOne({'id': req.params.id});
    if (! project){
        logger.error('failed to get project', req.params.id);
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }

    if(!isadmin && user.uid != project.owner){
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    if (CONFIG.project && CONFIG.project.allow_extend) {
        let expiration = new Date().getTime() + 360 * 1000 * 60 * 60 * 24; // one year

        await dbsrv.mongo_projects().updateOne({id: project.id},{'$set': {expire: expiration}});

        res.send({message: 'validity period extended', expiration: expiration});
        res.end();
    }
    return;


});

router.post;
module.exports = router;
