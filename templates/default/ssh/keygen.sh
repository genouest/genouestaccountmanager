#!/bin/bash

echo "Start keygen.sh in $0 ..."

set -e

sshDir="{{ user.home }}/.ssh"
rm -f $sshDir/id_rsa*
touch $sshDir/authorized_keys
chmod 644 $sshDir/authorized_keys

{% if user.email %}
ssh-keygen -t rsa -b 4096 -C "{{ user.email }}" -f $sshDir/id_rsa -N ""
{% else %}
ssh-keygen -t rsa -b 4096 -f $sshDir/id_rsa -N ""
{% endif %}

puttygen $sshDir/id_rsa -o $sshDir/id_rsa.ppk
cat $sshDir/id_rsa.pub >> $sshDir/authorized_keys
chown -R {{ user.uidnumber }}:{{ user.gidnumber }} $sshDir
chmod 600 $sshDir/id_rsa
chmod 600 $sshDir/id_rsa.pub
chmod 700 $sshDir

echo "End keygen.sh in $0 ..."
