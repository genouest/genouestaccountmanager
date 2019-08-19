#!/bin/bash

set -e

/usr/local/bin/num add-user-to-project --notify {{ user.uid }} {{ project.id }}
# add_user_to_project.sh
