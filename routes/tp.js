var express = require('express')
var router = express.Router()
// var bcrypt = require('bcryptjs')
var fs = require('fs')
// var escapeshellarg = require('escapeshellarg')

var Promise = require('promise')
const winston = require('winston')
const logger = winston.loggers.get('gomngr')
var CONFIG = require('config')
var GENERAL_CONFIG = CONFIG.general

var plugins = CONFIG.plugins

if (plugins === undefined) {
  plugins = []
}

var plugins_modules = {}
var plugins_info = []

for (var i = 0; i < plugins.length; i++) {
    if(plugins[i]['admin']) {
        continue;
    }
    plugins_modules[plugins[i].name] = require('../plugins/' + plugins[i].name)
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name})
}

var cookieParser = require('cookie-parser')

var goldap = require('../routes/goldap.js')
var notif = require('../routes/notif.js')
var fdbs = require('../routes/database.js')
var fwebs = require('../routes/web.js')
var fusers = require('../routes/users.js')
var notif = require('../routes/notif.js')

var utils = require('../routes/utils.js')

// var MAIL_CONFIG = CONFIG.gomail;

// var get_ip = require('ipware')().get_ip;

var monk = require('monk')
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db)
var users_db = db.get('users')
var groups_db = db.get('groups')
var reservation_db = db.get('reservations')
var events_db = db.get('events')

var STATUS_PENDING_EMAIL = 'Waiting for email approval'
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval'
var STATUS_ACTIVE = 'Active'
var STATUS_EXPIRED = 'Expired'

var createExtraGroup = function (ownerName) {
  return new Promise(function (resolve, reject) {
    // var mingid = 1000
    utils.getGroupAvailableId().then(function (mingid) {
    // groups_db.find({}, { limit: 1, sort: { gid: -1 } }, function (err, data) {
    //  if (!err && data && data.length > 0) {
    //    mingid = data[0].gid + 1
    //  }
      var fid = new Date().getTime()
      var group = { name: 'tp' + mingid, gid: mingid, owner: ownerName }
      groups_db.insert(group, function(err) {
        goldap.add_group(group, fid, function(err) {
          var script = "#!/bin/bash\n";
          script += "set -e \n"
          script += "ldapadd -h " + CONFIG.ldap.host + " -cx -w " + CONFIG.ldap.admin_password + " -D " + CONFIG.ldap.admin_cn + "," + CONFIG.ldap.admin_dn + " -f " + CONFIG.general.script_dir + "/" + group.name + "." + fid + ".ldif\n";
          var script_file = CONFIG.general.script_dir + '/' + group.name + "." + fid + ".update";
          fs.writeFile(script_file, script, function(err) {
            fs.chmodSync(script_file,0o755)
            group.fid = fid
            resolve(group)
            return
          })
        })
      })
    })
  })
}


var deleteExtraGroup = function (group) {
  return new Promise(function (resolve, reject) {
    if (group === undefined || group === null) {
        resolve()
        return
    }
    groups_db.findOne({'name': group.name}, function(err, group_to_remove){
        if(err || group_to_remove == null) {
            resolve()
            return
        }
        groups_db.remove({ 'name': group.name }, function () {
            var fid = new Date().getTime()
            goldap.delete_group(group, fid, function () {
            var script = "#!/bin/bash\n";
            script += "set -e \n"
            script += "ldapdelete -h " + CONFIG.ldap.host + " -cx -w " + CONFIG.ldap.admin_password + " -D " + CONFIG.ldap.admin_cn + "," + CONFIG.ldap.admin_dn + " -f " + CONFIG.general.script_dir + "/" + group.name + "." + fid + ".ldif\n";
            var script_file = CONFIG.general.script_dir + '/' + group.name + "." + fid + ".update"
            fs.writeFile(script_file, script, function(err) {
                fs.chmodSync(script_file,0o755);
                group.fid = fid;
                utils.freeGroupId(group.gid).then(function(){
                    events_db.insert({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'delete group ' + group.name , 'logs': [group.name+"."+fid+".update"] }, function(err){});
                    resolve()
                    return
                })

            })
            })
        })
    })
  })
}

