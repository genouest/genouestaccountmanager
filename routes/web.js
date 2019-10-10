var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var utils = require('./utils');

/*
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');
*/

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;
var mongo_webs = null;
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
    mongo_webs = mongodb.collection('web');
    mongo_events = mongodb.collection('events');

};
mongo_connect();

/**
 * Change owner
 */
router.put('/web/:id/owner/:old/:new', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    if(! utils.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let session_user = await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(!session_user) {
        res.status(401).send('Not authorized');
        return;
    }
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    if(!session_user.is_admin) {
        res.status(401).send('Not authorized');
        return;
    }
    await mongo_webs.updateOne({name: req.params.id},{'$set': {owner: req.params.new}});
    await mongo_events.insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'change website ' + req.params.id + ' owner to ' + req.params.new  , 'logs': []});
    res.send({message: 'Owner changed from ' + req.params.old + ' to ' + req.params.new});
    res.end();
});

router.get('/web', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let session_user = await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(!session_user) {
        res.status(401).send('Not authorized');
        return;
    }
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    var filter = {};
    if(!session_user.is_admin) {
        filter = {owner: session_user.uid};
    }
    let webs = await mongo_webs.find(filter).toArray();
    res.send(webs);
});

router.get('/web/owner/:owner', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.owner])) {
        res.status(403).send('Invalid parameters');
        return;  
    }

    let session_user = await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(!session_user) {
        res.status(401).send('Not authorized');
        return;
    }
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    var filter = {owner: req.params.owner};
    let webs = await mongo_webs.find(filter).toArray();
    res.send(webs);
});


router.post('/web/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let session_user = await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(!session_user) {
        res.status(401).send('Not authorized');
        return;
    }
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }

    var owner = session_user.uid;
    if(req.body.owner !== undefined && session_user.is_admin) {
        owner = req.body.owner;
    }
    let web = {
        owner: owner,
        name: req.params.id,
        url: req.body.url,
        description: req.body.description
    };
    await mongo_webs.insertOne(web);
    await mongo_events.insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'register new web site ' + req.params.id , 'logs': []});

    res.send({web: web, message: 'New website added'});
});

router.delete('/web/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }

    let session_user = await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(!session_user) {
        res.status(401).send('Not authorized');
        return;
    }
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    var filter = {name: req.params.id};
    if(!session_user.is_admin) {
        filter['owner'] = session_user.uid;
    }
    await mongo_webs.remove(filter);

    await mongo_events.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove web site ' + req.params.id , 'logs': []});
    res.send({message: 'Website deleted'});
});


router.delete_webs = function(user){
    // eslint-disable-next-line no-unused-vars
    return new Promise(async function (resolve, reject){
        let webs = await mongo_webs.find({'owner': user.uid}).toArray();
        if(!webs){
            resolve(true);
            return;
        }
        logger.debug('delete_webs');
        Promise.all(webs.map(function(web){
            return delete_web(user, web._id);
        })).then(function(res){
            resolve(res);
        });
    });

};

var delete_web = async function(user, web_id){
    // eslint-disable-next-line no-unused-vars
    //return new Promise(async function (resolve, reject){
    var filter = {_id: web_id};
    if(!user.is_admin) {
        filter['owner'] = user.uid;
    }
    await mongo_webs.remove(filter);
    await mongo_events.insert(
        {
            'owner': user.uid,
            'date': new Date().getTime(),
            'action': 'remove web site ' + web_id ,
            'logs': []
        }
    );
    return true;
    //resolve(true);
    //});
};

module.exports = router;
