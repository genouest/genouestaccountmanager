var CONFIG = require('config');
var fs = require('fs');
var http = require('http');
var myldap = require('ldapjs');
var Promise = require('promise');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');

const MAIN_GROUP="genouest";

const optionDefinitions = [
      { name: 'help', description: 'Display this usage guide.', alias: 'h', type: Boolean},
      { name: 'test', alias: 't', type: Boolean, description: 'do not import in db, just test' },
      { name: 'import', alias: 'i', type: Boolean, description: 'import in db' },
      { name: 'admin', alias: 'a', type: String, description: 'admin user id'}
];

const sections = [
  {header: 'Import LDAP in gomngr', content: 'Imports existing LDAP users and groups in gomngr db'},
  {header: 'Options', optionList: optionDefinitions}
];

const usage = getUsage(sections);

const commands = commandLineArgs(optionDefinitions);

if(commands.h || (commands.test === undefined && commands.import === undefined)){
    console.info(usage);
    return;
}
if(commands.import && commands.admin===undefined){
    console.error("missing admin option for import");
    return;
}

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    groups_db = db.get('groups'),
    users_db = db.get('users');


var options = {
    uri: 'ldap://'+CONFIG.ldap.host, // string
    //version: 3, // integer, default is 3,
    //starttls: false, // boolean, default is false
    connecttimeout: -1, // seconds, default is -1 (infinite timeout), connect timeout
    //timeout: 5000, // milliseconds, default is 5000 (infinite timeout is unsupported), operation timeout
    //reconnect: true, // boolean, default is true,
    //backoffmax: 32 // seconds, default is 32, reconnect timeout
};

var ldap_groups = {};
var ldap_users = [];
var ldap_secondary_groups = {};
var ldap_nb_users = 0;
var ldap_managed_users = 0;
var errors = [];
var undeclared_home_groups = [];

var mongo_users = [];
var mongo_groups = [];

var client = myldap.createClient({
  url: 'ldap://' +  CONFIG.ldap.host
});


console.log("Search for groups");
client.search('ou=groups,' + CONFIG.ldap.dn, {'scope': 'sub'},function(err, groups) {
    groups.on('searchEntry', function(entry) {
      console.debug('entry: ' + JSON.stringify(entry.object));
      record_group(entry.object);
    });
    groups.on('searchReference', function(referral) {
      console.debug('referral: ' + referral.uris.join());
    });
    groups.on('error', function(err) {
      console.error('error: ' + err.message);
    });
    groups.on('end', function(result) {
      console.debug('LDAP group status error: ' + result.status);
      search_users();
    });

});

function record_group(group){
    /*
    * entry: {"dn":"ou=Groups,dc=genouest,dc=org","controls":[],"objectClass":["top","organizationalUnit"],"ou":"Groups"}
    * entry: {"dn":"cn=symbiose,ou=Groups,dc=genouest,dc=org","controls":[],"memberUid":["agouin","lbouri"],"objectClass":["top","posixGroup"],"gidNumber":"20857","cn":"symbiose"}
    * entry: {"dn":"cn=recomgen,ou=Groups,dc=genouest,dc=org","controls":[],"memberUid":["mbahin","smottier","vwucher","clebeguec","mrimbaul","mbunel","scorrear","spaillar","bhedan"],"cn":"recomgen","gidNumber":"20885","objectClass":["posixGroup","top"]}
    */
    if(! group.dn.startsWith("cn") || group.objectClass.indexOf("posixGroup") == -1) {return;}
    console.info("manage group: " + group.dn);
    ldap_groups[parseInt(group.gidNumber)] = group;
    if(group.memberUid !== undefined){
        for(var i=0;i<group.memberUid.length;i++){
            if(ldap_secondary_groups[group.memberUid[i]] === undefined){ ldap_secondary_groups[group.memberUid[i]]=[];}
            ldap_secondary_groups[group.memberUid[i]].push(group.cn);
        }
    }
    if(commands.import){
        var go_group = {name: group.cn, gid: parseInt(group.gidNumber), owner: commands.admin};
        mongo_groups.push(go_group);
    }

}

function search_users(){
    console.log("now search for users");
    client.search('ou=people,' + CONFIG.ldap.dn, {'scope': 'sub'},function(err, users) {
    users.on('searchEntry', function(entry) {
      console.debug('entry: ' + JSON.stringify(entry.object));
      ldap_nb_users += 1;
      record_user(entry.object);
    });
    users.on('searchReference', function(referral) {
      console.debug('referral: ' + referral.uris.join());
    });
    users.on('error', function(err) {
      console.error('error: ' + err.message);
    });
    users.on('end', function(result) {
      mongo_imports().then(function(res){;
          console.info('LDAP user status error: ' + result.status);
          console.info("Users are put in active status for 1 year");
          console.info("Number of imported users: ", ldap_managed_users);
          console.info("[Errors] ", errors);
          process.exit(0);
      })
    });

});
}

