#!/bin/bash

# Script de Deployment Automático - NexosCRM
# Uso: ./deploy.sh <servidor> <usuario>
# Exemplo: ./deploy.sh 209.50.241.25 root

set -e

SERVER=$1
USER=$2
REPO_PATH="/var/www/nexoscrm"

if [ -z "$SERVER" ] || [ -z "$USER" ]; then
    echo "Uso: ./deploy.sh <servidor> <usuario>"
    echo "Exemplo: ./deploy.sh 209.50.241.25 root"
    exit 1
fi

echo "🚀 Iniciando deployment para $SERVER..."

# Função para executar comando no servidor
run_remote() {
    ssh -o StrictHostKeyChecking=no "$USER@$SERVER" "$1"
}

# Passo 1: Preparar servidor
echo "📦 Passo 1: Preparando servidor..."
run_remote "mkdir -p $REPO_PATH"

# Passo 2: Copiar arquivos
echo "📁 Passo 2: Copiando arquivos..."
scp -r backend "$USER@$SERVER:$REPO_PATH/"
scp -r apps/web "$USER@$SERVER:$REPO_PATH/"
scp docker-compose.production.yml "$USER@$SERVER:$REPO_PATH/"
scp PRODUCTION_DEPLOYMENT.md "$USER@$SERVER:$REPO_PATH/"

# Passo 3: Iniciar PostgreSQL
echo "🐘 Passo 3: Iniciando PostgreSQL..."
run_remote "cd $REPO_PATH && docker-compose -f docker-compose.production.yml up -d"
run_remote "sleep 10"

# Passo 4: Configurar e iniciar Backend
echo "⚙️ Passo 4: Configurando Backend..."
run_remote "cd $REPO_PATH/backend && npm install"
run_remote "cd $REPO_PATH/backend && npm run db:push"
run_remote "cd $REPO_PATH/backend && npm run db:seed"
run_remote "cd $REPO_PATH/backend && pm2 start server.js --name 'nexoscrm-api' --env production"
run_remote "pm2 save"

# Passo 5: Build e Deploy Frontend
echo "🎨 Passo 5: Buildando Frontend..."
run_remote "cd $REPO_PATH/apps/web && npm install"
run_remote "cd $REPO_PATH/apps/web && npm run build"
run_remote "mkdir -p $REPO_PATH/public && cp -r $REPO_PATH/apps/web/dist/* $REPO_PATH/public/"

# Passo 6: Configurar Nginx
echo "🌐 Passo 6: Configurando Nginx..."
run_remote "cat > /etc/nginx/sites-available/nexoscrm << 'NGINX_EOF'
upstream backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name $SERVER;
    
    client_max_body_size 100M;
    
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;
    gzip_min_length 1000;
    
    location = /index.html {
        root $REPO_PATH/public;
        add_header Cache-Control \"no-store, no-cache, must-revalidate\" always;
        try_files /index.html =404;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        root $REPO_PATH/public;
        expires 1y;
        add_header Cache-Control \"public, max-age=31536000, immutable, no-transform\" always;
        add_header X-Content-Type-Options \"nosniff\" always;
        try_files \$uri =404;
    }

    location / {
        root $REPO_PATH/public;
        add_header Cache-Control \"no-store, no-cache, must-revalidate\" always;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
    
    location /uploads/ {
        alias $REPO_PATH/backend/uploads/;
        expires 30d;
    }
}
NGINX_EOF"

run_remote "ln -sf /etc/nginx/sites-available/nexoscrm /etc/nginx/sites-enabled/"
run_remote "rm -f /etc/nginx/sites-enabled/default"
run_remote "nginx -t"
run_remote "systemctl restart nginx"

# Passo 7: Verificar deployment
echo "✅ Passo 7: Verificando deployment..."
run_remote "curl -s http://localhost:3001/health | head -c 50"
echo ""
run_remote "curl -s http://localhost/health | head -c 50"
echo ""

echo ""
echo "✨ Deployment concluído com sucesso!"
echo ""
echo "📍 Acesse a aplicação em: http://$SERVER"
echo "📧 Email: admin@crm.com"
echo "🔑 Senha: admin123"
echo ""
echo "📊 Verificar logs:"
echo "   Backend: ssh $USER@$SERVER 'pm2 logs nexoscrm-api'"
echo "   Nginx: ssh $USER@$SERVER 'tail -f /var/log/nginx/error.log'"
echo ""
