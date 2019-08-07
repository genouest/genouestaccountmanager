# todo find a clean way to use user and group

{% for item in CONFIG.general.user_extra_dirs %}

extra_dir="{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.group) }}"

if [ ! -e "$extra_dir" ]
then
    mkdir -p "$extra_dir"
    chown -R {{ user.uidnumber }}:{{ user.gidnumber }} "$extra_dir"
fi

{% endfor %}
# add_extra_dirs.sh
