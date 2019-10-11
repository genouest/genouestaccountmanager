var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var Promise = require('promise');

var utils = require('./utils.js');

var mysql = require('mysql');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
// const request = require('request');

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];
var notif = require('../routes/notif_'+MAILER+'.js');

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

/**
 * Change owner
 */
router.put('/database/:id/owner/:old/:new', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    if(!session_user.is_admin) {
        res.status(401).send('Not authorized');
        return;
    }
    await utils.mongo_databases().updateOne({name: req.params.id},{'$set': {owner: req.params.new}});
    await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' changed from ' + req.params.old + ' to ' + req.params.new, 'logs': []});
    res.send({message: 'Owner changed from '+req.params.old+' to '+req.params.new});
    res.end();
    return;
});


router.get('/database', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    var filter = {};
    if(!session_user.is_admin) {
        filter = {owner: session_user.uid};
    }
    let databases = await utils.mongo_databases().find(filter).toArray();
    res.send(databases);
    return;

});

router.get('/database/owner/:owner', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.owner])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});

    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    var filter = {owner: req.params.owner};
    let databases = await utils.mongo_databases().find(filter).toArray();
    res.send(databases);
    return;
});

router.post('/database/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if (!session_user) {
        res.status(401).send('Not authorized');
        return;        
    }

    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }

    if (req.body.owner!=undefined && req.body.owner!='' && req.body.owner != session_user.uid && ! session_user.is_admin){
        res.status(401).send('Not authorized, cant declare a database for a different user');
        return;
    }
    var owner = session_user.uid;
    var create_db = true;
    if(req.body.owner!=undefined && req.body.owner != ''){
        owner = req.body.owner;
    }
    if(req.body.create == false || (req.body.type != undefined && req.body.type != 'mysql')){
        create_db = false;
    }

    var db_type = 'mysql';
    if(req.body.type != undefined && req.body.type){
        db_type = req.body.type;
    }

    var db_host = CONFIG.mysql.host;
    if(req.body.host!=undefined && req.body.host && utils.sanitize(req.body.host)){
        db_host = req.body.host;
    }

    let db = {
        owner: owner,
        name: req.params.id,
        type: db_type,
        host: db_host
    };

    if (create_db && !req.params.id.match(/^[0-9a-z_]+$/)) {
        res.status(403).send({database: null, message: 'Database name must be alphanumeric [0-9a-z_]'});
        res.end();
        return;
    }

    let database = await utils.mongo_databases().findOne({name: db.name});
    if(database) {
        res.status(403).send({database: null, message: 'Database already exists, please use an other name'});
        res.end();
        return;
    }
    else {
        await utils.mongo_databases().insertOne(db);
        if(!create_db){
            await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' declared by ' +  session_user.uid, 'logs': []});
            res.send({message:'Database declared'});
            return;
        }
        else {
            let createdb = 'CREATE DATABASE ' + req.params.id + ';\n';
            try {
                await connection.query(createdb);
            } catch(err) {
                logger.error('sql error', err);
                await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database creation error ' + req.params.id , 'logs': []});
                res.send({message: 'Creation error: '+err});
                res.end();
                return;  
            }
            let password = Math.random().toString(36).slice(-10);
            let createuser = `CREATE USER '${req.params.id}'@'%' IDENTIFIED BY '${password}';\n`;
            // eslint-disable-next-line no-unused-vars
            try {
                await connection.query(createuser);
            } catch(err) {
                logger.error('sql error', err);
                res.send({message: 'Failed to create user'});
                res.end();
                return;
            }
            let grant = `GRANT ALL PRIVILEGES ON ${req.params.id}.* TO '${req.params.id}'@'%'\n`;
            try {
                await connection.query(grant);
            } catch(err) {
                logger.error('sql error', err);
                res.send({message: 'Failed to grant access to user'});
                res.end();
                return;
            }
            // Now send message
            let msg = 'Database created:\n';
            msg += ' Host: ' + CONFIG.mysql.host + '\n';
            msg += ' Database: ' + req.params.id + '\n';
            msg += ' User: ' + req.params.id + '\n';
            msg += ' Password: ' + password + '\n';
            msg += ' Owner: ' + owner + '\n';
            var mailOptions = {
                origin: MAIL_CONFIG.origin, // sender address
                destinations: [session_user.email, CONFIG.general.accounts], // list of receivers
                subject: 'Database creation', // Subject line
                message: msg, // plaintext body
                html_message: msg // html body
            };
            await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' created by ' +  session_user.uid, 'logs': []});

            if(notif.mailSet()) {
                try {
                    await notif.sendUser(mailOptions);
                } catch(error) {
                    logger.error(error);
                }

            }
            res.send({message:'Database created, credentials will be sent by mail'});
            res.end();
        }  
    }

});

router.delete('/database/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;  
    }
    let session_user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!session_user){
        res.status(401).send('Not authorized');
        return;
    }
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
        session_user.is_admin = true;
    }
    else {
        session_user.is_admin = false;
    }
    let filter = {name: req.params.id};
    if(!session_user.is_admin) {
        filter['owner'] = session_user.uid;
    }

    let database = await utils.mongo_databases().findOne({name: req.params.id});
    if(! database || (database.type!==undefined && database.type != 'mysql')) {
        await utils.mongo_databases().remove(filter);
        await utils.mongo_events().insertOne({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' deleted by ' +  session_user.uid, 'logs': []});
        res.send({message: ''});
        res.end();
        return;
    }
    else {
        await utils.mongo_databases().remove(filter);
        let sql = `DROP USER '${req.params.id}'@'%';\n`;
        // eslint-disable-next-line no-unused-vars
        connection.query(sql, function(err, results) {
            let sql = `DROP DATABASE ${req.params.id};\n`;
            // eslint-disable-next-line no-unused-vars
            connection.query(sql, async function(err, results) {
                await utils.mongo_events().insertOne({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'database ' + req.params.id+ ' deleted by ' +  session_user.uid, 'logs': []});
                res.send({message:'Database removed'});
                res.end();
                return;
            });
        });
    }
});


router.delete_dbs = async function(user){
    let databases = await utils.mongo_databases().find({'owner': user.uid}).toArray();
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
    let database = await utils.mongo_databases().findOne({name: db_id});
    if(! database || (database.type!==undefined && database.type != 'mysql')) {
        await utils.mongo_databases().remove(filter);
        await utils.mongo_events().insertOne(
            {
                'owner': user.uid,
                'date': new Date().getTime(),
                'action': 'database ' + db_id+ ' deleted by ' +  user.uid, 'logs': []
            }
        );
        return true;
    }
    else {
        await utils.mongo_databases().remove(filter);
        const querydb = (sql) => {
            // eslint-disable-next-line no-unused-vars
            return new Promise((resolve, reject) => {
                // eslint-disable-next-line no-unused-vars
                connection.query(sql, function(err, results) {
                    if(err) {
                        logger.error('failed to exec sql', sql, err);
                        resolve(false);
                    }
                    resolve(true);
                });
            });
        };
        let dropuser = `DROP USER '${db_id}'@'%';\n`;
        await querydb(dropuser);
        let dropdb = `DROP DATABASE ${db_id};\n`;
        await querydb(dropdb);
        await utils.mongo_events().insertOne(
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
