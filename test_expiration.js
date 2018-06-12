/**
* Test expiration date of user, if lower than 2 month, send an email to user
*/
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';


var CONFIG = require('config');
var goldap = require('./routes/goldap.js');
var notif = require('./routes/notif.js');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');

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

// Find users expiring in less then 2 month
users_db.find({'is_fake': {$ne: true}, status: STATUS_ACTIVE, expiration: {$lt: (new Date().getTime() + 1000*3600*24*60)}},{uid: 1}, function(err, users){
  var mail_sent = 0;
  for(var i=0;i<users.length;i++){
    (function(index){
    var user = users[index];
    console.log('User will expire: '+user.uid);
    var link = CONFIG.general.url +
                encodeURI('/manager/index.html#/user/'+user.uid+'/renew/'+user.regkey);
    var msg_activ = CONFIG.message.expiration.join("\n").replace('#LINK#', link).replace("#EXPIRE#", timeConverter(user.expiration)).replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"\n"+CONFIG.message.footer.join("\n");
    var msg_activ_html = CONFIG.message.expiration.join("<br/>").replace('#LINK#', link).replace("#EXPIRE#", timeConverter(user.expiration)).replace('#UID#', user.uid).replace('#PASSWORD#', user.password).replace('#IP#', user.ip)+"<br/>"+CONFIG.message.footer.join("<br/>");
    var mailOptions = {
      from: MAIL_CONFIG.origin, // sender address
      to: user.email, // list of receivers
      subject: 'Genouest account expiration', // Subject line
      text: msg_activ, // plaintext body
      html: msg_activ_html // html body
    };
    transport.sendMail(mailOptions, function(error, response){
        if(error){
          console.log(error);
        }
        mail_sent++;
        if(mail_sent == users.length) {
          process.exit(code=0);
        }
    });
  }(i));
  }
  if(mail_sent == users.length) {
    process.exit(code=0);
  }

});
