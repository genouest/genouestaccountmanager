const express = require('express');
let router = express.Router();
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

// const cfgsrv = require('../core/config.service.js');
// let my_conf = cfgsrv.get_conf();
// const CONFIG = my_conf;

const rolsrv = require('../core/role.service.js');
const dbsrv = require('../core/db.service.js');
const bilsrv = require('../core/billing.service.js');
// const sansrv = require('../core/sanitize.service.js');


// get all price
router.get('/price/', async function(req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    if (req.query.all == 'true') {
        let prices = await dbsrv.mongo_prices().find({}).toArray();
        res.send(prices);
        return;
    }

    let prices =  await dbsrv.mongo_prices().find({enable: true}).toArray();
    res.send(prices);
    return;

});

// create a price
router.post('/price/', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    try {
        await bilsrv.create_price({
            'label': req.body.label,
            'size': req.body.size,
            'cpu':  req.body.cpu,
            'period':  req.body.period,
            'value': req.body.value,
            'enable': true
        }, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }
    res.send({message: 'Price Added'});


});

// update a price
router.post('/price/:uuid/:state', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let price = await dbsrv.mongo_prices().findOne({'uuid': req.params.uuid});
    if(!price){
        res.status(404).send({message: 'Price not found'});
        return;
    }
    // todo use constant
    if (req.params.state == 'false') {
        price.enable = false;
    } else if (req.params.state == 'true') {
        price.enable = true;
    } else {
        res.status(401).send({message: 'Invalid State: ' + req.params.state});
        return;
    }

    try {
        await bilsrv.update_price(req.params.uuid, price, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }
    res.send({message: 'Price Updated'});
});

// delete a price
router.delete('/price/:uuid', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }
    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let price = await dbsrv.mongo_prices().findOne({'uuid': req.params.uuid});
    if(!price){
        res.status(404).send({message: 'Price not found'});
        return;
    }

    try {
        await bilsrv.delete_price(req.params.uuid, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }
    res.send({message: 'Price Deleted'});
});


// get one bill
router.get('/bill/:uuid', async function(req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    let bill = await dbsrv.mongo_bills().findOne({'uuid': req.params.uuid});

    if (! bill){
        logger.error('failed to get bill', req.params.uuid);
        res.status(404).send({message: 'Bill ' + req.params.uuid + ' not found'});
        return;
    }

    if (bill.owner == user.uid || isadmin) {
        res.send(bill);
        return;
    }
    // else
    res.status(404).send({message: 'Bill ' + req.params.uuid + ' not found'});
});


// get all bill
router.get('/bill/', async function(req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    if (req.query.all == 'true' && isadmin){
        let bills = await dbsrv.mongo_bills().find({}).toArray();
        res.send(bills);
        return;
    }

    let bills = await dbsrv.mongo_bills().find({owner: user.uid}).toArray();
    res.send(bills);
    return;


});

// create a bill
router.post('/bill/', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    try {
        await bilsrv.create_bill({
            'name': req.body.name,
            'owner': req.body.owner,
            'price': req.body.price,
            'orga': req.body.orga,
            'description': req.body.description
        }, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }
    res.send({message: 'Bill Added'});
});

// update a bill
router.post('/bill/:uuid', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let bill = await dbsrv.mongo_bills().findOne({'uuid': req.params.uuid});
    if(!bill){
        res.status(404).send({message: 'Bill not found'});
        return;
    }

    try {
        await bilsrv.update_bill(req.params.uuid, {
            'name': req.body.name,
            'owner': req.body.owner,
            'price': req.body.price,
            'size': req.body.size,
            'cpu': req.body.cpu,
            'period': req.body.period,
            'created_at': req.body.created_at,
            'validate_at': req.body.validate_at,
            'expire_at': req.body.expire_at,
            'description': req.body.description,
            'orga': req.body.orga,
            'status': req.body.status
        }, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }

});

// delete a bill
router.delete('/bill/:uuid', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    if(!isadmin){
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let bill = await dbsrv.mongo_bills().findOne({'uuid': req.params.uuid});
    if(!bill) {
        res.status(404).send({message: 'Bill not found'});
        return;
    }

    try {
        await bilsrv.delete_bill(req.params.uuid, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }
    res.send({message: 'Bill Deleted'});
});


// add a project to bill
router.post('/bill/:uuid/project/:project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    let bill = await dbsrv.mongo_bills().findOne({'uuid': req.params.uuid});
    if(!bill) {
        res.status(404).send({message: 'Bill not found'});
        return;
    }

    let project = await dbsrv.mongo_projects().findOne({'id': req.params.project});
    if (!project){
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }

    if (!isadmin && bill.owner != user.uid) {
        res.status(401).send('Not authorized');
        return;
    }

    try {
        await bilsrv.add_project_to_bill(req.params.uuid, req.params.project, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }

    res.send({message: 'Project Added'});

});

// remove a project from bill
router.delete('/bill/:uuid/project/:project', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    let bill = await dbsrv.mongo_bills().findOne({'uuid': req.params.uuid});
    if(!bill) {
        res.status(404).send({message: 'Bill not found'});
        return;
    }

    let project = await dbsrv.mongo_projects().findOne({'id': req.params.project});
    if (!project){
        res.status(404).send({message: 'Project ' + req.params.id + ' not found'});
        return;
    }

    if (!isadmin && bill.owner != user.uid) {
        res.status(401).send('Not authorized');
        return;
    }

    try {
        await bilsrv.remove_project_from_bill(req.params.uuid, req.params.project, user.uid);
    } catch(e) {
        logger.error(e);
        if (e.code && e.message) {
            res.status(e.code).send({message: e.message});
            res.end();
            return;
        } else {
            res.status(500).send({message: 'Server Error, contact admin'});
            res.end();
            return;
        }
    }

    res.send({message: 'Project Removed'});

});

// get list of project in bill
router.get('/bill/:uuid/projects', async function (req, res) {
    if (!req.locals.logInfo.is_logged) {
        res.status(401).send('Not authorized');
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({ _id: req.locals.logInfo.id });
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if (!user) {
        res.status(404).send('User not found');
        return;
    }

    let bill = null;

    if (isadmin){
        bill = await dbsrv.mongo_bills().findOne({uuid: req.params.uuid});
    } else {
        bill = await dbsrv.mongo_bills().findOne({uuid: req.params.uuid, owner: user.uid});
    }

    if (!bill) {
        res.send([]);
        return;
    }

    let projects = await dbsrv.mongo_projects().find({ id: { $in: bill.projects } }).toArray();
    res.send(projects);
    return;
});

module.exports = router;
