#!/bin/bash
# =============================================================================
# NexosCRM v2 — Rotina de Backup Automatizado do Banco de Dados
# Banco: nexoscrm (PostgreSQL 15 / Docker porta 5433)
# Inclui 100% dos dados: B2B Core, CRM, B2G, SIMULADOR, PRÉ-VENDAS, PROJETOS, GESTÃO
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

# Helper: executa query SQL no banco e retorna resultado (via docker ou direto)
run_sql() {
  local query="$1"
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
    docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "${query}" 2>/dev/null | tr -d ' '
  else
    export PGPASSWORD="NexosCRM@2024!"
    PG_BIN="/usr/lib/postgresql/17/bin/psql"
    [ -x "${PG_BIN}" ] || PG_BIN="psql"
    "${PG_BIN}" -h 127.0.0.1 -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "${query}" 2>/dev/null | tr -d ' '
  fi
}

# Helper: conta linhas de uma tabela (retorna 0 se tabela não existir)
count_rows() {
  local table="$1"
  run_sql "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null || echo "0"
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

# Validação de tamanho mínimo (50 KB)
FILE_SIZE_BYTES=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo 0)
if [ "${FILE_SIZE_BYTES}" -lt 50000 ]; then
  fail "Backup gerado é anormalmente pequeno (${FILE_SIZE_BYTES} bytes). Abortando."
fi

HUMAN_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
log "Dump concluído: ${BACKUP_FILE} (${HUMAN_SIZE})"

# ── 3. Log de Módulos Incluídos no Backup ────────────────────────────────────
# Conta os registros reais de cada módulo diretamente no banco
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "MÓDULOS INCLUÍDOS NO BACKUP (contagem de registros):"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_ROWS=0

# ── B2B Core ────────────────────────────────────────────────
R_USER=$(count_rows "User")
R_TENANT=$(count_rows "TenantCompany")
R_LICENSEPLAN=$(count_rows "LicensePlan")
R_COMPANYLICENSE=$(count_rows "CompanyLicense")
R_REGION=$(count_rows "Region")
R_SYSTEMSETTING=$(count_rows "SystemSetting")
B2BCORE_TOTAL=$((R_USER + R_TENANT + R_LICENSEPLAN + R_COMPANYLICENSE + R_REGION + R_SYSTEMSETTING))
log "  ✓ B2B CORE      │ 6 tabelas │ ${B2BCORE_TOTAL} registros"
log "      User(${R_USER}), TenantCompany(${R_TENANT}), LicensePlan(${R_LICENSEPLAN}), CompanyLicense(${R_COMPANYLICENSE}), Region(${R_REGION}), SystemSetting(${R_SYSTEMSETTING})"
TOTAL_ROWS=$((TOTAL_ROWS + B2BCORE_TOTAL))

# ── CRM ─────────────────────────────────────────────────────
R_COMPANY=$(count_rows "Company")
R_CONTACT=$(count_rows "Contact")
R_OPP=$(count_rows "Opportunity")
R_ACT=$(count_rows "Activity")
R_PROP=$(count_rows "Proposal")
R_CONTRACT=$(count_rows "Contract")
R_PRODUCT=$(count_rows "Product")
R_COMMISSION=$(count_rows "Commission")
CRM_TOTAL=$((R_COMPANY + R_CONTACT + R_OPP + R_ACT + R_PROP + R_CONTRACT + R_PRODUCT + R_COMMISSION))
log "  ✓ CRM           │ 8 tabelas │ ${CRM_TOTAL} registros"
log "      Company(${R_COMPANY}), Contact(${R_CONTACT}), Opportunity(${R_OPP}), Activity(${R_ACT}), Proposal(${R_PROP}), Contract(${R_CONTRACT}), Product(${R_PRODUCT}), Commission(${R_COMMISSION})"
TOTAL_ROWS=$((TOTAL_ROWS + CRM_TOTAL))

# ── B2G ─────────────────────────────────────────────────────
R_GERENCIADAS=$(count_rows "gerenciadas_licitacao")
R_ALERTAS=$(count_rows "alertas_licitacao")
R_EDITAIS=$(count_rows "editais_analisados")
R_PNCP=$(count_rows "licitacoes_pncp")
R_BIDNOTICE=$(count_rows "BidNotice")
B2G_TOTAL=$((R_GERENCIADAS + R_ALERTAS + R_EDITAIS + R_PNCP + R_BIDNOTICE))
log "  ✓ B2G           │ 5 tabelas │ ${B2G_TOTAL} registros"
log "      gerenciadas_licitacao(${R_GERENCIADAS}), alertas_licitacao(${R_ALERTAS}), editais_analisados(${R_EDITAIS}), licitacoes_pncp(${R_PNCP}), BidNotice(${R_BIDNOTICE})"
TOTAL_ROWS=$((TOTAL_ROWS + B2G_TOTAL))

# ── SIMULADOR ───────────────────────────────────────────────
R_SIMPROP=$(count_rows "simulator_proposal")
R_SIMLIC=$(count_rows "simulator_licitacao")
SIMULADOR_TOTAL=$((R_SIMPROP + R_SIMLIC))
log "  ✓ SIMULADOR     │ 2 tabelas │ ${SIMULADOR_TOTAL} registros"
log "      simulator_proposal(${R_SIMPROP}), simulator_licitacao(${R_SIMLIC})"
TOTAL_ROWS=$((TOTAL_ROWS + SIMULADOR_TOTAL))

