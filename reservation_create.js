var Promise = require('promise');

var CONFIG = require('config');

var tps = require('./routes/tp.js');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users'),
    reservation_db = db.get('reservations');

var winston = require('winston');
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
    return new Promise(function (resolve, reject){
            logger.info("create user for reservation ", reservation);
            tps.exec_tp_reservation(reservation._id, 'auto').then(function(res){
                logger.debug("set reservation as done", res);
                reservation_db.update({'_id': res._id},{'$set': {'created': true}}).then(function(){
                    resolve(res);
                })
            });
    });
}


var now = new Date();
var create_before = now;
create_before.setDate(create_before.getDate() + 5);

logger.info("Check coming reservations");
reservation_db.find({
    'from': {'$lte': create_before.getTime()},
    'created': false,
    'over': false

}).then(function(reservations){
    if(reservations === undefined || reservations.length == 0){
        logger.info("No pending reservation");
        process.exit(0);
    }

    processArray(reservations, processReservation).then(function(res){
        process.exit(0);
    });

});
