#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="${1:-v3}"
APP_DIR="${APP_DIR:-/opt/nexoscrm}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/nexoscrm-backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${VERSION}-${TIMESTAMP}"
COMPOSE_FILE="${APP_DIR}/docker-compose.production.yml"
GIT_COMMIT="${GIT_COMMIT:-unknown}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "App dir nao encontrado: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose de producao nao encontrado: $COMPOSE_FILE" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"

{
  echo "version=$VERSION"
  echo "created_at=$(date --iso-8601=seconds)"
  echo "hostname=$(hostname)"
  echo "app_dir=$APP_DIR"
  echo "git_commit=$GIT_COMMIT"
} > "${BACKUP_DIR}/metadata.txt"

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' > "${BACKUP_DIR}/docker-ps.txt"

docker compose --project-directory "$APP_DIR" -f "$COMPOSE_FILE" config > "${BACKUP_DIR}/docker-compose.resolved.yml"

docker exec nexoscrm-postgres pg_dump -U nexoscrm -d nexoscrm | gzip -9 > "${BACKUP_DIR}/database.sql.gz"

app_name="$(basename "$APP_DIR")"
tar \
  --exclude="${app_name}/node_modules" \
  --exclude="${app_name}/backend/node_modules" \
  --exclude="${app_name}/apps/web/node_modules" \
  --exclude="${app_name}/.git" \
  --exclude="${app_name}/.codex-backups" \
  --exclude="${app_name}/*.zip" \
  --exclude="${app_name}/*.tar.gz" \
  -czf "${BACKUP_DIR}/app.tar.gz" \
  -C "$(dirname "$APP_DIR")" "$app_name"

if docker cp nexoscrm-backend:/app/uploads "${BACKUP_DIR}/uploads" >/dev/null 2>&1; then
  tar -czf "${BACKUP_DIR}/uploads.tar.gz" -C "$BACKUP_DIR" uploads
  rm -rf "${BACKUP_DIR}/uploads"
else
  echo "uploads_indisponivel=true" >> "${BACKUP_DIR}/metadata.txt"
fi

(
  cd "$BACKUP_DIR"
  for file in app.tar.gz database.sql.gz metadata.txt docker-ps.txt docker-compose.resolved.yml uploads.tar.gz; do
    [[ -f "$file" ]] && sha256sum "$file"
  done > SHA256SUMS
)

ln -sfn "$BACKUP_DIR" "${BACKUP_ROOT}/${VERSION}-latest"

echo "Backup criado: $BACKUP_DIR"
find "$BACKUP_DIR" -maxdepth 1 -type f -printf '%f %s bytes\n' | sort
