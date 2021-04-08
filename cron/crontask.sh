#!/bin/bash

EXE=$1
FID=`date +%s`

FILE="/opt/my/scripts/${EXE}.${FID}.update"

echo "#!/bin/bash" > $FILE
echo "export NODE_ENV=${NODE_ENV}" >> $FILE
echo "cd /root/genouestaccountmanager && /usr/local/bin/node /root/genouestaccountmanager/cron/${EXE}.js" >> $FILE
chmod +x $FILE