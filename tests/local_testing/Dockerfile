FROM docker:dind

RUN apk add --no-cache \
    nodejs \
    npm \
    sudo \
    bash \
    docker-compose

# Create the folder used by the runner to store installed tools
RUN mkdir /opt/hostedtoolcache

CMD ["/bin/bash"]
