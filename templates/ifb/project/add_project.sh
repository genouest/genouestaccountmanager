#!/bin/bash

set -xe

/usr/local/bin/num create-project {{ project.id }}

#TODO: find if it is a good idea to do this here
/usr/local/bin/num add-group-to-project --project={{ project.id }} --group={{ project.group }}

# add_project.sh
