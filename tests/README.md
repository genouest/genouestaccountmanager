# Setup

Create a .env file with

    MYDIR=__path_to_tests_directory
    MY_ADMIN_EMAIL=mail_of_admin_user
    MY_ADMIN_PASSWORD=password_of_admin_user


# LDAP

admin login: cn=admin,dc=my,dc=org
pwd: my

# Running tests

Launch docker-compose and wait for completion

Then:

    mocha -t 10000

(may need to install mocha with *npm install -g mocha*)
