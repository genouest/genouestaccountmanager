FROM node:jod-trixie
RUN npm install -g @angular/cli@22.1.6
ARG APIURL
ARG SENTRY
ARG UITHEME=cerulean

COPY manager2 /root/genouestaccountmanager/manager2
RUN cd /root/genouestaccountmanager/manager2/src/assets/css && cp ${UITHEME}.min.css theme.css
RUN cd /root/genouestaccountmanager/manager2/src/environments && sed -i 's;apiUrl: "";apiUrl: "'"$SAPIURL"'";' environment.prod.ts
RUN cd /root/genouestaccountmanager/manager2/src/environments && sed -i 's;sentry: "";sentry: "'"$SENTRY"'";' environment.prod.ts
RUN cd /root/genouestaccountmanager/manager2 && npm ci && ng build --base-href /manager2/ --configuration production --source-map && rm -rf src && rm -rf node_modules && rm -f dist/my-ui/browser/*.gz && npm run compress

FROM node:jod-trixie
RUN apt-get update && apt-get install -y ldap-utils vim openssh-client putty-tools libldap2-dev uuid-dev
COPY cron/gomngr.sh /opt/gomngr.sh
RUN mkdir -p /root/genouestaccountmanager
WORKDIR /root/genouestaccountmanager


COPY *.json /root/genouestaccountmanager/
RUN npm ci
COPY *.js /root/genouestaccountmanager/

RUN mkdir plugins public routes views tests test manager manager2 config bin
COPY config/test.json /root/genouestaccountmanager/config
COPY plugins /root/genouestaccountmanager/plugins
COPY public /root/genouestaccountmanager/public
COPY routes /root/genouestaccountmanager/routes
COPY core /root/genouestaccountmanager/core
COPY templates /root/genouestaccountmanager/templates
COPY tests /root/genouestaccountmanager/tests
COPY test /root/genouestaccountmanager/test
COPY cron /root/genouestaccountmanager/cron
COPY bin /root/genouestaccountmanager/bin

RUN mkdir -p /opt/my/readmes/readmes1
RUN mkdir -p /opt/my/readmes/readmes2
RUN mkdir -p /opt/my/scripts
RUN mkdir -p /opt/my/plugin-scripts

COPY --from=0 /root/genouestaccountmanager/manager2 /root/genouestaccountmanager/manager2

ENTRYPOINT ["node", "app.js"]
