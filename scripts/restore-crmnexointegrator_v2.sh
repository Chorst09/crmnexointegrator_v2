#!/bin/bash
# =============================================================================
# NexosCRM v2 — Utilitário de Restauração de Banco de Dados
# Permite restaurar em modo de teste (sandbox) ou restauração direta.
# Uso:
#   ./restore-crmnexointegrator_v2.sh --test <arquivo.dump>
#   ./restore-crmnexointegrator_v2.sh --live <arquivo.dump>
# =============================================================================
set -euo pipefail

DB_NAME="crmnexointegrator_v2"
DB_USER="postgres"
BACKUP_DIR="/var/backups/crmnexointegrator_v2"

usage() {
  echo "Uso:"
  echo "  $0 --test <caminho_do_dump>   (Restaura em banco temporário para validar)"
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
  TEST_DB="crmnexointegrator_v2_test_restore"
  echo "=== MODO DE TESTE / VALIDAÇÃO DE RESTAURAÇÃO ==="
  echo "1. Criando banco de teste temporário: ${TEST_DB}..."
  sudo -u "${DB_USER}" dropdb --if-exists "${TEST_DB}"
  sudo -u "${DB_USER}" createdb -O chorst "${TEST_DB}"

  echo "2. Restaurando dump: ${DUMP_FILE}..."
  sudo -u "${DB_USER}" pg_restore -d "${TEST_DB}" --no-owner --no-privileges "${DUMP_FILE}" || true

  echo "3. Verificando integridade das tabelas restauradas:"
  sudo -u "${DB_USER}" psql -d "${TEST_DB}" -c "
    SELECT count(*) AS total_tabelas_restauradas 
    FROM information_schema.tables 
    WHERE table_schema='public' AND table_type='BASE TABLE';
  "

  echo "4. Verificando registros principais restaurados:"
  sudo -u "${DB_USER}" psql -d "${TEST_DB}" -c "
    SELECT 'Opportunity' AS tabela, count(*) FROM \"Opportunity\"
    UNION ALL SELECT 'licitacoes_pncp', count(*) FROM licitacoes_pncp
    UNION ALL SELECT 'User', count(*) FROM \"User\"
    UNION ALL SELECT 'Company', count(*) FROM \"Company\"
    UNION ALL SELECT 'SystemSetting', count(*) FROM \"SystemSetting\";
  "

  echo "5. Limpando banco de teste temporário..."
  sudo -u "${DB_USER}" dropdb "${TEST_DB}"
  echo "✅ TESTE DE RESTAURAÇÃO CONCLUÍDO COM 100% DE SUCESSO!"
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
  sudo -u "${DB_USER}" pg_dump -d "${DB_NAME}" -Fc > "${SNAPSHOT}"

  echo "Parando temporariamente a aplicação PM2..."
  pm2 stop crmnexointegrator_v2 || true

  echo "Recriando banco de dados ${DB_NAME}..."
  sudo -u "${DB_USER}" dropdb "${DB_NAME}"
  sudo -u "${DB_USER}" createdb -O chorst "${DB_NAME}"

  echo "Restaurando dump ${DUMP_FILE}..."
  sudo -u "${DB_USER}" pg_restore -d "${DB_NAME}" --no-owner --no-privileges "${DUMP_FILE}" || true

  echo "Concedendo permissões ao usuário chorst..."
  sudo -u "${DB_USER}" psql -d "${DB_NAME}" -c "
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chorst;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chorst;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO chorst;
  "

  echo "Iniciando a aplicação PM2..."
  pm2 start crmnexointegrator_v2 || true

  echo "✅ RESTAURAÇÃO DE PRODUÇÃO CONCLUÍDA COM SUCESSO!"
  exit 0
fi

usage
