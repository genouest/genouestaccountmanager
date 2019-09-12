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

## Requirements

LDAP users are expected to have DNS startnig with uid= and not cn=.
For an existing LDAP database, users should be migrated to match this DN.

Home directories are built with the following rule

    CONFIG.general.home ("/" CONFIG.general.main_groups ) "/" group.name "/" user.uid
    Example:
        /home/mygroup/myuserid

main_groups is an optional subpath selected by user, not present by default.

## Config

All configuration is in config/default.json. One can use config/default.json.template as example.

Optional double authentication for administrators with config parameter double_authentication_for_admin.
It provides additional authentication via U2F devices or temporary email tokens.

## Installation

Requires openldap client and devel libs (apt-get install libldap2-dev) and uuid lib (uuid-dev)
Also needs nodejs, npm and bower installed

    npm install
    bower install

## Databases

Database used by softwaremanager is MongoDB. It also use OpenLDAP to insert LDIF files for account creation/update.

An optional but recommended additional database is Redis. If not willing to use Redis, set redis.host in config/default.json to *null*. This database is used to allocated user/group ids in a multi-process context.

For an existing LDAP directory, one must import existing users and groups in mongo. There is no automatic script for this, but here is the following expecting schema to insert in MongoDB.

Insert groups:

    db.groups.insert({ "name" : "mygroup", "gid" : 20857) }

Insert users:

    > db.users.insert({
        "uid" : "my_linux_user_id",
        "email" : "my@email,
        "uidnumber" : 1046,
        "gidnumber" : 20857,
        "secondarygroups" : [ ], # list of group names, not ids
        "maingroup" : "",
        "group" : "mygroup",
        "status" : "Active",
        "loginShell" : "/bin/bash",
        "address" : "my work address",
        "lab" : "lab where I work",
        "responsible": "labs manager",
        "duration" : 1095, # how long account expiration should be extended when requested, in days
        "expiration" : 1515836315661, # timestamp where account expires (in ms)
        "firstname" : "Olivier",
        "lastname" : "Sallou",
        "history" : [], # keep empty
        "ip" : "127.0.0.1", # optional IP address of user, in case you use IP for access to servers
        "is_internal" : true,
        "ssh" : "", # keep empty
        "why" : null # keep null
        })

## User management

Home directory will be build according to:

    CONFIG.general.home + user.maingroup + user.group
    Example:
        /home/mymaingroup/mygroup
        /home/mygroup #if mymaingroup is empty

Secondary groups can be added to a user. In this case, user will be added as a memberOf of this group.
User is also set as memberOf for main group.

## Logging

By default all logging is done on standard output and error.

You may want to have the access log (http log) to a specific file using environment variable:

```
MY_ACCESS_LOG=/var/log/my.access.log /usr/bin/node /opt/my/app.js
```

Please note that it will affect only express http log, for application log you will have to redirect the standard output to file.

## Running

    forever start -o out.log -e err.log app.js

## Starting from

### An empty LDAP

First step is to create the first admin user (must be defined as admin in config file).

At application start, one can use environment variables to automatically create an internal user and group:

* disable, if set, double_authentication_for_admin in configuration

Then launch add with following env vars:

* MY_ADMIN_USER=admin
* MY_ADMIN_GROUP=admin
* MY_ADMIN_EMAIL=admin@my.org
* MY_ADMIN_PASSWORD=XXXX

If specified env vars refer to an exiting group or user, then their creation is skipped.

Else, to add some extra users, register as a basic user via the Web UI and confirm the email.
Once this is done:

* disable, if set, double_authentication_for_admin in configuration
* disable for the time of admin validation the password verification:
  * set your computer ip in config field admin_ip and restart server
  * OR set env variable gomngr_auth=fake and restart server (**CAUTION**: this will disable checks for all users, access should be limited)
* login in UI, in password put anything
* Admin->Groups menu, create a new group matching the group of the admin user.
* Wait for group to be created in LDAP once cron has executed the script (check in *script_dir* the result of the command)
* Activate the user
* re-enable password verification (unset admin_ip in config or unset gomngr_auth env variable) and restart server
* Login in the Web UI to check login/password verification
* Optionally, re-enable double_authentication_for_admin in config

