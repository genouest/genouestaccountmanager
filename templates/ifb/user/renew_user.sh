#!/bin/bash

set -xe

ldapmodify -h {{ CONFIG.ldap.host }} -cx -w {{ CONFIG.ldap.admin_password }} -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ user.uid }}.{{ fid }}.ldif"

if [ -e "{{ user.home }}/.ssh/authorized_keys.expired" ]; then
    mv  "{{ user.home }}/.ssh/authorized_keys.expired" "{{ user.home }}/.ssh/authorized_keys"
fi
# renew_user.sh
