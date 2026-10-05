#!/bin/bash
# =============================================================================
# NexosCRM v2 — Script de Restauração de Backup
# Restaura 100% dos dados a partir de um dump .dump (pg_restore -Fc)
# Uso: bash restore-crmnexointegrator_v2.sh <arquivo.dump>
#      bash restore-crmnexointegrator_v2.sh  # usa backup mais recente em /var/backups/
# =============================================================================
set -euo pipefail

# ── Configurações ─────────────────────────────────────────────────────────────
DB_NAME="nexoscrm"
DB_USER="nexoscrm"
DB_CONTAINER="nexoscrm-postgres"
DB_PORT="5433"
BACKUP_DIR="/var/backups/crmnexointegrator_v2"

log() {
  local msg="[$(date +"%Y-%m-%d %H:%M:%S %Z")] [NexosCRM-v2 Restore] $*"
  echo "$msg"
}

fail() {
  local err="[$(date +"%Y-%m-%d %H:%M:%S %Z")] [NexosCRM-v2 Restore ERRO] $*"
  echo "$err" >&2
  exit 1
}

# Helper: executa query SQL no banco
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

count_rows() {
  local table="$1"
  run_sql "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null || echo "0"
}

# ── 1. Determinar arquivo de backup ──────────────────────────────────────────
DUMP_FILE="${1:-}"
if [ -z "${DUMP_FILE}" ]; then
  DUMP_FILE=$(find "${BACKUP_DIR}" -name "crmnexointegrator_v2_*.dump" | sort | tail -1)
  if [ -z "${DUMP_FILE}" ]; then
    fail "Nenhum arquivo de backup encontrado em ${BACKUP_DIR}. Informe o caminho manualmente."
  fi
  log "Usando backup mais recente: ${DUMP_FILE}"
fi

[ -f "${DUMP_FILE}" ] || fail "Arquivo não encontrado: ${DUMP_FILE}"

RESTORE_BIN="/usr/lib/postgresql/17/bin/pg_restore"
[ -x "${RESTORE_BIN}" ] || RESTORE_BIN="pg_restore"

HUMAN_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
RESTORE_START=$(date +"%Y-%m-%d %H:%M:%S %Z")

log "==========================================================="
log "INICIANDO RESTAURAÇÃO"
log "  Arquivo  : ${DUMP_FILE}"
log "  Tamanho  : ${HUMAN_SIZE}"
log "  Banco    : ${DB_NAME} (Porta ${DB_PORT})"
log "  Início   : ${RESTORE_START}"
log "==========================================================="

# ── 2. Snapshot pré-restore (quantos registros havia antes) ──────────────────
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "ESTADO DO BANCO ANTES DA RESTAURAÇÃO:"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PRE_USER=$(count_rows "User");           PRE_OPP=$(count_rows "Opportunity")
PRE_GERENC=$(count_rows "gerenciadas_licitacao"); PRE_ALERTAS=$(count_rows "alertas_licitacao")
PRE_EDITAIS=$(count_rows "editais_analisados"); PRE_SIMPROP=$(count_rows "simulator_proposal")
PRE_SIMLIC=$(count_rows "simulator_licitacao"); PRE_PSR=$(count_rows "PreSalesRequest")
PRE_PROJ=$(count_rows "Project")

log "  B2B Core   : User(${PRE_USER})"
log "  CRM        : Opportunity(${PRE_OPP})"
log "  B2G        : gerenciadas_licitacao(${PRE_GERENC}), alertas_licitacao(${PRE_ALERTAS}), editais_analisados(${PRE_EDITAIS})"
log "  SIMULADOR  : simulator_proposal(${PRE_SIMPROP}), simulator_licitacao(${PRE_SIMLIC})"
log "  PRÉ-VENDAS : PreSalesRequest(${PRE_PSR})"
log "  PROJETOS   : Project(${PRE_PROJ})"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 3. Confirmação interativa ─────────────────────────────────────────────────
if [ -t 0 ]; then
  echo ""
  echo "⚠️  ATENÇÃO: Esta operação IRÁ SOBRESCREVER todos os dados do banco ${DB_NAME}."
  echo "   Certifique-se de ter um backup recente antes de prosseguir."
  echo ""
  read -r -p "   Digite CONFIRMAR para prosseguir: " CONFIRM
  if [ "${CONFIRM}" != "CONFIRMAR" ]; then
    fail "Restauração cancelada pelo usuário."
  fi
