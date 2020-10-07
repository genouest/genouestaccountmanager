var CONFIG = require('config');
const process = require('process');
var fs = require('fs');
var http = require('http');
var myldap = require('ldapjs');
var Promise = require('promise');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');


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
    process.exit(0);
}
if(commands.import && commands.admin===undefined){
    console.error("missing admin option for import");
    process.exit(1);
}

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    groups_db = db.get('groups'),
    projects_db = db.get('projects'),
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
var ldap_user_projects = {};
ldap_user_projects[commands.admin] = [];
var ldap_nb_users = 0;
var ldap_managed_users = 0;
var errors = [];
var undeclared_home_groups = [];

var mongo_users = [];
var mongo_groups = [];
var mongo_projects = [];

var client = myldap.createClient({
    url: 'ldap://' +  CONFIG.ldap.host
});

var cliopts = {
    scope: 'sub'
    /*  ,paged: true
        ,sizeLimit: 1000 */
};

client.bind(CONFIG.ldap.admin_cn + ',' + CONFIG.ldap.admin_dn, CONFIG.ldap.admin_password, function(err) {
    if (err)
    {
        console.error('error: ', err);
        process.exit(1);
    }
});

console.log("Search for groups");
client.search('ou=groups,' + CONFIG.ldap.dn, cliopts, function(err, groups) {
    groups.on('searchEntry', function(entry) {
        console.debug('Group entry: ' + JSON.stringify(entry.object));
        record_group(entry.object);
    });
    groups.on('searchReference', function(referral) {
        console.debug('Group referral: ' + referral.uris.join());
    });
    groups.on('page', function(result) {
        console.log('Group page end: ' + result.status);
    });
    groups.on('error', function(err) {
        console.error('Group error: ', err);
    });
    groups.on('end', function(result) {
        console.debug('LDAP group status: ' + result.status);
        search_users();
    });

});

function record_group(group){
    /*
     * entry: {"dn":"ou=Groups,dc=genouest,dc=org","controls":[],"objectClass":["top","organizationalUnit"],"ou":"Groups"}
     * entry: {"dn":"cn=symbiose,ou=Groups,dc=genouest,dc=org","controls":[],"memberUid":["agouin","lbouri"],"objectClass":["top","posixGroup"],"gidNumber":"20857","cn":"symbiose"}
     * entry: {"dn":"cn=recomgen,ou=Groups,dc=genouest,dc=org","controls":[],"memberUid":["mbahin","smottier","vwucher","clebeguec","mrimbaul","mbunel","scorrear","spaillar","bhedan"],"cn":"recomgen","gidNumber":"20885","objectClass":["posixGroup","top"]}
     */
    if(! group.dn.startsWith("cn") || group.objectClass.indexOf("posixGroup") == -1 || group.dn.includes("ou=user-groups")) {return;}
    // if (group.dn.includes("user-groups")){return;}
    console.info("manage group: " + group.dn);
    ldap_groups[parseInt(group.gidNumber)] = group;

    var memberArray = [];
    if(group.memberUid !== undefined)
    {
        if (Array.isArray(group.memberUid))
        {
            memberArray = group.memberUid;
        } else { // should be a string with the unique member
            memberArray = [group.memberUid];
        }
    }

    if (group.dn.includes("ou=projects"))
    {
        for(var j=0;j<memberArray.length;j++){
            if(ldap_user_projects[memberArray[j]] === undefined){ ldap_user_projects[memberArray[j]]=[];}
            ldap_user_projects[memberArray[j]].push(group.cn);
        }
    } else { // if (!group.dn.includes("ou=projects")) {
        for(var i=0;i<memberArray.length;i++){
            if(ldap_secondary_groups[memberArray[i]] === undefined){ ldap_secondary_groups[memberArray[i]]=[];}
            ldap_secondary_groups[memberArray[i]].push(group.cn);
        }
    }


    if(commands.import){
        var group_owner = ""; // todo: find if we should set myadmin as owner

        if (memberArray.length > 0) {
            group_owner = memberArray[0];
        }
        else {
            console.warn("[SKIP] Group :" + group.cn + " Does not have any member");
        }
        if (group.dn.includes("ou=projects"))
        {
            var go_project = {
                id: group.cn,
                owner: group_owner,
                expire: new Date().getTime() + 1000*3600*24*365,
                group: group.cn,
                description: "imported from ldap",
                path: "",
                orga: "",
                access : "Group"
            };
            mongo_projects.push(go_project);
        }
        else
        {
            var go_group = {
                name: group.cn,
                gid: parseInt(group.gidNumber),
                owner: group_owner
            };
            mongo_groups.push(go_group);
        }
    }
}

