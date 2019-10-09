var express = require('express');
var router = express.Router();
// var bcrypt = require('bcryptjs');
// var escapeshellarg = require('escapeshellarg');
// var markdown = require("markdown").markdown;
// var htmlToText = require('html-to-text');

// var Promise = require('promise');
// const winston = require('winston');
// const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var MAIL_CONFIG = CONFIG.gomail;

var monk = require('monk');
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db);
var users_db = db.get('users');


router.get('/conf', function(req, res){
    let terms_of_use = '/doc/terms_of_use.txt';
    if (CONFIG.general.terms_of_use) {
        terms_of_use = CONFIG.general.terms_of_use;
    }
    let enable_ui = {
        'messages': true,
        'databases': true,
        'tps': true,
        'websites': true
    };
    if (CONFIG.enable_ui) {
        enable_ui = CONFIG.enable_ui;
    }
    // todo: factorize res.send
    let max_account = false;
    if (CONFIG.general.max_account && CONFIG.general.max_account > 0) {
        users_db.count({status: 'Active'}, function(err, count) {
            if(count >= CONFIG.general.max_account) {
                max_account = true;
            }
            res.send({
                'main_groups': CONFIG.general.main_groups,
                'terms_of_use': terms_of_use,
                'name': CONFIG.general.name,
                'support': CONFIG.general.support,
                'main_list': MAIL_CONFIG.main_list,
                'origin': MAIL_CONFIG.origin,
                'max_account': max_account,
                'enable_ui': enable_ui
            });
            res.end();
        });

    }
    else {
        res.send({
            'main_groups': CONFIG.general.main_groups,
            'terms_of_use': terms_of_use,
            'name': CONFIG.general.name,
            'support': CONFIG.general.support,
            'main_list': MAIL_CONFIG.main_list,
            'origin': MAIL_CONFIG.origin,
            'max_account': false,
            'enable_ui': enable_ui
        });
        res.end();
    }
});

module.exports = router;
