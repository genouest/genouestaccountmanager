echo "Start add_scratch_quota.sh in $0 ..."

curl -Lk '{{ CONFIG.custom_users.quota.url }}' \
--header "Content-Type: application/json" \
--request POST \
-u '{{ CONFIG.custom_users.quota.user }}:{{ CONFIG.custom_users.quota.password }}' \
--data \
'
{
    "enforced": true,
    "path": "{{ CONFIG.custom_users.quota.base_path }}/{{ user.uid }}",
    "type": "directory",
    "include_snapshots": false,
    "thresholds_on": "applogicalsize",
    "container": true,
    "thresholds": {
        "hard": {{ CONFIG.custom_users.quota.default_quota }}
    }
}
'

echo "End add_scratch_quota.sh in $0 ..."
