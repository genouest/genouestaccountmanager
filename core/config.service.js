const CONFIG = require('config');

let is_init = false;
let conf = null;

exports.get_conf = get_conf;

// todo: maybe add a file in config with all the default value, load it and overide it with custom config
function init () {
    if (!is_init) {
        conf = CONFIG;
        if (!conf.duration) {
            let duration_list = {
                '3 months': 91,
                '6 months': 182,
                '1 year': 365,
                '2 years': 730,
                '3 years': 1095
            };
            conf.duration = duration_list;
        }
        if (!conf.general.terms_of_use) {
            conf.general.terms_of_use = '/doc/terms_of_use.txt';
        }
        if (!conf.general.web_home) {
            conf.general.web_home = 'user'; // can be user or project
        }
        if (!conf.enable_ui) {
            conf.enable_ui = {
                'messages': true,
                'databases': true,
                'tps': true,
                'websites': true,
                'u2f_key': true,
                'ip': true,
                'newsletters': true,
                'log': true
            };
        }
        conf.enable_ui.main_group = CONFIG.general.use_group_in_path;
        conf.enable_ui.user_group = !CONFIG.general.disable_user_group;

        if (!conf.project) {
            conf.project = {
                'enable_group': true,
                'default_size': 500,
                'default_path': '/opt/project',
                'default_expire': 360,
                'allow_extend': false
            };
        }

        if (!conf.reservation) {
            conf.reservation = {
                'group_or_project': 'group',
                'show_choice_in_ui': false
            };
        }

        is_init = true;
    }
}

// todo: should replace all {const CONFIG = require('config');} by a call to this function
function get_conf () {
    init();
    return conf;
}
