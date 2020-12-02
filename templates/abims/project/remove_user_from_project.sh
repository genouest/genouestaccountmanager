#!/bin/bash

set -xe

/usr/local/bin/num remove-user-from-project {{ user.uid }} {{ project.id }}

# add_user_to_project.sh
