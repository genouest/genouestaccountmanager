/* eslint-disable no-console */
const CONFIG = require('config');
const http = require('http');
var GENERAL_CONFIG = CONFIG.general;


const Promise = require('promise');


var get_quota = function(quota) {
    // eslint-disable-next-line no-unused-vars
    return new Promise(function(resolve, reject) {
        let quotas = [];
        let quota_name = quota['quota_name'];
        let user = quota['user'];
        let serie = GENERAL_CONFIG.quota[quota_name]['series'].replace('#USER#', user);
        let options = {
            protocol: GENERAL_CONFIG.quota[quota_name]['protocol'],
            port: GENERAL_CONFIG.quota[quota_name]['port'],
            host: GENERAL_CONFIG.quota[quota_name]['hostname'],
            path: '/query?db=' + GENERAL_CONFIG.quota[quota_name]['db'] + '&q=SELECT%20last(%22value%22)%20FROM%20/' + serie + '/'
        };
        http.get(options
            , function(response){
                let body = '';
                response.on('data', function(d) {
                    body += d;
                });
                response.on('end', function() {
                    let points = JSON.parse(body);
                    let series = points.results[0]['series'];
                    // If no stat available
                    if(series === undefined) {
                        resolve({'msg': 'no data'});
                        return;
                    }
                    for(let s=0;s<series.length;s++){
                        quotas.push(series[s]['values'][0][1] / 1000000);
                    }
                    if(quotas.length==0){
                        quotas.push(0);
                        quotas.push(0);
                    }
                    if(quotas.length==1){
                        quotas.push(0);
                    }
                    let warning = null;
                    let error = null;
                    if(quotas[1] > 0 && quotas[0]/quotas[1] > 0.99) {
                        error = quota_name + ' quota reached!';
                    }
                    else if(quotas[1] > 0 && quotas[0]/quotas[1] > 0.8) {
                        warning = quota_name + ' quota using more than 80% of use';
                    }
                    resolve({'name': quota_name, 'value': quotas[0], 'max': quotas[1], 'warning': warning, 'error': error});
                });
            });
    });
};

var get_user_info = function(userId){
    // eslint-disable-next-line no-unused-vars
    return new Promise(function (resolve, reject){
        //var quotas = [];
        //var quota_name = null;
        let quota_names = [];
        for(let key in GENERAL_CONFIG.quota) {
            quota_names.push({'quota_name': key, 'user': userId});
        }
        Promise.all(quota_names.map(get_quota)).then(function(values){
            let errors = [];
            let warnings = [];
            for(let i=0;i<values.length;i++) {
                if(values[i].warning) { warnings.push(values[i].warning); }
                if(values[i].error) { errors.push(values[i].error); }
            }
            resolve({'quotas': values, 'warnings': warnings, 'errors': errors});
        });

    });
};


module.exports = {

    // eslint-disable-next-line no-unused-vars
    activate: function(userId, data, adminId){
        console.log('Plugin quotas for activation of user : ' + userId);
        // eslint-disable-next-line no-unused-vars
        return new Promise(function (resolve, reject){
            console.log('[Quotas] nothing to do');
            resolve();
        });
    },
    // eslint-disable-next-line no-unused-vars
    deactivate: function(userId, data, adminId){
        console.log('Plugin quotas for deactivation of user : ' + userId);
        // eslint-disable-next-line no-unused-vars
        return new Promise(function (resolve, reject){
            console.log('[Quotas] nothing to do');
            resolve();
        });
    },
    template: function(){
        //return "<input ng-model=\"plugin_data.test.my\"></input> ";
        let template='<div class="table-responsive">' +
            '<table class="table table-striped ng-scope">' +
            '<tr><th>Namespace</th><th>Used</th><th>Max</th></tr>' +
            '<tr ng-repeat="quota in plugin_data.quota.quotas">'+
            '<td>{{quota.name}}</td>'+
            '<td>{{quota.value | number: 2}} G</td>'+
            '<td>{{quota.max | number: 2}} G</td>'+
            '</tr>'+
            '</table>'+
            '</div>';
        return template;
    },
    // eslint-disable-next-line no-unused-vars
    get_data: function(userId, adminId){
        return get_user_info(userId);
    },
    // eslint-disable-next-line no-unused-vars
    set_data: function(userId, data, adminId){
        // eslint-disable-next-line no-unused-vars
        return new Promise(function(resolve, reject){
            console.log('[Quotas] Nothing to do');
            resolve();
        });
    }
};
