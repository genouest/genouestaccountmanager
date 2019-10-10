var Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');

/*
var monk = require('monk');
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db);
var groupsDb = db.get('groups');
var usersDb = db.get('users');
*/

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;
var mongo_groups = null;
var mongo_connect = async function() {
    let url = CONFIG.mongo.url;
    let client = null;
    if(!url) {
        client = new MongoClient(`mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}`);
    } else {
        client = new MongoClient(CONFIG.mongo.url);
    }
    await client.connect();
    mongodb = client.db(CONFIG.general.db);
    mongo_users = mongodb.collection('users');
    mongo_groups = mongodb.collection('groups');
};
mongo_connect();

exports.init = function() {
    return new Promise((resolve, reject) => {
        try {
            mongo_connect().then(() => {
                resolve();
            });
        } catch(err){
            logger.debug('Failed to init db', err);
            reject(err);
        }
    });
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
    if (typeof rawValue === 'string' && /^[0-9a-z-_\s]+$/i.test(rawValue)) {
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


exports.addReadmes = function(userHome) {
    let cmd = 'if [ ! -e ' + userHome + '/user_guides ]; then\n';
    cmd += '    mkdir -p ' + userHome + '/user_guides\n';
    if (typeof CONFIG.general.readme == 'object') {
        CONFIG.general.readme.forEach(function(dict) {
            cmd += '    ln -s ' + dict.source_folder + ' ' + userHome + '/user_guides/' + dict.language + '\n';
        });
    } else {
        cmd += '    ln -s ' + CONFIG.general.readme + ' ' + userHome + '/user_guides/README\n';
    }
    cmd += 'fi\n';
    return cmd;
};

exports.addExtraDirs = function(userUID, userGroupName, userID, userGID) {
    let cmd = '';
    if (CONFIG.general.user_extra_dirs === undefined) { return cmd; }
    for(let i=0;i < CONFIG.general.user_extra_dirs.length; i++){
        let extraDir = CONFIG.general.user_extra_dirs[i].replace('#USER#', userUID).replace('#GROUP#', userGroupName);
        if (extraDir == CONFIG.general.user_extra_dirs[i]) {
            logger.error('Extra dir is not user specific, skipping', extraDir);
            continue;
        }
        cmd += 'if [ ! -e ' + extraDir + ' ]; then\n';
        cmd += '    mkdir -p ' + extraDir + '\n';
        cmd += '    chown -R ' + userID + ':' + userGID + ' ' + extraDir + '\n';
        cmd += 'fi\n';
    }
    return cmd;
};

exports.deleteExtraDirs = function(userUID, userGroupName) {
    let cmd = '';
    if (CONFIG.general.user_extra_dirs === undefined) { return cmd; }
    for(let i=0;i < CONFIG.general.user_extra_dirs.length; i++){
        let extraDir = CONFIG.general.user_extra_dirs[i].replace('#USER#', userUID).replace('#GROUP#', userGroupName);
        if (extraDir == CONFIG.general.user_extra_dirs[i]) {
            logger.error('Extra dir is not user specific, skipping', extraDir);
            continue;
        }
        cmd += 'if [ -e ' + extraDir + ' ]; then\n';
        cmd += '    rm -rf ' + extraDir + '\n';
        cmd += 'else\n';
        cmd += '    echo "Directory does not exist"\n';
        cmd += 'fi\n';
    }
    return cmd;
};

exports.moveExtraDirs = function(userUID, oldUserGroupName, newUserGroupName, userID, userGID) {
    let cmd = '';
    if (CONFIG.general.user_extra_dirs === undefined) { return cmd; }
    for(let i=0;i < CONFIG.general.user_extra_dirs.length; i++){
        let oldExtraDir = CONFIG.general.user_extra_dirs[i].replace('#USER#', userUID).replace('#GROUP#', oldUserGroupName);
        let extraDir = CONFIG.general.user_extra_dirs[i].replace('#USER#', userUID).replace('#GROUP#', newUserGroupName);
        if (extraDir == CONFIG.general.user_extra_dirs[i]) {
            logger.error('Extra dir is not user specific, skipping', extraDir);
            continue;
        }

        cmd += 'if [ -e ' + oldExtraDir + ' ]; then\n';
        if (extraDir != oldExtraDir) {
            cmd += '    mv ' + oldExtraDir + ' ' +extraDir + '\n';
        }
        cmd += '    chown -R ' + userID + ':' + userGID + ' ' + extraDir + '\n';
        cmd += 'else\n';
        cmd += '    echo "Directory does not exist"\n';
        cmd += 'fi\n';
    }
    return cmd;
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

function _loadAvailableIds () {
    // eslint-disable-next-line no-unused-vars
    return new Promise(async function (resolve, reject) {
        if (idsLoaded) {
            resolve(false);
            return;
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
            resolve(false);
            return;
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
        idsLoaded = true;
        resolve(true);
    });
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

function _getUsersMaxId(minID) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(async function (resolve, reject) {
        let minUserID = minID;
        let data = await mongo_users.find({}, {limit: 1 , sort: {uidnumber: -1}}).toArray();
        if (!data)  {
            resolve(minUserID);
            return;
        }
        if (data && data.length > 0){
            minUserID = data[0].uidnumber + 1;
        }
        resolve(minUserID);
    });
}

function _getGroupsMaxId(minID) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(async function (resolve, reject) {
        let minGroupID = minID;
        let data = await mongo_groups.find({}, {limit: 1 , sort: {gid: -1}}).toArray();
        if (!data)  {
            resolve(minGroupID);
            return;
        }
        if (data && data.length > 0){
            minGroupID = data[0].gid + 1;
        }
        resolve(minGroupID);
    });
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
