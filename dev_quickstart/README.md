This is a basic setup to deploy genouestaccountmanager for development.
Genouestaccountmanager is fairly modular, so it will not fit a deployment for production. This is for basic usage.

# Setup

* Edit ldap-data/01_orgs.ldif to fit your needs (not required)
* `docker compose up -d`
* If using gomail (default): 
  * You will need a token: You can use the following command to get it:
  `docker compose exec gomail-web python3 gomail/tokenmngr.py`
  * Add this token (formated as follows: `bearer youtokenvalue` in defaut.json, in ['gomail']['api_secret']
* Edit defaut.json as needed 
  * **At least the 'url' key, to match the access url to your instance**
  * You may want to add your first username to the 'admin' list in the same file
* Copy it in genouestaccountmanager/config/
* phpldapadmin will be available on port 8080 if needed.

## Requirements

* Install node > 18.0 (using nvm, or by hand)
* Install ldap-utils
  * /!\ Depending on your ldap-utils version, the '-h' option might not exists anymore. (Check the `ldapadd` command)
  * If that's the case, you'll need to edit the scripts in templates/default/user/, and remplace `-h {{ CONFIG.ldap.host }}` by `-H ldap://{{ CONFIG.ldap.host }}`
* Export the following env variables:




```
export gomngr_auth=fake
export NODE_OPTIONS="--openssl-legacy-provider --no-experimental-fetch"
# Adjust for the required port
export PORT=80
```

* Use the following commands (from the genouestaccountmanager folder):

```
npm install -g @angular/cli@10.2.0
npm ci
cd manager2/
npm ci
```

From there, you can build the frontend part with:

```
cd manager2
ng build --base-href /manager2/ --source-map
```

You may wish to use this command instead for development (The process will keep running, and monitor any changes in the front-end code)

```
ng build --base-href /manager2/ --source-map --watch
# The build will be done after the 'Time:' log entry
```

From there, you can lauch the server with the following command:

```
# You can use the following env variables to automatically create an admin user
MY_ADMIN_USER=admin
MY_ADMIN_GROUP=admin
MY_ADMIN_EMAIL=admin@my.org
MY_ADMIN_PASSWORD=XXXX
# From the genouestaccountmanager folder
# Don't forget to export the env variables again if you are using a separate session
node app.js
```

* If not using the automatically created user, make a new user request (matching the admin username provided before)
* Since you are using the `gomngr_auth=fake`, you can directly login using this username with any password.

/!\ By default, all cron scripts (ldap operations, etc) are added in the /tmp folder. You will have to launch them manually, or add a cron script to do it for you

You can access sent mail content by viewing the logs of the mailhog container.

