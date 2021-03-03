const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const CONFIG = require('config')

// This will allow to change the way admin right are checked without impact on other part of the code
// It will also be used to manage new role in future feature

exports.is_admin = is_admin;

function is_admin(uid) {
    let isadmin = false;
    if (CONFIG.general.indexOf(session_user.uid) >= 0)
    {
        isadmin = true;
    }
    return isadmin;
}
