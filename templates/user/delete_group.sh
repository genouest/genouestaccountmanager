#!/bin/bash

set -e

ldapdelete -h {{ CONFIG.ldap.host }} -cx -w {{ CONFIG.ldap.admin_password }} -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ group.name }}.{{ fid }}.ldif"
# delete_group.sh
