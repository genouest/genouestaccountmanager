/* eslint-disable require-atomic-updates */
/* eslint-disable no-console */
'use strict';

var express = require('express');
var expressStaticGzip = require('express-static-gzip');
var cors = require('cors');
var path = require('path');
// var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

var log_level = 'info';
if (process.env.NODE_ENV == 'dev' || process.env.DEBUG) {
    log_level = 'debug';
}

var winston = require('winston');
var jwt = require('jsonwebtoken');

const myconsole = new (winston.transports.Console)({
    label: 'gomngr',
    level: log_level
});
const wlogger = winston.loggers.add('gomngr', {
    transports: [myconsole]
});

const promBundle = require('express-prom-bundle');

var routes = require('./routes/index');
var users = require('./routes/users');
var ssh = require('./routes/ssh');
var auth = require('./routes/auth');
// var disks = require('./routes/disks');
var database = require('./routes/database');
var web = require('./routes/web');
var logs = require('./routes/logs');
var projects = require('./routes/projects');
var quota = require('./routes/quota');
var plugin = require('./routes/plugin');
var tp = require('./routes/tp');
var conf = require('./routes/conf');
var utils = require('./routes/utils.js');
var tags = require('./routes/tags.js');
var ObjectID = require('mongodb').ObjectID;

var CONFIG = require('config');

const MY_ADMIN_USER = process.env.MY_ADMIN_USER || null;
const MY_ADMIN_GROUP = process.env.MY_ADMIN_GROUP || 'admin';


var app = express();
app.use(cors({origin: true, credentials: true}));

if (process.env.MY_ACCESS_LOG) {
    const fs = require('fs');
    const accessLogStream = fs.createWriteStream(process.env.MY_ACCESS_LOG, { flags: 'a' });
    app.use(logger('combined', { stream: accessLogStream }));
}
else {
    app.use(logger('combined'));
}

// view engine setup
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

var mongoURL = CONFIG.mongo.url;
var mongoStoreClient = null;
if(mongoURL) {
    mongoStoreClient = new MongoStore({ url: mongoURL });
}
else {
    mongoStoreClient = new MongoStore({url: `mongodb://${CONFIG.mongo.host}:${CONFIG.mongo.port}/gomngr`});
}

app.use(session({
    secret: CONFIG.general.secret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600*1000},
    store: mongoStoreClient
}));
// app.use('/manager', express.static(path.join(__dirname, 'manager')));
app.use('/manager2', expressStaticGzip(path.join(__dirname, 'manager2/dist/my-ui')));
app.use(express.static(path.join(__dirname, 'public')));

const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    normalizePath: [
        ['^/manager2/.*', '/manager2/#static'],
        ['^/log/.*', '/log'],
        ['^/group/.*', '/group/#name'],
        ['^/database/.*', '/database/#name'],
        ['^/web/.*', '/web/#name'],
        ['^/user/.*', '/user/#name'],
        ['^/list/.*', '/list/#name'],
        ['^/project/.*', '/project/#name'],
        ['^/ssh/.*', '/ssh/#name'],
        ['^/plugin/.*', '/plugin/#name'],
        ['^/quota/.*', '/quota/#name'],
        ['^/tp/.*', '/tp/#name'],
        ['^/tags/.*', '/tags'],
        ['^/auth/.*', '/auth/#name'],
        ['^/u2f/.*', '/u2f'],
        ['^/mail/.*', '/mail/#name'],
    ],
});

app.use(metricsMiddleware);


const runningEnv = process.env.NODE_ENV || 'prod';
const { spawn } = require('child_process');
const if_dev_execute_scripts = function(){
    return new Promise(function (resolve, reject){
        if (runningEnv !== 'test'){
            resolve();
            return;
        }
        wlogger.info('In *test* environment, check for scripts to execute');
        let cron_bin_script = CONFIG.general.cron_bin_script || null;
        if(cron_bin_script === null){
            wlogger.error('cron script not defined');
            reject({'err': 'cron script not defined'});
            return;
        }
        let procScript = spawn(cron_bin_script, [CONFIG.general.script_dir, CONFIG.general.url]);
        procScript.on('exit', function (code, signal) {
            wlogger.info(cron_bin_script + ' process exited with ' +
                        `code ${code} and signal ${signal}`);
            resolve();
        });

        procScript.on('error', (err) => {
            wlogger.error('failed to execute cron scripts', err);
            reject(err);
        });
    });
};

