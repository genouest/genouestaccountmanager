var express = require('express');
var router = express.Router();
// var bcrypt = require('bcryptjs');
// var escapeshellarg = require('escapeshellarg');

const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

// const MAILER = CONFIG.general.mailer;
// const MAIL_CONFIG = CONFIG[MAILER];

// var cookieParser = require('cookie-parser');

// var goldap = require('../routes/goldap.js');
// var notif = require('../routes/notif_'+MAILER+'.js');

const filer = require('../routes/file.js');
var utils = require('./utils');

// var get_ip = require('ipware')().get_ip;

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    projects_db = db.get('projects'),
    users_db = db.get('users'),
    events_db = db.get('events');

router.get('/project', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            if (! user.projects) {
                res.send([]);
                return;
            } else {
                projects_db.find({id: {$in : user.projects}}, function(err, projects){
                    res.send(projects);
                    return;
                });
            }
        } else {
            if (req.query.all === 'true'){
                projects_db.find({}, function(err, projects){
                    res.send(projects);
                    return;
                });
            } else {
                if (! user.projects) {
                    res.send([]);
                    return;
                } else {
                    projects_db.find({id: {$in : user.projects}}, function(err, projects){
                        res.send(projects);
                        return;
                    });
                }
            }
        }
    });
});

router.get('/project/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Admin only');
            return;
        }
        projects_db.findOne({'id': req.params.id}, function(err, project){
            if(err){
                logger.error(err);
                res.status(500).send('Error retrieving project');
                return;
            }
            if (! project){
                res.status(404).send('Project ' + req.params.id + ' not found');
                return;
            }
            res.send(project);
            return;
        });
    });
});

router.post('/project', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        users_db.findOne({'uid': req.body.owner}, function(err, owner){
            if(err || owner == null){
                res.status(404).send('User not found');
                return;
            }
            projects_db.findOne({'id': req.body.id}, function(err, project){
                if(err || project != null){
                    res.status(403).send('Not authorized or project already exists');
                    return;
                }
                let new_project = {
                    'id': req.body.id,
                    'owner': req.body.owner,
                    'group': req.body.group,
                    'size': req.body.size,
                    'expire': req.bodyexpire,
                    'description': req.body.description,
                    'path': req.body.path,
                    'orga': req.body.orga,
                    'access': req.body.access
                };
                // eslint-disable-next-line no-unused-vars
                projects_db.insert(new_project, function(err){
                    var fid = new Date().getTime();
                    filer.project_add_project(new_project, fid)
                        .then(
                            created_file => {
                                logger.info('File Created: ', created_file);                            })
                        .catch(error => { // reject()
                            logger.error('Add Project Failed for: ' + new_project.id, error);
                            res.status(500).send('Add Project Failed');
                            return;
                        });

                    // eslint-disable-next-line no-unused-vars
                    events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'new project creation: ' + req.body.id , 'logs': []}, function(err){});
                    res.send({'message': 'Project created'});
                    return;
                });
            });
        });
    });
});

router.delete('/project/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        // eslint-disable-next-line no-unused-vars
        projects_db.remove({'id': req.params.id}, function(err){
            var fid = new Date().getTime();
            filer.project_delete_project({'id': req.params.id}, fid)
                .then(
                    created_file => {
                        logger.info('File Created: ', created_file);
                    })
                .catch(error => { // reject()
                    logger.error('Delete Project Failed for: ' + req.params.id, error);
                    res.status(500).send('Delete Project Failed');
                    return;
                });

            // eslint-disable-next-line no-unused-vars
            events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'remove project ' + req.params.id , 'logs': []}, function(err){});

            res.send({'message': 'Project deleted'});
            return;
        });

    });
});

