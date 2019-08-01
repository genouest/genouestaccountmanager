var CONFIG = require('config');
var fs = require('fs');
//var LDAP = require('ldap-client');
var http = require('http');
var myldap = require('ldapjs');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const filer = require('../routes/file.js');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    groups_db = db.get('groups'),
    users_db = db.get('users'),
    events_db = db.get('events');

var options = {
    uri: 'ldap://'+CONFIG.ldap.host, // string
    //version: 3, // integer, default is 3,
    //starttls: false, // boolean, default is false
    connecttimeout: -1, // seconds, default is -1 (infinite timeout), connect timeout
    //timeout: 5000, // milliseconds, default is 5000 (infinite timeout is unsupported), operation timeout
    //reconnect: true, // boolean, default is true,
    //backoffmax: 32 // seconds, default is 32, reconnect timeout
};


function  get_user_dn(user) {
    return new Promise( function (resolve, reject) {
        // todo: factorize with bind exported function
        // todo: find if it is a good idea, as uid may not be unique ... but dn are ... Or maybe for uid unicity on ldap import ...
        // maybe add the email as filter too (or another)
        // todo: find other impact of "do not use uid in dn" on other part of this file, for example on bind and on group modification

        let client = myldap.createClient({
            url: 'ldap://' +  CONFIG.ldap.host
        });
        client.bind(CONFIG.ldap.admin_cn + ',' + CONFIG.ldap.admin_dn, CONFIG.ldap.admin_password, function(err) {
            if(err) {
                logger.error('Failed to bind as admin to ldap', err);
                reject(err);
                return;
            }
        });

        let user_dn_list = [];

        let opts = {
            filter: '(uid=' + user.uid + ')',
            scope: 'sub',
            attributes: ['dn']
        };

        client.search('ou=people,' + CONFIG.ldap.dn, opts, function(err, res) {
            if(err) {
                logger.error('Could not find ' + uid, err);
                reject(err);
                return;
            }

            res.on('searchEntry', function(entry) {
                logger.info('dn found: ', entry.object['dn'].trim(), ' for ', user.uid);
                user_dn_list.push(entry.object['dn'].trim());
            });
            res.on('error', function(err) {
                logger.error('error ', err);
                reject(err);
                return;
            });
            res.on('end', function(result) {
                if (user_dn_list.length > 1) {
                    logger.warn('more than one entry have been found', user_dn_list);
                }
                else if(user_dn_list.length == 0){
                    logger.error('no user found for uid', user.uid);
                    reject('no user found for uid');
                }
                resolve(user_dn_list[0]);
                return;
            });
        });
    });
}

