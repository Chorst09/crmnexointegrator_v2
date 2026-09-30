#!/bin/bash
# ============================================
# Deploy Automático - Usando expect
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🚀 Deploy Automático do NexosCRM"
echo "================================"

# Verificar se expect está instalado
if ! command -v expect &> /dev/null; then
    echo "📦 Instalando expect..."
    if command -v brew &> /dev/null; then
        brew install expect
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y expect
    else
        echo "❌ Instale expect manualmente e execute novamente"
        exit 1
    fi
fi

# Criar script expect
cat > deploy_expect.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 300
set server_ip [lindex $argv 0]
set server_user [lindex $argv 1]
set server_pass [lindex $argv 2]

# Conectar ao servidor
spawn ssh -o StrictHostKeyChecking=no $server_user@$server_ip

expect {
    "password:" {
        send "$server_pass\r"
        exp_continue
    }
    "# " {
        # Instalar dependências
        send "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -\r"
        expect "# "
        
        send "apt-get install -y nodejs postgresql postgresql-contrib nginx\r"
        expect "# "
        
        # Configurar PostgreSQL
        send "sudo -u postgres createuser nexoscrm 2>/dev/null || true\r"
        expect "# "
        
        send "sudo -u postgres createdb nexoscrm 2>/dev/null || true\r"
        expect "# "
        
        send "sudo -u postgres psql -c \"ALTER USER nexoscrm PASSWORD '<DB_PASSWORD>';\"\r"
        expect "# "
        
        send "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE nexoscrm TO nexoscrm;\"\r"
        expect "# "
        
        # Criar diretório
        send "mkdir -p /var/www/nexoscrm\r"
        expect "# "
        
        send "cd /var/www/nexoscrm\r"
        expect "# "
        
        # Sair para enviar arquivos
        send "exit\r"
    }
}

expect eof
EOF

chmod +x deploy_expect.exp

echo "📦 Executando instalação no servidor..."
./deploy_expect.exp $SERVER_IP $SERVER_USER $SERVER_PASS

echo "📤 Enviando arquivos..."
scp nexoscrm-simple.tar.gz root@$SERVER_IP:/var/www/nexoscrm/

# Script para configurar aplicação
cat > configure_app.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 300
set server_ip [lindex $argv 0]
set server_user [lindex $argv 1]
set server_pass [lindex $argv 2]

spawn ssh -o StrictHostKeyChecking=no $server_user@$server_ip

expect {
    "password:" {
        send "$server_pass\r"
        exp_continue
    }
    "# " {
        send "cd /var/www/nexoscrm\r"
        expect "# "
        
        send "tar -xzf nexoscrm-simple.tar.gz\r"
        expect "# "
        
        # Backend
        send "cd backend\r"
        expect "# "
        
        send "npm install --production\r"
        expect "# "
        
        send "cp ../.env.production .env\r"
        expect "# "
        
        send "npx prisma generate\r"
        expect "# "
        
        send "npx prisma migrate deploy\r"
        expect "# "
        
        send "node prisma/migrate-production.js\r"
        expect "# "
        
        # Frontend
        send "cd ../frontend\r"
        expect "# "
        
        send "npm install\r"
        expect "# "
        
        send "VITE_API_URL=http://209.50.241.25/api npm run build\r"
        expect "# "
        
        # PM2
        send "npm install -g pm2\r"
        expect "# "
        
        send "cd ../backend\r"
        expect "# "
        
        send "pm2 start server.js --name nexoscrm-api\r"
        expect "# "
        
        send "pm2 startup\r"
        expect "# "
        
        send "pm2 save\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x configure_app.exp

echo "⚙️ Configurando aplicação..."
./configure_app.exp $SERVER_IP $SERVER_USER $SERVER_PASS

echo "🌐 Configurando Nginx..."
scp COMANDOS_SERVIDOR.txt root@$SERVER_IP:/tmp/

# Configurar Nginx
cat > setup_nginx.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 60
set server_ip [lindex $argv 0]
set server_user [lindex $argv 1]
set server_pass [lindex $argv 2]

spawn ssh -o StrictHostKeyChecking=no $server_user@$server_ip

expect {
    "password:" {
        send "$server_pass\r"
        exp_continue
    }
    "# " {
        send "cat > /etc/nginx/sites-available/nexoscrm << 'EOFNGINX'\nserver {\n    listen 80;\n    server_name _;\n    \n    location / {\n        root /var/www/nexoscrm/frontend/dist;\n        try_files \$uri \$uri/ /index.html;\n    }\n    \n    location /api/ {\n        proxy_pass http://localhost:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \$http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n    }\n    \n    location /uploads/ {\n        proxy_pass http://localhost:3001;\n    }\n}\nEOFNGINX\r"
        expect "# "
        
        send "ln -s /etc/nginx/sites-available/nexoscrm /etc/nginx/sites-enabled/\r"
        expect "# "
        
        send "rm -f /etc/nginx/sites-enabled/default\r"
        expect "# "
        
        send "nginx -t && systemctl reload nginx\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x setup_nginx.exp
./setup_nginx.exp $SERVER_IP $SERVER_USER $SERVER_PASS

# Limpar arquivos temporários
rm -f deploy_expect.exp configure_app.exp setup_nginx.exp

echo ""
echo "✅ Deploy concluído!"
echo "🌐 Acesse: http://$SERVER_IP"
echo "📧 Login: admin@nexoscrm.com"
echo "🔑 Senha: <ADMIN_PASSWORD>"