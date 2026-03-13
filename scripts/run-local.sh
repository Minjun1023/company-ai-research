#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.local-run"
mkdir -p "$RUN_DIR"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ROOT_DIR/.env"
  set +a
fi

: "${POSTGRES_PORT:=5433}"
: "${POSTGRES_DB:=company_research}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:=postgres}"
: "${BACKEND_PORT:=8080}"
: "${AI_SERVICE_PORT:=8000}"
: "${SPRING_DATASOURCE_USERNAME:=$POSTGRES_USER}"
: "${SPRING_DATASOURCE_PASSWORD:=$POSTGRES_PASSWORD}"
: "${SPRING_DATASOURCE_DB:=$POSTGRES_DB}"

: "${SPRING_DATASOURCE_URL:=jdbc:postgresql://localhost:${POSTGRES_PORT}/${SPRING_DATASOURCE_DB}"

# Local backend runs on host, so DB host must be localhost.
export SPRING_DATASOURCE_URL
export SPRING_DATASOURCE_USERNAME
export SPRING_DATASOURCE_PASSWORD
export AI_SERVICE_PORT

# Start only database container from compose.
echo "[local] Starting postgres container..."
docker compose up -d --no-recreate postgres

# Run backend and ai-service locally
echo "[local] Starting backend..."
(
  cd "$ROOT_DIR/backend"
  if [[ -x "./gradlew" ]]; then
    ./gradlew bootRun --no-daemon --args="--server.port=$BACKEND_PORT"
  elif command -v gradle >/dev/null 2>&1; then
    gradle bootRun --no-daemon --args="--server.port=$BACKEND_PORT"
  else
    echo "gradlew 또는 gradle 명령을 찾을 수 없습니다. Gradle 설치/설정 후 다시 실행하세요."
    exit 1
  fi
) >"$RUN_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "[local] Starting ai-service..."
(
  cd "$ROOT_DIR/ai-service"
  uvicorn app.main:app --host 0.0.0.0 --port "$AI_SERVICE_PORT"
) >"$RUN_DIR/ai-service.log" 2>&1 &
AI_PID=$!

printf "%s\n" "$BACKEND_PID" > "$RUN_DIR/backend.pid"
printf "%s\n" "$AI_PID" > "$RUN_DIR/ai-service.pid"

echo "[local] Started."
echo "  postgres  : localhost:$POSTGRES_PORT"
echo "  backend   : http://localhost:$BACKEND_PORT"
echo "  ai-service: http://localhost:$AI_SERVICE_PORT"
echo "  logs:"
echo "    backend   : $RUN_DIR/backend.log"
echo "    ai-service: $RUN_DIR/ai-service.log"
echo "  stop: ./scripts/stop-local.sh"
