/* eslint-disable no-console */
/**
 * Test expiration date of user, if lower than 2 month, send an email to user
 */

const { promisify } = require('util');
const sleep = promisify(setTimeout);

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

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
    let projects = await dbsrv.mongo_projects().find({expire: {$lt: (new Date().getTime() + 1000*3600*24*60)}}).toArray();

    let mail_error = 0;
    if (! notif.mailSet()){
        console.log('Error: mail is not set');
        process.exit(1);
    }

    let in60Days = new Date().getTime() + 1000*3600*24*60;
    let in15Days = new Date().getTime() + 1000*3600*24*15;
    let in3Days = new Date().getTime() + 1000*3600*24*3;

    for(let i=0;i<projects.length;i++){
        let project = projects[i];
        if (project.expiration_notif === undefined) {
            project.expiration_notif = 0;
        }
        let do_notify = false;
        if (project.expiration_notif == 0 && (project.expire <= in60Days)) {
            project.expiration_notif = 1;
            do_notify = true;
        } else if (project.expiration_notif == 1 && (project.expire <= in15Days)) {
            project.expiration_notif = 2;
            do_notify = true;
        } else if (project.expiration_notif == 2 && (project.expire <= in3Days)) {
            project.expiration_notif = 3;
            do_notify = true;
        }
        if (!do_notify) {
            continue;
        }
        console.log(`Project will expire, send notication number ${project.expiration_notif} to ${project.id}`);

        try {
            let dest_mail = [];
            if (project.owner) {
                let user = await dbsrv.mongo_users().findOne({uid: project.owner});
                if (user && user.email) {
                    dest_mail = [user.email];
                }
            }

            if (CONFIG.general.send_expiration_notif_to_admin) {
                dest_mail.push(CONFIG.general.support);
            }

            if (dest_mail.length > 0) {
                await maisrv.send_notif_mail({
                    'name': 'project_expiration',
                    'destinations': dest_mail,
                    'subject': 'Project expiration ' + project.id
                }, {
                    '#NAME#': project.id,
                    '#DATE#': timeConverter(project.expire)
                });

                if (CONFIG.general.limit_expire_mail) {
                    let nb_mls = Math.round((60 * 1000) / CONFIG.general.limit_expire_mail); // mail per min
                    await sleep(nb_mls);
                }
            }
        } catch(error) {
            console.error('failed to send mail',error);
            mail_error += 1;
        }
        await dbsrv.mongo_projects().updateOne({'_id': project['_id']}, {'$set': {'expiration_notif': project.expiration_notif}});

    }
    if(mail_error == 0) {
        process.exit(0);
    } else {
        console.log(`Error: mail errors ${mail_error} on ${projects.length} projects`);
        process.exit(1);
    }

});
