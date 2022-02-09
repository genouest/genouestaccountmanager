#!/bin/bash

echo "Start update_project.sh in $0 ..."

set -e

/usr/local/bin/num set-quota -sq {{ project.size }}G {{ project.path }}

echo "End update_project.sh in $0 ..."
