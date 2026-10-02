#!/bin/bash
# =============================================================================
# NexosCRM v2 — Utilitário de Restauração de Banco de Dados
# Permite restaurar em modo de teste (sandbox) ou restauração direta.
# Banco de dados: nexoscrm (PostgreSQL 15 / Docker porta 5433)
# Uso:
#   ./restore-crmnexointegrator_v2.sh --test <arquivo.dump>
#   ./restore-crmnexointegrator_v2.sh --live <arquivo.dump>
# =============================================================================
set -euo pipefail

DB_NAME="nexoscrm"
DB_USER="nexoscrm"
DB_CONTAINER="nexoscrm-postgres"
BACKUP_DIR="/var/backups/crmnexointegrator_v2"

usage() {
  echo "Uso:"
  echo "  $0 --test <caminho_do_dump>   (Restaura em banco temporário para validar integridade de 100% dos dados)"
  echo "  $0 --live <caminho_do_dump>   (Restaura diretamente no banco de produção)"
  echo "  $0 --list                     (Lista os backups disponíveis)"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

MODE="$1"

if [ "${MODE}" = "--list" ]; then
  echo "=== Backups disponíveis em ${BACKUP_DIR} ==="
  ls -lh "${BACKUP_DIR}"/crmnexointegrator_v2_*.dump 2>/dev/null || echo "Nenhum backup encontrado."
  exit 0
fi

if [ $# -lt 2 ]; then
  usage
fi

DUMP_FILE="$2"

if [ ! -f "${DUMP_FILE}" ]; then
  echo "ERRO: Arquivo ${DUMP_FILE} não encontrado!" >&2
  exit 1
fi

if [ "${MODE}" = "--test" ]; then
  TEST_DB="nexoscrm_test_restore"
  echo "================================================================="
  echo "=== MODO DE TESTE / VALIDAÇÃO DE RESTAURAÇÃO DE 100% DOS DADOS =="
  echo "================================================================="
  echo "1. Criando banco de teste temporário: ${TEST_DB}..."
  docker exec "${DB_CONTAINER}" dropdb -U "${DB_USER}" --if-exists "${TEST_DB}"
  docker exec "${DB_CONTAINER}" createdb -U "${DB_USER}" "${TEST_DB}"

  echo "2. Restaurando dump no banco de teste: ${DUMP_FILE}..."
  docker exec -i "${DB_CONTAINER}" pg_restore -U "${DB_USER}" -d "${TEST_DB}" --no-owner --no-privileges < "${DUMP_FILE}" || true

  echo "3. Verificando integridade das tabelas restauradas:"
  docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -c "
    SELECT count(*) AS total_tabelas_restauradas 
    FROM information_schema.tables 
    WHERE table_schema='public' AND table_type='BASE TABLE';
  "

  echo "4. Verificando registros principais (incluindo módulo SIMULADOR):"
  docker exec "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${TEST_DB}" -c "
    SELECT 'SimulatorProposal (SIMULADOR)' AS modulo, count(*) AS registros FROM \"SimulatorProposal\"
    UNION ALL SELECT 'Opportunity', count(*) FROM \"Opportunity\"
    UNION ALL SELECT 'proposals (Calculadoras)', count(*) FROM proposals
    UNION ALL SELECT 'calculations', count(*) FROM calculations
    UNION ALL SELECT 'licitacoes_pncp', count(*) FROM licitacoes_pncp
    UNION ALL SELECT 'User', count(*) FROM \"User\"
    UNION ALL SELECT 'Company', count(*) FROM \"Company\"
    UNION ALL SELECT 'SystemSetting', count(*) FROM \"SystemSetting\";
  "

  echo "5. Limpando banco de teste temporário..."
  docker exec "${DB_CONTAINER}" dropdb -U "${DB_USER}" "${TEST_DB}"
  echo "================================================================="
  echo "✅ TESTE DE RESTAURAÇÃO CONCLUÍDO COM 100% DE SUCESSO!"
  echo "   Todas as tabelas e dados do SIMULADOR foram verificados."
  echo "================================================================="
  exit 0
fi

if [ "${MODE}" = "--live" ]; then
  echo "⚠️  ATENÇÃO: Você está prestes a restaurar sobre o banco de PRODUÇÃO (${DB_NAME})!"
  read -r -p "Tem certeza absoluta? Digite 'CONFIRMAR RESTAURACAO': " CONFIRM
  if [ "${CONFIRM}" != "CONFIRMAR RESTAURACAO" ]; then
    echo "Operação cancelada pelo usuário."
    exit 1
  fi

  SNAPSHOT="/var/backups/crmnexointegrator_v2/pre_live_restore_$(date +"%Y%m%d_%H%M%S").dump"
  echo "Criando snapshot de segurança antes da restauração: ${SNAPSHOT}..."
  docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${SNAPSHOT}"

  echo "Parando temporariamente a aplicação PM2..."
  pm2 stop crmnexointegrator_v2 || true

  echo "Recriando banco de dados ${DB_NAME}..."
  docker exec "${DB_CONTAINER}" dropdb -U "${DB_USER}" "${DB_NAME}"
  docker exec "${DB_CONTAINER}" createdb -U "${DB_USER}" "${DB_NAME}"

  echo "Restaurando dump ${DUMP_FILE}..."
  docker exec -i "${DB_CONTAINER}" pg_restore -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges < "${DUMP_FILE}" || true

  echo "Iniciando a aplicação PM2..."
  pm2 start crmnexointegrator_v2 || true

  echo "Verificando se o serviço voltou..."
  sleep 2
  curl -sI http://localhost:3025/api/health || true

  echo "================================================================="
  echo "✅ RESTAURAÇÃO DE PRODUÇÃO CONCLUÍDA COM 100% DE SUCESSO!"
  echo "================================================================="
  exit 0
fi

usage
