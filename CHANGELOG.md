# Changelog

## 1.4.33 (Unreleased)

* Ensure emails have name, destination and subject
* Fix bug in TP account deletion
* UI improvements on projects page
* Fix database creation validation confirmation email
* Fix database creation request email title
* Remove DB 'size' attribute

## 1.4.32 (2025-04-22)

* Fix error when subscribing / unsubscribing to email
* Clearer error message when adding a website
* Add User, Project and Group static classes to front end (refactor)
* Add checks for website owner update
* Fix error in 'projects' tab from user page
* increase size of input field in users page
* add a readonly input field under email for showing the email domain*
* Add "custom_users" key to config file, to be used with various scripts
* Add "project managers" that can request admins to add/remove project members
* Check that user being removed is not owner or last member of a project
* Add email sent to a project owner when their project is activated
* Separate global overview from individual group view in admin group management
* Allow accents in user's first and last names
* Secure project deletion (and removing users from project) with a confirmation modal
* Add checks when removing user from a project's linked group
* Remove 'Home works' message
* Add rejection message for projects

## 1.4.31 (2024-09-27)

* Fix 'Admin' button in 'My projects' page for administrators
* Set expiration_notif = 0 when manually expiring a user
* Restrict '/user' route results when passing 'short=true' as a get param
* Add list of user DBs back to user page
* Remove mel from abims templates

## 1.4.30 (2024-08-02)

* Password enhancement
  * Add an eye for visible/hidden on the password field in login/profile page
  * Disable "update password" button until both fields are entered on profile page
  *  Centered input fields
  *  Added dynamic rules requirements in order for user to know what to add to his password
  *  Password rules is 12 char, with 1 spec char, 1 digit and no spaces
  *  Updated generated password via generate-password to 12 when account activated
  *  Updated also db user password generated to 12
  *  Added a red cross/green tick in the input for passwork and password confirmation

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
