FROM node:22-alpine

WORKDIR /app
COPY package.json .
RUN npm install && npm install -g supergateway

COPY server.mjs .

ENV XDG_DATA_HOME=/data

VOLUME ["/data"]
EXPOSE 3200

CMD ["supergateway", "--stdio", "node /app/server.mjs", "--port", "3200", "--outputTransport", "streamableHttp"]
