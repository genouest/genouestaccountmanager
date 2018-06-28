#!/bin/bash

if [ "a$1" == "a" ]; then
 echo "Missing script directory parameter"
 exit 1
fi

if [ "a$2" == "a" ]; then
 echo "Missing gomngr url (http://x.y.z) parameter"
 exit 1
fi

if [ -e /tmp/gomngr.lock ]; then
  exit 1
fi

touch /tmp/gomngr.lock

ls $1/*.update | sort -n -t . -k 2 > /tmp/gomngr.list

while read p; do
  $p &> $p.log
  EXITCODE=$?
  filename=$(basename $p)
  curl -v "$2/log/status/$filename/$EXITCODE"
  mv $p $p.done
done </tmp/gomngr.list

rm /tmp/gomngr.lock
