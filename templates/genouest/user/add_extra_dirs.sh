echo "Start add_extra_dirs.sh in $0 ..."

{% for item in CONFIG.general.user_extra_dirs %}

extra_dir="{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.group) }}"

if [ ! -e "$extra_dir" ]
then
    mkdir -p "$extra_dir"
    chmod 700 $extra_dir
    chown -R {{ user.uidnumber }}:{{ user.gidnumber }} "$extra_dir"
fi

{% endfor %}

echo "End add_extra_dirs.sh in $0 ..."