function search_users(){
    console.log("now search for users");
    client.search('ou=people,' + CONFIG.ldap.dn, cliopts, function(err, users) {
        users.on('searchEntry', function(entry) {
            console.debug('User entry: ' + JSON.stringify(entry.object));
            ldap_nb_users += 1;
            record_user(entry.object);
        });
        users.on('searchReference', function(referral) {
            console.debug('User referral: ' + referral.uris.join());
        });
        users.on('page', function(result) {
            console.log('User page end: ' + result.statu);
        });
        users.on('error', function(err) {
            console.error('User error: ', err);
        });
        users.on('end', function(result) {
            mongo_imports().then(function(res){
                console.info('LDAP user status: ' + result.status);
                console.info("Users are put in active status for 1 year");
                console.info("Number of imported users: ", ldap_managed_users);
                console.info("[Errors] ", errors);
                process.exit(0);
            });
        });
    });
}

function record_user(user){
    console.debug(user);

    if(! user.uid || user.uid == ""){
        console.warn("[SKIP] Invalid Uid for user ", user.uid, ",DN= ", user.dn);
        return;
    }

    if(! user.cn || user.cn == ""){
        console.warn("[SKIP] Invalid Cn for user ", user.cn, ",DN= ", user.dn);
        return;
    }

    var is_fake = false;
    if(! user.mail || user.mail == ""){
        console.warn("User ", user.uid, " has not email declared, tagging user as a fake/service user");
        is_fake = true;
    }

    var regkey = Math.random().toString(36).substring(7);
    var uid = parseInt(user.uidNumber);
    var gid = parseInt(user.gidNumber);

    if(ldap_groups[gid] === undefined) {
        console.warn("User ", user.uid, " has no valid group id: ", gid);
        if(CONFIG.general.use_group_in_path)
        {
            console.warn("[SKIP] User ", user.uid," as group are needed for home path");
            return;
        }
    }

    var secondary_groups = ldap_secondary_groups[user.uid];
    if(secondary_groups === undefined){
        secondary_groups = [];
    }

    var projects = ldap_user_projects[user.uid];
    if(projects === undefined){
        projects = [];
    }

   // console.warn("Home dir for ", user.uid, " is set to", user.homeDirectory);

    if(! user.homeDirectory || ! user.homeDirectory.startsWith(CONFIG.general.home)) {
        errors.push(user.uid + " home base dir != " + CONFIG.general.home);
        console.warn("[SKIP] ", user.uid, " invalid home dir");
        return;
    }

    var go_user = {
        status: "Active",
        uid: user.uid,
        firstname: user.givenName,
        lastname: user.sn,
        email: user.mail,
        address: "unknown",
        lab: "unknown",
        responsible: "unknown",
        group: (!CONFIG.general.disable_user_group && ldap_groups[gid]) ? ldap_groups[gid].cn : '',
        secondarygroups: secondary_groups,
        projects: projects,
        home: user.homeDirectory,
        maingroup: CONFIG.general.default_main_group,
        why: "",
        ip: "",
        regkey: regkey,
        is_internal: false,
        is_fake: is_fake,
        uidnumber: uid,
        gidnumber: gid,
        cloud: false,
        duration: '1 year',
        expiration: new Date().getTime() + 1000*3600*24*365,
        loginShell: user.loginShell,
        history: []
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
        if(! commands.import){
            resolve(true);
        }

        /* GROUPS */
        Promise.all(mongo_groups.map(function(group_import){
            return groups_db.update({name: group_import.name}, group_import, {upsert: true});
        })).then(function(results_group){
            for(var i=0;i<results_group.length;i++){
                if(results_group[i].ok!=1){
                    console.error("during group import in db: ", results_group[i]);
                    break;
                }
            }

            /* PROJECTS */
            Promise.all(mongo_projects.map(function(project_import){
                return projects_db.update({id: project_import.id}, project_import, {upsert: true});
            })).then(function(results_project){
                for(var i=0;i<results_project.length;i++){
                    if(results_project[i].ok!=1){
                        console.error("during project import in db: ", results_project[i]);
                        break;
                    }
                }

                /* USERS */
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
                }); /* END USERS */
            }); /* END PROJECTS */
        }); /* END GROUPS */
    });
};
