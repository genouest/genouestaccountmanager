const CONFIG = require('config');
const process = require('process');
const myldap = require('ldapjs-promise');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const Promise = require('promise');


const optionDefinitions = [
    { name: 'help', description: 'Display this usage guide.', alias: 'h', type: Boolean},
    { name: 'test', alias: 't', type: Boolean, description: 'do not import in db, just test' },
    { name: 'import', alias: 'i', type: Boolean, description: 'import in db' }
];

const sections = [
    {header: 'Import LDAP in gomngr', content: 'Imports existing groups in my db'},
    {header: 'Options', optionList: optionDefinitions}
];

const usage = getUsage(sections);

const commands = commandLineArgs(optionDefinitions);

if(commands.h || (commands.test === undefined && commands.import === undefined)){
    console.info(usage);
    process.exit(0);
}

let monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    projects_db = db.get('projects'),
    groups_db = db.get('groups'),
    users_db = db.get('users');


let options = {
    uri: 'ldap://'+CONFIG.ldap.host, // string
    connecttimeout: -1, // seconds, default is -1 (infinite timeout), connect timeout

};

let client = myldap.createClient({
    url: 'ldap://' + CONFIG.ldap.host
});

let cliopts = {
    scope: 'sub'
};

let nb_group_added = 0;
let nb_project_added = 0;
let nb_user_added = 0;
let group_list = [];
let user_list = [];
var user_groups = {};
var user_projects = {};

main();

async function main() {

    try {
        await client.bind(CONFIG.ldap.admin_cn + ',' + CONFIG.ldap.admin_dn, CONFIG.ldap.admin_password);
        group_list = await import_groups();
        user_list = await import_users();
        await import_links();
    }
    catch(e) {
        console.error(e);
        process.exit(1);
    }
    process.exit(0);
}

async function import_links() {
    let nb_updated = 0;

    try {
        for (let group of group_list.entries) {
            let memberArray = [];
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
                for (var j=0;j<memberArray.length;j++) {
                    if (user_projects[memberArray[j]] === undefined) {
                        user_projects[memberArray[j]]=[];
                    }
                    let cur_project = await projects_db.findOne({'id': group.cn});
                    if (cur_project) {
                        user_projects[memberArray[j]].push(group.cn);
                    }
                }
            } else { // if (!group.dn.includes("ou=projects")) {
                for (var i=0;i<memberArray.length;i++) {
                    if (user_groups[memberArray[i]] === undefined) {
                        user_groups[memberArray[i]]=[];
                    }
                    let cur_group = await groups_db.findOne({'name': group.cn});
                    if (cur_group) {
                        user_groups[memberArray[i]].push(group.cn);
                    }
                }
            }
        }

        for (let user of user_list.entries) {
            let cur_user = await users_db.findOne({'uid': user.uid});

            if (cur_user) {
                let ldap_groups = [];
                if (user_groups[cur_user.uid]) {
                    ldap_groups = user_groups[cur_user.uid];
                }

                if (JSON.stringify(cur_user.secondarygroups) !== JSON.stringify(ldap_groups)) {
                    console.info("Update Group for user :" + user.uid);
                    // console.log('Ldap', ldap_groups);
                    // console.log('Mongo', cur_user.secondarygroups);
                    if (commands.import) {
                        await users_db.update({uid: cur_user.uid}, {'$set': {secondarygroups: ldap_groups}});
                        nb_updated++;
                    }
                }

                let ldap_projects = [];
                if (user_projects[cur_user.uid]) {
                    ldap_projects = user_projects[cur_user.uid];
                }
                if (JSON.stringify(cur_user.projects) !== JSON.stringify(ldap_projects)) {
                    console.info("Update Project for user :" + user.uid);
                    // console.log('Ldap', ldap_projects);
                    // console.log('Mongo', cur_user.projects);
                    if (commands.import) {
                        await users_db.update({uid: cur_user.uid}, {'$set': {projects: ldap_projects}});
                        nb_updated++;
                    }
                }

                if (!CONFIG.general.disable_user_group && cur_user.group === '') {
                    let cur_group = await groups_db.findOne({'gid': cur_user.gidnumber});
                    if (commands.import) {
                        await users_db.update({uid: cur_user.uid}, {'$set': {group: cur_group.name}});
                        nb_updated++;
                    }
                }
            }
        }
    }
    catch(e) {
        console.error(e);
        process.exit(1);
    }

    console.info('Number of Link Updated: ' + nb_updated);
}



async function import_users() {
    console.log("Search for users");
    let nb_entry = 0;
    let results = {};

    try {
        results = await client.searchReturnAll('ou=people,' + CONFIG.ldap.dn, cliopts);
        for (let entry of results.entries) {
            // console.debug('User entry: ' + JSON.stringify(entry));
            await record_user(entry);
            nb_entry++;
        }
    }
    catch(e) {
        console.error(e);
    }

    console.info('Number of User Entry: ' + nb_entry);
    console.info('Number of User Added: ' + nb_user_added);
    return results;
}



