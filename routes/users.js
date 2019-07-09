/*jslint es6 */
var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var escapeshellarg = require('escapeshellarg');
var markdown = require("markdown").markdown;
var htmlToText = require('html-to-text');

var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];

var cookieParser = require('cookie-parser');

var goldap = require('../routes/goldap.js');
var notif = require('../routes/notif.js');
var utils = require('../routes/utils.js');

// var get_ip = require('ipware')().get_ip;

var monk = require('monk')
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + GENERAL_CONFIG.db)
var groups_db = db.get('groups')
var databases_db = db.get('databases')
var web_db = db.get('web')
var users_db = db.get('users')
var projects_db = db.get('projects')
var events_db = db.get('events')


var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var MAIL_CONFIG = CONFIG.gomail;

const runningEnv = process.env.NODE_ENV || 'prod';

for(i = 0; i< plugins.length; i++){
  if(plugins[i]['admin']) {
    continue;
  }
  plugins_modules[plugins[i].name] = require('../plugins/'+plugins[i].name);
  plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name});
}

// util function to execute scripts immediatly, for test purpose only
// on dev/prod, scripts should be executed by cron only
if (runningEnv === 'test'){
  const { spawn } = require('child_process');
  var if_dev_execute_scripts = function(){
      return new Promise(function (resolve, reject){
          if (runningEnv !== 'test'){
              resolve();
              return;
          }
          logger.info('In *test* environment, check for scripts to execute');
          let cron_bin_script = CONFIG.general.cron_bin_script || null;
          if(cron_bin_script === null){
              logger.error('cron script not defined');
              reject({'err': 'cron script not defined'});
              return;
          }
          var procScript = spawn(cron_bin_script, [CONFIG.general.script_dir, CONFIG.general.url]);
          procScript.on('exit', function (code, signal) {
            logger.info(cron_bin_script + ' process exited with ' +
                        `code ${code} and signal ${signal}`);
            resolve();
          });
      });
  }

  router.use('*', function(req, res, next){
      res.on("finish", function() {
        if_dev_execute_scripts().then(function(){});
      });
      next();
  });
}

var send_notif = function(mailOptions, fid, errors) {
    return new Promise(function (resolve, reject){
        if(notif.mailSet()) {
            notif.sendUser(mailOptions, function(err, response) {
                resolve(errors);
            });
        } else {
          resolve(errors);
        }
    });
};

var create_extra_group = function(group_name, owner_name){
    return new Promise(function (resolve, reject){
        //var mingid = 1000;
        //groups_db.find({}, { limit: 1 , sort: { gid: -1 }}, function(err, data){
        utils.getGroupAvailableId().then(function (mingid) {
          //if(!err && data && data.length>0){
          //  mingid = data[0].gid+1;
          //}
          var fid = new Date().getTime();
          group = {name: group_name, gid: mingid, owner: owner_name};
          groups_db.insert(group, function(err){
            goldap.add_group(group, fid, function(err){
              var script = "#!/bin/bash\n";
              script += "set -e \n"
              script += "ldapadd -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+group.name+"."+fid+".ldif\n";
              var script_file = CONFIG.general.script_dir+'/'+group.name+"."+fid+".update";
              fs.writeFile(script_file, script, function(err) {
                fs.chmodSync(script_file, 0o755);
                group.fid = fid;
                resolve(group);
                return;
              });
            });
          });
        });

    });
}
var create_extra_user = function(user_name, group, internal_user){
    return new Promise(function (resolve, reject){
        var password = Math.random().toString(36).slice(-10);
        if(process.env.MY_ADMIN_PASSWORD){
            password = process.env.MY_ADMIN_PASSWORD;
        }
        else {
            logger.info('Generated admin password:' + user.password);
        }

        var user = {
          status: STATUS_ACTIVE,
          uid: user_name,
          firstname: user_name,
          lastname: user_name,
          email: process.env.MY_ADMIN_EMAIL || CONFIG.general.support,
          address: "",
          lab: "",
          responsible: "",
          group: group.name,
          secondarygroups: [],
          maingroup: "",
          why: "",
          ip: "",
          regkey: Math.random().toString(36).slice(-10),
          is_genouest: internal_user,
          is_fake: false,
          uidnumber: -1,
          gidnumber: -1,
          cloud: false,
          duration: 3,
          expiration: new Date().getTime() + 1000*3600*24*3,
          loginShell: '/bin/bash',
          history: [],
          password: password
        }

        //var minuid = 1000;
        //users_db.find({}, { limit: 1 , sort: { uidnumber: -1 }}, function(err, data){
        utils.getUserAvailableId().then(function (minuid) {
            //if(!err && data && data.length>0){
            //    minuid = data[0].uidnumber+1;
            //}

            user.uidnumber = minuid;
            user.gidnumber = group.gid;
            var fid = new Date().getTime();
            goldap.add(user, fid, function(err) {
              if(!err){
                delete user.password;
                users_db.insert(user, function(err){
                    var script = "#!/bin/bash\n";
                    script += "set -e \n"
                    script += "ldapadd -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
                    script += "if [ -e "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif"+" ]; then\n"
                    script += "\tldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif\n";
                    script += "fi\n"
                    script += "sleep 3\n";
                    script += "mkdir -p "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh\n";
                    script += utils.addReadmes(CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid);
                    /*
                    script += "mkdir -p "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/user_guides\n";
                    if (typeof CONFIG.general.readme == "object") {
                      CONFIG.general.readme.forEach(function(dict) {
                        script += "ln -s " + dict.source_folder + " "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/user_guides/" + dict.language + "\n";
                      });
                    } else {
                      script += "ln -s " + CONFIG.general.readme + " "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/user_guides/README\n";
                    };
                    */
                    script += "touch "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/authorized_keys\n";
                    script += "echo \"Host *\" > "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/config\n";
                    script += "echo \"  StrictHostKeyChecking no\" >> "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/config\n";
                    script += "echo \"   UserKnownHostsFile=/dev/null\" >> "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/config\n";
                    script += "chmod 700 "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh\n";
                    script += "chown -R "+user.uidnumber+":"+user.gidnumber+" "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"\n";
                    // script += "mkdir -p /omaha-beach/"+user.uid+"\n";
                    //script += "chown -R "+user.uidnumber+":"+user.gidnumber+" /omaha-beach/"+user.uid+"\n";
                    script += utils.addExtraDirs(user.uid, user.group, user.uidnumber, user.gidnumber);
                    var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
                    fs.writeFile(script_file, script, function(err) {
                      fs.chmodSync(script_file,0o755);
                        var plugin_call = function(plugin_info, userId, data, adminId){
                            return new Promise(function (resolve, reject){
                                plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                                    resolve(true);
                                });
                            });
                        };
                        Promise.all(plugins_info.map(function(plugin_info){
                            return plugin_call(plugin_info, user.uid, user, 'auto');
                        })).then(function(results){
                            return send_notif(mailOptions, fid, []);
                        }, function(err){
                            return send_notif(mailOptions, fid, err);
                        }).then(function(errs){
                            resolve(user);
                            return;
                        });
                  });
                });

              }
              else {
                logger.error('Failed to create admin user', err);
                  resolve(null);
              }
            });

        });


    });
}

