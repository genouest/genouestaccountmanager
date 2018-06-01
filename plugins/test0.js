
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users'),
    events_db = db.get('events');

var Promise = require('promise');

var activate_user = function(user, data){
    return new Promise(function (resolve, reject){
        console.log('activate ' + user);

        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err)};
            console.log('done');
            resolve(data);
        });
    });
};

var deactivate_user = function(user, data){
    return new Promise(function (resolve, reject){
        console.log('deactivate ' + user);

        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err)};
            console.log('done');
            resolve(data);
        });
    });
};

var get_user_info = function(user){
    return new Promise(function (resolve, reject){
        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err)};
            resolve({'my': data.email});
        });
    });
};

var set_user_info = function(user, data){
    return new Promise(function (resolve, reject){
        console.log("should do something to update");
        users_db.findOne({'uid': user}, function(err, data){
            if(err){ reject(err)};
            resolve({'my': "should do something to update"});
        });
    });
};

module.exports = {

    activate: function(user, data){
        console.log('activation of user ' + user);
        return activate_user(user, data);
        /*
        users_db.findOne({'uid': user}, function(err, data){
            console.log(data);
            return data;
        });
        */
        //return {'msg': 'nothing to do'};
    },
    deactivate: function(user){
        console.log('deactivation of user ' + user);
        return deactivate_user(user, data);
        // return {'msg': 'nothing to do'};
    },
    template: function(){
        return "<div>hello {{user.uid}}</div><div><input ng-model=\"plugin_data.test0.my\"></input> <button ng-click=\"plugin_update('test0')\" class=\"button\">Update</button></div>";
    },
    get_data: function(user){
        return get_user_info(user);
        //return {'my': 'me'};
    },
    set_data: function(user, data){
        return set_user_info(user, data);
        //return {'msg': 'nothing to do'};
    }
}
