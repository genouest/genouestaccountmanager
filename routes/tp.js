const express = require('express');
var router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');


const dbsrv = require('../core/db.service.js');

const sansrv = require('../core/sanitize.service.js');
const rolsrv = require('../core/role.service.js');
const tpssrv = require('../core/tps.service.js');

const ObjectID = require('mongodb').ObjectID;

// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
//var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
//var STATUS_ACTIVE = 'Active';
// eslint-disable-next-line no-unused-vars
var STATUS_EXPIRED = 'Expired';


router.get('/tp', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }
    let reservations = await dbsrv.mongo_reservations().find({}).toArray();
    res.send(reservations);
    res.end();
});

router.post('/tp', async function(req, res) {
    if(req.body.quantity === undefined || req.body.quantity === null || req.body.quantity<=0){
        res.status(403).send({message: 'Quantity must be >= 1'});
        return;
    }
    if(req.body.about === undefined || req.body.about == ''){
        res.status(403).send({message: 'Tell us why you need some tp accounts'});
        return;
    }

    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = isadmin;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    tpssrv.tp_reservation(
        user.uid,
        req.body.from,
        req.body.to,
        req.body.quantity,
        req.body.about,
        req.body.group_or_project,
        req.body.name
    ).then(function(reservation){
        res.send({reservation: reservation, message: 'Reservation done'});
        res.end();
        return;
    });
});

router.get('/tp/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = isadmin;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to get this reservation'});
        res.end();
        return;
    }
    res.send({reservation: reservation});
    res.end();
});

router.delete('/tp/:id', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = isadmin;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to delete this reservation'});
        res.end();
        return;
    }

    if(reservation.over){
        res.status(403).send({message: 'Reservation is already closed'});
        res.end();
        return;
    }

    if(reservation.created){
        res.status(403).send({message: 'Reservation accounts already created, reservation will be closed after closing date'});
        res.end();
        return;
    }
    await dbsrv.mongo_reservations().updateOne({'_id': ObjectID.createFromHexString(req.params.id)},{'$set': {'over': true}});
    res.send({message: 'Reservation cancelled'});
    res.end();
    return;
});

router.put('/tp/:id/reserve/stop', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = isadmin;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to delete this reservation'});
        res.end();
        return;
    }

    try {
        tpssrv.remove_tp_reservation(reservation_id);
    } catch (error) {
        logger.error(error);
        res.status(500).send({message: 'Error will removing tp reservation'});
        res.end();
        return;
    }

    res.send({message: 'Reservation closed'});
    res.end();
});

router.put('/tp/:id/reserve/now', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user) {
        res.send({message: 'User does not exist'});
        res.end();
        return;
    }

    let is_admin = isadmin;
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);

    // add filter
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else{
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if(!reservation){
        res.status(403).send({message: 'Not allowed to reserve now this reservation'});
        res.end();
        return;
    }

    let newresa;
    try {
        newresa = await tpssrv.create_tp_reservation(reservation_id, 'auto');
    } catch (error) {
        logger.error(error);
        res.status(500).send({message: 'Error will creating tp reservation'});
        res.end();
        return;
    }

    logger.debug('set reservation as done', newresa);
    newresa.created = true;
    res.send({reservation: newresa});
    res.end();
});

module.exports = router;
