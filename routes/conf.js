/* TODO : create a core/conf.service.js and move all method in it */

const express = require('express');
var router = express.Router();
// const winston = require('winston');
// const logger = winston.loggers.get('gomngr');

const dbsrv = require('../core/db.service.js');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;
var MAIL_CONFIG = CONFIG.gomail;

router.get('/conf', async function(req, res){
    let config = {
        'main_groups': my_conf.general.main_groups,
        'terms_of_use': my_conf.general.terms_of_use,
        'default_home': my_conf.general.web_home,
        'name': my_conf.general.name,
        'support': my_conf.general.support,
        'main_list': MAIL_CONFIG.main_list,
        'origin': MAIL_CONFIG.origin,
        'max_account': false,
        'enable_ui': my_conf.enable_ui,
        'duration': Object.keys(my_conf.duration),
        'project': my_conf.project,
        'registration': my_conf.registration || [],
        'reservation': my_conf.reservation
    };

    // should be check on each call
    if (CONFIG.general.max_account && CONFIG.general.max_account > 0) {
        let count = await dbsrv.mongo_users().count({status: 'Active'});
        if(count >= CONFIG.general.max_account) {
            config.max_account = true;
        }
    }

    res.send(config);
    res.end();

});

module.exports = {
    router: router
};
