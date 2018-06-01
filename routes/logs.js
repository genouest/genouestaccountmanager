var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var escapeshellarg = require('escapeshellarg');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    groups_db = db.get('groups'),
    databases_db = db.get('databases'),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');

router.get('/log', function(req, res){
    var sess = req.session;
    if(! sess.gomngr) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: sess.gomngr}, function(err, user){
          if(err || user == null){
            res.status(404).send('User not found');
            return;
          }
          if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
            res.status(401).send('Not authorized');
            return;
          }
        events_db.find({}, function(err, events){
            res.send(events);
            res.end();
        });
    });
});

router.get('/log/user/:id', function(req, res){
    var sess = req.session;
    if(! sess.gomngr) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: sess.gomngr}, function(err, user){
          if(err || user == null){
            res.status(404).send('User not found');
            return;
          }
        events_db.find({'owner': req.param('id')}, function(err, events){
            res.send(events);
            res.end();
        });
    });
});

router.get('/log/status/:id/:status', function(req, res){
    events_db.update({'logs': req.param('id')}, {'$set':{'status': parseInt(req.param('status'))}}, function(err){});
    res.end();
});

router.get('/log/:id', function(req, res){
    var sess = req.session;
    if(! sess.gomngr) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: sess.gomngr}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
      }

      file = req.param('id')+'.log';
      log_file = GENERAL_CONFIG.script_dir+'/'+file;
      fs.readFile(log_file, 'utf8', function (err,data) {
        if (err) {
          res.status(500).send(err);
          res.end();
          return;
        }
        res.send({log: data})
        res.end();
        return;
      });

  });
});

module.exports = router;
