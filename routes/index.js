const express = require('express');
var router = express.Router();

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;
var GENERAL_CONFIG = CONFIG.general;

/* GET home page. */
router.get('/', function(req, res) {
    res.redirect(GENERAL_CONFIG.url+'/manager2');
});

module.exports = router;
