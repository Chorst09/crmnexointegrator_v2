#!/usr/bin/env bash
# NEXOS CRM - Script de Deploy Automático
# Detecta mudanças, commita, faz push e deploy na VPS via SSH
# Uso: ./auto-deploy.sh "mensagem do commit (opcional)"

set -Eeuo pipefail

# Configurações
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-209.50.241.25}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_REPO="/opt/nexos-icp-github"
CONTAINER_NAME="nexos-icp"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; }

# Verificar se estamos no repositório Git
cd "$REPO_DIR"
if [[ ! -d .git ]]; then
  error "Não está em um repositório Git válido"
  exit 1
fi

# Verificar se há mudanças
if [[ -z $(git status --porcelain) ]]; then
  info "Nenhuma mudança detectada no repositório"
  echo "Deseja fazer deploy mesmo assim? (y/n)"
  read -r response
  [[ $response != "y" ]] && exit 0
  SKIP_COMMIT=true
else
  SKIP_COMMIT=false
  info "Mudanças detectadas:"
  git status --short
  echo ""
fi

# Obter mensagem de commit
if [[ $SKIP_COMMIT == false ]]; then
  COMMIT_MSG="${1:-Atualização automática $(date +'%Y-%m-%d %H:%M:%S')}"
  
  echo "Mensagem do commit:"
  echo "  $COMMIT_MSG"
  echo ""
  echo "Continuar com commit e deploy? (y/n)"
  read -r confirm
  [[ $confirm != "y" ]] && { warn "Deploy cancelado"; exit 0; }
fi

# Função de rollback remoto
rollback_remote() {
  warn "Executando rollback..."
  ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" bash <<'REMOTE_ROLLBACK'
    if [[ -f /opt/nexos-icp-config/previous-container ]]; then
      prev=$(cat /opt/nexos-icp-config/previous-container)
      docker stop nexos-icp 2>/dev/null || true
      docker rm nexos-icp 2>/dev/null || true
      docker rename "$prev" nexos-icp 2>/dev/null || true
      docker start nexos-icp 2>/dev/null || true
      echo "Rollback concluído"
    else
      echo "Nenhum container anterior disponível para rollback"
    fi
REMOTE_ROLLBACK
}

# Trap para rollback em caso de erro
trap 'error "Deploy falhou! Executando rollback..."; rollback_remote; exit 1' ERR

# Passo 1: Commit e Push (se houver mudanças)
if [[ $SKIP_COMMIT == false ]]; then
  info "Adicionando arquivos ao Git..."
  git add .
  
  info "Commitando mudanças..."
  git commit -m "$COMMIT_MSG"
  
  info "Fazendo push para GitHub..."
  git push origin main
  
  CURRENT_COMMIT=$(git rev-parse HEAD)
  info "Commit: ${CURRENT_COMMIT:0:12}"
else
  CURRENT_COMMIT=$(git rev-parse HEAD)
  info "Usando commit atual: ${CURRENT_COMMIT:0:12}"
fi

# Passo 2: Deploy Remoto
info "Conectando à VPS..."

ssh -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" bash <<REMOTE_DEPLOY
set -Eeuo pipefail

echo "→ Atualizando repositório..."
cd $REMOTE_REPO
git fetch origin main
git reset --hard origin/main

COMMIT=\$(git rev-parse HEAD)
echo "→ Commit: \${COMMIT:0:12}"

echo "→ Buildando imagem Docker..."
RELEASE="\$(date -u +%Y%m%dT%H%M%SZ)-\${COMMIT:0:12}-\$RANDOM"
IMAGE_TAG="nexos-icp:\$RELEASE"

docker build --target runtime -f Dockerfile.icp -t "\$IMAGE_TAG" . > /tmp/build.log 2>&1 || {
  echo "✗ Build falhou. Logs:"
  tail -50 /tmp/build.log
  exit 1
}

echo "→ Parando container atual..."
OLD_CONTAINER=\$(docker ps -q -f name=$CONTAINER_NAME)
if [[ -n "\$OLD_CONTAINER" ]]; then
  docker rename $CONTAINER_NAME nexos-icp-previous-\$RELEASE
  docker stop nexos-icp-previous-\$RELEASE
  echo "nexos-icp-previous-\$RELEASE" > /opt/nexos-icp-config/previous-container
fi

echo "→ Iniciando novo container..."
docker run -d \\
  --name $CONTAINER_NAME \\
  --label com.integrator.app=nexos-icp \\
  --restart unless-stopped \\
  --network icontainer-network \\
  --env-file /opt/nexos-icp-config/app.env \\
  -e NODE_ENV=production \\
  -p 127.0.0.1:3015:3000 \\
  --mount type=volume,src=nexos-icp-uploads,dst=/app/apps/api/uploads \\
  --mount type=volume,src=nexos-icp-attachments,dst=/app/apps/attachments/editais \\
  "\$IMAGE_TAG" > /dev/null

echo "→ Aguardando health check..."
for i in {1..60}; do
  HEALTH=\$(docker inspect -f '{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "starting")
  if [[ "\$HEALTH" == "healthy" ]]; then
    echo "✓ Container healthy"
    break
  fi
  [[ \$i -eq 60 ]] && { echo "✗ Health check timeout"; exit 1; }
  sleep 2
done

echo "→ Testando endpoint..."
curl -sf http://127.0.0.1:3015/api/health > /dev/null || {
  echo "✗ Health endpoint falhou"
  exit 1
}

echo "→ Limpando container anterior..."
if [[ -f /opt/nexos-icp-config/previous-container ]]; then
  OLD=\$(cat /opt/nexos-icp-config/previous-container)
  docker rm "\$OLD" 2>/dev/null || true
fi

echo "\$RELEASE" > /opt/nexos-icp-config/current-release

echo "✓ Deploy concluído: \$RELEASE"
REMOTE_DEPLOY

# Passo 3: Verificar deploy via HTTPS
info "Verificando endpoint HTTPS..."
sleep 3
if curl -sf https://nexos.chorstconsult.com.br/api/health > /dev/null; then
  info "Deploy concluído com sucesso!"
  info "URL: https://nexos.chorstconsult.com.br"
else
  warn "Endpoint HTTPS não respondeu (pode ser problema de cache/DNS)"
  info "Verifique manualmente: https://nexos.chorstconsult.com.br"
fi

# Limpar trap de erro
trap - ERR

# Resumo
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Deploy Automático Concluído"
echo "  Commit: ${CURRENT_COMMIT:0:12}"
echo "  URL: https://nexos.chorstconsult.com.br"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
