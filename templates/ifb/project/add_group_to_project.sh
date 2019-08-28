#!/bin/bash

set -xe

# todo: add a call to this template in my code, or not
/usr/local/bin/num add-group-to-project --project={{ project.id }} --group={{ group.name }}

# add_group_to_project.sh
