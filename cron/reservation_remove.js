/* eslint-disable no-console */
const Promise = require('promise');

const CONFIG = require('config');

const tps = require('../routes/tp.js');

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');

const winston = require('winston');
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
dbsrv.init_db().then(()=>{
    plgsrv.load_plugins();
    dbsrv.mongo_reservations().find({
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
                return dbsrv.mongo_users().findOne({'uid': user});
            })).then(function(users){
                return tps.delete_tp_users(users, reservation.group, 'auto');
            }).then(function(){
                console.log('[INFO] close reservation', reservations);
                Promise.all(reservations.map(function(reservation){
                    dbsrv.mongo_events().insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'close reservation for ' + reservation.owner , 'logs': [] });
                    return dbsrv.mongo_reservations().updateOne({'_id': reservation._id},{'$set': {'over': true}});
                })).then(function(){
                    process.exit(0);
                });
            });
        }));
    });
});
