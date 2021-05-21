// const Promise = require('promise');
// const winston = require('winston');
// const logger = winston.loggers.get('gomngr');

function sanitizeString(rawValue) {
    if (typeof rawValue === 'string' && /^[0-9a-z-_]+$/i.test(rawValue)) {
        return rawValue;
    }
    return undefined;
}

exports.sanitizeSSHKey = function(rawValue) {
    if (typeof rawValue === 'string' && /^ssh-rsa AAAA[0-9A-Za-z+/]+[=]{0,3}/.test(rawValue)) {
        return rawValue;
    }
    return undefined;
};

exports.sanitizePath = function(rawValue) {
    // eslint-disable-next-line no-useless-escape
    if (typeof rawValue === 'string' && /^[0-9a-z-_\s\/.]+$/i.test(rawValue)) {
        return rawValue;
    }
    return undefined;
};

exports.sanitize = function sanitize(rawValue) {
    let value = sanitizeString(rawValue);
    if (value == undefined) {
        return false;
    }
    return true;
};

exports.sanitizeAll = function sanitizeAll(rawValues) {
    for(let i=0;i<rawValues.length;i++) {
        let value = sanitizeString(rawValues[i]);
        if (value === undefined) {
            return false;
        }
    }
    return true;
};
