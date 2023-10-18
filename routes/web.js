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
router.put('/web/:id/owner/:old/:new', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    if(! sansrv.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    session_user.is_admin = isadmin;

    if(!session_user.is_admin) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    await dbsrv.mongo_web().updateOne({name: req.params.id},{'$set': {owner: req.params.new}});
    await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'change website ' + req.params.id + ' owner to ' + req.params.new  , 'logs': []});
    res.send({message: 'Owner changed from ' + req.params.old + ' to ' + req.params.new});
    res.end();
});

router.get('/web', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    let filter = {};
    if(!session_user.is_admin) {
        filter = {owner: session_user.uid};
    }
    let webs = await dbsrv.mongo_web().find(filter).toArray();
    res.send(webs);
});

router.get('/web/owner/:owner', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.owner])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    session_user.is_admin = isadmin;

    let filter = {owner: req.params.owner};
    let webs = await dbsrv.mongo_web().find(filter).toArray();
    res.send(webs);
});


router.post('/web/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Web site name must be alphanumeric only'});
        return;
    }

    session_user.is_admin = isadmin;

    let owner = session_user.uid;
    if(req.body.owner !== undefined && session_user.is_admin) {
        owner = req.body.owner;
    }

    let web = {
        owner: owner,
        name: req.params.id,
        url: req.body.url,
        description: req.body.description
    };
    await dbsrv.mongo_web().insertOne(web);
    await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'register new web site ' + req.params.id , 'logs': []});

    res.send({web: web, message: 'New website added'});
});

router.delete('/web/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    let filter = {name: req.params.id};
    if(!session_user.is_admin) {
        filter['owner'] = session_user.uid;
    }
    await dbsrv.mongo_web().deleteOne(filter);

    await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove web site ' + req.params.id , 'logs': []});
    res.send({message: 'Website deleted'});
});


router.delete_webs = async function(user){
    let webs = await dbsrv.mongo_web().find({'owner': user.uid}).toArray();
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
    let filter = {_id: web_id};
    if(!user.is_admin) {
        filter['owner'] = user.uid;
    }
    await dbsrv.mongo_web().deleteOne(filter);
    await dbsrv.mongo_events().insertOne(
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
