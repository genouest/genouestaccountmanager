var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var utils = require('./utils');


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
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
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
    await utils.mongo_web().updateOne({name: req.params.id},{'$set': {owner: req.params.new}});
    await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'change website ' + req.params.id + ' owner to ' + req.params.new  , 'logs': []});
    res.send({message: 'Owner changed from ' + req.params.old + ' to ' + req.params.new});
    res.end();
});

router.get('/web', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
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
    let webs = await utils.mongo_web().find(filter).toArray();
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

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
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
    let webs = await utils.mongo_web().find(filter).toArray();
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
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
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
    await utils.mongo_web().insertOne(web);
    await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'register new web site ' + req.params.id , 'logs': []});

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

    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
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
    await utils.mongo_web().deleteOne(filter);

    await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove web site ' + req.params.id , 'logs': []});
    res.send({message: 'Website deleted'});
});


router.delete_webs = async function(user){
    let webs = await utils.mongo_web().find({'owner': user.uid}).toArray();
    if(!webs){
        return true;
    }
    logger.debug('delete_webs');
    let res = await Promise.all(webs.map(function(web){
        return delete_web(user, web._id);
    }));
    return res;
};

var delete_web = async function(user, web_id){
    var filter = {_id: web_id};
    if(!user.is_admin) {
        filter['owner'] = user.uid;
    }
    await utils.mongo_web().deleteOne(filter);
    await utils.mongo_events().insertOne(
        {
            'owner': user.uid,
            'date': new Date().getTime(),
            'action': 'remove web site ' + web_id ,
            'logs': []
        }
    );
    return true;
};

module.exports = router;