fi

# ── 4. Executar pg_restore ────────────────────────────────────────────────────
log "Executando pg_restore (modo: limpar + restaurar)..."

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
  log "Restaurando via container '${DB_CONTAINER}'..."
  if ! docker exec -i "${DB_CONTAINER}" pg_restore \
      -U "${DB_USER}" -d "${DB_NAME}" \
      --clean --if-exists --no-owner --no-acl \
      < "${DUMP_FILE}"; then
    fail "Falha ao executar pg_restore no container ${DB_CONTAINER}"
  fi
else
  log "Restaurando diretamente em 127.0.0.1:${DB_PORT}..."
  export PGPASSWORD="NexosCRM@2024!"
  PG_BIN="/usr/lib/postgresql/17/bin/pg_restore"
  [ -x "${PG_BIN}" ] || PG_BIN="pg_restore"
  if ! "${PG_BIN}" \
      -h 127.0.0.1 -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
      --clean --if-exists --no-owner --no-acl \
      "${DUMP_FILE}"; then
    fail "Falha ao executar pg_restore na porta ${DB_PORT}"
  fi
fi

log "pg_restore concluído."

# ── 5. Log de módulos restaurados (contagem pós-restore) ─────────────────────
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "MÓDULOS RESTAURADOS:"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_RESTORED=0

# ── B2B Core ─────────────────────────────────────────────────
R_USER=$(count_rows "User");         R_TENANT=$(count_rows "TenantCompany")
R_LICPLAN=$(count_rows "LicensePlan"); R_COMPLICN=$(count_rows "CompanyLicense")
R_REGION=$(count_rows "Region");     R_SYSSETT=$(count_rows "SystemSetting")
B2BCORE_TOTAL=$((R_USER + R_TENANT + R_LICPLAN + R_COMPLICN + R_REGION + R_SYSSETT))
log "  ✓ B2B CORE      │ ${B2BCORE_TOTAL} registros restaurados"
log "      User(${R_USER}), TenantCompany(${R_TENANT}), LicensePlan(${R_LICPLAN}), CompanyLicense(${R_COMPLICN}), Region(${R_REGION}), SystemSetting(${R_SYSSETT})"
TOTAL_RESTORED=$((TOTAL_RESTORED + B2BCORE_TOTAL))

# ── CRM ──────────────────────────────────────────────────────
R_COMPANY=$(count_rows "Company"); R_CONTACT=$(count_rows "Contact")
R_OPP=$(count_rows "Opportunity"); R_ACT=$(count_rows "Activity")
R_PROP=$(count_rows "Proposal");   R_CONTRACT=$(count_rows "Contract")
R_PRODUCT=$(count_rows "Product"); R_COMM=$(count_rows "Commission")
CRM_TOTAL=$((R_COMPANY + R_CONTACT + R_OPP + R_ACT + R_PROP + R_CONTRACT + R_PRODUCT + R_COMM))
log "  ✓ CRM           │ ${CRM_TOTAL} registros restaurados"
log "      Company(${R_COMPANY}), Contact(${R_CONTACT}), Opportunity(${R_OPP}), Activity(${R_ACT}), Proposal(${R_PROP}), Contract(${R_CONTRACT}), Product(${R_PRODUCT}), Commission(${R_COMM})"
TOTAL_RESTORED=$((TOTAL_RESTORED + CRM_TOTAL))

# ── B2G ──────────────────────────────────────────────────────
R_GERENC=$(count_rows "gerenciadas_licitacao"); R_ALERTAS=$(count_rows "alertas_licitacao")
R_EDITAIS=$(count_rows "editais_analisados");   R_PNCP=$(count_rows "licitacoes_pncp")
R_BIDNOTICE=$(count_rows "BidNotice")
B2G_TOTAL=$((R_GERENC + R_ALERTAS + R_EDITAIS + R_PNCP + R_BIDNOTICE))
log "  ✓ B2G           │ ${B2G_TOTAL} registros restaurados"
log "      gerenciadas_licitacao(${R_GERENC}), alertas_licitacao(${R_ALERTAS}), editais_analisados(${R_EDITAIS}), licitacoes_pncp(${R_PNCP}), BidNotice(${R_BIDNOTICE})"
TOTAL_RESTORED=$((TOTAL_RESTORED + B2G_TOTAL))

