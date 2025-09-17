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

router.get('/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        if (!user.projects) {
            return res.send([]);
        } else {
            let projects = await dbsrv
                .mongo_projects()
                .find({ id: { $in: user.projects } })
                .toArray();
            return res.send(projects);
        }
    } else {
        if (req.query.all === 'true') {
            let projects = await dbsrv.mongo_projects().find({}).toArray();
            return res.send(projects);
        } else {
            if (!user.projects) {
                return res.send([]);
            } else {
                let projects = await dbsrv
                    .mongo_projects()
                    .find({ id: { $in: user.projects } })
                    .toArray();
                return res.send(projects);
            }
        }
    }
});

router.get('/project/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Admin only' });
    }
    let project = await dbsrv.mongo_projects().findOne({ id: req.params.id });

    if (!project) {
        logger.error('failed to get project', req.params.id);
        return res.status(404).send({ message: 'Project ' + req.params.id + ' not found' });
    }
    return res.send(project);
});

router.post('/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.body.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let owner = await dbsrv.mongo_users().findOne({ uid: req.body.owner });
    if (!owner) {
        return res.status(404).send({ message: 'Owner not found' });
    }

    if (!usrsrv.is_active(owner)) {
        return res.status(403).send({ message: 'Owner account is not active' });
    }

    let project = await dbsrv.mongo_projects().findOne({ id: req.body.id });
    if (project) {
        return res.status(403).send({ message: 'Not authorized or project already exists' });
    }

    try {
        await prjsrv.create_project(
            {
                id: req.body.id,
                owner: req.body.owner,
                group: req.body.group,
                size: req.body.size,
                cpu: req.body.cpu,
                expire: req.body.expire,
                description: req.body.description,
                path: req.body.path,
                orga: req.body.orga,
                access: req.body.access
            },
            req.body.uuid,
            user.uid
        );
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }

    return res.send({ message: 'Project created' });
});

router.put('/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.body.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let owner = await dbsrv.mongo_users().findOne({ uid: req.body.owner });
    if (!owner) {
        return res.status(404).send({ message: 'Owner not found' });
    }

    let project = await dbsrv.mongo_pending_projects().findOne({ uuid: req.body.uuid });

    if (!project) {
        return res.status(403).send({ message: 'Project does not exist' });
    }

    let related_project = await dbsrv.mongo_projects().findOne({ id: req.body.id });

    if (related_project && !(project.uuid == related_project.uuid)) {
        return res.status(403).send({ message: 'A project with that name already exists' });
    }

    try {
        await prjsrv.edit_project(
            {
                id: req.body.id,
                owner: req.body.owner,
                group: req.body.group,
                size: req.body.size,
                cpu: req.body.cpu,
                expire: req.body.expire,
                description: req.body.description,
                path: req.body.path,
                orga: req.body.orga,
                access: req.body.access
            },
            req.body.uuid,
            user.uid
        );
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }

    return res.send({ message: 'Project updated' });
});

router.delete('/project/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    try {
        await prjsrv.remove_project(req.params.id, user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }
    return res.send({ message: 'Project deleted' });
});

router.post('/project/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let project = await dbsrv.mongo_projects().findOne({ id: req.params.id });
    if (!project) {
        return res.status(401).send({ message: 'Not authorized or project not found' });
    }
    try {
        await prjsrv.update_project(
            req.params.id,
            {
                owner: req.body.owner,
                group: req.body.group,
                size: req.body.size,
                cpu: req.body.cpu,
                expire: req.body.expire,
                last_extended: req.body.last_extended,
                description: req.body.description,
                access: req.body.access,
                orga: req.body.orga,
                path: req.body.path
            },
            user.uid
        );
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }
    return res.send({ message: 'Project updated' });
});

router.post('/project/:id/request/user', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    let project = await dbsrv.mongo_projects().findOne({ id: req.params.id });
    if (!project) {
        return res.status(404).send({ message: 'Project ' + req.params.id + ' not found' });
    }
    if ((!project.managers || !project.managers.includes(user.uid)) && user.uid != project.owner) {
        return res.status(401).send({ message: 'User ' + user.uid + ' is not project manager for project ' + project.id });
    }
    let newuser = await dbsrv.mongo_users().findOne({ uid: req.body.user });
    if (!newuser) {
        return res.status(404).send({ message: 'User ' + req.body.user + ' not found' });
    }
    if (newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.body.request === 'add') {
        return res.status(403).send({ message: 'User ' + req.body.user + ' is already in project : cannot add' });
    }

    try {
        if (req.body.request === 'add') {
            await usrsrv.add_user_to_project(project.id, req.body.user, user.uid);
        } else if (req.body.request === 'remove') {
            await usrsrv.remove_user_from_project(project.id, req.body.user, user.uid, user.is_admin, false);
        }
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }

    return res.send({ message: req.body.request + ' ' + req.body.user + ' done' });
});

