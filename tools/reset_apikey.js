const conf = require('../routes/conf.js');
const utils = require('../core/utils.js');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');

async function reset_apikey (exclude_string = "") {
    let excluded = []
    if (exclude_string){
      excluded = str.split(",")
    }
    await utils.init_db();
    let users = await utils.mongo_users().find({}).toArray();

    for (let i = 0; i < users.length; i++) {
        let user = users[i];

        if (excluded.indexOf(user.uid) === -1){
          await utils.mongo_users().updateOne({uid: user.uid},{'$set': {duration: user.duration}});
          console.log('User ' + user.uid + ' : update apikey');
        } else {
          console.log('Skipping user ' + user.uid);
        }
    }
    process.exit(0);
}

const optionDefinitions = [
    { name: 'help', description: 'Display this usage guide.', alias: 'h', type: Boolean},
    { name: 'exlude', alias: 'e', type: String, description: 'Comma-separated list of users to exclude from the reset' },
];

const sections = [
    {header: 'Reset api key for user', content: 'Generate and set a new apikey for all users, except excluded'},
    {header: 'Options', optionList: optionDefinitions}
];

const usage = getUsage(sections);
const commands = commandLineArgs(optionDefinitions);

if (commands.h){
    console.info(usage);
    process.exit(0);
}

reset_apikey(commands.exclude);
