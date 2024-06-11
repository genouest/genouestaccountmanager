/* eslint-disable require-atomic-updates */
/* eslint-disable no-console */
/**
 * Test expiration date of user, if expired, expire the user
 */

const { promisify } = require('util');
const sleep = promisify(setTimeout);

// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

const process = require('process');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const goldap = require('../core/goldap.js');
const filer = require('../core/file.js');

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
const maisrv = require('../core/mail.service.js');
const usrsrv = require('../core/user.service.js');

const MAILER = CONFIG.general.mailer;
//const MAIL_CONFIG = CONFIG[MAILER];

const notif = require('../core/notif_'+MAILER+'.js');

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

let count_errors = 0;
dbsrv.init_db().then(async () => {
    plgsrv.load_plugins();
    // Find users expiring
    let users = await dbsrv.mongo_users().find({'is_fake': {$ne: true},
                                                'never_expire': {$ne: true},
                                                status: STATUS_ACTIVE,
                                                expiration: {$lt: (new Date().getTime())}},{uid: 1}).toArray();
    if (! notif.mailSet()){
        console.log('Error: mail is not set');
        process.exit(1);
    }
    for(let i=0;i<users.length;i++){
        let user = users[i];
        console.log('User: ' + user.uid + ' has expired');
        try {
            await maisrv.send_notif_mail({
                'name': 'expired',
                destinations: [CONFIG.general.support],
                subject: 'account expiration: ' + user.uid
            }, {
                '#UID#': user.uid
            });
            if (CONFIG.general.limit_expire_mail) {
                let nb_mls = Math.round((60 * 1000) / CONFIG.general.limit_expire_mail); // mail per min
                await sleep(nb_mls);
            }

        } catch(error) {
            console.log(error);
        }

        if (!CONFIG.general.disable_auto_expiration) {
            let fid = new Date().getTime();
            //let new_password = Math.random().toString(36).slice(-10);
            let new_password = usrsrv.new_password(8);
            user.password = new_password;
            try {
                await goldap.reset_password(user, fid);
            } catch(err) {
                console.log(user.uid + ': failed to reset password');
            }
            user.history.push({'action': 'expire', date: new Date().getTime()});
            await dbsrv.mongo_users().updateOne(
                {
                    uid: user.uid
                },
                {
                    '$set': {
                        status: STATUS_EXPIRED,
                        expiration: new Date().getTime(),
                        history: user.history,
                        expiration_notif: 0
                    }
                }
            );
            try {
                let created_file = await filer.user_expire_user(user, fid);
                console.log('File Created: ', created_file);
            } catch(error){
                console.error('Expire User Failed for: ' + user.uid, error);
                return;
            }

            await dbsrv.mongo_events().insertOne({'owner': 'cron', 'date': new Date().getTime(), 'action': 'user ' + user.uid + ' deactivated by cron', 'logs': []});

            let error = false;
            try {
                error = await plgsrv.run_plugins('deactivate', user.uid, user, 'auto');
            } catch(err) {
                console.error('deactivation errors', err);
                error = true;
                count_errors += 1;
            }
            if(error) {
                console.error('deactivation errors in plugins');
                count_errors += 1;
            }
            await notif.remove(user.email);
        }
    }
    if(count_errors > 0) {
        console.error('several errors occured');
        process.exit(1);
    }
    process.exit(0);
});
