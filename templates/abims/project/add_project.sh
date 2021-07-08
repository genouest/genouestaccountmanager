#!/bin/bash

set -xe

/usr/local/bin/num create-project {{ project.id }}

# Disable because it's not the same command to create a quota and modify/apply it
# @TODO add template in num to allow modifying quota
#/usr/local/bin/num set-quota -sq {{ project.size }}GB {{ project.path }}

# add_project.sh
