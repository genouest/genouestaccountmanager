/*global  angular:false */
/*jslint sub: true, browser: true, indent: 4, vars: true, nomen: true */
'use strict';

// Declare app level module which depends on filters, and services
angular.module('genouest', ['genouest.resources', 'ngSanitize', 'ngCookies', 'ngRoute', 'datatables', 'ui.calendar'])
.directive('confirmDelete', function(){
    return {
      replace: true,
      templateUrl: 'templates/deleteConfirmation.html',
      scope: {
        onConfirm: '&'
      },
      controller: function($scope) {
        $scope.isDeleting = false;
        $scope.startDelete = function(){
          $scope.isDeleting = true;
        }
        $scope.cancel = function() {
          $scope.isDeleting = false;
        }
        $scope.confirm = function() {
          $scope.onConfirm();
        }
        }
    }
  })
.config(['$routeProvider','$logProvider',
    function ($routeProvider) {
        $routeProvider.when('/', {
            templateUrl: 'views/main.html',
            controller: 'mainCtrl'
        });
        $routeProvider.when('/registered', {
            templateUrl: 'views/registered.html',
            controller: 'registeredCtrl'
        });
        $routeProvider.when('/pending', {
            templateUrl: 'views/pending.html',
            controller: 'pendingCtrl'
        });
        $routeProvider.when('/passwordresetconfirm', {
            templateUrl: 'views/passwordresetconfirm.html',
            controller: 'passwordresetconfirmCtrl'
        });
        $routeProvider.when('/message', {
            templateUrl: 'views/message.html',
            controller: 'messageCtrl'
        });
        $routeProvider.when('/logs', {
            templateUrl: 'views/logs.html',
            controller: 'logsCtrl'
        });
        $routeProvider.when('/login', {
            templateUrl: 'views/login.html',
            controller: 'loginCtrl'
        });
        $routeProvider.when('/register', {
            templateUrl: 'views/register.html',
            controller: 'registerCtrl'
        });
        $routeProvider.when('/user', {
            templateUrl: 'views/users.html',
            controller: 'usersmngrCtrl'
        });
        $routeProvider.when('/group', {
            templateUrl: 'views/groups.html',
            controller: 'groupsmngrCtrl'
        });
        $routeProvider.when('/project', {
            templateUrl: 'views/projects.html',
            controller: 'projectsmngrCtrl'
        });
        $routeProvider.when('/database', {
            templateUrl: 'views/databases.html',
            controller: 'databasesmngrCtrl'
        });
        $routeProvider.when('/web', {
            templateUrl: 'views/web.html',
            controller: 'webmngrCtrl'
        });
        $routeProvider.when('/user/:id', {
            templateUrl: 'views/user.html',
            controller: 'usermngrCtrl'
        });
        $routeProvider.when('/tp', {
            templateUrl: 'views/tp.html',
            controller: 'tpmngrCtrl'
        });
        $routeProvider.when('/user/:id/renew/:regkey', {
            templateUrl: 'views/info.html',
            controller: 'userextendCtrl'
        });
        $routeProvider.when('/admin/projects', {
            templateUrl: 'views/projects_admin.html',
            controller: 'projectsadminmngrCtrl'
        });
        $routeProvider.when('/admin/project/:project_id', {
            templateUrl: 'views/project.html',
            controller: 'projectmngrCtrl'
        });
        $routeProvider.otherwise({
            redirectTo: '/'
        });
      }
])
.config(['$httpProvider', function ($httpProvider){
    $httpProvider.interceptors.push( function($q, $window){
        return {
        'request': function (config) {
                config.headers = config.headers || {};
                if ($window.sessionStorage.token) {
                    config.headers.Authorization = 'Bearer ' + $window.sessionStorage.token;
                }
                return config;
            },
            'response': function(response){
                return response;
            },
            'responseError': function(rejection){
                if(rejection.status == 401) {
                    // Route to #/login
                    location.replace('#/login');
                }
                return $q.reject(rejection);
            }
        };
    });
}]);

angular.module('genouest').controller('genouestCtrl',
    function ($rootScope) {
        $rootScope.alerts = [];
        $rootScope.closeAlert = function (index) {
            $rootScope.alerts.splice(index, 1);
        };

    });
angular.module('genouest').controller('registeredCtrl',
    function ($rootScope) {
    });
angular.module('genouest').controller('logsCtrl',
    function ($scope, $rootScope, User, Auth, GOLog, GOActionLog, DTOptionsBuilder) {
        $scope.date_convert = function timeConverter(tsp){
          var a = new Date(tsp);
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var year = a.getFullYear();
          var month = months[a.getMonth()];
          var date = a.getDate();
          var hour = a.getHours();
          var min = a.getMinutes();
          var sec = a.getSeconds();
          var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
          return time;
        }

      $scope.get_status = function(status){
          if(status!=0 && status!=undefined) {
              return "alert alert-warning";
          }
      }
      $scope.options = DTOptionsBuilder.newOptions().withOption('order', [[0, 'desc']]);
      $scope.logs = GOActionLog.list();
      //console.log(GOLog.get());
      $scope.getlog = function(log_id, event_file) {
        $scope.logcontent = "";
        GOActionLog.get({event: event_file}).$promise.then(function(data){
          $scope.logcontent = data.log.replace(/(\r\n|\n|\r)/g,"<br />");
          $scope.event = event_file;
        }, function(error){
            $scope.err_msg = error.data;
        });
      };
});

