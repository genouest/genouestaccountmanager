#!/bin/bash

# Env variables
# GOMNGRSCRIPTDIR: [mandatory] directory to search for .update files
# GOMNGRURL: [optional] my-app url to send script execution status
# SENTRY_DSN: [optional] sentry url for script error execution reports
# GOMNGRARCHIVEDIR : [optional] directory where .done and .log should be moved after 10 days

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
    MYDIR="/opt/my/scripts"
    echo "No GOMNGRSCRIPTDIR given, using default $MYDIR"
else
    MYDIR=$GOMNGRSCRIPTDIR
fi

if [ "a$MYDIR" == "a" ]; then
   echo "Missing script directory parameter"
   exit 1
fi

MYURL=""
if [ -z $GOMNGRURL ]; then
    echo "Missing GOMNGRURL url (http://x.y.z) env variable"
else
    MYURL=$GOMNGRURL
fi

echo "$(date) Execute cron tasks"

if [ -e /tmp/gomngr.lock ]; then
  echo "gomngr locked"
  exit 1
fi

TOMORROW=`date --date="1 day 05:00:00" +%s`
NEXTMONTH=`date --date="$(date +'%Y-%m-01') + 1 month 05:00:00" +%s`

while true; do

  if [ -e $MYDIR/gomngr.exit ]; then
    echo "Found $MYDIR/gomngr.exit, exiting on user request"
    exit 1
  fi

  NBFILES=0
  NOW=`date +%s`

  echo "[date=$(date)] check pending tasks"

  if [ -e /tmp/gomngr.lock ]; then
    echo "gomngr locked"
    sleep 30
    continue
  fi

  touch /tmp/gomngr.lock

  ERRCODE=0

  ls $MYDIR/*.update | sort -n -t . -k 2 > /tmp/gomngr.list
  while read p; do
    ((NBFILES++))
    $p &> $p.log
    EXITCODE=$?
    echo "Exit code: $EXITCODE" >> $p.log
    filename=$(basename $p)
    if [ $EXITCODE -ne 0 ]; then
      ERRCODE=$EXITCODE
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
        curl -m 10 --connect-timeout 2 "$MYURL/log/status/$filename/$EXITCODE"
    fi
    mv $p $p.done
    if [ $EXIT_REQUEST -eq 1 ]; then
      rm /tmp/gomngr.lock
      rm /tmp/gomngr.list
      echo "Exit requested"
      exit 0
    fi
  done </tmp/gomngr.list
  echo "${NBFILES} tasks handled"

  if [ $NOW -gt $NEXTMONTH ]; then
    echo "${NOW}: time for monthly tasks"
    NEXTMONTH=`date --date="$(date +'%Y-%m-01') + 1 month 05:00:00" +%s`
    #echo "Check for account upcoming expiration"
    #/opt/crontask.sh test_expiration
    #if [ $EXIT_REQUEST -eq 1 ]; then
    #  rm /tmp/gomngr.lock
    #  rm /tmp/gomngr.list
    #  echo "Exit requested"
    #  exit 0
    #fi
    echo "Check for account expiration"
    /opt/crontask.sh expire
    if [ $EXIT_REQUEST -eq 1 ]; then
      rm /tmp/gomngr.lock
      rm /tmp/gomngr.list
      echo "Exit requested"
      exit 0
    fi
  fi
  if [ $NOW -gt $TOMORROW ]; then
    echo "${NOW}: time for daily tasks"
    TOMORROW=`date --date="1 day 05:00:00" +%s`

    echo "Check for reservation removal"
    /opt/crontask.sh reservation_remove
    if [ $EXIT_REQUEST -eq 1 ]; then
      rm /tmp/gomngr.lock
      rm /tmp/gomngr.list
      echo "Exit requested"
      exit 0
    fi
    echo "Check for reservation creation"
    /opt/crontask.sh reservation_create
    if [ $EXIT_REQUEST -eq 1 ]; then
      rm /tmp/gomngr.lock
      rm /tmp/gomngr.list
      echo "Exit requested"
      exit 0
    fi
    echo "Check for account upcoming expiration"
    /opt/crontask.sh test_expiration
    if [ $EXIT_REQUEST -eq 1 ]; then
        rm /tmp/gomngr.lock
        rm /tmp/gomngr.list
        echo "Exit requested"
        exit 0
    fi
    echo "Check for project upcoming expiration"
    /opt/crontask.sh test_projects
    if [ $EXIT_REQUEST -eq 1 ]; then
        rm /tmp/gomngr.lock
        rm /tmp/gomngr.list
        echo "Exit requested"
        exit 0
    fi
  fi

  ARCHIVE="${GOMNGRARCHIVEDIR:-/opt/my/archive}"
  echo "Archive old script to $ARCHIVE"

  if [ -e $ARCHIVE ]; then
    find "${MYDIR}" -type f -mtime +10 -exec mv {} "${ARCHIVE}" \;
  else
    echo "Archive dir $ARCHIVE not found, skipping"
  fi

  rm /tmp/gomngr.lock

  if [ "a$RUNONCE" != "a" ]; then
    # For tests, run only once on demand
    exit $ERRCODE
  fi

  if [ $NBFILES -eq 0 ]; then
    # nothing to do, sleep
    sleep 60
  fi

done
