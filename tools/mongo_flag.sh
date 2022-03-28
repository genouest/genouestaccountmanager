#!/bin/bash
# This script allow to add or remove a flag for a user

LOGIN=$1
# is_internal|is_fake|never_expire
FLAG=$2
# true|false
BOOL=$3

mongo gomngr --quiet --eval 'db.users.find({"uid" : "'${LOGIN}'"}).forEach(
    function (elm) {
      db.users.update (
             { _id: elm._id },
             { $set: {'$FLAG': '${BOOL}' }}
      );
    }
  )'