var create_tp_users_db = function (owner, quantity, duration, end_date, userGroup) {
    // Duration in days
    return new Promise(function (resolve, reject){
        logger.debug("create_tp_users ", owner, quantity, duration);
        // TODO get account ids
        var minuid = 1000;
        //users_db.find({}, { limit: 1 , sort: { uidnumber: -1 }}).then(function(data){
            //if(data && data.length>0){
            //  minuid = data[0].uidnumber+1;
            //}
            var users = [];
            for(var i=0;i<quantity;i++){
                logger.debug("create user ", CONFIG.tp.prefix + minuid);
                var user = {
                  status: STATUS_PENDING_APPROVAL,
                  uid: CONFIG.tp.prefix + minuid,
                  firstname: CONFIG.tp.prefix,
                  lastname: minuid,
                  email: CONFIG.tp.prefix + minuid + "@fake." + CONFIG.tp.fake_mail_domain,
                  address: '',
                  lab: '',
                  responsible: owner,
                  group: userGroup.name,
                  secondarygroups: [],
                  maingroup: CONFIG.general.default_main_group,
                  home: "/tmp/home",
                  why: 'TP/Training',
                  ip: '',
                  regkey: '',
                  is_genouest: false,
                  is_fake: true,
                  uidnumber: minuid,
                  gidnumber: userGroup.gid,
                  duration: duration,
                  expiration: end_date + 1000*3600*24*(duration+CONFIG.tp.extra_expiration),
                  loginShell: '/bin/bash',
                  history: []
              };
              user.home = get_user_home(user);
              users.push(user);
              minuid++;
            }
            Promise.all(users.map(function(user){
                logger.debug("map users to create_tp_user_db ", user);
                return create_tp_user_db(user);
            })).then(function(results){
                logger.debug("now activate users");
                return activate_tp_users(owner, results);
            }).then(function(activated_users){
                resolve(activated_users);
            });
        //});
    });
};

var create_tp_user_db = function (user) {
    return new Promise(function (resolve, reject){
        logger.debug("create_tp_user_db", user.uid);
        try {
            utils.getUserAvailableId().then(function (uid) {
              user.uid = CONFIG.tp.prefix + uid
              user.lastname = uid
              user.email = CONFIG.tp.prefix + uid + "@fake." + CONFIG.tp.fake_mail_domain
              user.uidnumber = uid
              users_db.insert(user).then(function(data){
                user.password = Math.random().toString(36).substring(2);
                resolve(user);
              });
            })
        }
        catch(exception){
            logger.error(exception);
            reject(exception);
        }
    });
};