router.create_admin = function(default_admin, default_admin_group){
    users_db.findOne({'uid': default_admin}).then(function(user){
        if(user){
            logger.info('admin already exists, skipping');
        }
        else {
            logger.info('should create admin');
            groups_db.findOne({name: default_admin_group}).then(function(group){
                if(group){
                    logger.info('group already exists');
                    create_extra_user(default_admin, group, true).then(function(user){
                        logger.info('admin user created');
                    });
                }
                else {
                    create_extra_group(default_admin_group, default_admin).then(function(group){
                        logger.info('admin group created');
                        create_extra_user(default_admin, group, true).then(function(user){
                            logger.info('admin user created');
                        });
                    })
                }
            })
        }
    });
}

router.get('/user/:id/apikey', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(session_user.uid !== req.param('id') && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        users_db.findOne({uid: req.param('id')}, function(err, user){
            if(!user) {
                res.send({msg: 'User does not exists'})
                res.end();
                return;
            }

            if (user.apikey === undefined) {
                res.send({'apikey': ''})
                res.end();
                return;
            } else {
                res.send({'apikey': user.apikey})
                res.end();
                return;
            }
        });
    });
});

router.post('/user/:id/apikey', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(session_user.uid !== req.param('id') && GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }

        users_db.findOne({uid: req.param('id')}, function(err, user){
            if(!user) {
                res.send({msg: 'User does not exists'})
                res.end();
                return;
            }

            var apikey = Math.random().toString(36).slice(-10);
            users_db.update({uid: req.param('id')}, {'$set':{'apikey': apikey}}, function(err, data){
               res.send({'apikey': apikey});
               res.end();
            });
        });
    });
});

/*
app.put('/user/:id/subscribe', users);
app.put('/user/:id/unsubscribe', users);
*/
router.put('/user/:id/subscribe', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  // if not user nor admin
  if (req.locals.logInfo.id !== req.param('id') && ! GENERAL_CONFIG.admin.indexOf(req.locals.logInfo.id) < 0) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({uid: req.param('id')}, function(err, user){
      if(!user) {
          res.send({msg: 'User does not exists'})
          res.end();
          return;
      }
      if(user.email == undefined || user.email == ''){
          res.send({'subscribed': false});
          res.end();
      } else {
          notif.add(user.email, function() {
              res.send({'subscribed': true});
              res.end();
          });
      }
  });
});

router.put('/user/:id/unsubscribe', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  // if not user nor admin
  if (req.locals.logInfo.id !== req.param('id') && ! GENERAL_CONFIG.admin.indexOf(req.locals.logInfo.id) < 0) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({uid: req.param('id')}, function(err, user){
      if(!user) {
          res.send({msg: 'User does not exists'})
          res.end();
          return;
      }
      if(user.email == undefined || user.email == ''){
          res.send({'unsubscribed': false});
          res.end();
      } else {
          notif.remove(user.email, function() {
              res.send({'unsubscribed': true});
              res.end();
          });
      }
  });
});


router.get('/user/:id/subscribed', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }
        if(user.email == undefined || user.email == ''){
            res.send({'subscribed': false});
            res.end();
        } else {
            notif.subscribed(user.email, function(is_subscribed) {
                res.send({'subscribed': is_subscribed});
                res.end();
            });
        }
    });
});

router.get('/group/:id', function(req, res){
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
            res.status(401).send('Not authorized');
            return;
        }
        users_db.find({'$or': [{'secondarygroups': req.param('id')}, {'group': req.param('id')}]}, function(err, users_in_group){
            res.send(users_in_group);
            res.end();
        });
    });
});

router.delete_group = function(group, admin_user_id){
  return new Promise(function (resolve, reject){
    groups_db.remove({'name': group.name}, function(err){
      var fid = new Date().getTime();
      goldap.delete_group(group, fid, function(err){
        var script = "#!/bin/bash\n";
        script += "set -e \n"
        script += "ldapdelete -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+group.name+"."+fid+".ldif\n";
        var script_file = CONFIG.general.script_dir+'/'+group.name+"."+fid+".update";
        fs.writeFile(script_file, script, function(err) {
          fs.chmodSync(script_file,0o755);
          group.fid = fid;
          events_db.insert({'owner': admin_user_id, 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name+"."+fid+".update"]}, function(err){});
          utils.freeGroupId(group.gid).then(function(){
            resolve(true);
          })
        });
      });
    });
  });
};

router.clear_user_groups = function(user, admin_user_id){
  var allgroups = user.secondarygroups;
  allgroups.push(user.group);
  for(var i=0;i < allgroups.length;i++){
    groups_db.findOne({name: allgroups[i]}, function(err, group){
      if(group){
        users_db.find({'$or': [{'secondarygroups': group.name}, {'group': group.name}]}, function(err, users_in_group){
          if(users_in_group && users_in_group.length == 0){
	    router.delete_group(group, admin_user_id);
          }
        });
      }
    });
  }
}



router.delete('/group/:id', function(req, res){
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
          res.status(401).send('Not authorized');
          return;
        }
        groups_db.findOne({name: req.param('id')}, function(err, group){
          if(err || !group) {
            res.status(403).send('Group does not exists');
            return;
          }
          users_db.find({'$or': [{'secondarygroups': req.param('id')}, {'group': req.param('id')}]}, function(err, users_in_group){
              if(users_in_group && users_in_group.length > 0){
                  res.status(403).send('Group has some users, cannot delete it');
                  return;
              }
              router.delete_group(group, user.uid).then(function(){
                res.send({'msg': 'group ' + req.param('id')+ ' deleted'});
                res.end();
              });
          });
        });
    });
});


router.put('/group/:id', function(req, res){
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
      res.status(401).send('Not authorized');
      return;
    }
    var owner = req.param('owner');
    users_db.findOne({uid: owner}, function(err, user){
        if(!user || err) {
            res.status(404).send('User does not exists')
            res.end();
            return;
        }
        groups_db.findOne({name: req.param('id')}, function(err, group){
          if(! group) {
            res.status(404).send('Group does not exists');
            return;
          }
          events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'group owner modification ' + group.name + ' to ' +owner, 'logs': []}, function(err){});
          groups_db.update({name: group.name}, {'$set':{'owner': owner}}, function(err, data){
             res.send(data);
             res.end();
          });
        });
      });
  });
});

router.post('/group/:id', function(req, res){
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
      res.status(401).send('Not authorized');
      return;
    }
    var owner = req.param('owner');
    users_db.findOne({uid: owner}, function(err, user){
        if(!user || err) {
            res.status(404).send('User does not exists')
            res.end();
            return;
        }
        groups_db.findOne({name: new RegExp(req.param('id'), 'i')}, function(err, group){
          if(group) {
            res.status(403).send('Group already exists');
            return;
          }
          //var mingid = 1000;
          utils.getGroupAvailableId().then(function (mingid) {
          //groups_db.find({}, { limit: 1 , sort: { gid: -1 }}, function(err, data){
            //if(!err && data && data.length>0){
            //  mingid = data[0].gid+1;
            //}
            var fid = new Date().getTime();
            group = {name: req.param('id'), gid: mingid, owner: owner};
            groups_db.insert(group, function(err){
              goldap.add_group(group, fid, function(err){

                var script = "#!/bin/bash\n";
                script += "set -e \n"
                script += "ldapadd -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+group.name+"."+fid+".ldif\n";
                var script_file = CONFIG.general.script_dir+'/'+group.name+"."+fid+".update";
                fs.writeFile(script_file, script, function(err) {
                  events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'create group ' + req.param('id') , 'logs': [group.name+"."+fid+".update"]}, function(err){});

                  fs.chmodSync(script_file,0o755);
                  group.fid = fid;
                  res.send(group);
                  res.end();
                  return;
                });
              });
            });
          });
        });
      });
  });
});