module.exports = {

    reset_password: function(user, fid, callback){
        get_user_dn(user)
            .then(
                user_dn => { // resolve()
                    // todo: replace this with another then and another promise
                    let user_ldif = "";
                    user_ldif += "dn: "+user_dn+"\n";
                    //user_ldif += "dn: cn="+user.firstname+" "+user.lastname+",ou=people,"+CONFIG.ldap.dn+"\n";
                    user_ldif += "changetype: modify\n";
                    user_ldif += "replace: userpassword\n";
                    user_ldif += "userpassword: "+user.password+"\n";

                    fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
                        callback(err);
                    });
                    /* every thing before this should be removed */
                    return filer.ldap_reset_password(user, user_dn, fid);
                })
            .then(
                created_file => {
                    logger.info("File Created: ", created_file);
                })
            .catch(error => { // reject()
                logger.error('Password not updated for: '+ user.uid, error);
                callback(error);
            });
    },

    bind: function(uid, password, callback) {
        var body = JSON.stringify({
            id: uid, password: password
        });

        var client = myldap.createClient({
            url: 'ldap://' +  CONFIG.ldap.host
        });
        client.bind(CONFIG.ldap.admin_cn + ',' + CONFIG.ldap.admin_dn, CONFIG.ldap.admin_password, function(err) {
            if(err) {
                logger.error('Failed to bind as admin to ldap', err);
                callback(err);
            }
            var opts = {
                filter: '(uid=' + uid + ')',
                scope: 'sub',
                attributes: ['dn']
            };

            client.search('ou=people,' + CONFIG.ldap.dn, opts, function(err, res) {
                if(err) {
                    logger.error('Could not find ' + uid, err);
                    callback(err);
                }
                let foundMatch = false;
                res.on('searchEntry', function(entry) {
                    var user_dn = entry.object['dn'];
                    foundMatch = true;
                    client.bind(user_dn, password, function(err) {
                        callback(err);
                    });
                });
                res.on('searchReference', function(referral) {
                });
                res.on('error', function(err) {
                    logger.error('error ', err);
                    callback(err);
                });
                res.on('end', function(result) {
                    if(! foundMatch){
                        callback('no user found');
                    }
                });
            });
        });

        var bind_options = {
            binddn: 'uid='+uid+'ou=people,'+CONFIG.ldap.dn,
            password: password
        }

        var fb_options = {
            base: CONFIG.ldap.dn,
            filter: '(uid='+uid+')',
            scope: 'sub',
            attrs: '',
            password: password
        }

    },


    modify: function(user, fid, callback) {
        /* Modify contact info
           dn: cn=Modify Me,dc=example,dc=com
           changetype: modify
           replace: mail
           mail: modme@example.com
           -
           add: title
           title: Grand Poobah
           -
           add: jpegPhoto
           jpegPhoto:< file:///tmp/modme.jpeg
           -
           delete: description
        */
        if(! user.is_fake && (user.firstname == '' || user.lastname == '')) {
            logger.debug('firstname or lastname empty');
            callback();
            return;
        }

        get_user_dn(user)
            .then(
                user_dn => { // resolve()

                    var user_ldif = "";
                    user_ldif += "dn: "+user_dn+"\n";
                    user_ldif += "changetype: modify\n";
                    user_ldif += "replace: sn\n";
                    user_ldif += "sn: "+user.lastname+"\n";
                    user_ldif += "-\n";

                    if(user.is_admin){
                        if(user.is_internal){
                            user_ldif += "replace: ou\n";
                            user_ldif += "ou: "+CONFIG.ldap.team+"\n";
                            user_ldif += "-\n";
                        }
                        else {
                            user_ldif += "replace: ou\n";
                            user_ldif += "ou: external\n";
                            user_ldif += "-\n";
                        }
                    }
                    if(user.home) {
                        user_ldif += "replace: homeDirectory\n";
                        user_ldif += 'homeDirectory: '+user.home+"\n";
                        user_ldif += "-\n";
                    }
                    if(user.firstname) {
                        user_ldif += "replace: givenName\n";
                        user_ldif += "givenName: "+user.firstname+"\n";
                        user_ldif += "-\n";
                    }
                    if(! user.is_fake) {
                        user_ldif += "replace: mail\n";
                        user_ldif += "mail: "+user.email+"\n";
                        user_ldif += "-\n";
                    }
                    user_ldif += "replace: loginShell\n";
                    user_ldif += "loginShell: /bin/bash\n";

                    if(user.is_admin && user.oldgroup != user.group) {
                        user_ldif += "-\n";
                        user_ldif += "replace: gidNumber\n";
                        user_ldif += "gidNumber: "+user.gidnumber+"\n";
                        // Group membership modification
                        user_ldif += "\ndn: cn="+user.oldgroup+",ou=groups,"+CONFIG.ldap.dn+"\n";
                        user_ldif += "changetype: modify\n";
                        user_ldif += "delete: memberUid\n";
                        user_ldif += "memberUid: "+user.uid+"\n\n";
                        user_ldif += "dn: cn="+user.group+",ou=groups,"+CONFIG.ldap.dn+"\n";
                        user_ldif += "changetype: modify\n";
                        user_ldif += "add: memberUid\n";
                        user_ldif += "memberUid: "+user.uid+"\n";
                    }

                    fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
                        if(err) {
                            logger.error(err);
                        }
                        callback(err);
                    });
                    return filer.ldap_modify_user(user, user_dn, fid);
                })
            .then(
                created_file => {
                    logger.info("File Created: ", created_file);
                })
            .catch(error => { // reject()
                logger.error('Modify Failed for: ' + user.uid, error);
                callback(error);
            });
    },

    add_group: function(group, fid, callback) {
        var user_ldif = "";
        user_ldif += "dn: cn="+group.name+",ou=groups,"+CONFIG.ldap.dn+"\n";
        user_ldif += "objectClass: top\n";
        user_ldif += "objectClass: posixGroup\n";
        user_ldif += "gidNumber: "+group.gid+"\n";
        user_ldif += "cn: "+group.name+"\n";
        user_ldif += "description: group for "+group.name+"\n";
        user_ldif += "\n";
        fs.writeFile(CONFIG.general.script_dir+'/'+group.name+"."+fid+".ldif", user_ldif, function(err) {
            if(err) {
                logger.error(err);
            }
            callback(err);
        });
        filer.ldap_add_group(group, fid)
            .then(
                created_file => {
                    logger.info("File Created: ", created_file);
                })
            .catch(error => { // reject()
                logger.error('Add Group Failed for: ' + group.name, error);
                callback(error);
            });
    },

    delete_group: function(group, fid, callback) {
        var user_ldif = "";
        user_ldif += "cn="+group.name+",ou=groups,"+CONFIG.ldap.dn+"\n";
        user_ldif += "\n";
        fs.writeFile(CONFIG.general.script_dir+'/'+group.name+"."+fid+".ldif", user_ldif, function(err) {
            if(err) {
                logger.error(err);
            }
            callback(err);
        });

        filer.ldap_delete_group(group, fid)
            .then(
                created_file => {
                    logger.info("File Created: ", created_file);
                })
            .catch(error => { // reject()
                logger.error('Delete Group Failed for: ' + group.name, error);
                callback(error);
            });
    },

    add: function(user, fid, callback) {

        var password = Math.random().toString(36).slice(-10);
        var user_ldif = "";
        var group_ldif = "";
        user_ldif += "dn: uid="+user.uid+",ou=people,"+CONFIG.ldap.dn+"\n";
        user_ldif += "cn: "+user.firstname+" "+user.lastname+"\n";
        user_ldif += "sn: "+user.lastname+"\n";
        if(user.is_internal){
            user_ldif += "ou: " + CONFIG.ldap.team + "\n";
        } else if (user.is_fake) {
            user_ldif += "ou: fake\n";
        } else {
            user_ldif += "ou: external\n";
        }
        user_ldif += "givenName: "+user.firstname+"\n";
        user_ldif += "mail: "+user.email+"\n";
        if(user.home) {
            user_ldif += 'homeDirectory: '+user.home+"\n";
        }
        else {
            logger.error("user does not have any home", user);
            // todo, should we stop here ?
        }
        user_ldif += "loginShell: /bin/bash\n";
        user_ldif += "userpassword: "+user.password+"\n";
        user_ldif += "uidNumber: "+user.uidnumber+"\n";
        user_ldif += "gidNumber: "+user.gidnumber+"\n";
        user_ldif += "objectClass: top\n";
        user_ldif += "objectClass: posixAccount\n";
        user_ldif += "objectClass: inetOrgPerson\n\n";

        groups_db.findOne({'name': user.group}, function(err, group){
            if(err || group == null || group == undefined) {
                user_ldif += "dn: cn="+user.group+",ou=groups,"+CONFIG.ldap.dn+"\n";
                user_ldif += "objectClass: top\n";
                user_ldif += "objectClass: posixGroup\n";
                //user_ldif += "objectclass: groupofnames\n";
                user_ldif += "gidNumber: "+user.gidnumber+"\n";
                user_ldif += "cn: "+user.group+"\n";
                user_ldif += "description: group for "+user.group+"\n";
                user_ldif += "\n";
            }
            group_ldif += "dn: cn="+user.group+",ou=groups,"+CONFIG.ldap.dn+"\n";
            group_ldif += "changetype: modify\n";
            group_ldif += "add: memberUid\n";
            group_ldif += "memberUid: "+user.uid+"\n"

            fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
                if(err) {
                    logger.error(err);
                }
                if(group_ldif != "") {
                    fs.writeFile(CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif", group_ldif, function(err) {
                        callback(err);
                    });
                }
                else {
                    callback(err);
                }
            });

            filer.ldap_add_user(user, group, fid)
                .then(
                    created_file => {
                        logger.info("File Created: ", created_file);
                        return filer.ldap_add_user_to_group(user);
                    })
                .then(
                    created_file => {
                        logger.info("File Created: ", created_file);
                    })
                .catch(error => { // reject()
                    logger.error('Add User Failed for: ' + user.uid, error);
                    callback(error);
                });
        });

    },

    change_user_groups: function(user, group_add, group_remove, fid, callback) {
        /*
          dn: cn=XXX,ou=groups,dc=genouest,dc=org
          changetype: modify
          delete: memberUid / add: memberUid
          memberUid: YYY
        */
        var user_ldif = "";
        for(var ga=0;ga<group_add.length;ga++){
            user_ldif += "dn: cn="+group_add[ga]+",ou=groups,"+CONFIG.ldap.dn+"\n";
            user_ldif += "changetype: modify\n";
            user_ldif += "add: memberUid\n";
            user_ldif += "memberUid: "+user.uid+"\n\n";
        }
        for(var gd=0;gd<group_remove.length;gd++){
            user_ldif += "dn: cn="+group_remove[gd]+",ou=groups,"+CONFIG.ldap.dn+"\n";
            user_ldif += "changetype: modify\n";
            user_ldif += "delete: memberUid\n";
            user_ldif += "memberUid: "+user.uid+"\n\n";
        }
        fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
            if(err) {
                logger.error(err);
            }
            callback(err);
        });

        filer.ldap_change_user_groups(user, group_add, group_remove, fid)
            .then(
                created_file => {
                    logger.info("File Created: ", created_file);
                })
            .catch(error => { // reject()
                logger.error('User Group Change Failed for: ' + user.uid, error);
                callback(error);
            });
    },

};
