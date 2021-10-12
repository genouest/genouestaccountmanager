// const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_users = null;
var mongo_oldusers = null;
var mongo_groups = null;
var mongo_oldgroups = null;
var mongo_events = null;
var mongo_reservations = null;
var mongo_databases = null;
var mongo_web = null;
var mongo_projects = null;
var mongo_tags = null;
var mongo_pending_projects = null;
var mongo_bills = null;
var mongo_prices = null;

var mongo_connect = async function() {
    let url = CONFIG.mongo.url;
    let client = null;
    if(!url) {
        client = new MongoClient(`mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}`, { useNewUrlParser: true, useUnifiedTopology: true });
    } else {
        client = new MongoClient(CONFIG.mongo.url, { useNewUrlParser: true, useUnifiedTopology: true });
    }
    await client.connect();
    mongodb = client.db(CONFIG.general.db);
    mongo_users = mongodb.collection('users');
    mongo_oldusers = mongodb.collection('old_users');
    mongo_groups = mongodb.collection('groups');
    mongo_oldgroups = mongodb.collection('old_groups');
    mongo_events = mongodb.collection('events');
    mongo_reservations = mongodb.collection('reservations');
    mongo_databases = mongodb.collection('databases');
    mongo_web = mongodb.collection('web');
    mongo_projects = mongodb.collection('projects');
    mongo_tags = mongodb.collection('tags');
    mongo_pending_projects = mongodb.collection('pending_projects');
    mongo_bills = mongodb.collection('bills');
    mongo_prices = mongodb.collection('prices');
};
// mongo_connect();

exports.init_db = async function() {
    logger.info('initialize db connection');
    try {
        if(mongodb != null) {
            return null;
        }
        await mongo_connect();
        logger.info('connected');
        return null;
    } catch(err){
        logger.debug('Failed to init db', err);
        return err;
    }
};
exports.mongodb = mongodb;
exports.mongo_users = function() {return mongo_users;};
exports.mongo_groups = function() {return mongo_groups;};
exports.mongo_events = function() {return mongo_events;};
exports.mongo_reservations = function() {return mongo_reservations;};
exports.mongo_databases = function() {return mongo_databases;};
exports.mongo_web = function() {return mongo_web;};
exports.mongo_projects = function() {return mongo_projects;};
exports.mongo_tags = function() {return mongo_tags;};
exports.mongo_pending_projects = function() {return mongo_pending_projects;};
exports.mongo_oldusers = function() {return mongo_oldusers;};
exports.mongo_oldgroups = function() {return mongo_oldgroups;};
exports.mongo_bills = function() {return mongo_bills;};
exports.mongo_prices = function() {return mongo_prices;};
