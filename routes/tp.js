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
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        return;
    }
    let reservations = await dbsrv.mongo_reservations().find({}).toArray();
    res.send(reservations);
});

router.post('/tp', async function(req, res) {
    if(!req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        return;
    }
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        return;
    }
    if(!(is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(req.body.quantity === undefined || req.body.quantity === null || req.body.quantity <= 0) {
        res.status(403).send({message: 'Quantity must be >= 1'});
        return;
    }
    if(req.body.about === undefined || req.body.about == '') {
        res.status(403).send({message: 'Tell us why you need some tp accounts'});
        return;
    }
    tpssrv.tp_reservation(
        user.uid,
        req.body.from,
        req.body.to,
        req.body.expire,
        req.body.quantity,
        req.body.about,
        req.body.group_or_project,
        req.body.name
    ).then(function(reservation){
        res.send({reservation: reservation, message: 'Reservation done'});
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
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        return;
    }
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        return;
    }
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
    let filter = {};
    if(is_admin) {
        filter = {_id: reservation_id};
    }
    else {
        filter = {_id: reservation_id, owner: user.uid};
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if(!reservation) {
        res.status(403).send({message: 'Not allowed to get this reservation'});
        return;
    }
    res.send({reservation: reservation});
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
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        return;
    }
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        return;
    }
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
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
        return;
    }
    if(reservation.over){
        res.status(403).send({message: 'Reservation is already closed'});
        return;
    }
    if(reservation.created){
        res.status(403).send({message: 'Reservation accounts already created, reservation will be closed after closing date'});
        return;
    }

    await dbsrv.mongo_reservations().updateOne({'_id': ObjectID.createFromHexString(req.params.id)}, {
        '$set': {'over': true}
    });
    res.send({message: 'Reservation cancelled'});
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
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        return;
    }
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        return;
    }
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
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
        return;
    }

    try {
        tpssrv.remove_tp_reservation(reservation);
    } catch (error) {
        logger.error(error);
        res.status(500).send({message: 'Error while removing tp reservation'});
        return;
    }
    res.send({message: 'Reservation closed'});
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
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        return;
    }
    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        return;
    }
    if(! (is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
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
        return;
    }
    if (reservation.to < new Date().getTime()) {
        res.status(403).send({message: 'End date can not be in the past'});
        return;
    }

    let newresa;
    try {
        newresa = await tpssrv.create_tp_reservation(reservation_id, 'auto');
    } catch (error) {
        logger.error(error);
        res.status(500).send({message: 'Error while creating tp reservation'});
        return;
    }
    logger.debug('set reservation as done', newresa);
    newresa.created = true;
    res.send({reservation: newresa});
});

router.put('/tp/:id/reserve/extend', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }
    if(! req.body.to) {
        res.status(403).send({message: 'No input'});
        return;
    }
    if(! sansrv.sanitizeAll([req.params.id])) {
        res.status(403).send({message: 'Invalid parameters'});
        return;
    }

    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({'_id': req.locals.logInfo.id});
        is_admin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        return;
    }

    if(!user) {
        res.status(404).send({message: 'User does not exist'});
        return;
    }

    if(!is_admin) {
        res.status(403).send({message: 'Not authorized'});
        return;
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
    let reservation = await dbsrv.mongo_reservations().findOne({_id: reservation_id});
    if(!reservation){
        res.status(404).send({message: 'Reservation does not exist'});
        return;
    }
    if (req.body.to < reservation.to) {
        res.status(403).send({message: 'Extended end date must be after current end date'});
        return;
    }
    if (req.body.to < new Date().getTime()) {
        res.status(403).send({message: 'Extended end date can not be in the past'});
        return;
    }

    if (req.body.expire) {
        if (req.body.expire < reservation.expire) {
            res.status(403).send({message: 'Extended expiration date must be after current end date'});
            return;
        }
        if (req.body.expire < new Date().getTime()) {
            res.status(403).send({message: 'Extended expiration date can not be in the past'});
            return;
        }
    }

    try {
        tpssrv.extend_tp_reservation(reservation, req.body);
    } catch (error) {
        logger.error(error);
        res.status(500).send({message: 'Error while extending tp reservation'});
        return;
    }

    res.send({message: 'Reservation extended'});
});

module.exports = router;
