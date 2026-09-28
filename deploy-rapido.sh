#!/bin/bash
# ============================================
# Deploy Rápido - Apenas código (sem rebuild)
# ============================================

set -e

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PORT="22"

echo "⚡ Deploy rápido para $SERVER_IP..."

# Verificar sshpass
if command -v sshpass &> /dev/null; then
    SSH_CMD="sshpass -p '<SSH_PASSWORD>' ssh -p $SERVER_PORT -o StrictHostKeyChecking=no"
    SCP_CMD="sshpass -p '<SSH_PASSWORD>' scp -P $SERVER_PORT -o StrictHostKeyChecking=no"
else
    SSH_CMD="ssh -p $SERVER_PORT"
    SCP_CMD="scp -P $SERVER_PORT"
fi

# Criar tar apenas com código essencial
echo "📦 Empacotando código..."
tar --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./frontend/node_modules' \
    --exclude='./backend/node_modules' \
    --exclude='./frontend/dist' \
    --exclude='./*.md' \
    --exclude='./deploy-*.sh' \
    --exclude='./backups-preparados' \
    --exclude='./docs' \
    -czf /tmp/nexoscrm-update.tar.gz \
    ./backend/api \
    ./backend/server.js \
    ./backend/package.json \
    ./frontend/src \
    ./frontend/package.json \
    ./frontend/vite.config.js \
    ./.env.production

echo "📤 Enviando atualização..."
$SCP_CMD /tmp/nexoscrm-update.tar.gz $SERVER_USER@$SERVER_IP:/opt/nexoscrm/

echo "🔄 Aplicando atualização..."
$SSH_CMD $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /opt/nexoscrm
    
    # Backup atual
    cp -r backend backend_backup_$(date +%H%M%S) 2>/dev/null || true
    cp -r frontend frontend_backup_$(date +%H%M%S) 2>/dev/null || true
    
    # Extrair atualização
    tar -xzf nexoscrm-update.tar.gz
    rm nexoscrm-update.tar.gz
    
    # Reiniciar apenas os containers necessários
    docker compose -f docker-compose.production.yml restart backend frontend
    
    echo "✅ Atualização aplicada!"
ENDSSH

echo "⚡ Deploy rápido concluído!"
rm /tmp/nexoscrm-update.tar.gz