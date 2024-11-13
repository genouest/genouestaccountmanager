FROM quay.io/genouest/node:16.13-buster

RUN npm install -g @angular/cli@10.2.0

WORKDIR /usr/src/app/manager2

COPY . .
RUN npm ci
RUN export NODE_OPTIONS=--openssl-legacy-provider
RUN export gomngr_auth=fake

EXPOSE 4200

CMD ["ng", "build", "--base-href", "/manager2/", "--source-map", "--watch"]