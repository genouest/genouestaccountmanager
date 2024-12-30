#!/bin/bash

# Define the database and collection
DB_NAME="gomngr"
COLLECTION="users"

# Default value for DAYS_TO_DELETE
DAYS_TO_DELETE=30

# Check if an argument is provided and override the default
if [ "$1" ]; then
  DAYS_TO_DELETE=$1
fi

EXPIRATION_THRESHOLD=$(($(date +%s%3N) - (DAYS_TO_DELETE * 24 * 60 * 60 * 1000)))

# Execute the MongoDB command to find and delete matching users
mongo "$DB_NAME" --quiet --eval "
db.$COLLECTION.find({ 
    status: 'Waiting for email approval', 
    registration: { \$lt: $EXPIRATION_THRESHOLD }
}).forEach(
    function(elm) {
        db.$COLLECTION.remove({ _id: elm._id });
        print('Deleted user with ID: ' + elm._id);
    }
);
"

echo "Cleanup script executed. Users in 'pending email approval' stage with 'registration' older than $DAYS_TO_DELETE days have been deleted."