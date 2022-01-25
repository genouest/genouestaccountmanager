const axios = require('axios');
const idsrv = require('../core/id.service.js');


async function auth_from_opidor () {
    const options = {
        headers: {
            accept: "application/json",
        },
        data: "{\"grant_type\":\"client_credentials\",\"client_id\":\"b00dadbf-f8c8-422f-9a81-ae798c527613\",\"client_secret\":\"12bc248b-5875-4cb6-9fe9-ec083cfda000\"}"
    };
    let resp = await axios.post('https://opidor-preprod.inist.fr/api/v1/authenticate', options);
    return resp.data;
}

exports.opidor_token_refresh = function () {
    let current_time = Math.floor((new Date()).getTime() / 1000);
    let token = null;
    idsrv.redis_client.mget(['my:dmp:token','my:dmp:expiration'], function(err, reply) {
        if (!reply[0] && reply[1] > current_time) {
            console.log(reply);
            token = reply[0];
        }
        else {
            let response = auth_from_opidor();
            token = response.access_token;
            idsrv.redis_client.set('my:dmp:token', response.access_token);
            idsrv.redis_client.set('my:dmp:expiration', response.expires_in);
        }
    
    });
    return token;
};
