var Promise = require('promise');
const htmlToText = require('html-to-text');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;
const MAILER = CONFIG.general.mailer;
var notif = require('../routes/notif_'+MAILER+'.js');
const marked = require('marked');

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;
var mongo_groups = null;
var mongo_events = null;
var mongo_reservations = null;
var mongo_databases = null;
var mongo_web = null;
var mongo_projects = null;
var mongo_tags = null;

var mongo_connect = async function() {
    let url = CONFIG.mongo.url;
    let client = null;
    if(!url) {
        client = new MongoClient(`mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}`, { useNewUrlParser: true, useUnifiedTopology: true });
    } else {
        client = new MongoClient(CONFIG.mongo.url, { useNewUrlParser: true, useUnifiedTopology: true });
    }
    await client.connect();
    mongodb = client.db(CONFIG.general.db);
    mongo_users = mongodb.collection('users');
    mongo_groups = mongodb.collection('groups');
    mongo_events = mongodb.collection('events');
    mongo_reservations = mongodb.collection('reservations');
    mongo_databases = mongodb.collection('databases');
    mongo_web = mongodb.collection('web');
    mongo_projects = mongodb.collection('projects');
    mongo_tags = mongodb.collection('tags');
};
// mongo_connect();

exports.init_db = async function() {
    logger.info('initialize db connection');
    try {
        if(mongodb != null) {
            return null;
        }
        await mongo_connect();
        logger.info('connected');
        return null;
    } catch(err){
        logger.debug('Failed to init db', err);
        return err;
    }
};
exports.mongodb = mongodb;
exports.mongo_users = function() {return mongo_users;};
exports.mongo_groups = function() {return mongo_groups;};
exports.mongo_events = function() {return mongo_events;};
exports.mongo_reservations = function() {return mongo_reservations;};
exports.mongo_databases = function() {return mongo_databases;};
exports.mongo_web = function() {return mongo_web;};
exports.mongo_projects = function() {return mongo_projects;};
exports.mongo_tags = function() {return mongo_tags;};


var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];

exports.load_plugins = () => {
    for(let i=0;i<plugins.length;i++){
        if(!plugins_modules[plugins[i].name]) {
            plugins_modules[plugins[i].name] = require('../plugins/'+plugins[i].name);
            if(plugins[i].display_name === undefined) { plugins[i]['display_name'] = plugins[i].name; }
            if(plugins[i].admin_only === undefined) { plugins[i]['admin_only'] = false; }
            if(plugins[i].admin === undefined) { plugins[i]['admin'] = false; }
            plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name, 'display_name': plugins[i]['display_name'], 'admin_only': plugins[i]['admin_only'], 'admin': plugins[i]['admin']});
        }
    }
};

exports.plugins_info = () => {
    return plugins_info;
};

exports.plugins_modules = () => {
    return plugins_modules;
};



var redis = require('redis');
var redis_client = null;

if (process.env.MY_REDIS_HOST) {
    CONFIG.redis.host = process.env.MY_REDIS_HOST;
}
if (process.env.MY_REDIS_PORT) {
    CONFIG.redis.port = parseInt(process.env.MY_REDIS_PORT);
}

if (CONFIG.redis !== undefined && CONFIG.redis.host !== undefined && CONFIG.redis.host !== null) {
    let redis_cfg = {host: CONFIG.redis.host, port: (CONFIG.redis.port || 6379)};
    logger.info('Using Redis', redis_cfg);
    redis_client = redis.createClient(redis_cfg);
} else {
    logger.warn('Using db id mngt, may create issue in case of multi-process!!!');
}

const ID_STRATEGY_INCR = 0;
const ID_STRATEGY_POOL = 1;

var ID_STRATEGY = ID_STRATEGY_INCR;

var userIds = [];
var groupIds = [];
var idsLoaded = false;

function sanitizeString(rawValue) {
    if (typeof rawValue === 'string' && /^[0-9a-z-_]+$/i.test(rawValue)) {
        return rawValue;
    }
    return undefined;
}

exports.sanitizeSSHKey = function(rawValue) {
    if (typeof rawValue === 'string' && /^ssh-rsa AAAA[0-9A-Za-z+/]+[=]{0,3}/.test(rawValue)) {
        return rawValue;
    }
    return undefined;
};

exports.sanitizePath = function(rawValue) {
    // eslint-disable-next-line no-useless-escape
    if (typeof rawValue === 'string' && /^[0-9a-z-_\s\/.]+$/i.test(rawValue)) {
        return rawValue;
    }
    return undefined;
};

exports.sanitize = function sanitize(rawValue) {
    let value = sanitizeString(rawValue);
    if (value == undefined) {
        return false;
    }
    return true;
};

exports.sanitizeAll = function sanitizeAll(rawValues) {
    for(let i=0;i<rawValues.length;i++) {
        let value = sanitizeString(rawValues[i]);
        if (value === undefined) {
            return false;
        }
    }
    return true;
};


