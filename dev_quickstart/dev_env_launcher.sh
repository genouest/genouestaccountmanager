#!/bin/bash

# Set to 'v' to only see env starting progress.
# Set to 'vv' to see dev env starting progress and commands errors.
# Set to 'vvv' to see dev env starting progress and all commands outputs for debugging.
verbose="${1:-v}"

# Dev env parameters that can be changed
export gomngr_auth=fake
export NODE_OPTIONS="--openssl-legacy-provider --no-experimental-fetch"
export PORT=3000
export MY_ADMIN_USER=admin
export MY_ADMIN_GROUP=admin
export MY_ADMIN_EMAIL=admin@my.org
export MY_ADMIN_PASSWORD=admin

# ldap files are created inside the /tmp folder but are not launched by my.
# In order to create the change on the ldap, we need to use a watcher that launch 
# ldap files as they are created inside the /tmp folder.
ldap_watcher() {
    if [ "$verbose" = "vvv" ]; then
        echo "Starting .update file ldap watcher on /tmp..."
        inotifywait -m -e create --include '.*\.update$' --format '%w%f' /tmp | while read filepath; do
            echo ">>> Detected update: $filepath"
            bash "$filepath"
            echo ">>> Finished execution: $filepath"
        done
    elif [ "$verbose" = "vv" ]; then
        inotifywait -m -e create --include '.*\.update$' --format '%w%f' /tmp >/dev/null | while read filepath; do
            bash "$filepath" >/dev/null
        done
    else
    inotifywait -m -e create --include '.*\.update$' --format '%w%f' /tmp >/dev/null 2>&1| while read filepath; do
            bash "$filepath" >/dev/null 2>&1
        done
    fi
}

# Works on Fedora only (because it's the distro of the lab)
# Add new logic or change rpm command to match your distro if necessary
check_distro_packages_installation() {
    local package
    local missing_packages=()
    
    for package in "$@"; do
        if ! rpm -q "$package" &> /dev/null; then
            missing_packages+=("$package")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        echo "All required distro packages are installed !"
    else
        echo "The following distro packages are not installed:"
        printf " - %s\n" "${missing_packages[@]}"
        echo "Please install them to use this script."
        exit 1
    fi
}

check_npm_packages_installation_with_ci() {
    local directory=$1
    if sudo npm ci --prefix "$directory" --dry-run &> /dev/null; then 
        echo "All required npm packages are installed on the $directory directory !"; 
    else
        echo "Some npm packages are not installed inside the $directory directory."
        echo "Please install them using npm ci to use this script."
        exit 1
    fi
}

check_distro_packages_installation "inotify-tools" "docker-cli" "containerd" "docker-compose" "openldap" "nodejs22"
check_npm_packages_installation_with_ci "../"
check_npm_packages_installation_with_ci "../manager2"

if [ -f ../config/default.json ]; then
    echo "Config file exists !"
else
    echo "Creating config file from config/default.json.template..."
    cp ../config/default.json.template ../config/default.json
    echo "Config file created !"
fi

trap 'echo "Stopping all dev services..."; kill $(jobs -p) 2>/dev/null; cd ../dev_quickstart; sudo docker compose stop >/dev/null 2>&1; wait; echo "All dev services have stopped!"' EXIT

echo "Starting ldap watcher service..."
ldap_watcher &
sleep 0.5
if ps -p $! > /dev/null; then
    echo "LDAP watcher service is running !"
else
    echo "LDAP watcher service failed to start."
    exit 1
fi

echo "Starting docker..."
if [ "$verbose" = "vvv" ]; then
    sudo docker compose up -d
elif [ "$verbose" = "vv" ]; then
    sudo docker compose up -d --no-log-prefix 2>&1 | grep -i "error\|failed\|exception"
else
    sudo docker compose up -d >/dev/null 2>&1
fi
echo "Docker started !"

# With new version of ldap-utils, the -h option doesn't exist anymore. If the new version
# is installed in your system (as it should be if you use default install of the package),
# we have to modify the templates files in templates/default/user/.
# Beware, this line will directly modify the files in templates/default/user/.
if ldapadd --help 2>&1 | grep -qE "\-H"; then 
    find ../templates/default/user -type f -exec sed -i 's|-h {{ CONFIG\.ldap\.host }}|-H ldap://{{ CONFIG.ldap.host }}|g' {} + 2>/dev/null
    find ../templates/genouest/user -type f -exec sed -i 's|-h {{ CONFIG\.ldap\.host }}|-H ldap://{{ CONFIG.ldap.host }}|g' {} + 2>/dev/null
else
    # In case the system don't have the new version of ldap-utils, we modify the file to go
    # back to -h option. Normally this is not necessary because the templates already have
    # the -h option by default. But these lines ensure that the script works even if 
    # the templates are modified the other way around in a later date.
    find ../templates/default/user -type f -exec sed -i 's|-H ldap://{{ CONFIG.ldap.host }}|-h {{ CONFIG.ldap.host }}|g' {} + 2>/dev/null
    find ../templates/genouest/user -type f -exec sed -i 's|-H ldap://{{ CONFIG.ldap.host }}|-h {{ CONFIG.ldap.host }}|g' {} + 2>/dev/null
fi
echo "LDAP templates adjusted to work with your ldapadd version !"

cd ..
echo "Starting Node app..."
if [ "$verbose" = "vvv" ]; then
    node --watch app.js &
elif [ "$verbose" = "vv" ]; then
    node --watch app.js >/dev/null &
else
    node --watch app.js >/dev/null 2>&1 &
fi
max_attempts=60
attempt=0
while ! ss -tlnp | grep -q "$PORT "; do
    sleep 1
    if [ $attempt -eq $max_attempts ]; then
        echo "Node app failed to start on port $PORT."
        exit 1
    fi
    ((attempt++))
done
echo "Node app started !"

cd manager2
echo "Starting Angular build ..."
# Perform a first build, without using --watch to see if the build works
if [ "$verbose" = "vvv" ]; then
    ng build --base-href ../manager2/ --source-map
elif [ "$verbose" = "vv" ]; then
    ng build --base-href ../manager2/ --source-map --no-progress 2>&1 | grep -i "error\|failed"
else
    ng build --base-href ../manager2/ --source-map --no-progress >/dev/null 2>&1
fi
# If first build succeeded, we rebuild using --watch so all the changes are taken
# into account as they happen on the files.
if [ $? -eq 0 ]; then
    echo "The angular build is working ! Relaunching a build using --watch."
    echo "Wait a few seconds and open your browser on localhost:$PORT !"
    if [ "$verbose" = "vvv" ]; then
        ng build --base-href /manager2/ --source-map --watch
    elif [ "$verbose" = "vv" ]; then
        ng build --base-href /manager2/ --source-map --watch --no-progress >/dev/null
    else
        ng build --base-href /manager2/ --source-map --watch --no-progress >/dev/null 2>&1
    fi
else
    echo "Angular build failed."
    exit 1
fi