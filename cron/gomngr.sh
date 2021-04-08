#!/bin/bash

EXIT_REQUEST=0

function catch_sig()
{
  echo "Received signal, exiting as soon as possible"
  EXIT_REQUEST=1
}

trap catch_sig SIGINT SIGTERM


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

MYURL=""
if [ "a$2" == "a" ]; then
   echo "Missing gomngr url (http://x.y.z) parameter"
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
    touch $p.err
    if [ "a$SENTRY_DSN" != "a" ]; then
      echo "Send sentry event" >> $p.log
      /usr/local/bin/sentry-cli send-event -m "$p execution failure" --logfile $p.log
    else
      echo "no sentry, skip..." >> $p.log
    fi
  fi
  if [ "a$MYURL" == "a" ]; then
      echo "no my url available, skip status update call"
  else
      echo "send status code to $MYURL/log/status/$filename/$EXITCODE" >> $p.log
      curl -m 10 --connect-timeout 2 -v "$MYURL/log/status/$filename/$EXITCODE"
  fi
  mv $p $p.done
  if [ $EXIT_REQUEST -eq 1 ]; then
    rm /tmp/gomngr.lock
    rm /tmp/gomngr.list
    echo "Exit requested"
    exit 0
  fi
done </tmp/gomngr.list

ARCHIVE="${GOMNGRARCHIVEDIR:-/opt/my/archive}"
if [ -e $ARCHIVE ]; then
  find "${MYDIR}" -type f -mtime +10 -exec mv {} "${ARCHIVE}" \;
fi

rm /tmp/gomngr.lock