app.all('*', async function(req, res, next){
    if (runningEnv === 'test'){
        res.on('finish', function() {
            wlogger.debug('*test* env, on finish execute cron script');
            if_dev_execute_scripts().then(function(){});
        });
    }

    let logInfo = {
        is_logged: false,
        mail_token: null,
        id: null,
        u2f: null,
        session_user: null
    };
    if(! req.locals) {
        req.locals = {};
    }

    let token = req.headers['x-api-key'] || null;
    let jwtToken = null;
    let authorization = req.headers['authorization'] || null;
    if (authorization) {
        let elts = authorization.split(' ');
        try {
            jwtToken = jwt.verify(elts[elts.length - 1], CONFIG.general.secret);
        } catch(err) {
            wlogger.error('failed to decode jwt');
            jwtToken = null;
        }
    }
    if(jwtToken){
        if(req.session.gomngr){
            req.session.gomngr=null;
            req.session.is_logged = false;
            req.session.mail_token = null;
        }
        try{
            if(jwtToken.isLogged) {
                req.session.is_logged = true;
                logInfo.is_logged = true;
            }
            if(jwtToken.mail_token) {
                req.session.mail_token = jwtToken.mail_token;
                logInfo.mail_token = jwtToken.mail_token;
            }
            if(jwtToken.u2f) {
                logInfo.u2f = jwtToken.u2f;
            }
            if(jwtToken.user) {
                let session_user = await utils.mongo_users().findOne({'_id': ObjectID.createFromHexString(jwtToken.user)});
                if(!session_user){
                    return res.status(401).send('Invalid token').end();
                }
                req.session.gomngr = session_user._id;
                logInfo.id = session_user._id;
                logInfo.session_user = session_user;
                req.locals.logInfo = logInfo;
                next();
            } else {
                req.locals.logInfo = logInfo;
                next();
            }
        }
        catch(error){
            wlogger.error('Invalid token', error);
            return res.status(401).send('Invalid token').end();
        }
    }
    else if(token){
        if(req.session.gomngr){
            req.session.gomngr=null;
            req.session.is_logged = false;
        }
        try{
            let session_user = await utils.mongo_users().findOne({'apikey': token});
            if(!session_user){
                return res.status(401).send('Invalid token').end();
            }
            req.session.gomngr = session_user._id;
            req.session.is_logged = true;
            logInfo.id = session_user._id;
            logInfo.is_logged = true;
            if(req.session.u2f){
                logInfo.u2f = req.session.u2f;
            }
            logInfo.session_user = session_user;
            req.locals.logInfo = logInfo;
            next();
        }
        catch(error){
            wlogger.error('Invalid token', error);
            return res.status(401).send('Invalid token').end();
        }
    }else{
        if(req.session.gomngr) {
            logInfo.id = req.session.gomngr;
        }
        if(req.session.is_logged) {
            logInfo.is_logged = req.session.is_logged;
        }
        if(req.session.mail_token) {
            logInfo.mail_token = req.session.mail_token;
        }
        if(req.session.u2f) {
            logInfo.u2f =req.session.u2f;
        }
        if(req.session.gomngr) {
            let session_user = await utils.mongo_users().findOne({'_id': ObjectID.createFromHexString(req.session.gomngr)});
            if(session_user){
                logInfo.session_user = session_user;
            }
            req.locals.logInfo = logInfo;
            next();
        } else {
            req.locals.logInfo = logInfo;
            next();
        }
    }
});


