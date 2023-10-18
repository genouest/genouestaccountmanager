const myldap = require('ldapjs');
const winston = require('winston');
const crypto = require('crypto');
const logger = winston.loggers.get('gomngr');
const b64_sha512crypt = require('sha512crypt-node').b64_sha512crypt;
const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

const filer = require('../core/file.js');

const dbsrv = require('../core/db.service.js');
//const { config } = require('chai');

function crypt_password(password) {
    let salt = crypto.randomBytes(32).toString('hex').slice(0,16);
    let hash = b64_sha512crypt(password, salt);
    return `{crypt}${hash}`;
}

function get_group_dn(group) {
    return new Promise( function (resolve, reject) {
        // todo: factorize with get_user_dn
        let client = myldap.createClient({
            url: 'ldap://' +  CONFIG.ldap.host
        });
        client.bind(CONFIG.ldap.admin_cn + ',' + CONFIG.ldap.admin_dn, CONFIG.ldap.admin_password, function(err) {
            if(err) {
                logger.error('Failed to bind as admin to ldap', err);
                reject(err);
                return;
            }
        });

        let group_dn_list = [];

        let opts = {
            filter: '(cn=' + group + ')',
            scope: 'sub',
            attributes: ['dn']
        };

        client.search('ou=groups,' + CONFIG.ldap.dn, opts, function(err, res) {
            if(err) {
                logger.error('Could not find ' + group, err);
                reject(err);
                return;
            }

            res.on('searchEntry', function(entry) {
                logger.info('dn found: ', entry.object['dn'].trim(), ' for ', group);
                group_dn_list.push(entry.object['dn'].trim());
            });
            res.on('error', function(err) {
                logger.error('error ', err);
                reject(err);
                return;
            });
            // eslint-disable-next-line no-unused-vars
            res.on('end', function(result) {
                let default_dn = 'cn=' + group + ',ou=groups,' + CONFIG.ldap.dn;

                if (group_dn_list.length > 1) {
                    logger.error('more than one entry have been found', group_dn_list);
                    logger.warn('switch to default value, you should check your ldap database and scripts logs results...');
                    dbsrv.mongo_events().insertOne({'owner': CONFIG.general.admin[0] , 'date': new Date().getTime(), 'action': '[error] find duplicate group dn for ' + group, 'status' : -1});
                    // resolve with default value, or reject ?
                    resolve(default_dn);
                    return;
                }
                else if(group_dn_list.length == 0){
                    logger.warn('no group found for', group);
                    // resolve with default value, or reject ?
                    // Needed if group is not already created, for example on empty database when admin group is created, or when config option auto_add_group is set to true
                    resolve(default_dn);
                    return;
                }
                // must have only one entry
                resolve(group_dn_list[0]);
                return;
            });
        });
    });
}

function get_user_dn(user) {
    return new Promise( function (resolve, reject) {
        // todo: factorize with bind exported function
        // todo: find if it is a good idea, as uid may not be unique ... but dn are ... Or maybe for uid unicity on ldap import ...
        // maybe add the email as filter too (or another)
        // todo: find other impact of "do not use uid in dn" on other part of this file, for example on bind and on group modification

        let client = myldap.createClient({
            url: 'ldap://' +  CONFIG.ldap.host
        });
        client.bind(CONFIG.ldap.admin_cn + ',' + CONFIG.ldap.admin_dn, CONFIG.ldap.admin_password, function(err) {
            if(err) {
                logger.error('Failed to bind as admin to ldap', err);
                reject(err);
                return;
            }
        });

        let user_dn_list = [];

        let opts = {
            filter: '(uid=' + user.uid + ')',
            scope: 'sub',
            attributes: ['dn']
        };

        client.search('ou=people,' + CONFIG.ldap.dn, opts, function(err, res) {
            if(err) {
                logger.error('Could not find ' + user.uid, err);
                reject(err);
                return;
            }

            res.on('searchEntry', function(entry) {
                logger.info('dn found: ', entry.object['dn'].trim(), ' for ', user.uid);
                user_dn_list.push(entry.object['dn'].trim());
            });
            res.on('error', function(err) {
                logger.error('error ', err);
                reject(err);
                return;
            });
            // eslint-disable-next-line no-unused-vars
            res.on('end', function(result) {
                if (user_dn_list.length > 1) {
                    logger.warn('more than one entry have been found', user_dn_list);
                }
                else if(user_dn_list.length == 0){
                    logger.error('no user found for uid', user.uid);
                    reject('no user found for uid');
                    return;
                }
                resolve(user_dn_list[0]);
                return;
            });
        });
    });
}

