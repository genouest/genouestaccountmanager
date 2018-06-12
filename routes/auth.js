var express = require('express');
var router = express.Router();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var goldap = require('../routes/goldap.js');
var Promise = require('promise');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');


const u2f = require('u2f');


var CONFIG = require('config');
const APP_ID= CONFIG.general.url;
var GENERAL_CONFIG = CONFIG.general;

var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    users_db = db.get('users');

var ldap_manager = {
  auth: function(uid, password) {
    if(MAIL_CONFIG.ldap.host == 'fake') {
      return true;
    }
    return false;
  }
}

var MAIL_CONFIG = CONFIG.mail;
var transport = null;


if(MAIL_CONFIG.host !== 'fake') {
  if(MAIL_CONFIG.user !== undefined && MAIL_CONFIG.user !== '') {
  transport = nodemailer.createTransport(smtpTransport({
    host: MAIL_CONFIG.host, // hostname
    secureConnection: MAIL_CONFIG.secure, // use SSL
    port: MAIL_CONFIG.port, // port for secure SMTP
    auth: {
        user: MAIL_CONFIG.user,
        pass: MAIL_CONFIG.password
    }
  }));
  }
  else {
  transport = nodemailer.createTransport(smtpTransport({
    host: MAIL_CONFIG.host, // hostname
    secureConnection: MAIL_CONFIG.secure, // use SSL
    port: MAIL_CONFIG.port, // port for secure SMTP
  }));

  }
}


var attemps = {};

var send_notif = function(mailOptions) {
    return new Promise(function (resolve, reject){
        if(transport!==null) {
          transport.sendMail(mailOptions, function(error, response){
            if(error){
              logger.error(error);
            }
            resolve({'status': true});
          });
        }
        else {
          resolve({'status': false});
        }
    });
};

router.get('/logout', function(req, res) {
  req.session.destroy();
  res.send({});
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});

router.get('/mail/auth/:id', function(req, res) {
    // Request email token
    if(!req.session.is_logged){
        return res.status(401).send('You need to login first');
    }
    var password = Math.random().toString(36).substring(7);
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err) {
            return res.status(404).send('User not found');
        }
        var msg_token = "You requested a temporary token to login to application. This token will be valid for 10 minutes only.\n";
        msg_token = "Token: -- " + password + " -- \n";
        var mailOptions = {
          from: MAIL_CONFIG.origin, // sender address
          to: user.email, // list of receivers
          subject: 'Authentication mail token request', // Subject line
          text: msg_token, // plaintext body
        };
        var expire = new Date().getTime() + 60*10*1000;
        req.session.mail_token = {'token': password, 'expire': expire, 'user': user._id};
        send_notif(mailOptions).then(function(status){
            return res.send(status);
        });
    });

});
router.post('/mail/auth/:id', function(req, res) {
    // Check email token
    if(!req.session.is_logged){
        return res.status(401).send('You need to login first');
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err) {
            return res.status(404).send('User not found');
        }
        var sess = req.session;
        var now = new Date().getTime()
        if(user._id != sess.mail_token['user'] || req.param('token') != sess.mail_token['token'] || now > sess.mail_token['expire']) {
            return res.status(403).send('Invalid or expired token');
        }
        sess.gomngr = sess.mail_token['user'];
        sess.mail_token = null;
        if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
            user.is_admin = true;
        }
        else {
            user.is_admin = false;
        }
        res.send({'user': user});
        res.end();
        return
    });
});

router.get('/u2f/auth/:id', function(req, res) {
    // challenge
    if(!req.session.is_logged){
        return res.status(401).send('You need to login first');
    }
    req.session.u2f = null;
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err) {
            res.status(404).send('User not found');
            return;
        }
        var keyHandle = user.u2f.keyHandler;
        const authRequest = u2f.request(APP_ID, keyHandle);
        req.session.u2f = user._id;
        return res.send({'authRequest': authRequest});
    });

});

router.post('/u2f/auth/:id', function(req, res) {
    if(!req.session.is_logged){
        return res.status(401).send('You need to login first');
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err) {
            res.status(404).send('User not found');
            return;
        }
        if(!req.session.u2f || req.session.u2f != user._id){
            res.status(401).send('U2F not challenged or invalid user');
        }
        var publicKey = user.u2f.publicKey;
        const result = u2f.checkSignature(req.param('authRequest'), req.param('authResponse'), publicKey);
        if (result.successful) {
            // Success!
            // User is authenticated.
            var sess = req.session;
            sess.gomngr = sess.u2f;
            sess.u2f = null;
            return res.sendStatus(200);
        }
        else {
            sess.gomngr = null;
            sess.u2f = null;
            return res.send(result);
        }
    });

});

