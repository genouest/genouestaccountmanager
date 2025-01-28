const express = require('express');
var router = express.Router();
const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');

/**
 * Change owner
 */
router.put('/web/:id/owner/:old/:new', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    if (!sansrv.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
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
        return res.status(401).send({ message: 'Not authorized' });
    }
    session_user.is_admin = isadmin;
    if (!session_user.is_admin) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    if (req.params.old == req.params.new) {
        return res.status(400).send({ message: 'Old owner and new owner are the same person' });
    }
    try {
        await dbsrv.mongo_web().findOne({ name: req.params.id });
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'Website not found' });
    }
    try {
        await dbsrv.mongo_users().findOne({ uid: req.params.old });
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'Old website owner not found' });
    }
    try {
        await dbsrv.mongo_users().findOne({ uid: req.params.new });
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'New website owner not found' });
    }

    await dbsrv.mongo_web().updateOne({ name: req.params.id }, { $set: { owner: req.params.new } });
    await dbsrv
        .mongo_events()
        .insertOne({
            owner: session_user.uid,
            date: new Date().getTime(),
            action: 'change website ' + req.params.id + ' owner to ' + req.params.new,
            logs: []
        });
    return res.send({ message: 'Owner changed from ' + req.params.old + ' to ' + req.params.new });
});

router.get('/web', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
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
        return res.status(401).send({ message: 'Not authorized' });
    }

    session_user.is_admin = isadmin;

    let filter = {};
    if (!session_user.is_admin) {
        filter = { owner: session_user.uid };
    }
    let webs = await dbsrv.mongo_web().find(filter).toArray();
    return res.send(webs);
});

router.get('/web/owner/:owner', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.owner])) {
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
        return res.status(401).send({ message: 'Not authorized' });
    }
    session_user.is_admin = isadmin;

    let filter = { owner: req.params.owner };
    let webs = await dbsrv.mongo_web().find(filter).toArray();
    return res.send(webs);
});

router.post('/web/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Web site name should be a sanitized string' });
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
        return res.status(401).send({ message: 'Not authorized' });
    }

    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Web site name must be alphanumeric only' });
    }

    session_user.is_admin = isadmin;

    let owner = session_user.uid;
    if (req.body.owner !== undefined && session_user.is_admin) {
        owner = req.body.owner;
    }

    let web = {
        owner: owner,
        name: req.params.id,
        url: req.body.url,
        description: req.body.description
    };
    await dbsrv.mongo_web().insertOne(web);
    await dbsrv
        .mongo_events()
        .insertOne({
            owner: session_user.uid,
            date: new Date().getTime(),
            action: 'register new web site ' + req.params.id,
            logs: []
        });

    return res.send({ web: web, message: 'New website added' });
});

router.delete('/web/:id', async function (req, res) {
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
        return res.status(401).send({ message: 'Not authorized' });
    }

    session_user.is_admin = isadmin;

    let filter = { name: req.params.id };
    if (!session_user.is_admin) {
        filter['owner'] = session_user.uid;
    }
    await dbsrv.mongo_web().deleteOne(filter);

    await dbsrv
        .mongo_events()
        .insertOne({
            owner: session_user.uid,
            date: new Date().getTime(),
            action: 'remove web site ' + req.params.id,
            logs: []
        });
    return res.send({ message: 'Website deleted' });
});

router.delete_webs = async function (user) {
    let webs = await dbsrv.mongo_web().find({ owner: user.uid }).toArray();
    if (!webs) {
        return true;
    }
    logger.debug('delete_webs');
    let res = await Promise.all(
        webs.map(function (web) {
            return delete_web(user, web._id);
        })
    );
    return res;
};

var delete_web = async function (user, web_id) {
    let filter = { _id: web_id };
    if (!user.is_admin) {
        filter['owner'] = user.uid;
    }
    await dbsrv.mongo_web().deleteOne(filter);
    await dbsrv.mongo_events().insertOne({
        owner: user.uid,
        date: new Date().getTime(),
        action: 'remove web site ' + web_id,
        logs: []
    });
    return true;
};

module.exports = router;
