FROM node:22-alpine

WORKDIR /app

# Install MCP server + supergateway (stdio → SSE bridge)
RUN npm install -g @aaronsb/google-workspace-mcp supergateway

# Patch manifest.yaml: add valueInputOption to manage_sheets updateValues.
# The Google Sheets API requires this query param but the manifest omits it,
# causing "valueInputOption is required but not specified" errors.
COPY patch-manifest.js /tmp/patch-manifest.js
RUN node /tmp/patch-manifest.js

# XDG dirs mapped to persistent volume
ENV XDG_CONFIG_HOME=/data/config
ENV XDG_DATA_HOME=/data/share

# Point to bundled gws binary
ENV GWS_BINARY_PATH=/usr/local/lib/node_modules/@aaronsb/google-workspace-mcp/node_modules/@googleworkspace/cli/bin

VOLUME ["/data"]

EXPOSE 3100

# Wrap stdio MCP server as SSE on port 3100
CMD ["supergateway", "--stdio", "google-workspace-mcp", "--port", "3100", "--outputTransport", "streamableHttp", "--stateful"]
