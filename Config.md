# Detail of config variable

```json
{
```

## general

```json
"general": {
```

+ name

    The name of the application, it will be use in the main website title and in some other place.

    ```json
      "name": "My Cluster",
    ```

+ max_account

    The maximum number of account, registration will disable if this limit is reach, this limit is disabled if you set it to 0.

    ```json
      "max_account": 0,
    ```

+ readme

    A list of documentation path by language, it will create the link to those path in each user home.

    + language
    + source_folder

    ```json
      "readme": [
        {
          "language": "francais",
          "source_folder" : "/opt/my/readmes/fr/"
        },
        {
          "language": "english",
          "source_folder" : "/opt/my/readmes/en/"
        }
      ],
    ```

+ terms_of_use

    A link to terms of use, registration form will ask user to accept it before creating an account. It can be local or distance, relative or absolute as html link.

    ```json
      "terms_of_use": "https://ressources.france-bioinformatique.fr/sites/default/files/pages/IFB_ToU_federated_cluster_infrastructures.pdf",
    ```

+ web_home

    Define the user home, it can be "project" to be redirected to project page after login, or as default "user" to be redirected to user profil

    ```json
      "web_home": "project",
    ```


+ double_authentication_for_admin

    A boolean to enable or disable double authentification.

    ```json
      "double_authentication_for_admin": false,
    ```

+ db

    Look like it is not used in the source, should be removed.

    ```json
     "db": "gomngr",
    ```

+ url

    The main url of the website backend, which provide api service.

    ```json
     "url": "https://my.cluster.example.org",
    ```

+ admin

    A list of admin. Username in this list will have access to the admin part of the main website.

    ```json
     "admin": [ "alice", "bob" ],
    ```

+ support

    The email of the support team, it is displayed on some page in the main website.

    ```json
      "support": "contact-cluster@my.cluster.example.org",
    ```

+ accounts

    The email of the tech team which will be notified on some event (as for example account creation), most of time it should be the same as "support"

    ```json
     "accounts": "contact-cluster@my.cluster.example.org",
    ```

+ secret

    A secret seed, for secret hash ...

    ```json
     "secret": "aVerySecretHash",
    ```

+ script_dir

    The path where the shell script are generated. For some operation like user home creation My will generate shell script, it the path where they are created.

    ```json
     "script_dir": "/opt/my/scripts",
    ```


+ cron_bin_script

    Look like it is not used in the source, should be removed.

    ```json
     "cron_bin_script": "/opt/my/gomngr.sh",
    ```

+ admin_ip

    A list of ip adress allowed for admin connection, it can be empty to allow any ip.

    ```json
     "admin_ip": [],
    ```

+ usage_directory

    Look like it is not used in the source, should be removed.

    ```json
     "usage_directory": "/tmp",
    ```

+ home

    The base path to the user home. It will be concatened with some other info, like username.

    ```json
     "home": "/shared/home/",
    ```

+ use_group_in_path

    A boolean to add the user group in the user home path, if it is enable, user home will be [home]/[main group]/[user group]/[username] else it will be [home]/[username].

    ```json
     "use_group_in_path": false,
    ```

+ main_groups

    A list of user "main" group, it will be updatable in the user profil page and it is used in home path.

    ```json
     "main_groups": ["my"],
    ```

+ default_main_group

    The default main group when a user is created

    ```json
     "default_main_group": "my",
    ```


+ auto_add_group

    A boolean to auto create registration group if it does not exist before user activation.

    ```json
     "auto_add_group": false,
    ```

+ registration_group

    The group the user will be associed after registration, it can be "username" to be the same as the username, "main" to be the value of the config variable "default_main_group", or "team" to be the value filled by user in the team field on registration.

    ```json
     "registration_group": "main",
    ```

+ disable_user_group

    A boolean to disable user group management. It will not disable 'secondary' group management, only main and registration user group.

    If set to true, most other "general" group option will be ignored, you may also have to update some template file.


    ```json
     "disable_user_group": true,
    ```

+ mailer

    The mailer used to send email, it can be "gomail" or "nodemailer", nodemailer should be used if you are not at genouest.

    ```json
     "mailer": "nodemailer",
    ```

+ templates

    The name of the template list to use, it can be "default" "genouest" or "ifb", if a template file is not find in the corresponding directory, it will fallback to "default".

    Template are use to execute "external" action, for example update your ldap, or launch a script, see the content of the "templates" to see how it used for genouest and ifb.

    If you install my on your own cluster, you should customize some of this file.

    ```json
     "templates": "ifb",
    ```

+ bansec

    The number of second a user is banned if he enter a bad password on login page.
    ```json
     "bansec": "600",
    ```

+ minuid

    The minimum user id, new user will not have any id lesser than this.

    ```json
     "minuid": 100000,
    ```

+ maxuid

    The maximum user id, new user will not have any id greater than this.

    ```json
     "maxuid": 1000000,
    ```

+ mingid

    The minimum group id, new user will not have any id lesser than this.

    ```json
     "mingid": 100000,
    ```

+ maxgid

    The maximum group id, new user will not have any id greater than this.

    ```json
     "maxgid": 1000000,
    ```