router.get('/ip', function(req, res) {

  var ip = req.headers['x-forwarded-for'] ||
     req.connection.remoteAddress ||
     req.socket.remoteAddress ||
     req.connection.socket.remoteAddress;

  //var ip_info = get_ip(req);
  res.json({ip: ip});
});

router.get('/group', function(req, res){
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
      res.status(401).send('Not authorized');
      return;
    }
    groups_db.find({}, function(err, groups){
      res.send(groups);
      return;
    });
  });
});

router.post('/message', function(req, res){

    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }

    if(! notif.mailSet()){
      res.status(403).send("Mail provider is not set");
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
      var message = req.param('message');
      var html_message = req.param('message');

      if(req.param('input') === "Markdown"){
        html_message = markdown.toHTML(req.param('message'));
        message =  htmlToText.fromString(html_message);
      } else if (req.param('input') === "HTML"){
        message =  htmlToText.fromString(html_message);
      }
      var mailOptions = {
                     //origin: MAIL_CONFIG.origin,
                     origin: req.param('from'),
                     subject: req.param('subject'),
                     message: message,
                     html_message: html_message
                   };
      notif.sendList(req.param('list'), mailOptions, function(err, response) {
        res.send("");
        return;
      });
    });
});

// Get users listing - for admin
router.get('/user', function(req, res) {
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
      res.status(401).send('Not authorized');
      return;
    }
    users_db.find({}, function(err, users){
      res.json(users);
    });
  });


});


router.post('/user/:id/group/:group', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
      res.status(401).send('Not authorized');
      return;
    }
    var uid = req.param('id');
    var secgroup = req.param('group');
    users_db.findOne({uid: uid}, function(err, user){
        if(err || user == null){
          res.status(404).send('User not found');
          return;
        }
        if(secgroup == user.group) {
            res.send({message: 'Group is user main\'s group: '+user.group});
            res.end();
            return;
        }
        for(var g=0;g < user.secondarygroups.length;g++){
            if(secgroup == user.secondarygroups[g]) {
                res.send({message: 'group is already set'});
                res.end();
                return;
            }
        }
        user.secondarygroups.push(secgroup);
        var fid = new Date().getTime();
        // Now add group
        goldap.change_user_groups(user, [secgroup], [], fid, function() {
            // remove from ldap
            // delete home
            var script = "#!/bin/bash\n";
            script += "set -e \n"
            script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";

            var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
            fs.writeFile(script_file, script, function(err) {
                fs.chmodSync(script_file,0o755);

                users_db.update({_id: user._id}, {'$set': { secondarygroups: user.secondarygroups}}, function(err){
                    if(err){
                        res.send({message: 'Could not update user'});
                        res.end();
                        return;
                    }
                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'add user ' + req.param('id') + ' to secondary  group ' + req.param('group') , 'logs': [user.uid+"."+fid+".update"]}, function(err){});
                    res.send({message: 'User added to group', fid: fid});
                    res.end();
                    return;
                });
            });
        });
    });
  });

});

router.delete('/user/:id/group/:group', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
      res.status(401).send('Not authorized');
      return;
    }
    var uid = req.param('id');
    var secgroup = req.param('group');
    users_db.findOne({uid: uid}, function(err, user){
      if(secgroup == user.group) {
        res.send({message: 'Group is user main\'s group: '+user.group});
        res.end();
        return;
      }
      var present = false;
      var newgroup = [];
      for(var g=0;g < user.secondarygroups.length;g++){
        if(secgroup == user.secondarygroups[g]) {
          present = true;
        }
        else {
          newgroup.push(user.secondarygroups[g]);
        }
      }
      if(! present) {
        res.send({message: 'group is not set'});
        res.end();
        return;
      }
      user.secondarygroups = newgroup;
      var fid = new Date().getTime();
      // Now add group
      goldap.change_user_groups(user, [], [secgroup], fid, function() {
        // remove from ldap
        // delete home
        var script = "#!/bin/bash\n";
        script += "set -e \n"
        script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";

        var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
        fs.writeFile(script_file, script, function(err) {
          fs.chmodSync(script_file,0o755);

          users_db.update({_id: user._id}, {'$set': { secondarygroups: user.secondarygroups}}, function(err){
            if(err){
              res.send({message: 'Could not update user'});
              res.end();
              return;
            }
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove user ' + req.param('id') + ' from secondary  group ' + req.param('group') , 'logs': [user.uid+"."+fid+".update"]}, function(err){});
            users_db.find({'$or': [{'secondarygroups': secgroup}, {'group': secgroup}]}, function(err, users_in_group){
              if(users_in_group && users_in_group.length > 0){
                res.send({message: 'User removed from group', fid: fid});
                res.end();
                return;
              }
              // If group is empty, delete it
              groups_db.findOne({name: secgroup}, function(err, group){
                if(err || !group) {
                  res.send({message: 'User removed from group', fid: fid});
                  res.end();
                  return;
                }
                router.delete_group(group, session_user.uid).then(function(){
                  res.send({message: 'User removed from group. Empty group ' + secgroup + ' was deleted'});
                  res.end();
                  return;
                });
              });
            });
          });
        });
      });
    });
  });
});

router.delete_user = function(user, action_owner_id){
    return new Promise(function (resolve, reject){
         if(user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL){
             users_db.remove({_id: user._id}).then(function(){
                 events_db.insert(
                     {
                         'owner': action_owner_id,
                         'date': new Date().getTime(),
                         'action': 'delete user ' + user.uid ,
                         'logs': []
                     }
                 ).then(function(){
                   return utils.freeUserId(user.uidnumber)
                 }).then(function(){
                     resolve(true);
                 });
		 router.clear_user_groups(user, action_owner_id);
             });
         }
         else {
             var fid = new Date().getTime();
             // Remove user from groups
             var allgroups = user.secondarygroups;
             allgroups.push(user.group);
             goldap.change_user_groups(user, [], allgroups, fid, function() {
               // remove from ldap
               // delete home
               var script = "#!/bin/bash\n";
               //script += "set -e \n"
               script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
               script += "ldapdelete -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn +" \"uid="+user.uid+",ou=people,"+CONFIG.ldap.dn+"\"\n";
               script += "rm -rf "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"\n";
               // script += "rm -rf /omaha-beach/"+user.uid+"\n";
               script += utils.deleteExtraDirs(user.uid, user.group);

               var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
               fs.writeFile(script_file, script, function(err) {
                 fs.chmodSync(script_file,0o755);
                 users_db.remove({_id: user._id}, function(err){
                   if(err){
                     resolve(false);
                     return;
                   }
		   router.clear_user_groups(user, action_owner_id);
                   var msg_activ ="User " + user.uid + " has been deleted by " + action_owner_id;
                   var msg_activ_html = msg_activ;
                   var mailOptions = {
                     origin: MAIL_CONFIG.origin, // sender address
                     destinations:  [GENERAL_CONFIG.accounts], // list of receivers
                     subject: GENERAL_CONFIG.name + ' account deletion: ' +user.uid, // Subject line
                     message: msg_activ, // plaintext body
                     html_message: msg_activ_html // html body
                   };
                   events_db.insert(
                       {
                           'owner': action_owner_id,
                           'date': new Date().getTime(),
                           'action': 'delete user ' + user.uid ,
                           'logs': [user.uid+"."+fid+".update"]
                       }

                   ).then(function(){
                       // Call remove method of plugins if defined
                       var plugin_call = function(plugin_info, userId, user, adminId){
                           return new Promise(function (resolve, reject){
                               if(plugins_modules[plugin_info.name].remove === undefined) {
                                   resolve(true);
                               }
                               plugins_modules[plugin_info.name].remove(userId, user, adminId).then(function(){
                                   resolve(true);
                               });
                           });
                       };
                       return Promise.all(plugins_info.map(function(plugin_info){
                           return plugin_call(plugin_info, user.uid, user, action_owner_id);
                       }));
                   })
                   .then(function(){
                     return utils.freeUserId(user.uidnumber)
                   })
                   .then(function(){
                       if(notif.mailSet()) {
                         notif.sendUser(mailOptions, function(error, response){
                             resolve(true);
                         });
                       }
                       else {
                           resolve(true);
                       }
                   });

                 });
               });
             });
         }
    });
};

