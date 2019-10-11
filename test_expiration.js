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


var CONFIG = require('config');
// var goldap = require('./routes/goldap.js');

/*
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');
*/

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;

var mongo_connect = async function() {
    let url = CONFIG.mongo.url;
    let client = null;
    if(!url) {
        client = new MongoClient(`mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}`);
    } else {
        client = new MongoClient(CONFIG.mongo.url);
    }
    await client.connect();
    mongodb = client.db(CONFIG.general.db);
    mongo_users = mongodb.collection('users');
};

const MAILER = CONFIG.general.mailer;
const MAIL_CONFIG = CONFIG[MAILER];

var notif = require('./routes/notif_'+MAILER+'.js');

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

mongo_connect().then(async ()=>{
    let users = await mongo_users.find({'is_fake': {$ne: true}, status: STATUS_ACTIVE, expiration: {$lt: (new Date().getTime() + 1000*3600*24*60)}},{uid: 1}).toArray();
    // Find users expiring in less then 2 month
    let mail_sent = 0;
    if (! notif.mailSet()){
        console.log('Error: mail is not set');
        process.exit(1);
    }
    for(let i=0;i<users.length;i++){
        (async function(index){
            var user = users[index];
            console.log('User will expire: '+user.uid);
            var link = CONFIG.general.url +
                encodeURI('/user/'+user.uid+'/renew/'+user.regkey);
                // encodeURI('/manager2/user/'+user.uid+'/renew/'+user.regkey);
            var msg_activ = CONFIG.message.expiration.join('\n').replace('#LINK#', link).replace('#EXPIRE#', timeConverter(user.expiration)) + '\n' + CONFIG.message.footer.join('\n');
            var msg_activ_html = CONFIG.message.expiration_html.join('').replace('#LINK#', link).replace('#EXPIRE#', timeConverter(user.expiration)) + '<br/>' + CONFIG.message.footer.join('<br/>');
            var mailOptions = {
                origin: MAIL_CONFIG.origin, // sender address
                destinations: [user.email], // list of receivers
                subject: CONFIG.general.name + ' account expiration', // Subject line
                message: msg_activ, // plaintext body
                html_message: msg_activ_html // html body
            };
            try {
                await notif.sendUser(mailOptions);
            } catch(error) {
                console.log(error);
            }
            mail_sent++;
            if(mail_sent == users.length) {
                process.exit(0);
            }
        }(i));
    }
    if(mail_sent == users.length) {
        process.exit(0);
    }
});