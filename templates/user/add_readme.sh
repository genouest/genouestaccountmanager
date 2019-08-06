if [ ! -e {{ user.home }}/user_guides ]
then
    mkdir -p "{{ user.home }}/user_guides"

    {% for item in CONFIG.general.readme %}
    ln -s "{{ item.source_folder }}" "{{ user.home }}/user_guides/{{ item.language }}"
    {% endfor %}
fi
