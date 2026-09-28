#!/bin/bash

# COPIE E COLE ESTE SCRIPT INTEIRO NO SERVIDOR
# Depois execute: bash INSTALAR_NO_SERVIDOR.sh

set -e

echo "=========================================="
echo "  Instalação do CRM - Porta 8081"
echo "=========================================="
echo ""

# Verificar se está no diretório correto
if [ ! -d "apps/api" ]; then
    echo "❌ Erro: Execute em /var/www/crm-comercial"
    exit 1
fi

echo "✅ Diretório correto"
echo ""

# Solicitar informações do banco
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

# Criar diretório de logs
mkdir -p logs

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

# Parar processo anterior se existir
pm2 stop crm-api 2>/dev/null || true
pm2 delete crm-api 2>/dev/null || true

# Iniciar
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "=========================================="
echo "  ✅ CRM Instalado com Sucesso!"
echo "=========================================="
echo ""
echo "🌐 URL: http://72.60.195.200:8081"
echo ""
echo "👤 Credenciais:"
echo "  Admin: admin@crm.com / admin123"
echo "  Diretor: diretor@crm.com / diretor123"
echo "  Vendedor: vendedor@crm.com / vendedor123"
echo ""
echo "📊 Comandos úteis:"
echo "  pm2 logs crm-api    - Ver logs"
echo "  pm2 restart crm-api - Reiniciar"
echo "  pm2 status          - Ver status"
echo ""
echo "⚠️  Não esqueça:"
echo "  sudo ufw allow 8081/tcp"
echo ""
