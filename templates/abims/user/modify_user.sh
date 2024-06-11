#!/bin/bash

echo "Start modify_user.sh in $0 ..."

set -e

ldapmodify -h {{ CONFIG.ldap.host }} -cx -w '{{ CONFIG.ldap.admin_password }}' -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ user.uid }}.{{ fid }}.ldif"

{% if user.password %}
mel add-samba "{{ user.uid }}" --password "{{ user.password }}"
{% endif %}

echo "End modify_user.sh in $0 ..."
