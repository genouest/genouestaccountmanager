var express = require('express');
var router = express.Router();
// var cookieParser = require('cookie-parser');
// var session = require('express-session');
// var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const filer = require('../routes/file.js');
var CONFIG = require('config');

/*
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users'),
    events_db = db.get('events');
*/

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;
var mongo_events = null;


var mongo_connect = async function() {
    let url = CONFIG.mongo.url;
    let client = null;
    if(!url) {
        client = new MongoClient(`mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}`);
    } else {
        client = new MongoClient(CONFIG.mongo.url);
    }
    await client.connect();
    mongodb = client.db(CONFIG.general.db);
    mongo_users = mongodb.collection('users');
    mongo_events = mongodb.collection('events');
};
mongo_connect();

var utils = require('./utils');
/**
   app.get('/ssh/:id', ssh);
   app.get('/ssh/:id/public', ssh);
   app.get('/ssh/:id/putty', ssh);
   app.get('/ssh/:id/private', ssh);
*/

router.get('/ssh/:id/putty', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await mongo_users.findOne({uid: req.params.id});
    if(!user) {
        res.send({msg: 'User does not exist'});
        res.end();
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send('Not authorized');
        return;
    }
    var sshDir = user.home + '/.ssh';
    res.download(sshDir + '/id_rsa.ppk', 'id_rsa.ppk', function (err) {
        if (err) {
            logger.error(err);
        }
    });
});

router.get('/ssh/:id/private', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await mongo_users.findOne({uid: req.params.id});
    if(!user) {
        res.send({msg: 'User does not exist'});
        res.end();
        return;
    }
    if(CONFIG.general.admin.indexOf(user.uid) >= 0){
        res.status(401).send('[admin user] not authorized to download private key');
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send('Not authorized');
        return;
    }
    var sshDir = user.home + '/.ssh';
    res.download(sshDir + '/id_rsa', 'id_rsa', function (err) {
        if (err) {
            logger.error(err);
        }
    });
});

router.get('/ssh/:id/public', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await mongo_users.findOne({uid: req.params.id});

    if(!user) {
        res.send({msg: 'User does not exist'});
        res.end();
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send('Not authorized');
        return;
    }
    var sshDir = user.home + '/.ssh';
    res.download(sshDir + '/id_rsa.pub', 'id_rsa.pub', function (err) {
        if (err) {
            logger.error(err);
        }
    });
});

router.get('/ssh/:id', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    let user = await mongo_users.findOne({uid: req.params.id});

    if(!user) {
        res.send({msg: 'User does not exist'});
        res.end();
        return;
    }
    if(user._id.str != req.locals.logInfo.id.str){
        res.status(401).send('Not authorized');
        return;
    }

    var fid = new Date().getTime();

    try {
        let created_file = filer.ssh_keygen(user, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Create User Failed for: ' + user.uid, error);
        res.status(500).send('Ssh Keygen Failed');
        return;  
    }

    await mongo_events.insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'Generate new ssh key' , 'logs': [user.uid + '.' + fid + '.update']});
    res.send({'msg': 'SSH key will be generated, refresh page in a minute to download your key'});
    res.end();
});

module.exports = router;
