#!/bin/bash
# ============================================
# Script de Deploy - NexosCRM
# Servidor: 209.50.241.25
# ============================================

set -e

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PORT="22"
APP_DIR="/opt/nexoscrm"

echo "🚀 Iniciando deploy do NexosCRM para $SERVER_IP..."

SSH_OPTIONS="-o StrictHostKeyChecking=accept-new -p $SERVER_PORT"
SCP_OPTIONS="-o StrictHostKeyChecking=accept-new -P $SERVER_PORT"

if [ -n "${SSHPASS:-}" ]; then
    SSH_CMD="sshpass -e ssh $SSH_OPTIONS"
    SCP_CMD="sshpass -e scp $SCP_OPTIONS"
else
    SSH_CMD="ssh $SSH_OPTIONS"
    SCP_CMD="scp $SCP_OPTIONS"
fi

echo ""
echo "📦 Passo 1: Preparando servidor..."
$SSH_CMD $SERVER_USER@$SERVER_IP << 'ENDSSH'
    # Instalar Docker se não existir
    if ! command -v docker &> /dev/null; then
        echo "Instalando Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
    fi

    # Instalar Docker Compose se não existir
    if ! command -v docker compose &> /dev/null; then
        echo "Instalando Docker Compose plugin..."
        apt-get update -qq
        apt-get install -y docker-compose-plugin
    fi

    # Criar diretório da aplicação
    mkdir -p /opt/nexoscrm
    echo "✅ Servidor preparado"
ENDSSH

echo ""
echo "📁 Passo 2: Enviando arquivos para o servidor..."

# Criar arquivo tar excluindo node_modules e arquivos desnecessários
COPYFILE_DISABLE=1 tar --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./test-login-admin.js' \
    --exclude='./frontend/node_modules' \
    --exclude='./backend/node_modules' \
    --exclude='./apps/*/node_modules' \
    --exclude='./frontend/dist' \
    --exclude='./*.md' \
    --exclude='./*.sh' \
    --exclude='./deploy-servidor.sh' \
    --exclude='./backups-preparados' \
    --exclude='./docs' \
    -czf /tmp/nexoscrm-deploy.tar.gz .

echo "   Arquivo criado: $(du -sh /tmp/nexoscrm-deploy.tar.gz | cut -f1)"

# Enviar para o servidor
$SCP_CMD /tmp/nexoscrm-deploy.tar.gz $SERVER_USER@$SERVER_IP:/opt/nexoscrm/

echo ""
echo "🔧 Passo 3: Extraindo e configurando no servidor..."
$SSH_CMD $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /opt/nexoscrm
    
    # Parar containers existentes se houver
    if [ -f docker-compose.production.yml ]; then
        docker compose -f docker-compose.production.yml down 2>/dev/null || true
    fi

    # Limpar arquivos antigos para que deleções locais também cheguem à produção.
    find . -mindepth 1 \
        ! -name '.env' \
        ! -name '.env.production' \
        ! -name 'nexoscrm-deploy.tar.gz' \
        -exec rm -rf {} +
    
    # Extrair arquivos
    tar -xzf nexoscrm-deploy.tar.gz
    rm nexoscrm-deploy.tar.gz
    
    # Preservar .env já existente no servidor, pois ele contém segredos reais de produção.
    if [ -f .env ]; then
        echo "✅ Usando .env existente do servidor"
    elif [ -f .env.production ]; then
        cp .env.production .env
    else
        echo "❌ Arquivo .env não encontrado em /opt/nexoscrm."
        echo "   Crie .env com DB_PASSWORD, DATABASE_URL, JWT_SECRET, CORS_ORIGIN e VITE_API_URL antes do deploy."
        exit 1
    fi
    
    echo "✅ Arquivos extraídos"
ENDSSH

echo ""
echo "🐳 Passo 4: Fazendo build e subindo containers..."
$SSH_CMD $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /opt/nexoscrm
    
    # Build e start
    docker compose -f docker-compose.production.yml --env-file .env up -d --build
    
    echo "⏳ Aguardando containers iniciarem..."
    sleep 15
    
    # Verificar status
    docker compose -f docker-compose.production.yml ps
ENDSSH

echo ""
echo "🗄️  Passo 5: Executando migrations do banco de dados..."
$SSH_CMD $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /opt/nexoscrm
    
    # Aguardar PostgreSQL estar pronto
    echo "Aguardando PostgreSQL..."
    sleep 10
    
    # Executar apenas migrations versionadas. Nunca usar db push em produção,
    # pois ele pode tentar alterações destrutivas em dados existentes.
    if docker compose -f docker-compose.production.yml exec -T backend test -d prisma/migrations; then
        docker compose -f docker-compose.production.yml exec -T backend npx prisma migrate deploy
    else
        echo "ℹ️  Nenhuma migration versionada encontrada; pulando etapa de migrations."
    fi
    
    echo "✅ Migrations executadas"
ENDSSH

echo ""
echo "👤 Passo 6: Executando setup inicial do sistema..."
$SSH_CMD $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /opt/nexoscrm
    
    # Executar setup inicial
    docker compose -f docker-compose.production.yml exec -T backend node prisma/migrate-production.js
    
    echo "✅ Setup inicial concluído"
ENDSSH

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "🌐 Acesse: http://$SERVER_IP"
echo "📧 Login:  admin@nexoscrm.com"
echo ""
echo "⚠️  Use a senha administrativa definida no ambiente seguro de produção."
