const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const Promise = require('promise');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

/* TODO Remove this */
const fdbs = require('../routes/database.js');
const fwebs = require('../routes/web.js');

const dbsrv = require('../core/db.service.js');
const usrsrv = require('../core/user.service.js');
const goldap = require('../core/goldap.js');
const filer = require('../core/file.js');
const idsrv = require('../core/id.service.js');
const maisrv = require('../core/mail.service.js');
const plgsrv = require('../core/plugin.service.js');
const grpsrv = require('../core/group.service.js');

// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
// eslint-disable-next-line no-unused-vars
var STATUS_EXPIRED = 'Expired';

exports.tp_reservation = tp_reservation;
exports.exec_tp_reservation = exec_tp_reservation;
exports.delete_tp_users = delete_tp_users;

async function createExtraGroup(ownerName) {
    let mingid = await idsrv.getGroupAvailableId();
    let group = await grpsrv.create_group('tp' + mingid, ownerName);
    return group;
}


async function deleteExtraGroup(group) {
    if (group === undefined || group === null) {
        return false;
    }
    let group_to_remove = await dbsrv.mongo_groups().findOne({'name': group.name});
    if(!group_to_remove) {
        return false;
    }
    let res = await grpsrv.delete_group(group);
    return res;
}


async function create_tp_users_db (owner, quantity, duration, end_date, userGroup) {
    // Duration in days
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        logger.debug('create_tp_users ', owner, quantity, duration);
        let minuid = 1000;

        let users = [];
        for(let i=0;i<quantity;i++) {
            logger.debug('create user ', CONFIG.tp.prefix + minuid);
            let user = {
                status: STATUS_PENDING_APPROVAL,
                uid: CONFIG.tp.prefix + minuid,
                firstname: CONFIG.tp.prefix,
                lastname: minuid,
                email: CONFIG.tp.prefix + minuid + '@fake.' + CONFIG.tp.fake_mail_domain,
                address: '',
                lab: '',
                responsible: owner,
                group: (CONFIG.general.disable_user_group) ? '' : userGroup.name,
                secondarygroups: (CONFIG.general.disable_user_group) ? [userGroup.name] : [],
                maingroup: CONFIG.general.default_main_group,
                home: '',
                why: 'TP/Training',
                ip: '',
                regkey: '',
                is_internal: false,
                is_fake: true,
                uidnumber: minuid,
                gidnumber: (CONFIG.general.disable_user_group) ? -1 : userGroup.gid,
                duration: duration,
                expiration: end_date + 1000*3600*24*(duration+CONFIG.tp.extra_expiration),
                loginShell: '/bin/bash',
                history: []
            };
            user.home = usrsrv.get_user_home(user);
            users.push(user);
            minuid++;
        }
        Promise.all(users.map(function(user) {
            logger.debug('map users to create_tp_user_db ', user);
            return create_tp_user_db(user);
        })).then(function(results) {
            logger.debug('now activate users');
            return activate_tp_users(owner, results);
        }).then(function(activated_users) {
            resolve(activated_users);
        });
    });
}

async function create_tp_user_db (tp_user) {
    let user = {...tp_user};
    logger.debug('create_tp_user_db', user.uid);
    try {
        let uid = await idsrv.getUserAvailableId();
        user.uid = CONFIG.tp.prefix + uid;
        user.lastname = uid;
        user.email = CONFIG.tp.prefix + uid + '@fake.' + CONFIG.tp.fake_mail_domain;
        user.uidnumber = uid;
        user.home = usrsrv.get_user_home(user);
        await dbsrv.mongo_users().insertOne(user);
        user.password = Math.random().toString(36).slice(-10);
        return user;
    }
    catch(exception) {
        logger.error(exception);
        throw exception;
    }
}

async function send_user_passwords(owner, from_date, to_date, users) {
    logger.debug('send_user_passwords');
    let group = (CONFIG.general.disable_user_group) ? users[0].secondarygroups[0] : users[0].group;
    let from = new Date(from_date);
    let to = new Date(to_date);

    let credentials_html = '<table border="0" cellpadding="0" cellspacing="15"><thead><tr><th align="left" valign="top">Login</th><th align="left" valign="top">Password</th><th>Fake email</th></tr></thead><tbody>';
    for(let i=0;i<users.length;i++) {
        credentials_html += '<tr><td align="left" valign="top">' + users[i].uid + '</td><td align="left" valign="top">' + users[i].password + '</td><td align="left" valign="top">' + users[i].email + '</td></tr>';
    }
    credentials_html += '</tbody></table>';

    let user_owner = await dbsrv.mongo_users().findOne({'uid': owner});
    try {
        await maisrv.send_notif_mail({
            'name': 'tps_password',
            'destinations': [user_owner.email, CONFIG.general.accounts],
            'subject': '[TP accounts reservation] ' + owner
        }, {
            '#FROMDATE#':  from.toDateString(),
            '#TODATE#':  to.toDateString(),
            '#EXPIRATION#': CONFIG.tp.extra_expiration,
            '#CREDENTIALS#': credentials_html, // should be converted by maisrv.send_notif_mail in plain text for text mail
            '#GROUP#': group,
            '#URL#': CONFIG.general.url,
            '#SUPPORT#': CONFIG.general.support

        });
    } catch(error) {
        logger.error(error);
    }

    return users;
}

