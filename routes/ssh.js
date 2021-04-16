const express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const filer = require('../core/file.js');
const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');

router.get('/ssh/:id/putty', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let sshDir = user.home + '/.ssh';
    res.download(sshDir + '/id_rsa.ppk', 'id_rsa.ppk', function (err) {
        if (err) {
            logger.error(err);
            res.status(404).send('Key not found');
        }
    });
});

router.get('/ssh/:id/private', async function(req, res) {
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
        user = await dbsrv.mongo_users().findOne({uid: req.params.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    // todo maybe remove this a next if do the job, and it will allow admin to download it's own private key
    if(isadmin){
        res.status(403).send('[admin user] not authorized to download private key');
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let sshDir = user.home + '/.ssh';
    res.download(sshDir + '/id_rsa', 'id_rsa', function (err) {
        if (err) {
            logger.error(err);
            res.status(404).send('Key not found');
        }
    });
});

router.get('/ssh/:id/public', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let sshDir = user.home + '/.ssh';
    res.download(sshDir + '/id_rsa.pub', 'id_rsa.pub', function (err) {
        if (err) {
            logger.error(err);
            res.status(404).send('Key not found');
        }
    });
});

router.get('/ssh/:id', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({uid: req.params.id});

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let fid = new Date().getTime();

    try {
        let created_file = filer.ssh_keygen(user, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Create User Failed for: ' + user.uid, error);
        res.status(500).send({message: 'Ssh Keygen Failed'});
        return;
    }

    await dbsrv.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'Generate new ssh key' , 'logs': [user.uid + '.' + fid + '.update']});
    res.send({message: 'SSH key will be generated, refresh page in a minute to download your key'});
    res.end();
});

module.exports = router;
