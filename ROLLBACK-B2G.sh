#!/bin/bash
# Script de Rollback - Sistema B2G de Editais
# Uso: ./ROLLBACK-B2G.sh

set -e

BACKUP_DIR=$(ls -dt .rollback-b2g-* 2>/dev/null | head -1)
SERVIDOR="root@209.50.241.25"
PASSWORD="${SSH_PASSWORD:?Defina SSH_PASSWORD no ambiente antes de executar}"

echo "🔄 ROLLBACK DO SISTEMA B2G"
echo "=========================="
echo ""

if [ -z "$BACKUP_DIR" ]; then
  echo "❌ Nenhum backup encontrado!"
  exit 1
fi

echo "📂 Backup encontrado: $BACKUP_DIR"
echo ""
read -p "Deseja continuar com o rollback? (s/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "❌ Rollback cancelado"
  exit 0
fi

echo "🔄 Restaurando arquivos locais..."
cp "$BACKUP_DIR/b2g-search.js" backend/api/b2g-search.js

echo "📤 Fazendo deploy do backup para produção..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no \
  "$BACKUP_DIR/b2g-search.js" \
  $SERVIDOR:/var/www/crmnexointegrator_3026/backend/api/

echo "🔄 Reiniciando API..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVIDOR \
  'pm2 restart crmnexointegrator_3026'

echo ""
echo "✅ Rollback concluído!"
echo ""
echo "Verificando health..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $SERVIDOR \
  'curl -s http://localhost:3026/api/health | jq .'

echo ""
echo "✅ Sistema restaurado para versão anterior"