function activate_tp_users(owner, users) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        Promise.all(users.map(function(user) {
            return activate_tp_user(user, owner);
        })).then(function(users) {
            // logger.debug("activate_tp_users", users);
            resolve(users);
        });
    });
}

function delete_tp_user(user, admin_id) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        logger.debug('delete_tp_user', user.uid);
        try{
            fdbs.delete_dbs(user).then(function(db_res) {
                return db_res;
                // eslint-disable-next-line no-unused-vars
            }).then(function(db_res) {
                return fwebs.delete_webs(user);
                // eslint-disable-next-line no-unused-vars
            }).then(function(web_res) {
                return usrsrv.delete_user(user, admin_id);
            }).then(function() {
                resolve(true);
            });

        }
        catch(exception) {
            logger.error(exception);
            resolve(false);
        }
    });
}

function delete_tp_users(users, group, admin_id) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject) {
        Promise.all(users.map(function(user) {
            return delete_tp_user(user, admin_id);
        })).then(function(users) {
            logger.debug('deleted tp_users');
            deleteExtraGroup(group).then(function() {
                resolve(users);
            });
        });
    });

}

async function exec_tp_reservation(reservation_id) {
    // Create users for reservation
    let reservation = await dbsrv.mongo_reservations().findOne({'_id': reservation_id});
    logger.debug('create a reservation group', reservation._id);
    let newGroup = await createExtraGroup(reservation.owner);
    logger.debug('create reservation accounts', reservation._id);
    let activated_users = await create_tp_users_db(
        reservation.owner,
        reservation.quantity,
        Math.ceil((reservation.to-reservation.from)/(1000*3600*24)),
        reservation.to, newGroup
    );
    for(let i=0;i<activated_users.length;i++) {
        logger.debug('activated user ', activated_users[i].uid);
        reservation.accounts.push(activated_users[i].uid);
    }
    try{
        await send_user_passwords(reservation.owner, reservation.from, reservation.to, activated_users);
        await dbsrv.mongo_reservations().updateOne({'_id': reservation_id}, {'$set': {'accounts': reservation.accounts, 'group': newGroup}});
        logger.debug('reservation ', reservation);
        await dbsrv.mongo_events().insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'create reservation for ' + reservation.owner , 'logs': [] });
        return reservation;
    }
    catch(exception) {
        logger.error(exception);
        throw exception;
    }
}

async function tp_reservation(userId, from_date, to_date, quantity, about, group_or_project) {
    // Create a reservation
    let reservation = {
        'owner': userId,
        'from': from_date,
        'to': to_date,
        'quantity': quantity,
        'accounts': [],
        'about': about,
        'created': false,
        'over': false,
        'group_or_project': group_or_project
    };

    await dbsrv.mongo_reservations().insertOne(reservation);
    logger.debug('reservation ', reservation);
    return reservation;
}

async function insert_ldap_user(user, fid) {
    logger.debug('prepare ldap scripts');
    try {
        await goldap.add(user, fid);
        logger.debug('switch to ACTIVE');
        await dbsrv.mongo_users().updateOne({uid: user.uid},{'$set': {status: STATUS_ACTIVE}});
        return user;
    } catch(err) {
        logger.error(err);
        throw user;
    }
}

async function activate_tp_user(user, adminId) {
    let db_user = await dbsrv.mongo_users().findOne({'uid': user.uid});
    if(!db_user) {
        logger.error('failure:',user.uid);
        throw `user activation failed ${user.uid}`;
    }
    logger.debug('activate', user.uid);
    let fid = new Date().getTime();
    let ldap_user = await insert_ldap_user(user, fid);
    try {
        let created_file = await filer.user_add_user(ldap_user, fid);
        logger.debug('Created file', created_file);
    } catch(error) {
        logger.error('Add User Failed for: ' + user.uid, error);
    }

    try {
        await plgsrv.run_plugins('activate', user.uid, ldap_user, adminId);
    } catch(err) {
        logger.error('activation errors', err);
    }
    return ldap_user;

}
