#!/bin/bash

if [ -e /root/.env ]; then
    . /root/.env
fi

MYDIR=""
if [ -z $GOMNGRSCRIPTDIR ]; then
    MYDIR=$1
else
    MYDIR=$GOMNGRSCRIPTDIR
fi

if [ "a$MYDIR" == "a" ]; then
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
  echo "gomngr locked"
  exit 1
fi

touch /tmp/gomngr.lock

ls $MYDIR/*.update | sort -n -t . -k 2 > /tmp/gomngr.list

while read p; do
  $p &> $p.log
  EXITCODE=$?
  echo "Exit code: $EXITCODE" >> $p.log
  filename=$(basename $p)
  if [ $EXITCODE -ne 0 ]; then
    echo "Got an error" >> $p.log
    if [ "a$SENTRY_DSN" != "a" ]; then
      echo "Send sentry event" >> $p.log
      /usr/local/bin/sentry-cli send-event -m "$p execution failure" --logfile $p.log
    else
      echo "no sentry, skip..." >> $p.log
    fi
  fi
  curl -m 10 -v "$MYURL/log/status/$filename/$EXITCODE"
  mv $p $p.done
done </tmp/gomngr.list

rm /tmp/gomngr.lock
