#!/bin/bash
# Script de deploy simples para o frontend

set -e

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PORT="22"
SSH_PASSWORD="tq6vJPwtZbOCW3kj"
APP_DIR="/opt/nexoscrm/apps/web"

# Configurar SSH com senha
export SSHPASS="$SSH_PASSWORD"

SSH_OPTIONS="-o StrictHostKeyChecking=accept-new -p $SERVER_PORT"
SCP_OPTIONS="-o StrictHostKeyChecking=accept-new -P $SERVER_PORT"

echo "🚀 Iniciando deploy do frontend para $SERVER_IP..."

echo ""
echo "📁 Passo 1: Enviando arquivos do frontend..."

# Criar arquivo tar do frontend excluindo node_modules e arquivos desnecessários
COPYFILE_DISABLE=1 tar --exclude='apps/web/node_modules' \
    --exclude='apps/web/.git' \
    --exclude='apps/web/dist' \
    --exclude='./*.md' \
    --exclude='./*.sh' \
    --exclude='./deploy-to-server.sh' \
    -czf /tmp/frontend-deploy.tar.gz apps/web/

echo "   Arquivo criado: $(du -sh /tmp/frontend-deploy.tar.gz | cut -f1)"

# Enviar para o servidor
echo "   Enviando para o servidor..."
sshpass -e scp -o StrictHostKeyChecking=accept-new -P $SERVER_PORT /tmp/frontend-deploy.tar.gz $SERVER_USER@$SERVER_IP:/opt/nexoscrm/frontend-deploy.tar.gz

echo ""
echo "🔧 Passo 2: Extraindo e configurando no servidor..."
sshpass -e ssh -o StrictHostKeyChecking=accept-new -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    cd /opt/nexoscrm

    # Limpar arquivos antigos do frontend
    find apps/web -mindepth 1 -maxdepth 1 \
        ! -name '.env' \
        ! -name '.env.example' \
        ! -name 'package.json' \
        ! -name 'package-lock.json' \
        ! -name 'vite.config.js' \
        ! -name 'postcss.config.js' \
        ! -name 'tailwind.config.js' \
        ! -name 'index.html' \
        ! -name 'README.md' \
        -exec rm -rf {} +
    
    # Extrair arquivos
    tar -xzf frontend-deploy.tar.gz apps/web
    rm frontend-deploy.tar.gz
    
    echo "✅ Frontend extraído"
ENDSSH

echo ""
echo "🐳 Passo 3: Fazendo build do frontend..."
sshpass -e ssh -o StrictHostKeyChecking=accept-new -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    cd /opt/nexoscrm/apps/web
    
    # Instalar dependências
    npm install
    
    # Fazer build
    npm run build
    
    echo "✅ Build concluído"
ENDSSH

echo ""
echo "🔄 Passo 4: Rebuild e reinício dos containers..."
sshpass -e ssh -o StrictHostKeyChecking=accept-new -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    cd /opt/nexoscrm
    
    # Rebuild da imagem do frontend e reiniciar
    docker compose -f docker-compose.production.yml build frontend
    docker compose -f docker-compose.production.yml up -d --no-deps frontend
    
    echo "✅ Containers rebuildados e reiniciados"
ENDSSH

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "🌐 Acesse: http://$SERVER_IP"
echo "📧 Login:  admin@nexoscrm.com"
echo ""
echo "⚠️  Use a senha administrativa definida no ambiente seguro de produção."
