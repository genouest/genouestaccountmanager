const crypto = require('crypto');
const CONFIG = require('config');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');


let monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');


async function reset_apikey (exclude_string = "") {
    let excluded = []
    if (exclude_string){
      excluded = exclude_string.split(",")
    }
    let users = await users_db.find({});

    for (let i = 0; i < users.length; i++) {
        let user = users[i];
        if (excluded.indexOf(user.uid) === -1){
          let apikey = crypto.randomBytes(32).toString('hex').slice(0, 32);
          await users_db.update({uid: user.uid},{'$set': {apikey: apikey}});
          console.log('User ' + user.uid + ' : update apikey');
        } else {
          console.log('Skipping user ' + user.uid);
        }
    }
    process.exit(0);
}


const optionDefinitions = [
    { name: 'help', description: 'Display this usage guide.', alias: 'h', type: Boolean},
    { name: 'exclude', alias: 'e', type: String, description: 'Comma-separated list of users to exclude from the reset' },
];

const sections = [
    {header: 'Reset api key for user', content: 'Generate and set a new apikey for all users, except excluded'},
    {header: 'Options', optionList: optionDefinitions}
];

const usage = getUsage(sections);
const commands = commandLineArgs(optionDefinitions);

if (commands.help){
    console.info(usage);
    process.exit(0);
}

reset_apikey(commands.exclude);
