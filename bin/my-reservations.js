/* eslint-disable no-console */
/*
 * CLI to manage reservations
 */
const program = require('commander');

const ObjectID = require('mongodb').ObjectID;

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const winston = require('winston');
const myconsole = new (winston.transports.Console)({
    timestamp: true,
    level: 'info'
});
winston.loggers.add('gomngr', {
    transports: [myconsole]
});

const logger = winston.loggers.get('gomngr');

const tpssrv = require('../core/tps.service.js');

if (!console.table){
    require('console.table');
}

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
        tpssrv.exec_tp_reservation(reservation._id, 'auto').then(function(res){
            logger.debug('set reservation as done', res);
            dbsrv.mongo_reservations().updateOne({'_id': res._id},{'$set': {'created': true}}).then(function(){
                resolve(res);
            });
        });
    });
};

function createReservations(rid) {
    var now = new Date();
    var create_before = now;
    create_before.setDate(create_before.getDate() + 5);
    let filter = {};
    if (rid !== null) {
        filter = {
            '_id': ObjectID.createFromHexString(rid),
            'created': false,
            'over': false
        };
    } else {
        logger.info('Check coming reservations');
        filter = {
            'from': {'$lte': create_before.getTime()},
            'created': false,
            'over': false
        };
    }
    dbsrv.mongo_reservations().find(filter).toArray().then(function(reservations){
        if(reservations === undefined || reservations.length == 0){
            logger.info('No pending reservation');
            process.exit(0);
        }
        processArray(reservations, processReservation).then(function(){
            process.exit(0);
        });
    });
}

function removeReservations(rid) {
    var now = new Date();
    var ended_after = now;
    ended_after = new Date(ended_after.getFullYear(), ended_after.getMonth(), ended_after.getDate() - CONFIG.tp.extra_expiration);
    let filter = {};
    if (rid !== null) {
        filter = {
            '_id': ObjectID.createFromHexString(rid),
            'created': true,
            'over': false
        };
    }
    else {
        filter = {
            'to': {'$lte': ended_after.getTime()},
            'created': true,
            'over': false

        };
    }
    logger.info('[INFO] Check for ending reservations');
    dbsrv.mongo_reservations().find(filter).toArray().then(function(reservations){
        if(reservations === undefined || reservations.length == 0){
            console.log('[INFO] No pending reservation');
            process.exit(0);
        }
        Promise.all(reservations.map(function(reservation){
            console.log('[INFO] Delete accounts for reservation', reservation);
            console.log('[INFO] Reservation expired at ', new Date(reservation.to));
            Promise.all(reservation.accounts.map(function(user){
                return dbsrv.mongo_users().findOne({'uid': user});
            })).then(function(users){
                return tpssrv.delete_tp_users(users, reservation.group, 'auto');
            }).then(function(){
                console.log('[INFO] close reservation', reservations);
                Promise.all(reservations.map(function(reservation){
                    return dbsrv.mongo_reservations().updateOne({'_id': reservation._id},{'$set': {'over': true}});
                })).then(function(){
                    process.exit(0);
                });
            });
        })).then(
            (result) => {
                console.debug('something went wrong...', result);
                process.exit(1);
            }
        ).catch((err) => {
            console.error('an error occured', err);
            process.exit(1);
        });
    });
}

program
    .command('list') // sub-command name
    .description('List reservations') // command description
    .option('-i, --id [value]', 'identifier', null)
    .action(function (args) {
        let filter = {};
        if (args.id) {
            filter['_id'] = ObjectID.createFromHexString(args.id);
        }
        dbsrv.mongo_reservations().find(filter).toArray().then(function(reservations){
            let displayRes = [];
            for(let i=0;i<reservations.length;i++){
                let res = reservations[i];
                let opened = res.created;
                if (res.over) {
                    opened = false;
                }
                displayRes.push({'id': res._id, 'from': new Date(res.from), 'to': new Date(res.to), 'owner': res.owner, 'group': res.group ? res.group.name : '', 'opened': opened});
            }
            console.table(displayRes);
            process.exit(0);
        });
    });

program
    .command('remove') // sub-command name
    .description('Close and delete reservations if their end time is reached') // command description
    .option('-i, --id [value]', 'identifier of reservation to close (whatever end time)', null)
    .action(function (args) {
        removeReservations(args.id);
    });

program
    .command('create') // sub-command name
    .description('Start reservation and create accounts if starting in less than 5 days') // command description
    .option('-i, --id [value]', 'identifier of reservation to create (whatever start time)', null)
    .action(function (args) {
        createReservations(args.id);
    });

dbsrv.init_db().then(() => {
    plgsrv.load_plugins();
    // allow commander to parse `process.argv`
    program.parse(process.argv);
});