angular.module('genouest').controller('databasesmngrCtrl',
    function ($scope, $rootScope, User, Auth, Database) {
      $scope.user = Auth.getUser();
      /*
      <input  ng-model="db_name" placeholder="database name"/>
      <input  ng-model="db_owner" placeholder="owner uid"/>
      <select  ng-model="db_type">
          <option value="mysql">MySQL</option>
          <option value="postgresql">Postgres</option>
          <option value="mongo">Mongo</option>
      </select>
      <input ng-model="db_host" placeholder="hostname where is database"/>
      */
      $scope.db_name = null;
      $scope.db_owner = null;
      $scope.db_type = 'mysql';
      $scope.db_host = null;

      $scope.owner_db_name = null;
      $scope.owner_db_owner = null;

      Database.list().$promise.then(function(data){
        $scope.databases = data;
      });
      User.list().$promise.then(function(data) {
        $scope.users = data;
      });

      $scope.change_owner = function(){
        $scope.chowner_msg = '';
        $scope.chowner_err_msg = '';
        if(!$scope.owner_db_name || !$scope.owner_db_owner){
            $scope.chowner_err_msg = 'no database or owner selected';
            return;
        }

        Database.changeowner({name: $scope.owner_db_name.name, old: $scope.owner_db_name.owner, new: $scope.owner_db_owner.uid},{}).$promise.then(function(data){
          $scope.chowner_msg = data.message;
          Database.list().$promise.then(function(data){
            $scope.databases = data;
          });
        });


      };

      $scope.declare_db = function(){
          $scope.msg = '';
          $scope.err_msg = '';

          if(!$scope.db_owner || !$scope.db_name){
              $scope.err_msg = 'no database or owner selected';
              return;
          }

          Database.add({name: $scope.db_name},{
              owner: $scope.db_owner.uid,
              type: $scope.db_type,
              host: $scope.db_host,
              create: false
          }).$promise.then(function(data){
              $scope.db_name = null;
              $scope.db_owner = null;
              $scope.db_type = 'mysql';
              $scope.db_host = null;
              $scope.msg = data.message;
              Database.list().$promise.then(function(data){
                $scope.databases = data;
              });
          }, function(error){
              $scope.err_msg = error.data.message;
          });
      };
    });

angular.module('genouest').controller('webmngrCtrl',
    function ($scope, $rootScope, User, Auth, Web) {
      $scope.user = Auth.getUser();
      $scope.owner_web_name = null;
      $scope.owner_web_owner = null;

      Web.list().$promise.then(function(data){
        $scope.websites = data;
      });
      User.list().$promise.then(function(data) {
        $scope.users = data;
      });

      $scope.change_owner = function(){
        $scope.chowner_msg = '';
        $scope.chowner_err_msg = '';
        if(!$scope.owner_web_name || !$scope.owner_web_owner){
            $scope.chowner_err_msg = 'No web or owner selected';
            return;
        }

        Web.changeowner({name: $scope.owner_web_name.name, old: $scope.owner_web_name.owner, new: $scope.owner_web_owner.uid},{}).$promise.then(function(data){
          $scope.chowner_msg = data.message;
          Web.list().$promise.then(function(data){
            $scope.websites = data;
          });
        });
      };
    });


angular.module('genouest').controller('messageCtrl',
    function ($scope, $rootScope, $sce, $http, User, Auth) {
      User.get_mail_config().$promise.then(function(data){
        $scope.origin = data.origin;
      });
      $scope.msg = '';
      $scope.error_msg = '';
      $scope.session_user = Auth.getUser();
      $scope.mailing_lists = User.get_mailing_lists();
      $scope.message = '';
      $scope.subject = '';
      $scope.input_choices = ["HTML", "Text", "Markdown"];
      $scope.input_type = "HTML";
      $scope.mailing_list = '';
      $scope.send = function() {
        $scope.msg = '';
        $scope.error_msg = '';
        if($scope.message === '' || $scope.subject === '' || $scope.mailing_list === ''){
            $scope.error_msg = "You need a subject, text, and mailing list";
            return;
        }
        User.sendMessage({},{message: $scope.message, subject: $scope.subject, list: $scope.mailing_list, input: $scope.input_type, from: $scope.origin}).$promise.then(function(data){
          $scope.msg = 'Message sent';
        }, function(error){
            $scope.error_msg = error.data;
        });
    };

    $scope.decode_template = function(list_name) {
        $scope.message = '';
        var lists = $scope.mailing_lists;
        var template = '';
        var footer = '';
        var header = '';
        for(var i = 0; i < lists.length; i++){
           //if is a list with a name
          if (lists[i].list_name==list_name){
            if ($scope.input_type=="HTML"){
                // Case template
              if('template_html' in lists[i].config){
                template = lists[i].config.template_html;
                $scope.message = atob(template);
                return;
              };
              if (lists[i].config.header_html) {
                header = atob(lists[i].config.header_html);
                header += "\n";
              };
              if (lists[i].config.footer_html) {
                footer = atob(lists[i].config.footer_html);
              };
              $scope.message = header+footer;
              return;
            } else if ($scope.input_type=="Markdown"){
              if('template_markdown' in lists[i].config){
                template = lists[i].config.template_markdown;
                $scope.message = atob(template);
                return;
              };
              if (lists[i].config.header_markdown){
                header = atob(lists[i].config.header_markdown);
                header += "\n";
              };
              if (lists[i].config.footer_markdown){
                footer = atob(lists[i].config.footer_markdown);
              };
              $scope.message = header+footer;
              return;
            } else if ($scope.input_type=="Text") {
              if('template_text' in lists[i].config){
                template = lists[i].config.template_text;
                $scope.message = atob(template);
                return;
              };
              if (lists[i].config.header_text) {
                header = atob(lists[i].config.header_text);
                header += "\n";
              };
              if (lists[i].config.footer_text) {
                footer = atob(lists[i].config.footer_text);
              };
              $scope.message = header+footer;
              return;
            };
          };
        }
      };

    //print html
    $scope.trustAsHtml = function(message) {
        return $sce.trustAsHtml(message);
      };

    //print markdown
    $scope.trustAsMarkdown = function(message) {
        var mark = marked(message);
        return $sce.trustAsHtml(mark);
    };

    });

