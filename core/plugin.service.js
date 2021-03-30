// const Promise = require('promise');
// const winston = require('winston');
// const logger = winston.loggers.get('gomngr');

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
            plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name, 'display_name': plugins[i]['display_name'], 'admin_only': plugins[i]['admin_only'], 'admin': plugins[i]['admin']});
        }
    }
};

exports.plugins_info = () => {
    return plugins_info;
};

exports.plugins_modules = () => {
    return plugins_modules;
};
