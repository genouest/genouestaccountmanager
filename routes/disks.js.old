var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var path = require('path');

var CONFIG = require('config');

router.get('/disk/:id', function(req, res) {
  var hdisk = '';
  var odisk = '';
  fs.readFile(CONFIG.general.usage_directory+'/home_'+req.param('id')+'.txt', {encoding: 'utf-8'}, function(err, hdata){
    var lines = [];
    if(hdata) { lines = hdata.split("\n");}
    for(var i=0;i<lines.length;i++){
      if(lines[i].indexOf('Total size') == 0) {
        hdisk = lines[i];
        break;
      }
    }
    fs.readFile(CONFIG.general.usage_directory+'/omaha_'+req.param('id')+'.txt', {encoding: 'utf-8'}, function(err, odata){
      var lines = [];
      if(odata) { lines = odata.split("\n"); }
      for(var i=0;i<lines.length;i++){
        if(lines[i].indexOf('Total size') == 0) {
          odisk = lines[i];
          break;
        }
      }
      fs.stat(CONFIG.general.usage_directory+'/home_'+req.param('id')+'.txt', function(err,hstats){
        fs.stat(CONFIG.general.usage_directory+'/omaha_'+req.param('id')+'.txt', function(err,ostats){
          var hmtime = new Date().getTime();
          var omtime = new Date().getTime();
          if(hstats){
            hmtime = hstats.mtime;
          }
          if(ostats){
            omtime = ostats.mtime;
          }
          res.send({home: hdisk, omaha: odisk, home_date: hmtime, omaha_date: omtime});
          res.end();
          return;
        });
      });
    });

  });

});

module.exports = router;
