var express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
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
        let duration_list = {
            '3 months': 91,
            '6 months': 182,
            '1 year': 365,
            '2 years': 730,
            '3 years': 1095
        };

        if (!conf.duration) {
            conf.duration = duration_list;
        }
        // logger.info(CONFIG.duration);
        is_init = true;
    }
}

// todo: should replace all {var CONFIG = require('config');} by a call to this function
function get_conf () {
    init();
    return conf;
}


router.get('/conf', async function(req, res){
    let terms_of_use = '/doc/terms_of_use.txt';
    if (CONFIG.general.terms_of_use) {
        terms_of_use = CONFIG.general.terms_of_use;
    }
    let default_home = 'user'; // can be user or project
    if (CONFIG.general.web_home) {
        default_home = CONFIG.general.web_home;
    }
    let enable_ui = {
        'messages': true,
        'databases': true,
        'tps': true,
        'websites': true,
        'u2f_key': true,
        'ip': true,
        'newsletters': true,
        'log': true
    };
    if (CONFIG.enable_ui) {
        enable_ui = CONFIG.enable_ui;
    }
    enable_ui.main_group = CONFIG.general.use_group_in_path;
    let duration = Object.keys(get_conf().duration);
    // todo: factorize res.send
    let max_account = false;
    if (CONFIG.general.max_account && CONFIG.general.max_account > 0) {
        let count = await utils.mongo_users().count({status: 'Active'});
        //utils.mongo_users().count({status: 'Active'}, function(err, count) {
        if(count >= CONFIG.general.max_account) {
            max_account = true;
        }
        res.send({
            'main_groups': CONFIG.general.main_groups,
            'terms_of_use': terms_of_use,
            'default_home': default_home,
            'name': CONFIG.general.name,
            'support': CONFIG.general.support,
            'main_list': MAIL_CONFIG.main_list,
            'origin': MAIL_CONFIG.origin,
            'max_account': max_account,
            'enable_ui': enable_ui,
            'duration': duration
        });
        res.end();
        //});

    }
    else {
        res.send({
            'main_groups': CONFIG.general.main_groups,
            'terms_of_use': terms_of_use,
            'default_home': default_home,
            'name': CONFIG.general.name,
            'support': CONFIG.general.support,
            'main_list': MAIL_CONFIG.main_list,
            'origin': MAIL_CONFIG.origin,
            'max_account': false,
            'enable_ui': enable_ui,
            'duration': duration
        });
        res.end();
    }
});

module.exports = {
    router: router,
    get_conf: get_conf

};
