#!/bin/bash

set -e

if [ ! -e "{{ user.home }}/.ssh" ]; then
    mkdir -p "{{ user.home }}/.ssh"
    chmod -R 700 "{{ user.home }}/.ssh"
    touch "{{ user.home }}/.ssh/authorized_keys"
    chown -R {{ user.uid }}:{{ user.uid }} "{{ user.home }}/.ssh/"
fi

echo {{ user.ssh }} >> "{{ user.home }}/.ssh/authorized_keys"
# add_ssh_key.sh
