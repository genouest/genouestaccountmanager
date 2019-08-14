var express = require('express');
var router = express.Router();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var Promise = require('promise');
const logger = winston.loggers.get('gomngr');

const filer = require('../routes/file.js');
var CONFIG = require('config');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users'),
    events_db = db.get('events');
/**
app.get('/ssh/:id', ssh);
app.get('/ssh/:id/public', ssh);
app.get('/ssh/:id/putty', ssh);
app.get('/ssh/:id/private', ssh);
*/

router.get('/ssh/:id/putty', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'});
            res.end();
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }
        var sshDir = user.home + "/.ssh";
        res.download(sshDir + "/id_rsa.ppk", "id_rsa.ppk", function (err) {
            if (err) {
                logger.error(err);
            }
        });
    });
});

router.get('/ssh/:id/private', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'});
            res.end();
            return;
        }
        if(CONFIG.general.admin.indexOf(user.uid) >= 0){
            res.status(401).send('[admin user] not authorized to download private key');
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }
        var sshDir = user.home + "/.ssh";
        res.download(sshDir + "/id_rsa", "id_rsa", function (err) {
            if (err) {
                logger.error(err);
            }
        });
    });
});

router.get('/ssh/:id/public', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'});
            res.end();
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }
        var sshDir = user.home + "/.ssh";
        res.download(sshDir + "/id_rsa.pub", "id_rsa.ppk", function (err) {
            if (err) {
                logger.error(err);
            }
        });
    });
});

router.get('/ssh/:id', function(req, res) {
    var sess = req.session;
    if(!req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'});
            res.end();
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }

        var fid = new Date().getTime();

        filer.ssh_keygen(user, fid)
            .then(
                created_file => {
                    logger.info("File Created: ", created_file);
                    events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'Generate new ssh key' , 'logs': [user.uid+"."+fid+".update"]}, function(err){});
                    res.send({'msg': 'SSH key will be generated, refresh page in a minute to download your key'});
                    return;
                })
            .catch(error => { // reject()
                logger.error('Create User Failed for: ' + user.uid, error);
                res.status(500).send('Ssh Keygen Failed');
                return;
            });
    });
});

module.exports = router;
