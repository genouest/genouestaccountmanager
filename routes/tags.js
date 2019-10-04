var express = require('express');
var router = express.Router();
var CONFIG = require('config');

var utils = require('./utils');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    tags_db = db.get('tags'),
    groups_db = db.get('groups'),
    users_db = db.get('users');


router.get('/tags', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    tags_db.find({}, function(err, tags){
        let tagList = [];
        if (err) {
            return {'tags': tagList};
        }
        for(let i=0;i<tags.length;i++) {
            tagList.push(tags[i].name);
        }
        res.send({tags: tagList});
        res.end;
    });
});


router.post('/tags/:kind/:id', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let tags = req.body.tags;
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
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
            tags_db.update({'name': tag}, {'name': tag}, {upsert: true});
        });

        if(req.params.kind == 'group') {
            groups_db.update({'name': req.params.id} , {'$set': {'tags': tags}}, function(){
                res.send({message: 'tags updated'});
                return;
            });
        }
        if(req.params.kind == 'user') {
            users_db.update({'uid': req.params.id} , {'$set': {'tags': tags}}, function(){
                res.send({message: 'tags updated'});
                return;
            });
        }
               
    });



});


module.exports = router;
