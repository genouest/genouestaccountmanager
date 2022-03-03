/* TODO : create a core/project.service.js and move all method in it */

const express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const yaml = require('js-yaml');
const axios = require('axios');


const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');
const prjsrv = require('../core/project.service.js');
const usrsrv = require('../core/user.service.js');

router.get('/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }
    if (!isadmin) {
        if (!user.projects) {
            res.send([]);
            return;
        } else {
            let projects = await dbsrv.mongo_projects().find({ id: { $in: user.projects } }).toArray();
            res.send(projects);
            return;
        }
    } else {

        if (req.query.all === 'true') {
            let projects = await dbsrv.mongo_projects().find({}).toArray();

            res.send(projects);
            return;
        } else {
            if (!user.projects) {
                res.send([]);
                return;
            } else {
                let projects = await dbsrv.mongo_projects().find({ id: { $in: user.projects } }).toArray();
                res.send(projects);
                return;
            }
        }
    }
});

router.get('/project/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }
    if (!isadmin) {
        res.status(401).send({ message: 'Admin only' });
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({ 'id': req.params.id });
    if (!project) {
        logger.error('failed to get project', req.params.id);
        res.status(404).send({ message: 'Project ' + req.params.id + ' not found' });
        return;
    }
    res.send(project);
});

router.post('/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (!sansrv.sanitizeAll([req.body.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }
    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }
    if (!isadmin) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    let owner = await dbsrv.mongo_users().findOne({ 'uid': req.body.owner });
    if (!owner) {
        res.status(404).send({ message: 'Owner not found' });
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({ 'id': req.body.id });
    if (project) {
        res.status(403).send({ message: 'Not authorized or project already exists' });
        return;
    }

    try {
        await prjsrv.create_project({
            'id': req.body.id,
            'owner': req.body.owner,
            'group': req.body.group,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'expire': req.body.expire,
            'description': req.body.description,
            'path': req.body.path,
            'orga': req.body.orga,
            'access': req.body.access,
            'dmpid': req.body.dmpid
        }, req.body.uuid, user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({ message: e.message });
            res.end();
            return;
        } else {
            res.status(500).send({ message: 'Server Error, contact admin' });
            res.end();
            return;
        }
    }

    res.send({ message: 'Project created' });
    return;
});

router.delete('/project/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }

    if (!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }
    if (!isadmin) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }

    try {
        await prjsrv.remove_project(req.params.id, user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({ message: e.message });
            res.end();
            return;
        } else {
            res.status(500).send({ message: 'Server Error, contact admin' });
            res.end();
            return;
        }
    }
    res.send({ message: 'Project deleted' });

});

router.post('/project/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }
    if (!isadmin) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({ 'id': req.params.id });
    if (!project) {
        res.status(401).send({ message: 'Not authorized or project not found' });
        return;
    }
    try {
        await prjsrv.update_project(req.params.id, {
            'owner': req.body.owner,
            'group': req.body.group,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'expire': req.body.expire,
            'description': req.body.description,
            'access': req.body.access,
            'orga': req.body.orga,
            'path': req.body.path
        }, user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({ message: e.message });
            res.end();
            return;
        } else {
            res.status(500).send({ message: 'Server Error, contact admin' });
            res.end();
            return;
        }
    }
    res.send({ message: 'Project updated' });
});

router.post('/project/:id/request', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }
    let user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }
    let project = await dbsrv.mongo_projects().findOne({ 'id': req.params.id });
    if (!project) {
        res.status(404).send({ message: 'Project ' + req.params.id + ' not found' });
        return;
    }

    if (user.uid != project.owner) {
        res.status(401).send({ message: 'User ' + user.uid + ' is not project manager for project ' + project.id });
        return;
    }
    let newuser = await dbsrv.mongo_users().findOne({ 'uid': req.body.user });
    if (!newuser) {
        res.status(404).send({ message: 'User ' + req.body.user + ' not found' });
        return;
    }
    if (newuser.projects && newuser.projects.indexOf(project.id) >= 0 && req.body.request === 'add') {
        res.status(403).send({ message: 'User ' + req.body.user + ' is already in project : cannot add' });
        return;
    }


    try {
        if (req.body.request === 'add') {
            await usrsrv.add_user_to_project(project.id, req.body.user, user.uid);
        } else if (req.body.request === 'remove') {
            await usrsrv.remove_user_from_project(project.id, req.body.user, user.uid, false);
        }
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({ message: e.message });
            res.end();
            return;
        } else {
            res.status(500).send({ message: 'Server Error, contact admin' });
            res.end();
            return;
        }
    }

    res.send({ message: req.body.request + ' ' + req.body.user + ' done' });
});


