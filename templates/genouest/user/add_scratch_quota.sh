echo "Start add_scratch_quota.sh in $0 ..."

curl -Lk 'https://admin.powerscale-admin.genouest.org:8080/platform/15/quota/quotas' \
--header "Content-Type: application/json" \
--request POST \
-u '{{ CONFIG.custom_users.quota.user }}:{{ CONFIG.custom_users.quota.password }}' \
--data \
'
{
    "enforced": true,
    "path": "/ifs/genouest/irisa/AZ-scratch/scratch/{{ user.uid }}",
    "type": "directory",
    "include_snapshots": false,
    "thresholds_on": "applogicalsize",
    "container": true,
    "thresholds": {
        "hard": 268435456000
    }
}
'

echo "End add_scratch_quota.sh in $0 ..."