angular.module('genouest').controller('projectmngrCtrl',
    function($scope, $rootScope, $routeParams, $log, $window, $location, Project, Auth, Group, User, GOLog) {

        $scope.show_project_users = function(project_id) {
            Project.get({id: project_id}).$promise.then(function(data) {
                data.expire = new Date(data.expire);
                Project.get_users({name: data.id}).$promise.then(function(user_list){
                    $scope.project = data;
                    $scope.users = user_list;
                    $scope.oldGroup = $scope.project.group;
                    for(var i = 0; i<user_list.length;i++){
                        if(user_list[i].group.indexOf($scope.project.group) >= 0 || user_list[i].secondarygroups.indexOf($scope.project.group) >= 0){
                            $scope.users[i].access=true;
                        }
                    }
                });
            });
        };


        $scope.project = {};
        $scope.groups = [];
        $scope.users = [];
        console.log($window.location);
        $scope.show_project_users($routeParams.project_id);
        Group.list().$promise.then(function(data) {
            $scope.groups = data;
        });

        $scope.add_user = function(project, user_id){
            $scope.admin_user_msg = "";
            $scope.admin_user_error_msg = "";
            if(! user_id){
                $scope.admin_user_error_msg = "User Id must not be empty";
                return;
            };
            $scope.admin_user_msg = "";
            $scope.admin_user_error_msg = "";
            User.add_to_project({name: user_id, project: project.id},{}).$promise.then(function(data){
                $scope.admin_user_msg = data.message;
                User.add_group({name: user_id, group: project.group},{}).$promise.then(function(data){
                    $scope.show_project_users(project.id)
                }, function(error){
                    $scope.admin_user_err_msg = error.data;
                });
            }, function(error){
                $scope.admin_user_err_msg = error.data;
            });
        };

        $scope.remove_user = function(project,user_id){
            $scope.admin_user_msg = "";
            $scope.admin_user_error_msg = "";
            User.remove_from_project({name: user_id, project: project.id},{}).$promise.then(function(data){
                $scope.admin_user_msg = data.message;
                $scope.show_project_users(project.id);
            }, function(error){
                $scope.admin_user_error_msg = error.data;
            });
        };

        $scope.update_project = function(project){
            $scope.project_msg = '';
            Project.update({'name': project.id},
                {'size': project.size,
                'expire': new Date(project.expire).getTime(),
                'owner': project.owner,
                'group': project.group,
                'description' : project.description,
                'access' : project.access,
                'path': project.path,
                'orga':project.orga
                }
            ).$promise.then(function(data){
                $scope.prj_msg = data.message;
                if(project.group !== $scope.oldGroup){
                    $scope.update_users_group($scope.users, project.group);
                }
                $scope.project_list();
                $scope.show_project_users(project);
            }, function(error){
                $scope.prj_err_msg = error.data;
            });
        };

        $scope.update_users_group = function(users_list, new_group_id){
            for(var i = 0; i< users_list.length; i++){
                User.add_group({name: users_list[i].uid, group: new_group_id},{}).$promise.then(function(data){}, function(error){
                    $scope.prj_err_msg = error.data;
                });
            };
        };

       $scope.delete_project = function(project, user_list){
            $scope.project_msg = '';
            var promises_list = [];
            for(var i = 0; i < user_list.length; i++){
                var promise = User.remove_from_project({name: user_list[i].uid, project: project.id, force:true},{});
            }
            Project.delete({'name': project.id}).$promise.then(function(data){
                $window.location.href = '#/admin/projects?deleted=ok';
            });
        };

    });

angular.module('genouest').controller('projectsadminmngrCtrl',
    function($scope, $rootScope, $routeParams, $log, $location, Project, Auth, Group, User, GOLog) {

        $scope.project_list = function(refresh_requests = false){
            $scope.projects = [];
            Project.list({'all':"true"}).$promise.then(function(data) {
                if (refresh_requests){
                    $scope.add_requests = [];
                    $scope.remove_requests = [];
                    $scope.requests_number = 0;
                }
                for(var i=0;i<data.length;i++){
                    data[i].expire = new Date(data[i].expire);
                    if (! refresh_requests){ continue;};
                    if (data[i]["add_requests"]){
                        for(var j=0;j<data[i]["add_requests"].length;j++){
                            $scope.add_requests.push({'project': data[i], 'user': data[i]["add_requests"][j]});
                        }
                        $scope.requests_number += data[i]["add_requests"].length;
                    }
                    if (data[i]["remove_requests"]){
                        for(var j=0;j<data[i]["remove_requests"].length;j++){
                            $scope.remove_requests.push({'project': data[i], 'user': data[i]["remove_requests"][j]});
                        }
                        $scope.requests_number += data[i]["remove_requests"].length;
                    }
                }
                if($scope.requests_number > 0){$scope.requests_visible = true;};
                $scope.projects = data;
            });
        };

        $scope.notification = "";
        if($routeParams.deleted == "ok"){
            $scope.notification = "Project was deleted successfully";
        };
        $scope.add_requests = [];
        $scope.requests_visible = false;
        $scope.remove_requests = [];
        $scope.requests_number = 0;
        $scope.project_list(true);
        $scope.session_user = Auth.getUser();
        $scope.new_project = {};
        $scope.users = [];
        $scope.new_user = null;
        $scope.groups = []
        Group.list().$promise.then(function(data) {
            $scope.groups = data;
        });


        $scope.add_project = function(){
            $scope.notification = "";
            if(! $scope.new_project.id || ! $scope.new_project.group || ! $scope.new_project.owner) {
                $scope.add_project_error_msg = "Project Id, group, and owner are required fields " + $scope.new_project.id + $scope.new_project.group + $scope.new_project.owner ;
                return;
            }
            $scope.add_project_msg = '';
            $scope.add_project_error_msg = '';
            Project.add({},{
                'id': $scope.new_project.id,
                'owner': $scope.new_project.owner,
                'group': $scope.new_project.group,
                'size': $scope.new_project.size,
                'description': $scope.new_project.description,
                'access': $scope.new_project.access,
                'orga': $scope.new_project.orga,
                'path': $scope.new_project.path,
                'expire': new Date($scope.new_project.expire).getTime()}).$promise.then(function(data)
            {
                $scope.add_project_msg = data.message;
                $scope.project_list();
                User.add_to_project({name: $scope.new_project.owner, project: $scope.new_project.id},{}).$promise.then(function(data){
                    User.add_group({name: $scope.new_project.owner, group: $scope.new_project.group},{}).$promise.then(function(data){
                    }, function(error){
                        $scope.add_project_error_msg = error.data;
                    });
                }, function(error){
                    $scope.add_project_error_msg = error.data;
                });
            }, function(error){
                $scope.add_project_error_msg = error.data;
            });
        };

        $scope.validate_add_request = function(project, user_id){
            $scope.notification = "";
            $scope.request_mngt_msg = "";
            $scope.request_mngt_error_msg = "";
            $scope.request_grp_msg = "";
            User.add_to_project({name: user_id, project: project.id},{}).$promise.then(function(data){
                $scope.request_mngt_msg = data.message;
                Project.remove_request({'name': project.id},{'request': 'add', 'user': user_id}).$promise.then(function(data){
                    $scope.project_list(true);
                    User.add_group({name: user_id, group: project.group},{}).$promise.then(function(data){
                        $scope.request_grp_msg = data.message;
                    }, function(error){
                        $scope.request_mngt_error_msg = error.data;
                    });
                }, function(error){
                    $scope.request_mngt_error_msg = error.data;
                });
            }, function(error){
                $scope.request_mngt_error_msg = error.data;
            });
        };

        $scope.validate_remove_request = function(project, user_id){
            $scope.notification = "";
            $scope.request_mngt_msg = "";
            $scope.request_mngt_error_msg = "";
            User.remove_from_project({name: user_id, project: project.id},{}).$promise.then(function(data){
                $scope.request_mngt_msg = data.message;
                Project.remove_request({'name': project.id},{'request': 'remove', 'user': user_id}).$promise.then(function(data){
                    $scope.project_list(true);
                }, function(error){
                    $scope.request_mngt_err_msg = error.data;
                });
            }, function(error){
                $scope.request_mngt_err_msg = error.data;
            });
        };

        $scope.remove_request = function(project, user_id, request_type){
            $scope.notification = "";
            $scope.request_mngt_msg = "";
            $scope.request_mngt_error_msg = "";
            Project.remove_request({'name': project.id},{'request': request_type, 'user': user_id}).$promise.then(function(data){
                $scope.request_mngt_msg = data.message;
                $scope.project_list(true);
            }, function(error){
                $scope.request_mngt_error_msg  = error.data;
            });
        };

});

