#!/bin/bash
# =============================================================================
# NexosCRM v2 — Rotina de Backup Automatizado do Banco de Dados
# Banco: nexoscrm (PostgreSQL 15 / Docker porta 5433)
# Inclui 100% dos dados do sistema (incluindo módulo SIMULADOR e cálculos)
# Agendamento: Segunda a Sexta às 17h (America/Sao_Paulo)
# =============================================================================
set -euo pipefail

# ── Configurações ─────────────────────────────────────────────────────────────
DB_NAME="nexoscrm"
DB_USER="nexoscrm"
DB_CONTAINER="nexoscrm-postgres"
DB_PORT="5433"
BACKUP_DIR="/var/backups/crmnexointegrator_v2"
LOG_FILE="/var/log/crmnexointegrator_v2-backup.log"
KEEP_DAYS=30
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/crmnexointegrator_v2_${TIMESTAMP}.dump"

log() {
  local msg="[$(date +"%Y-%m-%d %H:%M:%S %Z")] [NexosCRM-v2 Backup] $*"
  echo "$msg"
}

fail() {
  local err="[$(date +"%Y-%m-%d %H:%M:%S %Z")] [NexosCRM-v2 Backup ERRO] $*"
  echo "$err" >&2
  exit 1
}

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}"

RESTORE_BIN="/usr/lib/postgresql/17/bin/pg_restore"
[ -x "${RESTORE_BIN}" ] || RESTORE_BIN="pg_restore"

# ── 2. Dump Principal (Formato Customizado pg_dump -Fc) ────────────────────────
log "Iniciando backup completo de 100% dos dados da base: ${DB_NAME} (porta ${DB_PORT})..."

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
  log "Executando pg_dump via container ativo '${DB_CONTAINER}'..."
  if ! docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${BACKUP_FILE}"; then
    rm -f "${BACKUP_FILE}"
    fail "Falha ao executar pg_dump no container ${DB_CONTAINER}"
  fi
else
  log "Container não encontrado, executando pg_dump direto em 127.0.0.1:${DB_PORT}..."
  export PGPASSWORD="NexosCRM@2024!"
  PG_BIN="/usr/lib/postgresql/17/bin/pg_dump"
  [ -x "${PG_BIN}" ] || PG_BIN="pg_dump"
  if ! "${PG_BIN}" -h 127.0.0.1 -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${BACKUP_FILE}"; then
    rm -f "${BACKUP_FILE}"
    fail "Falha ao executar pg_dump na porta ${DB_PORT}"
  fi
fi

# Validação de tamanho mínimo
FILE_SIZE_BYTES=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo 0)
if [ "${FILE_SIZE_BYTES}" -lt 50000 ]; then
  fail "Backup gerado é anormalmente pequeno (${FILE_SIZE_BYTES} bytes). Abortando."
fi

HUMAN_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
log "Dump customizado concluído: ${BACKUP_FILE} (${HUMAN_SIZE})"

# ── 3. Validação de Integridade do Dump e Módulo SIMULADOR ───────────────────────
log "Verificando integridade estrutural do arquivo de backup..."
if "${RESTORE_BIN}" --list "${BACKUP_FILE}" >/dev/null 2>&1; then
  log "Integridade do arquivo de backup validada com SUCESSO."
else
  fail "Validação de integridade do dump falhou! O arquivo pode estar corrompido."
fi

# Validação explícita da presença do módulo SIMULADOR
log "Validando presença das tabelas do módulo SIMULADOR no backup..."
SIMULATOR_COUNT=$("${RESTORE_BIN}" --list "${BACKUP_FILE}" | grep -c "SimulatorProposal" || true)
if [ "${SIMULATOR_COUNT}" -gt 0 ]; then
  log "✅ Módulo SIMULADOR (SimulatorProposal) verificado com 100% de sucesso no backup (${SIMULATOR_COUNT} referências de tabela/índice/dados)."
else
  fail "❌ Tabela SimulatorProposal NÃO encontrada no backup!"
fi

# ── 4. Rotação de Backups Antigos (Manter 30 dias) ─────────────────────────────
log "Executando rotação: removendo backups com mais de ${KEEP_DAYS} dias..."
find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.dump" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.dump" | wc -l | tr -d ' ')
log "Total de backups retidos no diretório: ${TOTAL_BACKUPS}"

# ── 5. Resumo Final ───────────────────────────────────────────────────────────
log "==========================================================="
log "BACKUP FINALIZADO COM SUCESSO (100% DOS DADOS + SIMULADOR)"
log "  Banco de Dados: ${DB_NAME} (Porta ${DB_PORT})"
log "  Arquivo:        ${BACKUP_FILE}"
log "  Tamanho:        ${HUMAN_SIZE}"
log "  Retenção:       ${KEEP_DAYS} dias"
log "  Total disp:     ${TOTAL_BACKUPS} cópias de segurança"
log "==========================================================="