var send_user_passwords = function(owner, from_date, to_date, users){
    return new Promise(function (resolve, reject){
        logger.debug("send_user_passwords");
        var from = new Date(from_date);
        var to = new Date(to_date);
        msg = "TP account credentials from " + from.toDateString() + " to " + to.toDateString() + "\n\n";
        msg_html = "<h2>Date</h2>";
        msg_html += "<table border=\"0\" cellpadding=\"0\" cellspacing=\"15\ align=\"left\"><thead><tr><th align=\"left\" valign=\"top\">Start date</th><th align=\"left\" valign=\"top\">End date</th></tr></thead>"
        msg_html += "<tbody><tr><td align=\"left\" valign=\"top\">" + from.toDateString()+ "</td><td align=\"left\" valign=\"top\">" + to.toDateString()+ "</td></tr></tbody></table>";
        msg_html += "<p>Accounts will remain available for <b>" + CONFIG.tp.extra_expiration + " extra days </b>for data access</p>";
        msg_html += "<hr>";
        msg_html += "<h2>Credentials</h2>";
        msg_html += "<table border=\"0\" cellpadding=\"0\" cellspacing=\"15\"><thead><tr><th align=\"left\" valign=\"top\">Login</th><th align=\"left\" valign=\"top\">Password</th><th>Fake email</th></tr></thead><tbody>";

        for(var i=0;i<users.length;i++){
            msg += users[i].uid + " / " + users[i].password + ", fake email: " + users[i].email + "\n";
            msg_html += "<tr><td align=\"left\" valign=\"top\">" + users[i].uid + "</td><td align=\"left\" valign=\"top\">" + users[i].password + "</td><td align=\"left\" valign=\"top\">" + users[i].email + "</td></tr>";
        }
        msg_html += "</tbody></table>";
        msg += "New TP group: " + users[0].group + "\n";
        msg_html += "<hr><p>Users are in the group <strong>" + users[0].group + "</strong></p>";
        msg += "Users can create an SSH key at " + CONFIG.general.url + " in SSH Keys section\n";
        msg_html += "<hr>";
        msg_html += "<h2>Access</h2>";
        msg_html += "<p>Users can create an SSH key at " + CONFIG.general.url + " in SSH Keys section</p>";
        msg += "Accounts will remain available for " + CONFIG.tp.extra_expiration + " extra days for data access.\n\n";
        msg += "In case of issue, you can contact us at " + CONFIG.general.support + "\n\n";
        msg_html += "<hr>";
        msg_html += "<p>In case of issue, you can contact us at " + CONFIG.general.support + "</p>";

        users_db.findOne({'uid': owner}).then(function(user_owner){
            if( notif.mailSet()){
                var mailOptions = {
                    origin: CONFIG.gomail.origin, // sender address
                    destinations: [user_owner.email, CONFIG.general.accounts], // list of receivers
                    subject: '[TP accounts reservation ]' + owner,
                    message: msg,
                    html_message: msg_html
                };
                notif.sendUser(mailOptions, function(err, response) {
                    resolve(users);
                });
            };
        });
    });
};

var activate_tp_users = function(owner, users){
    return new Promise(function (resolve, reject){
        Promise.all(users.map(function(user){
            return activate_tp_user(user, owner);
        })).then(function(users){
            // logger.debug("activate_tp_users", users);
            resolve(users);
        });
    });
};

var delete_tp_user = function(user, admin_id){
    return new Promise(function (resolve, reject){
        logger.debug("delete_tp_user", user.uid);
        try{
            fdbs.delete_dbs(user).then(function(db_res){
                return db_res
            }).then(function(db_res){
                return fwebs.delete_webs(user);
            }).then(function(web_res){
                return fusers.delete_user(user, admin_id);
            }).then(function(){
                resolve(true);
            });

        }
        catch(exception){
            logger.error(exception);
            resolve(false);
        }
    });
};

router.delete_tp_users = function(users, group, admin_id){
    return new Promise(function (resolve, reject){
        Promise.all(users.map(function(user){
            return delete_tp_user(user, admin_id);
        })).then(function(users){
            logger.debug("deleted tp_users");
            deleteExtraGroup(group).then(function(){
                resolve(users);
            })

        });
    });

};

router.exec_tp_reservation = function(reservation_id){
    // Create users for reservation
    return new Promise(function (resolve, reject){
        reservation_db.findOne({'_id': reservation_id}).then(function(reservation){
            logger.debug("create a reservation group", reservation._id);
            createExtraGroup(reservation.owner).then(function(newGroup){
                logger.debug("create reservation accounts", reservation._id);
                create_tp_users_db(reservation.owner, reservation.quantity,Math.ceil((reservation.to-reservation.from)/(1000*3600*24)), reservation.to, newGroup).then(function(activated_users){
                    for(var i=0;i<activated_users.length;i++){
                        logger.debug("activated user ", activated_users[i].uid);
                        reservation.accounts.push(activated_users[i].uid);
                    }
                    try{
                    send_user_passwords(reservation.owner, reservation.from, reservation.to, activated_users).then(function(){
                        reservation_db.update({'_id': reservation_id}, {'$set': {'accounts': reservation.accounts, 'group': newGroup}}).then(function(err){
                            logger.debug("reservation ", reservation);
                            resolve(reservation);
                        });
                    });
                    }
                    catch(exception){
                        logger.error(exception);
                        reject(exception);
                    }

                });
            });
        });
    });
};

