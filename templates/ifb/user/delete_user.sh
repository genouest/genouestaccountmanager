#!/bin/bash

set -xe

# todo: find a way to know if user.uid is the good for user matching
/usr/local/bin/num remove-user {{ user.uid }}

{% include "user/delete_extra_dirs.sh" %}
# delete_user.sh
