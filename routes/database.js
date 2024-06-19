
const express = require('express');
var router = express.Router();
const Promise = require('promise');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const udbsrv = require('../core/user_db.service.js');
const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');

const mysql = require('mysql');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
// const request = require('request');


var pool = null;
if(CONFIG.mysql.host) {
    pool = mysql.createPool({
        host     : CONFIG.mysql.host,
        user     : CONFIG.mysql.user,
        password : CONFIG.mysql.password,
        insecureAuth: true
    });
}

/*
var connection;

function handleDisconnect() {
    if (CONFIG.mysql.host) {
        connection = mysql.createConnection({
            host     : CONFIG.mysql.host,
            user     : CONFIG.mysql.user,
            password : CONFIG.mysql.password,
            insecureAuth: true
        }); // Recreate the connection, since
        // the old one cannot be reused.

        connection.connect(function(err) {              // The server is either down
            if(err) {                                     // or restarting (takes a while sometimes).
                logger.error('error when connecting to db:', err);
                setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
            }                                     // to avoid a hot loop, and to allow our node script to
        });                                     // process asynchronous requests in the meantime.
        // If you're also serving http, display a 503 error.
        connection.on('error', function(err) {
            logger.error('db error', err);
            if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
                handleDisconnect();                         // lost due to either server restart, or a
            } else {                                      // connnection idle timeout (the wait_timeout
                // throw err;                                  // server variable configures this)
            }
        });
    }
}

handleDisconnect();
*/

var querydb = (sql) => {
    return new Promise((resolve, reject) => {
        if(pool === null) {
            reject('no mysql pool defined');
            return;
        }
        pool.getConnection((err, connection) => {
            if(err) {
                logger.error('failed to get connection', err);
                reject(err);
                return;
            }
            // eslint-disable-next-line no-unused-vars
            connection.query(sql, function(err, results) {
                connection.release();
                if(err) {
                    logger.error('failed to exec sql', sql, err);
                    reject(err);
                    return;
                }
                logger.debug('sql result', sql, results);
                resolve(true);
            });
        });
    });
};


/**
 * Change owner
 */
router.put('/database/:id/owner/:old/:new', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if(!sansrv.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let session_user = null;
    let is_admin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if(!session_user) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if(is_admin) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    
    await dbsrv.mongo_databases().updateOne({name: req.params.id}, {'$set': {owner: req.params.new}});
    await dbsrv.mongo_events().insertOne({
        'owner': session_user.uid,
        'date': new Date().getTime(),
        'action': 'database ' + req.params.id + ' changed from ' + req.params.old + ' to ' + req.params.new,
        'logs': []
    });
    res.send({ message: 'Owner changed from ' + req.params.old + ' to ' + req.params.new });
});


router.get('/database', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    let session_user = null;
    let is_admin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if (!session_user) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }

    let filter = { };
    if(!is_admin) {
        filter = { owner: session_user.uid };
    }
    let databases = await dbsrv.mongo_databases().find(filter).toArray();
    res.send(databases);
});


router.get('/database/owner/:owner', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if(!sansrv.sanitizeAll([req.params.owner])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let session_user = null;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    } catch(e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if (!session_user) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }

    let databases = await dbsrv.mongo_databases().find({ owner: req.params.owner }).toArray();
    res.send(databases);
});


router.post('/requestdatabase/:id', async function(req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let session_user;
    let is_admin;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if (!session_user) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (req.body.owner && req.body.owner !== session_user.uid && !is_admin) {
        res.status(401).send({ message: 'Not authorized, cannot request a database for a different user' });
        return;
    }
    if (!req.body.expire) {
        res.status(403).send({ message: 'No expiration date' });
        return;
    }
    let pending_db = {
        owner: req.body.owner ? req.body.owner : session_user.uid,
        name: req.params.id,
        type: req.body.type ? req.body.type : 'mysql',
        host: req.body.host && sansrv.sanitize(req.body.host) ? req.body.host : CONFIG.mysql.host,
        usage: req.body.usage ? req.body.usage : '',
        size: req.body.size ? req.body.size : '',
        expire: req.body.expire,
        single_user: req.body.single_user !== undefined ? req.body.single_user : true
    };
    let create_db = !(req.body.create === false || (req.body.type && req.body.type !== 'mysql'));
    if (create_db) {
        if (!req.params.id.match(/^[0-9a-z_]+$/)) {
            res.status(403).send({ database: null, message: 'Database name must be alphanumeric [0-9a-z_]' });
            return;
        }
        if (req.params.id.length < 5) {
            res.status(403).send({ database: null, message: 'Database name length must be >= 5' });
            return;
        }
    }
    try {
        let database = await dbsrv.mongo_databases().findOne({ name: pending_db.name });
        let pending_database = await dbsrv.mongo_pending_databases().findOne({ name: pending_db.name });
        if (database) {
            res.status(403).send({ database: null, message: 'Database already exists, please use another name' });
            return;
        }
        if (pending_database) {
            res.status(403).send({ database: null, message: 'Database request already exists' });
            return;
        }

        await udbsrv.create_db_request(pending_db, session_user);
        res.send({ message: 'Database requested, the admins will review your request' });
    } catch (e) {
        logger.error(e);
        res.status(e.code || 500).send({ message: e.message || 'Server Error, contact admin' });
    }
});


