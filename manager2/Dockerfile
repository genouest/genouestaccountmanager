FROM quay.io/genouest/node:16.13-buster

WORKDIR /usr/src/app

RUN npm install -g @angular/cli@10.2.0

COPY . .
RUN npm ci

EXPOSE 4200

CMD ["ng", "serve", "--host", "0.0.0.0", "--base-href", "/manager2/", "--source-map", "--watch"]