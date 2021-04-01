// const Promise = require('promise');
const htmlToText = require('html-to-text');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;
var GENERAL_CONFIG = CONFIG.general;

const MAILER = CONFIG.general.mailer;
const marked = require('marked');

const notif = require('../core/notif_'+MAILER+'.js');

function get_mail_config () {
    var MAIL_CONFIG = {};
    // todo: more and more ugly init...
    if (CONFIG[MAILER]) { MAIL_CONFIG = CONFIG[MAILER]; }
    if (!MAIL_CONFIG.origin) {
        logger.error('No email origin are configured !');
    }
    return MAIL_CONFIG;
}

async function gen_mail_opt (options, variables)
{
    var MAIL_CONFIG = get_mail_config();
    // todo: check if each option exist and use default value
    let name = options['name'];
    let destinations = options['destinations'];
    let subject = GENERAL_CONFIG.name + ' ' + options['subject'];

    //find message
    let message = undefined;
    if (name && CONFIG.message[name]) {
        message = CONFIG.message[name].join('\n');
    }
    let html_message = message;
    if (name && CONFIG.message[name + '_html']) {
        html_message = CONFIG.message[name + '_html'].join('');
    }

    if (options['markdown'] !== undefined && options['markdown'] != '') {
        html_message = marked(options['markdown']);
    }

    if (!html_message) { // if html_message is not set then message is not set too
        logger.error('Email Message not found!');
        return null;
    } else if (!message) { // if html_message is set and message is not set too
        message = htmlToText.fromString(html_message);
    }

    // replace variable in message
    for (let key in variables) {
        let value = variables[key];
        if (value === undefined || value === null) { value = '';} // value may not be defined
        let html_value = value;
        let re = new RegExp(key,'g');


        // check if there is html tag in variable
        let re_html = /(<([^>]+)>)/;
        if (value.toString().match(re_html)) {
            value = htmlToText.fromString(value);
        }

        message = message.replace(re, value);
        html_message = html_message.replace(re, html_value);
    }

    // check footer
    let footer = 'From My';
    let html_footer = 'From My';

    if (CONFIG.message.footer) {
        footer = CONFIG.message.footer.join('\n');
    }
    if (CONFIG.message.footer_html) {
        html_footer = CONFIG.message.footer_html.join('<br/>');
        if (! CONFIG.message.footer) { // if there is only html value
            footer = htmlToText.fromString(html_footer);
        }
    }

    // always add footer
    message = message + '\n' + footer;
    html_message = html_message + '<br/>' + html_footer;

    // set mailOptions
    let mailOptions = {
        origin: MAIL_CONFIG.origin, // sender address
        destinations:  destinations, // list of receivers
        subject: subject, // Subject line
        message: message, // plaintext body
        html_message: html_message // html body
    };

    // tmp for debug
    // logger.info(mailOptions);

    // todo: find if we should return or send mail ...
    return mailOptions;
}

async function send_notif_mail (options, variables) {
    if(notif.mailSet()) {
        try {
            let mailOptions = await gen_mail_opt(options, variables);
            if (mailOptions) {
                await notif.sendUser(mailOptions);
            }
        } catch(err) {
            logger.error('send notif mail error', err);
        }
    }
}

// exports mail functions
exports.get_mail_config = get_mail_config;
exports.gen_mail_opt = gen_mail_opt;
exports.send_notif_mail = send_notif_mail;
