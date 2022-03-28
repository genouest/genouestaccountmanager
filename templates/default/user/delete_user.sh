#!/bin/bash

echo "Start delete_user.sh in $0 ..."

# Allowed to fail as it may already have been deleted
#set -e

ldapmodify -h {{ CONFIG.ldap.host }} -cx -w '{{ CONFIG.ldap.admin_password }}' -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ user.uid }}.{{ fid }}.ldif"

ldapdelete -h {{ CONFIG.ldap.host }} -cx -w '{{ CONFIG.ldap.admin_password }}' -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn  }} "uid={{ user.uid }},ou=people,{{ CONFIG.ldap.dn }}"

if [ -d "{{ user.home }}" ]
then
    rm -rf "{{ user.home }}"
fi

{% include "user/delete_extra_dirs.sh" %}
# delete_user.sh

echo "End delete_user.sh in $0 ..."
