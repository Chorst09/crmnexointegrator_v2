#!/bin/bash

################################################################################
# NEXOS CRM - Deploy Script para ICP
# Uso: ./scripts/deploy-icp.sh [--force]
#
# Funcionalidade:
# 1. Valida repositório Git (remote, branch, estado limpo)
# 2. Faz pull da versão mais recente (--ff-only)
# 3. Valida arquivo de configuração (.env.icp ou /opt/nexoscrm-config/app.env)
# 4. Constrói imagem Docker
# 5. Testa container temporário
# 6. Substitui container de produção
# 7. Valida health check e HTTPS
# 8. Preserva versão anterior (rollback automático em falha)
################################################################################

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CRM_NAME="nexoscrm"
CRM_CONTAINER="nexoscrm-api"
CRM_IMAGE="nexoscrm:latest"
REGISTRY_IMAGE="registry.local/${CRM_IMAGE}"
ENV_FILE="/opt/nexoscrm-config/app.env"
LOCK_FILE="/tmp/deploy-${CRM_NAME}.lock"
GITHUB_USER="Chorst09"
GITHUB_REPO="crmnexointegrator_v2"
GITHUB_BRANCH="main"
DOMAIN="nexos.chorstconsult.com.br"
HEALTH_ENDPOINT="/health"
TIMEOUT_HEALTH=60

# Funções
log_info() {
  echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
  echo -e "${GREEN}✓${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
  echo -e "${RED}✗${NC} $*"
}

die() {
  log_error "$*"
  exit 1
}

# Função para fazer rollback
rollback() {
  log_warn "Iniciando rollback..."
  
  if docker ps -a --format '{{.Names}}' | grep -q "${CRM_CONTAINER}-prev"; then
    log_info "Parando container atual..."
    docker stop "${CRM_CONTAINER}" 2>/dev/null || true
    docker rm "${CRM_CONTAINER}" 2>/dev/null || true
    
    log_info "Restaurando container anterior..."
    docker rename "${CRM_CONTAINER}-prev" "${CRM_CONTAINER}"
    docker start "${CRM_CONTAINER}"
    
    log_success "Rollback concluído"
  else
    log_error "Nenhuma versão anterior encontrada para rollback"
    exit 1
  fi
}

# Trap para cleanup e rollback em erro
cleanup() {
  if [ -f "${LOCK_FILE}" ]; then
    rm -f "${LOCK_FILE}"
  fi
  # Remover container de teste se ainda existir
  docker rm -f "${CRM_CONTAINER}-test" 2>/dev/null || true
}

trap cleanup EXIT
trap 'rollback; cleanup' ERR

# ============================================================================
# INÍCIO DO SCRIPT
# ============================================================================

log_info "NEXOS CRM - Deploy Script para ICP"
log_info "Repository: ${GITHUB_USER}/${GITHUB_REPO} (branch: ${GITHUB_BRANCH})"
log_info "Domain: ${DOMAIN}"

# Verificar se já há deploy em progresso
if [ -f "${LOCK_FILE}" ]; then
  die "Deploy já em progresso. Se isso for incorreto, remova: ${LOCK_FILE}"
fi
touch "${LOCK_FILE}"

# ============================================================================
# 1. VALIDAR REPOSITÓRIO GIT
# ============================================================================

log_info "Validando repositório Git..."

cd "${REPO_ROOT}" || die "Não consegui acessar diretório do repositório"

# Verificar se é repositório git
if [ ! -d ".git" ]; then
  die "Não é um repositório Git"
fi

# Verificar remote
REMOTE_URL=$(git config --get remote.origin.url)
log_info "Remote: ${REMOTE_URL}"

if ! [[ "${REMOTE_URL}" == *"${GITHUB_USER}/${GITHUB_REPO}"* ]]; then
  die "Remote inválido. Esperado: ${GITHUB_USER}/${GITHUB_REPO}"
fi

# Verificar branch atual
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "${CURRENT_BRANCH}" != "${GITHUB_BRANCH}" ]; then
  log_warn "Branch atual é '${CURRENT_BRANCH}', esperado '${GITHUB_BRANCH}'"
  log_info "Alterando para branch ${GITHUB_BRANCH}..."
  git checkout "${GITHUB_BRANCH}"
fi

# Verificar se há mudanças locais não commitadas
if [ -n "$(git status --porcelain)" ]; then
  die "Há mudanças locais não commitadas. Faça commit antes de deploy"
fi

log_success "Repositório válido"

# ============================================================================
# 2. PULL DA VERSÃO MAIS RECENTE
# ============================================================================

log_info "Atualizando repositório..."

# Validar SSH key para GitHub (sem interatividade)
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 git@github.com >/dev/null 2>&1; then
  log_warn "Conectividade SSH com GitHub pode ter problemas"
fi

# Pull com --ff-only (evita merge commits)
git pull --ff-only origin "${GITHUB_BRANCH}" || die "Falha ao fazer pull. Verifique se há conflitos."

log_success "Repositório atualizado"

# ============================================================================
# 3. VALIDAR CONFIGURAÇÃO
# ============================================================================

log_info "Validando configuração..."

if [ ! -f "${ENV_FILE}" ]; then
  die "Arquivo de configuração não encontrado: ${ENV_FILE}\n\
Crie-o baseado em .env.icp.example:\n\
  sudo cp .env.icp.example ${ENV_FILE}\n\
  sudo chown 1000:1000 ${ENV_FILE}\n\
  sudo chmod 600 ${ENV_FILE}"
fi

