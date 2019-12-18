/* eslint-disable no-console */
/**
 * Test expiration date of project, if lower than 2 month, send an email to admins
 */


var CONFIG = require('config');

var utils = require('./routes/utils');

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];

var notif = require('../routes/notif_'+MAILER+'.js');

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
    let projects = await utils.mongo_projects().find({}).toArray();
    // Find project expiring in less then 2 month
    let mail_sent = 0;
    let notifs = [];
    for(let i=0;i<projects.length;i++){
        let project = projects[i];
        if(project.expire !== undefined && project.expire!=null) {
            if(project.expire < new Date().getTime() + 1000*3600*24*30) {
                var msg = 'Project '+project.id+' will expire at '+new Date(project.expire);
                notifs.push(msg);
            }
        }
    }
    for(let i=0;i<notifs.length;i++){
        let notification = notifs[i];
        let mailOptions = {
            origin: MAIL_CONFIG.origin, // sender address
            destinations: [CONFIG.general.accounts], // list of receivers
            subject: 'Project expiration', // Subject line
            message: notification, // plaintext body
            html_message: notification // html body
        };
        if( notif.mailSet()) {
            // eslint-disable-next-line no-unused-vars
            try {
                await notif.sendUser(mailOptions);
            } catch(error) {
                console.log(error);
            }
            mail_sent++;
            if(mail_sent == notifs.length) {
                process.exit(0);
            }
        }
        else {
            console.log(notif);
            mail_sent++;
            if(mail_sent == notifs.length) {
                process.exit(0);
            }
        }

    }

    if(mail_sent == notifs.length) {
        process.exit(0);
    }

});
