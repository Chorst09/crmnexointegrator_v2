#!/bin/bash

# Script que configura o banco de dados E instala o CRM

set -e

echo "=========================================="
echo "  Setup Completo: Banco + CRM"
echo "=========================================="
echo ""

# Verificar se está no diretório correto
if [ ! -d "apps/api" ]; then
    echo "❌ Erro: Execute em /var/www/crm-comercial"
    exit 1
fi

echo "✅ Diretório correto"
echo ""

# Solicitar informações
echo "📋 Configuração do Banco de Dados"
echo ""
read -p "Nome do banco [crm_comercial]: " DB_NAME
DB_NAME=${DB_NAME:-crm_comercial}

read -p "Usuário do banco [crm_user]: " DB_USER
DB_USER=${DB_USER:-crm_user}

read -sp "Senha do banco: " DB_PASS
echo ""

# Gerar JWT Secret
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "TROQUE-POR-UM-SEGREDO-FORTE-$(date +%s)")

echo ""
echo "🗄️  Criando banco de dados..."

# Criar banco e usuário
sudo -u postgres psql << PSQL_EOF
-- Verificar se o banco já existe
SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';

-- Se não existir, criar
CREATE DATABASE $DB_NAME;

-- Verificar se o usuário já existe
SELECT 1 FROM pg_user WHERE usename = '$DB_USER';

-- Se não existir, criar
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Conectar ao banco e dar permissões nas schemas
\c $DB_NAME
GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER;
PSQL_EOF

echo "✅ Banco de dados criado"
echo ""

echo "🔧 Configurando API..."

# Criar .env da API
cat > apps/api/.env << EOF
NODE_ENV=production
PORT=8081
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public
JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=http://72.60.195.200:8081,http://localhost:8081
EOF

echo "✅ .env da API criado"

# Criar .env do Frontend
cat > apps/web/.env << EOF
VITE_API_URL=http://72.60.195.200:8081/api
EOF

echo "✅ .env do Frontend criado"
echo ""

# Criar ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crm-api',
    cwd: '/var/www/crm-comercial/apps/api',
    script: 'server.cjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    error_file: '/var/www/crm-comercial/logs/api-error.log',
    out_file: '/var/www/crm-comercial/logs/api-out.log',
    log_file: '/var/www/crm-comercial/logs/api-combined.log',
    time: true
  }]
};
EOF

echo "✅ ecosystem.config.js criado"
echo ""

echo "📦 Instalando dependências da API..."
cd apps/api
npm install --production

echo ""
echo "🔨 Gerando Prisma Client..."
npx prisma generate

echo ""
echo "🗄️  Executando migrações..."
npx prisma migrate deploy

echo ""
echo "🌱 Populando banco com dados iniciais..."
npm run db:seed || echo "⚠️  Seed falhou, mas continuando..."

echo ""
echo "📦 Instalando dependências do Frontend..."
cd ../web
npm install

echo ""
echo "🏗️  Fazendo build do Frontend..."
npm run build

echo ""
echo "🚀 Iniciando com PM2..."
cd ../..

pm2 stop crm-api 2>/dev/null || true
pm2 delete crm-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "=========================================="
echo "  ✅ CRM Instalado com Sucesso!"
echo "=========================================="
echo ""
echo "🌐 URL: http://72.60.195.200:8081"
echo ""
echo "👤 Credenciais Padrão:"
echo "  Admin: admin@crm.com / admin123"
echo "  Diretor: diretor@crm.com / diretor123"
echo "  Vendedor: vendedor@crm.com / vendedor123"
echo ""
echo "📊 Comandos Úteis:"
echo "  pm2 logs crm-api    - Ver logs"
echo "  pm2 restart crm-api - Reiniciar"
echo "  pm2 status          - Ver status"
echo ""
echo "⚠️  Próximo passo:"
echo "  sudo ufw allow 8081/tcp"
echo ""
