# Quick setup
- The script `test_env_launcher.sh` allows to easily start and stop a fully working test environment. The script can run with two methods : 
    - The quick method : This methods runs the environment like described in the manual setup steps below (i.e. by launching some dockers and relying on your local installation to launch the tests. Lacking reproducibility.). It allows to quickly launch the tests while developing. To use it, you can do `./test_env_launcher.sh quick`.
    - The full method : This methods runs the github actions of the CI pipeline locally (which allows to replicate exactly what will happen in the GitHub pipeline after your push). This method is fully reproducible. To use it, you can do `./test_env_launcher.sh full` or launch the script without argument `./test_env_launcher.sh`.
- It's recommended to use the quick method as you develop the tests. It will allow you to press enter to run the test as many time as you want.
- It's recommended to use the full method before pushing to verify that all is really working well, and to be assured that all the tests will be passing on the CI pipeline.
- The script creates the necessary files to run the tests and verify that old test artifacts don't exists anymore.
- This is the preferred method to launch the test environment. If you wish to create your own setup, you can follow the guide below (which will not follow the steps of the GitHub actions running after the push).

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