router.post('/database/:id', async function(req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let session_user;
    let is_admin;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(session_user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if (!session_user) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (req.body.owner && req.body.owner !== session_user.uid && !is_admin) {
        res.status(401).send({ message: 'Not authorized, cannot declare a database for a different user' });
        return;
    }
    if (!req.body.expire) {
        res.status(403).send({ message: 'No expiration date' });
        return;
    }
    let db = {
        owner: req.body.owner ? req.body.owner : session_user.uid,
        name: req.params.id,
        type: req.body.type ? req.body.type : 'mysql',
        host: req.body.host && sansrv.sanitize(req.body.host) ? req.body.host : CONFIG.mysql.host,
        usage: req.body.usage ? req.body.usage : '',
        size: req.body.size ? req.body.size : '',
        expire: req.body.expire,
        single_user: req.body.single_user !== undefined ? req.body.single_user : true
    };
    let create_db = !(req.body.create === false || (req.body.type && req.body.type !== 'mysql'));
    if (create_db) {
        if (!req.params.id.match(/^[0-9a-z_]+$/)) {
            res.status(403).send({ database: null, message: 'Database name must be alphanumeric [0-9a-z_]' });
            return;
        }
        if (req.params.id.length < 5) {
            res.status(403).send({ database: null, message: 'Database name length must be >= 5' });
            return;
        }
    }
    try {
        let database = await dbsrv.mongo_databases().findOne({ name: db.name });
        if (database) {
            res.status(403).send({ database: null, message: 'Database already exists, please use another name' });
            return;
        }

        await dbsrv.mongo_databases().insertOne(db);
        let filter = { name: req.params.id };
        if (!is_admin) {
            filter['owner'] = session_user.uid;
        }
        await dbsrv.mongo_pending_databases().deleteOne(filter);
        if (!create_db) {
            await dbsrv.mongo_events().insertOne({
                owner: session_user.uid,
                date: new Date().getTime(),
                action: `database ${req.params.id} declared by ${session_user.uid}`,
                logs: []
            });
            res.send({ message: 'Database declared' });
        } else {
            await udbsrv.create_db(db, session_user, req.params.id);
            res.send({ message: 'Database created, credentials will be sent by mail' });
        }
    } catch (e) {
        logger.error(e);
        res.status(e.code || 500).send({ message: e.message || 'Server Error, contact admin' });
    }
});


router.get('/pending/database', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (!is_admin) {
        res.status(401).send('Not authorized');
        return;
    }

    let pendings = await dbsrv.mongo_pending_databases().find({ }).toArray();
    res.send(pendings);
});


router.delete('/database/:id', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if(!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let session_user = null;
    let is_admin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if(!session_user){
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    try {
        await udbsrv.delete_db(req.params.id, session_user.uid, is_admin)
        res.send({ message: 'Database removed' });
    } catch (e) {
        logger.error(e);
        res.status(e.code || 500).send({ message: e.message || 'Server Error, contact admin' });
    }
});


router.delete('/pending/database/:id', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if(!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let session_user = null;
    let is_admin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        return;
    }
    if(!session_user) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }

    let filter = { name: req.params.id };
    if(!is_admin) {
        filter['owner'] = session_user.uid;
    }
    await dbsrv.mongo_pending_databases().deleteOne(filter);
    await dbsrv.mongo_events().insertOne({
        'owner': session_user.uid,
        'date': new Date().getTime(),
        'action': 'database request ' + req.params.id + ' deleted by ' +  session_user.uid,
        'logs': []
    });
    res.send({ message: 'Database removed' });
    return;
});


router.delete_dbs = async function(user) {
    let databases = await dbsrv.mongo_databases().find({ 'owner': user.uid }).toArray();
    logger.debug('delete_dbs');
    if(!databases) {
        return true;
    }
    let res = await Promise.all(databases.map(function(database) {
        return udbsrv.delete_db(database.name, user.uid, user.is_admin);
    }));
    return res;
};


module.exports = router;
