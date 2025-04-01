const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const express = require('express');
var router = express.Router();

const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');

router.get('/tags', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let tags = await dbsrv.mongo_tags().find({}).toArray();
    let tagList = [];
    if (!tags) {
        return { tags: tagList };
    }
    for (let i = 0; i < tags.length; i++) {
        tagList.push(tags[i].name);
    }
    return res.send({ tags: tagList });
});

router.post('/tags/:kind/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let tags = req.body.tags;
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    session_user.is_admin = isadmin;

    if (req.params.kind != 'group' && req.params.kind != 'user') {
        return res.status(404).send({ message: 'Not found' });
    }

    if (!session_user.is_admin) {
        return res.status(403).send({ message: 'Admin only' });
    }

    tags.forEach((tag) => {
        dbsrv.mongo_tags().updateOne({ name: tag }, { $set: { name: tag } }, { upsert: true });
    });

    if (req.params.kind == 'group') {
        await dbsrv.mongo_groups().updateOne({ name: req.params.id }, { $set: { tags: tags } });
        return res.send({ message: 'tags updated' });
    }
    if (req.params.kind == 'user') {
        await dbsrv.mongo_users().updateOne({ uid: req.params.id }, { $set: { tags: tags } });
        return res.send({ message: 'tags updated' });
    }
});

module.exports = router;
