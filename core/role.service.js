//const Promise = require('promise');
//const winston = require('winston');
//const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

// This will allow to change the way admin right are checked without impact on other part of the code
// It will also be used to manage new role in future feature

exports.is_admin = is_admin;

async function is_admin(user) {
    if (!user) {
        return false;
    }

    if (user.uid === undefined) { // backward compatibility with user = user.uid, just in case
        if (CONFIG.general.admin.indexOf(user) >= 0)
        {
            return true;
        }
        return false;
    }
    if (CONFIG.general.admin.indexOf(user.uid) >= 0)
    {
        return true;
    }
    if (CONFIG.general.admin_group) {
        if (user.group == CONFIG.general.admin_group) {
            return true;
        }
        if (user.secondarygroups && user.secondarygroups.indexOf(CONFIG.general.admin_group) >= 0) {
            return true;
        }
    }
    return false;
}
