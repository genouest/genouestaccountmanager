
const monk = require('monk');
const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db);
const users_db = db.get('users');

const Promise = require('promise');

// eslint-disable-next-line no-unused-vars
var activate_user = function(user, data){
    return new Promise(function (resolve, reject){
        console.log('activate ' + user);

        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err);}
            console.log('done');
            resolve(data);
        });
    });
};

// eslint-disable-next-line no-unused-vars
var deactivate_user = function(user, data){
    return new Promise(function (resolve, reject){
        console.log('deactivate ' + user);

        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err);}
            console.log('done');
            resolve(data);
        });
    });
};

var get_user_info = function(user){
    return new Promise(function (resolve, reject){
        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err);}
            resolve({'my': data.email});
        });
    });
};

// eslint-disable-next-line no-unused-vars
var set_user_info = function(user, data){
    return new Promise(function (resolve, reject){
        console.log('should do something to update');
        // eslint-disable-next-line no-unused-vars
        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err);}
            resolve({'my': 'should do something to update'});
        });
    });
};

module.exports = {

    // eslint-disable-next-line no-unused-vars
    activate: function(userId, data, adminId){
        console.log('activation of user ' + userId);
        return activate_user(userId, data);
    },
    // eslint-disable-next-line no-unused-vars
    deactivate: function(userId, data, adminId){
        console.log('deactivation of user ' + userId);
        return deactivate_user(userId, data);
    },
    template: function(){
        return '<div>hello {{user.uid}}</div><div><input ng-model="plugin_data.test0.my"></input> <button ng-click="plugin_update(\'test0\')" class="button">Update</button></div>';
    },
    // eslint-disable-next-line no-unused-vars
    get_data: function(userId, adminId){
        return get_user_info(userId);
    },
    // eslint-disable-next-line no-unused-vars
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data);
    }
};
