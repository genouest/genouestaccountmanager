var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var escapeshellarg = require('escapeshellarg');
var markdown = require("markdown").markdown;
var htmlToText = require('html-to-text');

var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var MAIL_CONFIG = CONFIG.gomail;
router.get('/conf', function(req, res){
    res.send({
        'main_groups': CONFIG.general.main_groups,
        'name': CONFIG.general.name,
        'support': CONFIG.general.support,
        'main_list': MAIL_CONFIG.main_list,
        'origin': MAIL_CONFIG.origin
    });
    res.end();
});

module.exports = router;