var tp_reservation = function(userId, from_date, to_date, quantity, about){
    // Create a reservation
    return new Promise(function (resolve, reject){

        var reservation = {
            'owner': userId,
            'from': from_date,
            'to': to_date,
            'quantity': quantity,
            'accounts': [],
            'about': about,
            'created': false,
            'over': false
        };

        reservation_db.insert(reservation).then(function(reservation){
            logger.debug("reservation ", reservation);
            resolve(reservation);
        });
    });
};

var insert_ldap_user = function(user, fid){
    return new Promise(function (resolve, reject){
        logger.debug("prepare ldap scripts");
        try{
            var user_ldif = "";
            var group_ldif = "";
            user_ldif += "dn: uid="+user.uid+",ou=people,"+CONFIG.ldap.dn+"\n";
            user_ldif += "cn: "+user.firstname+" "+user.lastname+"\n";
            user_ldif += "sn: "+user.lastname+"\n";
            user_ldif += "ou: tp\n";

            user_ldif += "givenName: "+user.firstname+"\n";
            user_ldif += "mail: " + user.email + "\n";

            if(user.home) {
                user_ldif += 'homeDirectory: '+user.home+"\n";
            }
            else {
                logger.error("user does not have any home", user);
                // todo, should we stop here ?
            }

            user_ldif += "loginShell: "+user.loginShell+"\n";
            user_ldif += "userpassword: "+user.password+"\n";
            user_ldif += "uidNumber: "+user.uidnumber+"\n";
            user_ldif += "gidNumber: "+user.gidnumber+"\n";
            user_ldif += "objectClass: top\n";
            user_ldif += "objectClass: posixAccount\n";
            user_ldif += "objectClass: inetOrgPerson\n\n";

            group_ldif += "dn: cn="+user.group+",ou=groups,"+CONFIG.ldap.dn+"\n";
            group_ldif += "changetype: modify\n";
            group_ldif += "add: memberUid\n";
            group_ldif += "memberUid: "+user.uid+"\n";
        }
        catch(exception){logger.error(exception);}
        logger.debug("switch to ACTIVE");
        users_db.update({uid: user.uid},{'$set': {status: STATUS_ACTIVE}}).then(function(data){
            logger.debug("write exec script");
            fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
                if(err) {
                    logger.error(err);
                    reject(user);
                }
                if(group_ldif != "") {
                  fs.writeFile(CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif", group_ldif, function(err) {
                    resolve(user);
                  });
                }
                else {
                  resolve(user);
                }
              });
        });

    });
};

var activate_tp_user = function(user, adminId){
    return new Promise(function (resolve, reject){
        users_db.findOne({'uid': user.uid}, function(err, db_user){
            if(err || !db_user) {
                logger.error("failure:",err,db_user);
              reject(user);
              return;
            }
            logger.debug("activate", user.uid);
            var fid = new Date().getTime();
            insert_ldap_user(user, fid).then(function(user){
                var script = "#!/bin/bash\n";
                script += "set -e \n"
                script += "ldapadd -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
                script += "if [ -e "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif"+" ]; then\n"
                script += "\tldapmodify -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif\n";
                script += "fi\n"
                script += "sleep 3\n";

                var homeDir = user.home;
                script += "mkdir -p " + homeDir + "/.ssh\n";
                script += utils.addReadmes(homeDir);
                /*
                script += "mkdir -p " + homeDir + "/user_guides\n";
                if (typeof CONFIG.general.readme == "object") {
                  CONFIG.general.readme.forEach(function(dict) {
                    script += "ln -s " + dict.source_folder + " " + homeDir  +"/user_guides/" + dict.language + "\n";
                  });
                } else {
                  script += "ln -s " + CONFIG.general.readme + " " + homeDir + "/user_guides/README\n";
                };
                */
                script += "touch " + homeDir + "/.ssh/authorized_keys\n";
                script += "echo \"Host *\" > " + homeDir + "/.ssh/config\n";
                script += "echo \"  StrictHostKeyChecking no\" >> " + homeDir + "/.ssh/config\n";
                script += "echo \"   UserKnownHostsFile=/dev/null\" >> " + homeDir + "/.ssh/config\n";
                script += "chmod 700 " + homeDir + "/.ssh\n";
                // script += "mkdir -p /omaha-beach/" + user.uid + "\n";
                script += "chown -R " + user.uidnumber+":"+user.gidnumber + " " + user.home + "\n";
                // script += "chown -R " + user.uidnumber+":"+user.gidnumber + " /omaha-beach/" + user.uid+"\n";
                script += utils.addExtraDirs(user.uid, user.group, user.uidnumber, user.gidnumber);
                var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
                fs.writeFile(script_file, script, function(err) {
                    fs.chmodSync(script_file, 0o755);
                    var plugin_call = function(plugin_info, userId, data, adminId){
                        return new Promise(function (resolve, reject){
                            plugins_modules[plugin_info.name].activate(userId, data, adminId).then(function(){
                                resolve(true);
                            });

                        });
                    };
                    Promise.all(plugins_info.map(function(plugin_info){
                        return plugin_call(plugin_info, user.uid, user, adminId);
                    })).then(function(results){
                        resolve(user);
                    });
                });
            });
        });
    });
};