angular.module('genouest').controller('projectsmngrCtrl',
    function($scope, $rootScope, $routeParams, $log, $location, Project, Auth, Group, User, GOLog) {

        $scope.project_list = function(){
            $scope.projects = [];
            Project.list().$promise.then(function(data) {
                for(var i=0;i<data.length;i++){
                    data[i].expire = new Date(data[i].expire);
                }
            $scope.projects = data;
            });
        };

        $scope.add_requests = [];
        $scope.remove_requests = [];
        $scope.project_list();
        $scope.session_user = Auth.getUser();
        $scope.new_project = {};
        $scope.users = [];
        $scope.new_user = null;
        if ($scope.session_user.is_admin){
            Group.list().$promise.then(function(data) {
                $scope.groups = data;
            });
        } else {
            $scope.groups = [];
        };

        $scope.request_user = function(project, user_id, request_type){
            $scope.request_msg = '';
            $scope.request_err_msg = '';
            if (! user_id ) {
                $scope.request_err_msg = 'Genouest id is required';
                return;
            };
            Project.request({'name': project.id},{'request': request_type, 'user': user_id}).$promise.then(function(data){
                $scope.request_msg = data.message;
            }, function(error){
                $scope.request_err_msg  = error.data;
            });
        };

        $scope.show_project_users = function(project) {
            $scope.msg = '';
            $scope.rm_prj_err_msg = '';
            $scope.rm_prj_msg_ok = '';
            var project_name = project.id;
            Project.get_users({name: project_name}).$promise.then(function(user_list){
                $scope.users = user_list;
                $scope.selectedProject = project;
                $scope.oldGroup = project.group;
                for(var i = 0; i<user_list.length;i++){
                    if(user_list[i].group.indexOf($scope.selectedProject.group) >= 0 || user_list[i].secondarygroups.indexOf($scope.selectedProject.group) >= 0){
                        $scope.users[i].access=true;
                    }
                }
            });
        };
});

angular.module('genouest').controller('groupsmngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, Group, Auth, GOLog, Project) {
    $scope.selectedGroup = null;
    $scope.users = [];

    Group.list().$promise.then(function(data) {
      $scope.groups = data;
    });

    $scope.show_group_users = function(group) {
        $scope.msg = '';
        $scope.rm_grp_err_msg = '';
        $scope.rm_grp_msg_ok = '';
        var group_name = group.name;
        $scope.selectedGroup = group;
        Project.get_projects_in_group({name: group_name}).$promise.then(function(project_list){
            $scope.projects = project_list;
            Group.get({name: group_name}).$promise.then(function(user_list){
                $scope.users = user_list;
                for(var i = 0; i < user_list.length; i++){
                    var is_authorized = false;
                    if(user_list[i].projects){
                        for(var j = 0; j < project_list.length; j++){
                            if(user_list[i].projects.indexOf(project_list[j].id) >= 0){
                                is_authorized = true;
                                break;
                            }
                        }
                    }
                    $scope.users[i].authorized = is_authorized;
                }
            });
        });
    };

    $scope.new_group = '';

    $scope.update_group = function(){
        Group.update({name: $scope.selectedGroup.name},{owner: $scope.selectedGroup.owner}).$promise.then(function(data){
          $scope.msg = '';
          Group.list().$promise.then(function(data) {
            $scope.msg = 'Group updated';
          }, function(error){
            $scope.msg = error.data;
          });
        });
    };

    $scope.add_group = function(){
      if($scope.new_group == '') {
        return;
      }      Group.add({name: $scope.new_group},{owner: $scope.new_group_user_id}).$promise.then(function(data){
        $scope.err_msg = '';
        $scope.success_msg = '';
        GOLog.add(data.name, data.fid, 'Add group '+data.name);
        Group.list().$promise.then(function(data) {
          $scope.groups = data;
          $scope.success_msg = 'Group was created';
        }, function(error){
          $scope.err_msg = error.data;
        });
    }, function(error){
        $scope.err_msg = error.data;
    });
    }
    $scope.delete_group = function(selectedGroup) {
        Group.delete({name: selectedGroup.name}).$promise.then(function(data){
            $scope.rm_grp_msg_ok = data.message;
            Group.list().$promise.then(function(data) {
              $scope.groups = data;
              $scope.selectedGroup = "";
            }, function(error){
              $scope.rm_grp_err_msg = error.data;
            });
        },function(error){
            $scope.rm_grp_err_msg = error.data;
        });
    }

});

