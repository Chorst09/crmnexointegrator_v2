#!/bin/bash
# Deploy para Produção - NEXOS CRM
# Servidor: 209.50.241.25:3026

set -e

echo "🚀 Iniciando Deploy em Produção..."
echo ""

# Conexão SSH
SERVER="root@209.50.241.25"
BACKEND_DIR="/var/www/crm-integrator"
FRONTEND_DIR="/var/www/nexoscrm/apps/web"

echo "📡 Conectando ao servidor..."
ssh $SERVER << 'ENDSSH'

echo "🔄 Atualizando Backend..."
cd /var/www/crm-integrator
git fetch origin
git pull origin main

echo "📦 Instalando dependências do backend (se necessário)..."
npm install --production

echo "🔄 Atualizando Frontend..."
cd /var/www/nexoscrm
git fetch origin
git pull origin main

echo "📦 Instalando dependências do frontend..."
cd apps/web
npm install

echo "🏗️ Building frontend..."
npm run build

echo "🔄 Reiniciando serviços PM2..."
pm2 restart nexoscrm-api || pm2 restart all

echo "✅ Deploy concluído!"
pm2 status

echo ""
echo "🔍 Testando API..."
curl -s http://localhost:3026/api/health | head -3

ENDSSH

echo ""
echo "✅ Deploy em produção finalizado!"
echo "🌐 Acesse: https://nexos.chorstconsult.com.br"
