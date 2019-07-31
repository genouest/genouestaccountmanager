const nunjucks = require('nunjucks');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var fs = require('fs');

// Todo: move utils function which manage file content here
// var utils = require('../routes/utils.js');

// Todo use conf for template directory
nunjucks.configure('templates', { autoescape: true });

// Todo, move this in config file
const tplconf = {
    ssh_config: {
        filename: "config.test",
        filenamemode: 0o600,
        filepath: "{{ user.home }}/.ssh",
        filepathmode: 0o700,
        template: "ssh_config",
    }
};


/* Example Usage */

/*
file.create_ssh_config(user)
    .then(
        data => { // resolve()
            logger.info('File created: ', data);
        })
    .catch(error => { // reject()
        logger.error('File not created: ', error);
    });
*/


function create_file (name, data) {
    return new Promise( function (resolve, reject) {
        const tpl = tplconf[name];

        nunjucks.renderString(tpl.filepath, data, function (err, filepath) {
            if (err) {
                reject(err);
                return;
            }

            fs.mkdirSync(filepath, { recursive: true });
            fs.chmodSync(filepath, tpl.filepathmode);

            nunjucks.renderString(tpl.filename, data, function (err, filename) {
                if (err) {
                    reject(err);
                    return;
                }

                nunjucks.render(tpl.template, data, function (err, content) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    fs.writeFileSync(filepath + "/" + filename, content);
                    fs.chmodSync(filepath + "/" + filename, tpl.filenamemode);
                    resolve (filepath + "/" + filename);
                    return;
                });
            });
        });
    });
}


module.exports = {
    create_ssh_config: function (user) {
        return create_file('ssh_config', { user: user });
    }
};