async function record_user(user){
    if(! user.uid || user.uid == ""){
        // console.debug("[SKIP] User : " + user.dn + " as it don't have an uid");
        return;
    }

    if(user.objectClass.indexOf("posixAccount") == -1 ) {
        // console.debug("[SKIP] User :" + user.dn + " as it is not posix");
        return;
    }

    if(! user.homeDirectory || ! user.homeDirectory.startsWith(CONFIG.general.home)) {
        // console.debug("[SKIP] ", user.uid, " invalid home dir");
        return;
    }

    let cur_user = await users_db.findOne({'uid': user.uid});
    if (cur_user) {
        // console.debug("[SKIP] User :" + user.uid + " as it already exist");
        return;
    }

    let is_fake = false;
    if(! user.mail || user.mail == ""){
        console.warn("User ", user.uid, " has not email declared, tagging user as a fake/service user");
        is_fake = true;
    }

    let default_main_group = CONFIG.general.default_main_group || '';
    let group = '';
    if (!CONFIG.general.disable_user_group) {
        switch (CONFIG.general.registration_group) {
        case 'username':
            group = req.params.id;
            break;
        case 'main':
            group = default_main_group;
            break;
        case 'team':
        default:
            group = ''; // as we don't have the team in ldap
            break;
        }
    }

    console.info("[ADD] user :" + user.uid);
    var go_user = {
        status: "Active",
        uid: user.uid,
        firstname: user.givenName,
        lastname: user.sn,
        email: user.mail,
        address: "",
        lab: "",
        responsible: "",
        group: group,
        secondarygroups: [],
        projects: [],
        home: user.homeDirectory,
        maingroup: default_main_group,
        why: "",
        ip: "",
        regkey: Math.random().toString(36).substring(7),
        is_internal: false,
        is_fake: is_fake,
        uidnumber: parseInt(user.uidNumber),
        gidnumber: parseInt(user.gidNumber),
        duration: '1 year',
        expiration: new Date().getTime() + 1000*3600*24*365,
        loginShell: user.loginShell,
        history: [{action: 'import', date: new Date().getTime()}]
    };

    if (commands.import) {
        await users_db.update({uid: go_user.uid}, {'$set': go_user}, {upsert: true});
        nb_user_added++;
    }
}


async function import_groups() {
    console.log("Search for groups");
    let nb_entry = 0;
    let result = {};

    try {
        results = await client.searchReturnAll('ou=groups,' + CONFIG.ldap.dn, cliopts);
        for (let entry of results.entries) {
            // console.debug('Group entry: ' + JSON.stringify(entry));
            await record_group(entry);
            nb_entry++;
        }
    }
    catch(e) {
        console.error(e);
    }

    console.info('Number of Group Entry: ' + nb_entry);
    console.info('Number of Group Added: ' + nb_group_added);
    console.info('Number of Project Added: ' + nb_project_added);
    return results;
}


async function record_group(group){
    if(!group.dn.startsWith("cn")) {
        // console.debug("[SKIP] Group :" + group.dn + " as it don't start with cn");
        return;
    }

    if(group.objectClass.indexOf("posixGroup") == -1 ) {
        // console.debug("[SKIP] Group :" + group.dn + " as it is not posix");
        return;
    }

    if (group.dn.includes('ou=user-groups')) {
        // console.debug("[SKIP] Group :" + group.cn + " as it is a user-groups");
        return;
    }

    if(group.memberUid === undefined) { // this work only on posix group
        // console.debug("[SKIP] Group :" + group.cn + " as it don't have any member");
        return;
    }

    if (group.dn.includes("ou=projects")) {
        let cur_project = await projects_db.findOne({'id': group.cn});
        if (cur_project) {
            // console.debug("[SKIP] Project :" + group.cn + " as it already exist");
            return;
        }
        console.info("[ADD] Project :" + group.cn);
        var go_project = {
            id: group.cn,
            owner: ""
        };
        if (commands.import) {
            await projects_db.update({name: go_project.id}, {'$set': go_project}, {upsert: true});
            nb_project_added++;
        }
    }
    else
    {

        let cur_group = await groups_db.findOne({'name': group.cn});
        if (cur_group) {
            // console.debug("[SKIP] Group :" + group.cn + " as it already exist");
            return;
        }
        console.info("[ADD] Group :" + group.cn);
        let go_group = {
            name: group.cn,
            gid: parseInt(group.gidNumber),
            owner: ""
        };
        if (commands.import) {
            await groups_db.update({name: go_group.name}, {'$set': go_group}, {upsert: true});
            nb_group_added++;
        }
    }
    return;
}