exports.isInitOver = function () {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if (redis_client !== null) {
            redis_client.get('my:ids:set', function(err , res){
                resolve(res !== undefined && res === 'done');
            });
        } else {
            resolve(idsLoaded === true);
        }
    });
};

// To be loaded at init, should wait for it to end
exports.loadAvailableIds = function (strategy) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if (strategy !== undefined) {
            ID_STRATEGY = strategy;
        }
        if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
            // eslint-disable-next-line no-unused-vars
            redis_client.del('my:ids:set', function(err, res){
                // eslint-disable-next-line no-unused-vars
                redis_client.del('my:ids:user', function(err, res) {
                    // eslint-disable-next-line no-unused-vars
                    redis_client.del('my:ids:group', function(err, res) {
                        _loadAvailableIds().then(function(){resolve();});
                    });
                });
            });
        } else {
            _loadAvailableIds().then(function(){resolve();});
        }
    });
};

async function _loadAvailableIds () {
    if (idsLoaded) {
        return false;
    }

    if (CONFIG.general.minuid === undefined) {
        logger.warn('Min and max user ids not defined in config, using some defaults (10000/40000)');
        CONFIG.general.minuid = 10000;
        CONFIG.general.maxuid = 40000;
    }
    if (CONFIG.general.mingid === undefined) {
        logger.warn('Min and max group ids not defined in config, using some defaults (10000/40000)');
        CONFIG.general.mingid = 10000;
        CONFIG.general.maxgid = 40000;
    }

    if (redis_client === null) {
        idsLoaded = true;
        return false;
    }

    logger.info('Loading available ids....');
    let users = await mongo_users.find().toArray();
    logger.info('Check existing users');
    let usedIds = [];
    let maxUsedId = CONFIG.general.minuid;
    for (let i = 0; i < users.length; i++) {
        let user = users[i];
        if (user.uidnumber !== undefined && user.uidnumber > 0) {
            usedIds.push(user['uidnumber']);
            if (user['uidnumber'] > maxUsedId) {
                maxUsedId = user['uidnumber'];
            }
        }
    }

    if (ID_STRATEGY === ID_STRATEGY_POOL) {
        for (let j = CONFIG.general.minuid; j < CONFIG.general.maxuid; j++) {
            if (usedIds.indexOf(j) === -1) {
                if (redis_client !== null) {
                    redis_client.rpush('my:ids:user', j);
                } else {
                    userIds.push(j);
                }
            }
        }
    } else {
        redis_client.set('my:ids:user', maxUsedId);
    }
    let groups = await mongo_groups.find().toArray();
    logger.info('Check existing groups');
    let usedGIds = [];
    let maxUsedGId = CONFIG.general.mingid;
    for (let i = 0; i < groups.length; i++) {
        let group = groups[i];
        if (group.gid !== undefined && group.gid > 0) {
            usedGIds.push(group['gid']);
            if (group.gid > maxUsedGId) {
                maxUsedGId = group.gid;
            }
        }
    }

    if (ID_STRATEGY === ID_STRATEGY_POOL) {
        for (let j = CONFIG.general.mingid; j < CONFIG.general.maxgid; j++) {
            if (usedGIds.indexOf(j) === -1) {
                if (redis_client !== null) {
                    redis_client.rpush('my:ids:group', j);
                } else {
                    groupIds.push(j);
                }
            }
        }
    } else {
        redis_client.set('my:ids:group', maxUsedGId);
    }
    logger.info('Available ids loaded, application is ready');
    redis_client.set('my:ids:set', 'done');
    // eslint-disable-next-line require-atomic-updates
    idsLoaded = true;
    return true;
}

exports.getUserAvailableId = function () {
    if (redis_client === null) {
        return _getUsersMaxId(CONFIG.general.minuid);
    }
    return _getAvailableId(0);
};

exports.getGroupAvailableId = function () {
    if (redis_client === null) {
        return _getGroupsMaxId(CONFIG.general.mingid);
    }
    return _getAvailableId(1);
};

async function _getUsersMaxId(minID) {
    let minUserID = minID;
    let data = await mongo_users.find({}, {limit: 1 , sort: {uidnumber: -1}}).toArray();
    if (!data)  {
        return minUserID;
    }
    if (data.length > 0){
        minUserID = data[0].uidnumber + 1;
    }
    if (minUserID < minID)
    {
        minUserID = minID;
    }
    return minUserID;
}

async function _getGroupsMaxId(minID) {
    let minGroupID = minID;
    let data = await mongo_groups.find({}, {limit: 1 , sort: {gid: -1}}).toArray();
    if (!data)  {
        return minGroupID;
    }
    if (data.length > 0){
        minGroupID = data[0].gid + 1;
    }
    if (minGroupID < minID)
    {
        minGroupID = minID;
    }
    return minGroupID;
}

