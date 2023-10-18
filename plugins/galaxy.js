/* eslint-disable no-console */
const fs = require('fs');
const Promise = require('promise');
const dbsrv = require('../core/db.service.js');
const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

var path_to_script = CONFIG.general.plugin_script_dir + '/remove_galaxy_user.py';

var apikey = '';

// eslint-disable-next-line no-unused-vars
var activate_user = function(userId, data, adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('[Galaxy] nothing to do');
        resolve();
    });
};

// eslint-disable-next-line no-unused-vars
var deactivate_user = function(userId, data, adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('[Galaxy] Nothing to do');
        resolve();
    });
};

// eslint-disable-next-line no-unused-vars
var get_user_info = function(userId, adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        resolve({'galaxy': 1});
    });
};

// eslint-disable-next-line no-unused-vars
var set_user_info = function(userId, data, adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('[Galaxy] nothing to do');
        resolve();
    });
};

var remove_user_from_galaxy = async function(userId, data, adminId) {
    if(data.email === undefined || data.email == '') {
        console.log('[Galaxy] no email defined, skipping ' + userId + '...');
        return true;
    }
    var fid = new Date().getTime();
    var script = '#!/bin/bash\n';
    script += 'set -e\n';
    script += 'python ' + path_to_script + ' --user ' + data.email + ' --url https://galaxy.genouest.org --api ' + apikey +'\n';
    var script_file = CONFIG.general.script_dir+'/'+data.uid+'.'+fid+'.galaxy.update';
    const create_script = function() {
        return new Promise((resolve, reject) => {
            fs.writeFile(script_file, script, function(err) {
                if(err){
                    console.trace('[Galaxy] : Error writing file');
                    reject(err);
                    return;
                }
                fs.chmodSync(script_file,0o755);
                resolve();
            });
        });
    };
    try {
        await create_script();
        dbsrv.mongo_events().insertOne({'owner': adminId,'date': new Date().getTime(), 'action': 'remove user from galaxy ' + data.uid , 'logs': [data.uid+'.'+fid+'.galaxy']});
    } catch(err) {
        dbsrv.mongo_events().insertOne({'owner': adminId,'date': new Date().getTime(), 'action': 'remove user from galaxy ' + data.uid , 'logs': [], 'status': 1});
        console.trace('[Galaxy][error] : remove user failed');
        return false;
    }
    console.trace('[Galaxy] : remove user done');
    return true;
};



module.exports = {

    activate: function(userId, data, adminId){
        console.log('Plugin galaxy for activation of user : ' + userId);
        return activate_user(userId, data, adminId);
    },
    deactivate: function(userId, data, adminId){
        console.log('Plugin galaxy for deactivation of user : ' + userId);
        return deactivate_user(userId, data, adminId);
    },
    template: function(){
        var response = '';
        return response;
    },
    get_data: function(userId, adminId){
        return get_user_info(userId,adminId);
    },
    // eslint-disable-next-line no-unused-vars
    set_data: function(userId, data, adminId){
        // eslint-disable-next-line no-unused-vars
        return new Promise(function (resolve, reject){
            console.log('[Galaxy] Nothing to do');
            resolve();
        });
    },
    update: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
    },
    remove: function(userId, data, adminId){
        return remove_user_from_galaxy(userId, data, adminId);
    }
};
