const Promise = require('promise');

//const CONFIG = require('config');

const tpssrv = require('../core/tps.service.js');

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

/*
  function processArray(arr, fn) {
  return arr.reduce(
  (p, v) => p.then((a) => fn(v).then(r => a.concat([r]))),
  Promise.resolve([])
  );
  }*/

function processArray(arr, fn) {
    return arr.reduce(function (p, v) {
        return p.then(function (a) {
            return fn(v).then(function (r) {
                return a.concat([r]);
            });
        });
    }, Promise.resolve([]));
}

var processReservation = function(reservation){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        logger.info('create user for reservation ', reservation);
        tpssrv.create_tp_reservation(reservation._id, 'auto').then(function(res){
            resolve(res);
        });
    });
};


var now = new Date();
var create_before = now;
create_before.setDate(create_before.getDate() + 5);

logger.info('Check coming reservations');
dbsrv.init_db().then(()=> {
    plgsrv.load_plugins();
    dbsrv.mongo_reservations().find({
        'from': {'$lte': create_before.getTime()},
        'created': false,
        'over': false

    }).toArray().then(function(reservations){
        if(reservations === undefined || reservations.length == 0){
            logger.info('No pending reservation');
            process.exit(0);
        }

        // eslint-disable-next-line no-unused-vars
        processArray(reservations, processReservation).then(function(res){
            process.exit(0);
        });
    });
});
