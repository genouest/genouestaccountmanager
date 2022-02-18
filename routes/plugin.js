const express = require('express');
var router = express.Router();


const winston = require('winston');
const logger = winston.loggers.get('gomngr');

const dbsrv = require('../core/db.service.js');
const plgsrv = require('../core/plugin.service.js');
const rolsrv = require('../core/role.service.js');


/**
   Plugins must provide functions:

   - template() <= return Angular html data. Template can use model from plugin_data.PLUGIN_NAME.MODEL_VARIABLE_NAME, form buttons should will updated model and must be called with method plugin_update(PLUGIN_NAME)
   - activate(user_id, user_info, session_user_id), called on user activation, returns updated user info (same as get_data)
   - deactivate(user_id, user_info, session_user_id), called on user deactivation
   - get_data(user_id, session_user_id), called on plugin info request
   - set_data(user_id, user_info, session_user_id), called on plugin info update
   - update(user_id, user_info, session_user_id) called when user info are updated

   They also must return a Promise, except template() which must return template text

   Plugin promises should not reject unless all other plugins should not be handled. In case of error, it should log it in events and return with a resolve.
   If an error need to be catched, simply set an *error* parameter to your object to get info and display it in your template

   In user_info, the parameter is_admin will be set if the logged user is an admin (not the managed user)

*/

router.get('/plugin', function(req, res) {

    let plugins_info = plgsrv.plugins_info();
    let plugins_modules = plgsrv.plugins_modules();

    let plugin_list = [];
    for(let i=0;i<plugins_info.length;i++){
        if(plugins_modules[plugins_info[i].name].template === undefined) {
            plugin_list.push(plugins_info[i]);
            continue;
        }
        let template = plugins_modules[plugins_info[i].name].template();
        if(template !==null && template !== ''){
            plugin_list.push(plugins_info[i]);
        }
    }
    res.send(plugin_list);
});


router.get('/plugin/:id', function(req, res) {
    let plugins_modules = plgsrv.plugins_modules();
    let template = plugins_modules[req.params.id].template();
    res.send(template);
});

router.get('/plugin/:id/:user', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }
    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }
    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    user.is_admin = isadmin;

    if(req.params.user != user.uid && !user.is_admin) {
        res.status(403).send({message: 'Not authorized to get an other user data if not admin...'});
    }

    let plugins_modules = plgsrv.plugins_modules();
    plugins_modules[req.params.id].get_data(req.params.user, user.uid).then(function(result){
        //res.set('Cache-control', 'public, max-age=300');
        res.send(result);
    });
});

router.post('/plugin/:id/:user', async function(req, res) {
    if(! req.locals.logInfo.is_logged) {
        res.status(401).send({message: 'Not authorized'});
        return;
    }

    let user = null;
    let isadmin = false;
    try {
        user = await dbsrv.mongo_users().findOne({_id: req.locals.logInfo.id});
        isadmin = await rolsrv.is_admin(user);
    } catch(e) {
        logger.error(e);
        res.status(404).send({message: 'User session not found'});
        res.end();
        return;
    }

    if(!user){
        res.status(404).send({message: 'User not found'});
        return;
    }

    user.is_admin = isadmin;
    if(req.params.user != user.uid && !user.is_admin) {
        res.status(403).send({message: 'Not authorized to update an other user data if not admin...'});
    }

    let plugins_modules = plgsrv.plugins_modules();
    plugins_modules[req.params.id].set_data(req.params.user, req.body, user.uid).then(function(result){
        res.send(result);
    }, function(err){
        res.status(400).send({message: err}); // Maybe we should check if err is a string
    });
});

module.exports = router;
