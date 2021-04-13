var express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const yaml = require('js-yaml');

const conf = require('../routes/conf.js');
var CONFIG = conf.get_conf();
var GENERAL_CONFIG = CONFIG.general;

// var cookieParser = require('cookie-parser');
// var goldap = require('../routes/goldap.js');

const filer = require('../routes/file.js');
var utils = require('./utils');

let day_time = 1000 * 60 * 60 * 24;

router.get('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        if (! user.projects) {
            res.send([]);
            return;
        } else {
            let projects = await utils.mongo_projects().find({id: {$in : user.projects}}).toArray();
            res.send(projects);
            return;
        }
    } else {
        if (req.query.all === 'true'){
            let projects = await utils.mongo_projects().find({}).toArray();
            res.send(projects);
            return;
        } else {
            if (! user.projects) {
                res.send([]);
                return;
            } else {
                let projects = await utils.mongo_projects().find({id: {$in : user.projects}}).toArray();
                res.send(projects);
                return;
            }
        }
    }
});

router.get('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Admin only'});
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});

    if (! project){
        logger.error('failed to get project', req.params.id);
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }
    res.send(project);
});

router.post('/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.body.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let owner = await utils.mongo_users().findOne({'uid': req.body.owner});
    if(!owner){
        res.status(404).send({message: 'Owner not found'});
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.body.id});
    if(project){
        res.status(403).send({message: 'Not authorized or project already exists'});
        return;
    }
    let new_project = {
        'id': req.body.id,
        'owner': req.body.owner,
        'group': req.body.group,
        'size': req.body.size,
        'expire': (req.body.expire) ? req.body.expire : new Date().getTime() + CONFIG.project.default_expire * day_time,
        'description': req.body.description,
        'path': req.body.path,
        'orga': req.body.orga,
        'access': req.body.access,
        'dmpid': req.body.dmpid,
        'dmp_linked': req.body.dmp_linked
    };
    await utils.mongo_projects().insertOne(new_project);
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_add_project(new_project, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Add Project Failed for: ' + new_project.id, error);
        res.status(500).send({message: 'Add Project Failed'});
        return;
    }

    await utils.mongo_pending_projects().deleteOne({ uuid: req.body.uuid });
    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'new project creation: ' + req.body.id , 'logs': []});
    res.send({message: 'Project created'});
    return;
});

router.delete('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    await utils.mongo_projects().deleteOne({'id': req.params.id});
    let fid = new Date().getTime();
    try {
        let created_file = await filer.project_delete_project({'id': req.params.id}, fid);
        logger.debug('Created file', created_file);
    } catch(error){
        logger.error('Delete Project Failed for: ' + req.params.id, error);
        res.status(500).send({message: 'Delete Project Failed'});
        return;
    }

    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'remove project ' + req.params.id , 'logs': []});

    res.send({message: 'Project deleted'});

});

router.post('/project/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(401).send({message: 'Not authorized or project not found'});
        return;
    }
    let new_project = { '$set': {
        'owner': req.body.owner,
        'group': req.body.group,
        'size': req.body.size,
        'expire': (req.body.expire) ? req.body.expire : new Date().getTime() +  CONFIG.project.default_expire * day_time,
        'description': req.body.description,
        'access': req.body.access,
        'orga': req.body.orga,
        'path': req.body.path
    }};
    await utils.mongo_projects().updateOne({'id': req.params.id}, new_project);
    let fid = new Date().getTime();
    new_project.id =  req.params.id;
    try {
        let created_file = await filer.project_update_project(new_project, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Update Project Failed for: ' + new_project.id, error);
        res.status(500).send({message: 'Add Project Failed'});
        return;
    }

    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'update project ' + req.params.id , 'logs': []});
    res.send({message: 'Project updated'});
});

