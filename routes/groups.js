/* eslint-disable require-atomic-updates */
/*jslint es6 */
const express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
const sansrv = require('../core/sanitize.service.js');

//const runningEnv = process.env.NODE_ENV || 'prod';

const grpsrv = require('../core/group.service.js');
const rolsrv = require('../core/role.service.js');

router.get('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let users_in_group = await dbsrv.mongo_users().find({'$or': [{'secondarygroups': req.params.id}, {'group': req.params.id}]}).toArray();
    res.send(users_in_group);
    res.end();
});

router.delete('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let group = await dbsrv.mongo_groups().findOne({name: req.params.id});
    if(!group) {
        res.status(403).send({message: 'Group does not exist'});
        return;
    }
    let users_in_group = await dbsrv.mongo_users().find({'$or': [{'secondarygroups': req.params.id}, {'group': req.params.id}]}).toArray();
    if(users_in_group && users_in_group.length > 0){
        res.status(403).send({message: 'Group has some users, cannot delete it'});
        return;
    }
    grpsrv.delete_group(group, user.uid).then(function(){
        res.send({message: 'group ' + req.params.id + ' deleted'});
        res.end();
    });
});


router.put('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let owner = req.body.owner;
    let user = await dbsrv.mongo_users().findOne({uid: owner});
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        res.end();
        return;
    }
    let group = await dbsrv.mongo_groups().findOne({name: req.params.id});
    if(! group) {
        res.status(404).send({message: 'Group does not exist'});
        return;
    }
    await dbsrv.mongo_events().insertOne({
        'owner': user.uid,
        'date': new Date().getTime(),
        'action': 'group owner modification ' + group.name + ' to ' +owner,
        'logs': []});

    let data = await dbsrv.mongo_groups().updateOne({name: group.name}, {'$set':{'owner': owner}});
    res.send(data);
    res.end();
});

router.post('/group/:id', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let session_user = null;
    let isadmin = false;
    try {
        session_user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(session_user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!session_user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let owner = req.body.owner;
    let user = await dbsrv.mongo_users().findOne({uid: owner});
    if(!user) {
        res.status(404).send({message: 'Owner user does not exist'});
        res.end();
        return;
    }
    let group = await dbsrv.mongo_groups().findOne({name: req.params.id });
    if(group) {
        res.status(403).send({message: 'Group already exists'});
        return;
    }
    let groupexisted = await dbsrv.mongo_oldgroups().findOne({name: req.params.id});
    if(groupexisted && (CONFIG.general.prevent_reuse_group === undefined || CONFIG.general.prevent_reuse_group)){
        logger.error(`Group name ${req.params.id} already used in the past, preventing reuse`);
        res.status(403).send('Group name already used in the past, preventing reuse');
        return;
    }

    try {
        group = await grpsrv.create_group(req.params.id , owner, session_user.uid);
    } catch(error){
        logger.error('Add Group Failed for: ' + req.params.id, error);
        res.status(500).send({message: 'Add Group Failed'});
        return;
    }

    res.send(group);
    res.end();
    return;
});

router.get('/group', async function(req, res){
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let groups = await dbsrv.mongo_groups().find().toArray();
    res.send(groups);
    return;
});

//Return all projects using this group
router.get('/group/:id/projects', async function(req, res){
    if(! req.locals.logInfo.is_logged){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let projects_with_group = await dbsrv.mongo_projects().find({'group': req.params.id}).toArray();
    res.send(projects_with_group);
    res.end();
});


module.exports = router;
