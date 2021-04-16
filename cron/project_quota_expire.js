/* eslint-disable no-console */
/**
 * Test expiration date of project, if lower than 2 month, send an email to admins
 */


const CONFIG = require('config');

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
const maisrv = require('../core/mail.service.js');

// const MAILER = CONFIG.general.mailer;
// const MAIL_CONFIG = CONFIG[MAILER];

// const notif = require('../core/notif_'+MAILER+'.js');

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

dbsrv.init_db().then(async () => {
    plgsrv.load_plugins();
    let projects = await dbsrv.mongo_projects().find({}).toArray();
    // Find project expiring in less then 2 month
    let notifs = [];
    for(let i=0;i<projects.length;i++){
        let project = projects[i];
        if(project.expire !== undefined && project.expire!=null) {
            if(project.expire < new Date().getTime() + 1000*3600*24*30) {
                notifs.push(project);
            }
        }
    }
    for(let i=0;i<notifs.length;i++){
        let project = notifs[i];
        console.log('Project will expire: '+project.id);

        try {
            await maisrv.send_notif_mail({
                'name': 'project_expiration',
                'destinations': [CONFIG.general.support], // maybe add owner mail too ...
                'subject': 'Project expiration ' + project.id
            }, {
                '#NAME#': project.id,
                '#DATE#': new Date(project.expire)
            });

        } catch(error) {
            console.log(error);
        }

    }

});
