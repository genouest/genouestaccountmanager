/**
 * Test expiration date of user, if expired, expire the user
 */
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var CONFIG = require('config');
var goldap = require('./routes/goldap.js');
var fs = require('fs');

var Promise = require('promise');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');
events_db = db.get('events');

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];

var notif = require('./routes/notif_'+MAILER+'.js');

var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];
for(var i=0;i<plugins.length;i++){
    if(plugins[i]['admin']) {
        continue;
    }
    plugins_modules[plugins[i].name] = require('./plugins/'+plugins[i].name);
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name})
}

function timeConverter(tsp){
    var a = new Date(tsp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
}

// Find users expiring
users_db.find({'is_fake': {$ne: true}, status: STATUS_ACTIVE, expiration: {$lt: (new Date().getTime())}},{uid: 1}, function(err, users){
    var mail_sent = 0;
    if (! notif.mailSet()){
        console.log("Error: mail is not set");
        process.exit(code=1);
    }
    for(var i=0;i<users.length;i++){
        (function(index) {
            var user = users[index];
            console.log('User: ' + user.uid + ' has expired');
            var msg_activ = "User "+user.uid+" has expired, updating account";
            var msg_activ_html = msg_activ;
            var mailOptions = {
                origin: MAIL_CONFIG.origin, // sender address
                destinations: [CONFIG.general.support], // list of receivers
                subject: CONFIG.general.name + ' account expiration: ' + user.uid, // Subject line
                message: msg_activ, // plaintext body
                html_message: msg_activ_html // html body
            };
            notif.sendUser(mailOptions, function(error, response){
                if(error){
                    console.log(error);
                }
                var fid = new Date().getTime();
                var new_password = Math.random().toString(36).slice(-10);
                user.password = new_password;
                goldap.reset_password(user, fid, function(err) {
                    if(err) { console.log(user.uid + ': failed to reset password') }
                    user.history.push({'action': 'expire', date: new Date().getTime()});
                    users_db.update({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}}, function(err){
                        var script = "#!/bin/bash\n";
                        script += "set -e \n"
                        script += "ldapmodify -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
                        var script_file = CONFIG.general.script_dir+'/'+user.uid+"_"+fid+".update";
                        events_db.insert({'owner': 'cron', 'date': new Date().getTime(), 'action': 'user ' + user.uid + ' deactivated by cron', 'logs': []}, function(err){ return;});

                        var plugin_call = function(plugin_info, user){
                            return new Promise(function (resolve, reject){
                                plugins_modules[plugin_info.name].deactivate(user).then(function(){
                                    resolve(true);
                                });

                            });
                        };
                        // console.log('call plugins');
                        Promise.all(plugins_info.map(function(plugin_info){
                            return plugin_call(plugin_info, user.uid);
                        })).then(function(results){
                            // console.log('after plugins');
                            fs.writeFile(script_file, script, function(err) {
                                fs.chmodSync(script_file,0755);
                                // Now remove from mailing list
                                try {
                                    notif.remove(user.email, function(err){
                                        mail_sent++;
                                        if(mail_sent == users.length) {
                                            process.exit(code=0);
                                        }
                                    });
                                }
                                catch(err) {
                                    mail_sent++;
                                    if(mail_sent == users.length) {
                                        process.exit(code=0);
                                    }
                                }
                            });
                        });


                    });
                });

            });
        }(i));
    }
    if(mail_sent == users.length) {
        process.exit(code=0);
    }

});