All other users will use standard registration process via WEB UI and admin will be able to validate them via the UI (as well as for other admin).

### From an existing/populated LDAP

If an LDAP database already contains users, one need to:

* Check that users DN are like "uid=XXX,ou=..." and not "cn=xx yyy,ou=", else users DNs should be modified
* Import groups and users in gomngr database to sync gomgnr and ldap, to do so you can try the import_from_ldap script

    node import_from_ldap.js --test # Check first with no import
    If everything is fine:
    node import_from_ldap.js --import --admin admin_user_id # Check first with no import

Users will not be added to mailing list.

## Development

To start server

    node app.ps

To build docker without sentry support

    docker build --build-arg APIURL=https://MYACCOUNTMANAGERURL -t osallou/my

with sentry support:

    docker build --build-arg APIURL=https://MYACCOUNTMANAGERURL --build-arg SENTRY=https://XXXX@sentry.genouest.org/2 -t osallou/my

Sentry is a service to catch bugs in app and record them in Sentry web app (optional). Sentry key must be set at docker build time.

### Cron task

Some commands will be generated in script_dir (config), and executed by the cron task (see below). This means that some commands will have a small delay (cron execution).
Cron must be executed as root as it needs to create home etc.... Cron task may run on a different server, it only needs access to script directory.

Example:

    * * * * * /opt/gomngr/genouestaccountmanager/bin/gomngr.sh   /opt/gomngr/scripts http://127.0.0.1:3000 # URL to account manager

To manage user account expiration, add the following script to your cron:

    0 3 1 * * /opt/gomngr/genouestaccountmanager/test_expiration.sh >> /opt/gomngr/genouestaccountmanager/test_expiration.log 2>&1
    0 3 2 * * /opt/gomngr/genouestaccountmanager/expire.sh >> /opt/gomngr/genouestaccountmanager/expiration.log 2>&1

test_expiration check if user will expire *soon* and sends an email to the user so that he extends his account if needed.
expiration deactivates accounts if their expiration date is reached.

To build cron image:

    cd tests
    docker build -t osallou/mycron -f Dockerfile-cron .

## Mailing

Users are subscribed to a mailing list based on their email address. The email address of account is *MANDATORY*.
This is used to broadcast messages to all users. Mailing list is using **gomail**.

Standard smtp configuration is used for user notifications.

If you wish to use other mailing list system, or no mailing list, one can replace the routes/notif.js, replacing functions content by your own api or empty calls.

## Stopping

forever stop app.js

## Cron

bin/gomngr.sh should be croned to execute generated scritps (every minutes). It takes as input the path to the scripts location and the url of the gomngr server.
Must be executed as root

    gomngr.sh /opt/my_script_dir http://localhost:3000

Script execution includes home directory manipulation and ldap modifications. LDAP tools (ldap-utils with ldapmodify etc...) must be installed where the cron job is executed.

## Plugins

Software supports plugins to add some info and basic tasks in Web UI in user information page. Plugin needs to be declared in config file to be activated.
Plugins are stored in plugins directory, there are examples available.
Basically a plugin must react on user activation/deactivation, provide an Angular template and react on user update or plugin action. It must return a promise and always be successful (resolve, no reject).

For manager2, plugin templates need to be defined in manager2/src/app/plugin/plugin.component.ts and declared in app.module.ts.

The *admin* parameter of plugin definition specifies if plugin is linked to user (in user panel and linked to user lige cycle) or a global plugin that will be shown in *admin* menu (not linked to user life cycle)

## Testing

With env variable *export gomngr_auth=fake*, one can disable authentication password verification (**FOR TESTING ONLY**)

In *tests* directory, a docker-compose is available to setup whole infrastructure but needs adaptation if needed to use in production (volumes, database url, ...)

## Deploying

See and adapt docker-compose.yml file then:

    docker-compose up -d
