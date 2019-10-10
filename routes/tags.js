var express = require('express');
var router = express.Router();
var CONFIG = require('config');

var utils = require('./utils');

/*
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    tags_db = db.get('tags'),
    groups_db = db.get('groups'),
    users_db = db.get('users');
*/

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;
var mongo_groups = null;
var mongo_tags = null;


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
    mongo_groups = mongodb.collection('groups');
    mongo_tags = mongodb.collection('tags');
};
mongo_connect();

router.get('/tags', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let tags = await mongo_tags.find({}).toArray();
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
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let tags = req.body.tags;
    let session_user= await mongo_users.findOne({_id: req.locals.logInfo.id});
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    if(req.params.kind != 'group' && req.params.kind != 'user') {
        res.status(404).send('Not found');
        return;
    }

    if(!session_user.is_admin) {
        res.status(403).send('Admin only');
        return;  
    }

    tags.forEach(tag => {
        mongo_tags.updateOne({'name': tag}, {'name': tag}, {upsert: true});
    });

    if(req.params.kind == 'group') {
        await mongo_groups.updateOne({'name': req.params.id} , {'$set': {'tags': tags}});
        res.send({message: 'tags updated'});
        return;
    }
    if(req.params.kind == 'user') {
        await mongo_users.updateOne({'uid': req.params.id} , {'$set': {'tags': tags}});
        res.send({message: 'tags updated'});
        return;
    }
});


module.exports = router;
