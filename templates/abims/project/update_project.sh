#!/bin/bash

echo "Start update_project.sh in $0 ..."

set -e

num set-quota -sq {{ project.size }}GB {{ project.path }}

echo "End update_project.sh in $0 ..."