router.delete('/user/:id', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
    if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
      res.status(401).send('Not authorized');
      return;
    }

    var uid = req.param('id');
    users_db.findOne({uid: uid}, function(err, user){
      if(err) {
            res.send({message: 'User not found '+req.param('id')});
            res.end();
            return;
      }
      if(user.status == STATUS_PENDING_EMAIL || user.status == STATUS_PENDING_APPROVAL){
          router.delete_user(user, session_user.uid).then(function(){
              res.send({message: 'User deleted'});
              res.end();
              return;
          });

      }
      else {
      // Must check if user has databases and sites
      // Do not remove in this case, owners must be changed before
      databases_db.find({owner: uid}, function(err, databases){
        if(databases && databases.length>0) {
          res.send({message: 'User owns some databases, please change owner first!'});
          res.end();
          return;
        }
        web_db.find({owner: uid}, function(err, websites){
          if(websites && websites.length>0) {
            res.send({message: 'User owns some web sites, please change owner first!'});
            res.end();
            return;
          }
          router.delete_user(user, session_user.uid).then(function(){
              res.send({message: 'User deleted'});
              res.end();
              return;
          });
        });
      });
      }
    });

  });

});

// activate user
router.get('/user/:id/activate', function(req, res) {

    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }

    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
      if(err || session_user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
      }

      users_db.findOne({uid: req.param('id')}, function(err, user){
        if(!user) {
          res.status(403).send('User does not exists')
          res.end();
          return;
        }
        if(user.maingroup == undefined || user.group == undefined) {
          res.status(403).send('Group or main group directory are not set');
          res.end();
          return;
        }
        user.password = Math.random().toString(36).slice(-10);
        //var minuid = 1000;
        //var mingid = 1000;
        utils.getUserAvailableId().then(function (minuid) {
        //users_db.find({}, { limit: 1 , sort: { uidnumber: -1 }}, function(err, data){
          //if(!err && data && data.length>0){
          //  minuid = data[0].uidnumber+1;
          //}
          groups_db.findOne({'name': user.group}, function(err, data){
            if(err || data === undefined || data === null) {
              res.status(403).send('Group '+user.group+' does not exists, please create it first')
                res.end();
                return
            }

            user.uidnumber = minuid;
            user.gidnumber = data.gid;
            var fid = new Date().getTime();
            goldap.add(user, fid, function(err) {
              if(!err){
                users_db.update({uid: req.param('id')},{'$set': {status: STATUS_ACTIVE, uidnumber: minuid, gidnumber: user.gidnumber, expiration: new Date().getTime() + 1000*3600*24*user.duration}, '$push': { history: {action: 'validation', date: new Date().getTime()}} }, function(err){
                  //groups_db.update({'name': user.group}, {'$set': { 'gid': user.gidnumber}}, {upsert:true}, function(err){

                    var script = "#!/bin/bash\n";
                    script += "set -e \n"
                    script += "ldapadd -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
                    script += "if [ -e "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif"+" ]; then\n"
                    script += "\tldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif\n";
                    script += "fi\n"
                    script += "sleep 3\n";
                    script += "mkdir -p "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh\n";
                    script += utils.addReadmes(CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid);
                    /*
                    script += "mkdir -p "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/user_guides\n";
                    if (typeof CONFIG.general.readme == "object") {
                      CONFIG.general.readme.forEach(function(dict) {
                        script += "ln -s " + dict.source_folder + " "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/user_guides/" + dict.language + "\n";
                      });
                    } else {
                      script += "ln -s " + CONFIG.general.readme + " "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/user_guides/README\n";
                    };
                    */
                    script += "touch "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/authorized_keys\n";
                    script += "echo \"Host *\" > "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/config\n";
                    script += "echo \"  StrictHostKeyChecking no\" >> "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/config\n";
                    script += "echo \"   UserKnownHostsFile=/dev/null\" >> "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh/config\n";
                    script += "chmod 700 "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"/.ssh\n";
                    // script += "mkdir -p /omaha-beach/"+user.uid+"\n";
                    script += "chown -R "+user.uidnumber+":"+user.gidnumber+" "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+'/'+user.uid+"\n";
                    // script += "chown -R "+user.uidnumber+":"+user.gidnumber+" /omaha-beach/"+user.uid+"\n";
                    script += utils.addExtraDirs(user.uid, user.group, user.uidnumber, user.gidnumber);
                    var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
                    fs.writeFile(script_file, script, function(err) {
                      fs.chmodSync(script_file,0o755);
                      notif.add(user.email, function(){
                        var msg_activ = CONFIG.message.activation.join("\n").replace(/#UID#/g, user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"\n"+CONFIG.message.footer.join("\n");
                        var msg_activ_html = CONFIG.message.activation_html.join("").replace(/#UID#/g, user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"<br/>"+CONFIG.message.footer.join("<br/>");
                        var mailOptions = {
                          origin: MAIL_CONFIG.origin, // sender address
                          destinations: [user.email], // list of receivers
                          subject: GENERAL_CONFIG.name + ' account activation', // Subject line
                          message: msg_activ, // plaintext body
                          html_message: msg_activ_html // html body
                        };
                        events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'activate user ' + req.param('id') , 'logs': [user.uid+"."+fid+".update"]}, function(err){});

                        var plugin_call = function(plugin_info, userId, data, adminId){
                            return new Promise(function (resolve, reject){
                                plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                                    resolve(true);
                                });
                            });
                        };
                        Promise.all(plugins_info.map(function(plugin_info){
                            return plugin_call(plugin_info, user.uid, user, session_user.uid);
                        })).then(function(results){
                            return send_notif(mailOptions, fid, []);
                        }, function(err){
                            return send_notif(mailOptions, fid, err);
                        }).then(function(errs){
                            res.send({msg: 'Activation in progress', fid: fid, error: errs});
                            res.end();
                            return;
                        });


                      });
                    });
                  //});
                });

              }
              else {
                res.send({msg: err});
              }
            });



          });
        });

      });


    });

});

