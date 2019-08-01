const nunjucks = require('nunjucks');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var fs = require('fs');

const filename_suffix = ".test.nunjuck";

// Todo: move utils function which manage file content here
// var utils = require('../routes/utils.js');

// Todo use conf for template directory
nunjucks.configure('templates', { autoescape: true });

// Todo, move this in config file
const tplconf = {
    ssh_config: {
        filename: "config",
        filename_mode: 0o600,
        filepath: "{{ user.home }}/.ssh",
        filepath_mode: 0o700,
        template_file: "ssh_config",
    },
    ldap_replace_password: {
        filename: "{{ user.uid }}.{{ fid }}.ldif",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "ldap/replace_password.ldif",
    },
    ldap_modify_user: {
        filename: "{{ user.uid }}.{{ fid }}.ldif",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "ldap/modify_user.ldif",
    },
    ldap_add_group: {
        filename: "{{ group.name }}.{{ fid }}.ldif",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "ldap/add_group.ldif",
    },
    ldap_delete_group: {
        filename: "{{ group.name }}.{{ fid }}.ldif",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "ldap/delete_group.ldif",
    },
    ldap_add_user: {
        filename: "{{ user.uid }}.{{ fid }}.ldif",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "ldap/add_user.ldif",
    },
    ldap_add_user_to_group: {
        filename: "group_{{ user.group }}_{{ user.uid }}.{{ fid }}.ldif",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "ldap/add_user_to_group.ldif",
    },
    ldap_change_user_groups: {
        filename: "{{ user.uid }}.{{ fid }}.ldif",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "ldap/change_user_groups.ldif",
    },
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

        /* always add config in data */
        data.CONFIG = CONFIG;

        nunjucks.renderString(tpl.filepath, data, function (err, filepath) {
            if (err) {
                reject(err);
                return;
            }

            fs.mkdirSync(filepath, { recursive: true });
            if (tpl.filepath_mode) {
                fs.chmodSync(filepath, tpl.filepath_mode);
            }
            nunjucks.renderString(tpl.filename + filename_suffix , data, function (err, filename) {
                if (err) {
                    reject(err);
                    return;
                }

                nunjucks.render(tpl.template_file, data, function (err, content) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    fs.writeFileSync(filepath + "/" + filename, content);
                    if (tpl.filename_mode) {
                        fs.chmodSync(filepath + "/" + filename, tpl.filename_mode);
                    }
                    resolve (filepath + "/" + filename);
                    return;
                });
            });
        });
    });
}


module.exports = {
    /* template for Test */
    create_ssh_config: function (user) {
        return create_file('ssh_config', { user: user });
    },

    /* template for goldap.js */
    ldap_reset_password: function (user, user_dn, fid) {
        return create_file('ldap_replace_password', { user: user, user_dn: user_dn, fid: fid });
    },

    ldap_modify_user: function (user, user_dn, fid) {
        return create_file('ldap_modify_user', { user: user, user_dn: user_dn, fid: fid });
    },

    ldap_add_group: function (group, fid) {
        return create_file('ldap_add_group', { group: group, fid: fid });
    },

    ldap_delete_group: function (group, fid) {
        return create_file('ldap_delete_group', { group: group, fid: fid });
    },

    ldap_add_user: function (user, group, fid) {
        return create_file('ldap_add_user', { user: user, group: group, fid: fid });
    },

    ldap_add_user_to_group: function (user, fid) { // will use user.group
        return create_file('ldap_add_user_to_group', { user: user, fid: fid });
    },

    ldap_change_user_groups: function (user, group_add, group_remove, fid) { // will use user.group
        return create_file('ldap_change_user_groups', { user: user, group_add: group_add, group_remove: group_remove, fid: fid });
    },

};
