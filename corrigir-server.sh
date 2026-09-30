#!/bin/bash
# ============================================
# Corrigir Server.js - ES Module Issue
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🔧 Corrigindo problema do ES Module no server.js..."

cat > fix_server.exp << 'EOF'
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
        send "cd /var/www/nexoscrm/backend\r"
        expect "# "
        
        send "echo '🔧 Removendo type module do package.json...'\r"
        expect "# "
        
        # Remover "type": "module" do package.json
        send "sed -i '/"type": "module",/d' package.json\r"
        expect "# "
        
        send "echo '📁 Verificando package.json...'\r"
        expect "# "
        
        send "grep -A5 -B5 'type' package.json || echo 'type module removido'\r"
        expect "# "
        
        send "echo '🔄 Parando PM2...'\r"
        expect "# "
        
        send "pm2 stop all\r"
        expect "# "
        
        send "pm2 delete all\r"
        expect "# "
        
        send "echo '🚀 Iniciando servidor...'\r"
        expect "# "
        
        send "NODE_ENV=production pm2 start server.js --name nexoscrm-api\r"
        expect "# "
        
        send "sleep 10\r"
        expect "# "
        
        send "pm2 status\r"
        expect "# "
        
        send "echo '🌐 Testando API...'\r"
        expect "# "
        
        send "curl -s http://localhost:3001/health\r"
        expect "# "
        
        send "echo '🔧 Corrigindo Nginx agora...'\r"
        expect "# "
        
        # Parar Apache se estiver rodando
        send "systemctl stop apache2 2>/dev/null || echo 'Apache não rodando'\r"
        expect "# "
        
        send "systemctl disable apache2 2>/dev/null || echo 'Apache não instalado'\r"
        expect "# "
        
        # Matar processos na porta 80
        send "fuser -k 80/tcp 2>/dev/null || echo 'Porta 80 livre'\r"
        expect "# "
        
        send "systemctl start nginx\r"
        expect "# "
        
        send "systemctl status nginx --no-pager -l | head -10\r"
        expect "# "
        
        send "echo '🌐 Testando site completo...'\r"
        expect "# "
        
        send "curl -s -I http://localhost/ | head -5\r"
        expect "# "
        
        send "echo '✅ Correção concluída!'\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x fix_server.exp

if command -v expect &> /dev/null; then
    ./fix_server.exp $SERVER_IP $SERVER_USER $SERVER_PASS
else
    echo "❌ expect não instalado. Instalando..."
    brew install expect
    ./fix_server.exp $SERVER_IP $SERVER_USER $SERVER_PASS
fi

rm -f fix_server.exp

echo ""
echo "🎉 DEPLOY FINALIZADO!"
echo ""
echo "🌐 Acesse: http://$SERVER_IP"
echo "📧 Login: admin@nexoscrm.com"
echo "🔑 Senha: <ADMIN_PASSWORD>"
echo ""
echo "🗄️ Banco PostgreSQL Integrator:"
echo "   Host: localhost:5433"
echo "   User: Chorst"
echo "   Database: nexoscrm"