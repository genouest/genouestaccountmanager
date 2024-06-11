// const Promise = require('promise');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const cfgsrv = require('../core/config.service.js');
let my_conf = cfgsrv.get_conf();
const CONFIG = my_conf;

// todo: move this in config service
var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];

exports.load_plugins = () => {
    for(let i=0;i<plugins.length;i++){
        if(!plugins_modules[plugins[i].name]) {
            plugins_modules[plugins[i].name] = require('../plugins/'+plugins[i].name);
            if(plugins[i].display_name === undefined) { plugins[i]['display_name'] = plugins[i].name; }
            if(plugins[i].admin_only === undefined) { plugins[i]['admin_only'] = false; }
            if(plugins[i].admin === undefined) { plugins[i]['admin'] = false; }
            if(plugins[i].allow_fake === undefined) { plugins[i]['allow_fake'] = false; }
            plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name, 'display_name': plugins[i]['display_name'], 'admin_only': plugins[i]['admin_only'], 'admin': plugins[i]['admin'], 'allow_fake': plugins[i]['allow_fake']});
        }
    }
};

exports.plugins_info = () => {
    return plugins_info;
};

exports.plugins_modules = () => {
    return plugins_modules;
};

exports.run_plugins = async (method, userId, data, adminId) => {

    let error = false;
    for (let i=0; i < plugins_info.length; i++) {
        let plugin_info = plugins_info[i];
        if(plugin_info.allow_fake === false && data && data.is_fake) {
            logger.info(`[plugins][plugin=${plugin_info.name}] skipping, user is fake and fake not allowed`);
            continue;
        }
        try {
            logger.info(`[plugins][plugin=${plugin_info.name}] run`);
            if (plugins_modules[plugin_info.name][method] === undefined) {
                logger.error(`[plugins][plugin=${plugin_info.name}] plugin has no function ${method}`);
                continue;
            }
            await plugins_modules[plugin_info.name][method](userId, data, adminId);
        }
        catch (err) {
            logger.error(`[plugins][plugin=${plugin_info.name}] error`, err);
            error = true;
        }
    }
    return error;
};