angular.module('genouest').controller('usersmngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, $http, User, Auth) {
      $http({
        method: 'GET',
        url: '/user'
      }).then(function successCallback(response) {
          $scope.users = response.data;
        }, function errorCallback(response) {
            console.log("Failed to get users ");
        });


    $scope.STATUS_PENDING_EMAIL = 'Waiting for email approval';
    $scope.STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
    $scope.STATUS_ACTIVE = 'Active';
    $scope.STATUS_EXPIRED = 'Expired';


    $scope.date_convert = function timeConverter(tsp){
      var a = new Date(tsp);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var year = a.getFullYear();
      var month = months[a.getMonth()];
      var date = a.getDate();
      var hour = a.getHours();
      var min = a.getMinutes();
      var sec = a.getSeconds();
      var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
      return time;
    }

});

angular.module('genouest').controller('userextendCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, User) {

  $scope.date_convert = function timeConverter(tsp){
    var a = new Date(tsp);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
  }

  User.extend({name: $routeParams.id, regkey: $routeParams.regkey},{}).$promise.then(function(data){
    $scope.msg = '<h3>'+data.message+ ' '+$scope.date_convert(data.expiration)+'</h3>';
  });

});

angular.module('genouest').controller('usermngrCtrl',
  function($scope, $rootScope, $routeParams, $log, $http, $location, $window, $timeout, User, Group, Quota, Database, Web, Auth, GOLog, GOActionLog, Project) {
    $scope.session_user = Auth.getUser();
    $scope.maingroups = ['genouest', 'irisa', 'symbiose'];
    $scope.selected_group = '';
    $scope.password1 = '';
    $scope.password2 = '';
    $scope.events = [];
    $scope.plugins = [];
    $scope.plugin_data = {};
    $scope.u2f = null;
    $http({
      method: 'GET',
      url: '../plugin'
    }).then(function successCallback(response) {
        $scope.plugins = response.data;
        //console.log($scope.plugins);
      }, function errorCallback(response) {
          console.log("Failed to get plugins ");
      });

      $scope.ssh_new_key = function(){
          $scope.new_key_message = "";
          $http({
            method: 'GET',
            url: '/ssh/' + $scope.user.uid
          }).then(function successCallback(response) {
              $scope.new_key_message = response.data.msg;
          });
      }

      $scope.register_u2f = function(){
          console.log($window.u2f);
          $http({
            method: 'GET',
            url: '/u2f/register/' + $scope.user.uid
          }).then(function successCallback(response) {
              var registrationRequest = response.data.registrationRequest;
              $scope.u2f = "Please insert your key and press button";
              $timeout(function() {
                  $window.u2f.register(registrationRequest.appId, [registrationRequest], [], function(registrationResponse) {
                        if(registrationResponse.errorCode) {
                            console.log("Association failed");
                            $scope.u2f = "Assocation failed";
                            $scope.$apply();
                            return;
                        }
                        // Send this registration response to the registration verification server endpoint
                        var data = {
                            registrationRequest: registrationRequest,
                            registrationResponse: registrationResponse
                        }

                        $http({
                          method: 'POST',
                          url: '/u2f/register/' + $scope.user.uid,
                          data: data
                        }).then(function successCallback(response) {
                            $scope.u2f = null;
                            $scope.user.u2f = {'publicKey': response.data.publicKey};
                        });
                  });
              }, 5000);
              //console.log(registrationRequest);
            }, function errorCallback(response) {
                console.log("Failed to get u2f registration request");
            });
      };

    $scope.plugin_update = function(plugin) {
        // TODO send update to plugin with plugin_data
        // plugin is in charge of setting plugin_data.plugin content that will be posted
        console.log("should update " + plugin);
        console.log($scope.plugin_data[plugin]);
        $scope.plugin_data[plugin].alert = null;
        $http({
          method: 'POST',
          url: '../plugin/' + plugin + '/' + $scope.user.uid,
          data: $scope.plugin_data[plugin]
        }).then(function successCallback(response) {
            console.log('data updated');
            $scope.plugin_data[plugin] = response.data;
          }, function errorCallback(response) {
              console.log("Failed to update plugin "+plugin+": "+response.data);
              $scope.plugin_data[plugin].alert = response.data;
          });
    }

    $scope.change_group = function() {
      //console.log($scope.selected_group);
      $scope.user.group = $scope.selected_group.name;
    };
    $scope.quotas = [];

    $scope.update_password = function() {
        $scope.wrong_confirm_passwd = "";
        $scope.update_passwd = "";
        if(($scope.password1 != $scope.password2) || ($scope.password1=="")) {
            $scope.wrong_confirm_passwd = "Passwords are not identical";
            return;
        }
        if($scope.password1.length < 10) {
            $scope.wrong_confirm_passwd = "Password must have 10 characters minimum";
            return;
        }
        User.update_password({name: $routeParams.id},{password: $scope.password1}).$promise.then(function(data){
            $scope.update_passwd = data.message;
        });

        $scope.update_passwd = '';
        $scope.wrong_confirm_passwd = '';

    };
    /*
    Quota.get({name: $routeParams.id, disk: 'home'}).$promise.then(function(data){
      $scope.quotas.push(data);
    });
    Quota.get({name: $routeParams.id, disk: 'omaha'}).$promise.then(function(data){
      $scope.quotas.push(data);
    });
    Quota.get({name: $routeParams.id, disk: 'galaxy'}).$promise.then(function(data){
      //data['value'] = data['value'] * 1000000
      $scope.quotas.push(data);
    });
    */



    User.get({name: $routeParams.id}).$promise.then(function(user){
        if(user.is_admin) {
            Group.list().$promise.then(function(data) {
                $scope.groups = data;
                var found = false;
                for(var i=0;i<$scope.groups.length;i++){
                    if($scope.groups[i].name == user.group) {
                        found = true;
                        break;
                    }
                }
                if(!found) { $scope.groups.push({name: user.group})}
                $scope.user = user;
            });
        } else {
            $scope.user = user;
        }

        Project.list().$promise.then(function(data) {
            $scope.projects = data;
            $scope.user_projects = [];
            for(var i=0; i<data.length;i++){
                if (user.projects.indexOf(data[i].id) >= 0){
                    var is_owner = false;
                    var user_in_group = false;
                    if(user.uid === data[i].owner){
                        is_owner = true;
                    }
                    if(user.group.indexOf(data[i].group) >= 0 || user.secondarygroups.indexOf(data[i].group >= 0)){
                        user_in_group = true;
                    }
                    $scope.user_projects.push({id:data[i].id, owner:is_owner, group: data[i].group, member:user_in_group});
                }
            }
        });

        User.is_subscribed({name: user.uid}).$promise.then(function(data){
            $scope.subscribed = data.subscribed;
        });

      for(var i=0;i<$scope.plugins.length;i++){
          (function(cntr) {
          $http({
            method: 'GET',
            url: $scope.plugins[cntr].url+ '/' + user.uid
          }).then(function successCallback(response) {
              $scope.plugin_data[$scope.plugins[cntr].name] = response.data;
            }, function errorCallback(response) {
                console.log("Failed to get info from plugin "+$scope.plugins[cntr].url);
            });
        })(i);
      };

    });
    $scope.STATUS_PENDING_EMAIL = 'Waiting for email approval';
    $scope.STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
    $scope.STATUS_ACTIVE = 'Active';
    $scope.STATUS_EXPIRED = 'Expired';

    $scope.date_convert = function timeConverter(tsp){
      var a = new Date(tsp);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var year = a.getFullYear();
      var month = months[a.getMonth()];
      var date = a.getDate();
      var hour = a.getHours();
      var min = a.getMinutes();
      var sec = a.getSeconds();
      var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
      return time;
    }

    $scope.database = "";
    $scope.website = "";
    $scope.website_url = "";
    $scope.website_description = "";

    Database.listowner({name: $routeParams.id}).$promise.then(function(data){
      $scope.databases = data;
    });


    Web.listowner({name: $routeParams.id}).$promise.then(function(data){
      $scope.websites = data;
    });

    GOActionLog.user_list({'id': $routeParams.id}).$promise.then(function(data){
        $scope.events = data;

    });


    $scope.add_to_project = function() {
        var newproject = $scope.user.newproject;
        if(newproject){
            User.add_to_project({name: $scope.user.uid, project: newproject.id},{}).$promise.then(function(data){
                $scope.add_to_project_msg = data.message;
                $scope.user_projects.push({id:newproject.id, owner:false});
                User.add_group({name: $scope.user.uid, group: newproject.group},{}).$promise.then(function(data){
                    $scope.add_to_project_grp_msg = data.message;
                }, function(error){
                    $scope.request_mngt_error_msg = error.data;
                });
            }, function(error){
                $scope.add_to_project_error_msg = error.data;
            });
        };
    };

    $scope.remove_from_project = function(project_id) {
        User.remove_from_project({name: $scope.user.uid, project: project_id}).$promise.then(function(data){
            $scope.remove_from_project_msg = data.message;
            var tmpproject = [];
            for(var t=0;t<$scope.user_projects.length;t++){
                if($scope.user_projects[t].id != project_id) {
                    tmpproject.push($scope.user_projects[t]);
                }
            }
            $scope.user_projects = tmpproject;
        }, function(error){
            $scope.remove_from_project_error_msg = error.data;
        });
    };

    $scope.add_secondary_group = function() {
      var sgroup = $scope.user.newgroup;
      if(sgroup.trim()!=''){
        User.add_group({name: $scope.user.uid, group: sgroup},{}).$promise.then(function(data){
          $scope.add_group_msg = data.message;
          $scope.user.secondarygroups.push(sgroup);
        });
      }
    };

    $scope.delete_secondary_group = function(sgroup) {
      User.delete_group({name: $scope.user.uid, group: sgroup}).$promise.then(function(data){
        $scope.rm_group_msg = data.message;
        var tmpgroups = [];
        for(var t=0;t<$scope.user.secondarygroups.length;t++){
          if($scope.user.secondarygroups[t] != sgroup) {
            tmpgroups.push($scope.user.secondarygroups[t]);
          }
        }
        $scope.user.secondarygroups = tmpgroups;
      });
    };

    $scope.database_delete = function(db){
      $scope.rm_dbmsg = '';
      Database.delete({name: db}).$promise.then(function(data){
        $scope.rm_dbmsg = data.message;
        Database.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.databases = data;
        });
      });
    }

    $scope.web_delete = function(site){
      $scope.rmwebmsg = '';
      Web.delete({name: site}).$promise.then(function(data){
        $scope.rmwebmsg = data.message;
        Web.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.websites = data;
        });
      });
    }

    $scope.database_add = function(){
      $scope.dbmsg = '';
      $scope.dbmsg_error = '';
      Database.add({name: $scope.database},{create: true}).$promise.then(function(data){
        $scope.dbmsg = data.message;
        Database.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.databases = data;
        });
      }, function(error){
          $scope.dbmsg_error = error.data.message;
      });
    }

    $scope.web_add = function(){
      $scope.webmsg = '';
      Web.add({name: $scope.website},{owner: $scope.user.uid, url: $scope.website_url, description: $scope.website_description}).$promise.then(function(data){
        $scope.webmsg = data.message;
        Web.listowner({name: $routeParams.id}).$promise.then(function(data){
          $scope.websites = data;
        });
      });
    }

    $scope.expire = function() {
      User.expire({name: $scope.user.uid},{}).$promise.then(function(data){
        $scope.msg = data.message;
        GOLog.add($scope.user.uid, data.fid, "Expire user "+$scope.user.uid);
        $scope.user.status = $scope.STATUS_EXPIRED;
      });
    };

    $scope.delete = function() {
      User.delete({name: $scope.user.uid},{}).$promise.then(function(data){
        //console.log(data.fid);
        if(data.fid === undefined) {
            $scope.del_msg = data.message;
        }
        else {
            GOLog.add($scope.user.uid, data.fid, "Delete user "+$scope.user.uid);
            $location.path('/user');
        }
      });
    };

    $scope.renew = function() {
      User.renew({name: $scope.user.uid},{}).$promise.then(function(data){
        $scope.msg = data.message;
        GOLog.add($scope.user.uid, data.fid, "Renew user "+$scope.user.uid);
        $scope.user.status = $scope.STATUS_ACTIVE;
      });
    };

    $scope.extend = function() {
      User.extend({name: $scope.user.uid, regkey: $scope.user.regkey},{}).$promise.then(function(data){
        $scope.msg = data.message;
        $scope.user.expiration = data.expiration;
      });
    };

    $scope.activate = function() {
      $scope.err_msg = "";
      $scope.msg = "";
      User.activate({name: $scope.user.uid}).$promise.then(function (data){
        GOLog.add($scope.user.uid, data.fid, "Activate user "+$scope.user.uid);
        $scope.user.status = $scope.STATUS_ACTIVE;
        $scope.msg = data.msg;
      }, function(error){
          $scope.err_msg = error.data;
      });
    };

    $scope.update_info = function() {
      $scope.update_msg = "";
      $scope.update_error_msg = "";
      User.update({name: $scope.user.uid}, $scope.user).$promise.then(function(data) {
        $scope.update_msg = "User info updated";
        $scope.user = data;
        if(data.fid!=null){
          GOLog.add($scope.user.uid, data.fid, "Update user "+$scope.user.uid);
        }

      }, function(error){
        $scope.update_error_msg = error.data;
      });
    };

    $scope.update_ssh = function() {
      $scope.ssh_message = "";
      User.update_ssh({name: $scope.user.uid}, {ssh: $scope.user.ssh}).$promise.then(function(data) {
        $scope.user = data;
        $scope.ssh_message = "SSH key added";
        GOLog.add($scope.user.uid, data.fid, "Add SSH key for user "+$scope.user.uid);
      });
    }

});

