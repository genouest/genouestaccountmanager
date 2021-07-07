const winston = require('winston');
const logger = winston.loggers.get('gomngr');

// const cfgsrv = require('../core/config.service.js');
// let my_conf = cfgsrv.get_conf();
// const CONFIG = my_conf;

const dbsrv = require('../core/db.service.js');
// const maisrv = require('../core/mail.service.js');

const STATUS_NEW = 'New';
const STATUS_WIP = 'Wip';
const STATUS_VALID = 'Valid';
let day_time = 1000 * 60 * 60 * 24;

exports.create_price = create_price;
exports.update_price = update_price;
exports.delete_price = delete_price;
exports.create_bill = create_bill;
exports.update_bill = update_bill;
exports.delete_bill = delete_bill;
exports.add_project_to_bill = add_project_to_bill;
exports.remove_project_from_bill = remove_project_from_bill;

async function create_price(new_price, action_owner) {
    logger.info('Create Price ' + new_price.label);
    // todo : https://github.com/uuidjs/uuid
    new_price.uuid = (new Date().getTime()).toString();

    try {
        await dbsrv.mongo_prices().insertOne(new_price);
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'new price creation: ' + new_price.label , 'logs': []});

    } catch(error) {
        logger.error('Add Price Failed for: ' + new_price.id, error);
        throw {code: 500, message: 'Add Price Failed'};
    }
}

async function update_price(uuid, price, action_owner) {
    logger.info('Update Price ' + uuid);

    try {
        await dbsrv.mongo_prices().updateOne({'uuid': uuid},  {'$set': price});
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'update price ' + price.uuid , 'logs': []});
    } catch(error) {
        logger.error('Update Price Failed for: ' + price.uuid, error);
        throw {code: 500, message: 'Add Price Failed'};
    }
}

async function delete_price(uuid, action_owner) {
    logger.info('Delete Price ' + uuid);

    try {
        await dbsrv.mongo_prices().deleteOne({'uuid': uuid});
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'delete price ' + uuid , 'logs': []});
    } catch(error) {
        logger.error('Delete Price Failed for: ' + uuid, error);
        throw {code: 500, message: 'Delete Price Failed'};
    }
}


async function create_bill(new_bill, action_owner) {
    logger.info('Create Bill ' + new_bill.name);
    // todo : https://github.com/uuidjs/uuid
    new_bill.uuid = (new Date().getTime()).toString();

    new_bill.created_at = new Date().getTime();
    new_bill.status = STATUS_NEW;
    new_bill.projects = [];

    let price =  await dbsrv.mongo_prices().findOne({enable: true, uuid: new_bill.price});
    if (!price) {
        logger.error('Failed to get price for new bill ' + new_bill.name);
        throw {code: 404, message: 'Failed to get price for new bill'};
    }

    new_bill.size = price.size;
    new_bill.cpu = price.cpu;
    new_bill.period = price.period;

    try {
        await dbsrv.mongo_bills().insertOne(new_bill);
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'new bill creation: ' + new_bill.label , 'logs': []});

    } catch(error) {
        logger.error('Add Bill Failed for: ' + new_bill.id, error);
        throw {code: 500, message: 'Add Bill Failed'};
    }
}

async function update_bill(uuid, new_bill, action_owner) {
    logger.info('Update Bill ' + uuid);

    let bill =  await dbsrv.mongo_bills().findOne({uuid: uuid});
    if (!bill) {
        logger.error('Failed to find bill');
        throw {code: 404, message: 'Failed to find bill'};
    }
    if (bill.status == STATUS_VALID) {
        throw {code: 403, message: 'Update of ' + STATUS_VALID + ' bill is not allowed'};
    }

    let new_status = new_bill.status;
    if (bill.status != new_status) {
        if (new_status != STATUS_WIP && new_status != STATUS_VALID)
        {
            logger.error('Invalid Bill Status');
            throw {code: 403, message: 'Invalid Bill Status'};
        }

        new_bill = bill; // disable all other update
        new_bill.status = new_status;

        if (new_status == STATUS_VALID) {
            new_bill.validate_at =  new Date().getTime();
            new_bill.expire_at =  new Date().getTime() + new_bill.period * day_time;
        }
    }

    if (bill.price != new_bill.price) {
        let price =  await dbsrv.mongo_prices().findOne({enable: true, uuid: new_bill.price});
        if (!price) {
            logger.error('Failed to get price for new bill ' + new_bill.name);
            throw {code: 404, message: 'Failed to get price for new bill'};
        }

        new_bill.size = price.size;
        new_bill.cpu = price.cpu;
        new_bill.period = price.period;
    }

    try {
        await dbsrv.mongo_bills().updateOne({'uuid': uuid},  {'$set': new_bill});
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'update bill ' + new_bill.uuid , 'logs': []});
    } catch(error) {
        logger.error('Add Bill Failed for: ' + new_bill.uuid, error);
        throw {code: 500, message: 'Add Bill Failed'};
    }
}

async function delete_bill(uuid, action_owner) {
    logger.info('Delete Bill ' + uuid);

    let bill =  await dbsrv.mongo_bills().findOne({uuid: uuid});
    if (!bill) {
        logger.error('Failed to find bill');
        throw {code: 404, message: 'Failed to find bill'};
    }

    if (bill.status == STATUS_VALID) {
        throw {code: 403, message: 'Delete of ' + STATUS_VALID + ' bill is not allowed'};
    }


    try {
        await dbsrv.mongo_bills().deleteOne({'uuid': uuid});
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'delete bill ' + uuid , 'logs': []});
    } catch(error) {
        logger.error('Delete Bill Failed for: ' + uuid, error);
        throw {code: 500, message: 'Delete Bill Failed'};
    }
}

async function remove_project_from_bill(uuid, project, action_owner) {
    logger.info('Remove ' + project + ' from Bill ' + uuid);

    let bill =  await dbsrv.mongo_bills().findOne({uuid: uuid});
    if (!bill) {
        logger.error('Failed to find bill');
        throw {code: 404, message: 'Failed to find bill'};
    }

    let index = bill.projects.indexOf(project);
    if (index > -1) {
        bill.projects.splice(index, 1);
    } else {
        logger.error('Project Not Find in Bill');
        throw {code: 404, message: 'Project Not Find in Bill'};
    }

    try {
        await dbsrv.mongo_bills().updateOne({'uuid': uuid}, {'$set': bill});
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'remove project ' + project + ' from bill ' + uuid , 'logs': []});
    } catch(error) {
        logger.error('Remove Project Failed', error);
        throw {code: 500, message: 'Remove Project Failed'};
    }
}


async function add_project_to_bill(uuid, project, action_owner) {
    logger.info('Add ' + project + ' to Bill ' + uuid);

    let bill =  await dbsrv.mongo_bills().findOne({uuid: uuid});
    if (!bill) {
        logger.error('Failed to find bill');
        throw {code: 404, message: 'Failed to find bill'};
    }

    let index = bill.projects.indexOf(project);
    if (index > -1) {
        logger.error('Project Already in Bill');
        throw {code: 404, message: 'Project Already in Bill'};
    } else {
        bill.projects.push(project);
    }

    try {
        await dbsrv.mongo_bills().updateOne({'uuid': uuid}, {'$set': bill});
        await dbsrv.mongo_events().insertOne({'owner': action_owner, 'date': new Date().getTime(), 'action': 'add project ' + project + ' to bill ' + uuid , 'logs': []});
    } catch(error) {
        logger.error('Add Project Failed', error);
        throw {code: 500, message: 'Add Project Failed'};
    }
}
