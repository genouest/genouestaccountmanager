#!/bin/bash

set -e

{% for group in group_add %}
/usr/local/bin/num add-user-to-group {{ user.uid }} {{ group }}
{% endfor %}


{% for group in group_remove %}
/usr/local/bin/num remove-user-from-group {{ user.uid }} {{ group }}
{% endfor %}


# change_group.sh
