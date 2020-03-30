/* eslint-disable require-atomic-updates */
/* eslint-disable no-console */
/**
 * Test expiration date of user, if expired, expire the user
 */
// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

const process = require('process');

var CONFIG = require('config');
var goldap = require('./routes/goldap.js');
const filer = require('./routes/file.js');

var Promise = require('promise');

var utils = require('./routes/utils');

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];

var notif = require('./routes/notif_'+MAILER+'.js');

/*
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
*/

utils.init_db().then(async () => {
    utils.load_plugins();
    let users = await utils.mongo_users().find({'is_fake': {$ne: true}, status: STATUS_ACTIVE, expiration: {$lt: (new Date().getTime())}},{uid: 1}).toArray();
    // Find users expiring
    var mail_sent = 0;
    if (! notif.mailSet()){
        console.log('Error: mail is not set');
        process.exit(1);
    }
    for(var i=0;i<users.length;i++){
        (async function(index) {
            let user = users[index];
            console.log('User: ' + user.uid + ' has expired');
            try {
                await utils.send_notif_mail({
                    'name': 'expired',
                    destinations: [CONFIG.general.support],
                    subject: 'account expire: ' + user.uid
                }, {
                    '#UID#': user.uid
                });

            } catch(error) {
                console.log(error);
            }

            let fid = new Date().getTime();
            let new_password = Math.random().toString(36).slice(-10);
            user.password = new_password;
            try {
                await goldap.reset_password(user, fid);
            } catch(err) {
                console.log(user.uid + ': failed to reset password');

            }
            user.history.push({'action': 'expire', date: new Date().getTime()});
            await utils.mongo_users().updateOne({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}});
            try {
                let created_file = await filer.user_expire_user(user, fid);
                console.log('File Created: ', created_file);
            } catch(error){
                console.error('Expire User Failed for: ' + user.uid, error);
                return;
            }

            await utils.mongo_events().insertOne({'owner': 'cron', 'date': new Date().getTime(), 'action': 'user ' + user.uid + ' deactivated by cron', 'logs': []});

            let plugin_call = function(plugin_info, user){
                // eslint-disable-next-line no-unused-vars
                return new Promise(function (resolve, reject){
                    let plugins_modules = utils.plugins_modules();
                    plugins_modules[plugin_info.name].deactivate(user).then(function(){
                        resolve(true);
                    });

                });
            };
            // console.log('call plugins');
            let plugins_info = utils.plugins_info();
            Promise.all(plugins_info.map(function(plugin_info){
                return plugin_call(plugin_info, user.uid);
            // eslint-disable-next-line no-unused-vars
            })).then(function(results){
                // console.log('after plugins');
                // Now remove from mailing list
                try {
                    notif.remove(user.email, function(){
                        mail_sent++;
                        if(mail_sent == users.length) {
                            process.exit(0);
                        }
                    });
                }
                catch(err) {
                    mail_sent++;
                    if(mail_sent == users.length) {
                        process.exit(0);
                    }
                }

            });
        }(i));
    }
    if(mail_sent == users.length) {
        process.exit(0);
    }
});
