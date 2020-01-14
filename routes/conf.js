var express = require('express');
var router = express.Router();
// const winston = require('winston');
// const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var MAIL_CONFIG = CONFIG.gomail;
var utils = require('./utils');

//var monk = require('monk');
//var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db);
//var users_db = db.get('users');

let is_init = false;
let conf = null;
// todo: should add all default value here
function init () {
    if (!is_init) {
        conf = CONFIG;
        if (!conf.duration) {
            let duration_list = {
                '3 months': 91,
                '6 months': 182,
                '1 year': 365,
                '2 years': 730,
                '3 years': 1095
            };
            conf.duration = duration_list;
        }
        if (!conf.general.terms_of_use) {
            conf.general.terms_of_use = '/doc/terms_of_use.txt';
        }
        if (!conf.general.web_home) {
            conf.general.web_home = 'user'; // can be user or project
        }
        if (!conf.enable_ui) {
            conf.enable_ui = {
                'messages': true,
                'databases': true,
                'tps': true,
                'websites': true,
                'u2f_key': true,
                'ip': true,
                'newsletters': true,
                'log': true
            };
        }
        conf.enable_ui.main_group = CONFIG.general.use_group_in_path;
        conf.enable_ui.user_group = !CONFIG.general.disable_user_group;


        is_init = true;
    }
}

// todo: should replace all {var CONFIG = require('config');} by a call to this function
function get_conf () {
    init();
    return conf;
}


router.get('/conf', async function(req, res){
     let config = {
        'main_groups': get_conf().general.main_groups,
        'terms_of_use': get_conf().general.terms_of_use,
        'default_home': get_conf().general.web_home,
        'name': get_conf().general.name,
        'support': get_conf().general.support,
        'main_list': MAIL_CONFIG.main_list,
        'origin': MAIL_CONFIG.origin,
        'max_account': false,
        'enable_ui': get_conf().enable_ui,
        'duration': Object.keys(get_conf().duration)
    };

    // should be check on each call
    if (CONFIG.general.max_account && CONFIG.general.max_account > 0) {
        let count = await utils.mongo_users().count({status: 'Active'});
        if(count >= CONFIG.general.max_account) {
            config.max_account = true;
        }
    }

    res.send(config);
    res.end();

});

module.exports = {
    router: router,
    get_conf: get_conf

};
