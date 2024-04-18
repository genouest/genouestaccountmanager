This is a basic setup to deploy genouestaccountmanager for development.
Genouestaccountmanager is fairly modular, so it will not fit a deployment for production. This is for basic usage.

# Setup

* Edit ldap-data/01_orgs.ldif to fit your needs (not required)
* `docker compose up -d`
* Edit defaut.json as needed
* Copy it in genouestaccountmanager/config/
* phpldapadmin will be available on port 80 if needed.

## Requirements

* Install node > 18.0 (using nvm, or by hand)
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
ng build --base-href /manager2/ --source-map --watch
```

You may wish to use this command instead for development (The process will keep running, and monitor any changes in the front-end code)

```
ng build --base-href /manager2/ --source-map --watch
```

From there, you can lauch the server with the following command:

```
# From the genouestaccountmanager folder
node app.js
```