router.get('/u2f/register/:id', function(req, res) {
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err) {
            res.status(404).send('User not found');
            return;
        }
        var sess = req.session;
        if(!sess.gomngr || sess.gomngr!=user._id) {
            return res.status(401).send('You need to login first');
        }
        if(user.u2f !== undefined && user.u2f.keyHandle!=null){
            res.status(403).send('A key is already defined');
        }
        const registrationRequest = u2f.request(APP_ID);
        return res.send({'registrationRequest': registrationRequest});
    });
});

router.post('/u2f/register/:id', function(req, res) {
    users_db.findOne({uid: req.param('id')}, function(err, user){
        var sess = req.session;
        if(err || !sess.gomngr || sess.gomngr!=user._id) {
            return res.status(401).send('You need to login first');
        }
        const registrationRequest = req.param('registrationRequest');
        const registrationResponse = req.param('registrationResponse');
        const result = u2f.checkRegistration(registrationRequest, registrationResponse);
        if (result.successful) {
            users_db.update({uid: req.param('id')},{"$set": {"u2f.keyHandler": result.keyHandle, "u2f.publicKey": result.publicKey}}, function(err, user){
                return res.send({'publicKey': result.publicKey});
            });

        }
        else{
            return res.send(result);
        }
    });
});

router.get('/auth', function(req, res) {
  var sess = req.session;
  if(sess.gomngr) {
  //if(req.cookies.gomngr !== undefined) {
    // Authenticated
    //users_db.findOne({_id: req.cookies.gomngr}, function(err, user){
    users_db.findOne({_id: sess.gomngr}, function(err, user){
      if(user.u2f) {user.u2f.keyHankdle = null;}
      if(user==null || err) {
        res.send({user: null, msg: err});
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
        user.is_admin = true;
      }
      else {
        user.is_admin = false;
      }
      if(user.status == STATUS_PENDING_EMAIL){
        res.send({user: user, msg: 'Your account is waiting for email approval, check your mail inbox'});
        return;
      }
      if(user.status == STATUS_PENDING_APPROVAL){
        res.send({user: user, msg: 'Your account is waiting for admin approval'});
        return;
      }
      if(user.status == STATUS_EXPIRED){
        res.send({user: user, msg: 'Your account is expired, please contact the support for reactivation at '+GENERAL_CONFIG.support});
        return;
      }
      res.send({user: user, msg: ''});
    });
  }
  else {
    res.send({user: null, msg: 'User does not exists'});
  }
});

router.post('/auth/:id', function(req, res) {
  if(req.param('password') === undefined || req.param('password') === null || req.param('password') == "") {
    res.status(401).send('Missing password');
    return;
  }
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(err) { logger.error(err); }
    if(! user) {
      res.status(404).send('User not found');
      return;
    }
    if(attemps[user.uid] != undefined && attemps[user.uid]['attemps']>=2) {
        var checkDate = new Date();
        checkDate.setHours(checkDate.getHours() - 1);
        if(attemps[user.uid]['last'] > checkDate) {
          res.status(401).send('You have reached the maximum of login attemps, your account access is blocked for one hour');
          return;
        }
        else {
          attemps[user.uid]['attemps'] = 0;
        }
    }
    // Check bind with ldap
    var sess = req.session;
    sess.is_logged = true;
    var need_double_auth = false;

    if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
        user.is_admin = true;
        if(CONFIG.general.double_authentication_for_admin){
            need_double_auth = true;
        }
        else {
            sess.gomngr = user._id;
        }
    }
    else {
      user.is_admin = false;
      sess.gomngr = user._id;
    }
    var ip = req.headers['x-forwarded-for'] ||
     req.connection.remoteAddress ||
     req.socket.remoteAddress ||
     req.connection.socket.remoteAddress;
    if((user.is_admin && GENERAL_CONFIG.admin_ip.indexOf(ip) >= 0) || process.env.gomngr_auth=='fake') {
      // Skip auth
      res.send({ user: user, msg: '', double_auth: need_double_auth});
      res.end();
      return;
    }
    else {
      goldap.bind(user.uid, req.param('password'), function(err, token) {
        user['token'] = token;
        if(attemps[user.uid] == undefined) {
          attemps[user.uid] = { attemps: 0};
        }
        if(err) {
          if(req.session !== undefined){
             req.session.destroy();
          }
          attemps[user.uid]['attemps'] += 1;
          attemps[user.uid]['last'] = new Date();
          res.send({ user: null, msg: "Login error, remains "+(3-attemps[user.uid]['attemps'])+" attemps."});
          res.end();
          return;
        }
        else{
            attemps[user.uid]['attemps'] = 0;
            res.send({ user: user, msg: '', double_auth: need_double_auth});
            res.end();
            return;
        }
      });
    }

  });
});


module.exports = router;
