#!/bin/bash
# ============================================
# Diagnosticar e Corrigir API
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🔍 Diagnosticando problemas da API..."

cat > diagnose_api.exp << 'EOF'
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
        
        send "echo '📋 Verificando logs do PM2...'\r"
        expect "# "
        
        send "pm2 logs nexoscrm-api --lines 20\r"
        expect "# "
        
        send "echo '🔍 Verificando se a porta 3001 está sendo usada...'\r"
        expect "# "
        
        send "netstat -tlnp | grep 3001\r"
        expect "# "
        
        send "echo '📁 Verificando arquivos de configuração...'\r"
        expect "# "
        
        send "ls -la .env\r"
        expect "# "
        
        send "echo '🗄️ Testando conexão com banco...'\r"
        expect "# "
        
        send "PGPASSWORD='<ADMIN_PASSWORD>' psql -h localhost -p 5433 -U Chorst -d nexoscrm -c 'SELECT 1;' 2>/dev/null || echo 'Erro na conexão com banco'\r"
        expect "# "
        
        send "echo '🔄 Parando e reiniciando API...'\r"
        expect "# "
        
        send "pm2 stop nexoscrm-api\r"
        expect "# "
        
        send "pm2 delete nexoscrm-api\r"
        expect "# "
        
        send "echo '🚀 Iniciando API novamente...'\r"
        expect "# "
        
        send "NODE_ENV=production pm2 start server.js --name nexoscrm-api\r"
        expect "# "
        
        send "sleep 10\r"
        expect "# "
        
        send "pm2 status\r"
        expect "# "
        
        send "echo '🌐 Testando API...'\r"
        expect "# "
        
        send "curl -v http://localhost:3001/health\r"
        expect "# "
        
        send "echo '🔧 Se ainda não funcionar, vamos tentar iniciar manualmente...'\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x diagnose_api.exp

if command -v expect &> /dev/null; then
    ./diagnose_api.exp $SERVER_IP $SERVER_USER $SERVER_PASS
else
    echo "❌ expect não instalado. Instalando..."
    brew install expect
    ./diagnose_api.exp $SERVER_IP $SERVER_USER $SERVER_PASS
fi

rm -f diagnose_api.exp

echo ""
echo "🔧 Se a API ainda não estiver funcionando, vamos corrigir o nginx também..."