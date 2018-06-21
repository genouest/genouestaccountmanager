FROM node

RUN apt-get update && apt-get install -y ldap-utils
RUN git clone -b tests https://github.com/genouest/genouestaccountmanager.git /root/genouestaccountmanager
WORKDIR /root/genouestaccountmanager

RUN npm install
RUN npm install -g bower
RUN bower install --allow-root
RUN mkdir -p /opt/my/readmes/readmes1
RUN mkdir -p /opt/my/readmes/readmes2
RUN mkdir -p /opt/my/scripts
RUN mkdir -p /opt/my/plugin-scripts

ENTRYPOINT node app.js