router.post('/project/:id/add/manager/:uid', async function(req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    let project = await dbsrv.mongo_projects().findOne({ 'id': req.params.id });
    if (!project) {
        return res.status(404).send({ message: 'Project ' + req.params.id + ' not found' });
    }
    if (user.uid != project.owner) {
        return res.status(401).send({ message: 'User ' + user.uid + ' is not the owner of project ' + project.id });
    }
    const new_manager = await dbsrv.mongo_users().findOne({ 'uid': req.params.uid });
    if (!new_manager) {
        return res.status(404).send({ message: 'User ' + req.params.uid + ' not found' });
    }
    if (!(new_manager.projects && new_manager.projects.indexOf(project.id) >= 0)) {
        return res.status(403).send({ message: 'User ' + req.params.uid + ' is not in project ' + project.id });
    }
    if (project.managers && project.managers.includes(new_manager.uid)) {
        return res.status(403).send({ message: 'User ' + req.params.uid + ' is already a manager of project ' + project.id });
    }

    try {
        if (! project.managers){
            project.managers = [];
        }
        project.managers.push(new_manager.uid);
        await dbsrv.mongo_projects().updateOne({ 'id': project.id}, { '$set': { 'managers': project.managers } });
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }
    return res.send({ message: req.body.request + ' ' + req.body.user + ' done' });
});


router.post('/project/:id/remove/manager/:uid', async function(req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }
    let project = await dbsrv.mongo_projects().findOne({ 'id': req.params.id });
    if (!project) {
        return res.status(404).send({ message: 'Project ' + req.params.id + ' not found' });
    }
    if (user.uid != project.owner) {
        return res.status(401).send({ message: 'User ' + user.uid + ' is not the owner of project ' + project.id });
    }
    const ex_manager = await dbsrv.mongo_users().findOne({ 'uid': req.params.uid });
    if (!ex_manager) {
        return res.status(404).send({ message: 'User ' + req.params.uid + ' not found' });
    }
    if (!(ex_manager.projects && ex_manager.projects.indexOf(project.id) >= 0)) {
        return res.status(403).send({ message: 'User ' + req.params.uid + ' is not in project ' + project.id });
    }
    if (!project.managers || !project.managers.includes(ex_manager.uid)) {
        return res.status(403).send({ message: 'User ' + req.params.uid + ' is not a manager of project ' + project.id });
    }

    try {
        project.managers.splice(project.managers.indexOf(ex_manager.uid), 1);
        await dbsrv.mongo_projects().updateOne({ 'id': project.id }, { '$set': { 'managers': project.managers } });
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }
    return res.send({ message: req.body.request + ' ' + req.body.user + ' done' });
});


router.post('/ask/project', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    if (!req.body.id) {
        return res.status(403).send({ message: 'Project name empty' });
    }

    if (!req.body.description) {
        return res.status(403).send({ message: 'Project description empty' });
    }

    if (req.body.description.length < 30) {
        return res.status(403).send({ message: 'Project description length should at least be 30 char' });
    }

    let p = await dbsrv.mongo_projects().findOne({ id: req.body.id });
    if (p) {
        return res.status(403).send({ message: 'Project already exists' });
    }

    try {
        await prjsrv.create_project_request(
            {
                id: req.body.id,
                owner: user.uid,
                group: user.group,
                size: req.body.size,
                cpu: req.body.cpu,
                expire: req.body.expire,
                description: req.body.description,
                orga: req.body.orga
            },
            user
        );
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }
    return res.send({ message: 'Pending Project created' });
});

router.get('/pending/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send('Not authorized');
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send('User not found');
    }
    if (!isadmin) {
        if (!user.pending) {
            return res.send([]);
        } else {
            let pendings = await dbsrv
                .mongo_pending_projects()
                .find({ id: { $in: user.pending } })
                .toArray();
            return res.send(pendings);
        }
    } else {
        if (req.query.all === 'true') {
            let pendings = await dbsrv.mongo_pending_projects().find({}).toArray();
            return res.send(pendings);
        } else {
            if (!user.pending) {
                return res.send([]);
            } else {
                let pendings = await dbsrv
                    .mongo_pending_projects()
                    .find({ id: { $in: user.pending } })
                    .toArray();
                return res.send(pendings);
            }
        }
    }
});

router.delete('/pending/project/:uuid', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send('Not authorized');
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send('User not found');
    }
    if (!isadmin) {
        return res.status(401).send('Not authorized');
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
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            return res.status(e.code).send({ message: e.message });
        } else {
            return res.status(500).send({ message: 'Server Error, contact admin' });
        }
    }
    return res.send({ message: 'Pending Project deleted' });
});

router.get('/project/:id/users', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = null;
    let isadmin = false;

    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    if (!user.projects) {
        user.projects = [];
    }

    if (user.projects.includes(req.params.id) || isadmin) {
        let users_in_project = await dbsrv.mongo_users().find({ projects: req.params.id }).toArray();
        return res.send(users_in_project);
    }
    return res.status(401).send({ message: 'Not authorized' });
});

router.get('/project/:id/extend', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    let project = await dbsrv.mongo_projects().findOne({ id: req.params.id });
    if (!project) {
        logger.error('failed to get project', req.params.id);
        return res.status(404).send({ message: 'Project ' + req.params.id + ' not found' });
    }

    if (!isadmin && user.uid != project.owner) {
        return res.status(403).send({ message: 'Not authorized' });
    }

    if (CONFIG.project && CONFIG.project.allow_extend) {
        let expiration = new Date().getTime() + 360 * 1000 * 60 * 60 * 24; // one year
        await dbsrv
            .mongo_projects()
            .updateOne({ id: project.id }, { $set: { expire: expiration, last_extended: new Date().getTime() } });
        return res.send({ message: 'validity period extended', expiration: expiration });
    }
    return;
});

router.post;
module.exports = router;
