echo "Start remove_scratch_quota.sh in $0 ..."

curl -Lk '{{ CONFIG.custom_users.quota.url }}' \
--header "Content-Type: application/json" \
--request DELETE \
-u '{{ CONFIG.custom_users.quota.user }}:{{ CONFIG.custom_users.quota.password }}' \
-G \
--data  'type=directory&path={{ CONFIG.custom_users.quota.base_path }}/{{ user.uid }}'

echo "End remove_scratch_quota.sh in $0 ..."
