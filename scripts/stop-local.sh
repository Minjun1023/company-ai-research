#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.local-run"

if [[ -f "$RUN_DIR/backend.pid" ]]; then
  BACKEND_PID=$(cat "$RUN_DIR/backend.pid")
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID"
  fi
  rm -f "$RUN_DIR/backend.pid"
fi

if [[ -f "$RUN_DIR/ai-service.pid" ]]; then
  AI_PID=$(cat "$RUN_DIR/ai-service.pid")
  if kill -0 "$AI_PID" 2>/dev/null; then
    kill "$AI_PID"
  fi
  rm -f "$RUN_DIR/ai-service.pid"
fi

docker compose stop postgres

echo "[local] local services stopped"
