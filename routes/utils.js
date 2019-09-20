var Promise = require('promise')
const winston = require('winston')
const logger = winston.loggers.get('gomngr')
var CONFIG = require('config')

var monk = require('monk')
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db)
var groupsDb = db.get('groups')
var usersDb = db.get('users')

var redis = require("redis")
var redis_client = null

if (process.env.MY_REDIS_HOST) {
  CONFIG.redis.host = process.env.MY_REDIS_HOST
}
if (process.env.MY_REDIS_PORT) {
  CONFIG.redis.port = int(process.env.MY_REDIS_PORT)
}

if (CONFIG.redis !== undefined && CONFIG.redis.host !== undefined && CONFIG.redis.host !== null) {
    let redis_cfg = {host: CONFIG.redis.host, port: (CONFIG.redis.port || 6379)}
    logger.info("Using Redis", redis_cfg)
    redis_client = redis.createClient(redis_cfg)
} else {
    logger.warn('Using db id mngt, may create issue in case of multi-process!!!')
}

const ID_STRATEGY_INCR = 0;
const ID_STRATEGY_POOL = 1;

var ID_STRATEGY = ID_STRATEGY_INCR;

var userIds = []
var groupIds = []
var idsLoaded = false

function sanitizeString(rawValue) {
  if (typeof rawValue === 'string' && /^[0-9a-z-_]+$/i.test(rawValue)) {
    return rawValue
  }
  return undefined
}

exports.sanitizeSSHKey = function(rawValue) {
  if (typeof rawValue === 'string' && /^[0-9a-z-_\s]+$/i.test(rawValue)) {
    return rawValue
  }
  return undefined 
}

exports.sanitizePath = function(rawValue) {
  if (typeof rawValue === 'string' && /^[0-9a-z-_\s\/.]+$/i.test(rawValue)) {
    return rawValue
  }
  return undefined
}

exports.sanitize = function sanitize(rawValue) {
  let value = sanitizeString(rawValue)
  if (value == undefined) {
    return false
  }
  return true
}

exports.sanitizeAll = function sanitizeAll(rawValues) {
  for(let i=0;i<rawValues.length;i++) {
    let value = sanitizeString(rawValues[i])
    if (value === undefined) {
      return false;
    }
  }
  return true
}
  

exports.addReadmes = function(userHome) {
  let cmd = "if [ ! -e " + userHome + "/user_guides ]; then\n";
  cmd += "    mkdir -p " + userHome + "/user_guides\n";
  if (typeof CONFIG.general.readme == "object") {
    CONFIG.general.readme.forEach(function(dict) {
      cmd += "    ln -s " + dict.source_folder + " " + userHome + "/user_guides/" + dict.language + "\n";
    });
  } else {
    cmd += "    ln -s " + CONFIG.general.readme + " "+ userHome + "/user_guides/README\n";
  }
  cmd += "fi\n";
  return cmd
}

exports.addExtraDirs = function(userUID, userGroupName, userID, userGID) {
  cmd = "";
  if (CONFIG.general.user_extra_dirs === undefined) { return cmd }
  for(let i=0;i < CONFIG.general.user_extra_dirs.length; i++){
    extraDir = CONFIG.general.user_extra_dirs[i].replace("#USER#", userUID).replace("#GROUP#", userGroupName);
    if (extraDir == CONFIG.general.user_extra_dirs[i]) {
      logger.error("Extra dir is not user specific, skipping", extraDir);
      continue;
    }
    cmd += "if [ ! -e " + extraDir + " ]; then\n";
    cmd += "    mkdir -p " + extraDir + "\n";
    cmd += "    chown -R " + userID + ":" + userGID + " " + extraDir + "\n";
    cmd += "fi\n";
  }
  return cmd;
}

exports.deleteExtraDirs = function(userUID, userGroupName) {
  cmd = "";
  if (CONFIG.general.user_extra_dirs === undefined) { return cmd }
  for(let i=0;i < CONFIG.general.user_extra_dirs.length; i++){
    extraDir = CONFIG.general.user_extra_dirs[i].replace("#USER#", userUID).replace("#GROUP#", userGroupName)
    if (extraDir == CONFIG.general.user_extra_dirs[i]) {
      logger.error("Extra dir is not user specific, skipping", extraDir);
      continue;
    }
    cmd += "if [ -e " + extraDir + " ]; then\n";
    cmd += "    rm -rf " + extraDir + "\n";
    cmd += "else\n";
    cmd += '    echo "Directory does not exist"\n';
    cmd += "fi\n";
  }
  return cmd;
}

