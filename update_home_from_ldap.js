var CONFIG = require('config');
var fs = require('fs');
var http = require('http');
var myldap = require('ldapjs');
var Promise = require('promise');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');

const optionDefinitions = [
    { name: 'help', description: 'Display this usage guide.', alias: 'h', type: Boolean},
    { name: 'test', alias: 't', type: Boolean, description: 'do not import in db, just test' },
    { name: 'import', alias: 'i', type: Boolean, description: 'import in db' }
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

var monk = require('monk');
var db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db);
var users_db = db.get('users');

var options = {
    uri: 'ldap://'+CONFIG.ldap.host, // string
    //version: 3, // integer, default is 3,
    //starttls: false, // boolean, default is false
    connecttimeout: -1, // seconds, default is -1 (infinite timeout), connect timeout
    //timeout: 5000, // milliseconds, default is 5000 (infinite timeout is unsupported), operation timeout
    //reconnect: true, // boolean, default is true,
    //backoffmax: 32 // seconds, default is 32, reconnect timeout
};

var ldap_nb_users = 0;
var ldap_managed_users = 0;
var errors = [];
var mongo_users = [];

var client = myldap.createClient({
    url: 'ldap://' +  CONFIG.ldap.host
});


search_users();

function search_users(){
    console.log("now search for users");
    client.search('ou=people,' + CONFIG.ldap.dn, {'scope': 'sub'},function(err, users) {
        users.on('searchEntry', function(entry) {
            //console.debug('entry: ' + JSON.stringify(entry.object));
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
            mongo_imports().then(function(res){
                console.info('LDAP user status error: ' + result.status);
                console.info("Number of imported users: ", ldap_managed_users);
                console.info("[Errors] ", errors);
                process.exit(0);
            });
        });

    });
}

async function record_user(user){
    //    console.debug(user);

    if(! user.uid || user.uid == ""){
        console.warn("[SKIP] Invalid Uid for user ", user.uid, ",DN= ", user.dn);
        return;
    }

    if(! user.homeDirectory || ! user.homeDirectory.startsWith(CONFIG.general.home)) {
        errors.push(user.uid + " " + user.homeDirectory + " != " + CONFIG.general.home);
        console.warn("[SKIP] ", user.uid + " invalid home dir " + user.homeDirectory );
        return;
    }

    console.debug("USER "+ user.uid +" HOME "+ user.homeDirectory);

    var go_user = {
        uid: user.uid,
        home: user.homeDirectory
    };

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
        if(commands.test){
            resolve(true);
        }
        Promise.all(mongo_users.map(function(user_import){
            return users_db.update({uid: user_import.uid}, {$set: {home: user_import.home}});
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
};