app.get('/', routes);
app.get('/conf', conf.router);
app.get('/ip', users);
app.get('/log/status/:id/:status', logs);
app.get('/log/:id', logs);
app.get('/log/user/:id', logs);
app.post('/log/user/:id', logs);
app.get('/log', logs);
app.post('/message', users);
app.get('/group', users);
app.post('/group/:id', users);
app.put('/group/:id', users);
app.delete('/group/:id', users);
app.get('/group/:id', users);
app.get('/user', users);
app.get('/database', database);
app.get('/database/owner/:owner', database);
app.post('/database/:id', database);
app.put('/database/:id/owner/:old/:new', database);
app.delete('/database/:id', database);
app.get('/web', web);
app.get('/web/owner/:owner', web);
app.post('/web/:id', web);
app.put('/web/:id/owner/:old/:new', web);
app.delete('/web/:id', web);
app.post('/user/:id', users);
// app.get('/disk/:id', disks);
app.put('/user/:id', users);
app.put('/user/:id/ssh', users);
app.get('/user/:id', users);
app.get('/user/:id/expire', users);
app.get('/user/:id/renew', users);
app.get('/user/:id/renew/:regkey', users);
app.get('/user/:id/activate', users);
app.get('/user/:id/confirm', users);
app.get('/user/:id/passwordreset', users);
app.get('/user/:id/apikey', users);
app.post('/user/:id/apikey', users);
app.post('/user/:id/notify', users);
app.get('/lists', users),
app.get('/list/:list', users),
app.post('/user/:id/passwordreset', users);
app.get('/user/:id/passwordreset/:key', users);
app.post('/user/:id/cloud', users);
app.post('/user/:id/quota', users);
app.delete('/user/:id/cloud', users);
app.post('/user/:id/group/:group', users);
app.get('/user/:id/subscribed', users);
app.put('/user/:id/subscribe', users);
app.put('/user/:id/unsubscribe', users);
app.delete('/user/:id/group/:group', users);
app.delete('/user/:id', users);
app.post('/user/:id/project/:project', users);
app.delete('/user/:id/project/:project', users);
app.get('/user/:id/usage', users);
app.get('/project/:id/users', users);
app.get('/group/:id/projects', projects);
app.get('/ssh/:id', ssh);
app.get('/ssh/:id/public', ssh);
app.get('/ssh/:id/putty', ssh);
app.get('/ssh/:id/private', ssh);
app.get('/project', projects);
app.get('/project/:id', projects);
app.post('/project', projects);
app.post('/project/:id', projects);
app.post('/project/:id/request', projects);
app.delete('/project/:id', projects);
app.put('/project/:id/request', projects);
app.post('/ask/project', projects);
app.post('/dmp/ping', projects);
app.post('/dmp/download', projects);
app.get('/quota/:user/:id', quota);
app.get('/plugin', plugin);
app.get('/plugin/:id', plugin);
app.get('/plugin/:id/:user', plugin);
app.post('/plugin/:id/:user', plugin);
app.post('/plugin/:id/:user/activate', plugin);
app.post('/plugin/:id/:user/deactivate', plugin);
app.get('/tp', tp);
app.post('/tp', tp);
app.delete('/tp/:id', tp);
app.get('/tp/:id', tp);
app.put('/tp/:id/reserve/now', tp);
app.put('/tp/:id/reserve/stop', tp);

app.get('/auth', auth);
app.post('/auth/:id', auth);
app.get('/u2f/register/:id', auth);
app.post('/u2f/register/:id', auth);
app.get('/u2f/auth/:id', auth);
app.post('/u2f/auth/:id', auth);
app.get('/mail/auth/:id', auth);
app.post('/mail/auth/:id', auth);
app.get('/logout', auth);

app.get('/tags', tags);
app.post('/tags/:kind/:id', tags);

app.get('/robots.txt', function (request, response) {
    response.sendFile(path.resolve(__dirname, 'robots.txt'));
});
app.get('/manager', function(request, response){
    response.redirect('/manager2');
});
app.get('/manager/*', function(request, response){
    response.redirect('/manager2');
});
// Default route if no match (for spa handling)
app.get('*', function (request, response) {
    response.sendFile(path.resolve(__dirname, 'manager2/dist/my-ui/index.html'));
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development' || process.env.DEBUG) {
    // eslint-disable-next-line no-unused-vars
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}
else {
    // production error handler
    // no stacktraces leaked to user
    // eslint-disable-next-line no-unused-vars
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });
}

module.exports = app;


utils.init_db().then(async () => {
    await utils.loadAvailableIds();
    utils.load_plugins();
    if(MY_ADMIN_USER !== null){
        wlogger.info('Create admin user');
        await users.create_admin(MY_ADMIN_USER, MY_ADMIN_GROUP);
        if (runningEnv == 'test'){
            wlogger.info('Execute cron script');
            await if_dev_execute_scripts();
            wlogger.info('Test setup scripts executed');
        }
    }

    if (!module.parent) {
        http.createServer(app).listen(app.get('port'), function(){
            wlogger.info('Server listening on port ' + app.get('port'));
        });
    }

});