exports.moveExtraDirs = function(userUID, oldUserGroupName, newUserGroupName, userID, userGID) {
  cmd = "";
  if (CONFIG.general.user_extra_dirs === undefined) { return cmd }
  for(let i=0;i < CONFIG.general.user_extra_dirs.length; i++){
    oldExtraDir = CONFIG.general.user_extra_dirs[i].replace("#USER#", userUID).replace("#GROUP#", oldUserGroupName)
    extraDir = CONFIG.general.user_extra_dirs[i].replace("#USER#", userUID).replace("#GROUP#", newUserGroupName)
    if (extraDir == CONFIG.general.user_extra_dirs[i]) {
      logger.error("Extra dir is not user specific, skipping", extraDir);
      continue;
    }

    cmd += "if [ -e " + oldExtraDir + " ]; then\n";
    if (extraDir != oldExtraDir) {
      cmd += "    mv " + oldExtraDir + " " +extraDir + "\n";
    }
    cmd += "    chown -R " + userID + ":" + userGID + " " + extraDir + "\n";
    cmd += "else\n";
    cmd += '    echo "Directory does not exist"\n';
    cmd += "fi\n";
  }
  return cmd;
}


exports.isInitOver = function () {
  return new Promise(function (resolve, reject) {  
    if (redis_client !== null) {
        redis_client.get('my:ids:set', function(err , res){
            resolve(res !== undefined && res === 'done')
        })
    } else {
    resolve(idsLoaded === true)
    }
  })
}

// To be loaded at init, should wait for it to end
exports.loadAvailableIds = function (strategy) {
  return new Promise(function (resolve, reject) {
    if (strategy !== undefined) {
      ID_STRATEGY = strategy
    }
    if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
          redis_client.del('my:ids:set', function(err, res){
              redis_client.del('my:ids:user', function(err, res) {
                  redis_client.del('my:ids:group', function(err, res) {
                    _loadAvailableIds().then(function(){resolve()})
                  })  
              })
          })
    } else {
        _loadAvailableIds().then(function(){resolve()})
    }
  })
}

function _loadAvailableIds () {
  return new Promise(function (resolve, reject) {
    if (idsLoaded) {
      resolve(false)
      return
    }

    if (CONFIG.general.minuid === undefined) {
      logger.warn('Min and max user ids not defined in config, using some defaults (10000/40000)')
      CONFIG.general.minuid = 10000
      CONFIG.general.maxuid = 40000
    }
    if (CONFIG.general.mingid === undefined) {
      logger.warn('Min and max group ids not defined in config, using some defaults (10000/40000)')
      CONFIG.general.mingid = 10000
      CONFIG.general.maxgid = 40000
    }

    if (redis_client === null) {
        idsLoaded = true
        resolve(false)
        return
    }

    logger.info('Loading available ids....')
    usersDb.find().then(function (users) {
      logger.info('Check existing users')
      let usedIds = []
      let maxUsedId = CONFIG.general.minuid
      for (let i = 0; i < users.length; i++) {
        let user = users[i]
        if (user.uidnumber !== undefined && user.uidnumber > 0) {
          usedIds.push(user['uidnumber'])
          if (user['uidnumber'] > maxUsedId) {
            maxUsedId = user['uidnumber']
          }
        }
      }

      if (ID_STRATEGY === ID_STRATEGY_POOL) {
        for (let j = CONFIG.general.minuid; j < CONFIG.general.maxuid; j++) {
          if (usedIds.indexOf(j) === -1) {
            if (redis_client !== null) {
              redis_client.rpush('my:ids:user', j)
            } else {
              userIds.push(j)
            }
          }
        }
      } else {
        redis_client.set('my:ids:user', maxUsedId)
      }

      groupsDb.find().then(function (groups) {
        logger.info('Check existing groups')
        let usedIds = []
        let maxUsedId = CONFIG.general.mingid
        for (let i = 0; i < groups.length; i++) {
          let group = groups[i]
          if (group.gid !== undefined && group.gid > 0) {
            usedIds.push(group['gid'])
            if (group.gid > maxUsedId) {
              maxUsedId = group.gid
            }
          }
        }

        if (ID_STRATEGY === ID_STRATEGY_POOL) {
          for (let j = CONFIG.general.mingid; j < CONFIG.general.maxgid; j++) {
            if (usedIds.indexOf(j) === -1) {
              if (redis_client !== null) {
                redis_client.rpush('my:ids:group', j)
              } else {
                groupIds.push(j)
              }
            }
          }
        } else {
          redis_client.set('my:ids:group', maxUsedId)
        }
        logger.info('Available ids loaded, application is ready')
        redis_client.set('my:ids:set', 'done')
        idsLoaded = true
        resolve(true)
      })
    })
  })
}

