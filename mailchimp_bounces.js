var https = require('https');
var promise = require('promise');
var CONFIG = require('config');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');


var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');

var auth_api = "genouest:" + CONFIG.mailchimp.apikey;
var mc_host = "us9.api.mailchimp.com";
if(CONFIG.mailchimp.url !== undefined && CONFIG.mailchimp.url != ""){
    mc_host = CONFIG.mailchimp.url;
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

var send_notif = function(mailOptions, errors) {
    return new Promise(function (resolve, reject){
        if(transport!==null) {
          transport.sendMail(mailOptions, function(error, response){
            if(error){
              logger.error(error);
            }
            console.log("[INFO] send bounces email notification");
            resolve(errors);
          });
        }
        else {
          resolve(errors);
        }
    });
};

var get_bounces = function(campaign_id){
    return new Promise(function (resolve, reject){
        const req = https.request({
            auth: auth_api,
            host: mc_host,
            method: "GET",
            path: "/3.0/reports/" + campaign_id + "/email-activity?count=1000"
        }, function(res) {
            var data = "";
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                data += chunk;
            });
            res.on('end', function() {
                var bounces = [];
                var res_json = JSON.parse(data);
                //console.log("[DEBUG] activity ", res_json);
                res_json.emails.forEach(function(email){
                    for(var i=0;i<email.activity.length;i++){
                        if(email.activity[i].action == "bounce"){
                            bounces.push(email.email_address)
                        }
                    }
                });
                resolve(bounces);
            });
        });
        req.end();

    });
};

var get_report = function(campaign_id) {
    return new Promise(function (resolve, reject){
        const req = https.request({
            auth: auth_api,
            host: mc_host,
            method: "GET",
            path: "/3.0/reports/" + campaign_id
        }, function(res) {
            var data = "";
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                data += chunk;
            });
            res.on('end', function() {
                var res_json = JSON.parse(data);
                if(res_json.bounces.hard_bounces + res_json.bounces.soft_bounces == 0){
                    console.log("[INFO] no bounces, fine....", campaign_id);
                    resolve({'bounces': 0});
                }
                else {
                    get_bounces(campaign_id).then(function(bounces){
                        console.log("[INFO] got bounces, check emails", campaign_id, bounces.length);
                        resolve({'bounces': bounces});
                    })
                }
            });
        });
        req.end();

    });
};
const now = new Date();
const last_campaigns_date = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
const req = https.request({
    auth: auth_api,
    host: mc_host,
    method: "GET",
    path: "/3.0/campaigns?since_send_time=" + last_campaigns_date.getFullYear() + "-" + last_campaigns_date.getMonth() + "-" + last_campaigns_date.getDate()
}, function(res) {
        var data = "";
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            data += chunk;
        });
        res.on('end', function() {
            var res_json = JSON.parse(data);
            var campaigns = []
            res_json.campaigns.forEach(function(campaign){
                campaigns.push(campaign.id);
            });

            console.log("[INFO] check campaigns reports");
            Promise.all(campaigns.map(function(campaign_id){
                console.log("[INFO] check campaign report ", campaign_id);
                return get_report(campaign_id);
            })).then(function(bounces){
                console.log("[INFO] Bounces", bounces);
                // now check against active accounts
                users_db.find({"status": "Active"},{"uid": 1, "email": 1}).then(function(users){
                    var active_users = [];
                    var active = {};
                    for(var u=0;u<users.length;u++){
                        active_users.push(users[u].email);
                        active[users[u].email] = users[u].uid;
                    }
                    var bad_emails = [];

                    for(var c=0;c<bounces.length;c++){
                        var campaign_bounces = bounces[c].bounces;

                        for(var i=0;i<campaign_bounces.length;i++){
                            //console.log(campaign_bounces[i], active[campaign_bounces[i]], active_users.indexOf(campaign_bounces[i]));
                            if(active_users.indexOf(campaign_bounces[i]) > -1){
                                bad_emails.push(active[campaign_bounces[i]]);
                            }
                        }
                    }
                    console.log("[INFO] bad emails for active users", bad_emails);
                    var msg_activ = "The following emails bounced during the email campaigns of last 3 month (active users):\n";
                    msg_activ += bad_emails.join(",") +"\n";
                    msg_activ += "\nEmails should be checked!\n";
                    var mailOptions = {
                      from: CONFIG.mail.origin, // sender address
                      to: CONFIG.general.accounts, // list of receivers
                      subject: 'Genouest email accounts bounces', // Subject line
                      text: msg_activ, // plaintext body
                    };
                    send_notif(mailOptions, []).then(function(){
                        process.exit();
                    });
                });

            });
        });

    });

req.end();
