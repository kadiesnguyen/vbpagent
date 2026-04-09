FROM node:22-alpine

WORKDIR /app

COPY server.mjs .

ENV XDG_CONFIG_HOME=/data/config
ENV XDG_DATA_HOME=/data/share

VOLUME ["/data"]

EXPOSE 9876

CMD ["node", "server.mjs"]
