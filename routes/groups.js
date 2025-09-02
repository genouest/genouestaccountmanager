/* eslint-disable require-atomic-updates */
/*jslint es6 */
const express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');

//const runningEnv = process.env.NODE_ENV || 'prod';

const grpsrv = require('../core/group.service.js');
const rolsrv = require('../core/role.service.js');

router.get('/group/:id/users', async function (req, res) {
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
    let users_in_group = await dbsrv
        .mongo_users()
        .find({ $or: [{ secondarygroups: req.params.id }, { group: req.params.id }] })
        .toArray();
    return res.send(users_in_group);
});

router.get('/group/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({
            _id: req.locals.logInfo.id
        });
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
    const group = await dbsrv.mongo_groups().findOne({ name: req.params.id });
    if (!group) {
        return res.status(404).send({ message: 'Group ' + req.params.id + ' not found' });
    }
    return res.send(group);
});

router.delete('/group/:id', async function (req, res) {
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
    let group = await dbsrv.mongo_groups().findOne({ name: req.params.id });
    if (!group) {
        return res.status(403).send({ message: 'Group does not exist' });
    }
    let users_in_group = await dbsrv
        .mongo_users()
        .find({ $or: [{ secondarygroups: req.params.id }, { group: req.params.id }] })
        .toArray();
    if (users_in_group && users_in_group.length > 0) {
        return res.status(403).send({ message: 'Group has some users, cannot delete it' });
    }
    grpsrv.delete_group(group, user.uid).then(function () {
        return res.send({ message: 'group ' + req.params.id + ' deleted' });
    });
});

router.put('/group/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(404).send({ message: 'User not found' });
    }
    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let owner = req.body.owner;
    let user = await dbsrv.mongo_users().findOne({ uid: owner });
    if (owner && !user) {
        return res.status(404).send({ message: 'Owner user does not exist' });
    }

    let description = req.body.description;

    let group = await dbsrv.mongo_groups().findOne({ name: req.params.id });
    if (!group) {
        return res.status(404).send({ message: 'Group does not exist' });
    }
    await dbsrv.mongo_events().insertOne({
        owner: session_user.uid,
        date: new Date().getTime(),
        action: 'group modification ' + group.name,
        logs: []
    });

    let data = await dbsrv
        .mongo_groups()
        .updateOne({ name: group.name }, { $set: { owner: owner, description: description } });
    return res.send(data);
});

router.post('/group/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!session_user) {
        return res.status(404).send({ message: 'User not found' });
    }

    if (!isadmin) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let owner = req.body.owner;
    let user = await dbsrv.mongo_users().findOne({ uid: owner });
    if (owner && !user) {
        return res.status(404).send({ message: 'Owner user does not exist' });
    }

    let description = req.body.description;

    let group = await dbsrv.mongo_groups().findOne({ name: req.params.id });
    if (group) {
        return res.status(403).send({ message: 'Group already exists' });
    }
    let groupexisted = await dbsrv.mongo_oldgroups().findOne({ name: req.params.id });
    if (groupexisted && (CONFIG.general.prevent_reuse_group === undefined || CONFIG.general.prevent_reuse_group)) {
        logger.error(`Group name ${req.params.id} already used in the past, preventing reuse`);
        return res.status(403).send('Group name already used in the past, preventing reuse');
    }

    try {
        group = await grpsrv.create_group(req.params.id, owner, description, session_user.uid);
    } catch (error) {
        logger.error('Add Group Failed for: ' + req.params.id, error);
        return res.status(500).send({ message: 'Add Group Failed' });
    }

    return res.send(group);
});

router.get('/group', async function (req, res) {
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
        return res.status(401).send({ message: 'Not authorized' });
    }
    let groups = await dbsrv.mongo_groups().find().toArray();

    return res.send(groups);
});

//Return all projects using this group
router.get('/group/:id/projects', async function (req, res) {
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
    let projects_with_group = await dbsrv.mongo_projects().find({ group: req.params.id }).toArray();
    return res.send(projects_with_group);
});

module.exports = router;