// Get user - for logged user or admin
router.get('/user/:id', function(req, res) {
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized, need to login first');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){

    users_db.findOne({uid: req.param('id')}, function(err, user){
      if(err){
        res.status(404).send('User not found ' + err);
        return;
      }
      if(user.is_fake===undefined) {
        user.is_fake = false;
      }
      if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        user.is_admin = true;
      }
      else {
        user.is_admin = false;
      }
      user.quota = []
      for(var k in GENERAL_CONFIG.quota) {
          user.quota.push(k);
      }

      if(session_user._id.str == user._id.str || GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0){
        res.json(user);
        return;
      }
      else {
        res.status(401).send('Not authorized to access this user info');
        return;
      }

    });

  });
});

// Registration mail confirmation
router.get('/user/:id/confirm', function(req, res) {
  var uid = req.param('id');
  var regkey = req.param('regkey');
  users_db.findOne({uid: uid}, function(err, user) {
    if(! user) {
      res.status(401).send('Invalid user');
      return;
    }
    else {
        if(user.regkey == regkey) {
          //if(user.status == STATUS_PENDING_APPROVAL) {
          if(user.status != STATUS_PENDING_EMAIL) {
            // Already pending or active
            res.redirect(GENERAL_CONFIG.url+'/manager/index.html#/pending');
            res.end();
            return;
          }
          var account_event = {action: 'email_confirm', date: new Date().getTime()};
          users_db.update({ _id: user._id},
                          { $set: {status: STATUS_PENDING_APPROVAL},
                            $push: {history: account_event}
                          }, function(err) {});
          var mailOptions = {
            origin: MAIL_CONFIG.origin, // sender address
            destinations: [GENERAL_CONFIG.accounts], // list of receivers
            subject: GENERAL_CONFIG.name + ' account registration: '+uid, // Subject line
            message: 'New account registration waiting for approval: '+uid, // plaintext body
            html_message: 'New account registration waiting for approval: '+uid // html body
          };
          events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user confirmed email:' + req.param('id') , 'logs': []}, function(err){});
          if(notif.mailSet()) {
            notif.sendUser(mailOptions, function(error, response){
              if(error){
                logger.error(error);
              }
              res.redirect(GENERAL_CONFIG.url+'/manager/index.html#/pending');
              res.end();
              return;
            });
          }
          else {
            res.redirect(GENERAL_CONFIG.url+'/manager/index.html#/pending');
            res.end();
          }
        }
        else {
          res.status(401).send('Invalid registration key');
          return;
        }
    }
  });
});



// Register
router.post('/user/:id', function(req, res) {
  logger.info('New register request for '+req.param('id'));
  if(req.param('ip').split('.').length != 4) {
    res.send({'status': 1, 'msg': 'invalid ip address format'});
    return;
  }
  if(req.param('group')=='' || req.param('group')==null || req.param('group')==undefined) {
    res.send({'status': 1, 'msg': 'Missing field: team'});
    return;
  }
  if (!req.param('group').match(/^[0-9a-z_]+$/)) {
    res.send({'status': 1, 'msg': 'Group/Team name must be alphanumeric [0-9a-z_]'});
    res.end();
    return;
  }

  if(req.param('lab')=='' || req.param('lab')==null || req.param('lab')==undefined) {
    res.send({'status': 1, 'msg': 'Missing field: lab'});
    return;
  }
  if(req.param('address')=='' || req.param('address')==null || req.param('address')==undefined) {
    res.send({'status': 1, 'msg': 'Missing field: address'});
    return;
  }

  if(req.param('responsible')=='' || req.param('responsible')==null || req.param('responsible')==undefined) {
    res.send({'status': 1, 'msg': 'Missing field: Responsible/Manager'});
    return;
  }
  if(!req.param('id').match(/^[0-9a-z]+$/)){
    res.send({'status': 1, 'msg': 'invalid data identifier, numeric and lowercase letters only'});
    return;
  }

  if (req.param('id').length > 12) {
    res.send({'status': 1, 'msg': 'user id too long, must be < 12 characters'});
    res.end();
    return;
  }

  if(req.param('why')=='' || req.param('why')==null || req.param('why')==undefined) {
    res.send({'status': 1, 'msg': 'Missing field: Why do you need an account'});
    return;
  }


  users_db.findOne({uid: req.param('id')}, function(err, user){
      if(user){
        res.send({'status': 1, 'msg': 'User id already exists'});
        //res.status(403).send('User id already exists');
        return;
      }

      var regkey = Math.random().toString(36).substring(7);
      var default_main_group = GENERAL_CONFIG.default_main_group || "";
      var user = {
        status: STATUS_PENDING_EMAIL,
        uid: req.param('id'),
        firstname: req.param('firstname'),
        lastname: req.param('lastname'),
        email: req.param('email'),
        address: req.param('address'),
        lab: req.param('lab'),
        responsible: req.param('responsible'),
        group: req.param('group'),
        secondarygroups: [],
        maingroup: default_main_group,
        why: req.param('why'),
        ip: req.param('ip'),
        regkey: regkey,
        is_genouest: false,
        is_fake: false,
        uidnumber: -1,
        gidnumber: -1,
        cloud: false,
        duration: req.param('duration'),
        expiration: new Date().getTime() + 1000*3600*24*req.param('duration'),
        loginShell: '/bin/bash',
        history: [{action: 'register', date: new Date().getTime()}]
      }

      events_db.insert({'owner': req.param('id'), 'date': new Date().getTime(), 'action': 'user registration ' + req.param('id') , 'logs': []}, function(err){});

      var uid = req.param('id');
      users_db.insert(user);
      var link = GENERAL_CONFIG.url +
                  encodeURI('/user/'+uid+'/confirm?regkey='+regkey);
      var msg_activ = CONFIG.message.emailconfirmation.join("\n").replace('#LINK#', link).replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"\n"+CONFIG.message.footer.join("\n");
      var msg_activ_html = CONFIG.message.emailconfirmationhtml.join("").replace('#LINK#', '<a href="'+link+'">'+link+'</a>').replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"<br/>"+CONFIG.message.footer.join("<br/>");
      var mailOptions = {
        origin: MAIL_CONFIG.origin, // sender address
        destinations: [user.email], // list of receivers
        subject: GENERAL_CONFIG.name + ' account registration', // Subject line
        message: msg_activ,
        html_message: msg_activ_html
      };
      if(notif.mailSet()) {
        notif.sendUser(mailOptions, function(error, response){
          if(error){
            logger.error(error);
          }
          res.send({'status': 0, 'msg': 'A confirmation email has been sent, please check your mailbox to validate your account creation. Once validated, the platform team will analyse your request and validate it.'});
          res.end();
          return;
        });
      }
      else {
        res.send({'status': 0, 'msg': 'Could not send an email, please contact the support.'});
        res.end();
        return;
      }

  });
});

