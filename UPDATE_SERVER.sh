#!/bin/bash
echo "=== ATUALIZANDO SERVIDOR CRM ==="
echo "Servidor: 72.60.195.200"
echo "Domínio: https://crm.chorstconsult.com.br"
echo ""

# 1. Acessar diretório do projeto
cd /var/www/crm-comercial || { echo "Erro: Diretório não encontrado"; exit 1; }

# 2. Atualizar código
echo "1. Atualizando código do repositório..."
git pull origin main

# 3. API - Instalar dependências
echo "2. Instalando dependências da API..."
cd apps/api
npm install

# 4. API - Gerar cliente Prisma
echo "3. Gerando cliente Prisma..."
npm run db:generate

# 5. API - Aplicar migrações
echo "4. Aplicando migrações do banco de dados..."
npm run db:migrate:deploy

# 6. Frontend - Instalar dependências
echo "5. Instalando dependências do Frontend..."
cd ../web
npm install

# 7. Frontend - Build
echo "6. Build do Frontend..."
npm run build

# 8. Verificar permissões
echo "7. Verificando permissões..."
cd ../api
sudo chown -R www-data:www-data uploads 2>/dev/null || true
sudo chmod -R 755 uploads 2>/dev/null || true

# 9. Reiniciar serviços
echo "8. Reiniciando serviços..."
pm2 restart crm-api
sudo systemctl reload nginx

# 10. Testar
echo "9. Testando aplicação..."
echo ""
echo "Teste de saúde da API:"
curl -s http://localhost:3000/api/health || echo "API não respondeu"
echo ""
echo "=== ATUALIZAÇÃO CONCLUÍDA ==="
echo ""
echo "Para ver logs:"
echo "  pm2 logs crm-api --lines 50"
echo ""
echo "Para testar login:"
echo "  curl -X POST http://crm.chorstconsult.com.br/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"admin@crm.com\",\"password\":\"admin123\"}'"