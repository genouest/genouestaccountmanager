/*jslint sub:true, browser: true, indent: 4, vars: true, nomen: true */

(function () {
  'use strict';

      // Server URL prefix
      var prefix = '';

      function GOActionLog($resource) {
        return $resource(prefix+'/log', {}, {
            get: {
                url: prefix+'/log/:event',
                method: 'GET',
                isArray: false,
                cache: false
            },
            list: {
                  url: prefix+'/log',
                  method: 'GET',
                  isArray: true,
                  cache: false
            },
            user_list: {
                  url: prefix+'/log/user/:id',
                  method: 'GET',
                  isArray: true,
                  cache: false
            }
        });
      }

      function IP($resource) {
        return $resource('/ip', {}, {
            get: {
              paramDefault: {callback: '?'},
              method: 'GET',
              isArray: false,
              cache: false
            }
        });
      }

      function Group($resource) {
        return $resource(prefix+'/group', {}, {
            list: {
              url: prefix+'/group',
              method: 'GET',
              isArray: true,
              cache: false
            },
            add: {
              url: prefix+'/group/:name',
              method: 'POST',
              isArray: false,
              cache: false
          },
          get: {
            url: prefix+'/group/:name',
            method: 'GET',
            isArray: true,
            cache: false
          },
          delete: {
              url: prefix+'/group/:name',
              method: 'DELETE',
              isArray: false,
              cache: false
          },
          update: {
              url: prefix+'/group/:name',
              method: 'PUT',
              isArray: false,
              cache: false
          }
        });
      }

      function Project($resource) {
        return $resource(prefix+'/project', {}, {
            list: {
              url: prefix+'/project',
              method: 'GET',
              isArray: true,
              cache: false
            },
            add: {
              url: prefix+'/project',
              method: 'POST',
              isArray: false,
              cache: false
          },
            update: {
              url: prefix+'/project/:name',
              method: 'POST',
              isArray: false,
              cache: false
          },
          delete: {
            url: prefix+'/project/:name',
            method: 'DELETE',
            isArray: false,
            cache: false
          }
          });
      }


      function Quota($resource) {
        return $resource(prefix+'/disk', {}, {
            get: {
              url: prefix+'/quota/:name/:disk',
              method: 'GET',
              isArray: false,
              cache: true
            }
          });
      }

      function Database($resource) {
        return $resource(prefix+'/database', {}, {
            list: {
              url: prefix+'/database',
              method: 'GET',
              isArray: true,
              cache: false
            },
            listowner: {
              url: prefix+'/database/owner/:name',
              method: 'GET',
              isArray: true,
              cache: false
            },
            add: {
              url: prefix+'/database/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            delete: {
              url: prefix+'/database/:name',
              method: 'DELETE',
              isArray: false,
              cache: false
            },
            changeowner: {
              url: prefix+'/database/:name/owner/:old/:new',
              method: 'PUT',
              isArray: false,
              cache: false
            }
          });
      }

      function Web($resource) {
        return $resource(prefix+'/web', {}, {
            list: {
              url: prefix+'/web',
              method: 'GET',
              isArray: true,
              cache: false
            },
            listowner: {
              url: prefix+'/web/owner/:name',
              method: 'GET',
              isArray: true,
              cache: false
            },
            add: {
              url: prefix+'/web/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            delete: {
              url: prefix+'/web/:name',
              method: 'DELETE',
              isArray: false,
              cache: false
            },
            changeowner: {
              url: prefix+'/web/:name/owner/:old/:new',
              method: 'PUT',
              isArray: false,
              cache: false
            }
          });
      }

      function User($resource) {
        return $resource(prefix+'/user', {}, {
            is_subscribed: {
                url: prefix+'/user/:name/subscribed',
                method: 'GET',
                isArray: false,
                cache: false
            },
            list: {
              url: prefix+'/user',
              method: 'GET',
              isArray: true,
              cache: false
            },
            update: {
              url: prefix+'/user/:name',
              method: 'PUT',
              isArray: false,
              cache: false
            },
            update_ssh: {
              url: prefix+'/user/:name/ssh',
              method: 'PUT',
              isArray: false,
              cache: false
            },
            delete: {
              url: prefix+'/user/:name',
              method: 'DELETE',
              isArray: false,
              cache: false
            },
            get: {
              url: prefix+'/user/:name',
              method: 'GET',
              isArray: false,
              cache: false
            },
            is_authenticated: {
              url: prefix+'/auth',
              method: 'GET',
              isArray: false,
              cache: false
            },
            authenticate: {
              url: prefix+'/auth/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            register: {
              url: prefix+'/user/:name',
              method: 'POST',
              isArray: false,
              cache: false
            },
            activate: {
              url: prefix+'/user/:name/activate',
              method: 'GET',
              isArray: false,
              cache: false
            },
            sendMessage: {
              url: prefix+'/message',
              method: 'POST',
              isArray: false,
              cache:  false
            },
            expire: {
              url: prefix+'/user/:name/expire',
              method: 'GET',
              isArray: false,
              cache: false
            },
            renew: {
              url: prefix+'/user/:name/renew',
              method: 'GET',
              isArray: false,
              cache: false
            },
            extend: {
              url: prefix+'/user/:name/renew/:regkey',
              method: 'GET',
              isArray: false,
              cache: false
            },
            password_reset_request: {
              url: prefix+'/user/:name/passwordreset',
              method: 'GET',
              isArray: false,
              cache: false
            },
            update_password: {
              url: prefix+'/user/:name/passwordreset',
              method: 'POST',
              isArray: false,
              cache: false
            },
            add_group: {
              url: prefix+'/user/:name/group/:group',
              method: 'POST',
              isArray: false,
              cache: false
            },
            delete_group: {
              url: prefix+'/user/:name/group/:group',
              method: 'DELETE',
              isArray: false,
              cache: false
            },
            create_cloud: {
              url: prefix+'/user/:name/cloud',
              method: 'POST',
              isArray: false,
              cache: false
            },
            delete_cloud: {
              url: prefix+'/user/:name/cloud',
              method: 'DELETE',
              isArray: false,
              cache: false
          },
          update_quota: {
              url: prefix+'/user/:name/quota',
              method: 'POST',
              isArray: false,
              cache: false
          }
          });
      }

      function Logout($resource) {
        return $resource(prefix+'/logout');
      }



  angular.module('genouest.resources', ['ngResource'])
  .factory('Group', Group)
  .factory('Project', Project)
  .factory('Quota', Quota)
  .factory('Database', Database)
  .factory('Web', Web)
  .factory('User', User)
  .factory('Logout', Logout)
  .factory('GOActionLog', GOActionLog)
  .factory('IP', IP);

}());
