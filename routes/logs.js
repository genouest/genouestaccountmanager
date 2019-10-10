var express = require('express');
var router = express.Router();
// var bcrypt = require('bcryptjs');
var fs = require('fs');
// var escapeshellarg = require('escapeshellarg');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

/*
var monk = require('monk');
var db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db);
var users_db = db.get('users');
var events_db = db.get('events');
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

router.get('/log', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
    }
    let events = await mongo_events.find({}, {limit: 200, sort: {date: -1}}).toArray();
    res.send(events);
    res.end();
});

router.get('/log/user/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send('User not found');
        return;
    }
    let events = await mongo_events.find({'owner': req.params.id}).toArray();
    res.send(events);
    res.end();
});

router.get('/log/status/:id/:status', async function(req, res){
    await mongo_events.updateOne({'logs': req.params.id}, {'$set':{'status': parseInt(req.params.status)}});
    res.end();
});

router.get('/log/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await mongo_users.findOne({_id: req.locals.logInfo.id});

    if(!user){
        res.status(404).send('User not found');
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
    }

    let file = req.params.id + '.log';
    let log_file = GENERAL_CONFIG.script_dir + '/' + file;
    fs.readFile(log_file, 'utf8', function (err,data) {
        if (err) {
            res.status(500).send(err);
            res.end();
            return;
        }
        res.send({log: data});
        res.end();
        return;
    });

});

module.exports = router;
