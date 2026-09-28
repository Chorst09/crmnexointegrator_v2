#!/bin/bash
# ============================================
# Deploy Manual - Passo a Passo
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PORT="22"

echo "🚀 Deploy Manual do NexosCRM"
echo "============================"
echo ""
echo "📋 Instruções passo a passo:"
echo ""

# 1. Criar pacote
echo "1️⃣ Criando pacote da aplicação..."
tar --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./frontend/node_modules' \
    --exclude='./backend/node_modules' \
    --exclude='./apps/*/node_modules' \
    --exclude='./frontend/dist' \
    --exclude='./*.md' \
    --exclude='./*.sh' \
    --exclude='./backups-preparados' \
    --exclude='./docs' \
    -czf nexoscrm-deploy.tar.gz .

echo "✅ Pacote criado: nexoscrm-deploy.tar.gz ($(du -sh nexoscrm-deploy.tar.gz | cut -f1))"
echo ""

echo "2️⃣ Agora execute os comandos abaixo MANUALMENTE:"
echo ""
echo "# Conectar ao servidor:"
echo "ssh root@$SERVER_IP"
echo ""
echo "# Quando conectado, execute:"
echo "mkdir -p /opt/nexoscrm"
echo "cd /opt/nexoscrm"
echo ""
echo "# Instalar Docker (se necessário):"
echo "curl -fsSL https://get.docker.com | sh"
echo "systemctl enable docker"
echo "systemctl start docker"
echo ""
echo "# Instalar Docker Compose:"
echo "apt-get update"
echo "apt-get install -y docker-compose-plugin"
echo ""
echo "# Sair do servidor (exit) e enviar arquivos:"
echo "scp nexoscrm-deploy.tar.gz root@$SERVER_IP:/opt/nexoscrm/"
echo ""
echo "# Conectar novamente e extrair:"
echo "ssh root@$SERVER_IP"
echo "cd /opt/nexoscrm"
echo "tar -xzf nexoscrm-deploy.tar.gz"
echo "cp .env.production .env"
echo ""
echo "# Fazer deploy:"
echo "docker compose -f docker-compose.production.yml up -d --build"
echo ""
echo "# Aguardar e executar migrations:"
echo "sleep 30"
echo "docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy"
echo "docker compose -f docker-compose.production.yml exec backend node prisma/migrate-production.js"
echo ""
echo "✅ Deploy concluído!"
echo "🌐 Acesse: http://$SERVER_IP"
echo "📧 Login: admin@nexoscrm.com"
echo "🔑 Senha: <ADMIN_PASSWORD>"
