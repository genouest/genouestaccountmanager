/* eslint-disable no-console */
var Promise = require('promise');

var CONFIG = require('config');

var tps = require('./routes/tp.js');

/*
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users'),
    reservation_db = db.get('reservations');
*/
const MongoClient = require('mongodb').MongoClient;
var mongodb = null;
var mongo_reservations = null;
var mongo_users = null;
var ObjectID = require('mongodb').ObjectID;

var mongo_connect = async function() {
    let url = CONFIG.mongo.url;
    let client = null;
    if(!url) {
        client = new MongoClient(`mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}`);
    } else {
        client = new MongoClient(CONFIG.mongo.url);
    }
    await client.connect();
    mongodb = client.db(CONFIG.general.db);
    mongo_reservations = mongodb.collection('reservations');
    mongo_users = mongodb.collection('users');
};

var winston = require('winston');
const myconsole = new (winston.transports.Console)({
    timestamp: true,
    level: 'info'
});
winston.loggers.add('gomngr', {
    transports: [myconsole]
});
const logger = winston.loggers.get('gomngr');


var now = new Date();
var ended_after = now;
ended_after = new Date(ended_after.getFullYear(), ended_after.getMonth(), ended_after.getDate() - CONFIG.tp.extra_expiration);

logger.info('[INFO] Check expiring reservations');
mongo_connect().then(()=>{
    mongo_reservations.find({
        'to': {'$lte': ended_after.getTime()},
        'created': true,
        'over': false

    }).toArray().then(function(reservations){
        if(reservations === undefined || reservations.length == 0){
            console.log('[INFO] No expired reservation');
            process.exit(0);
        }
        Promise.all(reservations.map(function(reservation){
            console.log('[INFO] Delete accounts for reservation', reservation);
            console.log('[INFO] Reservation expired at ', new Date(reservation.to));
            Promise.all(reservation.accounts.map(function(user){
                return mongo_users.findOne({'uid': user});
            })).then(function(users){
                return tps.delete_tp_users(users, reservation.group, 'auto');
            }).then(function(){
                console.log('[INFO] close reservation', reservations);
                Promise.all(reservations.map(function(reservation){
                    return mongo_reservations.updateOne({'_id': reservation._id},{'$set': {'over': true}});
                })).then(function(){
                    process.exit(0);
                });
            });
        }));
    });
});
