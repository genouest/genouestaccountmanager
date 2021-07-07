#!/bin/bash

set -xe

/usr/local/bin/num create-project {{ project.id }}

/usr/local/bin/num set-quota -sq {{ project.size }}GB {{ project.path }}

# add_project.sh
