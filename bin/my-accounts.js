/* eslint-disable no-console */
/*
 * CLI to manage users
 */
const program = require('commander');


const goldap = require('../core/goldap.js');
const filer = require('../core/file.js');
const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
const cfgsrv = require('../core/config.service.js');
const usrv = require('../core/user.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const winston = require('winston');
const myconsole = new (winston.transports.Console)({
    timestamp: true,
    level: 'info'
});
winston.loggers.add('gomngr', {
    transports: [myconsole]
});

//const logger = winston.loggers.get('gomngr');

//const tps = require('../routes/users.js');
const MAILER = CONFIG.general.mailer;
const notif = require('../core/notif_'+MAILER+'.js');

if (!console.table){
    require('console.table');
}

program
    .command('show') // sub-command name
    .description('Show user') // command description
    .arguments('<uid>')
    .action(function (uid) {
        let filter = {'$or': [{email: uid}, {uid: uid}]};
        dbsrv.mongo_users().findOne(filter).then(function(user){
            console.table(user);
            process.exit(0);
        });
    });

program
    .command('password') // sub-command name
    .description('Force fake user password reset (outputs password)') // command description
    .arguments('<uid>')
    .action(function (uid) {
        let filter = {'$or': [{email: uid}, {uid: uid}]};
        dbsrv.mongo_users().findOne(filter).then(async function(user){
            if (!user) {
                console.log('user not found', uid);
                process.exit(1);
            }
            if (!user.is_fake) {
                console.log('not a fake user, not allowed', uid);
                process.exit(1);                
            }

            let new_password = usrv.new_password(8);
            user.password = new_password;
            let fid = new Date().getTime();
            try {
                await goldap.reset_password(user, fid);
            } catch(err) {
                console.error('failed to update password');
                process.exit(1);
            }
            user.history.push({'action': 'password reset', date: new Date().getTime()});
            await dbsrv.mongo_users().updateOne({uid: user.uid},{'$set': {history: user.history}});

            try {
                let created_file = await filer.user_reset_password(user, fid);
                console.debug('File Created: ', created_file);
            } catch(error){
                console.error('Reset Password Failed for: ' + user.uid, error);
                process.exit(1);
            }
            console.log(`Password reset: ${new_password}`);
            process.exit(0);
        });
    });

program
    .command('list') // sub-command name
    .description('List users') // command description
    .option('-s, --status [value]', 'status of user [Active|Expired|All],', 'Active')
    .action(async function (args) {
        let filter = {};
        if (args.filter !== 'All'){
            filter = {'status': args.status};
        }
        let users = await dbsrv.mongo_users().find(filter).toArray();
        let displayRes = [];
        for(let i=0;i<users.length;i++){
            let res = users[i];
            displayRes.push({'uid': res.uid, 'group': res.group, 'email': res.email, 'uidNumber': res.uidnumber, 'gidNumber': res.gidnumber, 'expires': new Date(res.expiration), 'status': res.status});
        }
        console.table(displayRes);
        process.exit(0);
    });


program
    .command('mail-add') // sub-command name
    .description('Subscribe user to main mailing list') // command description
    .arguments('<email>')
    // eslint-disable-next-line no-unused-vars
    .action(function (email, args) {
        notif.add(email).then(() => {
            console.log('User ' + email + 'add to mailing list');
            process.exit(0);
        });
    });

program
    .command('mail-remove') // sub-command name
    .description('Unsubscribe user from main mailing list') // command description
    .arguments('<email>')
    // eslint-disable-next-line no-unused-vars
    .action(function (email, args) {
        notif.remove(email).then(() => {
            console.log('User ' + email + 'removed from mailing list');
            process.exit(0);
        });
    });

program
    .command('mail-subscribed') // sub-command name
    .description('Check if user mail is subscribed to main mailing list') // command description
    .arguments('<email>')
    // eslint-disable-next-line no-unused-vars
    .action(function (email, args) {
        notif.subscribed(email).then((subscribed) => {
            console.log('User ' + email + ' mailing list subscription status: ' + subscribed);
            process.exit(0);
        });
    });

dbsrv.init_db().then(() => {
    plgsrv.load_plugins();
    // allow commander to parse `process.argv`
    program.parse(process.argv);
});
