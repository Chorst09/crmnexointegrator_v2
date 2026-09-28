#!/bin/bash
# ============================================
# Correção Final do Nginx
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🔧 Corrigindo configuração final do Nginx..."

cat > fix_nginx_final.exp << 'EOF'
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
        send "echo '🔍 Verificando configuração atual do Nginx...'\r"
        expect "# "
        
        send "ls -la /etc/nginx/sites-enabled/\r"
        expect "# "
        
        send "cat /etc/nginx/sites-available/nexoscrm\r"
        expect "# "
        
        send "echo '📁 Verificando se frontend foi buildado...'\r"
        expect "# "
        
        send "ls -la /var/www/nexoscrm/frontend/\r"
        expect "# "
        
        send "ls -la /var/www/nexoscrm/frontend/dist/ 2>/dev/null || echo 'Frontend não buildado'\r"
        expect "# "
        
        send "echo '🏗️ Fazendo build do frontend...'\r"
        expect "# "
        
        send "cd /var/www/nexoscrm/frontend\r"
        expect "# "
        
        send "VITE_API_URL=http://209.50.241.25/api npm run build\r"
        expect "# "
        
        send "ls -la dist/\r"
        expect "# "
        
        send "echo '🔧 Recriando configuração do Nginx...'\r"
        expect "# "
        
        send "cat > /etc/nginx/sites-available/nexoscrm << 'NGINXEOF'\nserver {\n    listen 80;\n    server_name _;\n    root /var/www/nexoscrm/frontend/dist;\n    index index.html;\n    \n    # Frontend - SPA routing\n    location / {\n        try_files \\$uri \\$uri/ /index.html;\n    }\n    \n    # API proxy\n    location /api/ {\n        proxy_pass http://localhost:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \\$http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host \\$host;\n        proxy_set_header X-Real-IP \\$remote_addr;\n        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \\$scheme;\n        proxy_cache_bypass \\$http_upgrade;\n    }\n    \n    # Uploads\n    location /uploads/ {\n        proxy_pass http://localhost:3001;\n        proxy_set_header Host \\$host;\n    }\n    \n    # Static files caching\n    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)\\$ {\n        expires 1y;\n        add_header Cache-Control \"public, immutable\";\n    }\n}\nNGINXEOF\r"
        expect "# "
        
        send "echo '🔄 Testando configuração do Nginx...'\r"
        expect "# "
        
        send "nginx -t\r"
        expect "# "
        
        send "echo '🔄 Reiniciando Nginx...'\r"
        expect "# "
        
        send "systemctl reload nginx\r"
        expect "# "
        
        send "systemctl status nginx --no-pager -l | head -10\r"
        expect "# "
        
        send "echo '🌐 Testando acesso...'\r"
        expect "# "
        
        send "curl -s -I http://localhost/ | head -5\r"
        expect "# "
        
        send "curl -s http://localhost/ | head -10\r"
        expect "# "
        
        send "echo '✅ Correção finalizada!'\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x fix_nginx_final.exp

if command -v expect &> /dev/null; then
    ./fix_nginx_final.exp $SERVER_IP $SERVER_USER $SERVER_PASS
else
    echo "❌ expect não instalado. Instalando..."
    brew install expect
    ./fix_nginx_final.exp $SERVER_IP $SERVER_USER $SERVER_PASS
fi

rm -f fix_nginx_final.exp

echo ""
echo "🎯 Teste novamente: http://$SERVER_IP"
echo ""
echo "Se ainda não funcionar, o problema pode ser:"
echo "1. Frontend não foi buildado corretamente"
echo "2. Nginx não está apontando para o diretório correto"
echo "3. Permissões de arquivo"