# Validar permissões do arquivo .env
ENV_PERMS=$(stat -f '%OLp' "${ENV_FILE}" 2>/dev/null || stat -c '%a' "${ENV_FILE}")
if [ "${ENV_PERMS}" != "-rw-------" ] && [ "${ENV_PERMS}" != "600" ]; then
  log_warn "Permissões do arquivo ${ENV_FILE} não são 600 (encontradas: ${ENV_PERMS})"
  log_info "Corrigindo permissões..."
  sudo chmod 600 "${ENV_FILE}" || log_warn "Não consegui corrigir permissões"
fi

# Validar variáveis obrigatórias (sem imprimir valores)
REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "NODE_ENV" "PORT")
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=" "${ENV_FILE}"; then
    die "Variável obrigatória não encontrada: ${var}"
  fi
done

log_success "Configuração validada"

# ============================================================================
# 4. CONSTRUIR IMAGEM DOCKER
# ============================================================================

log_info "Construindo imagem Docker..."

COMMIT_SHA=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
IMAGE_TAG="${CRM_IMAGE}-${COMMIT_SHA}"

docker build \
  --tag "${CRM_IMAGE}" \
  --tag "${IMAGE_TAG}" \
  --build-arg BUILD_DATE="${BUILD_DATE}" \
  --build-arg VCS_REF="${COMMIT_SHA}" \
  --build-arg VERSION="1.0.0" \
  -f Dockerfile \
  . || die "Falha ao construir imagem Docker"

log_success "Imagem construída: ${CRM_IMAGE}"

# ============================================================================
# 5. TESTAR CONTAINER TEMPORÁRIO
# ============================================================================

log_info "Testando container temporário..."

# Parar container de teste anterior se existir
docker rm -f "${CRM_CONTAINER}-test" 2>/dev/null || true

# Iniciar container de teste (sem porta pública)
docker run -d \
  --name "${CRM_CONTAINER}-test" \
  --env-file "${ENV_FILE}" \
  --network icontainer-network \
  "${CRM_IMAGE}" || die "Falha ao iniciar container de teste"

log_info "Aguardando health check (máx ${TIMEOUT_HEALTH}s)..."

# Aguardar health check
START_TIME=$(date +%s)
while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  
  if [ ${ELAPSED} -gt ${TIMEOUT_HEALTH} ]; then
    docker logs "${CRM_CONTAINER}-test" | tail -20
    docker rm -f "${CRM_CONTAINER}-test"
    die "Health check não respondeu em ${TIMEOUT_HEALTH}s"
  fi
  
  if docker exec "${CRM_CONTAINER}-test" wget -qO- http://localhost:3026${HEALTH_ENDPOINT} >/dev/null 2>&1; then
    log_success "Health check passou"
    break
  fi
  
  sleep 2
done

# Validar logs de teste (buscar erros críticos)
if docker logs "${CRM_CONTAINER}-test" 2>&1 | grep -iE "(fatal|error|panic|crash)" | head -3; then
  log_warn "Possíveis erros detectados nos logs"
fi

log_success "Container de teste validado"

# ============================================================================
# 6. SUBSTITUIR CONTAINER DE PRODUÇÃO
# ============================================================================

log_info "Substituindo container de produção..."

# Backup do container atual (para rollback)
if docker ps -a --format '{{.Names}}' | grep -q "^${CRM_CONTAINER}$"; then
  log_info "Preservando versão anterior..."
  docker stop "${CRM_CONTAINER}" || true
  docker rename "${CRM_CONTAINER}" "${CRM_CONTAINER}-prev" || true
fi

# Promover container de teste para produção
docker rename "${CRM_CONTAINER}-test" "${CRM_CONTAINER}"

# Iniciar com volume para uploads e rede shared com Nginx
docker update --restart unless-stopped "${CRM_CONTAINER}" || true

# Conectar à rede do Nginx (se necessário)
docker network connect icontainer-network "${CRM_CONTAINER}" 2>/dev/null || true

log_success "Container substituído"

# ============================================================================
# 7. VALIDAR HEALTH CHECK E HTTPS
# ============================================================================

log_info "Validando health check em produção..."

START_TIME=$(date +%s)
while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  
  if [ ${ELAPSED} -gt 30 ]; then
    log_error "Health check não respondeu"
    rollback
    die "Deploy falhou"
  fi
  
  # Testar health check via localhost
  if curl -sf http://127.0.0.1:3026${HEALTH_ENDPOINT} >/dev/null 2>&1; then
    log_success "Health check OK"
    break
  fi
  
  sleep 2
done

log_info "Validando HTTPS do domínio ${DOMAIN}..."

# Testar HTTPS (aguarda proxy estar configurado)
sleep 5

if curl -sf https://${DOMAIN}${HEALTH_ENDPOINT} >/dev/null 2>&1; then
  log_success "HTTPS funcional"
else
  log_warn "HTTPS não respondeu ainda. Verifique proxy e SSL no ICP"
fi

# ============================================================================
# 8. CLEANUP
# ============================================================================

log_info "Limpando versões anteriores..."

# Remover container anterior após sucesso
docker rm -f "${CRM_CONTAINER}-prev" 2>/dev/null || true

# Remover imagens antigas (manter últimas 3)
docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${CRM_IMAGE}" | tail -n +4 | while read img; do
  log_info "Removendo imagem antiga: $img"
  docker rmi "$img" 2>/dev/null || true
done

log_success "Cleanup concluído"

# ============================================================================
# SUCESSO
# ============================================================================

log_success "Deploy concluído com sucesso!"
log_info "🎉 NEXOS CRM atualizado em: https://${DOMAIN}"
log_info "Versão: ${COMMIT_SHA}"
log_info "Data: ${BUILD_DATE}"

# Remover lock
rm -f "${LOCK_FILE}"

exit 0
