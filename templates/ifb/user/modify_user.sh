#!/bin/bash

echo "Start modify_user.sh in $0 ..."

set -e

ldapmodify -h {{ CONFIG.ldap.host }} -cx -w '{{ CONFIG.ldap.admin_password }}' -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ user.uid }}.{{ fid }}.ldif"

{% if user.oldhome %}

# remove last / to secure mv
oh=$(echo "{{ user.oldhome }}" | sed -e s:/$::g)
nh=$(echo "{{ user.home }}" | sed -e s:/$::g)

if [ "$oh" != "$nh" ]
then
    mkdir -p $(dirname "$nh")
    mv "$oh" "$nh"
    chown -R {{ user.uid }}:{{ user.uid }} "$nh"
fi

{% include "user/move_extra_dirs.sh" %}

{% endif %}

echo "End modify_user.sh in $0 ..."
