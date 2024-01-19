# Changelog

## 1.4.29

* Various security PR merged
* Add ordering to most admin tables
* Add user registration date to the 'Pending admin approval' and 'Pending email approval' table, and remove user ID

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
* upgrade jsonwebtoken to v9 to fix CVE https://cve.report/CVE-2022-23540
