var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var utils = require('./utils');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    tags_db = db.get('tags'),
    groups_db = db.get('groups'),
    users_db = db.get('users');


/**
 * Change owner
 */
router.get('tags', function(req, res) {
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

router.get('/web/owner/:owner', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.param('owner')])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }
        var filter = {owner: req.param('owner')}
        web_db.find(filter, function(err, databases){
            res.send(databases);
            return;
        });
    });
});


router.post('/web/:id', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.param('id')])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }

        var owner = session_user.uid;
        if(req.param('owner') !== undefined && session_user.is_admin) {
            owner = req.param('owner');
        }
        web = {
            owner: owner,
            name: req.param('id'),
            url: req.param('url'),
            description: req.param('description')
        }
        web_db.insert(web, function(err){
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'register new web site ' + req.param('id') , 'logs': []}, function(err){});

            res.send({web: web, message: 'New website added'});
        });
    });
});

router.delete('/web/:id', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.param('id')])) {
        res.status(403).send('Invalid parameters');
        return;  
    }


    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }
        var filter = {name: req.param('id')};
        if(!session_user.is_admin) {
            filter['owner'] = session_user.uid;
        }
        web_db.remove(filter, function(err){
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove web site ' + req.param('id') , 'logs': []}, function(err){});
            res.send({message: 'Website deleted'});
        });
    });
});


router.delete_webs = function(user){
    return new Promise(function (resolve, reject){
        web_db.find({'owner': user.uid}).then(function(webs){
            if(!webs){
                resolve(true);
                return;
            }
            logger.debug("delete_webs");
            Promise.all(webs.map(function(web){
                return delete_web(user, web._id);
            })).then(function(res){
                resolve(res);
            });
        });
    });

};

var delete_web = function(user, web_id){
    return new Promise(function (resolve, reject){
        var filter = {_id: web_id};
        if(!user.is_admin) {
            filter['owner'] = user.uid;
        }
        web_db.remove(filter).then(function(){
            events_db.insert(
                {
                    'owner': user.uid,
                    'date': new Date().getTime(),
                    'action': 'remove web site ' + web_id ,
                    'logs': []
                }
            ).then(function(){
                resolve(true);
            });
        });
    });
};

module.exports = router;
