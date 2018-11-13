#!/bin/bash

if [ "a$1" == "a" ]; then
 echo "Missing script directory parameter"
 exit 1
fi

MYURL="http://localhost:3000"
if [ "a$2" == "a" ]; then
 if [ -z $GOMNGRURL ]; then
   echo "Missing gomngr url (http://x.y.z) parameter"
   exit 1
 else
   MYURL=$GOMNGRURL
 fi
else
  MYURL=$2
fi

echo "$(date) Execute cron tasks"

if [ -e /tmp/gomngr.lock ]; then
  exit 1
fi

touch /tmp/gomngr.lock

ls $1/*.update | sort -n -t . -k 2 > /tmp/gomngr.list

while read p; do
  $p &> $p.log
  EXITCODE=$?
  filename=$(basename $p)
  curl -v "$MYURL/log/status/$filename/$EXITCODE"
  mv $p $p.done
done </tmp/gomngr.list

rm /tmp/gomngr.lock
