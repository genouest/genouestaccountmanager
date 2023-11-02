
const express = require('express');
var router = express.Router();
const Promise = require('promise');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');
const maisrv = require('../core/mail.service.js');
const rolsrv = require('../core/role.service.js');
const usrsrv = require('../core/user.service.js');

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
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    if(!session_user.is_admin) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    await dbsrv.mongo_databases().updateOne({name: req.params.id},{'$set': {owner: req.params.new}});
    await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' changed from ' + req.params.old + ' to ' + req.params.new, 'logs': []});
    res.send({message: 'Owner changed from '+req.params.old+' to '+req.params.new});
    res.end();
    return;
});


router.get('/database', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    let filter = {};
    if(!session_user.is_admin) {
        filter = {owner: session_user.uid};
    }
    let databases = await dbsrv.mongo_databases().find(filter).toArray();
    res.send(databases);
    return;

});

router.get('/database/owner/:owner', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.owner])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    let filter = {owner: req.params.owner};
    let databases = await dbsrv.mongo_databases().find(filter).toArray();
    res.send(databases);
    return;
});

router.post('/database/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;


    if (req.body.owner!=undefined && req.body.owner!='' && req.body.owner != session_user.uid && ! session_user.is_admin){
        res.status(401).send({message: 'Not authorized, cant declare a database for a different user'});
        return;
    }
    let owner = session_user.uid;
    let create_db = true;
    if(req.body.owner!=undefined && req.body.owner != ''){
        owner = req.body.owner;
    }
    if(req.body.create == false || (req.body.type != undefined && req.body.type != 'mysql')){
        create_db = false;
    }

    let db_type = 'mysql';
    if(req.body.type != undefined && req.body.type){
        db_type = req.body.type;
    }

    let db_host = CONFIG.mysql.host;
    if(req.body.host!=undefined && req.body.host && sansrv.sanitize(req.body.host)){
        db_host = req.body.host;
    }
    let db_usage = '';
    if(req.body.usage != undefined && req.body.usage){
        db_usage = req.body.usage;
    }
    let db_size = '';
    if(req.body.size != undefined && req.body.size){
        db_size = req.body.size;
    }
    let db_expire = '';
    if(req.body.expire != undefined && req.body.expire){
        db_expire = req.body.expire;
    }
    let db_single_user = true;
    if(req.body.single_user != undefined && req.body.single_user){
        db_single_user = req.body.single_user;
    }

    let db = {
        owner: owner,
        name: req.params.id,
        type: db_type,
        host: db_host,
        usage: db_usage,
        size: db_size,
        expire: db_expire,
        single_user: db_single_user

    };

    if (create_db) {
        if(!req.params.id.match(/^[0-9a-z_]+$/)) {
            res.status(403).send({database: null, message: 'Database name must be alphanumeric [0-9a-z_]'});
            res.end();
            return;
        }
        if(req.params.id.length<5) {
            res.status(403).send({database: null, message: 'Database name length must be >= 5'});
            res.end();
            return;
        }
    }

    let database = await dbsrv.mongo_databases().findOne({name: db.name});
    if(database) {
        res.status(403).send({database: null, message: 'Database already exists, please use an other name'});
        res.end();
        return;
    }
    else {
        await dbsrv.mongo_databases().insertOne(db);
        if(!create_db){
            await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' declared by ' +  session_user.uid, 'logs': []});
            res.send({message: 'Database declared'});
            return;
        }
        else {
            let createdb = 'CREATE DATABASE ' + req.params.id + ';\n';
            try {
                await querydb(createdb);
                //await connection.query(createdb);
            } catch(err) {
                logger.error('sql error', err);
                await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database creation error ' + req.params.id , 'logs': []});
                res.send({message: 'Creation error: '+err});
                res.end();
                return;
            }
            //let password = Math.random().toString(36).slice(-10);
            let password = usrsrv.new_password(10);
            let createuser = `CREATE USER '${req.params.id}'@'%' IDENTIFIED BY '${password}';\n`;
            try {
                await querydb(createuser);
                //await connection.query(createuser);
            } catch(err) {
                logger.error('sql error', err);
                res.send({message: 'Failed to create user'});
                res.end();
                return;
            }
            let grant = `GRANT ALL PRIVILEGES ON ${req.params.id}.* TO '${req.params.id}'@'%'\n`;
            try {
                await querydb(grant);
                //await connection.query(grant);
            } catch(err) {
                logger.error('sql error', err);
                res.send({message: 'Failed to grant access to user'});
                res.end();
                return;
            }

            try {
                await maisrv.send_notif_mail({
                    'name': 'database_creation',
                    'destinations': [session_user.email, CONFIG.general.accounts],
                    'subject': 'Database creation'
                }, {
                    '#OWNER#': owner,
                    '#DBHOST#': CONFIG.mysql.host,
                    '#DBNAME#': req.params.id,
                    '#DBUSER#': req.params.id,
                    '#DBPASSWORD#': password
                });
            } catch(error) {
                logger.error(error);
            }

            await dbsrv.mongo_pending_databases().deleteOne({ name: db.name });

            await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' created for ' +  db.owner, 'logs': []});

            res.send({message: 'Database created, credentials will be sent by mail'});
            res.end();
        }
    }

});

