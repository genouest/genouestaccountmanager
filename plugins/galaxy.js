var fs = require('fs');
var http = require('http');
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users'),
    events_db = db.get('events');

var Promise = require('promise');
var path_to_script = CONFIG.general.plugin_script_dir + "/remove_galaxy_user.py"


var activate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('[Galaxy] nothing to do');
        resolve();
    });
};
var deactivate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('[Galaxy] Nothing to do');
        resolve();
    });
};

var get_user_info = function(userId, adminId){
    return new Promise(function (resolve, reject){
        resolve({'galaxy': 1});
    });
};

var set_user_info = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('nothing to do');
        resolve();
    });
};

var remove_user_from_galaxy = function(userId, data, adminId) {
   return new Promise(function (resolve, reject) {
        if(data.email === undefined || data.email == "") {
            console.log("[Galaxy] no email defined, skipping " + userId + "...");
            resolve();
            return;
        }
        var fid = new Date().getTime();
        var script = "#!/bin/bash\n";
        script += "set -e\n";
        script += "python " + path_to_script + " --user " + data.email + " --url https://galaxy.genouest.org --api 165dea6468f0a01e12c93c3b6c17da53\n";
        var script_file = CONFIG.general.script_dir+'/'+data.uid+"."+fid+".galaxy.update";
        fs.writeFile(script_file, script, function(err) {
            if(err){
                console.trace("[Galaxy] : Error writing file");
                resolve(err);
                return;
            }
            fs.chmodSync(script_file,0755);
            events_db.insert({'owner': adminId,'date': new Date().getTime(), 'action': 'remove user from galaxy ' + data.uid , 'logs': [data.uid+"."+fid+".data_access"]}, function(err){});
                    resolve();
            });


   });

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
        var response = "";
        return response
    },
    get_data: function(userId, adminId){
        return get_user_info(userId,adminId);
    },
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
    },
    remove: function(userId, data, adminId){
        return remove_user_from_galaxy(userId, data, adminId);
    }
}
