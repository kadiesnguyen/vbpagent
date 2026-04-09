#!/bin/bash
# VBPClaw startup script — includes all active overlays for this VPS.
# Usage: ./start.sh [up|down|logs|restart]

set -e
cd "$(dirname "$0")"

# Build args — Node.js required for JS-based skills (e.g. brave-api-search)
export ENABLE_NODE=true

COMPOSE="docker compose \
  -f docker-compose.yml \
  -f docker-compose.postgres.yml \
  -f docker-compose.google-workspace.yml \
  -f docker-compose.facebook.yml \
  -f docker-compose.telegram-bot-api.yml \
  -f docker-compose.vps-admin.yml \
  -f docker-compose.browser.yml"

CMD=${1:-up}

case "$CMD" in
  up)
    $COMPOSE up -d "${@:2}"
    ;;
  down)
    $COMPOSE down "${@:2}"
    ;;
  logs)
    $COMPOSE logs -f vbpclaw "${@:2}"
    ;;
  restart)
    $COMPOSE restart "${@:2}"
    ;;
  ps)
    $COMPOSE ps
    ;;
  *)
    $COMPOSE "$@"
    ;;
esac
