#!/bin/bash
set -e

SERVER="root@72.60.195.200"
PROJECT_PATH="/var/www/crm-comercial"

echo "=== DEPLOY MANUAL PARA SERVIDOR KVM ==="
echo "Servidor: $SERVER"
echo "Projeto: $PROJECT_PATH"
echo ""

# 1. Build do Frontend localmente
echo "1. Fazendo build do frontend localmente..."
cd apps/web
npm run build
cd ../..

# 2. Criar arquivo tar.gz com os arquivos necessários
echo "2. Criando pacote de deploy..."
tar -czf crm-deploy-$(date +%Y%m%d-%H%M%S).tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='tmp' \
  --exclude='*.tar.gz' \
  apps/web/dist/ \
  apps/api/

echo "3. Enviando arquivos para o servidor..."
scp crm-deploy-*.tar.gz $SERVER:/tmp/

# 4. Descompactar e atualizar no servidor
echo "4. Atualizando arquivos no servidor..."
ssh $SERVER << 'ENDSSH'
cd /tmp
LATEST_DEPLOY=$(ls -t crm-deploy-*.tar.gz | head -1)
echo "Descompactando $LATEST_DEPLOY..."

# Backup do dist atual
if [ -d /var/www/crm-comercial/apps/web/dist ]; then
  mv /var/www/crm-comercial/apps/web/dist /var/www/crm-comercial/apps/web/dist.backup.$(date +%Y%m%d-%H%M%S)
fi

# Extrair novos arquivos
tar -xzf $LATEST_DEPLOY -C /var/www/crm-comercial/

# Instalar dependências da API (se necessário)
cd /var/www/crm-comercial/apps/api
npm install --production

# Reiniciar API
pm2 restart crm-api

# Limpar arquivos temporários
rm /tmp/crm-deploy-*.tar.gz

echo "Deploy concluído!"
ENDSSH

echo ""
echo "=== DEPLOY CONCLUÍDO ==="
echo ""
echo "Acesse: http://72.60.195.200:8081"
echo ""
echo "Para ver logs:"
echo "  ssh $SERVER 'pm2 logs crm-api --lines 50'"
echo ""