router.get('/user/:id/expire', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
    users_db.findOne({uid: req.param('id')}, function(err, user){
      if(err){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
      }
      else {
        session_user.is_admin = false;
      }
      if(session_user.is_admin){
        var new_password = Math.random().toString(36).slice(-10);
        user.password = new_password;
        var fid = new Date().getTime();
        goldap.reset_password(user, fid, function(err) {
          if(err){
            res.send({message: 'Error during operation'});
            return;
          }
          else {
            user.history.push({'action': 'expire', date: new Date().getTime()});
            users_db.update({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}}, function(err){
              var script = "#!/bin/bash\n";
              script += "set -e \n"
              script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
              script += "if [ -e ~"+user.uid+"/.ssh/authorized_keys ]; then\n";
              script += "  mv  ~"+user.uid+"/.ssh/authorized_keys ~"+user.uid+"/.ssh/authorized_keys.expired\n";
              script += "fi\n";

              var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
              fs.writeFile(script_file, script, function(err) {
                events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'user expiration:' + req.param('id') , 'logs': [user.uid+"."+fid+".update"]}, function(err){});

                fs.chmodSync(script_file,0o755);
                // Now remove from mailing list
                try {
                  notif.remove(user.email, function(err){
                      var plugin_call = function(plugin_info, userId, user, adminId){
                          return new Promise(function (resolve, reject){
                              plugins_modules[plugin_info.name].deactivate(userId, user, adminId).then(function(){
                                  resolve(true);
                              });
                          });
                      };
                      Promise.all(plugins_info.map(function(plugin_info){
                          return plugin_call(plugin_info, user.uid, user, session_user.uid);
                      })).then(function(data){
                          res.send({message: 'Operation in progress', fid: fid, error: []});
                          res.end();
                          return;
                      }, function(errs){
                          res.send({message: 'Operation in progress', fid: fid, error: errs});
                          res.end();
                      });
                    });
                }
                catch(err) {
                    res.send({message: 'Operation in progress, user not in mailing list', fid: fid, error: error});
                    res.end();
                    return;
                }
              });

              return;
            });
          }
        });

      }
      else {
        res.status(401).send('Not authorized');
        return;
      }

    });
  });

});
router.post('/user/:id/passwordreset', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
      if(session_user.uid != req.param('id')) {
         res.send({message: 'Not authorized'});
         return;
      }
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(err || !user) {
      res.status(404).send('User does not exists:'+req.param('id'));
      res.end();
      return;
    }
    if(user.status != STATUS_ACTIVE){
      res.status(401).send("Your account is not active");
      res.end();
      return;
    }
    user.password=req.param('password');
    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.param('id') + ' password update request', 'logs': []}, function(err){});
        var fid = new Date().getTime();
        goldap.reset_password(user, fid, function(err) {
        if(err){
          res.send({message: 'Error during operation'});
          return;
        }
        else {
            var script = "#!/bin/bash\n";
            script += "set -e \n"
            script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
            var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
            fs.writeFile(script_file, script, function(err) {
              fs.chmodSync(script_file,0o755);
              res.send({message:'Password updated'});
              return;
           });
        }
    });

  });
  });
});
//app.get('/user/:id/passwordreset', users);
router.get('/user/:id/passwordreset', function(req, res){
  var key = Math.random().toString(36).substring(7);
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(err || !user) {
      res.status(404).send('User does not exists');
      res.end();
      return;
    }
    if(user.status != STATUS_ACTIVE){
      res.status(401).send("Your account is not active");
      res.end();
      return;
    }
    users_db.update({uid: req.param('id')},{'$set': {regkey: key}}, function(err){
      if(err) {
        res.status(404).send('User cannot be updated');
        res.end();
        return;
      }
      user.password='';
      // Now send email
      var link = CONFIG.general.url +
                encodeURI('/user/'+req.param('id')+'/passwordreset/'+key);
      var html_link = "<a href=\""+link+"\">"+link+"</a>";
      var msg = CONFIG.message.password_reset_request.join("\n").replace('#UID#', user.uid)+"\n"+link+"\n"+CONFIG.message.footer.join("\n");
      var html_msg = CONFIG.message.password_reset_request_html.join("").replace('#UID#', user.uid).replace('#LINK#', html_link)+CONFIG.message.footer.join("<br/>");
      var mailOptions = {
        origin: MAIL_CONFIG.origin, // sender address
        destinations: [user.email], // list of receivers
        subject: GENERAL_CONFIG.name + ' account password reset request',
        message: msg,
        html_message: html_msg
      };
      events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'user ' + req.param('id') + ' password reset request', 'logs': []}, function(err){});

      if(notif.mailSet()) {
        notif.sendUser(mailOptions, function(error, response){
          if(error){
            logger.error(error);
          }
          res.send({message: 'Password reset requested, check your inbox for instructions to reset your password.'});
        });
      }
      else {
        res.send({message: 'Could not send an email, please contact the support'})
      }
    });

  });
});

router.get('/user/:id/passwordreset/:key', function(req, res){
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(err) {
      res.status(404).send('User does not exists');
      res.end();
      return;
    }
    if(req.param('key') == user.regkey) {
      // reset the password
      var new_password = Math.random().toString(36).slice(-10);
      user.password = new_password;
      var fid = new Date().getTime();
      goldap.reset_password(user, fid, function(err) {
        if(err){
          res.send({message: 'Error during operation'});
          return;
        }
        else {
          user.history.push({'action': 'password reset', date: new Date().getTime()});
          users_db.update({uid: user.uid},{'$set': {history: user.history}}, function(err){
            var script = "#!/bin/bash\n";
            script += "set -e \n"
            script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
            var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
            fs.writeFile(script_file, script, function(err) {
              fs.chmodSync(script_file,0o755);
              // Now send email
              var msg = CONFIG.message.password_reset.join("\n").replace('#UID#', user.uid).replace('#PASSWORD#', user.password)+"\n"+CONFIG.message.footer.join("\n");
              var msg_html = CONFIG.message.password_reset_html.join("").replace('#UID#', user.uid).replace('#PASSWORD#', user.password)+"<br/>"+CONFIG.message.footer.join("<br/>");
              var mailOptions = {
                origin: MAIL_CONFIG.origin, // sender address
                destinations: [user.email], // list of receivers
                subject: GENERAL_CONFIG.name + ' account password reset',
                message: msg,
                html_message: msg_html
              };
              events_db.insert({'owner': user.uid,'date': new Date().getTime(), 'action': 'user password ' + req.param('id') + ' reset confirmation', 'logs': [user.uid+"."+fid+".update"]}, function(err){});

              if(notif.mailSet()) {
                notif.sendUser(mailOptions, function(error, response){
                  if(error){
                    logger.error(error);
                  }
                  res.redirect(GENERAL_CONFIG.url+'/manager/index.html#/passwordresetconfirm');
                  res.end();
                });
              }
              else {
                res.send({message: 'Could not send an email, please contact the support'})
              }
            });
          });
        }
      });

    }
    else {
      res.status(401).send('Invalid authorization key.');
      return;
    }
  });
});

