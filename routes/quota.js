
var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var path = require('path');
var http = require('http');
const winston = require('winston');
const logger = winston.loggers.get('gomngr');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

router.get('/quota/:user/:id', function(req, res) {
    /*
      "quota": {
      "home": {
      "protocol": "http",
      "port": 8086,
      "hostname": "gomngr",
      "db": "goacct",
      "series": "goacct.fixed.disk.home.user.#USER#"
      },
      "omaha": {
      "protocol": "http",
      "port": 8086,
      "hostname": "gomngr",
      "db": "goacct",
      "series": "goacct.fixed.disk.panasas-omaha.user.#USER#"
      }
      curl "http://localhost:8086/query?db=goacct&q=SELECT%20last(%22value%22)%20FROM%20%22goacct.fixed.disk.home.user.osallou%22"
      {"results":[{"series":[{"name":"goacct.fixed.disk.home.user.osallou","columns":["time","last"],"values":[["2017-01-25T04:00:10Z",6.737533e+06]]}]}]}

    */
    var quotas = [];
    var serie = GENERAL_CONFIG.quota[req.param('id')]['series'].replace("#USER#", req.param('user'));
    var options = {
        protocol: GENERAL_CONFIG.quota[req.param('id')]['protocol'],
        port: GENERAL_CONFIG.quota[req.param('id')]['port'],
        host: GENERAL_CONFIG.quota[req.param('id')]['hostname'],
        path: '/query?db=' + GENERAL_CONFIG.quota[req.param('id')]['db'] + "&q=SELECT%20last(%22value%22)%20FROM%20/" + serie + "/"
    };
    http.get(options
	     , function(response){

		 var body = '';
		 response.on('data', function(d) {
		     body += d;
		 });
		 response.on('end', function() {
		     // {"results":[{"series":[{"name":"goacct.fixed.disk.home.user.osallou","columns":["time","last"],"values":[["2017-01-25T04:00:10Z",6.737533e+06]]},{"name":"goacct.fixed.disk.home_capacity.user.osallou","columns":["time","last"],"values":[["2017-01-25T04:00:10Z",1.048576e+08]]}]}]}
		     var points = JSON.parse(body);
		     var series = points.results[0]['series'];
		     // If no stat available
		     if(series == undefined) {
			 res.status(404);
			 res.end();
			 return;
		     }
		     for(var s=0;s<series.length;s++){
			 quotas.push(series[s]['values'][0][1] / 1000000)
		     }
		     if(quotas.length==0){
			 quotas.push(0);
			 quotas.push(0);
		     }
		     if(quotas.length==1){
			 quotas.push(0);
		     }
		     res.send({'name': req.param('id'), 'value': quotas[0], 'max': quotas[1]});

		     res.end();
		 });
	     });


});



module.exports = router;
