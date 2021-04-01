/* eslint-disable no-console */
const fs = require('fs');
const Promise = require('promise');
const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;
const dbsrv = require('../core/db.service.js');

var activate_user = async function(userId, _data, adminId){
    console.log('[Slurm] : Creating slurm cron file.. ' + userId );
    var fid = new Date().getTime();
    var script = '#!/bin/bash\n';
    script += 'set -e\n';
    script += `sacctmgr -i add account ${userId} Cluster=genouest Description="none" Organization="none"\n`;
    script += `sacctmgr -i create user name=${userId} DefaultAccount=${userId}\n`;
    var script_file = CONFIG.general.script_dir+'/'+userId+'.'+fid+'.slurm.update';
    const create_script = function() {
        return new Promise((resolve, reject) => {
            fs.writeFile(script_file, script, function(err) {
                if(err){
                    console.trace('[slurm] : Could not write script in path ' + script_file);
                    reject();
                    return;
                } else {
                    fs.chmodSync(script_file,0o755);
                }
                resolve();
                return;
            });
        });
    };
    try {
        await create_script();
        await dbsrv.mongo_events().insertOne({'owner': adminId,'date': new Date().getTime(), 'action': 'Create slurm user account ' + userId , 'logs': [userId+'.'+fid+'.slurm.update']});
        console.log('[slurm] : done');
    } catch (err) {
        await dbsrv.mongo_events().insertOne({'owner': adminId,'date': new Date().getTime(), 'action': 'Create slurm user account ' + userId , 'logs': [], 'status': 1});
        console.log('[slurm]: failed');
    }
    return true;
};
var deactivate_user = async function(userId, _data, adminId){

    console.log('[Slurm] : Creating slurm cron file.. ' + userId );
    var fid = new Date().getTime();
    var script = '#!/bin/bash\n';
    script += 'set -e\n';
    script += `sacctmgr -i delete user ${userId} account=${userId}\n`;
    script += `sacctmgr -i delete account ${userId} \n`;
    var script_file = CONFIG.general.script_dir+'/'+userId+'.'+fid+'.slurm.update';
    const create_script = function() {
        return new Promise((resolve, reject) => {
            fs.writeFile(script_file, script, function(err) {
                if(err){
                    console.trace('[slurm] : Could not write script in path ' + script_file);
                    reject();
                    return;
                }
                fs.chmodSync(script_file,0o755);
                resolve();
                return;
            });
        });
    };
    try {
        await create_script();
        await dbsrv.mongo_events().insertOne({'owner': adminId,'date': new Date().getTime(), 'action': 'Delete slurm user account ' + userId , 'logs': [userId+'.'+fid+'.slurm.update']}, function(){});
        console.log('[slurm] : done');
    } catch(err) {
        await dbsrv.mongo_events().insertOne({'owner': adminId,'date': new Date().getTime(), 'action': 'Delete slurm user account ' + userId , 'logs': [], 'status': 1});
        console.log('[slurm] : failed');
    }
};

// eslint-disable-next-line no-unused-vars
var get_user_info = function(_userId, _adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('Nothing to do');
        resolve();
    });
};

// eslint-disable-next-line no-unused-vars
var set_user_info = function(_userId, _data, _adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('Nothing to do');
        resolve();
    });
};

var delete_user = function(userId, user, adminId){
    if (user.status == 'Active') {
        return deactivate_user(userId, user, adminId);
    }
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('Nothing to do');
        resolve();
    });
};

module.exports = {

    activate: function(userId, user, adminId){
        console.log('Plugin slurm for activation of user : ' + userId);
        return activate_user(userId, user, adminId);
    },
    deactivate: function(userId, user, adminId){
        console.log('Plugin slurm for deactivation of user : ' + userId);
        return deactivate_user(userId, user, adminId);
    },
    template: function(){
        var response = '<div class="alert alert-info">Plugin Slurm is active<br><br>Account is created on user activation.</div>';
        return response;
    },
    get_data: function(userId, adminId){
        return get_user_info(userId, adminId);
    },
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
    },
    remove: function(userId, user, adminId){
        console.log('Plugin slurm for deletion of user : ' + userId);
        return delete_user(userId, user, adminId);
    }
};
