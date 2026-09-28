#!/bin/bash
# ============================================
# Deploy Simples - Sem Docker
# ============================================

echo "🚀 Deploy Simples do NexosCRM"
echo "============================="
echo ""

# Criar pacote otimizado
echo "📦 Criando pacote..."
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.md' \
    --exclude='*.sh' \
    --exclude='backups-preparados' \
    --exclude='docs' \
    --exclude='frontend/dist' \
    -czf nexoscrm-simple.tar.gz \
    backend/ \
    frontend/ \
    .env.production \
    package.json

echo "✅ Pacote criado: nexoscrm-simple.tar.gz"
echo ""

echo "📋 Execute estes comandos no servidor:"
echo ""
echo "# 1. Conectar ao servidor"
echo "ssh root@209.50.241.25"
echo ""
echo "# 2. Instalar Node.js e PostgreSQL"
echo "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
echo "apt-get install -y nodejs postgresql postgresql-contrib nginx"
echo ""
echo "# 3. Configurar PostgreSQL"
echo "sudo -u postgres createuser nexoscrm"
echo "sudo -u postgres createdb nexoscrm"
echo "sudo -u postgres psql -c \"ALTER USER nexoscrm PASSWORD '<DB_PASSWORD>';\""
echo "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE nexoscrm TO nexoscrm;\""
echo ""
echo "# 4. Criar diretório e baixar arquivos"
echo "mkdir -p /var/www/nexoscrm"
echo "cd /var/www/nexoscrm"
echo ""
echo "# 5. Sair e enviar arquivos"
echo "exit"
echo "scp nexoscrm-simple.tar.gz root@209.50.241.25:/var/www/nexoscrm/"
echo ""
echo "# 6. Conectar novamente e extrair"
echo "ssh root@209.50.241.25"
echo "cd /var/www/nexoscrm"
echo "tar -xzf nexoscrm-simple.tar.gz"
echo ""
echo "# 7. Configurar backend"
echo "cd backend"
echo "npm install --production"
echo "cp ../.env.production .env"
echo "npx prisma generate"
echo "npx prisma migrate deploy"
echo "node prisma/migrate-production.js"
echo ""
echo "# 8. Configurar frontend"
echo "cd ../frontend"
echo "npm install"
echo "npm run build"
echo ""
echo "# 9. Configurar Nginx"
cat > /etc/nginx/sites-available/nexoscrm << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root /var/www/nexoscrm/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Uploads
    location /uploads/ {
        proxy_pass http://localhost:3001;
    }
}
EOF
echo ""
echo "ln -s /etc/nginx/sites-available/nexoscrm /etc/nginx/sites-enabled/"
echo "rm -f /etc/nginx/sites-enabled/default"
echo "nginx -t && systemctl reload nginx"
echo ""
echo "# 10. Instalar PM2 e iniciar backend"
echo "npm install -g pm2"
echo "cd /var/www/nexoscrm/backend"
echo "pm2 start server.js --name nexoscrm-api"
echo "pm2 startup"
echo "pm2 save"
echo ""
echo "✅ Deploy concluído!"
echo "🌐 Acesse: http://209.50.241.25"