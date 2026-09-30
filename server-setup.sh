#!/bin/bash

# Script para executar NO SERVIDOR 72.60.195.200
# Configura e inicia o CRM na porta 8081
# ⚠️ NÃO AFETA O FINANÇAS ZEN (porta 80)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Configuração do CRM no Servidor${NC}"
echo -e "${GREEN}  Porta: 8081${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  VERIFICAÇÃO DE SEGURANÇA:${NC}"
echo "   ✅ Finanças Zen (porta 80) não será afetado"
echo "   ✅ CRM será instalado em diretório separado"
echo "   ✅ Processos PM2 independentes"
echo ""

# Verificar se está no diretório correto
if [ ! -d "apps/api" ]; then
    echo -e "${RED}❌ Erro: Execute este script em /var/www/crm-comercial${NC}"
    exit 1
fi

# Verificar se não estamos no diretório do Finanças Zen
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" == *"financaszen"* ]] || [[ "$CURRENT_DIR" == *"html"* ]]; then
    echo -e "${RED}❌ ERRO: Você está no diretório do Finanças Zen!${NC}"
    echo -e "${RED}   Execute este script em /var/www/crm-comercial${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Diretório correto: $CURRENT_DIR${NC}"
echo ""

# Solicitar informações do banco de dados
echo -e "${YELLOW}📋 Configuração do Banco de Dados${NC}"
echo ""
read -p "Nome do banco de dados [crm_comercial]: " DB_NAME
DB_NAME=${DB_NAME:-crm_comercial}

read -p "Usuário do banco [crm_user]: " DB_USER
DB_USER=${DB_USER:-crm_user}

read -sp "Senha do banco: " DB_PASS
echo ""

read -p "Host do banco [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Porta do banco [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}

# Gerar JWT Secret aleatório
JWT_SECRET=$(openssl rand -base64 32)

echo ""
echo -e "${YELLOW}🔧 Criando arquivo .env da API...${NC}"

# Criar .env da API
cat > apps/api/.env << EOF
NODE_ENV=production
PORT=8081
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public
JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=http://72.60.195.200:8081,http://localhost:8081
EOF

echo -e "${GREEN}✅ .env da API criado${NC}"

echo ""
echo -e "${YELLOW}🔧 Criando arquivo .env do Frontend...${NC}"

# Criar .env do Frontend
cat > apps/web/.env << EOF
VITE_API_URL=http://72.60.195.200:8081/api
EOF

echo -e "${GREEN}✅ .env do Frontend criado${NC}"

echo ""
echo -e "${YELLOW}📦 Instalando dependências da API...${NC}"
cd apps/api
npm install --production

echo ""
echo -e "${YELLOW}🔨 Gerando Prisma Client...${NC}"
npx prisma generate

echo ""
echo -e "${YELLOW}🗄️  Executando migrações do banco...${NC}"
npx prisma migrate deploy

echo ""
echo -e "${YELLOW}🌱 Populando banco com dados iniciais...${NC}"
npm run db:seed

echo ""
echo -e "${YELLOW}📦 Instalando dependências do Frontend...${NC}"
cd ../web
npm install

echo ""
echo -e "${YELLOW}🏗️  Fazendo build do Frontend...${NC}"
npm run build

echo ""
echo -e "${YELLOW}🚀 Configurando PM2...${NC}"
cd ../..

# Parar processo anterior se existir
pm2 stop crm-api 2>/dev/null || true
pm2 delete crm-api 2>/dev/null || true

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ CRM Configurado e Iniciado!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Informações:${NC}"
echo ""
echo "🌐 URL: http://72.60.195.200:8081"
echo "🔍 Health Check: http://72.60.195.200:8081/api/health"
echo ""
echo -e "${YELLOW}👤 Credenciais padrão:${NC}"
echo "  Admin: admin@crm.com / admin123"
echo "  Diretor: diretor@crm.com / diretor123"
echo "  Vendedor: vendedor@crm.com / vendedor123"
echo ""
echo -e "${YELLOW}📊 Comandos úteis:${NC}"
echo "  Ver logs: pm2 logs crm-api"
echo "  Status: pm2 status"
echo "  Reiniciar: pm2 restart crm-api"
echo "  Parar: pm2 stop crm-api"
echo ""
echo -e "${YELLOW}⚠️  Não esqueça de:${NC}"
echo "  1. Configurar o firewall: sudo ufw allow 8081/tcp"
echo "  2. Testar o acesso: curl http://localhost:8081/api/health"
echo "  3. Alterar as senhas padrão dos usuários"
echo ""