router.get('/tp', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({'_id': req.locals.logInfo.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }
        reservation_db.find({}, function(err, reservations){
            res.send(reservations);
            res.end();
        })
    });
});

router.post('/tp', function(req, res) {
    if(req.param('quantity')<=0){
        res.status(403).send('Quantity must be >= 1');
        return;
    }
    if(req.param('about')=== undefined || req.param('about') == ''){
        res.status(403).send('Tell us why you need some tp accounts');
        return;
    }


    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({'_id': req.locals.logInfo.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }

        var is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
        if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
            res.status(403).send('Not authorized');
            return;
        }
        tp_reservation(user.uid, req.param('from'), req.param('to'), req.param('quantity'), req.param('about')).then(function(reservation){
                res.send({'reservation': reservation, 'msg': 'Reservation done'});
                res.end();
                return;
        });

    });

});

router.delete('/tp/:id', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(403).send('Not authorized');
      return;
    }
    users_db.findOne({'_id': req.locals.logInfo.id}, function(err, user){
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }

        var is_admin = GENERAL_CONFIG.admin.indexOf(user.uid) >= 0;
        if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
            res.status(403).send('Not authorized');
            return;
        }

        // add filter
        var filter = {};
        if(is_admin) {
          filter = {_id: req.param('id')};
        }
        else{
            filter = {_id: req.param('id'), owner: user.uid};
        }

        reservation_db.findOne(filter, function(err, reservation) {

            if(err){
                res.status(403).send({'msg': 'Not allowed to delete this reservation'});
                res.end();
                return;
            }

            if(reservation.over){
                res.status(403).send({'msg': 'Reservation is already closed'});
                res.end();
                return;
            }

            if(reservation.created){
                res.status(403).send({'msg': 'Reservation accounts already created, reservation will be closed after closing date'});
                res.end();
                return;
            }

            reservation_db.update({'_id': req.param('id')},{'$set': {'over': true}}).then(function(){
                res.send({'msg': 'Reservation cancelled'});
                res.end();
                return;
            });
        })

    });

});



module.exports = router;

/*
// TESTING
var from_date = new Date();
from_date.setDate(from_date.getDate() + 7);
var to_date = new Date();
to_date.setDate(to_date.getDate() + 14);

tp_reservation("osallou", from_date, to_date, 4).then(function(reservation){
    exec_tp_reservation(reservation._id).then(function(res){
        logger.info(res);
        process.exit(0);

    });
});
*/
/*
users_db.find({'uid': 'tp0'}).then(function(users){
    try {
        return delete_tp_users(users, 'auto');
    }
    catch(exception){
        logger.info("[ERROR]", exception);
        return;
    }
}).then(function(){
    process.exit(0);
});
*/
