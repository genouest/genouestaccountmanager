echo "Start remove_scratch_quota.sh in $0 ..."

curl -Lk 'https://admin.powerscale-admin.genouest.org:8080/platform/15/quota/quotas' \
--header "Content-Type: application/json" \
--request DELETE \
-u '{{ CONFIG.custom_users.quota.user }}:{{ CONFIG.custom_users.quota.password }}' \
--data \
'
{
    "path": "/ifs/genouest/irisa/AZ-scratch/scratch/{{ user.uid }}"
}
'

echo "End remove_scratch_quota.sh in $0 ..."
