process.env.NODE_ENV = 'test';

// let CONFIG = require('config');
// Require the dev-dependencies
let chai = require('chai');
let chaiHttp = require('chai-http');
// let server = require('../app');
// let should = chai.should;
let expect = chai.expect;
let assert = chai.assert;

let fs = require('fs');

chai.use(chaiHttp);

var token_id = null;
var user_token_id = null;

var test_user_id = 'test' + Math.random().toString(10).slice(-6);
var test_user_id2 = 'test2' + Math.random().toString(10).slice(-6);
var test_group_id = 'test' + Math.random().toString(10).slice(-6);
var test_group_id2 = 'test2' + Math.random().toString(10).slice(-6);
var test_group_id3 = 'test3' + Math.random().toString(10).slice(-6);
var test_web_id = 'webtest' + Math.random().toString(10).slice(-6);
var test_db_id = 'dbtest' + Math.random().toString(10).slice(-6);
var test_db_id2 = 'dbtest2' + Math.random().toString(10).slice(-6);
var test_project_id = 'projecttest' + Math.random().toString(10).slice(-6);
var user_test_password = null;
var user_info = null;

describe('My', () => {
    beforeEach((done) => { //Before each test we empty the database
        chai.request('http://localhost:8025')
            .delete('/api/v1/messages')
            .end((err, res) => {
                expect(res).to.have.status(200);
                done();
            });
    });


    describe('/POST Login', () => {
        it('login should work', (done) => {
            chai.request('http://localhost:3000')
                .post('/auth/admin')
                .send({'password': 'admin'})
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    token_id = res.body.user.apikey;
                    assert(res.body.user.status == 'Active');
                    done();
                });
        });
        it('login should fail', (done) => {
            chai.request('http://localhost:3000')
                .post('/auth/admin')
                .send({'password': 'wrong'})
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    //assert(res.body.user === null);
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
                    expect(res).to.have.status(200);
                    assert(res.body.length >= 1);
                    assert(res.body[0].uid == 'admin');
                    done();
                });
        });
    });

    describe('register user', () => {
        it('register user test', (done) => {
            chai.request('http://localhost:3000')
                .post('/user/' + test_user_id)
                .send({
                    'firstname': 'ftest',
                    'lastname': 'ltest',
                    'email': test_user_id + '@my.org',
                    'address': 'test address',
                    'lab': 'test',
                    'responsible': 'test manager',
                    'team': test_group_id,
                    'why': 'because',
                    'ip': '127.0.0.1',
                    'duration': '1 year'
                })
                .end((err, res) => {
                    assert(res.body.status == 0);
                    // Delay to wait for mail
                    setTimeout(function(){
                        chai.request('http://localhost:8025')
                            .get('/api/v2/messages')
                            .end((err, resMsg) => {
                                expect(resMsg).to.have.status(200);
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
                                        assert(matches.length > 0);
                                        let regkey = matches[1];
                                        // Now confirm email
                                        chai.request('http://localhost:3000')
                                            .get('/user/' + test_user_id + '/confirm?regkey=' + regkey)
                                            .end((err, resConfirm) => {
                                                expect(resConfirm).to.have.status(200);
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
        it('register user test2', (done) => {
            chai.request('http://localhost:3000')
                .post('/user/' + test_user_id2)
                .send({
                    'firstname': 'ftest2',
                    'lastname': 'ltest2',
                    'email': test_user_id2 + '@my.org',
                    'address': 'test address',
                    'lab': 'test',
                    'responsible': 'test manager',
                    'team': test_group_id2,
                    'why': 'because',
                    'ip': '127.0.0.1',
                    'duration': '1 year'
                })
                .end((err, res) => {
                    assert(res.body.status == 0);
                    done();
                });
        });
    });

    describe('test user is in pending approval', () => {
        it('list users', (done) => {
            chai.request('http://localhost:3000')
                .get('/user')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
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
        it('group does not exist', (done) => {
            //app.get('/group/:id', users)
            chai.request('http://localhost:3000')
                .get('/group')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    let group_exists = false;
                    for(var i=0;i<res.body.length;i++){
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
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/group')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            let group_exists = false;
                            for(var i=0;i<res.body.length;i++){
                                if(res.body[i].name == test_group_id){
                                    group_exists = true;
                                    break;
                                }
                            }
                            assert(group_exists);
                            done();
                        });
                });
        });

        it('create group2', (done) => {
            chai.request('http://localhost:3000')
                .post('/group/' + test_group_id2)
                .set('X-Api-Key', token_id)
                .send({'owner': test_user_id2})
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/group')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            let group_exists = false;
                            for(var i=0;i<res.body.length;i++){
                                if(res.body[i].name == test_group_id2){
                                    group_exists = true;
                                    break;
                                }
                            }
                            assert(group_exists);
                            done();
                        });
                });
        });

        it('create group3', (done) => {
            chai.request('http://localhost:3000')
                .post('/group/' + test_group_id3)
                .set('X-Api-Key', token_id)
                .send({'owner': test_user_id})
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/group')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            let group_exists = false;
                            for(var i=0;i<res.body.length;i++){
                                if(res.body[i].name == test_group_id3){
                                    group_exists = true;
                                    break;
                                }
                            }
                            assert(group_exists);
                            done();
                        });
                });
        });

        it('activate user', (done) => {
            chai.request('http://localhost:3000')
                .get('/user/' + test_user_id + '/activate')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/user/' + test_user_id)
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            user_info = res.body;
                            assert(res.body.status == 'Active');
                            setTimeout(function(){
                                chai.request('http://localhost:8025')
                                    .get('/api/v2/messages')
                                    .end((err, resMsg) => {
                                        expect(resMsg).to.have.status(200);
                                        // check email confirmation sent
                                        let gotMail = false;
                                        let msg_list = JSON.parse(resMsg.text);
                                        for(var i=0;i<msg_list.items.length;i++){
                                            let raw = msg_list.items[i].Raw;
                                            let mailIndex = raw.To.indexOf(test_user_id + '@my.org');
                                            if(mailIndex >= 0 && raw.Data.indexOf('Subject: my account activation') >= 0){
                                                gotMail = true;
                                                let password = raw.Data.match(/Password:\s(.*)\s*$/m);
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

        it('activate user2', (done) => {
            chai.request('http://localhost:3000')
                .get('/user/' + test_user_id2 + '/activate')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/user/' + test_user_id2)
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            user_info = res.body;
                            assert(res.body.status == 'Active');
                            done();
                        });
                });
        });

        it('Admin add test user to admin secondary group', (done) => {
            // router.post('/user/:id/group/:group'
            chai.request('http://localhost:3000')
                .post('/user/' + test_user_id + '/group/admin')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    // assert(res.body.fid); // fid should not be used by frontend as if it is changed it may be a security issue
                    assert(res.body.message == 'User added to group');
                    done();
                });
        });

        it('Add test user2 to admin secondary group', (done) => {
            // router.post('/user/:id/group/:group'
            chai.request('http://localhost:3000')
                .post('/user/' + test_user_id2 + '/group/admin')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    assert(res.body.message == 'User added to group');
                    // assert(res.body.fid);
                    done();
                });
        });

        it('Add test user2 to group3 secondary group', (done) => {
            // router.post('/user/:id/group/:group'
            chai.request('http://localhost:3000')
                .post('/user/' + test_user_id2 + '/group/' + test_group_id3)
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    // assert(res.body.fid);
                    assert(res.body.message == 'User added to group');
                    done();
                });
        });

        it('test user is in admin secondary group', (done) => {
            // router.post('/user/:id/group/:group'
            chai.request('http://localhost:3000')
                .get('/user/' + test_user_id)
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    assert(res.body.secondarygroups.indexOf('admin') >= 0);
                    done();
                });
        });

        it('test user2 is in admin and group3 secondary group', (done) => {
            // router.post('/user/:id/group/:group'
            chai.request('http://localhost:3000')
                .get('/user/' + test_user_id2)
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    assert(res.body.secondarygroups.indexOf('admin') >= 0);
                    assert(res.body.secondarygroups.indexOf(test_group_id3) >= 0);
                    done();
                });
        });


        it('Activated user has home dir', (done) => {
            // Run a timer every seconds for a max of 5 seconds to let creation script be executed
            var nb_timer = 0;

            let check_home = function(){
                let base_home = process.env.MY_HOME || './tests/home_dir';
                let home_path = base_home + '/' + user_info.maingroup + '/' + test_group_id + '/' + test_user_id;
                if(fs.existsSync(home_path)){
                    clearInterval(timer);
                    done();
                }
                else {
                    if(nb_timer>10){
                        clearInterval(timer);
                        assert(false);
                        done();
                    }
                    nb_timer += 1;
                }
            };
            var timer = setInterval(check_home, 1000);

        });


    });

    describe('admin actions', () => {
        it('Admin declare web site', (done) => {
            let website = {
                name: test_web_id,
                url: 'http://localhost/webtest',
                description: 'some web site',
                owner: 'user1'
            };
            chai.request('http://localhost:3000')
                .post('/web/' + test_web_id)
                .set('X-Api-Key', token_id)
                .send(website)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/web')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].name == test_web_id){
                                    found = true;
                                    break;
                                }
                            }
                            assert(found);
                            done();
                        });
                });
        });
        it('Admin change owner web site', (done) => {
            chai.request('http://localhost:3000')
                .put('/web/' + test_web_id + '/owner/user1/user2')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/web')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].name == test_web_id && res.body[i].owner == 'user2'){
                                    found = true;
                                    break;
                                }
                            }
                            assert(found);
                            done();
                        });
                });
        });

        it('Admin delete web site', (done) => {

            chai.request('http://localhost:3000')
                .delete('/web/' + test_web_id)
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/web')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].name == test_web_id){
                                    found = true;
                                    break;
                                }
                            }
                            assert(!found);
                            done();
                        });
                });
        });

        it('Admin creates project', (done) => {
            let project = {
                'id': test_project_id,
                'owner': test_user_id,
                'group': test_group_id,
                'size': 1,
                'expire': 1546300800000,
                'description': 'a test project',
                'access': 'Group',
                'orga': 'test',
                'path': '/test'
            };
            chai.request('http://localhost:3000')
                .post('/project')
                .set('X-Api-Key', token_id)
                .send(project)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/project?all=true')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].id == test_project_id){
                                    found = true;
                                    break;
                                }
                            }
                            assert(found);
                            done();
                        });
                });
        });

        it('As project owner user is in project', (done) => {
            chai.request('http://localhost:3000')
                .get('/project/' + test_project_id + '/users')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    let found = false;
                    for(let i=0; i<res.body.length; i++){
                        if(res.body[i].uid == test_user_id){
                            found = true;
                            break;
                        }
                    }
                    assert(found);
                    done();
                });

        });

        it('Admin adds user2 to project', (done) => {
            chai.request('http://localhost:3000')
                .post('/user/' + test_user_id2 + '/project/' + test_project_id)
                .set('X-Api-Key', token_id)
                .end((err, res) => {

                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/project/' + test_project_id + '/users')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].uid == test_user_id){
                                    found = true;
                                    break;
                                }
                            }
                            assert(found);
                            done();
                        });
                });
        });
        it('Admin validates database', (done) => {
            let db = {
                name: test_db_id,
                type: 'mysql',
                usage: 'To test',
                size: '10',
                expire: String(Date.now() + 10000),
                single_user: true,
                create: true

            };
            
            chai.request('http://localhost:3000')
                .post('/database/' + test_db_id)
                .set('X-Api-Key', token_id)
                .send(db)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/database')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
  
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].name == test_db_id){
                                    found = true;
                                    break;
                                }
                            }
                            assert(found);
                            done();
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
                    expect(res).to.have.status(200);
                    assert(res.body.user !== null);
                    user_token_id = res.body.user.apikey;
                    assert(res.body.user.status == 'Active');
                    done();
                });
        });

        it('User automatic auth', (done) => {
            // Need to wait for cron to run
            chai.request('http://localhost:3000')
                .get('/auth')
                .set('X-Api-Key', user_token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    assert(res.body.user !== null);
                    done();
                });
        });

        it('User can edit details', (done) => {
            // Need to wait for cron to run
            chai.request('http://localhost:3000')
                .put('/user/' + test_user_id)
                .set('X-Api-Key', user_token_id)
                .send({
                    'firstname': 'ftest',
                    'lastname': 'ltest',
                    'email': test_user_id + '@my.org',
                    'address': 'test address',
                    'lab': 'new',
                    'responsible': 'test manager',
                    'group': test_group_id,
                    'why': 'because',
                    'ip': '127.0.0.1',
                    'duration': '1 year',
                    'loginShell': '/bin/bash'
                })
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/user/' + test_user_id)
                        .set('X-Api-Key', user_token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            assert(res.body.lab == 'new');
                            done();
                        });
                });
        });

        // it('User declare database', (done) => {
        //     let db = {
        //         name: test_db_id,
        //         type: 'mysql'
        //     };
        //     chai.request('http://localhost:3000')
        //         .post('/database/' + test_db_id)
        //         .set('X-Api-Key', user_token_id)
        //         .send(db)
        //         .end((err, res) => {
        //             expect(res).to.have.status(200);
        //             chai.request('http://localhost:3000')
        //                 .get('/database')
        //                 .set('X-Api-Key', user_token_id)
        //                 .end((err, res) => {
        //                     expect(res).to.have.status(200);
        //                     let found = false;
        //                     for(let i=0; i<res.body.length; i++){
        //                         if(res.body[i].name == test_db_id){
        //                             found = true;
        //                             break;
        //                         }
        //                     }
        //                     assert(found);
        //                     done();
        //                 });
        //         });
        // });

        it('User requests database', (done) => {
            let db = {
                name: test_db_id2,
                type: 'mysql',
                usage: 'To test',
                size: '10',
                expire: String(Date.now() + 10000),
                single_user: true,
                create: true

            };
            chai.request('http://localhost:3000')
                .post('/requestdatabase/' + test_db_id2)
                .set('X-Api-Key', user_token_id)
                .send(db)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/pending/database')
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].name == test_db_id2){
                                    found = true;
                                    break;
                                }
                            }
                            assert(found);
                            done();
                        });
                });
        });

       

        it('User delete database', (done) => {

            chai.request('http://localhost:3000')
                .delete('/database/' + test_db_id)
                .set('X-Api-Key', user_token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/database')
                        .set('X-Api-Key', user_token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            let found = false;
                            for(let i=0; i<res.body.length; i++){
                                if(res.body[i].name == test_db_id){
                                    found = true;
                                    break;
                                }
                            }
                            assert(!found);
                            done();
                        });
                });
        });

    });

    describe('Test auto group suppression', () => {
        it('Remove user2 from secondary group test3', (done) => {
            chai.request('http://localhost:3000')
                .delete('/user/' + test_user_id2 + '/group/' + test_group_id3)
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/user/' + test_user_id2)
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(200);
                            assert(res.body.secondarygroups.indexOf(test_group_id3) == '-1');
                            done();
                        });
                });
        });
        /* Nope user1 is still owner
        it('Deleted group3, did not delete admin', (done) => {
            chai.request('http://localhost:3000')
                .get('/group')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    //let g3_was_deleted = true;
                    let admin_was_not_deleted = false;
                    for(var i=0;i<res.body.length;i++){
                        if(res.body[i].name == test_group_id3){
                            g3_was_deleted = false;
                        }
                        if(res.body[i].name == 'admin'){
                            admin_was_not_deleted = true;
                        }
                    }
                    assert(g3_was_deleted, 'group 3 not deleted');
                    assert(admin_was_not_deleted, 'admin was deleted');
                    done();
                });
        });
        */

        it('Deleted user2', (done) => {
            chai.request('http://localhost:3000')
                .delete('/user/' + test_user_id2)
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    chai.request('http://localhost:3000')
                        .get('/user/' + test_user_id2)
                        .set('X-Api-Key', token_id)
                        .end((err, res) => {
                            expect(res).to.have.status(404);
                            done();
                        });
                });
        });

        it('Deleted group2, did not delete admin', (done) => {
            chai.request('http://localhost:3000')
                .get('/group')
                .set('X-Api-Key', token_id)
                .end((err, res) => {
                    let g2_was_deleted = true;
                    let admin_was_not_deleted = false;
                    for(var i=0;i<res.body.length;i++){
                        if(res.body[i].name == test_group_id2){
                            g2_was_deleted = false;
                        }
                        if(res.body[i].name == 'admin'){
                            admin_was_not_deleted = true;
                        }
                    }
                    assert(g2_was_deleted);
                    assert(admin_was_not_deleted);
                    done();
                });
        });

    });

    describe('Test tp reservation', () => {
        it('create a reservation', (done) => {
            const create_and_force = async () => {
                let today = new Date();
                let res = await chai.request('http://localhost:3000')
                    .post('/tp')
                    .set('X-Api-Key', token_id)
                    .send({
                        'from': today.getTime(),
                        'to': today.getTime() + 30,
                        'quantity': 2,
                        'about': 'test resa',
                        'group_or_project': 'group',
                        'name': 'test tp'
                    });
                expect(res).to.have.status(200);
                let new_resa = res.body.reservation;
                console.error('new resa', new_resa);
                assert(new_resa.created == false);
                let res2 = await chai.request('http://localhost:3000')
                    .get('/tp/' + new_resa._id)
                    .set('X-Api-Key', token_id);
                let resa = res2.body.reservation;
                expect(res2).to.have.status(200);
                assert(resa.created == false);
                // Reserve now /tp/:id/reservenow
                let resnow = await chai.request('http://localhost:3000')
                    .put('/tp/' + resa._id + '/reserve/now')
                    .set('X-Api-Key', token_id)
                    .send({
                        'from': today.getTime(),
                        'to': today.getTime() + 30,
                        'quantity': 2,
                        'about': 'test resa'
                    });
                expect(resnow).to.have.status(200);
                res2 = await chai.request('http://localhost:3000')
                    .get('/tp/' + new_resa._id)
                    .set('X-Api-Key', token_id);
                resa = res2.body.reservation;
                assert(resa.created == true);
            };
            create_and_force().then(() => {
                done();
            });
        });

    });

});
