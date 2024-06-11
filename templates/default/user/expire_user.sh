#!/bin/bash

echo "Start expire_user.sh in $0 ..."

set -e

ldapmodify -h {{ CONFIG.ldap.host }} -cx -w '{{ CONFIG.ldap.admin_password }}' -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ user.uid }}.{{ fid }}.ldif"

if [ -e "{{ user.home }}/.ssh/authorized_keys" ]; then
    mv  "{{ user.home }}/.ssh/authorized_keys" "{{ user.home }}/.ssh/authorized_keys.expired"
fi

echo "End expire_user.sh in $0 ..."
