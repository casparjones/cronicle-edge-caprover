FROM ghcr.io/cronicle-edge/cronicle-edge:v1.11.2

RUN apk add --no-cache procps curl docker-cli docker fuse-overlayfs jq

# non root user for shell plugin
ARG CRONICLE_UID=1000
ARG CRONICLE_GID=1099

ENV PATH "/opt/cronicle/bin:${PATH}"
ENV CRONICLE_foreground=1
ENV CRONICLE_echo=1
ENV CRONICLE_CLUSTER_MODE=0

ENV TZ=Europe/Berlin
ENV HOSTNAME=main
ENV HOSTNAME=main

RUN mkdir /opt/cronicle/caprover

COPY caprover/caprover-plugin.js /opt/cronicle/caprover/caprover-plugin.js
COPY caprover/caprover-plugin.json /opt/cronicle/caprover/caprover-plugin.json
COPY caprover/add-plugin.sh /opt/cronicle/caprover/add-plugin.sh
RUN chmod +x /opt/cronicle/caprover/caprover-plugin.js
RUN chmod +x /opt/cronicle/caprover/add-plugin.sh

WORKDIR /opt/cronicle
COPY docker-entrypoint.js /opt/cronicle/bin/docker-entrypoint.js

# Set permissions for sensitive folders
RUN mkdir -p /opt/cronicle/data /opt/cronicle/conf && chmod 0700 /opt/cronicle/data /opt/cronicle/conf

# Make the entrypoint script executable
RUN chmod +x /opt/cronicle/bin/docker-entrypoint.js
RUN cat /opt/cronicle/bin/manager

ENTRYPOINT ["/opt/cronicle/bin/docker-entrypoint.js"]
# ENTRYPOINT ["/sbin/tini", "--", "manager"]

