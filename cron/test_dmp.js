/* eslint-disable no-console */
/**
 * Test if project has same info as DMP, if not, adds a desynchronized tag to mongo project
 */

// 


// const cfgsrv = require('../core/config.service.js');
// let my_conf = cfgsrv.get_conf();
// const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
// const maisrv = require('../core/mail.service.js');
const prsrv = require('../core/project.service.js');
// const MAILER = CONFIG.general.mailer;


dbsrv.init_db().then(async () => {

    plgsrv.load_plugins();
    let projects = await dbsrv.mongo_projects().find({ expire: { $lt: (new Date().getTime() + 1000 * 3600 * 24 * 60) } }).toArray();
    let dmp_check_errors = 0;

    // auth to DMP OPIDoR API
    let auth = undefined;
    try {
        auth = await prsrv.auth_dmp();
    } catch (error) {
        console.log('could not auth to Opidor, aborting');
        return error;
    }

    for (let i = 0; i < projects.length; i++) {
        let project = projects[i];
        // checks if project is associated to DMP
        if (project.dmpUuid == undefined) {
            continue;
        }
        else {
            console.log('continuing');
            try {
                let dmp = await prsrv.request_DMP(project.dmpUuid, auth.data.access_token);
                let research_output = dmp.researchOutput[0];
                let dmp_filtered = {
                    'id': dmp.project.acronym,
                    'description': this.convertToPlain(research_output.dataStorage.genOuestServiceRequest[0].initialRequest.justification),
                    'orga': [],
                    'cpu': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.cpuUsage,
                    'size': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.dataSize,
                    'expire': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.endStorageDate,
                };
                let key_list = Object.keys(dmp_filtered);
                console.log(key_list.length);
                for (let i = 0; i < key_list.length; i++) {
                    let key = key_list[i];
                    if (key == 'lastModified') {
                        continue;
                    }
                    await dbsrv.mongo_projects().updateOne({ '_id': project['_id'] }, { '$set': { 'dmp_synchronized': (JSON.stringify(dmp_filtered[key]).toLowerCase() === JSON.stringify(project[key]).toLowerCase()) } });

                }

            } catch (error) {
                console.error('Error while comparing DMP with project', error);
                dmp_check_errors += 1;
                continue;
            }


        }

        // console.log(`Project will expire, send notication number ${project.expiration_notif} to ${project.id}`);


        await dbsrv.mongo_projects().updateOne({ '_id': project['_id'] }, { '$set': { 'dmp_synchronized': true } });

    }
    if (dmp_check_errors == 0) {
        process.exit(0);
    } else {
        console.log(`Error: dmp errors ${dmp_check_errors} on ${projects.length} projects`);
        process.exit(1);
    }

});