router.post('/project/:id', function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        projects_db.findOne({'id': req.params.id}, function(err, project){
            if(err || project == null){
                res.status(401).send('Not authorized or project not found');
                return;
            }
            let new_project = { '$set': {
                'owner': req.body.owner,
                'group': req.body.group,
                'size': req.body.size,
                'expire': req.body.expire,
                'description': req.body.description,
                'access': req.body.access,
                'orga': req.body.orga,
                'path': req.body.path
            }};
            // eslint-disable-next-line no-unused-vars
            projects_db.update({'id': req.params.id}, new_project, function(err){
                var fid = new Date().getTime();
                new_project.id =  req.params.id;
                filer.project_update_project(new_project, fid)
                    .then(
                        created_file => {
                            logger.info('File Created: ', created_file);
                        })
                    .catch(error => { // reject()
                        logger.error('Update Project Failed for: ' + new_project.id, error);
                        res.status(500).send('Add Project Failed');
                        return;
                    });

                // eslint-disable-next-line no-unused-vars
                events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'update project ' + req.params.id , 'logs': []}, function(err){});
                res.send({'message': 'Project updated'});
                return;
            });

        });
    });
});

router.post('/project/:id/request', function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        projects_db.findOne({'id': req.params.id}, function(err, project){
            if(err || project == null){
                res.status(404).send('Project ' + req.params.id + ' not found');
                return;
            }
            //Add to request list
            if(! user.uid === project.owner ){
                res.status(401).send('User ' + user.uid + ' is not project manager for project ' + project.id);
                return;
            }
            users_db.findOne({'uid': req.body.user}, function(err, newuser){
                if(err || newuser == null){
                    res.status(404).send('User ' + req.body.user + ' not found');
                    return;
                }
                if(newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.body.request === 'add'){
                    res.status(403).send('User ' + req.body.user + ' is already in project : cannot add');
                    return;
                }
                //Backward compatibility
                if (! project.add_requests){
                    project.add_requests = [];
                }
                if (! project.remove_requests){
                    project.remove_requests = [];
                }
                if ( project.add_requests.indexOf(req.body.user) >= 0 || project.remove_requests.indexOf(req.body.user) >= 0){
                    res.status(403).send('User ' + req.body.user + 'is already in a request : aborting');
                    return;
                }
                if (req.body.request === 'add'){
                    project.add_requests.push(req.body.user);
                } else if (req.body.request === 'remove') {
                    project.remove_requests.push(req.body.user);
                }
                let new_project = { '$set': {
                    'add_requests': project.add_requests,
                    'remove_requests': project.remove_requests
                }};
                // eslint-disable-next-line no-unused-vars
                projects_db.update({'id': req.params.id}, new_project, function(err){
                    // eslint-disable-next-line no-unused-vars
                    events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'received request ' + req.body.request + ' for user ' + req.body.uid + ' in project ' + project.id , 'logs': []}, function(err){});
                    res.send({'message': 'Request sent'});
                    return;
                });
            });
        });
    });
});

//Admin only, remove request
router.put('/project/:id/request', function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        projects_db.findOne({'id': req.params.id}, function(err, project){
            if(err || project == null){
                res.status(401).send('Not authorized or project not found');
                return;
            }
            if (! req.body.user || ! req.body.request){
                res.status(403).send('User and request type are needed');
                return;
            }
            var temp_requests = [];
            if(req.body.request === 'add' ){
                for(var i=0;i<project.add_requests.length;i++){
                    if( project.add_requests[i] !== req.body.user ){
                        temp_requests.push(project.add_requests[i]);
                    }
                }
                project.add_requests = temp_requests;
            } else if (req.body.request === 'remove' ){
                for(let i=0;i<project.remove_requests.length;i++){
                    if( project.remove_requests[i] !== req.body.user){
                        temp_requests.push(project.remove_requests[i]);
                    }
                }
                project.remove_requests = temp_requests;
            }
            let new_project = { '$set': {
                'add_requests': project.add_requests,
                'remove_requests': project.remove_requests
            }};
            // eslint-disable-next-line no-unused-vars
            projects_db.update({'id': req.params.id}, new_project, function(err){
                res.send({'message': 'Request removed'});
                return;
            });
        });
    });
});

//Return all projects using this group
router.get('/group/:id/projects', function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        projects_db.find({'group': req.params.id}, function(err, projects_with_group){
            res.send(projects_with_group);
            res.end();
            return;
        });
    });
});

module.exports = router;
