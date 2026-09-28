#!/bin/bash
# ============================================
# Configurar Banco PostgreSQL Integrator
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PASS="<SSH_PASSWORD>"

echo "🗄️ Configurando banco PostgreSQL do Integrator..."
echo "Credenciais:"
echo "  User: Chorst"
echo "  Password: <ADMIN_PASSWORD>"
echo "  Port: 5433"

cat > setup_integrator_db.exp << 'EOF'
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
        send "echo '🔍 Verificando conexão com PostgreSQL...'\r"
        expect "# "
        
        # Testar conexão com o banco
        send "PGPASSWORD='<ADMIN_PASSWORD>' psql -h localhost -p 5433 -U Chorst -d postgres -c '\\l'\r"
        expect "# "
        
        send "echo '🗄️ Criando banco nexoscrm se não existir...'\r"
        expect "# "
        
        # Criar banco nexoscrm
        send "PGPASSWORD='<ADMIN_PASSWORD>' psql -h localhost -p 5433 -U Chorst -d postgres -c \"CREATE DATABASE nexoscrm;\" 2>/dev/null || echo 'Banco já existe ou erro na criação'\r"
        expect "# "
        
        send "echo '✅ Verificando se banco nexoscrm foi criado...'\r"
        expect "# "
        
        send "PGPASSWORD='<ADMIN_PASSWORD>' psql -h localhost -p 5433 -U Chorst -d postgres -c \"\\l\" | grep nexoscrm\r"
        expect "# "
        
        send "echo '📁 Atualizando configurações da aplicação...'\r"
        expect "# "
        
        send "cd /var/www/nexoscrm\r"
        expect "# "
        
        # Atualizar .env com as credenciais corretas
        send "cat > .env << 'ENVEOF'\n# Backend Environment Variables - PRODUÇÃO\nNODE_ENV=production\nPORT=3001\nHOST=0.0.0.0\n\n# Database Configuration - Integrator PostgreSQL\nDATABASE_URL=postgresql://Chorst:<ADMIN_PASSWORD>@localhost:5433/nexoscrm?schema=public\n\n# JWT Configuration\nJWT_SECRET=<JWT_SECRET>\nJWT_EXPIRES_IN=7d\nJWT_REFRESH_SECRET=NexosCRM_Refresh_Secret_2024_Troque_Esta_Chave\nJWT_REFRESH_EXPIRES_IN=30d\n\n# CORS Configuration\nCORS_ORIGIN=http://209.50.241.25\n\n# File Upload Configuration\nMAX_FILE_SIZE=10485760\nUPLOAD_PATH=./uploads\n\n# Security\nBCRYPT_ROUNDS=12\nSESSION_SECRET=NexosCRM_Session_Secret_2024\n\n# Logging\nLOG_LEVEL=info\nLOG_FILE=logs/app.log\n\n# Rate Limiting\nRATE_LIMIT_WINDOW_MS=900000\nRATE_LIMIT_MAX_REQUESTS=100\nENVEOF\r"
        expect "# "
        
        send "cp .env backend/.env\r"
        expect "# "
        
        send "echo '🔄 Executando migrations do Prisma...'\r"
        expect "# "
        
        send "cd backend\r"
        expect "# "
        
        # Gerar Prisma Client
        send "npx prisma generate\r"
        expect "# "
        
        # Executar migrations
        send "npx prisma migrate deploy\r"
        expect "# "
        
        send "echo '👤 Criando usuário administrador...'\r"
        expect "# "
        
        # Executar script de setup inicial
        send "node prisma/migrate-production.js\r"
        expect "# "
        
        send "echo '🔄 Reiniciando aplicação...'\r"
        expect "# "
        
        # Reiniciar PM2
        send "pm2 restart nexoscrm-api\r"
        expect "# "
        
        send "pm2 status\r"
        expect "# "
        
        send "echo '🌐 Testando aplicação...'\r"
        expect "# "
        
        send "sleep 5\r"
        expect "# "
        
        send "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health || echo 'API não responde'\r"
        expect "# "
        
        send "echo '✅ Configuração do banco concluída!'\r"
        expect "# "
        
        send "exit\r"
    }
}

expect eof
EOF

chmod +x setup_integrator_db.exp

if command -v expect &> /dev/null; then
    ./setup_integrator_db.exp $SERVER_IP $SERVER_USER $SERVER_PASS
else
    echo "❌ expect não instalado. Instalando..."
    brew install expect
    ./setup_integrator_db.exp $SERVER_IP $SERVER_USER $SERVER_PASS
fi

rm -f setup_integrator_db.exp

echo ""
echo "🎉 Configuração concluída!"
echo ""
echo "🗄️ Banco PostgreSQL Integrator configurado:"
echo "   Host: localhost"
echo "   Port: 5433"
echo "   User: Chorst"
echo "   Database: nexoscrm"
echo ""
echo "🌐 Acesse: http://$SERVER_IP"
echo "📧 Login: admin@nexoscrm.com"
echo "🔑 Senha: <ADMIN_PASSWORD>"