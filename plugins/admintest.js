var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users'),
    events_db = db.get('events');

var Promise = require('promise');


module.exports = {
    get_data: function(userId, adminId){
        return new Promise(function (resolve, reject){
            users_db.find({}, function(err, users){
                if(err) {
                    return {'list': [], 'selected': null}
                }
                let result = [];
                for(let i=0;i<users.length;i++){
                    let user = users[i];
                    if(user.plugin && user.plugin.quota){
                        result.push({'id': user.uid, 'quota': user.plugin.quota.value, 'expire': user.plugin.quota.expire})
                    } else {
                        result.push({'id': user.uid, 'quota': [100, 100], 'expire': 0})
                    }
                }
                resolve({
                    'list': result,
                    'selected': null
                })
            })
        });
    },
    set_data: function(userId, data, adminId){
        return new Promise(function (resolve, reject){
            if(data.selected && data.selected.id) {
                console.log('[plugin admintest] TODO update ' + data.selected);
            }
            users_db.update({'uid': data.selected.id}, {'$set': {'plugin.quota': {'value': data.selected.quota, 'expire': data.selected.expire}}}, function(err){
                events_db.insert({'owner': adminId, 'date': new Date().getTime(), 'action': 'change ' + data.selected.id + ' quota', 'logs': []}, function(err){ return;});
                resolve(data);
            })
 
        });
    }
}