module.exports = {

    reset_password: function(updated_user, fid){
        let user = {...updated_user};
        return new Promise(function(resolve, reject){
            if(CONFIG.ldap.crypt) {
                user.password = crypt_password(user.password);
            }
            get_user_dn(user)
                .then(
                    user_dn => { // resolve()
                        return filer.ldap_reset_password(user, user_dn, fid);
                    })
                .then(
                    created_file => {
                        logger.info('File Created: ', created_file);
                        resolve();
                    })
                .catch(error => { // reject()
                    logger.error('Password not updated for: '+ user.uid, error);
                    reject(error);
                });
        });
    },

    bind: function(uid, password) {
        return new Promise(function(resolve, reject){
            let client = myldap.createClient({
                url: 'ldap://' +  CONFIG.ldap.host
            });
            client.bind(CONFIG.ldap.admin_cn + ',' + CONFIG.ldap.admin_dn, CONFIG.ldap.admin_password, function(err) {
                if(err) {
                    logger.error('Failed to bind as admin to ldap', err);
                    reject(err);
                    return;
                }
                let opts = {
                    filter: '(uid=' + uid + ')',
                    scope: 'sub',
                    attributes: ['dn']
                };

                client.search('ou=people,' + CONFIG.ldap.dn, opts, function(err, res) {
                    if(err) {
                        logger.error('Could not find ' + uid, err);
                        reject(err);
                        return;
                    }
                    let foundMatch = false;
                    res.on('searchEntry', function(entry) {
                        let user_dn = entry.object['dn'];
                        foundMatch = true;
                        client.bind(user_dn, password, function(err) {
                            if(err) {
                                reject(err);
                                return;
                            }
                            resolve(err);
                        });
                    });
                    // eslint-disable-next-line no-unused-vars
                    res.on('searchReference', function(referral) {
                    });
                    res.on('error', function(err) {
                        logger.error('error ', err);
                        reject(err);
                    });
                    // eslint-disable-next-line no-unused-vars
                    res.on('end', function(result) {
                        if(! foundMatch){
                            reject('no user found');
                        }
                    });
                });
            });
        });

    },


    modify: function(user, fid) {
        return new Promise(function(resolve, reject){
            if(! user.is_fake && (user.firstname == '' || user.lastname == '')) {
                logger.debug('firstname or lastname empty');
                reject();
                return;
            }

            get_user_dn(user)
                .then(
                    user_dn => { // resolve()
                        return filer.ldap_modify_user(user, user_dn, fid);
                    })
                .then(
                    created_file => {
                        logger.info('File Created: ', created_file);
                        resolve();
                    })
                .catch(error => { // reject()
                    logger.error('Modify Failed for: ' + user.uid, error);
                    reject(error);
                });
        });
    },

    add_group: function(group, fid) {
        return new Promise(function(resolve, reject){
            filer.ldap_add_group(group, fid)
                .then(
                    created_file => {
                        logger.info('File Created: ', created_file);
                        resolve();
                    })
                .catch(error => { // reject()
                    logger.error('Add Group Failed for: ' + group.name, error);
                    reject(error);
                });
        });
    },

    delete_group: function(group, fid) {
        return new Promise(function(resolve, reject){
            get_group_dn(group.name)
                .then(
                    group_dn => { // resolve()
                        return filer.ldap_delete_group(group, group_dn, fid);
                    })
                .then(
                    created_file => {
                        logger.info('File Created: ', created_file);
                        resolve();
                    })
                .catch(error => { // reject()
                    logger.error('Delete Group Failed for: ' + group.name, error);
                    reject(error);
                });
        });
    },

    add: async function(new_user, fid) {
        let user = {...new_user};
        let group = null;
        if (!CONFIG.general.disable_user_group) {
            try {
                group = await dbsrv.mongo_groups().findOne({'name': user.group});
            } catch(e) {
                logger.error(e);
                throw e;
            }
        }
        if(CONFIG.ldap.crypt) {
            user.password = crypt_password(user.password);
        }
        try {
            let created_file = await filer.ldap_add_user(user, group, fid);
            logger.debug('File created', created_file);

            if (group) {
                let group_dn = await get_group_dn(group.name);
                created_file = await filer.ldap_add_user_to_group(user,group_dn, fid);
                logger.debug('File created', created_file);
            }


        } catch(error) {
            logger.error('Add User Failed for: ' + user.uid, error);
            throw error;
        }
        return true;
    },

    change_user_groups: function(user, group_add, group_remove, fid) {
        return new Promise(function(resolve, reject){

            // Todo: change_user_groups should not managed 2 array of group as it is mostly never usefull and it is not so easy with promise and async ...
            // https://flaviocopes.com/javascript-async-await-array-map/

            let prm_add = group_add.map((group) => {
                return get_group_dn(group)
                    .then(group_dn => { return group_dn; })
                    .catch(error => { logger.error('Get Dn to Add Failed for: ' + group, error);});
            });

            let prm_remove = group_remove.map((group) => {
                return get_group_dn(group)
                    .then(group_dn => { return group_dn; })
                    .catch(error => { logger.error('Get Dn to Remove Failed for: ' + group, error);});
            });


            Promise.all(prm_add).then(
                group_add_dn => {
                    //logger.info( 'To add: ', group_add_dn);
                    Promise.all(prm_remove).then(
                        group_remove_dn => {
                            // logger.info( 'To remove: ', group_remove_dn);

                            filer.ldap_change_user_groups(user, group_add_dn, group_remove_dn, fid)
                                .then(
                                    created_file => {
                                        logger.info('File Created: ', created_file);
                                        resolve();
                                    })
                                .catch(error => { // reject()
                                    logger.error('User Group Change Failed for: ' + user.uid, error);
                                    reject(error);
                                });
                        });
                });
        });
    },
};
