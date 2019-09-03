const nunjucks = require('nunjucks');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');
const CONFIG = require('config');
const fs = require('fs');
const templates_dir = 'templates/' + CONFIG.general.templates;

// Todo: move utils function which manage file content here
// var utils = require('../routes/utils.js');

// Todo: Manage mail template with nunjuck

nunjucks.configure(templates_dir, {
    autoescape: true,
    trimBlocks: true,
    lstripBlocks: true
});


const tplconf = require('../' + templates_dir + '/templates.json');

function create_file (name, data) {
    return new Promise( function (resolve, reject) {

        if (!tplconf[name]) {
            logger.warn('Templates file are missing for ' + name);
            reject('Templates file are missing for ' + name);
            return;
        }

        const tpl = tplconf[name];

        // console.trace();

        /* always add config in data */
        data.CONFIG = CONFIG;

        nunjucks.renderString(tpl.filepath, data, function (err, filepath) {
            if (err) {
                logger.error(err);
                reject(err);
                return;
            }

            fs.mkdirSync(filepath, { recursive: true });

            if (tpl.filepath_mode) {
                fs.chmodSync(filepath, tpl.filepath_mode);
            }

            nunjucks.renderString(tpl.filename, data, function (err, filename) {
                if (err) {
                    logger.error(err);
                    reject(err);
                    return;
                }

                nunjucks.render(tpl.template_file, data, function (err, content) {
                    if (err) {
                        logger.error(err);
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
/* Todo: add method for project template (create project and add user to project) */
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

    user_modify_user: function (user, fid) {
        return create_file('user_modify_user', { user: user, fid: fid });
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

    user_reset_password: function (user, fid) {
        return create_file('user_reset_password', { user: user, fid: fid });
    },

    user_renew_user: function (user, fid) {
        return create_file('user_renew_user', { user: user, fid: fid });
    },

    user_add_ssh_key: function (user, fid) {
        return create_file('user_add_ssh_key', { user: user, fid: fid });
    },


    /* method for ssh.js */
    ssh_keygen: function (user, fid) {
        return create_file('ssh_keygen', { user: user, fid: fid });
    },

    /* method for projects.js */

    project_add_project: function (project, fid) {
        return create_file('project_add_project', { project: project, fid: fid });
    },

    project_delete_project: function (project, fid) {
        return create_file('project_delete_project', { project: project, fid: fid });
    },

    project_update_project: function (project, fid) {
        return create_file('project_update_project', { project: project, fid: fid });
    },

    project_add_user_to_project: function (project, user, fid) {
        return create_file('project_add_user_to_project', { project: project, user: user, fid: fid });
    },

    project_add_group_to_project: function (project, group, fid) {
        return create_file('project_add_group_to_project', { project: project, group: group, fid: fid });
    },


};
