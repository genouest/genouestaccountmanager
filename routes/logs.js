var express = require('express');
var router = express.Router();
var fs = require('fs');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var utils = require('./utils');

router.get('/log', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let events = await utils.mongo_events().find({}, {limit: 200, sort: {date: -1}}).toArray();
    res.send(events);
    res.end();
});

router.get('/log/user/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let events = await utils.mongo_events().find({'owner': req.params.id}).toArray();
    res.send(events);
    res.end();
});

router.post('/log/user/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(!session_user){
        res.status(404).send({message: 'Session user not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = await utils.mongo_users().findOne({uid: req.params.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let event = {
        'owner': user.uid, 'date': new Date().getTime(), 'action': req.body.log ,
        'logs': []
    };
    await utils.mongo_events().insertOne(event);
    res.send({message: 'event created'});
    res.end();
});


router.get('/log/status/:id/:status', async function(req, res){
    await utils.mongo_events().updateOne({'logs': req.params.id}, {'$set':{'status': parseInt(req.params.status)}});
    res.end();
});

router.get('/log/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
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
