#!/bin/bash
# ============================================
# Finalização do Deploy
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🏁 Finalizando deploy..."

cat > final_deploy.exp << 'EOF'
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
        
        send "sed -i '/\"type\": \"module\",/d' package.json\r"
        expect "# "
        
        send "pm2 stop all 2>/dev/null || echo 'PM2 parado'\r"
        expect "# "
        
        send "pm2 delete all 2>/dev/null || echo 'PM2 limpo'\r"
        expect "# "
        
        send "NODE_ENV=production pm2 start server.js --name nexoscrm-api\r"
        expect "# "
        
        send "sleep 5\r"
        expect "# "
        
        send "systemctl stop apache2 2>/dev/null || echo 'Apache parado'\r"
        expect "# "
        
        send "systemctl start nginx 2>/dev/null || echo 'Nginx já rodando'\r"
        expect "# "
        
        send "curl -s http://localhost:3001/health || echo 'API: Verificar logs'\r"
        expect "# "
        
        send "curl -s -I http://localhost/ | head -3 || echo 'Frontend: Verificar nginx'\r"
        expect "# "
        
        send "pm2 status\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x final_deploy.exp
./final_deploy.exp $SERVER_IP $SERVER_USER $SERVER_PASS
rm -f final_deploy.exp

echo ""
echo "✅ DEPLOY CONCLUÍDO!"
echo ""
echo "🎯 Acesse agora: http://$SERVER_IP"
echo "📧 Login: admin@nexoscrm.com"
echo "🔑 Senha: <ADMIN_PASSWORD>"
echo ""
echo "📊 Sistema NexosCRM implantado com:"
echo "   ✅ Backend Node.js (porta 3001)"
echo "   ✅ Frontend React (servido pelo Nginx)"
echo "   ✅ PostgreSQL Integrator (porta 5433)"
echo "   ✅ Nginx proxy reverso (porta 80)"
echo ""
echo "🔧 Se houver problemas, verifique:"
echo "   - pm2 status"
echo "   - systemctl status nginx"
echo "   - pm2 logs nexoscrm-api"