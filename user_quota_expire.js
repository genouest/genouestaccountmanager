/**
* Test expiration date of user, if lower than 2 month, send an email to user
*/
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';


var CONFIG = require('config');
var notif = require('./routes/notif.js');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');
    projects_db = db.get('projects')

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
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

function timeConverter(tsp){
  var a = new Date(tsp);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}

// Find users quota expiring in less then 1 month
users_db.find({status: STATUS_ACTIVE}, function(err, users){
  var mail_sent = 0;
  var notifs = [];
  for(var i=0;i<users.length;i++){
      var user = users[i];
      if(user.quota && user.quota.disk_omaha_quota_expire !== undefined && user.quota.disk_omaha_quota_expire!=null) {
          if(user.quota.disk_omaha_quota_expire < new Date().getTime() + 1000*3600*24*30 && user.quota.disk_omaha_quota != CONFIG.general.quota.omaha) {
              var msg = "Quota for user "+user.uid+" omaha partition will expire at "+new Date(user.quota.disk_omaha_quota_expire);
              notifs.push(msg);
          }
      }
      if(user.quota && user.quota.disk_home_quota_expire !== undefined && user.quota.disk_home_quota_expire!=null) {
          if(user.quota.disk_home_quota_expire < new Date().getTime() + 1000*3600*24*30 && user.quota.disk_home_quota != CONFIG.general.quota.home) {
              var msg = "Quota for user "+user.uid+" home partition will expire at "+new Date(user.quota.disk_home_quota_expire);
              notifs.push(msg);
          }
      }
  }
  for(var i=0;i<notifs.length;i++){
    var notif = notifs[i];
    var mailOptions = {
      from: MAIL_CONFIG.origin, // sender address
      to: CONFIG.general.accounts, // list of receivers
      subject: 'Quota expiration', // Subject line
      text: notif, // plaintext body
      html: notif // html body
    };
    if(MAIL_CONFIG.host !== 'fake') {
        transport.sendMail(mailOptions, function(error, response){
            if(error){
              console.log(error);
            }
            mail_sent++;
            if(mail_sent == notifs.length) {
              process.exit(code=0);
            }
        });
    }
    else {
        console.log(notif);
        mail_sent++;
        if(mail_sent == notifs.length) {
          process.exit(code=0);
        }
    }

  }

  if(mail_sent == notifs.length) {
    process.exit(code=0);
  }

});
