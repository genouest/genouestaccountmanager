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
var notif = require('../routes/notif.js');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const request = require('request');

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
  var sess = req.session;
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
    if(!session_user.is_admin) {
      res.status(401).send('Not authorized');
      return;
    }
    databases_db.update({name: req.param('id')},{'$set': {owner: req.param('new')}}, function(err){
      events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.param('id') + ' changed from ' + req.param('old') + ' to ' + req.param('new'), 'logs': []}, function(err){});
      res.send({message: 'Owner changed from '+req.param('old')+' to '+req.param('new')});
      res.end();
      return;
    });
  });
});


router.get('/database', function(req, res) {
  var sess = req.session;
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
      filter = {owner: session_user.uid}
    }
    databases_db.find(filter, function(err, databases){
      res.send(databases);
      return;
    });
  });
});

router.get('/database/owner/:owner', function(req, res) {
  var sess = req.session;
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
    var filter = {owner: req.param('owner')}
    databases_db.find(filter, function(err, databases){
      res.send(databases);
      return;
    });
  });
});

router.post('/database/:id', function(req, res) {
  var sess = req.session;
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

    if (req.param('owner')!=undefined && req.param('owner') != session_user.uid && ! session_user.is_admin){
        res.status(401).send('Not authorized, cant declare a database for a different user');
        return;
    }
    var owner = session_user.uid;
    var create_db = true;
    if(req.param('owner')){
        owner = req.param('owner')
    }
    if(req.param('create') == false || (req.param('type') != undefined && req.param('type') != 'mysql')){
        create_db = false;
    }

    var db_type = 'mysql';
    if(req.param('type') != undefined && req.param('type')) {
        db_type = req.param('type');
    }

    var db_host = CONFIG.mysql.host;
    if(req.param('host')!=undefined && req.param('host')){
        db_host = req.param('host');
    }

    db = {
      owner: owner,
      name: req.param('id'),
      type: db_type,
      host: db_host
    }

    if (create_db && !req.param('id').match(/^[0-9a-z_]+$/)) {
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
        databases_db.insert(db, function(err){
            if(! create_db){
                events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.param('id')+ ' declared by ' +  session_user.uid, 'logs': []}, function(err){});

                    res.send({message:'Database declared'});
                    return;

            }
            else {
                var sql = "CREATE DATABASE "+req.param('id')+";\n";
                connection.query(sql, function(err, results) {
                  if (err) {
                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database creation error ' + req.param('id') , 'logs': []}, function(err){});
                    res.send({message: 'Creation error: '+err});
                    res.end();
                    return
                  }
                  var password = Math.random().toString(36).substring(10);
                  sql = "CREATE USER '"+req.param('id')+"'@'%' IDENTIFIED BY '"+password+"';\n";
                  connection.query(sql, function(err, results) {
                    if (err) {
                      res.send({message: 'Failed to create user'});
                      res.end();
                      return
                    }
                    sql = "GRANT ALL PRIVILEGES ON "+req.param('id')+".* TO '"+req.param('id')+"'@'%'\n";
                    connection.query(sql, function(err, results) {
                      if (err) {
                        res.send({message: 'Failed to grant access to user'});
                        res.end();
                        return
                      }
                      // Now send message
                      var msg = "Database created:\n";
                      msg += " Host: " + CONFIG.mysql.host + "\n";
                      msg += " Database: " + req.param('id') + "\n";
                      msg += " User: " + req.param('id') + "\n";
                      msg += " Password: " + password + "\n";
                      msg += " Owner: " + owner + "\n";
                      var mailOptions = {
                        origin: CONFIG.gomail.origin, // sender address
                        destinations: [session_user.email, CONFIG.general.accounts], // list of receivers
                        subject: 'Database creation', // Subject line
                        message: msg, // plaintext body
                        html_message: msg // html body
                      };
                      events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.param('id')+ ' created by ' +  session_user.uid, 'logs': []}, function(err){});

                      if(notif.mailSet()) {
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
  var sess = req.session;
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
        var filter = {name: req.param('id')};
        if(!session_user.is_admin) {
          filter['owner'] = session_user.uid;
        }


        databases_db.findOne({name: req.param('id')}, function(err, database){
            if(! database || (database.type!==undefined && database.type != 'mysql')) {
                databases_db.remove(filter, function(err){
                    events_db.insert({'owner': session_user.uid, 'date': new Date().getTime(), 'action': 'database ' + req.param('id')+ ' deleted by ' +  session_user.uid, 'logs': []}, function(err){});
                    res.send({message: ''});
                    res.end();
                    return;
                 });
            }
            else {
                databases_db.remove(filter, function(err){
                    var sql = "DROP USER '"+req.param('id')+"'@'%';\n";
                    connection.query(sql, function(err, results) {
                        sql = "DROP DATABASE "+req.param('id')+";\n";
                        connection.query(sql, function(err, results) {
                            events_db.insert({'owner': session_user.uid,'date': new Date().getTime(), 'action': 'database ' + req.param('id')+ ' deleted by ' +  session_user.uid, 'logs': []}, function(err){});
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
    return new Promise(function (resolve, reject){
        databases_db.find({'owner': user.uid}).then(function(databases){
            logger.debug("delete_dbs");
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
    return new Promise(function (resolve, reject){
        logger.debug("delete_db", db_id);
        var filter = {name: db_id};
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
                    var sql = "DROP USER '"+db_id+"'@'%';\n";
                    connection.query(sql, function(err, results) {
                        sql = "DROP DATABASE "+db_id+";\n";
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
