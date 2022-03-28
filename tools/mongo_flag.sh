#!/bin/bash
# This script allow to add or remove a flag for a user

LOGIN=$1
# is_internal|is_fake|never_expire
FLAG=$2
# true|false
BOOL=$3

mongo gomngr --quiet --eval 'db.users.findOneAndUpdate(
    {"uid" : "'${LOGIN}'"},
    { $set: {'$FLAG': '${BOOL}' } },
    { projection : { "_id" : 0, "uid" : 1, "'$FLAG'" : 1 } }
  )'
