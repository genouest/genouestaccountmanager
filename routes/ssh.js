const express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const filer = require('../core/file.js');
const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');

router.get('/ssh/:id/putty', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
    if (!user) {
        return res.send({ message: 'User does not exist' });
    }
    if (user._id.toString() != req.locals.logInfo.id.toString()) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let sshDir = user.home + '/.ssh';
    return res.download(sshDir + '/id_rsa.ppk', 'id_rsa.ppk', function (err) {
        if (err) {
            logger.error(err);
            return res.status(404).send('Key not found');
        }
    });
});

router.get('/ssh/:id/private', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ uid: req.params.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.send({ message: 'User does not exist' });
    }
    // todo maybe remove this a next if do the job, and it will allow admin to download it's own private key
    if (isadmin) {
        return res.status(403).send('[admin user] not authorized to download private key');
    }
    if (user._id.toString() != req.locals.logInfo.id.toString()) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let sshDir = user.home + '/.ssh';
    return res.download(sshDir + '/id_rsa', 'id_rsa', function (err) {
        if (err) {
            logger.error(err);
            return res.status(404).send('Key not found');
        }
    });
});

router.get('/ssh/:id/public', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });

    if (!user) {
        return res.send({ message: 'User does not exist' });
    }
    if (user._id.toString() != req.locals.logInfo.id.toString()) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let sshDir = user.home + '/.ssh';
    return res.download(sshDir + '/id_rsa.pub', 'id_rsa.pub', function (err) {
        if (err) {
            logger.error(err);
            return res.status(404).send('Key not found');
        }
    });
});

router.get('/ssh/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }
    let user = await dbsrv.mongo_users().findOne({ uid: req.params.id });

    if (!user) {
        return res.send({ message: 'User does not exist' });
    }
    if (user._id.toString() != req.locals.logInfo.id.toString()) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    let fid = new Date().getTime();

    try {
        let created_file = filer.ssh_keygen(user, fid);
        logger.debug('Created file', created_file);
    } catch (error) {
        logger.error('Create User Failed for: ' + user.uid, error);
        return res.status(500).send({ message: 'Ssh Keygen Failed' });
    }

    await dbsrv
        .mongo_events()
        .insertOne({
            owner: user.uid,
            date: new Date().getTime(),
            action: 'Generate new ssh key',
            logs: [user.uid + '.' + fid + '.update']
        });
    return res.send({ message: 'SSH key will be generated, refresh page in a minute to download your key' });
});

module.exports = router;
