#!/bin/bash
# =============================================================================
# NexosCRM v2 — Rotina de Backup Automatizado do Banco de Dados
# Banco: crmnexointegrator_v2 (PostgreSQL 16)
# Agendamento: Segunda a Sexta às 17h (America/Sao_Paulo)
# =============================================================================
set -euo pipefail

# ── Configurações ─────────────────────────────────────────────────────────────
DB_NAME="crmnexointegrator_v2"
DB_USER="postgres"
BACKUP_DIR="/var/backups/crmnexointegrator_v2"
LOG_FILE="/var/log/crmnexointegrator_v2-backup.log"
KEEP_DAYS=30
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/crmnexointegrator_v2_${TIMESTAMP}.dump"
BACKUP_SQL_GZ="${BACKUP_DIR}/crmnexointegrator_v2_${TIMESTAMP}.sql.gz"

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
chown root:postgres "${BACKUP_DIR}" 2>/dev/null || true
chmod 750 "${BACKUP_DIR}"

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump não encontrado no sistema"

# ── 2. Dump Principal (Formato Customizado pg_dump -Fc) ────────────────────────
log "Iniciando backup da base de dados: ${DB_NAME}..."

if ! sudo -u "${DB_USER}" pg_dump -d "${DB_NAME}" -Fc > "${BACKUP_FILE}"; then
  rm -f "${BACKUP_FILE}"
  fail "Falha ao executar pg_dump na base ${DB_NAME}"
fi

# Validação de tamanho mínimo (não vazio)
FILE_SIZE_BYTES=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo 0)
if [ "${FILE_SIZE_BYTES}" -lt 50000 ]; then
  fail "Backup gerado é anormalmente pequeno (${FILE_SIZE_BYTES} bytes). Abortando."
fi

HUMAN_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
log "Dump customizado concluído: ${BACKUP_FILE} (${HUMAN_SIZE})"

# ── 3. Validação de Integridade do Dump ───────────────────────────────────────
log "Verificando integridade estrutural do arquivo de backup..."
if pg_restore --list "${BACKUP_FILE}" >/dev/null 2>&1; then
  log "Integridade do arquivo de backup validada com SUCESSO."
else
  fail "Validação de integridade do dump falhou! O arquivo pode estar corrompido."
fi

# ── 4. Rotação de Backups Antigos (Manter 30 dias) ─────────────────────────────
log "Executando rotação: removendo backups com mais de ${KEEP_DAYS} dias..."
find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.dump" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.sql.gz" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true

TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.dump" | wc -l | tr -d ' ')
log "Total de backups retidos no diretório: ${TOTAL_BACKUPS}"

# ── 5. Resumo Final ───────────────────────────────────────────────────────────
log "==========================================================="
log "BACKUP FINALIZADO COM SUCESSO"
log "  Arquivo:   ${BACKUP_FILE}"
log "  Tamanho:   ${HUMAN_SIZE}"
log "  Retenção:  ${KEEP_DAYS} dias"
log "  Total disp:${TOTAL_BACKUPS} cópias de segurança"
log "==========================================================="
