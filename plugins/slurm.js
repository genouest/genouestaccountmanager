var fs = require('fs');
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    events_db = db.get('events');

var Promise = require('promise');

var activate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
            console.log('[Slurm] : Creating slurm cron file.. ' + userId );
            var fid = new Date().getTime();
            var script = "#!/bin/bash\n";
            script += "set -e\n";
            script += `sacctmgr -i add account ${userId} Cluster=genouest Description="none" Organization="none"\n`;
            script += `sacctmgr -i create user name=${userId} DefaultAccount=${userId}\n`;
            var script_file = CONFIG.general.script_dir+'/'+userId+"."+fid+".slurm.update";
            fs.writeFile(script_file, script, function(err) {
		        if(err){
                    console.trace("[slurm] : Could not write script in path " + script_file);
                    resolve();
                    return;
                }
                fs.chmodSync(script_file,0755);
                events_db.insert({'owner': adminId,'date': new Date().getTime(), 'action': 'Create slurm user account ' + userId , 'logs': [userId+"."+fid+".slurm.update"]}, function(err){});
                console.log('[slurm] : done');
        	    resolve();
            });
 
    });
};
var deactivate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('[Slurm] : Creating slurm cron file.. ' + userId );
        var fid = new Date().getTime();
        var script = "#!/bin/bash\n";
        script += "set -e\n";
        script += `sacctmgr -i delete user ${userId} account=${userId}\n`;
        script += `sacctmgr -i delete account ${userId} \n`;
        var script_file = CONFIG.general.script_dir+'/'+userId+"."+fid+".slurm.update";
        fs.writeFile(script_file, script, function(err) {
            if(err){
                console.trace("[slurm] : Could not write script in path " + script_file);
                resolve();
                return;
            }
            fs.chmodSync(script_file,0755);
            events_db.insert({'owner': adminId,'date': new Date().getTime(), 'action': 'Delete slurm user account ' + userId , 'logs': [userId+"."+fid+".slurm.update"]}, function(err){});
            console.log('[slurm] : done');
            resolve();
        });
    });
};

var get_user_info = function(userId, adminId){
    return new Promise(function (resolve, reject){
        console.log('Nothing to do');
        resolve();
    });
};

var set_user_info = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('Nothing to do');
        resolve();
    });
};

var delete_user = function(userId, user, adminId){
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
        var response = "<div class=\"alert alert-info\">Plugin Slurm is active<br><br>Account is created on user activation.</div>";
        return response;
    },
    get_data: function(userId, adminId){
        return get_user_info(userId, adminId);
    },
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
    },
    remove: function(userId, user, adminId){
        console.log('Plugin slurm for deletion of user : ' + userId)
        return delete_user(userId, user, adminId);
    }
}