angular.module('genouest').controller('userCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, $window, $http, User, Auth, Logout) {

    $scope.is_logged = false;
    $scope.usages = null;

    User.is_authenticated().$promise.then(function(data) {
      if(data.user !== undefined && data.user !== null) {
         $scope.user = data.user;
         //$scope.user['is_admin'] = data.is_admin;
         $scope.is_logged = true;
         if($window.sessionStorage != null) {
             $window.sessionStorage.token = data.token;
         }

         Auth.setUser($scope.user);
         $http({
           method: 'GET',
           url: '/user/' + $scope.user.uid + '/usage'
         }).then(function successCallback(response) {
               $scope.usages = response.data.usages;
         });
      }
      else {
        if($location.path().indexOf("renew") == -1 && $location.path().indexOf("pending") == -1 && $location.path().indexOf("register") == -1) {
            $location.path('/login');
        }
      }
    });

    $scope.logout = function() {
      delete $window.sessionStorage.token;
      Logout.get().$promise.then(function(){
        $scope.user = null;
        $scope.is_logged = false;
        Auth.setUser(null);
        $location.path('/login');
      });
    };

    $rootScope.$on('loginCtrl.login', function (event) {
        $scope.user = Auth.getUser();
        $scope.is_logged = true;
        $http({
          method: 'GET',
          url: '/user/' + $scope.user.uid + '/usage'
        }).then(function successCallback(response) {
              $scope.usages = response.data.usages;
        });
    });



});

