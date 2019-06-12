var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var escapeshellarg = require('escapeshellarg');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var cookieParser = require('cookie-parser');

var goldap = require('../routes/goldap.js');
var notif = require('../routes/notif.js');

var get_ip = require('ipware')().get_ip;

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    projects_db = db.get('projects'),
    users_db = db.get('users'),
    events_db = db.get('events');

router.get('/project', function(req, res){
    var sess = req.session;
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
            };
        } else {
            if (req.param('all') === "true"){
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
                };
            };
        };
    });
});

router.get('/project/:id', function(req, res){
    var sess = req.session;
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
            res.status(401).send('Admin only');
            return;
        }
        projects_db.findOne({'id': req.param('id')}, function(err, project){
            if(err){
                logger.info(err)
                res.status(500).send("Error retrieving project");
                return;
            }
            if (! project){
                res.status(404).send("Project " + req.param('id') + " not found");
                return;
            }
            res.send(project);
            return;
        });
    });
})

router.post('/project', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    //{'id': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime, 'owner': project.owner, 'group': project.group}
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
        if(err || user == null){
            res.status(404).send('User not found');
            return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        users_db.findOne({'uid': req.param('owner')}, function(err, owner){
            if(err || owner == null){
                res.status(404).send('User not found');
                return;
            }
            projects_db.findOne({'id': req.param('id')}, function(err, project){
                if(err || project != null){
                    res.status(403).send('Not authorized or project already exists');
                    return;
                }
                new_project = {
                    'id': req.param('id'),
                    'owner': req.param('owner'),
                    'group': req.param('group'),
                    'size': req.param('size'),
                    'expire': req.param('expire'),
                    'description': req.param('description'),
                    'path': req.param('path'),
                    'orga': req.param('orga'),
                    'access': req.param('access')
                }
                projects_db.insert(new_project, function(err){
                    events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'new project creation: ' + req.param('id') , 'logs': []}, function(err){});
                    res.send({'message': 'Project created'});
                    return;
                });
            });
        });
    });
});

router.delete('/project/:id', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    //{'id': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime, 'owner': project.owner, 'group': project.group}
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
      }
      projects_db.remove({'id': req.param('id')}, function(err){
          events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'remove project ' + req.param('id') , 'logs': []}, function(err){});

            res.send({'message': 'Project deleted'});
            return;
        });

    });
});

router.post('/project/:id', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    //{'id': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime, 'owner': project.owner, 'group': project.group}
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
      }
      projects_db.findOne({'id': req.param('id')}, function(err, project){
         if(err || project == null){
            res.status(401).send('Not authorized or project not found');
            return;
         }
        new_project = { '$set': {
            'owner': req.param('owner'),
            'group': req.param('group'),
            'size': req.param('size'),
            'expire': req.param('expire'),
            'description': req.param('description'),
            'access': req.param('access'),
            'orga': req.param('orga'),
            'path': req.param('path')
        }}
        projects_db.update({'id': req.param('id')}, new_project, function(err){
            events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'update project ' + req.param('id') , 'logs': []}, function(err){});
            res.send({'message': 'Project updated'});
            return;
        });

      });
    });
});

router.post('/project/:id/request', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged){
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      projects_db.findOne({'id': req.param('id')}, function(err, project){
        if(err || project == null){
          res.status(404).send('Project ' + req.param('id') + ' not found');
          return;
        }
//Add to request list
        if(! user.uid === project.owner ){
          res.status(401).send('User ' + user.uid + " is not project manager for project " + project.id);
          return;
        }
        users_db.findOne({'uid': req.param('user')}, function(err, newuser){
          if(err || newuser == null){
            res.status(404).send('User ' + req.param('user') + ' not found');
            return;
          }
          if(newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.param('request') === 'add'){
            res.status(403).send('User ' + req.param('user') + ' is already in project : cannot add');
            return;
          }
//Backward compatibility
          if (! project.add_requests){
            project.add_requests = [];
          }
          if (! project.remove_requests){
            project.remove_requests = [];
          }
          if ( project.add_requests.indexOf(req.param('user')) >= 0 || project.remove_requests.indexOf(req.param('user')) >= 0){
            res.status(403).send('User ' + req.param('user') + 'is already in a request : aborting');
            return;
          }
          if (req.param('request') === 'add'){
            project.add_requests.push(req.param('user'));
          } else if (req.param('request') === 'remove') {
            project.remove_requests.push(req.param('user'));
          }
          new_project = { '$set': {
              'add_requests': project.add_requests,
              'remove_requests': project.remove_requests
          }}
          projects_db.update({'id': req.param('id')}, new_project, function(err){
            events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'received request ' + req.param('request') + ' for user ' + req.param('uid') + ' in project ' + project.id , 'logs': []}, function(err){});
            res.send({'message': 'Request sent'});
            return;
          });
        });
      });
    });
});

//Admin only, remove request
router.put('/project/:id/request', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
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
        projects_db.findOne({'id': req.param('id')}, function(err, project){
            if(err || project == null){
                res.status(401).send('Not authorized or project not found');
                return;
            }
            if (! req.param('user') || ! req.param('request')){
                res.status(403).send('User and request type are needed');
                return;
            }
            var temp_requests = [];
            if(req.param('request') === "add" ){
                for(var i=0;i<project.add_requests.length;i++){
                    if( project.add_requests[i] !== req.param('user') ){
                        temp_requests.push(project.add_requests[i]);
                    }
                }
                project.add_requests = temp_requests;
            } else if (req.param('request') === "remove" ){
                for(var i=0;i<project.remove_requests.length;i++){
                    if( project.remove_requests[i] !== req.param('user')){
                        temp_requests.push(project.remove_requests[i]);
                    }
                }
                project.remove_requests = temp_requests;
            };
            new_project = { '$set': {
                'add_requests': project.add_requests,
                'remove_requests': project.remove_requests
            }}
            projects_db.update({'id': req.param('id')}, new_project, function(err){
                res.send({'message': 'Request removed'});
                return;
            });
        });
    });
});

//Return all projects using this group
router.get('/group/:id/projects', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged){
        res.status(401).send('Not authorized');
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
        projects_db.find({'group': req.param('id')}, function(err, projects_with_group){
            res.send(projects_with_group);
            res.end();
            return;
        });
    });
});

module.exports = router;

