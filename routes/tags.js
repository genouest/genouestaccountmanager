var express = require('express');
var router = express.Router();
var CONFIG = require('config');

var utils = require('../core/utils.js');

router.get('/tags', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let tags = await utils.mongo_tags().find({}).toArray();
    let tagList = [];
    if (!tags) {
        return {'tags': tagList};
    }
    for(let i=0;i<tags.length;i++) {
        tagList.push(tags[i].name);
    }
    res.send({tags: tagList});
    res.end;
});


router.post('/tags/:kind/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let tags = req.body.tags;
    let session_user = null;
    let isadmin = false;
    try {
        session_user= await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rgtsrv.is_admin(session_user.uid);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }
    session_user.is_admin = isadmin;

    if(req.params.kind != 'group' && req.params.kind != 'user') {
        res.status(404).send({message: 'Not found'});
        return;
    }

    if(!session_user.is_admin) {
        res.status(403).send({message: 'Admin only'});
        return;
    }

    tags.forEach(tag => {
        utils.mongo_tags().updateOne({'name': tag}, {'name': tag}, {upsert: true});
    });

    if(req.params.kind == 'group') {
        await utils.mongo_groups().updateOne({'name': req.params.id} , {'$set': {'tags': tags}});
        res.send({message: 'tags updated'});
        return;
    }
    if(req.params.kind == 'user') {
        await utils.mongo_users().updateOne({'uid': req.params.id} , {'$set': {'tags': tags}});
        res.send({message: 'tags updated'});
        return;
    }
});


module.exports = router;
