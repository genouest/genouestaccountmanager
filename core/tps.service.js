const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const latinize = require('latinize');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

/* TODO Remove this */
const fdbs = require('../routes/database.js');
const fwebs = require('../routes/web.js');

const dbsrv = require('../core/db.service.js');
const usrsrv = require('../core/user.service.js');
const idsrv = require('../core/id.service.js');
const maisrv = require('../core/mail.service.js');
const grpsrv = require('../core/group.service.js');
const prjsrv = require('../core/project.service.js');

// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
// eslint-disable-next-line no-unused-vars
var STATUS_EXPIRED = 'Expired';

exports.tp_reservation = tp_reservation;
exports.exec_tp_reservation = exec_tp_reservation;
exports.delete_tp_users = delete_tp_users;


async function createExtraGroup(trainingName, ownerName) {
    let mingid = await idsrv.getGroupAvailableId();
    let group = await grpsrv.create_group(trainingName + '_' + mingid, ownerName);
    return group;
}

async function createExtraProject(trainingName, ownerName) {
    let mingid = await idsrv.getGroupAvailableId();
    let project = await prjsrv.create_project({
        'id': trainingName + '_' + mingid,
        'owner': ownerName
    });
    return project;
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

async function deleteExtraProject(project) {
    if (project === undefined || project === null) {
        return false;
    }
    let project_to_remove = await dbsrv.mongo_projects().findOne({'name': project.id});
    if(!project_to_remove) {
        return false;
    }
    let res = await prjsrv.delete_project(project.id);
    return res;
}


async function create_tp_users_db (owner, quantity, duration, end_date, userGroup, userProject) {
    // Duration in days
    logger.debug('create_tp_users ', owner, quantity, duration);
    let startnbr = await idsrv.getUserAvailableId();

    let users = [];
    try {
        for(let i=0;i<quantity;i++) {
            logger.debug('create user ', CONFIG.tp.prefix + startnbr);
            let user = {
                uid: CONFIG.tp.prefix + startnbr,
                firstname: CONFIG.tp.prefix,
                lastname: startnbr,
                email: CONFIG.tp.prefix + startnbr + '@fake.' + CONFIG.tp.fake_mail_domain,
                responsible: owner,
                group: (CONFIG.general.disable_user_group) ? '' : userGroup.name,
                secondarygroups: (CONFIG.general.disable_user_group) ? [userGroup.name] : [],
                why: 'TP/Training',
                is_internal: false,
                is_fake: true,
                duration: duration,
                expiration: end_date + 1000*3600*24*(duration+CONFIG.tp.extra_expiration),
            };
            user = await usrsrv.create_user(user);
            user.password = Math.random().toString(36).slice(-10);
            await usrsrv.activate_user(user);
            users.push(user);
            startnbr++;


            // TODO: find if we need to check the switch flag or if it is better to check the var
            if (userGroup && userGroup != '') {
                usrsrv.add_user_to_group(user.uid, userGroup);
            }

            if (userProject && userProject != '') {
                usrsrv.add_user_to_project(userProject, user.uid);
            }

        }
    }
    catch (error) {
        logger.error(error);
    }
    return users;
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


async function delete_tp_user(user, admin_id) {

    logger.debug('delete_tp_user', user.uid);
    try{
        await fdbs.delete_dbs(user);
        await fwebs.delete_webs(user);
        await usrsrv.delete_user(user, admin_id);
    }
    catch(exception) {
        logger.error(exception);
    }
}

async function delete_tp_users(users, group, admin_id) {
    for (let user in users) {
        await delete_tp_user(user, admin_id);
    }
    await deleteExtraGroup(group);
}


async function exec_tp_reservation(reservation_id) {
    // Create users for reservation
    let reservation = await dbsrv.mongo_reservations().findOne({'_id': reservation_id});

    if (!reservation.name) {
        reservation.name = 'tp';
    }

    let trainingName = latinize(reservation.name.toLowerCase()).replace(/[^0-9a-z]+/gi,'_');

    logger.debug('create a reservation group', reservation._id);
    let newGroup = '';
    if (reservation.group_or_project == 'group') {
        newGroup = await createExtraGroup(trainingName, reservation.owner);
    }

    logger.debug('create a reservation project', reservation._id);
    let newProject = '';
    if (reservation.group_or_project == 'project') {
        newProject = await createExtraProject(trainingName, reservation.owner);
    }


    logger.debug('create reservation accounts', reservation._id);
    let activated_users = await create_tp_users_db(
        reservation.owner,
        reservation.quantity,
        Math.ceil((reservation.to-reservation.from)/(1000*3600*24)),
        reservation.to, newGroup, newProject
    );
    for(let i=0;i<activated_users.length;i++) {
        logger.debug('activated user ', activated_users[i].uid);
        reservation.accounts.push(activated_users[i].uid);
    }
    try{
        await send_user_passwords(reservation.owner, reservation.from, reservation.to, activated_users);
        await dbsrv.mongo_reservations().updateOne({'_id': reservation_id}, {
            '$set': {
                'accounts': reservation.accounts,
                'group': newGroup,
                'project': newProject
            }
        });
        logger.debug('reservation ', reservation);
        await dbsrv.mongo_events().insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'create reservation for ' + reservation.owner , 'logs': [] });
        return reservation;
    }
    catch(exception) {
        logger.error(exception);
        throw exception;
    }
}

async function tp_reservation(userId, from_date, to_date, quantity, about, group_or_project, name) {
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
        'group_or_project': group_or_project,
        'name': name
    };

    await dbsrv.mongo_reservations().insertOne(reservation);
    logger.debug('reservation ', reservation);
    return reservation;
}
