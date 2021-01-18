echo "Start move_extra_dirs.sh in $0 ..."

{% for item in CONFIG.general.user_extra_dirs %}

# remove last / to secure mv
old_extra_dir=$(echo "{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.oldgroup) }}" | sed -e s:/$::g)
extra_dir=$(echo "{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.group) }}" | sed -e s:/$::g)

if [ "$old_extra_dir" != "$extra_dir" ]
then
    mkdir -p $(dirname "$extra_dir")
    if [ -e "$old_extra_dir" ]
    then
        mv "$old_extra_dir" "$extra_dir"
    else
        mkdir -p "$extra_dir"
    fi
    chown -R {{ user.uid }}:{{ user.uid }} "$extra_dir"
fi

{% endfor %}

echo "End move_extra_dirs.sh in $0 ..."