router.post('/requestdatabase/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!session_user) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;


    if (req.body.owner!=undefined && req.body.owner!='' && req.body.owner != session_user.uid && ! session_user.is_admin){
        res.status(401).send({message: 'Not authorized, cant ask for a database for a different user'});
        return;
    }
    let owner = session_user.uid;
    let create_db = true;
    if(req.body.owner!=undefined && req.body.owner != ''){
        owner = req.body.owner;
    }
    if(req.body.create == false || (req.body.type != undefined && req.body.type != 'mysql')){
        create_db = false;
    }

    let db_type = 'mysql';
    if(req.body.type != undefined && req.body.type){
        db_type = req.body.type;
    }

    let db_host = CONFIG.mysql.host;
    if(req.body.host!=undefined && req.body.host && sansrv.sanitize(req.body.host)){
        db_host = req.body.host;
    }
    let db_usage = '';
    if(req.body.usage != undefined && req.body.usage){
        db_usage = req.body.usage;
    }
    let db_size = '';
    if(req.body.size != undefined && req.body.size){
        db_size = req.body.size;
    }
    let db_expire = '';
    if(req.body.expire != undefined && req.body.expire){
        db_expire = req.body.expire;
    }
    let db_single_user = true;
    if(req.body.single_user != undefined && req.body.single_user){
        db_single_user = req.body.single_user;
    }
    let pending_db = {
        owner: owner,
        name: req.params.id,
        type: db_type,
        host: db_host,
        create: create_db,
        usage: db_usage,
        size: db_size,
        expire: db_expire,
        single_user: db_single_user

    };
    if (create_db) {
        if(!req.params.id.match(/^[0-9a-z_]+$/)) {
            res.status(403).send({database: null, message: 'Database name must be alphanumeric [0-9a-z_]'});
            res.end();
            return;
        }
        if(req.params.id.length<5) {
            res.status(403).send({database: null, message: 'Database name length must be >= 5'});
            res.end();
            return;
        }
    }

    let database = await dbsrv.mongo_databases().findOne({name: pending_db.name});
    let pending_database = await dbsrv.mongo_pending_databases().findOne({name: pending_db.name});
    if(database) {
        res.status(403).send({database: null, message: 'Database already exists, please use an other name'});
        res.end();
        return;
    }
    else if (pending_database){
        res.status(403).send({database: null, message: 'Database request already exists'});
        res.end();
        return;

    }
    else {
        await dbsrv.mongo_pending_databases().insertOne(pending_db);


        await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' asked for by ' +  session_user.uid, 'logs': []});

        res.send({message: 'Database requested, the admins will review your request'});
        res.end();
        
    }

});

router.get('/pending/database', async function (req, res) {

    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (!isadmin) {
        res.status(401).send('Not authorized');
        return;
    } 

    let pendings = await dbsrv.mongo_pending_databases().find({}).toArray();
    res.send(pendings);
    return;
    
    
    
});


