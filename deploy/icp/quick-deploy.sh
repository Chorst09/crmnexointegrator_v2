#!/usr/bin/env bash
# NEXOS CRM - Deploy Rápido na VPS
# Execute este script DIRETAMENTE na VPS para atualizar o sistema
# Uso: bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh

set -Eeuo pipefail

REPO_DIR="/opt/nexos-icp-github"
CONTAINER_NAME="nexos-icp"
CONFIG_DIR="/opt/nexos-icp-config"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; }

cd "$REPO_DIR"

info "Verificando atualizações..."
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [[ "$LOCAL" == "$REMOTE" ]]; then
  warn "Já está na versão mais recente"
  echo "Forçar rebuild? (y/n)"
  read -r force
  [[ $force != "y" ]] && exit 0
fi

info "Atualizando código..."
git reset --hard origin/main

COMMIT=$(git rev-parse HEAD)
RELEASE="$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT:0:12}-$RANDOM"
IMAGE_TAG="nexos-icp:$RELEASE"

info "Buildando imagem: $IMAGE_TAG"
docker build --target runtime -f Dockerfile.icp -t "$IMAGE_TAG" . || {
  error "Build falhou"
  exit 1
}

info "Parando container atual..."
if docker ps -q -f name=$CONTAINER_NAME > /dev/null 2>&1; then
  docker rename $CONTAINER_NAME "nexos-icp-previous-$RELEASE" 2>/dev/null || true
  docker stop "nexos-icp-previous-$RELEASE" 2>/dev/null || true
  echo "nexos-icp-previous-$RELEASE" > "$CONFIG_DIR/previous-container"
fi

info "Iniciando novo container..."
docker run -d \
  --name $CONTAINER_NAME \
  --label com.integrator.app=nexos-icp \
  --restart unless-stopped \
  --network icontainer-network \
  --env-file "$CONFIG_DIR/app.env" \
  -e NODE_ENV=production \
  -p 127.0.0.1:3015:3000 \
  --mount type=volume,src=nexos-icp-uploads,dst=/app/apps/api/uploads \
  --mount type=volume,src=nexos-icp-attachments,dst=/app/apps/attachments/editais \
  "$IMAGE_TAG" || {
    error "Falha ao iniciar container"
    warn "Restaurando versão anterior..."
    if [[ -f "$CONFIG_DIR/previous-container" ]]; then
      prev=$(cat "$CONFIG_DIR/previous-container")
      docker rename "$prev" $CONTAINER_NAME 2>/dev/null || true
      docker start $CONTAINER_NAME 2>/dev/null || true
    fi
    exit 1
  }

info "Aguardando health check (60s)..."
for i in {1..60}; do
  HEALTH=$(docker inspect -f '{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "starting")
  if [[ "$HEALTH" == "healthy" ]]; then
    info "Container healthy"
    break
  fi
  [[ $i -eq 60 ]] && {
    error "Health check timeout"
    exit 1
  }
  sleep 1
done

info "Testando endpoint..."
curl -sf http://127.0.0.1:3015/api/health > /dev/null || {
  error "Health endpoint falhou"
  exit 1
}

info "Limpando versão anterior..."
if [[ -f "$CONFIG_DIR/previous-container" ]]; then
  prev=$(cat "$CONFIG_DIR/previous-container")
  docker rm "$prev" 2>/dev/null || true
fi

echo "$RELEASE" > "$CONFIG_DIR/current-release"

echo ""
info "Deploy concluído!"
info "Release: $RELEASE"
info "Commit: ${COMMIT:0:12}"
info "URL: https://nexos.chorstconsult.com.br"