exports.getUserAvailableId = function () {
  if (redis_client === null) {
      return _getUsersMaxId(CONFIG.general.minuid)
  }
  return _getAvailableId(0)
}

exports.getGroupAvailableId = function () {
  if (redis_client === null) {
    return _getGroupsMaxId(CONFIG.general.mingid)
  }    
  return _getAvailableId(1)
}

function _getUsersMaxId(minID) {
    return new Promise(function (resolve, reject) {
        let minUserID = minID
        usersDb.find({}, {limit: 1 , sort: {uidnumber: -1}}, (err, data) => {
          if (err)  {
            resolve(minUserID)
            return
          }
          if (data && data.length > 0){
            minUserID = data[0].uidnumber + 1
          }
          resolve(minUserID)
        })
    })
}

function _getGroupsMaxId(minID) {
    return new Promise(function (resolve, reject) {
        let minGroupID = minID
        groupsDb.find({}, {limit: 1 , sort: {gid: -1}}, (err , data) => {
            if (err)  {
                resolve(minGroupID)
                return
            }
            if (data && data.length > 0){
                minGroupID = data[0].gid + 1
            }
            resolve(minGroupID)
        })
    })
}

function _getAvailableId (objType) {
  return new Promise(function (resolve, reject) {
      if (redis_client !== null) {
        let key = 'my:ids:user'
        if (objType === 1) {
            key = 'my:ids:group'
        }
        if (ID_STRATEGY == ID_STRATEGY_POOL) {
          redis_client.lpop(key, function (err, res) {
              if (res === null) {
                  reject(new Error('no id available'))
              } else {
                  resolve(res)
              }
          })
        } else {
          redis_client.incr(key, function (err, res) {
            resolve(res)
          })
        }
      } else {
        reject()
      }
  })
}

exports.getNumberOfUserAvailableIds = function () {
  return new Promise(function (resolve, reject) {
  if(redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
      redis_client.llen('my:ids:user', function(err, res) {
          resolve(res)
      })
  } else {
    resolve(-1)
  }
  })
}
exports.getNumberOfGroupAvailableIds = function () {
  return new Promise(function (resolve, reject) {
    if(redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
      redis_client.llen('my:ids:group', function(err, res) {
        resolve(res)
      })
    } else {
      resolve(-1)
    }
   })
}

exports.freeUserId = function (id) {
  return _freeId(0, id)

}

exports.freeGroupId = function (id) {
  return _freeId(1, id)
}

exports.freeUsers = function () {
  return new Promise(function (resolve, reject) {
    if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
        redis_client.del('my:ids:user', function(err) {
            resolve()
        })
    } else {
        resolve()
    }
  })
}

exports.freeGroups = function () {
  return new Promise(function (resolve, reject) {
    if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
        redis_client.del('my:ids:group', function(err) {
            resolve()
        })
    } else {
        resolve()
    }
  })
}

function _freeId (key, id) {
  return new Promise(function (resolve, reject) {
    if (redis_client !== null && ID_STRATEGY === ID_STRATEGY_POOL) {
        if (id === undefined || id === null || id < 0) {
          resolve()
        }
        let key = 'my:ids:user'
        if (objType === 1) {
            key = 'my:ids:group'
        }
        redis_client.lpush(key, id, function(err, res) {
            resolve()
        })
    } else {
        resolve()
    }
  })
}
