# todo find a clean way to use user and group

{% for item in CONFIG.general.user_extra_dirs %}
if [ ! -e "{{ item | replace("#USER#", user.uid) | replace ("#GROUP#", user.group) }}" ]
then
    mkdir -p "{{ item | replace("#USER#", user.uid)| replace ("#GROUP#", user.group) }}"
    chown -R {{ user.uidnumber }}:{{ user.gidnumber }} "{{ item | replace("#USER#", user.uid)| replace ("#GROUP#", user.group) }}"
fi;

{% endfor %}
