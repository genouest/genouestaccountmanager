echo "Start move_extra_dirs.sh in $0 ..."

{% for item in CONFIG.general.user_extra_dirs %}

# remove last / to secure mv
old_extra_dir=$(echo "{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.oldgroup) }}" | sed -e s:/$::g)
extra_dir=$(echo "{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.group) }}" | sed -e s:/$::g)

if [ -e $old_extra_dir ]; then
    if [ "$old_extra_dir" != "$extra_dir" ]
    then
        mkdir -p $(dirname "$extra_dir")
        if [ -e "$old_extra_dir" ]
        then
            mv "$old_extra_dir" "$extra_dir"
        else
            mkdir -p "$extra_dir"
        fi
    fi

    {% if user.oldgidnumber %}
    old_gid_number="{{ user.oldgidnumber }}"
    gid_number="{{ user.gidnumber }}"
    if [ "$old_gid_number" != "$gid_number" ]
    then
        chown -R {{ user.uidnumber }}:{{ user.gidnumber }} "$extra_dir"
    fi
    {% endif %}
fi

{% endfor %}

echo "End move_extra_dirs.sh in $0 ..."
