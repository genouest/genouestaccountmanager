var fs = require('fs');
var CONFIG = require('config');
var notif = require('../routes/notif_gomail.js');
var Promise = require('promise');

var activate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('[Gomail] nothing to do');
        resolve();
    });
};
var deactivate_user = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        console.log('[Gomail] Nothing to do');
        resolve();
    });
};

var get_user_info = function(userId, adminId){
    return new Promise(function (resolve, reject){
        notif.getLists(function(listOfLists) {
            resolve({'lists': listOfLists, 'newlist': ''});
            return;
        });
    });
};

var set_user_info = function(userId, data, adminId){
    return new Promise(function (resolve, reject){
        notif.create(data.newlist, function() {
            notif.getLists(function(listOfLists) {
                resolve({'lists': listOfLists, 'newlist': ''});
                return;
            });
        });
    });
};


module.exports = {

    activate: function(userId, data, adminId){
        console.log('Plugin gomail for activation of user : ' + userId);
        return activate_user(userId, data, adminId);
    },
    deactivate: function(userId, data, adminId){
        console.log('Plugin gomail for deactivation of user : ' + userId);
        return deactivate_user(userId, data, adminId);
    },
    template: function(){
        var response = "<div></div>";
        return response
    },
    get_data: function(userId, adminId){
        return get_user_info(userId,adminId);
    },
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
    },
    remove: function(userId, data, adminId){
        return new Promise(function (resolve, reject){
            console.log('nothing to do');
            resolve();
        });
    }
}
