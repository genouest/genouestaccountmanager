#!/bin/bash

set -xe

/usr/local/bin/num create-user --firstname='{{ user.firstname }}' --lastname='{{ user.lastname }}' --email='{{ user.email }}' --username='{{ user.uid }}' {% if user.home %}--home_dir='{{ user.home }}'{% endif %} {% if user.password %}--password='{{ user.password }}'{% endif %} {% if user.is_fake %}--service{% endif %}

{% include "user/add_readme.sh" %}

mkdir -p '{{ user.home }}/.ssh'
touch '{{ user.home }}/.ssh/authorized_keys'
echo 'Host *' > '{{ user.home }}/.ssh/config'
echo '  StrictHostKeyChecking no' >> '{{ user.home }}/.ssh/config'
echo '  UserKnownHostsFile=/dev/null' >> '{{ user.home }}/.ssh/config'
chown -R {{ user.uid }}:{{ user.uid }} '{{ user.home }}'

{% include "user/add_extra_dirs.sh" %}

# add_user.sh
