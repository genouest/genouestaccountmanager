#!/bin/bash

set -xe

/usr/local/bin/num create-group "{{ group.name }}"

/usr/local/bin/num add-user-to-group "{{ group.owner_name }}" "{{ group.name }}"

# add_group.sh
