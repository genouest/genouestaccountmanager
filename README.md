# My Accounts Manager

## About

*My* has been developped at GenOuest bioinformatics core facility for internal use.
Goal was to help us to manage our users:

* registration but also expiration
* self-service with password reset, database creation, ...
* user life-cycle in general
* temporary users creation for trainings
* etc.

While adding new features we tried to make it as open and general as possible, though some *genouest* references are still present in the code, and some choices may not match your personnal requirements. You may however adapt it to your needs. We expect future developments to remove some of the implementation decisions to make them more flexible (via config for example).

Basically, *my* offers a Web UI for user and self-service management and updates LDAP information accordingly.
Cron tasks will manage background scripts to create user home directories, etc.

Web interface and user life cycle are linked to optional plugins. It is easy to add new ones to add features (execute *this* at user activation, execute *that* on user deletion, ...)

## Config

All configuration is in config/default.json. One can use [config/default.json.template](config/default.json.template) as example.

Optional double authentication for administrators with config parameter double_authentication_for_admin.
It provides additional authentication via U2F devices or temporary email tokens.

## Installation

Requires openldap client and devel libs (apt-get install libldap2-dev) and uuid lib (uuid-dev)
Also needs nodejs, npm installed

    npm install && cd manager2 && npm install

You need to *npm install* both backend and frontend

## User Home management

Home directory will be build according to:

    CONFIG.general.home + user.maingroup + user.group
    Example:
        /home/mymaingroup/mygroup
        /home/mygroup #if mymaingroup is empty

Secondary groups can be added to a user. In this case, user will be added as a memberOf of this group.
User is also set as memberOf for main group.

You may disable this by setting the config option **general.use_group_in_path** to **false**

## Databases

Database used by softwaremanager is MongoDB. It also use OpenLDAP to insert LDIF files for account creation/update.

An optional but recommended additional database is Redis. If not willing to use Redis, set redis.host in config/default.json to *null*. This database is used to allocated user/group ids in a multi-process context.

LDAP users are expected to have DN startnig with uid= and not cn=.
For an existing LDAP database, users should be migrated to match this DN.

Note that uid attribute is mandatory for each user entries in ldap, even if you change ldap template to modify DN management.

For an existing LDAP directory, one must import existing users and groups in mongo. There is an example of automated script for this: [import_from_ldap.js](import_from_ldap.js), you should adapt it to fit your ldap schema

### Starting from An empty LDAP

First step is to create the first admin user (must be defined as admin in config file).

At application start, one can use environment variables to automatically create an internal user and group:

* disable, if set, double_authentication_for_admin in configuration

Then launch add with following env vars:

* MY_ADMIN_USER=admin
* MY_ADMIN_GROUP=admin
* MY_ADMIN_EMAIL=admin@my.org
* MY_ADMIN_PASSWORD=XXXX

If specified env vars refer to an exiting group or user, then their creation is skipped.

All other users will use standard registration process via WEB UI and admin will be able to validate them via the UI (as well as for other admin).

## Running and Stopping

    forever start -o out.log -e err.log app.js

    forever stop app.js

## Cron

Some commands will be generated in script_dir (config), and executed by the cron task. This means that some commands will have a small delay (cron execution).
Cron must be executed as root as it needs to create home etc.... Cron task may run on a different server, it only needs access to script directory.

[gomngr.sh](cron/gomngr.sh) should be croned to execute this generated scritps (every minutes). It takes as input the path to the scripts location and the url of the gomngr server.

Example:

    * * * * * /opt/gomngr/genouestaccountmanager/cron/gomngr.sh   /opt/gomngr/scripts http://127.0.0.1:3000 # URL to account manager

To manage user account expiration, add the following script to your cron:

    0 3 1 * * /opt/gomngr/genouestaccountmanager/test_expiration.sh >> /opt/gomngr/genouestaccountmanager/test_expiration.log 2>&1
    0 3 2 * * /opt/gomngr/genouestaccountmanager/expire.sh >> /opt/gomngr/genouestaccountmanager/expiration.log 2>&1

test_expiration check if user will expire *soon* and sends an email to the user so that he extends his account if needed.
expiration deactivates accounts if their expiration date is reached.

## Logging

By default all logging is done on standard output and error.

You may want to have the access log (http log) to a specific file using environment variable:

    MY_ACCESS_LOG=/var/log/my.access.log /usr/bin/node /opt/my/app.js

Please note that it will affect only express http log, for application log you will have to redirect the standard output to file.

## Mailing

Users are subscribed to a mailing list based on their email address. The email address of account is *MANDATORY*.
This is used to broadcast messages to all users. Mailing list is using **gomail**.

Standard smtp configuration is used for user notifications.

If you wish to use other mailing list system, or no mailing list, one can add routes/notif_**your mailer system**.js, replacing functions content by your own api or empty calls. Then set the config variable **general.mailer** to the name of **your mailer system**.

## Plugins

Software supports plugins to add some info and basic tasks in Web UI in user information page. Plugin needs to be declared in config file to be activated.

Plugins are stored in plugins directory, there are examples available.

Basically a plugin must react on user activation/deactivation, provide an Angular template and react on user update or plugin action. It must return a promise and always be successful (resolve, no reject).

For ui frontend, plugin templates need to be defined in [plugin.component.ts](manager2/src/app/plugin/plugin.component.ts) and declared in [app.module.ts](./manager2/src/app/app.module.ts).

The *admin* parameter of plugin definition specifies if plugin is linked to user (in user panel and linked to user lige cycle) or a global plugin that will be shown in *admin* menu (not linked to user life cycle)

## Templates

Script and Ldif are generated using a templates systems using jinja2 syntax.

To customise it, you can create a directory in [templates](templates) and set the config variable **general.templates** to the name of this directory.

After that you can copy any file from [templates/default](templates/default) to this new directory and modify the file content according to your need.

Please note that you must use the same directory tree as in default.

## Testing

With env variable *export gomngr_auth=fake*, one can disable authentication password verification (**FOR TESTING ONLY**)

In *tests* directory, a docker-compose is available to setup whole infrastructure but needs adaptation if needed to use in production (volumes, database url, ...)

## Development

To start server

    node app.ps

To build docker without sentry support

    docker build --build-arg APIURL=https://MYACCOUNTMANAGERURL -t osallou/my

with sentry support:

    docker build --build-arg APIURL=https://MYACCOUNTMANAGERURL --build-arg SENTRY=https://XXXX@sentry.genouest.org/2 -t osallou/my

Sentry is a service to catch bugs in app and record them in Sentry web app (optional). Sentry key must be set at docker build time.

## Deploying

### With Docker

See and adapt [docker-compose.yml](./tests/docker-compose.yml) file then:

    docker-compose up -d

### With Ansible

Using [https://gitlab.com/ifb-elixirfr/ansible-roles/ansible-my](https://gitlab.com/ifb-elixirfr/ansible-roles/ansible-my)
