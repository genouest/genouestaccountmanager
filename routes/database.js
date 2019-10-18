var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var Promise = require('promise');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users'),
    events_db = db.get('events');

var mysql = require('mysql');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
// const request = require('request');

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];
var notif = require('../routes/notif_'+MAILER+'.js');
var utils = require('./utils.js');

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
router.put('/database/:id/owner/:old/:new', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id, req.params.old, req.params.new])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
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
        // eslint-disable-next-line no-unused-vars
        databases_db.update({name: req.params.id},{'$set': {owner: req.params.new}}, function(err){
            // eslint-disable-next-line no-unused-vars
            events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' changed from ' + req.params.old + ' to ' + req.params.new, 'logs': []}, function(err){});
            res.send({message: 'Owner changed from '+req.params.old+' to '+req.params.new});
            res.end();
            return;
        });
    });
});


router.get('/database', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
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
        databases_db.find(filter, function(err, databases){
            res.send(databases);
            return;
        });
    });
});

router.get('/database/owner/:owner', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.owner])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){
        if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
            session_user.is_admin = true;
        }
        else {
            session_user.is_admin = false;
        }
        var filter = {owner: req.params.owner};
        databases_db.find(filter, function(err, databases){
            res.send(databases);
            return;
        });
    });
});

router.post('/database/:id', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }
    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){

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

        databases_db.findOne({name: db.name}, function(err, database){
            if(database) {
                res.status(403).send({database: null, message: 'Database already exists, please use an other name'});
                res.end();
                return;
            }
            else {
                // eslint-disable-next-line no-unused-vars
                databases_db.insert(db, function(err){
                    if(! create_db){
                        events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' declared by ' +  session_user.uid, 'logs': []}, function(){});

                        res.send({message:'Database declared'});
                        return;

                    }
                    else {
                        var sql = 'CREATE DATABASE ' + req.params.id + ';\n';
                        // eslint-disable-next-line no-unused-vars
                        connection.query(sql, function(err, results) {
                            if (err) {
                                events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database creation error ' + req.params.id , 'logs': []}, function(){});
                                res.send({message: 'Creation error: '+err});
                                res.end();
                                return;
                            }
                            var password = Math.random().toString(36).slice(-10);
                            sql = `CREATE USER '${req.params.id}'@'%' IDENTIFIED BY '${password}';\n`;
                            // eslint-disable-next-line no-unused-vars
                            connection.query(sql, function(err, results) {
                                if (err) {
                                    res.send({message: 'Failed to create user'});
                                    res.end();
                                    return;
                                }
                                sql = `GRANT ALL PRIVILEGES ON ${req.params.id}.* TO '${req.params.id}'@'%'\n`;
                                // eslint-disable-next-line no-unused-vars
                                connection.query(sql, function(err, results) {
                                    if (err) {
                                        res.send({message: 'Failed to grant access to user'});
                                        res.end();
                                        return;
                                    }
                                    // Now send message
                                    var msg = 'The MySQL database you requested (' + req.params.id + ', owned by ' + owner + ') was created. You can connect to it using the following credentials:\t\r\n\t\r\n';
                                    msg += '  Host: ' + CONFIG.mysql.host + '\t\r\n';
                                    msg += '  Database: ' + req.params.id + '\t\r\n';
                                    msg += '  User: ' + req.params.id + '\t\r\n';
                                    msg += '  Password: ' + password + '\t\r\n';
                                    var mailOptions = {
                                        origin: MAIL_CONFIG.origin, // sender address
                                        destinations: [session_user.email, CONFIG.general.accounts], // list of receivers
                                        subject: 'Database creation', // Subject line
                                        message: msg, // plaintext body
                                        html_message: msg // html body
                                    };
                                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' created by ' +  session_user.uid, 'logs': []}, function(){});

                                    if(notif.mailSet()) {
                                        // eslint-disable-next-line no-unused-vars
                                        notif.sendUser(mailOptions, function(error, response){
                                            if(error){
                                                logger.error(error);
                                            }
                                            res.send({message:'Database created, credentials will be sent by mail'});
                                            res.end();
                                            return;
                                        });
                                    }
                                });
                            });

                        }); // end connection.query
                    }



                });
            }
        });
    });
});

router.delete('/database/:id', function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send('Invalid parameters');
        return;
    }

    users_db.findOne({_id: req.locals.logInfo.id}, function(err, session_user){

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


        databases_db.findOne({name: req.params.id}, function(err, database){
            if(! database || (database.type!==undefined && database.type != 'mysql')) {
                // eslint-disable-next-line no-unused-vars
                databases_db.remove(filter, function(err){
                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.params.id + ' deleted by ' +  session_user.uid, 'logs': []}, function(){});
                    res.send({message: ''});
                    res.end();
                    return;
                });
            }
            else {
                // eslint-disable-next-line no-unused-vars
                databases_db.remove(filter, function(err){
                    let sql = `DROP USER '${req.params.id}'@'%';\n`;
                    // eslint-disable-next-line no-unused-vars
                    connection.query(sql, function(err, results) {
                        let sql = `DROP DATABASE ${req.params.id};\n`;
                        // eslint-disable-next-line no-unused-vars
                        connection.query(sql, function(err, results) {
                            events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'database ' + req.params.id+ ' deleted by ' +  session_user.uid, 'logs': []}, function(){});
                            res.send({message:'Database removed'});
                            res.end();
                            return;
                        });
                    });
                });
            }
        });
    });
});


router.delete_dbs = function(user){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        databases_db.find({'owner': user.uid}).then(function(databases){
            logger.debug('delete_dbs');
            if(!databases){
                resolve(true);
                return;
            }
            Promise.all(databases.map(function(database){
                return delete_db(user, database.name);
            })).then(function(res){
                resolve(res);
            });
        });
    });

};


var delete_db = function(user, db_id){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        logger.debug('delete_db', db_id);
        let filter = {name: db_id};
        if(!user.is_admin) {
            filter['owner'] = user.uid;
        }
        databases_db.findOne({name: db_id}).then(function(database){
            if(! database || (database.type!==undefined && database.type != 'mysql')) {
                databases_db.remove(filter).then(function(){
                    events_db.insert(
                        {
                            'owner': user.uid,
                            'date': new Date().getTime(),
                            'action': 'database ' + db_id+ ' deleted by ' +  user.uid, 'logs': []
                        }
                    ).then(function(){
                        resolve(true);
                    });

                });
            }
            else {
                databases_db.remove(filter).then(function(){
                    //var sql = "DROP USER '"+db_id+"'@'%';\n";
                    let sql = `DROP USER '${db_id}'@'%';\n`;
                    // eslint-disable-next-line no-unused-vars
                    connection.query(sql, function(err, results) {
                        let sql = `DROP DATABASE ${db_id};\n`;
                        // eslint-disable-next-line no-unused-vars
                        connection.query(sql, function(err, results) {
                            events_db.insert(
                                {
                                    'owner': user.uid,
                                    'date': new Date().getTime(),
                                    'action': 'database ' + db_id + ' deleted by ' + user.uid, 'logs': []
                                }
                            ).then(function(){
                                resolve(true);
                            });

                        });
                    });
                });
            }
        });
    });
};

module.exports = router;
