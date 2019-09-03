var express = require('express');
var router = express.Router();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var Promise = require('promise');
var fs = require('fs');

var CONFIG = require('config');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users'),
    events_db = db.get('events');
/**
app.get('/ssh/:id', ssh);
app.get('/ssh/:id/public', ssh);
app.get('/ssh/:id/putty', ssh);
app.get('/ssh/:id/private', ssh);
*/

router.get('/ssh/:id/putty', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }
        var maingroup = "";
        if(user.maingroup!== undefined && user.maingroup!=""){
            maingroup = "/"+ user.maingroup;
        }
        var sshDir = user.home + "/.ssh";
        res.download(sshDir + "/id_rsa.ppk");
    });
});

router.get('/ssh/:id/private', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }
        if(CONFIG.general.admin.indexOf(user.uid) >= 0){
            res.status(401).send('[admin user] not authorized to download private key');
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }
        var maingroup = "";
        if(user.maingroup!== undefined && user.maingroup!==""){
            maingroup = "/"+ user.maingroup;
        }
        var sshDir = user.home + "/.ssh";
        res.download(sshDir + "/id_rsa");
    });
});

router.get('/ssh/:id/public', function(req, res) {
    var sess = req.session;
    if(! req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }
        var maingroup = "";
        if(user.maingroup!== undefined && user.maingroup!==""){
            maingroup = "/"+ user.maingroup;
        }
        var sshDir = user.home + "/.ssh";
        res.download(sshDir + "/id_rsa.pub");
    });
});

router.get('/ssh/:id', function(req, res) {
    var sess = req.session;
    if(!req.locals.logInfo.is_logged) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({uid: req.param('id')}, function(err, user){
        if(err){
            res.status(500).send(err);
            return;
        }
        if(!user) {
            res.send({msg: 'User does not exists'})
            res.end();
            return;
        }
        if(user._id.str != req.locals.logInfo.id.str){
            res.status(401).send('Not authorized');
            return;
        }

        var fid = new Date().getTime();
        var script = "#!/bin/bash\n";
        script += "set -e \n";
        var script_file = CONFIG.general.script_dir+'/'+user.uid+"."+fid+".update";
        var maingroup = "";
        if(user.maingroup!== undefined && user.maingroup!==""){
            maingroup = "/"+ user.maingroup;
        }
        var homeDir = user.home;
        var sshDir = homeDir + "/.ssh";
        script += "rm -f " + sshDir + "/id_rsa*\n";
        script += "touch " + sshDir + "/authorized_keys\n";
        script += "chmod 644 " + sshDir + "/authorized_keys\n";
        // script += "mv " + sshDir + "/authorized_keys " + sshDir + "/authorized_keys." + fid +"\n";
        if(user.email){
            script += "ssh-keygen -t rsa -b 4096 -C \"" + user.email + "\"";
        }
        else {
            script += "ssh-keygen -t rsa -b 4096 ";
        }
        script += " -f " + sshDir + "/id_rsa -N \"\"\n";
        script += "puttygen " + sshDir + "/id_rsa -o " + sshDir + "/id_rsa.ppk\n";
        script += "cat " + sshDir + "/id_rsa.pub >> " + sshDir + "/authorized_keys\n";
        script += "chown " + user.uid + ":" + user.group + " " + sshDir + "/*\n";
        script += "chmod 600 " + sshDir + "/id_rsa\n";
        script += "chmod 600 " + sshDir + "/id_rsa.pub\n";
        script += "chmod 700 " + sshDir + "\n";

        fs.writeFile(script_file, script, function(err) {
            fs.chmodSync(script_file,0o755);
            events_db.insert({'owner': user.uid, 'date': new Date().getTime(), 'action': 'Generate new ssh key' , 'logs': [user.uid+"."+fid+".update"]}, function(err){});
            res.send({'msg': 'SSH key will be generated, refresh page in a minute to download your key'});
            res.end();
            return;
        });
    });
});

module.exports = router;
