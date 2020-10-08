# Detail of config variable

## general

+ name

    The name of the application, it will be use in the main website title and in some other place.

    example:
    ```json
        "name": "my entity"
    ```

+ max_account

    The maximum number of account, registration will disable if this limit is reach, this limit is disabled if you set it to 0.

+ readme

    A list of documentation path by language, it will create the link to those path in each user home.

    + language
    + source_folder

+ terms_of_use

    A link to terms of use, registration form will ask user to accept it before creating an account. It can be relative or absolute as html link.

+ web_home

    Define the user home, it can be "project" to be redirected to project page after login, or as default "user" to be redirected to profil

+ double_authentication_for_admin

    A boolean to enable or disable double authentification.

+ db

    Look like it is not used in the source, should be removed.

+ url

    The main url of the website backend, which provide api service.

+ admin

    A list of admin. Username in this list will have access to the admin part of the main website.

+ support

    The email of the support team, it is displayed on some page in the main website.

+ accounts

    The email of the tech team which will be notified on some event (as for example account creation), most of time it should be the same as "support"

+ secret

    A secret seed, for secret hash ...

+ script_dir

    The path where the shell script are generated. For some operation like user home creation My will generate shell script, it the path where they are created.

+ cron_bin_script

    Look like it is not used in the source, should be removed.

+ admin_ip

    A list of ip adress allowed for admin connection, it can be empty to allow any ip.

+ usage_directory

    Look like it is not used in the source, should be removed.

+ home

    The base path to the user home. It will be concatened with some other info, like username.

+ use_group_in_path

    A boolean to add the user group in the user home path, if it is enable, user home will be [home]/[main group]/[user group]/[username] else it will be [home]/[username].

+ main_groups

    A list of user "main" group, it will be updatable in the user profil page and it is used in home path.

+ default_main_group

    The default main group when a user is created

+ minuid

    The minimum user id, new user will not have any id lesser than this.

+ maxuid

    The maximum user id, new user will not have any id greater than this.

+ mingid

    The minimum group id, new user will not have any id lesser than this.

+ maxgid

    The maximum group id, new user will not have any id greater than this.

+ mailer

    The mailer used to send email, it can be "gomail" or "nodemailer", nodemailer should be used if you are not at genouest.

+ templates

    The name of the template list to use, it can be "default" "genouest" or "ifb", if a template file is not find in the corresponding directory, it will fallback to "default".

+ bansec

    The number of second a user is banned if he enter a bad password on login page.

+ username_max_length

    The maximum username length, it is checked on user registration.

+ registration_group

    The group the user will be associed after registration, it can be "username" to be the same as the username, "main" to be the value of the config variable "default_main_group", or "team" to be the value filled by user in the team field on registration.

+ auto_add_group

    A boolean to auto create registration group if it does not exist before user activation.

+ disable_user_group

    A boolean to disable user group management. In case it is handle by external tools. If set to true, you should also update template file to disable it.

+ quota


+ user_extra_dirs

    A list of extra directory to create on user activation. It can contain some variable like #USER# or #GROUP#.

+ plugin_script_dir

    The path where to find My plugins.

## usage

    A list of url added in the main website menu to allow user to acces some other tool. It can contain some variable like #USER#.

## duration

    A list of duration availlable on registration form and user update for admin. It defined for each label a number of day.

## enable_ui

    A list of boolean to disable some part of the main website. It will not prevent the use of those page, it will only remove the visible link to it.

+ databases

    For the databases management part of the user profil. If you don't use mysql or don't want to declare it in My.

+ ip

    The user Ip address field in registration form and user update form.

+ main_group

    The main group field in the user update form.

+ messages

    The admin link to send message to mailing list. It should be disabled if you user nodemailer as default mailer because it is not implemented yet.

+ newsletters

    The button to unsbuscribed from the newsletter.

+ tps

    The menu link to tp reservation page.

+ u2f_key

    The u2f key field in the user update page. If you don't use it.

+ websites

    For the websites management part of the user profil.

## bills

## mongo

    The information about mongo database.

+ host

+ port

## rabbitmq

    The information about rabbitmq messaging service.

+ url

+ exchange

## redis

    The information about redis database. To disable it you can set host as "null".

+ host

+ port

## nodemailer

    The information about the smtp server and email management with nodemailer.

+ prefix

    A prefix added to all mail subject sent by My.

+ host

+ port

+ origin

    The "From" of the email sent by My.

+ list

    The Sympa Mailing list information to auto add user to it.

    + address
    + cmd_add
    + cmd_del
    + cmd_address

## gomail

    The information about the email api management with gomail.

+ host

+ api_root

+ api_secret

+ main_list

+ origin

+ tag

## ldap

    The information about ldap user database.

+ host

+ dn

+ admin_cn

+ admin_dn

+ admin_password

+ team

## mysql

    The information about mysql database if you want My to auto create your user database

+ host

+ user

+ password

## tp

    The information about tp user creation

+ prefix

    The first part of the tp username, after this the user id will be added.

+ group

    Look like it is not used in the source, should be removed.

    + name
    + gid

+ extra_expiration

    The number of day the account will be availlable after the end of the tp

+ fake_mail_domain

## message

    The list of email template sent by mail, each have a plain text and html version.

+ activation

+ activation_html

+ ask_project

+ ask_project_html

+ confirmation

+ confirmation_html

+ deletion

+ deletion_html

+ expiration

+ expiration_html

+ footer

+ footer_html

+ password_reset

+ password_reset_html

+ password_reset_request

+ password_reset_request_html

+ reactivation

+ reactivation_html

## plugins

    A list of activated plugins.

## plugin_config

    A list of plugin configuration variable.
