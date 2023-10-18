/* eslint-disable no-console */
const dbsrv = require('./core/db.service.js');
const notif = require('./core/notif_listmonk');
const gomail = require('./core/notif_gomail');

let importUsers = async () => {
    let users = await dbsrv.mongo_users().find({'status': 'Active'}).toArray();
    let nb = 0;
    for(let i=0;i<users.length;i++) {
        let user = users[i];
        if(user.is_fake || user.email.indexOf('@fake') > -1){
            console.log(user.uid + ': fake user, skipping');
            continue;
        }
        let subscribed = await gomail.subscribed(user.email);
        if(!subscribed){
            console.log(user.uid + ': unsubscribed, skipping');
            continue;
        }
        await notif.add(user.email, user.uid);
        console.log(user.uid + ' added!');
        nb++;
    }
    console.log('imported', nb);
};

dbsrv.init_db().then(() => {
    importUsers().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
});
