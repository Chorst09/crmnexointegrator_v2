#!/bin/bash

################################################################################
# NEXOS CRM - Create Master User
# Uso: ./scripts/create-master-user.sh [email] [password]
#
# Funcionalidade:
# 1. Conecta ao banco de dados
# 2. Cria usuário MASTER na tabela User
# 3. Hash seguro da senha (bcrypt)
# 4. Valida criação
#
# Exemplo:
#   ./scripts/create-master-user.sh chorstconsult@gmail.com Admin@2026
################################################################################

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }
die() { log_error "$*"; exit 1; }

# ============================================================================
# VALIDAR PARÂMETROS
# ============================================================================

if [ $# -lt 2 ]; then
  log_error "Uso: $0 <email> <senha>"
  echo "  Exemplo: $0 chorstconsult@gmail.com Admin@2026"
  exit 1
fi

MASTER_EMAIL="$1"
MASTER_PASSWORD="$2"

# Validar email
if ! [[ "${MASTER_EMAIL}" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  die "Email inválido: ${MASTER_EMAIL}"
fi

# Validar senha (mínimo 8 caracteres)
if [ ${#MASTER_PASSWORD} -lt 8 ]; then
  die "Senha muito curta (mínimo 8 caracteres)"
fi

log_info "Email: ${MASTER_EMAIL}"
log_info "Senha será hashada com bcrypt"

# ============================================================================
# CARREGAR VARIÁVEIS DE AMBIENTE
# ============================================================================

ENV_FILE="/opt/nexoscrm-config/app.env"
if [ ! -f "${ENV_FILE}" ]; then
  ENV_FILE=".env"
  if [ ! -f "${ENV_FILE}" ]; then
    die "Arquivo de configuração não encontrado: /opt/nexoscrm-config/app.env ou .env"
  fi
fi

# Carregar DATABASE_URL
set +u
source "${ENV_FILE}" 2>/dev/null || die "Falha ao carregar variáveis de ambiente"
set -u

if [ -z "${DATABASE_URL:-}" ]; then
  die "DATABASE_URL não definida em ${ENV_FILE}"
fi

log_info "Banco de dados: ${DATABASE_URL%\?*}"

# ============================================================================
# HASH DA SENHA (bcrypt)
# ============================================================================

log_info "Hashando senha com bcrypt..."

# Usar Node.js + bcryptjs para gerar hash seguro
HASHED_PASSWORD=$(node -e "
const bcrypt = require('bcryptjs');
const password = process.argv[1];
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log(hash);
" "${MASTER_PASSWORD}" 2>/dev/null || echo "")

if [ -z "${HASHED_PASSWORD}" ]; then
  die "Falha ao gerar hash. Certifique-se que bcryptjs está instalado (npm install bcryptjs)"
fi

log_success "Senha hashada"

# ============================================================================
# INSERIR USUÁRIO NO BANCO
# ============================================================================

log_info "Criando usuário MASTER no banco..."

# Gerar UUID para o usuário
USER_ID=$(node -e "console.log(require('crypto').randomUUID())" 2>/dev/null || uuidgen)

CREATED_AT=$(date -u +'%Y-%m-%d %H:%M:%S')

# Usar Prisma CLI para inserir (se disponível) ou psql raw
if command -v npx &> /dev/null; then
  log_info "Usando Prisma para inserir usuário..."
  
  npx ts-node --eval "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    (async () => {
      try {
        const user = await prisma.user.upsert({
          where: { email: '${MASTER_EMAIL}' },
          update: {
            password: '${HASHED_PASSWORD}',
            role: 'MASTER',
            name: 'Admin',
          },
          create: {
            id: '${USER_ID}',
            email: '${MASTER_EMAIL}',
            password: '${HASHED_PASSWORD}',
            role: 'MASTER',
            name: 'Admin',
          },
        });
        console.log('✓ User created/updated:', user.id, user.email);
        process.exit(0);
      } catch (error) {
        console.error('✗ Error:', error.message);
        process.exit(1);
      }
    })();
  " 2>/dev/null || {
    log_warn "Prisma não disponível localmente. Usando SQL direto..."
    
    # Fallback para SQL direto
    psql "${DATABASE_URL}" << EOF
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
VALUES ('${USER_ID}', '${MASTER_EMAIL}', 'Admin', '${HASHED_PASSWORD}', 'MASTER', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  role = 'MASTER'
WHERE "User".email = '${MASTER_EMAIL}';
EOF
  }
else
  die "ts-node não encontrado. Instale com: npm install -g ts-node"
fi

log_success "Usuário MASTER criado com sucesso"

# ============================================================================
# VALIDAR CRIAÇÃO
# ============================================================================

log_info "Validando usuário..."

USER_EXISTS=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"User\" WHERE email = '${MASTER_EMAIL}' AND role = 'MASTER';" 2>/dev/null || echo "0")

if [ "${USER_EXISTS}" = "1" ]; then
  log_success "Usuário MASTER confirmado no banco"
else
  die "Falha ao validar usuário"
fi

# ============================================================================
# SUCESSO
# ============================================================================

log_success "Setup de conta MASTER concluído!"
log_info ""
log_info "Credenciais de login:"
log_info "  Email: ${MASTER_EMAIL}"
log_info "  Senha: ••••••••• (a que você forneceu)"
log_info ""
log_info "Você pode fazer login em: https://nexos.chorstconsult.com.br"

exit 0
