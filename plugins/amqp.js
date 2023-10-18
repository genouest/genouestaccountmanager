/* eslint-disable no-console */
const Promise = require('promise');
const amqp = require('amqplib');
const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;


// eslint-disable-next-line no-unused-vars
var sendMsg = function(action, userId, data, adminId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        let conn = null;
        amqp.connect(CONFIG.rabbitmq.url).then(function(_conn) {
            conn = _conn;
            return conn.createChannel();
        }).then(ch => {
            return ch.assertExchange(CONFIG.rabbitmq.exchange, 'direct').then(() => {
                console.log('publish msg');
                ch.publish(CONFIG.rabbitmq.exchange, action, Buffer.from(JSON.stringify(data)));
                return ch.close();
            });
        })
            .then(() => {
                conn.close();
                resolve(true);
            });

    });
};

module.exports = {

    activate: function (userId, data, adminId){
        if(! CONFIG.rabbitmq || ! CONFIG.rabbitmq.url) {
            // eslint-disable-next-line no-unused-vars
            return new Promise(function (resolve, reject){
                console.log('Plugin amqp, nothing to do');
                resolve(true);
            }); 
        }
        console.log('Plugin amqp for activation of user : ' + userId);
        return sendMsg('activate', userId, data, adminId);
    },
    deactivate: function (userId, data, adminId){
        if(! CONFIG.rabbitmq || ! CONFIG.rabbitmq.url) {
            // eslint-disable-next-line no-unused-vars
            return new Promise(function (resolve, reject){
                console.log('Plugin amqp, nothing to do');
                resolve(true);
            }); 
        }        
        console.log('Plugin amqp for deactivation of user : ' + userId);
        return sendMsg('deactivate', userId, data, adminId);
    },
    // eslint-disable-next-line no-unused-vars
    get_data: function (userId, adminId){
        // eslint-disable-next-line no-unused-vars
        return new Promise(function (resolve, reject){
            console.log('Plugin amqp, nothing to do');
            resolve(true);
        });
    },
    set_data: function (userId, data, adminId){
        if(! CONFIG.rabbitmq || ! CONFIG.rabbitmq.url) {
            // eslint-disable-next-line no-unused-vars
            return new Promise(function (resolve, reject){
                console.log('Plugin amqp, nothing to do');
                resolve(true);
            }); 
        }
        return sendMsg('update', userId, data, adminId);
    },
    remove: function (userId, data, adminId){
        if(! CONFIG.rabbitmq || ! CONFIG.rabbitmq.url) {
            // eslint-disable-next-line no-unused-vars
            return new Promise(function (resolve, reject){
                console.log('Plugin amqp, nothing to do');
                resolve(true);
            }); 
        }
        console.log('Plugin amqp for removal of user : ' + userId);
        return sendMsg('remove', userId, data, adminId);
    }
};

