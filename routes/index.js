const express = require('express');
var router = express.Router();
const CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

/* GET home page. */
router.get('/', function(req, res) {
    res.redirect(GENERAL_CONFIG.url+'/manager2');
});

module.exports = router;
