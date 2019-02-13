/*
* CLI to manage reservations
*/
const program = require('commander')

var CONFIG = require('config')
var monk = require('monk')
var db = monk(CONFIG.mongo.host + ':' + CONFIG.mongo.port + '/' + CONFIG.general.db)
var reservation_db = db.get('reservations')
var users_db = db.get('users')

var winston = require('winston')
const myconsole = new (winston.transports.Console)({
  timestamp: true,
  level: 'info'
})
winston.loggers.add('gomngr', {
  transports: [myconsole]
})

const logger = winston.loggers.get('gomngr')

var tps = require('./routes/tp.js')

if (!console.table){
  require('console.table')
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

function createReservations(rid) {
    var now = new Date();
    var create_before = now;
    create_before.setDate(create_before.getDate() + 5);
    if (rid !== null) {
      filter = {
        '_id': rid,
        'created': false,
        'over': false
        }
    } else {
      logger.info("Check coming reservations");
      filter = {
        'from': {'$lte': create_before.getTime()},
        'created': false,
        'over': false
      }
    }
    reservation_db.find(filter).then(function(reservations){
      if(reservations === undefined || reservations.length == 0){
        logger.info("No pending reservation");
        process.exit(0);
      }
      processArray(reservations, processReservation).then(function(res){
        process.exit(0);
      });
    });    
}

function removeReservations(rid) {
    var now = new Date();
    var ended_after = now;
    ended_after = new Date(ended_after.getFullYear(), ended_after.getMonth(), ended_after.getDate() - CONFIG.tp.extra_expiration);

    if (rid !== null) {
        filter = {
            '_id': rid,
            'created': true,
            'over': false
        }
    }
    else {
        filter = {
            'to': {'$lte': ended_after.getTime()},
            'created': true,
            'over': false
    
        }
    }
    logger.info("[INFO] Check for ending reservations");
    reservation_db.find(filter).then(function(reservations){
        if(reservations === undefined || reservations.length == 0){
            console.log("[INFO] No pending reservation");
            process.exit(0);
        }
        Promise.all(reservations.map(function(reservation){
            console.log("[INFO] Delete accounts for reservation", reservation);
            console.log("[INFO] Reservation expired at ", new Date(reservation.to));
            Promise.all(reservation.accounts.map(function(user){
                return users_db.findOne({'uid': user});
            })).then(function(users){
                return tps.delete_tp_users(users, reservation.group, 'auto');
            }).then(function(){
                console.log("[INFO] close reservation", reservations);
                Promise.all(reservations.map(function(reservation){
                    return reservation_db.update({'_id': reservation._id},{'$set': {'over': true}})
                })).then(function(){
                    process.exit(0);
                });
            });
        }));
});
}

program
  .command('list') // sub-command name
  .description('List reservations') // command description
  .option('-i, --id [value]', 'identifier', null)
  .action(function (args) {
    filter = {}
    if (args.id) {
        filter['_id'] = args.id
    }
    reservation_db.find(filter).then(function(reservations){
      displayRes = []
      for(let i=0;i<reservations.length;i++){
        let res = reservations[i]
        let opened = res.created;
        if (res.over) {
          opened = false;
        }
        displayRes.push({'id': res._id, 'from': new Date(res.from), 'to': new Date(res.to), 'owner': res.owner, 'group': res.group ? res.group.name : '', 'opened': opened})
      }
      console.table(displayRes)
      process.exit(0)
    })
  })

program
  .command('remove') // sub-command name
  .description('Close and delete reservations if their end time is reached') // command description
  .option('-i, --id [value]', 'identifier of reservation to close (whatever end time)', null)
  .action(function (args) {
    removeReservations(args.id)
  })

  program
  .command('create') // sub-command name
  .description('Start reservation and create accounts if starting in less than 5 days') // command description
  .option('-i, --id [value]', 'identifier of reservation to create (whatever start time)', null)
  .action(function (args) {
    createReservations(args.id)
  })  

// allow commander to parse `process.argv`
program.parse(process.argv);