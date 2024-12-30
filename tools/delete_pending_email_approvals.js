var monk = require('monk');
var Promise = require('promise');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const maisrv = require('../core/mail.service.js');
var CONFIG = require('config')
console.log('CONFIG loaded:', CONFIG);

const optionDefinitions = [
    { name: 'help', description: 'Display this usage guide.', alias: 'h', type: Boolean},
    { name: 'days', alias: 'd', type: Number, description: 'Number of days after which to delete accounts' },
    { name: 'config', alias: 'c', type: String, description: 'Path to the configuration file' }
];

const sections = [
    {header: 'Delete Pending Accounts', content: 'Deletes accounts in "pending email approval" state after a specified number of days.'},
    {header: 'Options', optionList: optionDefinitions}
];

const usage = getUsage(sections);

const commands = commandLineArgs(optionDefinitions);

if(commands.h || (commands.days === undefined)){
    console.info(usage);
    return;
}


var db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db);
var users_db = db.get('users');

const DAYS_TO_DELETE = commands.days || 30;
const currentTime = new Date().getTime();
const expirationTime = currentTime - (DAYS_TO_DELETE * 24 * 60 * 60 * 1000); 
console.log("current")
console.log(currentTime)
console.log("days to")
console.log(DAYS_TO_DELETE * 24 * 60 * 60 * 1000)
console.log(expirationTime)
async function notify(recipients, subject, message) {
    try {
        await maisrv.send_notif_mail({
            'name': null,
            'destinations': recipients,
            'subject': subject,
            'markdown': message
        }, {});
        console.log(`Notification sent to ${recipients.join(', ')}`);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

async function deletePendingUsers() {
    try {
        const users = await users_db.find({ 
            status: 'Waiting for email approval', 
            registration: { $lt: expirationTime }
        });

        if (users.length === 0) {
            console.log("Found 0 users to delete.");
            process.exit(0);  
        } else {
            console.log(`Found ${users.length} users to delete.`);
        }

        const deletedUsers = [];

        for (const user of users) {
            //await users_db.remove({ _id: user._id });
            console.log(`User with UID ${user.uid} deleted.`);

            const userMessage = `Your account has been deleted due to inactivity for over ${DAYS_TO_DELETE} days. If this was an error, please contact support.`;
            await notify([user.email], 'Account Deletion Notice', userMessage);
            
            deletedUsers.push(user); // Keep track of deleted users for the admin email
        }

        if (deletedUsers.length > 0) {
            const adminMessage = `The following users have been deleted due to inactivity for over ${DAYS_TO_DELETE} days:\n\n` + 
                deletedUsers.map(user => `- ${user.email} (UID: ${user.uid})`).join('\n') +
                '\n\nIf you have any concerns, please contact support.';
            await notify([CONFIG.general.support], `Account Deletion Summary (${deletedUsers.length} user(s))`, adminMessage);
        }

        process.exit(0);


    } catch (error) {
        console.error('Error during user deletion:', error);
        process.exit(1);
    }
}

// Start the process
deletePendingUsers();