echo "Start delete_extra_dirs.sh in $0 ..."

{% for item in CONFIG.general.user_extra_dirs %}

extra_dir="{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.group) }}"

if [ -d "$extra_dir" ]
then
    rm -rf "$extra_dir"
fi

{% endfor %}

echo "End delete_extra_dirs.sh in $0 ..."