router.post('/project/:id/request', async function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }
    //Add to request list
    if(! user.uid === project.owner ){
        res.status(401).send({message: 'User ' + user.uid + ' is not project manager for project ' + project.id});
        return;
    }
    let newuser = await utils.mongo_users().findOne({'uid': req.body.user});
    if(!newuser){
        res.status(404).send({message: 'User ' + req.body.user + ' not found'});
        return;
    }
    if(newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.body.request === 'add'){
        res.status(403).send({message: 'User ' + req.body.user + ' is already in project : cannot add'});
        return;
    }
    //Backward compatibility
    if (! project.add_requests){
        project.add_requests = [];
    }
    if (! project.remove_requests){
        project.remove_requests = [];
    }
    if ( project.add_requests.indexOf(req.body.user) >= 0 || project.remove_requests.indexOf(req.body.user) >= 0){
        res.status(403).send({message: 'User ' + req.body.user + 'is already in a request : aborting'});
        return;
    }
    if (req.body.request === 'add'){
        project.add_requests.push(req.body.user);
    } else if (req.body.request === 'remove') {
        project.remove_requests.push(req.body.user);
    }
    let new_project = { '$set': {
        'add_requests': project.add_requests,
        'remove_requests': project.remove_requests
    }};
    await utils.mongo_projects().updateOne({'id': req.params.id}, new_project);
    await utils.mongo_events().insertOne({'owner': user.uid, 'date': new Date().getTime(), 'action': 'received request ' + req.body.request + ' for user ' + req.body.user + ' in project ' + project.id , 'logs': []});

    try {
        await utils.send_notif_mail({
            'name': 'ask_project_user',
            'destinations': [GENERAL_CONFIG.accounts],
            'subject': 'Project ' + req.body.request + ' user request: ' + req.body.user
        }, {
            '#UID#':  user.uid,
            '#NAME#': project.id,
            '#USER#': req.body.user,
            '#REQUEST#': req.body.request

        });
    } catch(error) {
        logger.error(error);
    }


    res.send({message: 'Request sent'});
});

//Admin only, remove request
router.put('/project/:id/request', async function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let project = await utils.mongo_projects().findOne({'id': req.params.id});
    if(!project){
        res.status(401).send({message: 'Not authorized or project not found'});
        return;
    }
    if (! req.body.user || ! req.body.request){
        res.status(403).send({message: 'User and request type are needed'});
        return;
    }
    let temp_requests = [];
    if(req.body.request === 'add' ){
        for(let i=0;i<project.add_requests.length;i++){
            if( project.add_requests[i] !== req.body.user ){
                temp_requests.push(project.add_requests[i]);
            }
        }
        project.add_requests = temp_requests;
    } else if (req.body.request === 'remove' ){
        for(let i=0;i<project.remove_requests.length;i++){
            if( project.remove_requests[i] !== req.body.user){
                temp_requests.push(project.remove_requests[i]);
            }
        }
        project.remove_requests = temp_requests;
    }
    let new_project = { '$set': {
        'add_requests': project.add_requests,
        'remove_requests': project.remove_requests
    }};
    await utils.mongo_projects().updateOne({'id': req.params.id}, new_project);
    res.send({message: 'Request removed'});
});

//Return all projects using this group
router.get('/group/:id/projects', async function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! utils.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let projects_with_group = await utils.mongo_projects().find({'group': req.params.id}).toArray();
    res.send(projects_with_group);
    res.end();
});

//puts the new project with the projects waiting for the admin approval
router.post('/ask/project', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await utils.mongo_users().findOne({_id: req.locals.logInfo.id});
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    /* // New Project Structure :
    let new_project = {
        'id': req.body.id,
        'size': req.body.size,
        'description': req.body.description,
        'orga': req.body.orga,
    };
    */

    // logger.info(new_project);

    // todo: find a way to use cc
    let new_project = {
        'uuid': (new Date().getTime()).toString(),
        'id': req.body.id,
        'owner': user.uid,
        'group': user.group,
        'size': req.body.size,
        'description': req.body.description,
        'orga': req.body.orga,
        'dmp_status': "Legacy"
        
    }
    if (!(req.body.dmpid == null)) {
        new_project.dmpid = req.body.dmpid,
        new_project.dmp_status = "Linked"
    }

    await utils.mongo_pending_projects().insertOne(new_project);
    await utils.mongo_events().insertOne({
        owner: user.uid,
        date: new Date().getTime(),
        action: 'new pending project creation: ' + req.body.id,
        logs: [],
    });

    let msg_destinations =  [GENERAL_CONFIG.accounts, user.email];

    try {
        await utils.send_notif_mail({
            'name': 'ask_project',
            'destinations': msg_destinations,
            'subject': 'Project creation request: ' + req.body.id
        }, {
            '#UID#':  user.uid,
            '#NAME#': req.body.id,
            '#SIZE#': req.body.size,
            '#ORGA#': req.body.orga,
            '#DESC#': req.body.description
        });
    } catch(error) {
        logger.error(error);
    }


    res.end();
    return;
});

//gets all the projects waiting the Admin approval
router.get('/pending/project', async function (req, res) {

    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await utils.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (GENERAL_CONFIG.admin.indexOf(user.uid) < 0) {
        if (!user.pending) {
            res.send([]);
            return;
        } else {
            let pendings = await utils.mongo_pending_projects().find({ id: { $in: user.pending } }).toArray();
            res.send(pendings);
            return;
        }
    } else {
        if (req.query.all === 'true') {
            let pendings = await utils.mongo_pending_projects().find({}).toArray();
            res.send(pendings);
            return;
        } else {
            if (!user.pending) {
                res.send([]);
                return;
            } else {
                let pendings = await utils.mongo_pending_projects().find({ id: { $in: user.pending } }).toArray();
                res.send(pendings);
                return;
            }
        }
    }
});