angular.module('genouest').controller('loginCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, $window, $http, $timeout, IP, User, Auth) {

    var SUCCESS = 0;
    var ERROR = 1;

    $scope.double_auth = false;
    $scope.mail_token = null;
    $scope.u2f = null;
    $scope.uid = null;

    $scope.password_reset_request = function() {
      $scope.msgstatus = 0;
      $scope.msg = "";
      if($scope.userid == null || $scope.userid == "") {
        $scope.msgstatus = 1;
        $scope.msg = "Please enter your used id!";
      }
      else {
        User.password_reset_request({name: $scope.userid}).$promise.then(function(data){
          $scope.msg = data.message;
        });
      }
    }

    $scope.request_email_token = function(){
        $http({
          method: 'GET',
          url: '/mail/auth/' + $scope.uid
        }).then(function successCallback(response) {
              $scope.msg = "Mail token request send";
        });
    };

    $scope.validate_email_token = function(){
        var data = {'token': $scope.mail_token};
        $http({
          method: 'POST',
          url: '/mail/auth/' + $scope.uid,
          data: data
        }).then(function successCallback(response) {
              Auth.setUser(response.data.user);
              $rootScope.$broadcast('loginCtrl.login');
              $location.path('/');
              return;
        }, function errorCallback(response){
            $scope.msg = "Failed to validate token";
        });
    };

    $scope.auth = function() {
      User.authenticate({name: $scope.userid}, {password: $scope.password}).$promise.then(function(data) {
        if(data.user !== undefined && data.user !== null) {
          $scope.uid = data.user.uid;
          if(data.double_auth){
              $scope.double_auth=true;
              $http({
                method: 'GET',
                url: '/u2f/auth/' + data.user.uid,
              }).then(function successCallback(response) {
                  $scope.u2f = response.data.authRequest;
                  $timeout(function(){
                      $window.u2f.sign($scope.u2f.appId, $scope.u2f.challenge, [$scope.u2f], function(authResponse) {
                          // Send this authentication response to the authentication verification server endpoint
                          if(authResponse.errorCode) {
                              console.log("Failed to sign challenge with device");
                              console.log(authResponse);
                              $scope.msg = "Failed to authenticate with device";
                              $scope.msgstatus = ERROR;
                              $scope.$apply();
                              return;
                          };
                          var u2fdata = {
                              'authRequest': $scope.u2f,
                              'authResponse': authResponse
                          }
                          $http({
                            method: 'POST',
                            url: '/u2f/auth/' + data.user.uid,
                            data: u2fdata
                          }).then(function successCallback(authResponse) {
                                if(authResponse.errorCode) {
                                    console.log("Failed to validate token with device");
                                    console.log(authResponse);
                                    $scope.msg = "Failed to authenticate with device";
                                    $scope.msgstatus = ERROR;
                                    $scope.$apply();
                                    return;
                                };
                                Auth.setUser(data.user);
                                $rootScope.$broadcast('loginCtrl.login');
                                $location.path('/');
                                return;
                          });
                      });
                  }, 5000);
              });
              return;
          }
          else {
              Auth.setUser(data.user);
              if($window.sessionStorage != null) {
                  $window.sessionStorage.token = data.token;
              }
              $rootScope.$broadcast('loginCtrl.login');
              $location.path('/');
          }
        }
        else {
          $scope.msg = data.msg;
          $scope.msgstatus = ERROR;
        }
      }, function(error){
          $scope.msg = error.data;
      });
    }
});