router.post('/ask/project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    let user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }

    if (!req.body.id) {
        res.status(403).send({'message': 'Project name empty'});
        return;
    }
    let p = await dbsrv.mongo_projects().findOne({id: req.body.id});
    if(p) {
        res.status(403).send({'message': 'Project already exists'});
        return;
    }
   

    try {
        await prjsrv.create_project_request({
            'id': req.body.id,
            'owner': user.uid,
            'group': user.group,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'description': req.body.description,
            'orga': req.body.orga,
            'dmpid': req.body.dmpid,
        }, user);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({ message: e.message });
            res.end();
            return;
        } else {
            res.status(500).send({ message: 'Server Error, contact admin' });
            res.end();
            return;
        }
    }
    res.send({ message: 'Pending Project created' });

    return;
});

//gets all the projects waiting the Admin approval
router.get('/pending/project', async function (req, res) {

    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (!isadmin) {
        if (!user.pending) {
            res.send([]);
            return;
        } else {
            let pendings = await dbsrv.mongo_pending_projects().find({ id: { $in: user.pending } }).toArray();
            res.send(pendings);
            return;
        }
    } else {
        if (req.query.all === 'true') {
            let pendings = await dbsrv.mongo_pending_projects().find({}).toArray();
            res.send(pendings);
            return;
        } else {
            if (!user.pending) {
                res.send([]);
                return;
            } else {
                let pendings = await dbsrv.mongo_pending_projects().find({ id: { $in: user.pending } }).toArray();
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
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if (!isadmin) {
        res.status(401).send('Not authorized');
        return;
    }

    try {
        await prjsrv.remove_project_request(req.params.uuid, user.uid);
    } catch (e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({ message: e.message });
            res.end();
            return;
        } else {
            res.status(500).send({ message: 'Server Error, contact admin' });
            res.end();
            return;
        }
    }
    res.send({ message: 'Pending Project deleted' });

});

router.get('/project/:id/users', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send({ message: 'Not authorized' });
        return;
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({ message: 'Invalid parameters' });
        return;
    }

    let user = null;
    let isadmin = false;

    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        res.status(404).send({ message: 'User session not found' });
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send({ message: 'User not found' });
        return;
    }
    

    if (!user.projects) {
        user.projects = [];
    }

    if (user.projects.includes(req.params.id) || isadmin) {
        let users_in_project = await dbsrv.mongo_users().find({ 'projects': req.params.id }).toArray();
        res.send(users_in_project);
        res.end();
        return;
    }
    res.status(401).send({ message: 'Not authorized' });

});

//fetchs a dmp based on his ID, using the dmp OPIDoR API
router.post('/dmp/:planid/:researchoutputid', async function (req, res) {
    let plan_id = req.params.planid;
    let research_output_id = req.params.researchoutputid;
    let data = await prjsrv.request_DMP(plan_id,research_output_id);
    res.send({message:'DMP found', data: data} );
    //request to DMP opidor API to get all of the DMP with a json format
    //
    //Keeps only the required data for the project
    // console.log(prjsrv.auth_from_opidor());
    // let token = null;
    // await prjsrv.opidor_token_refresh().then(response => {
    //     console.log('RETURN:');
    //     console.log(response);
    //     token = response;
    //     const options = {
    //         headers: {
    //             accept: "application/json",
    //             Authorization: `Bearer ${token}`
    //         }
    //     };
    //     let resp = {data: 'none'};
    //     // let resp = axios.get(`https://opidor-preprod.inist.fr/api/v1/madmp/plans/${plan_id}?research_output_id=${research_output_id}`, options);
    //     return res.send({ message: 'Dmp found', data: resp.data });

    // })
    //     .catch(error => {
    //         return res.send({message: 'ERROR', data: error});

    //     });
    // // let token = 'eyJhbGciOiJIUzI1NiJ9.eyJjbGllbnRfaWQiOiJiMDBkYWRiZi1mOGM4LTQyMmYtOWE4MS1hZTc5OGM1Mjc2MTMiLCJleHAiOjE2NDM0NDc1Nzd9.pcKrQwCek8vDfcZbINZbWkJyx-27i4lztHrvMSUg0zw';

    
});


router.post;
module.exports = router;