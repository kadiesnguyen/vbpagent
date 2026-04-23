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

# Wrap stdio MCP server as streamableHttp on port 3100.
# streamableHttp (stateless) spawns a fresh child process per session, supporting
# multiple concurrent connections from multi-tenant pool. SSE mode only supports
# one connection and crashes when a second client connects.
#
# The trap below gives in-flight tool calls time to complete before the process
# exits. Without it, a SIGTERM during a Docs/Drive operation drops the response
# (bot sees no ID, reports Drive error even though the file was created).
CMD ["/bin/sh", "-c", "supergateway --stdio google-workspace-mcp --port 3100 --outputTransport streamableHttp & PID=$!; trap 'sleep 10; kill $PID' TERM; wait $PID"]
