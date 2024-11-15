const express = require('express');
var router = express.Router();

const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const dbsrv = require('../core/db.service.js');
const rolsrv = require('../core/role.service.js');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;
const MAILER = CONFIG.general.mailer;
const notif = require('../core/notif_' + MAILER + '.js');

router.post('/notify/allAdminByMail', async function (req, res) {
    try {
        const { origin, subject, message, html_message } = req.body;

        // Validate required fields
        if (!origin || !subject || !message) {
            return res.status(400).send({
                status: 1,
                message: 'Missing required fields in request body',
            });
        }

        // Fetch all users from the database
        const users = await dbsrv.mongo_users().find({}).toArray();

        if (!users || users.length === 0) {
            return res.status(404).send({ status: 1, message: 'No users found' });
        }

        // Filter admin users and extract their emails
        const adminEmails = [];
        for (const user of users) {
            if (await rolsrv.is_admin(user)) {
                if (user.email) {
                    adminEmails.push(user.email);
                }
            }
        }

        // Check if any admin emails were found
        if (adminEmails.length === 0) {
            return res.status(404).send({ status: 1, message: 'No admin users found' });
        }

        // Send notifications to admin emails
        try {
            await notif.sendList(adminEmails, { origin, subject, message, html_message });
            logger.info('Emails sent successfully to admins');
            return res.status(200).send({ status: 0, message: 'Emails sent successfully to admins' });
        } catch (emailError) {
            logger.error('Error sending emails:', emailError);
            return res.status(500).send({ status: 1, message: 'Error sending emails to admins' });
        }
    } catch (error) {
        logger.error('Error in /notify/allAdminByMail:', error);
        return res.status(500).send({ status: 1, message: 'Internal server error' });
    }
});

module.exports = router;

