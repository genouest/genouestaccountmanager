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
        "plan_id": 1676,
        "project": {
            "title": "Modélisation de l'impact climatique d’une maladie émergente, le dépérissement de l'aulne induit par Phytophthora alni",
            "principalInvestigator": {
                "person": {
                    "lastName": "Marçais",
                    "nameType": "Personne",
                    "firstName": "Benoît",
                    "mbox": "benoit.marcais@inist.fr",
                    "personId": "https://orcid.org/0000-0002-8107-644X",
                    "IdType": "ORCID",
                    "affiliationName": "IAM Interactions Arbres/Micro-organismes",
                    "affiliationId": "200117307M",
                    "affiliationIdType": "RNSR"
                },
                "role": "Coordinateur du projet"
            },
            "experimentalPlan": {
                "title": "Modeling climate impact on an emerging disease, the Phytophthora alni-induced alder decline. Aguayo J et al. Global Change Biology (2014) 20, 3209–3221",
                "docIdentifier": " https://doi.org/10.1111/gcb.12601",
                "idType": "DOI"
            },
            "funding": [
                {
                    "funder": {
                        "label": {
                            "en_GB": "French National Cancer Institute, INCa",
                            "fr_FR": "Institut National Du Cancer, INCa"
                        },
                        "name": "Institut National Du Cancer",
                        "funderId": "http://dx.doi.org/10.13039/501100006364",
                        "idType": "FundRef",
                        "dataPolicy": {
                            "title": "Déclaration conjointe du réseau des agences de financement françaises en faveur de la science ouverte",
                            "docIdentifier": "https://www.e-cancer.fr/content/download/291990/4158532/file/De%CC%81claration%20conjointe%20en%20faveur%20de%20la%20science%20ouverte%20-%20%2029%20juin.pdf",
                            "idType": "URL"
                        },
                        "id": 312
                    },
                    "grantId": "hdjsqkg",
                    "fundingStatus": "Rejeté"
                },
                {
                    "funder": {
                        "dataPolicy": {
                            "title": "Plan données de la recherche du CNRS",
                            "docIdentifier": "https://www.cnrs.fr/sites/default/files/pdf/Plaquette_PlanDDOR_Nov20.pdf",
                            "idType": "URL"
                        },
                        "name": "Agence Nationale de la Recherche",
                        "funderId": "http://dx.doi.org/10.13039/501100001665",
                        "idType": "FundRef"
                    },
                    "grantId": "ANR-07-BDIV-0003",
                    "fundingStatus": "Approuvé"
                },
                {
                    "funder": {
                        "dataPolicy": {
                            "title": "Guidelines on FAIR data management in Horizon 2020",
                            "docIdentifier": "https://ec.europa.eu/research/participants/data/ref/h2020/grants_manual/hi/oa_pilot/h2020-hi-oa-data-mgt_en.pdf",
                            "idType": "URL"
                        },
                        "name": "European Commission",
                        "funderId": "https://ror.org/00k4n6c32",
                        "idType": "ROR ID"
                    },
                    "grantId": "Identifiant non retrouvé",
                    "fundingStatus": "Approuvé"
                }
            ],
            "acronym": "PHYTOCLIM",
            "description": "<p>A partir des ann&eacute;es 1990, une nouvelle maladie est apparue sur les aulnes en bordure des cours d&rsquo;eau. Elle est caus&eacute;e par un microorganisme pathog&egrave;ne, <em>Phytophthora alni</em>, qui attaque les racines des arbres et provoque leur d&eacute;p&eacute;rissement. Ce pathog&egrave;ne est une esp&egrave;ce&nbsp; thermophile. Par ailleurs, l&rsquo;&eacute;mergence du d&eacute;p&eacute;rissement de l&rsquo;aulne est concomitante avec les ann&eacute;es particuli&egrave;rement chaudes des deux derni&egrave;res d&eacute;cennies.</p>\r\n<p>Les facteurs environnementaux, tels que la temp&eacute;rature moyenne du site et les caract&eacute;ristiques du sol jouent un r&ocirc;le important dans l'apparition de la maladie.</p>\r\n<p>L'objectif de ce projet est de mod&eacute;liser et de pr&eacute;voir l'effet de l'environnement sur la gravit&eacute; des &eacute;pid&eacute;mies dues &agrave; <em>Phytophthora alni</em> et de d&eacute;terminer si les r&eacute;cents changements climatiques pourraient expliquer l'&eacute;mergence de la maladie.</p>",
            "startDate": "2007-01-01",
            "endDate": "1995-12-01",
            "partner": [
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
                    "idType": null
                },
                {
                    "dataPolicy": {
                        "title": "Charte pour le libre accès aux publications et aux données",
                        "docIdentifier": "https://hal.inrae.fr/hal-02801732",
                        "idType": "URL"
                    },
                    "name": "BIOGECO Biodiversité, Gènes et Communautés",
                    "rnsr": "200317684N",
                    "orgId": "https://ror.org/033ebya06",
                    "idType": "ROR ID"
                }
            ]
        },
        "meta": {
            "title": "DMP du projet PHYTOCLIM",
            "creationDate": "2021-02-22",
            "lastModifiedDate": "2021-02-22",
            "dmpLanguage": "fra",
            "contact": {
                "person": {
                    "lastName": "Aguayo",
                    "nameType": "Personne",
                    "firstName": "Jaime",
                    "mbox": "toto@inist.fr",
                    "personId": "https://orcid.org/0000-0002-7552-0655",
                    "IdType": "ORCID",
                    "affiliationName": "IAM Interactions Arbres/Micro-organismes",
                    "affiliationId": "200117307M",
                    "affiliationIdType": "RNSR"
                },
                "role": "Coordinateur du plan de gestion de données"
            },
            "license": null,
            "description": "<p>Il s&rsquo;agit d&rsquo;un PGD destin&eacute; &agrave; &ecirc;tre utilis&eacute; &agrave; des fins p&eacute;dagogiques pour un projet de th&egrave;se fictif en &eacute;cologie (biologie v&eacute;g&eacute;tale) d&rsquo;apr&egrave;s Aguayo J, Elegbede F, Husson C, Saintonge FX, Mar&ccedil;ais B. Modeling climate impact on an emerging disease, the Phytophthora alni-induced alder decline. Glob Chang Biol. 2014;20:3209-21</p>",
            "dmpId": null,
            "idType": null,
            "licenseStartDate": null
        },
        "researchOutput": [
            {
                "research_output_id": 1854,
                "researchOutputDescription": {
                    "title": "Etat sanitaire des aulnes",
                    "contact": {
                        "person": {
                            "lastName": "Aguayo",
                            "nameType": "Personne",
                            "firstName": "Jaime",
                            "mbox": "toto@inist.fr",
                            "personId": "https://orcid.org/0000-0002-7552-0655",
                            "IdType": "ORCID",
                            "affiliationName": "IAM Interactions Arbres/Micro-organismes",
                            "affiliationId": "200117307M",
                            "affiliationIdType": "RNSR"
                        }
                    },
                    "description": "<p>Sur 16 sites g&eacute;olocalis&eacute;s dans le Nord-Est (NE) de la France, l&rsquo;&eacute;tat sanitaire de 50 aulnes de cette r&eacute;gion est not&eacute; chaque ann&eacute;e en juin de 2007 &agrave; 2012 selon 2 bar&egrave;mes :</p>\r\n<ul>\r\n<li>Pr&eacute;sence ou absence de chancre &agrave; la base du tronc</li>\r\n<li>Niveau de d&eacute;p&eacute;rissement de la cime des arbres :\r\n<ul>\r\n<li>1 pas de sympt&ocirc;me</li>\r\n<li>2 moins de 50 % de d&eacute;p&eacute;rissement</li>\r\n<li>3 plus de 50 % de d&eacute;p&eacute;rissement</li>\r\n<li>4 Mort</li>\r\n</ul>\r\n</li>\r\n</ul>",
                    "type": "Jeu de données",
                    "workPackage": "pas de workpackage",
                    "uncontrolledKeywords": [
                        "Dépérissement",
                        " Etat sanitaire"
                    ],
                    "language": "fra",
                    "datasetId": null,
                    "idType": null,
                    "containsPersonalData": "Non",
                    "containsSensitiveData": "Non",
                    "hasEthicalIssues": "Non",
                    "controlledKeyword": [
                        {
                            "keyword": "Environmental data",
                            "keywordSchema": "GEMET - General Multilingual Environmental Thesaurus",
                            "keywordUrl": "http://www.eionet.europa.eu/gemet/concept/2803 "
                        },
                        {
                            "keyword": "Invasion biologique",
                            "keywordSchema": "Thésaurus de la biodiversité",
                            "keywordUrl": "http://data.loterre.fr/ark:/67375/BLH-TN6ZS5W6-J "
                        }
                    ]
                }
            },
            {
                "research_output_id": 1859,
                "researchOutputDescription": {
                    "title": "Caractéristiques du sol",
                    "contact": {
                        "person": {
                            "lastName": "Aguayo",
                            "nameType": "Personne",
                            "firstName": "Jaime",
                            "mbox": "toto@inist.fr",
                            "personId": "https://orcid.org/0000-0002-7552-0655",
                            "IdType": "ORCID",
                            "affiliationName": "IAM Interactions Arbres/Micro-organismes",
                            "affiliationId": "200117307M",
                            "affiliationIdType": "RNSR"
                        }
                    },
                    "description": "<p>Mesure des caract&eacute;ristiques du sol une fois au d&eacute;but le projet : pH, texture du sol, concentration en carbon (C) et azote total (N) dans des &eacute;chantillons de sol pr&eacute;lev&eacute;s au pied de quelques arbres</p>",
                    "type": "Jeu de données",
                    "workPackage": "pas de workpackage",
                    "uncontrolledKeywords": [
                        "Ripisylve"
                    ],
                    "language": "fra",
                    "datasetId": null,
                    "idType": null,
                    "containsPersonalData": "Non",
                    "containsSensitiveData": "Non",
                    "hasEthicalIssues": "Non",
                    "controlledKeyword": [
                        {
                            "keyword": "Chemistry soil",
                            "keywordSchema": "GEMET - General Multilingual Environmental Thesaurus",
                            "keywordUrl": "https://www.eionet.europa.eu/gemet/en/concept/7849 "
                        }
                    ]
                }
            },
            {
                "research_output_id": 1860,
                "researchOutputDescription": {
                    "title": "Estimation quantitative du microorganisme Phytophthora alni",
                    "contact": {
                        "person": {
                            "lastName": "Cosserat",
                            "firstName": "Francoise",
                            "mbox": "francoise.cosserat@inist.fr"
                        }
                    },
                    "description": "<p>Estimation quantitative du microorganisme <em>Phytophthora alni</em> (pluriannuelle) par technique PCR en temps r&eacute;el dans les &eacute;chantillons de sol au pied des aulnes</p>",
                    "type": "Jeu de données",
                    "workPackage": "pas de workpackage",
                    "uncontrolledKeywords": [
                        "Piégeage par rhododendron"
                    ],
                    "language": null,
                    "datasetId": null,
                    "idType": null,
                    "containsPersonalData": "Non",
                    "containsSensitiveData": "Non",
                    "hasEthicalIssues": "Non",
                    "controlledKeyword": [
                        {
                            "keyword": "Phytophthora alni",
                            "keywordSchema": "Index Fungorum",
                            "keywordUrl": "http://www.indexfungorum.org/names/NamesRecord.asp?RecordID=488625 "
                        },
                        {
                            "keyword": "Réaction de polymérisation en chaîne",
                            "keywordSchema": "Thésaurus MeSH bilingue français-anglais",
                            "keywordUrl": "http://data.loterre.fr/ark:/67375/JVR/M0024634 "
                        }
                    ]
                }
            },
            {
                "research_output_id": 1861,
                "researchOutputDescription": {
                    "title": "Modèle mathématique type SIS ",
                    "contact": {
                        "person": {
                            "lastName": "Aguayo",
                            "nameType": "Personne",
                            "firstName": "Jaime",
                            "mbox": "toto@inist.fr",
                            "personId": "https://orcid.org/0000-0002-7552-0655",
                            "IdType": "ORCID",
                            "affiliationName": "IAM Interactions Arbres/Micro-organismes",
                            "affiliationId": "200117307M",
                            "affiliationIdType": "RNSR"
                        }
                    },
                    "description": "<p>Mod&egrave;le math&eacute;matique type SIS (susceptible-infected-susceptible) d&eacute;fini &agrave; partir des donn&eacute;es observationnelles et exp&eacute;rimentales de la r&eacute;gion Nord Est, r&eacute;alis&eacute; sous R.</p>",
                    "type": "Modèle",
                    "workPackage": "pas de workpackage",
                    "uncontrolledKeywords": [
                        "Modèle SIS"
                    ],
                    "language": "fra",
                    "datasetId": null,
                    "idType": null,
                    "containsPersonalData": "Non",
                    "containsSensitiveData": "Non",
                    "hasEthicalIssues": "Non",
                    "controlledKeyword": [
                        {
                            "keyword": "Model",
                            "keywordSchema": "GEMET – General Multilingual Environmental Thesaurus",
                            "keywordUrl": "https://www.eionet.europa.eu/gemet/en/concept/5325 "
                        },
                        {
                            "keyword": "Climatic change",
                            "keywordSchema": "GEMET - General Multilingual Environmental Thesaurus",
                            "keywordUrl": "https://www.eionet.europa.eu/gemet/en/concept/1471 "
                        },
                        {
                            "keyword": "Phytopathologiy",
                            "keywordSchema": "GEMET - General Multilingual Environmental Thesaurus",
                            "keywordUrl": "https://www.eionet.europa.eu/gemet/en/concept/6244 "
                        }
                    ]
                }
            }
        ]
    }
    yaml_data = yaml.load(required_data.toString());
    if ( test == true ) {
        res.send({ message: 'Dmp found', data: required_data, yaml:yaml_data})


    } else {
        res.status(404).send('No pending project found')
    }
    
    res.end();
});

router.post;
module.exports = router;
