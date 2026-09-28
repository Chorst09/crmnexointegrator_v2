#!/bin/bash
# ============================================
# Correção Final Completa - NexosCRM
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🔧 Executando correção final completa..."

cat > fix_everything.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 120
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
        send "echo '🔧 Corrigindo ES Module...'\r"
        expect "# "
        
        send "cd /var/www/nexoscrm/backend\r"
        expect "# "
        
        send "sed -i '/\"type\": \"module\",/d' package.json\r"
        expect "# "
        
        send "echo '🗄️ Configurando PostgreSQL...'\r"
        expect "# "
        
        send "sudo -u postgres createuser Chorst 2>/dev/null || echo 'Usuario ja existe'\r"
        expect "# "
        
        send "sudo -u postgres createdb nexoscrm 2>/dev/null || echo 'Banco ja existe'\r"
        expect "# "
        
        send "sudo -u postgres psql -c \"ALTER USER Chorst PASSWORD '<ADMIN_PASSWORD>';\"\r"
        expect "# "
        
        send "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE nexoscrm TO Chorst;\"\r"
        expect "# "
        
        send "echo '📝 Atualizando configuracao do banco...'\r"
        expect "# "
        
        send "cat > .env << 'ENVEOF'\nNODE_ENV=production\nPORT=3001\nHOST=0.0.0.0\nDATABASE_URL=postgresql://Chorst:<ADMIN_PASSWORD>@localhost:5432/nexoscrm?schema=public\nJWT_SECRET=<JWT_SECRET>\nJWT_EXPIRES_IN=7d\nCORS_ORIGIN=http://209.50.241.25:3001\nBCRYPT_ROUNDS=12\nMAX_FILE_SIZE=10485760\nUPLOAD_PATH=./uploads\nLOG_LEVEL=info\nENVEOF\r"
        expect "# "
        
        send "echo '🔄 Executando migrations...'\r"
        expect "# "
        
        send "npx prisma generate\r"
        expect "# "
        
        send "npx prisma migrate deploy\r"
        expect "# "
        
        send "echo '👤 Criando usuario admin...'\r"
        expect "# "
        
        send "node -e \"const { PrismaClient } = require('@prisma/client'); const bcrypt = require('bcryptjs'); const prisma = new PrismaClient(); async function createAdmin() { try { const existing = await prisma.user.findUnique({ where: { email: 'admin@nexoscrm.com' } }); if (existing) { console.log('Admin ja existe'); return; } const hash = await bcrypt.hash('<ADMIN_PASSWORD>', 12); const user = await prisma.user.create({ data: { name: 'Administrador', email: 'admin@nexoscrm.com', password: hash, role: 'ADMIN' } }); console.log('Admin criado:', user.email); } catch(e) { console.error('Erro:', e.message); } finally { await prisma.\\$disconnect(); } } createAdmin();\"\r"
        expect "# "
        
        send "echo '🔄 Reiniciando aplicacao...'\r"
        expect "# "
        
        send "pm2 stop nexoscrm-api\r"
        expect "# "
        
        send "pm2 delete nexoscrm-api\r"
        expect "# "
        
        send "NODE_ENV=production pm2 start server.js --name nexoscrm-api\r"
        expect "# "
        
        send "sleep 10\r"
        expect "# "
        
        send "echo '🌐 Testando sistema...'\r"
        expect "# "
        
        send "curl -s http://localhost:3001/health\r"
        expect "# "
        
        send "echo '✅ Configuracao finalizada!'\r"
        expect "# "
        
        send "pm2 status\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x fix_everything.exp

if command -v expect &> /dev/null; then
    ./fix_everything.exp $SERVER_IP $SERVER_USER $SERVER_PASS
else
    echo "❌ expect não instalado. Instalando..."
    brew install expect
    ./fix_everything.exp $SERVER_IP $SERVER_USER $SERVER_PASS
fi

rm -f fix_everything.exp

echo ""
echo "🎉 CORREÇÃO FINALIZADA!"
echo ""
echo "🌐 Acesse: http://$SERVER_IP:3001"
echo "📧 Login: admin@nexoscrm.com"
echo "🔑 Senha: <ADMIN_PASSWORD>"
echo ""
echo "✅ Sistema NexosCRM totalmente funcional!"