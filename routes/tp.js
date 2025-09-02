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

router.get('/tp', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    let reservations = await dbsrv.mongo_reservations().find({}).toArray();
    return res.send(reservations);
});

router.post('/tp', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (!(is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        return res.status(403).send({ message: 'Not authorized' });
    }
    if (req.body.quantity === undefined || req.body.quantity === null || req.body.quantity <= 0) {
        return res.status(403).send({ message: 'Quantity must be >= 1' });
    }
    if (req.body.about === undefined || req.body.about == '') {
        return res.status(403).send({ message: 'Tell us why you need some tp accounts' });
    }
    tpssrv
        .tp_reservation(
            user.uid,
            req.body.from,
            req.body.to,
            req.body.quantity,
            req.body.about,
            req.body.group_or_project,
            req.body.name
        )
        .then(function (reservation) {
            return res.send({ reservation: reservation, message: 'Reservation done' });
        });
});

router.get('/tp/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(403).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (!(is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        return res.status(403).send({ message: 'Not authorized' });
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
    let filter = {};
    if (is_admin) {
        filter = { _id: reservation_id };
    } else {
        filter = { _id: reservation_id, owner: user.uid };
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if (!reservation) {
        return res.status(403).send({ message: 'Not allowed to get this reservation' });
    }
    return res.send({ reservation: reservation });
});

router.delete('/tp/:id', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(403).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (!(is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        return res.status(403).send({ message: 'Not authorized' });
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
    let filter = {};
    if (is_admin) {
        filter = { _id: reservation_id };
    } else {
        filter = { _id: reservation_id, owner: user.uid };
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if (!reservation) {
        return res.status(403).send({ message: 'Not allowed to delete this reservation' });
    }
    if (reservation.over) {
        return res.status(403).send({ message: 'Reservation is already closed' });
    }
    if (reservation.created) {
        return res.status(403).send({
            message: 'Reservation accounts already created, reservation will be closed after closing date'
        });
    }

    await dbsrv.mongo_reservations().updateOne(
        { _id: ObjectID.createFromHexString(req.params.id) },
        {
            $set: { over: true }
        }
    );
    return res.send({ message: 'Reservation cancelled' });
});

router.put('/tp/:id/reserve/stop', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(403).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (!(is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        return res.status(403).send({ message: 'Not authorized' });
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
    let filter = {};
    if (is_admin) {
        filter = { _id: reservation_id };
    } else {
        filter = { _id: reservation_id, owner: user.uid };
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if (!reservation) {
        return res.status(403).send({ message: 'Not allowed to delete this reservation' });
    }

    try {
        tpssrv.remove_tp_reservation(reservation);
    } catch (error) {
        logger.error(error);
        return res.status(500).send({ message: 'Error while removing tp reservation' });
    }
    return res.send({ message: 'Reservation closed' });
});

router.put('/tp/:id/reserve/now', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(403).send({ message: 'Not authorized' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }
    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }
    if (!(is_admin || (user.is_trainer !== undefined && user.is_trainer))) {
        return res.status(403).send({ message: 'Not authorized' });
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
    let filter = {};
    if (is_admin) {
        filter = { _id: reservation_id };
    } else {
        filter = { _id: reservation_id, owner: user.uid };
    }
    let reservation = await dbsrv.mongo_reservations().findOne(filter);
    if (!reservation) {
        return res.status(403).send({ message: 'Not allowed to reserve now this reservation' });
    }
    if (reservation.to < new Date().getTime()) {
        return res.status(403).send({ message: 'End date can not be in the past' });
    }

    let newresa;
    try {
        newresa = await tpssrv.create_tp_reservation(reservation_id, 'auto');
    } catch (error) {
        logger.error(error);
        return res.status(500).send({ message: 'Error while creating tp reservation' });
    }
    logger.debug('set reservation as done', newresa);
    newresa.created = true;
    return res.send({ reservation: newresa });
});

router.put('/tp/:id/reserve/extend', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        return res.status(403).send({ message: 'Not authorized' });
    }
    if (!req.body.to) {
        return res.status(403).send({ message: 'No input' });
    }
    if (!sansrv.sanitizeAll([req.params.id])) {
        return res.status(403).send({ message: 'Invalid parameters' });
    }

    let user = null;
    let is_admin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        is_admin = await rolsrv.is_admin(user);
    } catch (e) {
        logger.error(e);
        return res.status(404).send({ message: 'User session not found' });
    }

    if (!user) {
        return res.status(404).send({ message: 'User does not exist' });
    }

    if (!is_admin) {
        return res.status(403).send({ message: 'Not authorized' });
    }

    let reservation_id = ObjectID.createFromHexString(req.params.id);
    let reservation = await dbsrv.mongo_reservations().findOne({ _id: reservation_id });
    if (!reservation) {
        return res.status(404).send({ message: 'Reservation does not exist' });
    }
    if (req.body.to < reservation.to) {
        return res.status(403).send({ message: 'Extended end date must be after current end date' });
    }
    if (req.body.to < new Date().getTime()) {
        return res.status(403).send({ message: 'Extended end date can not be in the past' });
    }

    try {
        tpssrv.extend_tp_reservation(reservation, req.body);
    } catch (error) {
        logger.error(error);
        return res.status(500).send({ message: 'Error while extending tp reservation' });
    }

    return res.send({ message: 'Reservation extended' });
});

module.exports = router;
