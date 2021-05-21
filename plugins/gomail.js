/* eslint-disable no-console */
const notif = require('../core/notif_gomail.js');
const Promise = require('promise');

// eslint-disable-next-line no-unused-vars
var activate_user = function(userId, data, adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('[Gomail] nothing to do');
        resolve();
    });
};

// eslint-disable-next-line no-unused-vars
var deactivate_user = function(userId, data, adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        console.log('[Gomail] Nothing to do');
        resolve();
    });
};

// eslint-disable-next-line no-unused-vars
var get_user_info = async function(userId, adminId){
    let listOfLists = await notif.getLists();
    return {'lists': listOfLists, 'newlist': ''};

};

// eslint-disable-next-line no-unused-vars
var set_user_info = async function(userId, data, adminId){
    await notif.create(data.newlist);
    let listOfLists = await  notif.getLists();
    return {'lists': listOfLists, 'newlist': ''};
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
        var response = '<div></div>';
        return response;
    },
    get_data: function(userId, adminId){
        return get_user_info(userId,adminId);
    },
    set_data: function(userId, data, adminId){
        return set_user_info(userId, data, adminId);
    },
    // eslint-disable-next-line no-unused-vars
    remove: function(userId, data, adminId){
        // eslint-disable-next-line no-unused-vars
        return new Promise(function (resolve, reject){
            console.log('nothing to do');
            resolve();
        });
    }
};
