#!/bin/bash
set -e

SERVER="root@72.60.195.200"
PROJECT_PATH="/var/www/crm-comercial"

echo "=== DEPLOY PARA SERVIDOR ==="
echo "Servidor: $SERVER"
echo "Projeto: $PROJECT_PATH"
echo ""

# 1. Conectar ao servidor e atualizar
echo "1. Conectando ao servidor e atualizando código..."
ssh $SERVER "cd $PROJECT_PATH && git pull origin main"

# 2. Instalar dependências da API
echo "2. Instalando dependências da API..."
ssh $SERVER "cd $PROJECT_PATH/apps/api && npm install"

# 3. Gerar cliente Prisma
echo "3. Gerando cliente Prisma..."
ssh $SERVER "cd $PROJECT_PATH/apps/api && npm run db:generate"

# 4. Aplicar migrações
echo "4. Aplicando migrações do banco de dados..."
ssh $SERVER "cd $PROJECT_PATH/apps/api && npm run db:migrate:deploy"

# 5. Instalar dependências do Frontend
echo "5. Instalando dependências do Frontend..."
ssh $SERVER "cd $PROJECT_PATH/apps/web && npm install"

# 6. Build do Frontend
echo "6. Build do Frontend..."
ssh $SERVER "cd $PROJECT_PATH/apps/web && npm run build"

# 7. Reiniciar API
echo "7. Reiniciando API..."
ssh $SERVER "pm2 restart crm-api"

# 8. Recarregar Nginx
echo "8. Recarregando Nginx..."
ssh $SERVER "sudo systemctl reload nginx"

# 9. Testar
echo "9. Testando aplicação..."
echo ""
echo "Teste de saúde da API:"
ssh $SERVER "curl -s http://localhost:3000/api/health || echo 'API não respondeu'"

echo ""
echo "=== DEPLOY CONCLUÍDO ==="
echo ""
echo "Acesse: https://crm.chorstconsult.com.br"
echo ""
echo "Para ver logs:"
echo "  ssh $SERVER 'pm2 logs crm-api --lines 50'"
echo ""