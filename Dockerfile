FROM node

RUN apt-get update && apt-get install -y ldap-utils vim openssh-client putty-tools
COPY tests/gomngr.sh /opt/gomngr.sh

RUN mkdir -p /root/genouestaccountmanager
WORKDIR /root/genouestaccountmanager


COPY *.js *.json .bowerrc /root/genouestaccountmanager/
RUN npm install

RUN mkdir plugins public routes views tests test manager config
COPY config/test.json /root/genouestaccountmanager/config
COPY plugins /root/genouestaccountmanager/plugins
COPY public /root/genouestaccountmanager/public
COPY routes /root/genouestaccountmanager/routes
COPY views /root/genouestaccountmanager/views
COPY tests /root/genouestaccountmanager/tests
COPY test /root/genouestaccountmanager/test
COPY manager /root/genouestaccountmanager/manager

RUN npm install -g bower
RUN bower install --allow-root
RUN mkdir -p /opt/my/readmes/readmes1
RUN mkdir -p /opt/my/readmes/readmes2
RUN mkdir -p /opt/my/scripts
RUN mkdir -p /opt/my/plugin-scripts

ENTRYPOINT node app.js
