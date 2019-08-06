const nunjucks = require('nunjucks');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
var CONFIG = require('config');
var fs = require('fs');

var filename_suffix = "";

// Todo: move utils function which manage file content here
// var utils = require('../routes/utils.js');

// Todo: Manage mail template with nunjuck

// Todo use conf for template directory
nunjucks.configure('templates', {
    autoescape: true,
    trimBlocks: true,
    lstripBlocks: true
});

// Todo, move this in config file
const tplconf = {
    ssh_config: {
        filename: "config",
        filename_mode: 0o600,
        filepath: "{{ user.home }}/.ssh",
        filepath_mode: 0o700,
        template_file: "ssh_config",
    },
    /* config for goldap.js */
    ldap_reset_password: {
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
    /* config for users.js */
    user_create_extra_group: {
        filename: "{{ group.name }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/create_extra_group.sh",
        filepath_mode: 0o755,
    },
    user_create_extra_user: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/create_extra_user.sh",
        filepath_mode: 0o755,
    },
    user_delete_group: {
        filename: "{{ group.name }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/delete_group.sh",
        filepath_mode: 0o755,
    },
    user_add_group: {
        filename: "{{ group.name }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/add_group.sh",
        filepath_mode: 0o755,
    },
    user_change_group: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/change_group.sh",
        filepath_mode: 0o755,
    },
    user_delete_user: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/delete_user.sh",
        filepath_mode: 0o755,
    },
    user_add_user: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/add_user.sh",
        filepath_mode: 0o755,
    },
    user_expire_user: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/expire_user.sh",
        filepath_mode: 0o755,
    },
    user_reset_password: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/reset_password.sh",
        filepath_mode: 0o755,
    },
    user_renew_user: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/renew_user.sh",
        filepath_mode: 0o755,
    },
    user_add_ssh_key: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/add_ssh_key.sh",
        filepath_mode: 0o755,
    },
    user_modify_user: {
        filename: "{{ user.uid }}.{{ fid }}.update",
        filepath: "{{ CONFIG.general.script_dir }}",
        template_file: "user/modify_user.sh",
        filepath_mode: 0o755,
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


/* Todo: find if we should export create_file or not */

module.exports = {

    set_suffix: function (suffix) {
        filename_suffix = suffix;
    },

    /* template for Test */
    create_ssh_config: function (user) {
        return create_file('ssh_config', { user: user });
    },

    /* method for goldap.js */
    ldap_reset_password: function (user, user_dn, fid) {
        return create_file('ldap_reset_password', { user: user, user_dn: user_dn, fid: fid });
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

    /* method for users.js */
    // Todo: should find a clean way to give the path from ldap_add_group (same for all user method which need ldif path
    user_create_extra_group: function (group, fid) {
        return create_file('user_create_extra_group', { group: group, fid: fid });
    },

    user_create_extra_user: function (user, fid) {
        return create_file('user_create_extra_user', { user: user, fid: fid });
    },

    user_delete_group: function (group, fid) {
        return create_file('user_delete_group', { group: group, fid: fid });
    },

    // Todo: should find if we should only have one template for all the ldapmodify (as they are only call to ldif file with fid)
    user_add_group: function (group, fid) {
        return create_file('user_add_group', { group: group, fid: fid });
    },

    // Todo: maybe add the group list in this method (it is not needed now as it is done in ldap)
    user_change_group: function (user, fid) {
        return create_file('user_change_group', { user: user, fid: fid });
    },

    user_delete_user: function (user, fid) {
        return create_file('user_delete_user', { user: user, fid: fid });
    },

    // Todo: find if we should use the same template for create_extra_user and add_user
    user_add_user: function (user, fid) {
        return create_file('user_add_user', { user: user, fid: fid });
    },

    user_expire_user: function (user, fid) {
        return create_file('user_expire_user', { user: user, fid: fid });
    },

    user_reset_password: function (user, user_dn, fid) {
        return create_file('user_reset_password', { user: user, fid: fid });
    },

    user_renew_user: function (user, fid) {
        return create_file('user_renew_user', { user: user, fid: fid });
    },

    user_add_ssh_key: function (user, fid) {
        return create_file('user_add_ssh_key', { user: user, fid: fid });
    },

     user_modify_user: function (user, fid) {
        return create_file('user_modify_user', { user: user, fid: fid });
    },

};