function record_user(user){
    console.debug(user);

    if(! user.dn.startsWith("uid=")){
        console.warn("[SKIP] Invalid DN for user ", user.uid, ",DN= ", user.dn, ", should be uid=...");
        return;
    }

    var is_fake = false;
    if(! user.mail || user.mail == ""){
        console.warn("User ", user.uid, " has not email declared, tagging user as a fake/service user");
        is_fake = true;
    }

    var regkey = Math.random().toString(36).substring(7);

    console.debug("gid: ",user.gidNumber);
    var gid = parseInt(user.gidNumber);
    if(ldap_groups[gid] === undefined) {
        console.warn("[SKIP] user ", user.uid, " has no valid group id: ", gid);
        return;
    }

    var secondary_groups = ldap_secondary_groups[user.uid];
    if(secondary_groups === undefined){
        secondary_groups = [];
    }

    var homeDir = user.homeDirectory.split('/');
    if("/" + homeDir[1] != CONFIG.general.home) {
        errors.push(user.uid + " home base dir != " + CONFIG.general.home);
        console.warn("[SKIP] ", user.uid, " invalid home dir");
        return;
    }
    if(homeDir[homeDir.length-1] != user.uid || homeDir[homeDir.length-2] != ldap_groups[parseInt(user.gidNumber)].cn) {
        console.warn("[SKIP] ", user.uid, " invalid home dir");
        errors.push(user.uid + " home end path, should be " + ldap_groups[parseInt(user.gidNumber)].cn + "/" + user.uid + " vs " + homeDir[homeDir.length-2] + "/" + homeDir[homeDir.length-1]);
        return;
    }

    if(homeDir.length > 4){
        var int_home_dir = homeDir.slice(2, homeDir.length-2).join("/");
        if(int_home_dir === undefined){
            errors.push("Invalid homeDirectory ", user.homeDirectory);
            console.warn("[SKIP] ", user.uid, " invalid home dir");
            return;
        }

        if(CONFIG.general.main_groups.indexOf(int_home_dir) === -1 && undeclared_home_groups.indexOf(int_home_dir) === -1) {
            errors.push(user.homeDirectory);
            errors.push('Need to add ' + int_home_dir + ' to CONFIG.general.home_groups');
            undeclared_home_groups.push(int_home_dir);
        }

    }

    console.debug("HOME ", homeDir);

    var go_user = {
        status: "Active",
        uid: user.uid,
        firstname: user.givenName,
        lastname: user.sn,
        email: user.mail,
        address: "unknown",
        lab: "unknown",
        responsible: "unknown",
        group: ldap_groups[parseInt(user.gidNumber)].cn,
        secondarygroups: secondary_groups,
        maingroup: MAIN_GROUP,
        why: "",
        ip: "",
        regkey: regkey,
        is_genouest: false,
        is_fake: is_fake,
        uidnumber: parseInt(user.uidNumber),
        gidnumber: parseInt(user.gidNumber),
        cloud: false,
        duration: 365,
        expiration: new Date().getTime() + 1000*3600*24*365,
        loginShell: user.loginShell,
        history: []
      }
    finalize_user(go_user);
}


function finalize_user(user){
    console.debug("Record user," , user);
    ldap_managed_users += 1;
    if(commands.import){
        mongo_users.push(user);
    }
}


var mongo_imports = function(){
    return new Promise(function (resolve, reject){
        if(! commands.import){
            resolve(true);
        }
        Promise.all(mongo_groups.map(function(group_import){
            return groups_db.update({name: group_import.name}, group_import, {upsert: true});
        })).then(function(results_group){
            for(var i=0;i<results_group.length;i++){
                if(results_group[i].ok!=1){
                    console.error("during group import in db: ", results_group[i]);
                    break;
                }
            }
            Promise.all(mongo_users.map(function(user_import){
                return users_db.update({uid: user_import.uid}, user_import, {upsert: true});
            })).then(function(results_account){
                for(var i=0;i<results_account.length;i++){
                    if(results_account[i].ok!=1){
                        console.error("during user import in db: ", results_account[i]);
                        break;
                    }
                }
                resolve(true);
            });


        });
    });

}
