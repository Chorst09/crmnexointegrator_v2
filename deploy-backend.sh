#!/bin/bash
# Script de deploy para o backend
# Uso: bash deploy-backend.sh

set -e

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PORT="22"
SSH_PASSWORD="tq6vJPwtZbOCW3kj"
APP_DIR="/opt/nexoscrm/backend"

export SSHPASS="$SSH_PASSWORD"

SSH_OPTIONS="-o StrictHostKeyChecking=accept-new -p $SERVER_PORT"
SCP_OPTIONS="-o StrictHostKeyChecking=accept-new -P $SERVER_PORT"

echo "🚀 Iniciando deploy do backend para $SERVER_IP..."

echo ""
echo "📁 Passo 1: Enviando arquivos do backend..."

COPYFILE_DISABLE=1 tar --exclude='./node_modules' \
    --exclude='./.git' \
    -czf /tmp/backend-deploy.tar.gz backend/

echo "   Arquivo criado: $(du -sh /tmp/backend-deploy.tar.gz | cut -f1)"

echo "   Enviando para o servidor..."
sshpass -e scp -o StrictHostKeyChecking=accept-new -P $SERVER_PORT /tmp/backend-deploy.tar.gz $SERVER_USER@$SERVER_IP:/opt/nexoscrm/backend-deploy.tar.gz

echo ""
echo "🔧 Passo 2: Extraindo no servidor..."
sshpass -e ssh -o StrictHostKeyChecking=accept-new -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /opt/nexoscrm

    # Limpar arquivos antigos do backend (preservando node_modules, .env, uploads)
    find backend -mindepth 1 \
        ! -name 'node_modules' \
        ! -name '.env' \
        ! -name '.env.production' \
        ! -name 'uploads' \
        ! -name 'logs' \
        -exec rm -rf {} + 2>/dev/null || true

    # Extrair arquivos — sobrescreve tudo que veio no tar
    tar -xzf backend-deploy.tar.gz backend
    rm backend-deploy.tar.gz

    echo "✅ Backend extraído"
ENDSSH

echo ""
echo "🐳 Passo 3: Rebuild e reinício do container..."
sshpass -e ssh -o StrictHostKeyChecking=accept-new -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    cd /opt/nexoscrm

    # Rebuild da imagem do backend e reiniciar
    docker compose -f docker-compose.production.yml build backend
    docker rm -f nexoscrm-backend 2>/dev/null || true
    docker compose -f docker-compose.production.yml up -d --no-deps backend

    echo "✅ Container rebuildado e reiniciado"
ENDSSH

echo ""
echo "✅ Deploy do backend concluído!"
echo "🌐 Acesse: http://$SERVER_IP"
