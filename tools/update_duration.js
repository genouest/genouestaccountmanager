const conf = require('../routes/conf.js');
const utils = require('../core/utils.js');


async function update_duration () {
    await utils.init_db();
    let duration_list = await conf.get_conf().duration;
    console.log('Duration List ',duration_list);
    let users = await utils.mongo_users().find({}).toArray();

    for (let i = 0; i < users.length; i++) {
        let user = users[i];
        let save_duration = user.duration;

        if (!(user.duration in duration_list))
        {
            if (!Number.isInteger(user.duration)) {
                user.duration = 365; //default if value is not as expected
            }

            // get the nearest duration value
            let ref_duration = Number.MAX_SAFE_INTEGER;
            let ref_duration_label = Object.keys(duration_list)[0];
            for (let duration_label in duration_list) {
                let diff_duration = Math.abs(user.duration - duration_list[duration_label]);

                if (diff_duration < ref_duration)
                {
                    ref_duration = diff_duration;
                    ref_duration_label = duration_label;
                }
            }
            // set the label for ui
            user.duration = ref_duration_label;

            // save
            await utils.mongo_users().updateOne({uid: user.uid},{'$set': {duration: user.duration}});
        }

        console.log('User ' + user.uid + ' : ' + save_duration + ' => ' + user.duration);

    }
    process.exit(0);
}

update_duration();
