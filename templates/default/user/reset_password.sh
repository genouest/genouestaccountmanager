#!/bin/bash

echo "Start reset_password.sh in $0 ..."

set -e

ldapmodify -h {{ CONFIG.ldap.host }} -cx -w '{{ CONFIG.ldap.admin_password }}' -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ user.uid }}.{{ fid }}.ldif"

echo "End reset_password.sh in $0 ..."