function _getAvailableId (objType) {
    return new Promise(function (resolve, reject) {
        if (redis_client !== null) {
            let key = 'my:ids:user';
            if (objType === 1) {
                key = 'my:ids:group';
            }
            if (ID_STRATEGY == ID_STRATEGY_POOL) {
                redis_client.lpop(key, function (err, res) {
                    if (res === null) {
                        reject(new Error('no id available'));
                    } else {
                        resolve(res);
                    }
                });
            } else {
                redis_client.incr(key, function (err, res) {
                    resolve(res);
                });
            }
        } else {
            reject();
        }
    });
}

exports.getNumberOfUserAvailableIds = function () {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if(redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
            redis_client.llen('my:ids:user', function(err, res) {
                resolve(res);
            });
        } else {
            resolve(-1);
        }
    });
};
exports.getNumberOfGroupAvailableIds = function () {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if(redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
            redis_client.llen('my:ids:group', function(err, res) {
                resolve(res);
            });
        } else {
            resolve(-1);
        }
    });
};

exports.freeUserId = function (id) {
    return _freeId(0, id);
};

exports.freeGroupId = function (id) {
    return _freeId(1, id);
};

exports.freeUsers = function () {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
            // eslint-disable-next-line no-unused-vars
            redis_client.del('my:ids:user', function(err) {
                resolve();
            });
        } else {
            resolve();
        }
    });
};

exports.freeGroups = function () {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
            // eslint-disable-next-line no-unused-vars
            redis_client.del('my:ids:group', function(err) {
                resolve();
            });
        } else {
            resolve();
        }
    });
};

function _freeId (objType, id) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
            if (id === undefined || id === null || id < 0) {
                resolve();
            }
            let key = 'my:ids:user';
            if (objType === 1) {
                key = 'my:ids:group';
            }
            // eslint-disable-next-line no-unused-vars
            redis_client.lpush(key, id, function(err, res) {
                resolve();
            });
        } else {
            resolve();
        }
    });
}



// generic function for send notif (and email)

function get_mail_config () {
    var MAIL_CONFIG = {};
    // todo: more and more ugly init...
    if (CONFIG[MAILER]) { MAIL_CONFIG = CONFIG[MAILER]; }
    if (!MAIL_CONFIG.origin) {
        logger.error('No email origin are configured !');
    }
    return MAIL_CONFIG;
}

async function gen_mail_opt (options, variables)
{
    var MAIL_CONFIG = get_mail_config();
    // todo: check if each option exist and use default value
    let name = options['name'];
    let destinations = options['destinations'];
    let subject = GENERAL_CONFIG.name + ' ' + options['subject'];

    //find message
    let message = undefined;
    if (name && CONFIG.message[name]) {
        message = CONFIG.message[name].join('\n');
    }
    let html_message = message;
    if (name && CONFIG.message[name + '_html']) {
        html_message = CONFIG.message[name + '_html'].join('');
    }

    if (options['markdown'] !== undefined && options['markdown'] != '') {
        html_message = marked(options['markdown']);
    }

    if (!html_message) { // if html_message is not set then message is not set too
        logger.error('Email Message not found!');
        return null;
    } else if (!message) { // if html_message is set and message is not set too
        message = htmlToText.fromString(html_message);
    }

    // replace variable in message
    for (let key in variables) {
        let value = variables[key];
        if (value === undefined || value === null) { value = '';} // value may not be defined
        let html_value = value;
        let re = new RegExp(key,'g');


        // check if there is html tag in variable
        let re_html = /(<([^>]+)>)/;
        if (value.toString().match(re_html)) {
            value = htmlToText.fromString(value);
        }

        message = message.replace(re, value);
        html_message = html_message.replace(re, html_value);
    }

    // check footer
    let footer = 'From My';
    let html_footer = 'From My';

    if (CONFIG.message.footer) {
        footer = CONFIG.message.footer.join('\n');
    }
    if (CONFIG.message.footer_html) {
        html_footer = CONFIG.message.footer_html.join('<br/>');
        if (! CONFIG.message.footer) { // if there is only html value
            footer = htmlToText.fromString(html_footer);
        }
    }

    // always add footer
    message = message + '\n' + footer;
    html_message = html_message + '<br/>' + html_footer;

    // set mailOptions
    let mailOptions = {
        origin: MAIL_CONFIG.origin, // sender address
        destinations:  destinations, // list of receivers
        subject: subject, // Subject line
        message: message, // plaintext body
        html_message: html_message // html body
    };

    // tmp for debug
    // logger.info(mailOptions);

    // todo: find if we should return or send mail ...
    return mailOptions;
}

async function send_notif_mail (options, variables) {
    if(notif.mailSet()) {
        try {
            let mailOptions = await gen_mail_opt(options, variables);
            if (mailOptions) {
                await notif.sendUser(mailOptions);
            }
        } catch(err) {
            logger.error('send notif mail error', err);
        }
    }
}

// exports mail functions
exports.get_mail_config = get_mail_config;
exports.gen_mail_opt = gen_mail_opt;
exports.send_notif_mail = send_notif_mail;
