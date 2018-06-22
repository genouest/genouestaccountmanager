process.env.NODE_ENV = 'test';


//Require the dev-dependencies
let chai = require('chai');
let chaiHttp = require('chai-http');
//let server = require('../app');
let should = chai.should();
let expect = chai.expect;
let assert = chai.assert;

chai.use(chaiHttp);

var token_id = null;
var user_token_id = null;

var test_user_id = 'test' + Math.random().toString(10).slice(-6);
var test_group_id = 'test' + Math.random().toString(10).slice(-6);
var user_test_password = null;

describe('My', () => {
    beforeEach((done) => { //Before each test we empty the database
        chai.request('http://localhost:8025')
            .delete('/api/v1/messages')
            .end((err, res) => {
                res.should.have.status(200);
                done();
            });
    });

  describe('/GET route', () => {
      it('it should GET redirected', (done) => {
        chai.request('http://localhost:3000')
            .get('/')
            .end((err, res) => {
                res.should.have.status(200);
                assert(res.redirects.length == 1);
                done();
            });
      });
  });

  describe('/POST Login', () => {
      it('login should work', (done) => {
        chai.request('http://localhost:3000')
            .post('/auth/admin')
            .send({'password': 'admin'})
            .end((err, res) => {
                res.should.have.status(200);
                token_id = res.body.user._id;
                assert(res.body.user.status == 'Active');
                done();
            });
      });
      it('login should fail', (done) => {
        chai.request('http://localhost:3000')
            .post('/auth/admin')
            .send({'password': 'wrong'})
            .end((err, res) => {
                res.should.have.status(200);
                assert(res.body.user === null);
                done();
            });
      });
  });

  describe('/GET users', () => {
      it('list users', (done) => {
        chai.request('http://localhost:3000')
            .get('/user')
            .set('X-Api-Key', token_id)
            .end((err, res) => {
                res.should.have.status(200);
                assert(res.body.length >= 1);
                assert(res.body[0].uid == 'admin');
                done();
            });
      });
  });

  describe('register user', () => {
      it('register user test', (done) => {
        // console.log('register', test_user_id, test_group_id);
        chai.request('http://localhost:3000')
            .post('/user/' + test_user_id)
            .send({
                'firstname': 'ftest',
                'lastname': 'ltest',
                'email': test_user_id + '@my.org',
                'address': 'test address',
                'lab': 'test',
                'responsible': 'test manager',
                'group': test_group_id,
                'why': 'because',
                'ip': '127.0.0.1',
                'duration': 365
            })
            .end((err, res) => {
                assert(res.body.status == 0);
                // Delay to wait for mail
                setTimeout(function(){
                    chai.request('http://localhost:8025')
                        .get('/api/v2/messages')
                        .end((err, resMsg) => {
                            resMsg.should.have.status(200);
                            // check email confirmation sent
                            let gotMail = false;
                            let msg_list = JSON.parse(resMsg.text);
                            for(var i=0;i<msg_list.items.length;i++){
                                let raw = msg_list.items[i].Raw;
                                let mailIndex = raw.To.indexOf(test_user_id + '@my.org');
                                if(mailIndex >= 0){
                                    gotMail = true;
                                    //regkey=XXXX
                                    let matches = raw.Data.match(/regkey=(\w+)/);
                                    // console.log('matches', matches);
                                    assert(matches.length > 0);
                                    let regkey = matches[1];
                                    // Now confirm email
                                    chai.request('http://localhost:3000')
                                        .get('/user/' + test_user_id + '/confirm?regkey=' + regkey)
                                        .end((err, resConfirm) => {
                                            resConfirm.should.have.status(200);
                                            done();
                                        });
                                    break;
                                }
                            }
                        assert(gotMail === true);
                    });
                }, 1000);
            });
      });
  });

  describe('test user is in pending approval', () => {
      it('list users', (done) => {
        chai.request('http://localhost:3000')
            .get('/user')
            .set('X-Api-Key', token_id)
            .end((err, res) => {
                res.should.have.status(200);
                assert(res.body.length >= 1);
                let pending_user = null;
                for(var i=0;i<res.body.length;i++){
                    if(res.body[i].uid == test_user_id){
                        pending_user = res.body[i];
                    }
                }
                assert(pending_user != null);
                assert(pending_user.status == 'Waiting for admin approval');
                done();
            });
      });
  });

  describe('admin activates test user', () => {
      it('group does not exists', (done) => {
          //app.get('/group/:id', users)
          chai.request('http://localhost:3000')
              .get('/group')
              .set('X-Api-Key', token_id)
              .end((err, res) => {
                  let group_exists = false;
                  for(var i=0;i<res.body;i++){
                      if(res.body[i].name == test_group_id){
                          group_exists = true;
                          break;
                      }
                  }
                  assert(! group_exists);
                  done();
              });
      });
      it('create group', (done) => {
          chai.request('http://localhost:3000')
              .post('/group/' + test_group_id)
              .set('X-Api-Key', token_id)
              .send({'owner': test_user_id})
              .end((err, res) => {
                  res.should.have.status(200);
                  chai.request('http://localhost:3000')
                      .get('/group')
                      .set('X-Api-Key', token_id)
                      .end((err, res) => {
                          let group_exists = false;
                          for(var i=0;i<res.body.length;i++){
                              if(res.body[i].name == test_group_id){
                                  group_exists = true;
                                  break
                              }
                          }
                          assert(group_exists);
                          done();
                      });
              });
      })

      it('activate user', (done) => {
        chai.request('http://localhost:3000')
            .get('/user/' + test_user_id + '/activate')
            .set('X-Api-Key', token_id)
            .end((err, res) => {
                res.should.have.status(200);
                chai.request('http://localhost:3000')
                    .get('/user/' + test_user_id)
                    .set('X-Api-Key', token_id)
                    .end((err, res) => {
                        res.should.have.status(200);
                        assert(res.body.status == 'Active');
                        setTimeout(function(){
                            chai.request('http://localhost:8025')
                                .get('/api/v2/messages')
                                .end((err, resMsg) => {
                                    resMsg.should.have.status(200);
                                    // check email confirmation sent
                                    let gotMail = false;
                                    let msg_list = JSON.parse(resMsg.text);
                                    for(var i=0;i<msg_list.items.length;i++){
                                        let raw = msg_list.items[i].Raw;
                                        let mailIndex = raw.To.indexOf(test_user_id + '@my.org');
                                        if(mailIndex >= 0 && raw.Data.indexOf('Subject: my account activation') >= 0){
                                            gotMail = true;
                                            let password = raw.Data.match(/Password:\s(\w+)/);
                                            assert(password.length > 0);
                                            user_test_password = password[1];
                                            break;
                                        }
                                    }
                                    assert(gotMail === true);
                                    assert(user_test_password !== null);
                                    done();
                            });
                        }, 1000);
                    });
            });
      });

  });

  describe('user actions', () => {
      it('User can login', (done) => {
          // Need to wait for cron to run
              chai.request('http://localhost:3000')
                  .post('/auth/' + test_user_id)
                  .send({'password': user_test_password})
                  .end((err, res) => {
                      res.should.have.status(200);
                      assert(res.body.user !== null);
                      token_id = res.body.user._id;
                      assert(res.body.user.status == 'Active');
                      done();
                  });
      });
    });

});
