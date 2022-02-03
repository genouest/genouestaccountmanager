#!/bin/bash

set -xe

/usr/local/bin/num create-project {{ project.id }}

/usr/local/bin/num set-quota -sq {{ project.size }}G {{ project.path }}

# add_project.sh
