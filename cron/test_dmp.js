/* eslint-disable no-console */
/**
 * Test if project has same info as DMP, if not, adds a desynchronized tag to mongo project
 */

// 

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
// const maisrv = require('../core/mail.service.js');
const prsrv = require('../core/project.service.js');
// const MAILER = CONFIG.general.mailer;
const htmlToText = require('html-to-text');
dbsrv.init_db().then(async () => {

    plgsrv.load_plugins();
    let projects = await dbsrv.mongo_projects().find({ expire: { $lt: (new Date().getTime() + 1000 * 3600 * 24 * 60) } }).toArray();
    let dmp_check_errors = 0;

    // auth to DMP OPIDoR API
    let auth = undefined;
    try {
        auth = await prsrv.opidor_auth();
    } catch (error) {
        console.log('could not auth to Opidor, aborting');
        console.log(error);
        return error;
    }

    for (let i = 0; i < projects.length; i++) {
        let project = projects[i];
        // checks if project is associated to DMP
        if (project.dmpUuid == undefined) {
            continue;
        }
        else {
            try {
                let answer = await prsrv.request_DMP(project.dmpUuid, auth.data.access_token);
                let dmp = answer.data;
                
                let research_output = dmp.researchOutput[0];
                let dmp_filtered = {
                    'id': dmp.project.acronym,
                    'description': htmlToText.htmlToText(research_output.dataStorage.genOuestServiceRequest[0].initialRequest.justification),
                    'orga': [],
                    'cpu': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.cpuUsage,
                    'size': research_output.dataStorage.genOuestServiceRequest[0].initialRequest.dataSize,
                    'expire': Date.parse(research_output.dataStorage.genOuestServiceRequest[0].initialRequest.endStorageDate),
                };

                for (let data in dmp.project.funding) {
                    
                    if (dmp.project.funding[data].fundingStatus == 'Approuvé' || dmp.project.funding[data].fundingStatus == 'Granted') {

                        dmp_filtered.orga.push(dmp.project.funding[data].funder.name);
                        
                    }
                }
                let key_list = Object.keys(dmp_filtered);
                let sync_status = true;
                for (let i = 0; i < key_list.length; i++) {
                    let key = key_list[i];
                    if (key == 'lastModified') {
                        continue;
                    }
                    if (JSON.stringify(dmp_filtered[key]).toLowerCase() != JSON.stringify(project[key]).toLowerCase()) {
                        console.log('An element is different between the DMP and the project ' + project['id']);
                        sync_status = false;
                        break;
                    }
                    
                    
                }
                await dbsrv.mongo_projects().updateOne({ '_id': project['_id'] }, { '$set': { 'dmp_synchronized': sync_status} });

            } catch (error) {
                console.error('Error while comparing DMP with project', error);
                dmp_check_errors += 1;
                continue;
            }


        }

    }
    if (dmp_check_errors == 0) {
        console.log('no errors');
        process.exit(0);
    } else {
        console.log(`Error: dmp errors ${dmp_check_errors} on ${projects.length} projects`);
        process.exit(1);
    }

});
