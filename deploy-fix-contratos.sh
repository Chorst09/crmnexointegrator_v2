#!/bin/bash
set -e

SERVER_IP="200.142.149.2"
SERVER_USER="root"
SERVER_PASS="${SSH_PASSWORD:?Defina SSH_PASSWORD no ambiente antes de executar}"

echo "=== Deploy: Correção de Visualização de Contratos ==="
echo ""

# 1. Upload do backend corrigido
echo "[1/4] Uploading contract-service.cjs..."
sshpass -p "$SERVER_PASS" scp backend/lib/contract-service.cjs "$SERVER_USER@$SERVER_IP:/var/www/nexoscrm/backend/lib/"

# 2. Upload do frontend corrigido (mensagem erro 409)
echo "[2/4] Building and uploading frontend..."
cd apps/web
npm run build
cd dist

TIMESTAMP=$(date +%Y%m%d-%H%M%S-%N | cut -b1-20)
RELEASE="release-$TIMESTAMP"

# Criar diretório
sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" "mkdir -p /var/www/nexoscrm/frontend/releases/$RELEASE"

# Upload via tar
tar -czf - . | sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" "cd /var/www/nexoscrm/frontend/releases/$RELEASE && tar -xzf -"

cd ../../..

# 3. Ativar nova release
echo "[3/4] Activating release $RELEASE..."
sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" "cd /var/www/nexoscrm/frontend && ln -snf releases/$RELEASE current"

# 4. Reiniciar API
echo "[4/4] Restarting API..."
sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" "pm2 restart nexoscrm-api"

echo ""
echo "=== Deploy Concluído! ==="
echo ""
echo "Correções aplicadas:"
echo "  ✓ MASTER vê todos os contratos (sem filtros)"
echo "  ✓ Mensagem clara para erro 409 (número duplicado)"
echo ""
echo "Teste agora:"
echo "  1. Faça refresh no navegador (Ctrl+Shift+R)"
echo "  2. Acesse Gestão > Contratos"
echo "  3. Os contratos devem aparecer na lista"
echo ""
