/* eslint-disable no-console */
/**
 * Test expiration date of user, if lower than 2 month, send an email to user
 */
// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
// eslint-disable-next-line no-unused-vars
var STATUS_EXPIRED = 'Expired';

const CONFIG = require('config');

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
const maisrv = require('../core/mail.service.js');

const MAILER = CONFIG.general.mailer;

const notif = require('../core/notif_'+MAILER+'.js');

function timeConverter(tsp){
    let a = new Date(tsp);
    let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let year = a.getFullYear();
    let month = months[a.getMonth()];
    let date = a.getDate();
    let hour = a.getHours();
    let min = a.getMinutes();
    let sec = a.getSeconds();
    return date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
}

dbsrv.init_db().then(async ()=>{
    plgsrv.load_plugins();
    let users = await dbsrv.mongo_users().find({'is_fake': {$ne: true}, status: STATUS_ACTIVE, expiration: {$lt: (new Date().getTime() + 1000*3600*24*60)}},{uid: 1}).toArray();
    // Find users expiring in less then 2 month
    let mail_error = 0;
    if (! notif.mailSet()){
        console.log('Error: mail is not set');
        process.exit(1);
    }

    let in60Days = new Date().getTime() + 1000*3600*24*60;
    let in15Days = new Date().getTime() + 1000*3600*24*15;
    let in3Days = new Date().getTime() + 1000*3600*24*3;

    for(let i=0;i<users.length;i++){
        let user = users[i];
        if (user.expiration_notif === undefined) {
            user.expiration_notif = 0;
        }
        let do_notify = false;
        if (user.expiration_notif == 0 && (user.expiration <= in60Days)) {
            user.expiration_notif = 1;
            do_notify = true;
        } else if (user.expiration_notif == 1 && (user.expiration <= in15Days)) {
            user.expiration_notif = 2;
            do_notify = true;
        } else if (user.expiration_notif == 2 && (user.expiration <= in3Days)) {
            user.expiration_notif = 3;
            do_notify = true;
        }
        if (!do_notify) {
            continue;
        }
        console.log(`User will expire, send notication number ${user.expiration_notif} to ${user.uid}`);
        let link = CONFIG.general.url +
            encodeURI('/user/'+user.uid+'/renew/'+user.regkey);
        try {
            await maisrv.send_notif_mail({
                'name': 'expiration',
                'destinations': [user.email],
                'subject': 'account expiration ' + user.uid
            }, {
                '#LINK#': link,
                '#EXPIRE#': timeConverter(user.expiration)
            });

        } catch(error) {
            console.error('failed to send mail',error);
            mail_error += 1;
        }
        await dbsrv.mongo_users().updateOne({'_id': user['_id']}, {'$set': {'expiration_notif': user.expiration_notif}});

    }
    if(mail_error == 0) {
        process.exit(0);
    } else {
        console.log(`Error: mail errors ${mail_error} on ${users.length} users`);
        process.exit(1);
    }

});