//once the new project is approved by the admin it is removed from the pending projects 
router.delete('/pending/project/:uuid', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = await utils.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (GENERAL_CONFIG.admin.indexOf(user.uid) < 0) {
        res.status(401).send('Not authorized');
        return;
    }
    const result = await utils.mongo_pending_projects().deleteOne({ uuid: req.params.uuid });
    if (result.deletedCount === 1) {
        await utils.mongo_events().insertOne({
            owner: user.uid,
            date: new Date().getTime(),
            action: 'remove Pending project ' + req.params.uuid,
            logs: [],
        });
    
        res.send({ message: 'Pending Project deleted'});
    }
    else {
        res.status(404).send('No pending project found')
    }
    

});

//checks if the DMP OPIDoR API is online
router.get('/dmp/ping', async function (req, res) {
    let online = this.http.get(GENERAL_CONFIG.dmp.url + '/heartbeat');
    if (online['code'] != 200) {
        res.status(404).send('Can\'t reach Opidor API');
        return;
    }

    let DMP_data = { error: '', ping: true };

    res.send(DMP_data);
    res.end();
});

//fetchs a dmp based on his ID, using the dmp OPIDoR API
router.post('/dmp/:id', async function (req, res) {
    //request to DMP opidor API to get all of the DMP with a json format
    //
    //Keeps only the required data for the project

    id = req
    dmp_data = {}
    test = true;
    required_data = {
        "data": {
            "plan_id": 1941,
            "project": {
                "title": "Modélisation de l'impact climatique d’une maladie émergente, le dépérissement de l'aulne induit par Phytophthora alni ",
                "principalInvestigator": {
                    "person": {
                        "nameType": "Personne",
                        "lastName": "Marçais",
                        "firstName": "Benoît",
                        "mbox": "benoit.marcais@inist.fr",
                        "personId": "https://orcid.org/0000-0002-8107-644X",
                        "idType": "ORCID",
                        "affiliationName": "Interactions Arbres/Micro-organismes",
                        "affiliationId": "200117307M",
                        "affiliationIdType": "RNSR"
                    },
                    "role": "Coordinateur du projet"
                },
                "experimentalPlan": {
                    "title": "Modeling climate impact on an emerging disease, the Phytophthora alni-induced alder decline. Aguayo J et al. Global Change Biology (2014) 20, 3209–3221",
                    "docIdentifier": "https://doi.org/10.1111/gcb.12601",
                    "idType": "DOI"
                },
                "funding": [
                    {
                        "funder": {
                            "dataPolicy": {
                                "title": "Plan données de la recherche du CNRS",
                                "docIdentifier": "https://www.cnrs.fr/sites/default/files/pdf/Plaquette_PlanDDOR_Nov20.pdf",
                                "idType": "URL"
                            },
                            "name": "Agence Nationale de la Recherche",
                            "funderId": "http://dx.doi.org/10.13039/501100001665",
                            "idType": "DOI"
                        },
                        "grantId": "ANR-07-BDIV-0003",
                        "fundingStatus": "Approuvé"
                    }
                ],
                "partner": [
                    {
                        "dataPolicy": {
                            "title": null,
                            "docIdentifier": null,
                            "idType": null
                        },
                        "name": "Biodiversité, Gènes et Communautés",
                        "rnsr": "200317684N",
                        "orgId": "https://ror.org/033ebya06",
                        "idType": "ROR ID"
                    },
                    {
                        "dataPolicy": {
                            "title": null,
                            "docIdentifier": null,
                            "idType": null
                        },
                        "name": "Walloon Agricultural Research Centre",
                        "rnsr": null,
                        "orgId": "https://ror.org/016n74679",
                        "idType": "ROR ID"
                    },
                    {
                        "dataPolicy": {
                            "title": null,
                            "docIdentifier": null,
                            "idType": null
                        },
                        "name": "Plant Protection Institute",
                        "rnsr": null,
                        "orgId": "https://ror.org/052t9a145",
                        "idType": "ROR ID"
                    }
                ],
                "acronym": "PHYTOCLIM",
                "description": "\u003cp\u003eA partir des ann\u0026eacute;es 1990, une nouvelle maladie est apparue sur les aulnes en bordure des cours d\u0026rsquo;eau. Elle est caus\u0026eacute;e par un microorganisme pathog\u0026egrave;ne, \u003cstrong\u003e\u003cem\u003ePhytophthora alni\u003c/em\u003e\u003c/strong\u003e, qui attaque les racines des arbres et provoque leur d\u0026eacute;p\u0026eacute;rissement. Ce pathog\u0026egrave;ne est une esp\u0026egrave;ce\u0026nbsp; thermophile. Par ailleurs, l\u0026rsquo;\u0026eacute;mergence du d\u0026eacute;p\u0026eacute;rissement de l\u0026rsquo;aulne est concomitante avec les ann\u0026eacute;es particuli\u0026egrave;rement chaudes des deux derni\u0026egrave;res d\u0026eacute;cennies.\u003c/p\u003e\r\n\u003cp\u003eLes facteurs environnementaux, tels que la temp\u0026eacute;rature moyenne du site et les caract\u0026eacute;ristiques du sol jouent un r\u0026ocirc;le important dans l'apparition de la maladie.\u003c/p\u003e\r\n\u003cp\u003eL'objectif de ce projet est\u0026nbsp;:\u003c/p\u003e\r\n\u003cul\u003e\r\n\u003cli\u003ede mod\u0026eacute;liser et de pr\u0026eacute;voir l'effet de l'environnement sur la gravit\u0026eacute; des \u0026eacute;pid\u0026eacute;mies dues \u0026agrave; \u003cem\u003ePhytophthora alni\u003c/em\u003e et,\u003c/li\u003e\r\n\u003cli\u003ede d\u0026eacute;terminer si les r\u0026eacute;cents changements climatiques pourraient expliquer l'\u0026eacute;mergence de la maladie.\u003c/li\u003e\r\n\u003c/ul\u003e",
                "startDate": "2007-12-01",
                "endDate": "2010-12-01"
            },
            "researchOutput": [
                {
                    "research_output_id": 2115,
                    "researchOutputDescription": {
                        "title": "Estimation quantitative du microorganisme Phytophthora alni",
                        "contact": {
                            "person": {
                                "nameType": "Personne",
                                "lastName": "Aguayo",
                                "firstName": "Jaime",
                                "mbox": "toto@inist.fr",
                                "personId": "https://orcid.org/0000-0002-7552-0655",
                                "idType": "ORCID",
                                "affiliationName": "Interactions Arbres/Micro-organismes",
                                "affiliationId": "200117307M",
                                "affiliationIdType": "RNSR"
                            },
                            "role": " Personne contact pour les données"
                        },
                        "controlledKeyword": [
                            {
                                "keyword": "Next gen sequencing",
                                "keywordSchema": "EDAM",
                                "keywordUrl": "http://edamontology.org/topic_3168"
                            },
                            {
                                "keyword": "Phytophthora alni",
                                "keywordSchema": "Index Fungorum",
                                "keywordUrl": "http://www.indexfungorum.org/names/NamesRecord.asp?RecordID=488625 "
                            },
                            {
                                "keyword": "Réaction de polymérisation en chaîne",
                                "keywordSchema": "Thésaurus MeSH bilingue français-anglais",
                                "keywordUrl": "http://data.loterre.fr/ark:/67375/JVR/M0024634"
                            },
                            {
                                "keyword": "Pathologie végétale",
                                "keywordSchema": "Thésaurus Inrae",
                                "keywordUrl": "http://opendata.inrae.fr/thesaurusINRAE/c_1014"
                            }
                        ],
                        "description": "\u003cp\u003eEstimation quantitative et qualitative du microorganisme \u003cem\u003ePhytophthora alni\u003c/em\u003e (pluriannuelle) par technique PCR en temps r\u0026eacute;el dans les \u0026eacute;chantillons de sol au pied des aulnes\u003c/p\u003e",
                        "type": "Jeu de données",
                        "workPackage": null,
                        "uncontrolledKeywords": [
                            "Piégeage par rhododendron"
                        ],
                        "language": "fra",
                        "datasetId": "Un DOI sera attribué automatiquement lors du dépôt sur Data Inrae",
                        "idType": "DOI",
                        "containsPersonalData": "Non",
                        "containsSensitiveData": "Non",
                        "hasEthicalIssues": "Non"
                    },
                    "dataCollection": {
                        "facility": [],
                        "methodReference": [
                            {
                                "title": "Procédure de piégeage réalisée selon la méthode décrite dans la publication suivante : Elegbede CF, Pierrat J-C, Aguayo J, Husson C, Halkett F, Marcais B (2010) A statistical model to detect asymptomatic infectious individuals with an application in the Phytophthora alni-induced Alder decline. Phytopathology, 100, 1262–1269",
                                "methodIdentifier": "https://doi.org/10.1094/PHYTO-05-10-0140",
                                "idType": "DOI"
                            }
                        ],
                        "contributor": [
                            {
                                "person": {
                                    "nameType": "Personne",
                                    "lastName": "Aguayo",
                                    "firstName": "Jaime",
                                    "mbox": "toto@inist.fr",
                                    "personId": "https://orcid.org/0000-0002-7552-0655",
                                    "idType": "ORCID",
                                    "affiliationName": "Interactions Arbres/Micro-organismes",
                                    "affiliationId": "200117307M",
                                    "affiliationIdType": "RNSR"
                                },
                                "role": "Responsable de la production ou de la collecte des données"
                            }
                        ],
                        "cost": [],
                        "title": "Estimation quantitative et qualitative du microorganisme P. alni",
                        "description": "\u003cp\u003eEstimation quantitative du microorganisme \u003cem\u003ePhytophthora alni\u003c/em\u003e en plusieurs temps (pluriannuelle) :\u003c/p\u003e\r\n\u003cul\u003e\r\n\u003cli\u003ePi\u0026eacute;geage biologique du microorganisme pr\u0026eacute;sent dans l\u0026rsquo;\u0026eacute;chantillon de sol* avec des feuilles de rhododendron et comptage des l\u0026eacute;sions n\u0026eacute;crotiques apparaissant sur les feuilles\u003c/li\u003e\r\n\u003cli\u003eD\u0026eacute;tection du microorganisme par technique PCR en temps r\u0026eacute;el sur les l\u0026eacute;sions n\u0026eacute;crotiques\u003c/li\u003e\r\n\u003cli\u003eAnalyse par s\u0026eacute;quen\u0026ccedil;age de marqueurs g\u0026eacute;n\u0026eacute;tiques et comparaison avec \u003cem\u003ePhytophthora phaseoli\u003c/em\u003e\u003c/li\u003e\r\n\u003c/ul\u003e\r\n\u003cp\u003e\u003cem\u003e*Trois \u0026agrave; quatre carottes de sol, de 5 cm de diam\u0026egrave;tre et de 15 \u0026agrave; 20 cm de profondeur, ont \u0026eacute;t\u0026eacute; pr\u0026eacute;lev\u0026eacute;es avec un foreur du sol st\u0026eacute;rilis\u0026eacute; \u0026agrave; la base de chaque arbre, \u0026agrave; 1 m du collet. Les \u0026eacute;chantillons ont \u0026eacute;t\u0026eacute; scell\u0026eacute;s dans des sacs en plastique et conserv\u0026eacute;s au frais \u0026agrave; 4 \u0026deg; C jusqu\u0026rsquo;\u0026agrave; ce qu\u0026rsquo;ils soient trait\u0026eacute;s en laboratoire.\u003c/em\u003e\u003c/p\u003e",
                        "dataNature": "Données expérimentales"
                    },
                    "reuse": {
                        "justification": "\u003cp\u003eDes donn\u0026eacute;es de s\u0026eacute;quen\u0026ccedil;age provenant d'une autre esp\u0026egrave;ce de Phytophtora seront r\u0026eacute;utilis\u0026eacute;es.\u003c/p\u003e",
                        "reusedData": [
                            {
                                "license": {
                                    "licenseName": "Creative Commons Attribution 4.0 International",
                                    "licenseUrl": "https://spdx.org/licenses/CC-BY-4.0.html"
                                },
                                "title": "Global-gene expression of Phytophthora phaseoli",
                                "description": null,
                                "datasetId": "http://www.ebi.ac.uk/ena/data/view/ENA - SRP003414",
                                "idType": "URL",
                                "versionNumber": null
                            }
                        ],
                        "cost": []
                    },
                    "documentationQuality": {
                        "dataOrganizationReference": [],
                        "metadataStandard": [
                            {
                                "custom_value": "ISA-Tab"
                            }
                        ],
                        "contributor": [
                            {
                                "person": {
                                    "nameType": "Personne",
                                    "lastName": "Aguayo",
                                    "firstName": "Jaime",
                                    "mbox": "toto@inist.fr",
                                    "personId": "https://orcid.org/0000-0002-7552-0655",
                                    "idType": "ORCID",
                                    "affiliationName": "Interactions Arbres/Micro-organismes",
                                    "affiliationId": "200117307M",
                                    "affiliationIdType": "RNSR"
                                },
                                "role": "Responsable de la documentation des données"
                            },
                            {
                                "person": {
                                    "nameType": "Organisation (par ex : équipe, unité ou groupe de recherche)",
                                    "lastName": "Responsable assurance qualité de l'UMR BIOGECO",
                                    "firstName": null,
                                    "mbox": "quality.assurancy@biogeco.fr",
                                    "personId": null,
                                    "idType": null,
                                    "affiliationName": "Biodiversité, Gènes et Communautés ",
                                    "affiliationId": "200317684N",
                                    "affiliationIdType": "RNSR"
                                },
                                "role": "Responsable de la documentation des données"
                            }
                        ],
                        "cost": [],
                        "description": "\u003cp\u003eLe nom des fichiers et l\u0026rsquo;organisation des r\u0026eacute;pertoires sont d\u0026eacute;crits selon le m\u0026ecirc;me protocole que pour le jeu de donn\u0026eacute;es intitul\u0026eacute; \u0026laquo;\u0026nbsp;Etat sanitaire des aulnes\u0026nbsp;\u0026raquo;\u003c/p\u003e\r\n\u003cp\u003eTous les r\u0026eacute;sultats sont saisis dans un tableau excel puis convertit en csv\u003c/p\u003e",
                        "documentationSoftware": "SEEK"
                    },
                    "qualityAssuranceMethod": {
                        "methodReference": [
                            {
                                "title": "Elegbede CF, Pierrat J-C, Aguayo J, Husson C, Halkett F, Marcais B (2010) A statistical model to detect asymptomatic infectious individuals with an application in the Phytophthora alni-induced Alder decline. Phytopathology, 100, 1262–1269",
                                "methodIdentifier": "https://doi.org/10.1094/PHYTO-05-10-0140",
                                "idType": "DOI"
                            },
                            {
                                "title": "Aguayo J, Elegbede F, Husson C, Saintonge FX, Marçais B. Modeling climate impact on an emerging disease, the Phytophthora alni-induced alder decline. Glob Chang Biol. 2014;20:3209-21",
                                "methodIdentifier": "https://doi.org/10.1111/gcb.12601",
                                "idType": "DOI"
                            }
                        ],
                        "contributor": [
                            {
                                "person": {
                                    "nameType": "Organisation (par ex : équipe, unité ou groupe de recherche)",
                                    "lastName": "Responsable assurance qualité de l'UMR BIOGECO",
                                    "firstName": null,
                                    "mbox": "quality.assurancy@biogeco.fr",
                                    "personId": null,
                                    "idType": null,
                                    "affiliationName": "Biodiversité, Gènes et Communautés ",
                                    "affiliationId": "200317684N",
                                    "affiliationIdType": "RNSR"
                                },
                                "role": "Responsable de la qualité des données"
                            }
                        ],
                        "description": "\u003cp\u003eD\u0026eacute;crire les proc\u0026eacute;dures de contr\u0026ocirc;le qualit\u0026eacute; mises en place\u0026nbsp;:\u003c/p\u003e\r\n\u003cp\u003eLa qualit\u0026eacute; et la conformit\u0026eacute; des pr\u0026eacute;l\u0026egrave;vements seront assur\u0026eacute;es par le doctorant (UMR IAM) assist\u0026eacute; du technicien en charge de collecte des donn\u0026eacute;es (UMR BIOGECO) et du responsable assurance qualit\u0026eacute; (UMR BIOGECO).\u003c/p\u003e\r\n\u003cp\u003eCe contr\u0026ocirc;le portera essentiellement sur :\u003c/p\u003e\r\n\u003cul\u003e\r\n\u003cli\u003ele respect des protocoles de pr\u0026eacute;l\u0026egrave;vements, codage et tra\u0026ccedil;abilit\u0026eacute; des \u0026eacute;chantillons de sol,\u003c/li\u003e\r\n\u003cli\u003ela calibration des appareils de mesures, leur \u0026eacute;talonnage entre chaque mesure et la r\u0026eacute;p\u0026eacute;tition des mesures,\u003c/li\u003e\r\n\u003cli\u003ele respect des proc\u0026eacute;dures de pi\u0026eacute;geage d\u0026eacute;crites dans la publication d\u0026rsquo;Elegbede CF et al (2010),\u003c/li\u003e\r\n\u003cli\u003ela proc\u0026eacute;dure de d\u0026eacute;tection par technique PCR d\u0026eacute;crite dans la publication d\u0026rsquo;Aguayo J et al (2014).\u003c/li\u003e\r\n\u003c/ul\u003e"
                    },
                    "dataProcessing": {
                        "methodReference": [
                            {
                                "title": "Velvet",
                                "methodIdentifier": "https://github.com/dzerbino/velvet",
                                "idType": "URL"
                            }
                        ],
                        "facility": [
                            {
                                "title": "GenOuest",
                                "description": "La plate-forme GenOuest offre l'accès à un environnement bio-informatique complet combinant : 1/une infrastructure bioinformatique matérielle et logicielle (reposant sur un cluster et un cloud) 2/ le développement d’applications bioinformatiques (environnements, interfaces, bases de données publiques, outils et chaînes de traitements,…) 3/ une expertise et une consultance (les scientifiques peuvent bénéficier d’une expertise pour l’analyse de leurs données ou pour l’élaboration de stratégies d’analyse bioinformatiques) 4/ des formations 5/ de l’hébergement scientifique (les utilisateurs peuvent mettre en place de nouvelles ressources et/ou valoriser leurs travaux scientifiques grâce à la mise en place de sites ou applications web).Cet environnement de calcul est exploitable de diverses façons : cluster, cloud privé, portail web. La plateforme s’intéresse particulièrement aux nouvelles modalités de calcul (virtualisation, cloud computing, portails de calcul) ainsi qu’à la gestion des données et des métadonnées en Biologie. Grâce au projet CeSGO, GenOuest propose un ensemble d'outils collaboratifs pour gérer au mieux les projets et données scientifiques. GenOuest assure également le transfert technologique des nouveaux outils issus de la recherche en bio- informatique de l'Institut dont elle dépend.",
                                "technicalResourceId": "https://www.genouest.org/",
                                "idType": "URL"
                            }
                        ],
                        "contributor": [
                            {
                                "person": {
                                    "nameType": "Organisation (par ex : équipe, unité ou groupe de recherche)",
                                    "lastName": "Responsable de la plateforme de séquençage",
                                    "firstName": null,
                                    "mbox": null,
                                    "personId": null,
                                    "idType": "URL",
                                    "affiliationName": "Institut de Recherche en Informatique et Systèmes Aléatoires ",
                                    "affiliationId": "200012163A ",
                                    "affiliationIdType": "RNSR"
                                },
                                "role": "Responsable du traitement et de l'analyse des données"
                            }
                        ],
                        "cost": [],
                        "description": "\u003cp\u003eLes s\u0026eacute;quences brutes sont trait\u0026eacute;es avec le package velvet pour produire des contig uniques\u003c/p\u003e"
                    },
                    "budget": {},
                    "dataStorage": {
                        "facility": {
                            "title": "GenOuest",
                            "description": "La plate-forme GenOuest offre l'accès à un environnement bio-informatique complet combinant : 1/une infrastructure bioinformatique matérielle et logicielle (reposant sur un cluster et un cloud) 2/ le développement d’applications bioinformatiques (environnements, interfaces, bases de données publiques, outils et chaînes de traitements,…) 3/ une expertise et une consultance (les scientifiques peuvent bénéficier d’une expertise pour l’analyse de leurs données ou pour l’élaboration de stratégies d’analyse bioinformatiques) 4/ des formations 5/ de l’hébergement scientifique (les utilisateurs peuvent mettre en place de nouvelles ressources et/ou valoriser leurs travaux scientifiques grâce à la mise en place de sites ou applications web).Cet environnement de calcul est exploitable de diverses façons : cluster, cloud privé, portail web. La plateforme s’intéresse particulièrement aux nouvelles modalités de calcul (virtualisation, cloud computing, portails de calcul) ainsi qu’à la gestion des données et des métadonnées en Biologie. Grâce au projet CeSGO, GenOuest propose un ensemble d'outils collaboratifs pour gérer au mieux les projets et données scientifiques. GenOuest assure également le transfert technologique des nouveaux outils issus de la recherche en bio- informatique de l'Institut dont elle dépend.",
                            "technicalResourceId": "https://www.genouest.org/",
                            "idType": "URL"
                        },
                        "backupPolicy": {
                            "description": "Les données froides sont stockées sur bande magnétique. Les données (chaudes) en cours d'utilisation sont stockées sur disque et des sauvegardes de l'espace de travail par snaphot peuvent être envisagées",
                            "backupType": "Snapshot sur espace de travail si nécessaire",
                            "storageType": [
                                "Bande magnétique"
                            ]
                        },
                        "description": "\u003cp\u003eLors de l'analyse par s\u0026eacute;quen\u0026ccedil;age des marqueurs g\u0026eacute;n\u0026eacute;tiques de \u003cem\u003ePhytophthora alni\u003c/em\u003e et comparaison avec \u003cem\u003ePhytophthora phaesoli,\u003c/em\u003e les donn\u0026eacute;es seront stock\u0026eacute;es sur la plateforme GenOuest durant la p\u0026eacute;riode d'analyse avant d'\u0026ecirc;tre transf\u0026eacute;r\u0026eacute;es au cc IN2P3\u003c/p\u003e",
                        "securityMeasures": "\u003cp\u003ePendant la collaboration, les donn\u0026eacute;es seront accessibles par tous les membres du projet de tous les partenaires via l\u0026rsquo;espace partag\u0026eacute;, en acc\u0026egrave;s contr\u0026ocirc;l\u0026eacute; via le service d\u0026rsquo;authentification de la plateforme GenOuest\u003c/p\u003e",
                        "totalVolume": 100,
                        "volumeUnit": "Mo",
                        "genciServiceRequest": [
                            {
                                "initialRequest": {
                                    "initialStatus": {
                                        "dataSize": 0,
                                        "volumeUnit": "To",
                                        "numberOfFiles": 0,
                                        "numberOfDirectories": 0
                                    },
                                    "oneYearStatus": {
                                        "dataSize": 0,
                                        "volumeUnit": "To",
                                        "numberOfFiles": 0,
                                        "numberOfDirectories": 0
                                    },
                                    "storageTime": 0,
                                    "justification": null
                                },
                                "extensionRequest": {
                                    "initialStatus": {
                                        "dataSize": 0,
                                        "volumeUnit": "Téraoctets",
                                        "numberOfFiles": 0,
                                        "numberOfDirectories": 0
                                    },
                                    "oneYearStatus": {
                                        "dataSize": 0,
                                        "volumeUnit": "Téraoctets",
                                        "numberOfFiles": 0,
                                        "numberOfDirectories": 0
                                    },
                                    "storageTime": 0,
                                    "justification": null
                                },
                                "serviceType": null,
                                "amount": 0,
                                "currency": null
                            }
                        ],
                        "cost": []
                    }
                }
            ],
            "meta": {
                "title": "DMP du projet PHYTOCLIM",
                "creationDate": "2021-04-09",
                "lastModifiedDate": "2021-04-09",
                "dmpLanguage": "fra",
                "contact": {
                    "person": {
                        "nameType": "Personne",
                        "lastName": "Aguayo",
                        "firstName": "Jaime",
                        "mbox": "toto@inist.fr",
                        "personId": "https://orcid.org/0000-0002-7552-0655",
                        "idType": "ORCID",
                        "affiliationName": "Interactions Arbres/Micro-organismes",
                        "affiliationId": "200117307M",
                        "affiliationIdType": "RNSR"
                    },
                    "role": "Responsable du plan de gestion de données"
                },
                "license": {
                    "licenseName": "Etalab Open License 2.0",
                    "licenseUrl": "https://spdx.org/licenses/etalab-2.0.html"
                },
                "deliverableNumber": null,
                "version": "Version initiale",
                "description": "\u003cp\u003eIl s\u0026rsquo;agit d\u0026rsquo;un PGD destin\u0026eacute; \u0026agrave; \u0026ecirc;tre utilis\u0026eacute; \u0026agrave; des fins p\u0026eacute;dagogiques pour un projet de th\u0026egrave;se fictif en \u0026eacute;cologie (biologie v\u0026eacute;g\u0026eacute;tale) d\u0026rsquo;apr\u0026egrave;s Aguayo J, Elegbede F, Husson C, Saintonge FX, Mar\u0026ccedil;ais B. Modeling climate impact on an emerging disease, the Phytophthora alni-induced alder decline. Glob Chang Biol. 2014;20:3209-21\u003c/p\u003e",
                "dmpId": "http://vdopidor.intra.inist.fr:40001/plans/1941",
                "idType": "URL",
                "relatedDoc": [
                    {
                        "title": "Modeling climate impact on an emerging disease, the Phytophthora alni-induced alder decline. Aguayo J et al. Global Change Biology (2014) 20, 3209–3221",
                        "docIdentifier": "https://doi.org/10.1111/gcb.12601",
                        "idType": "DOI"
                    },
                    {
                        "title": "Le projet ANR Biodiversité 2007 (site web)",
                        "docIdentifier": "https://www6.inrae.fr/reid/Les-groupes/Champignons-phytopathogenes/Projets-en-cours/Le-projet-EMERFUNDIS ",
                        "idType": "URL"
                    }
                ],
                "associatedDmp": [
                    {
                        "title": "DMP du projet ECOLIRIMED",
                        "docIdentifier": "http://vdopidor.intra.inist.fr:40001/plans/1042/export.pdf ",
                        "idType": "URL"
                    }
                ]
            }
        },
        "dmp_id": 23217
    }
    if ( test == true ) {
        res.send({ message: 'Dmp found', data: required_data})


    } else {
        res.status(404).send('No pending project found')
    }
    
    res.end();
});

router.post;
module.exports = router;
