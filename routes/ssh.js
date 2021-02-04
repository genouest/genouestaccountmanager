var express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var CONFIG = require('config');

const filer = require('../core/file.js');
const utils = require('../core/utils.js');


router.get('/ssh/:id/putty', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
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
        }
    });
});

router.get('/ssh/:id/private', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    if(CONFIG.general.admin.indexOf(user.uid) >= 0){
        res.status(401).send({message: '[admin user] not authorized to download private key'});
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
        }
    });
});

router.get('/ssh/:id/public', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});

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
        }
    });
});

router.get('/ssh/:id', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({uid: req.params.id});

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

    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'Generate new ssh key' , 'logs': [user.uid + '.' + fid + '.update']});
    res.send({message: 'SSH key will be generated, refresh page in a minute to download your key'});
    res.end();
});

module.exports = router;
