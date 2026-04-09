FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
ENV XDG_DATA_HOME=/data
VOLUME ["/data"]
EXPOSE 9878
CMD ["node", "server.mjs"]