# ── PRÉ-VENDAS ──────────────────────────────────────────────
R_PSR=$(count_rows "PreSalesRequest")
R_POC=$(count_rows "PreSalesPoc")
R_POCFU=$(count_rows "PreSalesPocFollowUp")
PREVENDAS_TOTAL=$((R_PSR + R_POC + R_POCFU))
log "  ✓ PRÉ-VENDAS    │ 3 tabelas │ ${PREVENDAS_TOTAL} registros"
log "      PreSalesRequest(${R_PSR}), PreSalesPoc(${R_POC}), PreSalesPocFollowUp(${R_POCFU})"
TOTAL_ROWS=$((TOTAL_ROWS + PREVENDAS_TOTAL))

# ── PROJETOS ────────────────────────────────────────────────
R_PROJ=$(count_rows "Project")
R_PHASE=$(count_rows "ProjectPhase")
R_TASK=$(count_rows "ProjectTask")
R_TEAM=$(count_rows "ProjectTeam")
R_RISK=$(count_rows "ProjectRisk")
R_MILESTONE=$(count_rows "ProjectMilestone")
PROJETOS_TOTAL=$((R_PROJ + R_PHASE + R_TASK + R_TEAM + R_RISK + R_MILESTONE))
log "  ✓ PROJETOS      │ 6 tabelas │ ${PROJETOS_TOTAL} registros"
log "      Project(${R_PROJ}), ProjectPhase(${R_PHASE}), ProjectTask(${R_TASK}), ProjectTeam(${R_TEAM}), ProjectRisk(${R_RISK}), ProjectMilestone(${R_MILESTONE})"
TOTAL_ROWS=$((TOTAL_ROWS + PROJETOS_TOTAL))

# ── KICKOFF ─────────────────────────────────────────────────
R_KO=$(count_rows "KickoffMeeting")
R_KOP=$(count_rows "KickoffParticipant")
R_KOA=$(count_rows "KickoffAgendaItem")
R_KOC=$(count_rows "KickoffChecklistItem")
R_KOAI=$(count_rows "KickoffActionItem")
KICKOFF_TOTAL=$((R_KO + R_KOP + R_KOA + R_KOC + R_KOAI))
log "  ✓ KICKOFF       │ 5 tabelas │ ${KICKOFF_TOTAL} registros"
log "      KickoffMeeting(${R_KO}), Participants(${R_KOP}), AgendaItems(${R_KOA}), Checklist(${R_KOC}), ActionItems(${R_KOAI})"
TOTAL_ROWS=$((TOTAL_ROWS + KICKOFF_TOTAL))

# ── GESTÃO ──────────────────────────────────────────────────
R_AUDIT=$(count_rows "AuditLog")
R_NOTIF=$(count_rows "Notification")
GESTAO_TOTAL=$((R_AUDIT + R_NOTIF))
log "  ○ GESTÃO        │ 2 tabelas │ ${GESTAO_TOTAL} registros"
log "      AuditLog(${R_AUDIT}), Notification(${R_NOTIF})"
TOTAL_ROWS=$((TOTAL_ROWS + GESTAO_TOTAL))

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "TOTAL GERAL: 8 módulos | ~37 tabelas | ${TOTAL_ROWS} registros"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 4. Validação de Integridade Estrutural do Dump ───────────────────────────
log "Verificando integridade estrutural do arquivo de backup..."
if "${RESTORE_BIN}" --list "${BACKUP_FILE}" >/dev/null 2>&1; then
  log "Integridade do dump validada com SUCESSO."
else
  fail "Validação de integridade falhou — o arquivo pode estar corrompido."
fi

# Validação explícita das tabelas críticas de cada módulo
log "Validando presença das tabelas críticas no dump..."
DUMP_LIST=$("${RESTORE_BIN}" --list "${BACKUP_FILE}")

check_table() {
  local tbl="$1"
  local module="$2"
  local cnt
  cnt=$(echo "${DUMP_LIST}" | grep -c "${tbl}" || true)
  if [ "${cnt}" -gt 0 ]; then
    log "  ✓ [${module}] ${tbl} (${cnt} entradas no índice do dump)"
  else
    fail "  ❌ [${module}] Tabela '${tbl}' NÃO encontrada no dump!"
  fi
}

check_table "SimulatorProposal"       "SIMULADOR"
check_table "simulator_licitacao"     "SIMULADOR"
check_table "gerenciadas_licitacao"   "B2G"
check_table "alertas_licitacao"       "B2G"
check_table "editais_analisados"      "B2G"
check_table "licitacoes_pncp"         "B2G"

log "Todas as tabelas críticas confirmadas no dump."

# ── 5. Rotação de Backups Antigos (Manter 30 dias) ───────────────────────────
log "Rotação: removendo backups com mais de ${KEEP_DAYS} dias..."
find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.dump" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.dump" | wc -l | tr -d ' ')
log "Backups retidos no diretório: ${TOTAL_BACKUPS}"

# ── 6. Resumo Final ──────────────────────────────────────────────────────────
log "==========================================================="
log "BACKUP FINALIZADO COM SUCESSO"
log "  Banco de Dados  : ${DB_NAME} (Porta ${DB_PORT})"
log "  Arquivo         : ${BACKUP_FILE}"
log "  Tamanho         : ${HUMAN_SIZE}"
log "  Registros total : ${TOTAL_ROWS}"
log "  Módulos         : B2B Core | CRM | B2G | SIMULADOR | PRÉ-VENDAS | PROJETOS | KICKOFF | GESTÃO"
log "  Retenção        : ${KEEP_DAYS} dias"
log "  Cópias disp.    : ${TOTAL_BACKUPS}"
log "==========================================================="