+ username_max_length

    The maximum username length, it is checked on user registration.

    ```json
     "username_max_length": 256,
    ```

+ quota

    A list of api to be called. Maybe related to quota (or to a quota plugin).
    Look like it is not used in the source, should be removed.

    ```json
      "quota": {
       },
    ```

+ user_extra_dirs

    A list of extra directory to create on user activation. It can contain some variable like #USER# or #GROUP#.

    ```json
       "user_extra_dirs": [
         "/shared/home/#USER#/extra/#USER#/",
         "/shared/home/#USER#/extra/#GROUP#/"
        ],
    ```

+ plugin_script_dir

    The path where to find My plugins.

    ```json
      "plugin_script_dir": "/opt/my/plugin-scripts"
    ```

```json
  },
```

## usage

    A list of url added in the main website menu to allow user to acces some other tool. It can contain some variable like #USER#.

```json
"usage": [
    "https://my.cluster.example.org/?user=#USER#"
],
```

## duration

    A list of duration availlable on registration form and user update for admin. It defined for each label a number of day to be added to the current date.

```json
"duration": {
  "1 year": 365,
  "3 months": 91,
  "6 months": 182
},

```

## enable_ui

    A list of boolean to disable some part of the main website. It will not prevent the use of those page, it will only remove the visible link to it.

```json
  "enable_ui": {
```

+ databases

    For the databases management part of the user profil. If you don't use mysql or don't want to declare it in My.

    ```json
      "databases": false,
    ```

+ ip

    The user Ip address field in registration form and user update form.

    ```json
      "ip": false,
    ```

+ main_group

    The main group field in the user update form. It should be disable if you set general.disable_user_group to true.

    ```json
      "main_group": false,
    ```

+ messages

    The admin link to send message to mailing list. It should be disabled if you user nodemailer as default mailer because it is not implemented yet.

    ```json
      "messages": false,
    ```

+ newsletters

    The button to unsbuscribed from the newsletter. (Admin will still be able to see it)

    ```json
      "newsletters": false,
    ```

+ tps

    The menu link to tp reservation page system.

    ```json
      "tps": false,
    ```

+ u2f_key

    The u2f key field in the user update page.

    ```json
      "u2f_key": false,
    ```

+ websites

    For the websites declaration part in the user profil.

    ```json
      "websites": false
    ```

```json
  },
```

## project

## bills

## mongo

    The information about mongo database.
    ```json
    ```

+ host
    ```json
    ```

+ port

## rabbitmq

    The information about rabbitmq messaging service.
    ```json
    ```

+ url
    ```json
    ```

+ exchange

## redis

    The information about redis database. To disable it you can set host as "null".
    ```json
    ```

+ host
    ```json
    ```

+ port

## nodemailer

    The information about the smtp server and email management with nodemailer.
    ```json
    ```

+ prefix

    A prefix added to all mail subject sent by My.
    ```json
    ```

+ host
    ```json
    ```

+ port
    ```json
    ```

+ origin

    The "From" of the email sent by My.
    ```json
    ```

+ list

    The Sympa Mailing list information to auto add user to it.

    + address
    + cmd_add
    + cmd_del
    + cmd_address

## gomail

    The information about the email api management with gomail.
    ```json
    ```

+ host
    ```json
    ```

+ api_root
    ```json
    ```

+ api_secret
    ```json
    ```

+ main_list
    ```json
    ```

+ origin
    ```json
    ```

+ tag

## ldap

    The information about ldap user database.
    ```json
    ```

+ host
    ```json
    ```

+ dn
    ```json
    ```

+ admin_cn
    ```json
    ```

+ admin_dn
    ```json
    ```

+ admin_password
    ```json
    ```

+ team

## mysql

    The information about mysql database if you want My to auto create your user database
    ```json
    ```

+ host
    ```json
    ```

+ user
    ```json
    ```

+ password

## tp

    The information about tp user creation
    ```json
    ```

+ prefix

    The first part of the tp username, after this the user id will be added.
    ```json
    ```

+ group

    Look like it is not used in the source, should be removed.

    + name
    + gid
    ```json
    ```

+ extra_expiration

    The number of day the account will be availlable after the end of the tp
    ```json
    ```

+ fake_mail_domain

## message

    The list of email template sent by mail, each have a plain text and html version.
    ```json
    ```

+ activation
    ```json
    ```

+ activation_html
    ```json
    ```

+ ask_project
    ```json
    ```

+ ask_project_html
    ```json
    ```

+ confirmation
    ```json
    ```

+ confirmation_html
    ```json
    ```

+ deletion
    ```json
    ```

+ deletion_html
    ```json
    ```

+ expiration
    ```json
    ```

+ expiration_html
    ```json
    ```

+ footer
    ```json
    ```

+ footer_html
    ```json
    ```

+ password_reset
    ```json
    ```

+ password_reset_html
    ```json
    ```

+ password_reset_request
    ```json
    ```

+ password_reset_request_html
    ```json
    ```

+ reactivation
    ```json
    ```

+ reactivation_html
    ```json
    ```

## plugins

    A list of activated plugins.

    ```json
    ```

## plugin_config

    A list of plugin configuration variable.
    ```json
    ```