router.delete('/database/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    let filter = {name: req.params.id};
    if(!session_user.is_admin) {
        filter['owner'] = session_user.uid;
    }

    let database = await dbsrv.mongo_databases().findOne({name: req.params.id});
    if(! database || (database.type!==undefined && database.type != 'mysql')) {
        await dbsrv.mongo_databases().deleteOne(filter);
        await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' deleted by ' +  session_user.uid, 'logs': []});
        res.send({message: ''});
        res.end();
        return;
    }
    else {
        await dbsrv.mongo_databases().deleteOne(filter);
        let dropusersql = `DROP USER '${req.params.id}'@'%';\n`;
        let dropdbsql = `DROP DATABASE ${req.params.id};\n`;
        try {
            await querydb(dropusersql);
            await querydb(dropdbsql);
        } catch(err) {
            logger.error('sql error', err);
            res.send({message: 'Could not delete database:' + err});
            return;
        }
        await dbsrv.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'database ' + req.params.id+ ' deleted by ' +  session_user.uid, 'logs': []});
        res.send({message: 'Database removed'});
        res.end();
        return;
        /*
        // eslint-disable-next-line no-unused-vars
        connection.query(sql, function(err, results) {
            let sql = `DROP DATABASE ${req.params.id};\n`;
            // eslint-disable-next-line no-unused-vars
            connection.query(sql, async function(err, results) {
                await dbsrv.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'database ' + req.params.id+ ' deleted by ' +  session_user.uid, 'logs': []});
                res.send({message: 'Database removed'});
                res.end();
                return;
            });
        });
        */
    }
});

router.delete('/pending/database/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    session_user.is_admin = isadmin;

    let filter = {name: req.params.id};
    if(!session_user.is_admin) {
        filter['owner'] = session_user.uid;
    }

    let pending_database = await dbsrv.mongo_pending_databases().findOne({name: req.params.id});
    if(! pending_database || (pending_database.type!==undefined && pending_database.type != 'mysql')) {
        await dbsrv.mongo_pending_databases().deleteOne(filter);
        await dbsrv.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database request' + req.params.id + ' deleted by ' +  session_user.uid, 'logs': []});
        res.send({message: ''});
        res.end();
        return;
    }
    else {
        await dbsrv.mongo_pending_databases().deleteOne(filter);

        await dbsrv.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'database request' + req.params.id+ ' deleted by ' +  session_user.uid, 'logs': []});
        res.send({message: 'Database removed'});
        res.end();
        return;
    }
});

router.delete_dbs = async function(user){
    let databases = await dbsrv.mongo_databases().find({'owner': user.uid}).toArray();
    logger.debug('delete_dbs');
    if(!databases){
        return true;
    }
    let res = await Promise.all(databases.map(function(database){
        return delete_db(user, database.name);
    }));
    return res;
};


var delete_db = async function(user, db_id){
    logger.debug('delete_db', db_id);
    let filter = {name: db_id};
    if(!user.is_admin) {
        filter['owner'] = user.uid;
    }
    let database = await dbsrv.mongo_databases().findOne({name: db_id});
    if(! database || (database.type!==undefined && database.type != 'mysql')) {
        await dbsrv.mongo_databases().deleteOne(filter);
        await dbsrv.mongo_events().insertOne(
            {
                'owner': user.uid,
                'date': new Date().getTime(),
                'action': 'database ' + db_id+ ' deleted by ' +  user.uid, 'logs': []
            }
        );
        return true;
    }
    else {
        await dbsrv.mongo_databases().deleteOne(filter);

        try {
            let dropuser = `DROP USER '${db_id}'@'%';\n`;
            await querydb(dropuser);
            let dropdb = `DROP DATABASE ${db_id};\n`;
            await querydb(dropdb);

        } catch(err) {
            await dbsrv.mongo_events().insertOne(
                {
                    'owner': user.uid,
                    'date': new Date().getTime(),
                    'action': 'Error: database ' + db_id + ' could not be deleted by ' + user.uid, 'logs': []
                }
            );
            return false;
        }
        await dbsrv.mongo_events().insertOne(
            {
                'owner': user.uid,
                'date': new Date().getTime(),
                'action': 'database ' + db_id + ' deleted by ' + user.uid, 'logs': []
            }
        );
        return true;
    }
};

module.exports = router;