# ── SIMULADOR ────────────────────────────────────────────────
R_SIMPROP=$(count_rows "simulator_proposal"); R_SIMLIC=$(count_rows "simulator_licitacao")
SIMULADOR_TOTAL=$((R_SIMPROP + R_SIMLIC))
log "  ✓ SIMULADOR     │ ${SIMULADOR_TOTAL} registros restaurados"
log "      simulator_proposal(${R_SIMPROP}), simulator_licitacao(${R_SIMLIC})"
TOTAL_RESTORED=$((TOTAL_RESTORED + SIMULADOR_TOTAL))

# ── PRÉ-VENDAS ───────────────────────────────────────────────
R_PSR=$(count_rows "PreSalesRequest"); R_POC=$(count_rows "PreSalesPoc")
R_POCFU=$(count_rows "PreSalesPocFollowUp")
PREVENDAS_TOTAL=$((R_PSR + R_POC + R_POCFU))
log "  ✓ PRÉ-VENDAS    │ ${PREVENDAS_TOTAL} registros restaurados"
log "      PreSalesRequest(${R_PSR}), PreSalesPoc(${R_POC}), PreSalesPocFollowUp(${R_POCFU})"
TOTAL_RESTORED=$((TOTAL_RESTORED + PREVENDAS_TOTAL))

# ── PROJETOS ─────────────────────────────────────────────────
R_PROJ=$(count_rows "Project");   R_PHASE=$(count_rows "ProjectPhase")
R_TASK=$(count_rows "ProjectTask"); R_TEAM=$(count_rows "ProjectTeam")
R_RISK=$(count_rows "ProjectRisk"); R_MS=$(count_rows "ProjectMilestone")
PROJETOS_TOTAL=$((R_PROJ + R_PHASE + R_TASK + R_TEAM + R_RISK + R_MS))
log "  ✓ PROJETOS      │ ${PROJETOS_TOTAL} registros restaurados"
log "      Project(${R_PROJ}), ProjectPhase(${R_PHASE}), ProjectTask(${R_TASK}), ProjectTeam(${R_TEAM}), ProjectRisk(${R_RISK}), ProjectMilestone(${R_MS})"
TOTAL_RESTORED=$((TOTAL_RESTORED + PROJETOS_TOTAL))

# ── KICKOFF ──────────────────────────────────────────────────
R_KO=$(count_rows "KickoffMeeting"); R_KOP=$(count_rows "KickoffParticipant")
R_KOA=$(count_rows "KickoffAgendaItem"); R_KOC=$(count_rows "KickoffChecklistItem")
KICKOFF_TOTAL=$((R_KO + R_KOP + R_KOA + R_KOC))
log "  ✓ KICKOFF       │ ${KICKOFF_TOTAL} registros restaurados"
log "      KickoffMeeting(${R_KO}), Participants(${R_KOP}), AgendaItems(${R_KOA}), Checklist(${R_KOC})"
TOTAL_RESTORED=$((TOTAL_RESTORED + KICKOFF_TOTAL))

# ── GESTÃO ───────────────────────────────────────────────────
R_AUDIT=$(count_rows "AuditLog"); R_NOTIF=$(count_rows "Notification")
GESTAO_TOTAL=$((R_AUDIT + R_NOTIF))
log "  ○ GESTÃO        │ ${GESTAO_TOTAL} registros restaurados"
log "      AuditLog(${R_AUDIT}), Notification(${R_NOTIF})"
TOTAL_RESTORED=$((TOTAL_RESTORED + GESTAO_TOTAL))

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "TOTAL RESTAURADO: 8 módulos | ${TOTAL_RESTORED} registros"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 6. Resumo Final ──────────────────────────────────────────────────────────
RESTORE_END=$(date +"%Y-%m-%d %H:%M:%S %Z")
log "==========================================================="
log "RESTAURAÇÃO FINALIZADA COM SUCESSO"
log "  Arquivo    : ${DUMP_FILE}"
log "  Banco      : ${DB_NAME} (Porta ${DB_PORT})"
log "  Início     : ${RESTORE_START}"
log "  Fim        : ${RESTORE_END}"
log "  Registros  : ${TOTAL_RESTORED}"
log "  Módulos    : B2B Core | CRM | B2G | SIMULADOR | PRÉ-VENDAS | PROJETOS | KICKOFF | GESTÃO"
log "==========================================================="
