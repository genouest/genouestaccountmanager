#!/bin/bash

set -xe

/usr/local/bin/num create-user --firstname="{{ user.firstname }}" --lastname="{{ user.lastname }}" --email="{{ user.email }}" --username="{{ user.uid }}" {% if user.home %}--home_dir="{{ user.home }}"{% endif %} {% if user.password %}--password="{{ user.password }}"{% endif %}

# warning: disable ldap as it should have been done by num, but we don't know what is the dn created yet

#ldapadd -h {{ CONFIG.ldap.host }} -cx -w {{ CONFIG.ldap.admin_password }} -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/{{ user.uid }}.{{ fid }}.ldif"

if [ -e "{{ CONFIG.general.script_dir }}/group_{{ user.group }}_{{ user.uid }}.{{ fid }}.ldif" ]
then
    ldapmodify -h {{ CONFIG.ldap.host }} -cx -w {{ CONFIG.ldap.admin_password }} -D {{ CONFIG.ldap.admin_cn }},{{ CONFIG.ldap.admin_dn }} -f "{{ CONFIG.general.script_dir }}/group_{{ user.group }}_{{ user.uid }}.{{ fid }}.ldif"
fi

{% if user.send_copy_to_support %}
mel create-user-aliases "{{ user.uid }}"
mel create-mailbox "{{ user.uid }}"
{% endif %}

{% include "user/add_readme.sh" %}

mkdir -p "{{ user.home }}/.ssh"
touch "{{ user.home }}/.ssh/authorized_keys"
echo 'Host *' > "{{ user.home }}/.ssh/config"
echo '  StrictHostKeyChecking no' >> "{{ user.home }}/.ssh/config"
echo '  UserKnownHostsFile=/dev/null' >> "{{ user.home }}/.ssh/config"
chown -R {{ user.uid }}:{{ user.uid }} "{{ user.home }}"

{% include "user/add_extra_dirs.sh" %}



# add_user.sh
