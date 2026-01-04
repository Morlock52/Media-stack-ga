#!/usr/bin/env bash
# run-host.sh - run control-server (API) + docs-site (UI) on the host (no Docker).
# Requirements: npm install (already done), Node 20+.
# Usage:
#   ./scripts/run-host.sh
#   PORT=4001 ./scripts/run-host.sh              # change API port
#   VITE_CONTROL_SERVER_URL=http://... ./scripts/run-host.sh   # custom API URL for the UI

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3001}"
CONTROL_SERVER_HOST="${CONTROL_SERVER_HOST:-127.0.0.1}"
VITE_URL_DEFAULT="http://${CONTROL_SERVER_HOST}:${PORT}"
VITE_CONTROL_SERVER_URL="${VITE_CONTROL_SERVER_URL:-$VITE_URL_DEFAULT}"

echo "============================================================"
echo " Media Stack (host-only) — API + UI"
echo "------------------------------------------------------------"
echo " API:  PORT=${PORT} (CONTROL_SERVER_HOST=${CONTROL_SERVER_HOST})"
echo " UI:   VITE_CONTROL_SERVER_URL=${VITE_CONTROL_SERVER_URL}"
echo "============================================================"
echo
echo "Running with two processes (API + UI). Press Ctrl+C to stop."
echo

cd "$ROOT_DIR"

npx concurrently \
  --names "api,ui" \
  --prefix-colors "cyan,magenta" \
  "PORT=${PORT} CONTROL_SERVER_HOST=${CONTROL_SERVER_HOST} npm run dev -w control-server" \
  "VITE_CONTROL_SERVER_URL=${VITE_CONTROL_SERVER_URL} npm run dev -w docs-site"