angular.module('genouest').controller('registerCtrl',
  function($scope, $rootScope, $routeParams, $log, $location, $window, $http, $timeout, IP, User, Auth) {

    $scope.uid = null;
    $scope.duration = 365;

    IP.get().$promise.then(function(data) {
      var ips = data.ip.split(',');
      var ip = ips[0].trim();
      $scope.ip = ip;
    });

    $scope.update_userid = function() {
      if($scope.firstname && $scope.lastname) {
        $scope.userid = $scope.firstname.charAt(0).toLowerCase()+$scope.lastname.toLowerCase().replace(' ','').substring(0,7);
      }
    }

    $scope.register = function() {
      $scope.msg = "";
      $scope.msgstatus = 0;
      if(! $scope.agree) {
        $scope.msg="You must agree with the terms of use";
        $scope.msgstatus = 1;
        return;
      }
      User.register({name: $scope.userid},{
        firstname: $scope.firstname,
        lastname: $scope.lastname,
        address: $scope.address,
        lab: $scope.lab,
        responsible: $scope.responsible,
        group: $scope.group,
        email: $scope.email,
        ip: $scope.ip,
        duration: $scope.duration,
        why: $scope.why
      }).$promise.then(function(data){
        $scope.msg = data.msg;
        $scope.msgstatus = data.status;
        if(data.status==0) {
          $location.path('/registered');
        }
      });
    };

});

angular.module('genouest').controller('mainCtrl',
    function ($rootScope, $scope, $location, Auth) {
      var user = Auth.getUser();
      if(user) {
      $location.path('/user/'+user.uid);
      }
});

angular.module('genouest').controller('pendingCtrl',
    function ($rootScope, $scope, $location, Auth) {
});

angular.module('genouest').controller('passwordresetconfirmCtrl',
    function ($rootScope, $scope, $location, Auth) {
});

angular.module('genouest').controller('tpmngrCtrl',
    function ($rootScope, $scope, $location, $http, $compile, $window, Auth, User) {

        $scope.selectedEvent = null;
        $scope.quantity = 1;
        $scope.from_date = new Date();
        $scope.to_date = new Date();
        $scope.about = "";


        User.is_authenticated().$promise.then(function(data) {
          if(data.user !== undefined && data.user !== null) {
             $scope.user = data.user;
             //$scope.user['is_admin'] = data.is_admin;
             $scope.is_logged = true;
             if($window.sessionStorage != null) {
                 $window.sessionStorage.token = data.token;
             }
             Auth.setUser($scope.user);
             $scope.authorized = ($scope.user.is_trainer || $scope.user.is_admin);
          }
        });

        // get user info to hide form and button
        var user = Auth.getUser();
        if(user){
            $scope.authorized = (user.is_trainer || user.is_admin);
        }


        $scope.get_status = function(over){
            if(over) {
                return "panel panel-danger";
            }
            else {
                return "panel panel-primary"
            }
        }

        $scope.reserve = function(){

            $scope.resmsg = "";
            $scope.reserrmsg = "";

            if($scope.from_date>$scope.to_date){
                $scope.reserrmsg = "Final date must be superior to start date";
                return;
            }
            var reservation = {
                'quantity': $scope.quantity,
                'from': $scope.from_date.getTime(),
                'to': $scope.to_date.getTime(),
                'about': $scope.about
            };

            $http({
              method: 'POST',
              url: '../tp',
              data: reservation
            }).then(function successCallback(response) {
                $scope.resmsg = response.data.msg;
            },function(error){
                $scope.reserrmsg = error.data;
                console.log(error);
            });
        }

        $scope.cancel_reservation = function(){

            $scope.msg = "";
            $scope.errmsg = "";

            $http({
              method: 'DELETE',
              url: '../tp/' + $scope.selectedEvent.id
            }).then(function successCallback(response) {
                $scope.msg = response.data.msg;
            },function(error){
                $scope.errmsg = error.data.msg;
            });
        }
        $scope.eventRender = function( event, element, view ) {
           element.attr({'tooltip': event.title,
                        'tooltip-append-to-body': true});
           $compile(element)($scope);
        };
        $scope.alertOnEventClick = function( callEvent, jsEvent, view){

            $scope.msg = "";
            $scope.errmsg = "";

            $scope.selectedEvent = callEvent;
        };


        $scope.uiConfig = {
          calendar:{
            height: 450,
            editable: false,
            header:{
              left: 'title',
              center: '',
              right: 'today prev,next'
            },
            eventClick: $scope.alertOnEventClick,
            eventRender: $scope.eventRender
          }
        };

        $http({
          method: 'GET',
          url: '../tp'
        }).then(function successCallback(response) {
            var events = [];
            for(var i=0;i<response.data.length;i++){
                var event = response.data[i];
                events.push({
                    'owner': event.owner,
                    'title': event.owner+', '+ event.quantity+' students',
                    'id': event._id,
                    'start': new Date(event.from),
                    'end': new Date(event.to),
                    'allDay': false,
                    'students': event.accounts,
                    'created': event.created,
                    'about': event.about,
                    'over': event.over,
                });
            }

            angular.element('.calendar').fullCalendar( 'addEventSource', events );
            $scope.eventSources = [events];

        });
});


angular.module('genouest').service('GOLog', function() {
  var logs = [];
  return {
    get: function() {
      return logs;
    },
    add: function(id, fid, desc) {
      logs.push({obj_id: id, file_id: fid, description: desc});
    }
  }
});

angular.module('genouest').service('Auth', function() {
    var user = null;
    return {
        getUser: function() {
            return user;
        },
        setUser: function(newUser) {
            user = newUser;
        },
        isConnected: function() {
            return !!user;
        }
    };
});