/**
* Extend validity period if active
*/
router.get('/user/:id/renew/:regkey', function(req, res){
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(err){
      res.status(404).send('User not found');
      return;
    }
    if(user.status != STATUS_ACTIVE) {
      res.status(401).send('Not authorized');
      return;
    }
    var regkey = req.param('regkey');
    if(user.regkey == regkey) {
      user.history.push({'action': 'extend validity period', date: new Date().getTime()});
      var expiration = new Date().getTime() + 1000*3600*24*user.duration;
      users_db.update({uid: user.uid},{'$set': {expiration: expiration, history: user.history}}, function(err){
         events_db.insert({'owner': user.uid,'date': new Date().getTime(), 'action': 'Extend validity period: ' + req.param('id') , 'logs': []}, function(err){});

        res.send({message: 'Account validity period extended', expiration: expiration});
        return;
      });
    }
    else {
      res.status(401).send('Not authorized');
      return;
    }
  });
});

router.get('/user/:id/renew', function(req, res){
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
    users_db.findOne({uid: req.param('id')}, function(err, user){
      if(err){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
      }
      else {
        session_user.is_admin = false;
      }
      if(session_user.is_admin){
        var new_password = Math.random().toString(36).slice(-10);
        user.password = new_password;
        var fid = new Date().getTime();
        goldap.reset_password(user, fid, function(err) {
          if(err){
            res.send({message: 'Error during operation'});
            return;
          }
          else {
            user.history.push({'action': 'reactivate', date: new Date().getTime()});
            users_db.update({uid: user.uid},{'$set': {status: STATUS_ACTIVE, expiration: (new Date().getTime() + 1000*3600*24*user.duration), history: user.history}}, function(err){
              var script = "#!/bin/bash\n";
              script += "set -e \n"
              script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
              script += "if [ -e ~"+user.uid+"/.ssh/authorized_keys.expired ]; then\n";
              script += "  mv  ~"+user.uid+"/.ssh/authorized_keys.expired ~"+user.uid+"/.ssh/authorized_keys\n";
              script += "fi\n";
              var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
              fs.writeFile(script_file, script, function(err) {
                events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'Reactivate user ' + req.param('id') , 'logs': [user.uid+"."+fid+".update"]}, function(err){});
                fs.chmodSync(script_file,0o755);
                notif.add(user.email, function(){
                  var msg_activ = CONFIG.message.reactivation.join("\n").replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"\n"+CONFIG.message.footer.join("\n");
                  var msg_activ_html = CONFIG.message.reactivation_html.join("").replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"<br/>"+CONFIG.message.footer.join("<br/>");

                  var mailOptions = {
                    origin: MAIL_CONFIG.origin, // sender address
                    destinations: [user.email], // list of receivers
                    subject: GENERAL_CONFIG.name + ' account reactivation', // Subject line
                    message: msg_activ, // plaintext body
                    html_message: msg_activ_html // html body
                  };
                  var plugin_call = function(plugin_info, userId, data, adminId){
                      return new Promise(function (resolve, reject){
                          plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                              resolve(true);
                          });
                      });
                  };
                  Promise.all(plugins_info.map(function(plugin_info){
                      return plugin_call(plugin_info, user.uid, user, session_user.uid);
                  })).then(function(results){
                      return send_notif(mailOptions, fid, []);
                  }, function(err){
                      return send_notif(mailOptions, fid, err);
                  }).then(function(errs){
                      res.send({message: 'Activation in progress', fid: fid, error: errs});
                      res.end();
                      return;
                  });
                });
              });

              return;
            });
          }
        });

      }
      else {
        res.status(401).send('Not authorized');
        return;
      }

    });
  });

});


router.put('/user/:id/ssh', function(req, res) {
  var sess = req.session;
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
      if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
      }
      else {
        session_user.is_admin = false;
      }

      users_db.findOne({uid: req.param('id')}, function(err, user){
        // If not admin nor logged user
        if(!session_user.is_admin && user._id.str != req.locals.logInfo.id.str) {
          res.status(401).send('Not authorized');
          return;
        }
        // Update SSH Key
        users_db.update({_id: user._id}, {'$set': {ssh: req.param('ssh')}}, function(err){
          user.ssh = escapeshellarg(req.param('ssh'));
          var script = "#!/bin/bash\n";
          script += "set -e \n";
          script += "if [ ! -e ~"+user.uid+"/.ssh ]; then\n";
          script += "  mkdir -p ~"+user.uid+"/.ssh\n";
          script += "  chmod -R 700 ~"+user.uid+"/.ssh\n";
          script += "  touch  ~"+user.uid+"/.ssh/authorized_keys\n";
          script += "  chown -R "+user.uidnumber+":"+user.gidnumber+" ~"+user.uid+"/.ssh/\n";
          script += "fi\n";
          script += "echo "+user.ssh+" >> ~"+user.uid+"/.ssh/authorized_keys\n";
          var fid = new Date().getTime();
          var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
          fs.writeFile(script_file, script, function(err) {
            events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'SSH key update: ' + req.param('id') , 'logs': [user.uid+"."+fid+".update"]}, function(err){});

            fs.chmodSync(script_file,0o755);
            user.fid = fid;
            user.ssh = req.param('ssh');
            res.send(user);
            res.end();
            return;
          });

        });
      });
    });
});


router.get('/user/:id/usage', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        usage=JSON.parse(JSON.stringify(CONFIG.usage));
        usages = [];
        for(var i=0;i<usage.length;i++){
            usage[i]['link'] = usage[i]['link'].replace('#USER#', req.param('id'))
            usages.push(usage[i]);
        }
        res.send({'usages': usages})
        res.end();
        return;
    });
});

