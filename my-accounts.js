/*
 * CLI to manage users
 */
const program = require('commander')

var CONFIG = require('config')
var monk = require('monk')
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db)
var users_db = db.get('users')

var winston = require('winston')
const myconsole = new (winston.transports.Console)({
    timestamp: true,
    level: 'info'
})
winston.loggers.add('gomngr', {
    transports: [myconsole]
})

const logger = winston.loggers.get('gomngr')

var tps = require('./routes/users.js')
var notif = require('./routes/notif')

if (!console.table){
    require('console.table')
}

program
    .command('show') // sub-command name
    .description('Show user') // command description
    .arguments('<uid>')
    .action(function (uid) {
        filter = {'$or': [{email: uid}, {uid: uid}]}
        users_db.findOne(filter).then(function(user){
            console.table(user)
            process.exit(0)
        })

    })

program
    .command('list') // sub-command name
    .description('List users') // command description
    .option('-s, --status [value]', 'status of user [Active|Expired|All],', 'Active')
    .action(function (args) {
        filter = {}
        if (args.filter !== 'All'){
            filter = {'status': args.status}
        }
        users_db.find(filter).then(function(users){
            displayRes = []
            for(let i=0;i<users.length;i++){
                let res = users[i]
                displayRes.push({'uid': res.uid, 'group': res.group, 'email': res.email, 'uidNumber': res.uidnumber, 'gidNumber': res.gidnumber, 'expires': new Date(res.expiration), 'status': res.status})
            }
            console.table(displayRes)
            process.exit(0)
        })
    })


program
    .command('mail-add') // sub-command name
    .description('Subscribe user to main mailing list') // command description
    .arguments('<email>')
    .action(function (email, args) {
        notif.add(email, function() {
            console.log('User ' + email + 'add to mailing list');
            process.exit(0);
        })
    })

program
    .command('mail-remove') // sub-command name
    .description('Unsubscribe user from main mailing list') // command description
    .arguments('<email>')
    .action(function (email, args) {
        notif.remove(email, function() {
            console.log('User ' + email + 'removed from mailing list');
            process.exit(0);
        })
    })

program
    .command('mail-subscribed') // sub-command name
    .description('Check if user mail is subscribed to main mailing list') // command description
    .arguments('<email>')
    .action(function (email, args) {
        notif.subscribed(email, function(subscribed) {
            console.log('User ' + email + ' mailing list subscription status: ' + subscribed);
            process.exit(0);
        })
    })

// allow commander to parse `process.argv`
program.parse(process.argv);
