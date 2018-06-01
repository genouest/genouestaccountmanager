var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users'),
    events_db = db.get('events');

var Promise = require('promise');


var remove_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){

            users_db.findOne({'uid': userId}, function(err, user){
            if(err){
                console.trace("Error finding user")
                resolve();
                return;
            }
            console.log('Plugin removal test done');
            resolve();
        });
    });
};

var activate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){

            users_db.findOne({'uid': userId}, function(err, user){
            if(err){
                console.trace("Error finding user")
                resolve();
                return;
            }
            console.log('Plugin test done');
            resolve();
        });
    });
};

var deactivate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        users_db.findOne({'uid': userId}, function(err, data){
            if(err){
                console.trace("Error finding user");
                reject(err);
                return;
            }
            console.log('done');
            resolve(data);
        });
    });
};

var get_user_info = function(userId, adminId){
    return new Promise(function (resolve, reject){
        users_db.findOne({'uid': userId}, function(err, data){
            if(err){
                console.trace("Error finding user");
                reject(err);
                return;
            }
            resolve({'my': data.email});
        });
    });
};

var set_user_info = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log("should do something to update");
        users_db.findOne({'uid': userId}, function(err, user){
            if(err){
                console.trace("Error finding user");
                reject(err);
                return;
            }
            resolve({'my': "test update message"});
        });
    });
};

module.exports = {
    remove: function(userId, data, adminId){
        console.log('Plugin test for removal of user : ' + userId);
        return remove_user(userId, data, adminId);
    },
    activate: function(userId, data, adminId){
        console.log('Plugin test for activation of user : ' + userId);
        return activate_user(userId, data, adminId);
        /*
        users_db.findOne({'uid': user}, function(err, data){
            console.log(data);
            return data;
        });
        */
        //return {'msg': 'nothing to do'};
    },
    deactivate: function(userId, data, adminId){
        console.log('Plugin test for deactivation of user : ' + userId);
        return deactivate_user(userId, data, adminId);
        // return {'msg': 'nothing to do'};
    },
    template: function(){
        return "<div>hello {{user.uid}}</div><div><input ng-model=\"plugin_data.test.my\"></input> <button ng-click=\"plugin_update('test')\" class=\"button\">Update</button></div>";
    },
    get_data: function(userId, adminId){
        return get_user_info(userId, adminId);
        //return {'my': 'me'};
    },
    set_data: function(userId, data, adminId){
        console.log(userId + " " + data)
        return set_user_info(userId, data, adminId);
        //return {'msg': 'nothing to do'};
    }
}
