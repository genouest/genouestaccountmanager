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
const plgsrv = require('../core/plugin.service.js');


// eslint-disable-next-line no-unused-vars
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
//var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
//var STATUS_ACTIVE = 'Active';
// eslint-disable-next-line no-unused-vars
var STATUS_EXPIRED = 'Expired';

exports.tp_reservation = tp_reservation;
exports.create_tp_reservation = create_tp_reservation;
exports.remove_tp_reservation = remove_tp_reservation;


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
    let group_to_remove = await dbsrv.mongo_groups().findOne({'name': group});
    if(!group_to_remove) {
        logger.error('Cant find group to remove ' +  group);
        return false;
    }
    try {
        await usrsrv.remove_user_from_group(group_to_remove.owner, group_to_remove.name);
        let res = await grpsrv.delete_group(group_to_remove);
        return res;
    } catch(error) {
        logger.error(error);
    }
    return false;
}

async function deleteExtraProject(project) {
    if (project === undefined || project === null) {
        return false;
    }
    let project_to_remove = await dbsrv.mongo_projects().findOne({'id': project});
    if(!project_to_remove) {
        logger.error('Cant find project to remove ' +  project);
        return false;
    }
    try {
        await usrsrv.remove_user_from_project(project_to_remove.id, project_to_remove.owner, 'auto', true);
        let res = await prjsrv.remove_project(project_to_remove.id);
        return res;
    } catch(error) {
        logger.error(error);
    }
    return false;
}


async function create_tp_users_db (owner, quantity, duration, end_date, userGroup, userProject) {
    // Duration in days
    logger.debug('create_tp_users ', owner, quantity, duration);
    let startnbr = await idsrv.getUserAvailableId();

    let groupName = '';
    let projectName = '';

    if (userGroup && userGroup.name) {
        groupName = userGroup.name;
    }

    if (userProject && userProject.id) {
        projectName = userProject.id;
    }

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
                group: (CONFIG.general.disable_user_group) ? '' : groupName,
                secondarygroups: (!CONFIG.general.disable_user_group && groupName != '') ? [groupName] : [],
                why: 'TP/Training',
                is_internal: false,
                is_fake: true,
                duration: duration,
                expiration: end_date + 1000*3600*24*(duration+CONFIG.tp.extra_expiration),
            };
            user = await usrsrv.create_user(user);
            user.password = usrsrv.new_password(10);
            await usrsrv.activate_user(user);

            users.push(user);
            startnbr++;

            /*
            if (groupName != '') {
                await usrsrv.add_user_to_group(user.uid, userGroup.name);
            }
            */

            if (projectName != '') {
                await usrsrv.add_user_to_project(userProject.id, user.uid, 'auto', false);
            }

            await plgsrv.run_plugins('activate', user.uid, user, 'auto');

        }
    }
    catch (error) {
        logger.error('Error', error);
    }
    return users;
}


async function send_user_passwords(owner, from_date, to_date, users, group) {
    logger.debug('send_user_passwords');
    let from = new Date(from_date);
    let to = new Date(to_date);

    let credentials_html = '<table border="0" cellpadding="0" cellspacing="15"><thead><tr><th align="left" valign="top">Login</th><th align="left" valign="top">Password</th><th>Fake email</th></tr></thead><tbody>' + '\n';
    for(let i=0;i<users.length;i++) {
        credentials_html += '<tr><td align="left" valign="top">' + users[i].uid + '</td><td align="left" valign="top">' + users[i].password + '</td><td align="left" valign="top">' + users[i].email + '</td></tr>' + '\n';
    }
    credentials_html += '</tbody></table>' + '\n';

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


async function delete_tp_user(user) {

    logger.debug('delete_tp_user', user.uid);
    try{
        await fdbs.delete_dbs(user);
        await fwebs.delete_webs(user);
        await usrsrv.delete_user(user);
        await plgsrv.run_plugins('remove', user.uid, user, 'auto@tp');
    }
    catch(exception) {
        logger.error(exception);
    }
}

async function delete_tp_users(users) {
    for(let i=0;i<users.length;i++) {
        let user = await dbsrv.mongo_users().findOne({'uid': users[i]});
        if (user && user.uid) {
            await delete_tp_user(user);
        }
    }

}


async function remove_tp_reservation(reservation_id) {

    logger.info('Close reservation', reservation_id);

    let reservation = await dbsrv.mongo_reservations().findOne({'_id': reservation_id});
    logger.debug('Close reservation', reservation);

    if (reservation.accounts)
    {
        logger.info('Delete Account', reservation.accounts);
        await delete_tp_users(reservation.accounts);
    }

    if (reservation.group && reservation.group.name && reservation.group.name != '') {
        logger.info('Delete Group', reservation.group.name);
        await deleteExtraGroup(reservation.group.name);
    }

    if (reservation.project && reservation.project.id && reservation.project.id != '') {
        logger.info('Delete Project', reservation.project.id);
        await deleteExtraProject(reservation.project.id);
    }

    try {
        await dbsrv.mongo_reservations().updateOne({'_id': reservation_id}, {
            '$set': {
                'over': true
            }
        });
        await dbsrv.mongo_events().insertOne({ 'owner': 'auto', 'date': new Date().getTime(), 'action': 'close reservation for ' + reservation.owner , 'logs': [] });

    } catch (error) {
        logger.error(error);
    }

}

async function create_tp_reservation(reservation_id) {

    logger.info('Create reservation', reservation_id);

    // Create users for reservation
    let reservation = await dbsrv.mongo_reservations().findOne({'_id': reservation_id});
    if(!reservation) {
        throw {code: 404, message: 'Reservation not found'};
    }

    if (!reservation.name) {
        reservation.name = 'tp';
    }

    let trainingName = latinize(reservation.name.toLowerCase()).replace(/[^0-9a-z]+/gi,'_');
    let gpname = '';
    let newGroup;
    if (reservation.group_or_project == 'group') {
        logger.info('Create Group', trainingName);
        newGroup = await createExtraGroup(trainingName, reservation.owner);
        gpname = newGroup.name;
    }


    let newProject;
    if (reservation.group_or_project == 'project') {
        logger.info('Create Project', trainingName);
        newProject = await createExtraProject(trainingName, reservation.owner);
        gpname = newProject.id;
    }

    logger.info('Create Accounts', trainingName);
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
        logger.info('Send Password', trainingName);
        await send_user_passwords(reservation.owner, reservation.from, reservation.to, activated_users, gpname);
        await dbsrv.mongo_reservations().updateOne({'_id': reservation_id}, {
            '$set': {
                'accounts': reservation.accounts,
                'group': newGroup,
                'project': newProject,
                'created': true
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