// Update user info
router.put('/user/:id', function(req, res) {
  /*
  uid: req.param('id'),
  firstname: req.param('firstname'),
  lastname: req.param('lastname'),
  email: req.param('email'),
  address: req.param('address'),
  lab: req.param('lab'),
  responsible: req.param('responsible'),
  group: req.param('group'),
  ip: req.param('ip'),
  regkey: regkey,
  is_genouest: false,
  expiration: new Date().getTime() + 1000*3600*24*req.param('duration'),
  loginShell: '/bin/bash',
  history: [{action: 'register', date: new Date().getTime()}],
  is_fake: false
  */

  var sess = req.session;
  /*
  if(sess.apikey !== undefined && sess.apikey) {
    // Forbids by api key to avoid modyfing email address
    res.status(401).send('Operation not authorized by API key');
    return;
  }*/
  if(! req.locals.logInfo.is_logged) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
      if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
      }
      else {
        session_user.is_admin = false;
      }

      users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
          res.status(401).send('Not authorized');
          return;
        }
        // If not admin nor logged user
        if(!session_user.is_admin && user._id.str != req.locals.logInfo.id.str) {
          res.status(401).send('Not authorized');
          return;
        }

        user.firstname = req.param('firstname');
        user.lastname = req.param('lastname');
        user.oldemail = user.email;
        user.email = req.param('email');
        if(user.is_fake === undefined) {
            user.is_fake = false;
        }
        userWasFake = user.is_fake;

        if(session_user.is_admin){
           user.is_fake = req.param('is_fake');
           if(req.param('is_trainer') !== undefined ){
               user.is_trainer = req.param('is_trainer');
           }
        }

        if(user.email == '' || user.firstname == '' || user.lastname == '') {
          if(! user.is_fake) {
              res.status(403).send('Some mandatory fields are empty');
              return;
          }
        }
        user.loginShell = req.param('loginShell').trim();
        user.address = req.param('address');
        user.lab = req.param('lab');
        user.responsible = req.param('responsible');
        user.why = req.param('why');
        user.duration = req.param('duration');

        var is_admin = false;
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0) {
          is_admin = true;
        }

        user.history.push({'action': 'update info', date: new Date().getTime()});

        // Get group gid
        //groups_db.findOne({'name': user.group}, function(err, group){
        groups_db.findOne({'name': req.param('group')}, function(err, group){
          if(err || group == null || group == undefined) {
            res.status(403).send('Group '+req.param('group')+' does not exists, please create it first');
            return;
          }
          if(session_user.is_admin){
            if(user.secondarygroups.indexOf(group.name) != -1) {
                res.status(403).send('Group '+req.param('group')+' is already a secondary group, please remove user from secondary group first!');
                return;
            }
            user.oldgroup = user.group;
            user.oldgidnumber = user.gidnumber;
            user.oldmaingroup = user.maingroup;
            user.group = req.param('group');
            user.gidnumber = group.gid;
            user.ip = req.param('ip');
            user.is_genouest = req.param('is_genouest');
            user.maingroup = req.param('maingroup');
            if(user.group == '' || user.group == null) {
              res.status(403).send('Some mandatory fields are empty');
              return;
            }
          }

          if(user.status == STATUS_ACTIVE){
            users_db.update({_id: user._id}, user, function(err){
              if(session_user.is_admin) {
                user.is_admin = true;
              }
              var fid = new Date().getTime();
              goldap.modify(user, fid, function(err){
                  if(err) {
                    res.status(403).send('Group '+user.group+' does not exists, please create it first');
                    return;
                  }
                  var script = "#!/bin/bash\n";
                  script += "set -e \n"
                  script += "ldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
                  if(session_user.is_admin) {
                    if(user.oldgroup != user.group || user.oldmaingroup != user.maingroup) {
                      // If group modification, change home location
                      script += "if [ ! -e "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+" ]; then\n"
                      script += "\tmkdir -p "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+"\n";
                      script += "fi\n";
                      script += "mv "+CONFIG.general.home+"/"+user.oldmaingroup+"/"+user.oldgroup+"/"+user.uid+" "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+"/\n";
                      script += "chown -R "+user.uidnumber+":"+user.gidnumber+" "+CONFIG.general.home+"/"+user.maingroup+"/"+user.group+"/"+user.uid+"\n";
                      script += utils.moveExtraDirs(user.uid, user.oldgroup, user.group, user.uidnumber, user.gidnumber);
                      events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'change group from ' + user.oldmaingroup + '/' + user.oldgroup + ' to ' + user.maingroup + '/' + user.group , 'logs': []}, function(err){});
                    }
                  }
                  var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
                  fs.writeFile(script_file, script, function(err) {
                    events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'User info modification: ' + req.param('id') , 'logs': [user.uid+"."+fid+".update"]}, function(err){});
		    users_db.find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}, function(err, users_in_group){
                      if(users_in_group && users_in_group.length == 0){
                        groups_db.findOne({name: user.oldgroup}, function(err, oldgroup){
                          if(oldgroup){
                            router.delete_group(oldgroup, session_user.uid);
                          }
                        })
                      }
                    });

                    fs.chmodSync(script_file,0o755);
                    user.fid = fid;
                    if(user.oldemail!=user.email && !user.is_fake) {
                      notif.modify(user.oldemail, user.email, function() {
                        res.send(user);
                      });
                    } else if(userWasFake && !user.is_fake) {
                      notif.add(user.email, function() {
                        res.send(user);
                      });
                    }else if (!userWasFake && user.is_fake) {
                      notif.remove(user.email, function(){
                        res.send(user);
                      })
                    } else {
                      res.send(user);
                    }
                  });
              });
            });
          }
          else {
            users_db.update({_id: user._id}, user, function(err){
              events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'Update user info ' + req.param('id') , 'logs': []}, function(err){});
	      users_db.find({'$or': [{'secondarygroups': user.oldgroup}, {'group': user.oldgroup}]}, function(err, users_in_group){
	        if(users_in_group && users_in_group.length == 0){
		  groups_db.findOne({name: user.oldgroup}, function(err, oldgroup){
                    if(oldgroup){
                      router.delete_group(oldgroup, session_user.uid);
                    }
                  })
		}
	      });
	      user.fid = null;
              res.send(user);
            });
          }
        });
        // End group

      });

  });

});

//TODO : Verify session user is admin or in project

router.get('/project/:id/users', function(req, res){
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
        users_db.find({'projects': req.param('id')}, function(err, users_in_project){
            res.send(users_in_project);
            res.end();
        });
    });
});

router.post('/user/:id/project/:project', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            res.end();
            return;
        }
        newproject = req.param('project');
        uid = req.param('id');
        var fid = new Date().getTime();
        users_db.findOne({uid: uid}, function(err, user){
            if(!user || err) {
                res.status(404).send('User does not exists')
                res.end();
                return;
            }
            if (!user.projects){
                user.projects = [];
            }
            for(var g=0; g < user.projects.length; g++){
                if(newproject == user.projects[g]) {
                    res.send({message:'User is already in project : nothing was done.'});
                    res.end();
                    return;
                }
            }
            user.projects.push(newproject);
            users_db.update({_id: user._id}, {'$set': { projects: user.projects}}, function(err){
                if(err){
                    res.status(403).send('Could not update user');
                    res.end();
                    return;
                }
                events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'add user ' + req.param('id') + ' to project ' + newproject , 'logs': []}, function(err){});
                res.send({message: 'User added to project', fid: fid});
                res.end();
                return;
            });
        });
    });
});

router.delete('/user/:id/project/:project', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            res.end();
            return;
        }
        oldproject = req.param('project');
        uid = req.param('id');
        var fid = new Date().getTime();
        users_db.findOne({uid: uid}, function(err, user){
            if(! user) {
                res.status(404).send('User ' + uid + ' not found');
                res.end();
                return;
            }
            projects_db.findOne({id:oldproject}, function(err, project){
                if(err){
                    logger.info(err);
                    res.status(500).send("Error");
                    res.end();
                    return;
                }
                if( project && uid === project.owner && ! req.param('force')){
                    res.status(403).send('Cannot remove project owner. Please change the owner before deletion');
                    res.end();
                    return;
                }
                tempprojects = [];
                for(var g=0; g < user.projects.length; g++){
                    if(oldproject != user.projects[g]) {
                        tempprojects.push(user.projects[g]);
                    }
                }
                users_db.update({_id: user._id}, {'$set': { projects: tempprojects}}, function(err){
                    if(err){
                        res.status(403).send('Could not update user');
                        res.end();
                        return;
                    }
                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'remove user ' + req.param('id') + ' from project ' + oldproject , 'logs': []}, function(err){});
                    res.send({message: 'User removed from project', fid: fid});
                    res.end();
                    return;
                });
            });
        });
    });
});

router.get('/list/:list', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        var list_name = req.param('list');
        notif.getMembers(list_name, function(members) {
            res.send(members);
            return;
        });
    });
});


router.get('/lists', function(req, res){
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(GENERAL_CONFIG.admin.indexOf(session_user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
        }
        notif.getLists(function(listOfLists) {
            res.send(listOfLists);
            return;
        });
    });
});

module.exports = router;
