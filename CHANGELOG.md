# Changelog

## 1.4.31 (Unreleased)

* Fix 'Admin' button in 'My projects' page for administrators
* Set expiration_notif = 0 when manually expiring a user
* Restrict '/user' route results when passing 'short=true' as a get param

## 1.4.30 (2024-08-02)

* Added a `project.terms_and_conditions_hds` setting in the config:
  If true:
    "Ask Admin" button to submit project creation form became available after 'project name' and 'expiration date' are filled, 'project description' is at least 30 char and a checkbox appears and 'terms and conditions hds' should also be checked
  If false:
    "Ask Admin" button to submit project creation form became available after 'project name' and 'expiration date' are filled, 'project description' is at least 30 char, no consent checkbox
* Add 'End date' to the project request page
* Set 'description' as a required field in the project request page and set a minimal length of 30 char
* Add a link to user profile on admin panels -> projects pending table
* Add 'Extend' button for admins to extend active TPs
* Add checks to user registration form, the user information update form and the TP reservation form
* Add back button from single project view
* Updated TP calendar to increase readability
* Fix newly created group selection bug
* Update admin project creation UI: disappearing buttons and add "undo selection" button
* Actually show angular errors in web console when not in production and sentry is not set
* Fix owner change for databases and websites

## 1.4.29

* Various security PR merged
* Add ordering to most admin tables
* Add user registration date to the 'Pending admin approval' and 'Pending email approval' table, and remove user ID
* Updated buttons to make them more visible
* Allow group creation on the user page
* Set group owner as 'optional'
* Allow otp removal for users and admins
* Allow user expiration without sending a mail for gomail
* Allow admin 'unlock' of a locked (3 time wrong login) account
* Fix tag creation crash
* Allow a pending project edition without validating it.
* Add optional description to group

## 1.4.28

* Fix security check for user identity when making API calls
* Fix ldap sync
* Use genouest quay.io repo as base images
* Fix case where user is not found when uploading ssh key
* Allow optional feedback for user creation options (see PR #406)

## 1.4.27

* fix user removal for gomail

## 1.4.26

* prefix training groups with *tp_* and use config *mail_template* to define training accounts email
* user lock:
  * if config.general.bansec===0 then skip lock
  * manage login lock via redis and add *bin/my-accounts.js unlock userid* command
* set min len for database name length
* [docker] change order of commands
* on renew by admin or user, reset expiration_notif
* add listmonk mailer support
* upgrade jsonwebtoken to v9 to fix CVE <https://cve.report/CVE-2022-23540>
