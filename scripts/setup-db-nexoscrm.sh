#!/bin/bash

################################################################################
# NEXOS CRM - Setup Banco de Dados PostgreSQL
# Uso: ./scripts/setup-db-nexoscrm.sh
#
# Funcionalidade:
# 1. Cria banco de dados exclusivo para NEXOS
# 2. Cria usuário exclusivo com permissões limitadas
# 3. Valida conexão
# 4. Prepara schema (sem migrations automáticas)
################################################################################

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
DB_HOST="${DB_HOST:-postgresql_17}"
DB_PORT="${DB_PORT:-5432}"
ADMIN_USER="Chorst"  # Usuário administrativo do PostgreSQL (case-sensitive)
DB_NAME="nexoscrm"
DB_USER="nexoscrm"

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }
die() { log_error "$*"; exit 1; }

# ============================================================================
# 1. VERIFICAR CONECTIVIDADE
# ============================================================================

log_info "Verificando conectividade com PostgreSQL..."

# Tentar conexão como admin
if ! PGPASSWORD="" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  log_warn "Conectividade com PostgreSQL em ${DB_HOST}:${DB_PORT} como '${ADMIN_USER}' falhou"
  log_info "Você será solicitado pela senha do usuário '${ADMIN_USER}'"
  
  # Solicitar senha
  read -rsp "Senha do PostgreSQL para usuário '${ADMIN_USER}': " ADMIN_PASS
  echo
  
  if ! PGPASSWORD="${ADMIN_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
    die "Falha ao conectar ao PostgreSQL com credenciais fornecidas"
  fi
else
  log_warn "Senha em branco funcionou (socket local ou trust authentication)"
  ADMIN_PASS=""
fi

log_success "Conectividade validada"

# ============================================================================
# 2. VERIFICAR BANCOS EXISTENTES
# ============================================================================

log_info "Verificando bancos existentes..."

EXISTING_DBS=$(PGPASSWORD="${ADMIN_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres -t -c "SELECT datname FROM pg_database WHERE datname = '${DB_NAME}';" 2>/dev/null || true)

if [ -n "${EXISTING_DBS}" ]; then
  log_warn "Banco '${DB_NAME}' já existe"
  read -p "Deseja usar o banco existente? (s/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    die "Abortado pelo usuário"
  fi
  SKIP_CREATE_DB=true
else
  SKIP_CREATE_DB=false
fi

# ============================================================================
# 3. CRIAR BANCO (se necessário)
# ============================================================================

if [ "${SKIP_CREATE_DB}" != "true" ]; then
  log_info "Criando banco de dados '${DB_NAME}'..."
  
  PGPASSWORD="${ADMIN_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres << EOF
CREATE DATABASE "${DB_NAME}"
  OWNER "${ADMIN_USER}"
  ENCODING 'UTF8'
  LOCALE 'C'
  TEMPLATE template0;
EOF
  
  log_success "Banco '${DB_NAME}' criado"
else
  log_info "Usando banco existente '${DB_NAME}'"
fi

# ============================================================================
# 4. CRIAR USUÁRIO EXCLUSIVO (se necessário)
# ============================================================================

log_info "Verificando usuário '${DB_USER}'..."

EXISTING_USER=$(PGPASSWORD="${ADMIN_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres -t -c "SELECT usename FROM pg_user WHERE usename = '${DB_USER}';" 2>/dev/null || true)

if [ -n "${EXISTING_USER}" ]; then
  log_warn "Usuário '${DB_USER}' já existe"
  SKIP_CREATE_USER=true
else
  log_info "Criando usuário exclusivo '${DB_USER}'..."
  
  # Gerar senha aleatória para o usuário (não será armazenada aqui)
  DB_PASS=$(openssl rand -base64 32 | tr -d '=' | cut -c1-25)
  
  PGPASSWORD="${ADMIN_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres << EOF
CREATE USER "${DB_USER}" WITH PASSWORD '${DB_PASS}';
EOF
  
  log_success "Usuário '${DB_USER}' criado"
  log_warn "Senha do usuário: ${DB_PASS}"
  log_info "⚠️  COPIE E GUARDE ESTA SENHA. Ela será usada em DATABASE_URL"
  
  SKIP_CREATE_USER=false
fi

# ============================================================================
# 5. CONFIGURAR PERMISSÕES
# ============================================================================

log_info "Configurando permissões..."

PGPASSWORD="${ADMIN_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d "${DB_NAME}" << EOF
-- Revogar privilégios desnecessários
REVOKE ALL ON DATABASE "${DB_NAME}" FROM public;

-- Conceder privilégios ao usuário NEXOS
GRANT CONNECT ON DATABASE "${DB_NAME}" TO "${DB_USER}";
GRANT USAGE ON SCHEMA public TO "${DB_USER}";
GRANT CREATE ON SCHEMA public TO "${DB_USER}";

-- Permitir ao usuário criar tabelas e gerenciá-las
ALTER SCHEMA public OWNER TO "${DB_USER}";

-- Definir privilégios padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${DB_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${DB_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO "${DB_USER}";
EOF

log_success "Permissões configuradas"

# ============================================================================
# 6. VALIDAR CONEXÃO COM USUÁRIO NOVO
# ============================================================================

log_info "Validando conexão com usuário '${DB_USER}'..."

if [ "${SKIP_CREATE_USER}" != "true" ]; then
  if ! PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" >/dev/null 2>&1; then
    die "Falha ao conectar com novo usuário"
  fi
  
  log_success "Conexão validada com '${DB_USER}'"
  
  # Exibir CONNECTION STRING
  echo
  log_info "CONNECTION STRING para DATABASE_URL:"
  echo -e "${YELLOW}postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public${NC}"
  echo
else
  log_info "Usando conexão com usuário existente"
fi

# ============================================================================
# 7. SUCESSO
# ============================================================================

log_success "Setup do banco de dados concluído!"
log_info "Próximos passos:"
log_info "  1. Atualize /opt/nexoscrm-config/app.env com DATABASE_URL"
log_info "  2. Execute: ./scripts/deploy-icp.sh"

exit 0
