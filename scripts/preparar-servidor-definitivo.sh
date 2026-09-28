#!/bin/bash

# ============================================
# Script de Preparação do Servidor Definitivo
# ============================================
# Instala e configura todas as dependências
# necessárias para o CRM
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Preparação do Servidor Definitivo${NC}"
echo -e "${BLUE}  CRM Comercial${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Detectar sistema operacional
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}Não foi possível detectar o sistema operacional${NC}"
    exit 1
fi

echo -e "Sistema detectado: ${GREEN}$PRETTY_NAME${NC}"
echo ""

# Verificar se é root ou tem sudo
if [ "$EUID" -ne 0 ]; then 
    if ! command -v sudo > /dev/null 2>&1; then
        echo -e "${RED}Este script precisa ser executado como root ou com sudo${NC}"
        exit 1
    fi
    SUDO="sudo"
else
    SUDO=""
fi

# Função para instalar pacotes
install_package() {
    local package=$1
    echo -n "Instalando $package... "
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        $SUDO apt-get install -y $package > /dev/null 2>&1
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        $SUDO yum install -y $package > /dev/null 2>&1
    fi
    
    echo -e "${GREEN}✓${NC}"
}

# 1. Atualizar sistema
echo -e "${YELLOW}[1/8] Atualizando sistema...${NC}"
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    $SUDO apt-get update > /dev/null 2>&1
    echo -e "${GREEN}✓ Sistema atualizado${NC}"
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    $SUDO yum update -y > /dev/null 2>&1
    echo -e "${GREEN}✓ Sistema atualizado${NC}"
fi
echo ""

# 2. Instalar dependências básicas
echo -e "${YELLOW}[2/8] Instalando dependências básicas...${NC}"
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    install_package "curl"
    install_package "wget"
    install_package "git"
    install_package "build-essential"
    install_package "jq"
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    install_package "curl"
    install_package "wget"
    install_package "git"
    install_package "gcc-c++"
    install_package "make"
    install_package "jq"
fi
echo ""

# 3. Instalar Node.js via NVM
echo -e "${YELLOW}[3/8] Instalando Node.js...${NC}"
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js já instalado: $NODE_VERSION${NC}"
else
    echo "Instalando NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash > /dev/null 2>&1
    
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    echo "Instalando Node.js 18..."
    nvm install 18 > /dev/null 2>&1
    nvm use 18 > /dev/null 2>&1
    nvm alias default 18 > /dev/null 2>&1
    
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js instalado: $NODE_VERSION${NC}"
fi
echo ""

# 4. Instalar PM2
echo -e "${YELLOW}[4/8] Instalando PM2...${NC}"
if command -v pm2 > /dev/null 2>&1; then
    PM2_VERSION=$(pm2 --version)
    echo -e "${GREEN}✓ PM2 já instalado: $PM2_VERSION${NC}"
else
    npm install -g pm2 > /dev/null 2>&1
    PM2_VERSION=$(pm2 --version)
    echo -e "${GREEN}✓ PM2 instalado: $PM2_VERSION${NC}"
fi
echo ""

# 5. Instalar PostgreSQL
echo -e "${YELLOW}[5/8] Instalando PostgreSQL...${NC}"
if command -v psql > /dev/null 2>&1; then
    PG_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}✓ PostgreSQL já instalado: $PG_VERSION${NC}"
else
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        install_package "postgresql"
        install_package "postgresql-contrib"
        $SUDO systemctl start postgresql
        $SUDO systemctl enable postgresql
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        install_package "postgresql-server"
        install_package "postgresql-contrib"
        $SUDO postgresql-setup initdb
        $SUDO systemctl start postgresql
        $SUDO systemctl enable postgresql
    fi
    
    PG_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}✓ PostgreSQL instalado: $PG_VERSION${NC}"
fi
echo ""

# 6. Configurar PostgreSQL
echo -e "${YELLOW}[6/8] Configurando PostgreSQL...${NC}"

# Solicitar senha para o usuário do banco
read -sp "Digite a senha para o usuário 'crm_user' do PostgreSQL: " DB_PASSWORD
echo ""

# Criar usuário e banco
$SUDO -u postgres psql << EOF > /dev/null 2>&1
-- Criar usuário se não existir
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'crm_user') THEN
        CREATE USER crm_user WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Criar banco se não existir
SELECT 'CREATE DATABASE crm_comercial OWNER crm_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_comercial')\gexec

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE crm_comercial TO crm_user;
EOF

echo -e "${GREEN}✓ Usuário 'crm_user' e banco 'crm_comercial' configurados${NC}"

# Salvar DATABASE_URL em arquivo temporário
echo "postgresql://crm_user:$DB_PASSWORD@localhost:5432/crm_comercial" > /tmp/crm_database_url.txt
chmod 600 /tmp/crm_database_url.txt
echo -e "${BLUE}DATABASE_URL salva em: /tmp/crm_database_url.txt${NC}"
echo ""

# 7. Configurar Firewall
echo -e "${YELLOW}[7/8] Configurando firewall...${NC}"

if command -v ufw > /dev/null 2>&1; then
    # UFW (Ubuntu/Debian)
    $SUDO ufw allow 22/tcp > /dev/null 2>&1 || true
    $SUDO ufw allow 80/tcp > /dev/null 2>&1 || true
    $SUDO ufw allow 443/tcp > /dev/null 2>&1 || true
    $SUDO ufw allow 8081/tcp > /dev/null 2>&1 || true
    
    # Ativar UFW se não estiver ativo
    echo "y" | $SUDO ufw enable > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✓ Firewall UFW configurado${NC}"
    echo -e "   - Porta 22 (SSH): ${GREEN}✓${NC}"
    echo -e "   - Porta 80 (HTTP): ${GREEN}✓${NC}"
    echo -e "   - Porta 443 (HTTPS): ${GREEN}✓${NC}"
    echo -e "   - Porta 8081 (CRM): ${GREEN}✓${NC}"
    
elif command -v firewall-cmd > /dev/null 2>&1; then
    # Firewalld (CentOS/RHEL)
    $SUDO firewall-cmd --permanent --add-service=ssh > /dev/null 2>&1
    $SUDO firewall-cmd --permanent --add-service=http > /dev/null 2>&1
    $SUDO firewall-cmd --permanent --add-service=https > /dev/null 2>&1
    $SUDO firewall-cmd --permanent --add-port=8081/tcp > /dev/null 2>&1
    $SUDO firewall-cmd --reload > /dev/null 2>&1
    
    echo -e "${GREEN}✓ Firewall configurado${NC}"
else
    echo -e "${YELLOW}⚠️  Firewall não detectado${NC}"
fi
echo ""

# 8. Criar estrutura de diretórios
echo -e "${YELLOW}[8/8] Criando estrutura de diretórios...${NC}"
$SUDO mkdir -p /var/www/crm-comercial
$SUDO chown -R $USER:$USER /var/www/crm-comercial
echo -e "${GREEN}✓ Diretório /var/www/crm-comercial criado${NC}"
echo ""

# Resumo final
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Servidor Preparado com Sucesso!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Informações importantes:${NC}"
echo ""
echo -e "📦 Software instalado:"
echo -e "   - Node.js: ${GREEN}$(node --version)${NC}"
echo -e "   - NPM: ${GREEN}$(npm --version)${NC}"
echo -e "   - PM2: ${GREEN}$(pm2 --version)${NC}"
echo -e "   - PostgreSQL: ${GREEN}$(psql --version | awk '{print $3}')${NC}"
echo ""
echo -e "🗄️  Banco de dados:"
echo -e "   - Nome: ${GREEN}crm_comercial${NC}"
echo -e "   - Usuário: ${GREEN}crm_user${NC}"
echo -e "   - DATABASE_URL: ${BLUE}/tmp/crm_database_url.txt${NC}"
echo ""
echo -e "📁 Diretórios:"
echo -e "   - Aplicação: ${GREEN}/var/www/crm-comercial${NC}"
echo ""
echo -e "🔥 Firewall:"
echo -e "   - Portas abertas: ${GREEN}22, 80, 443, 8081${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo ""
echo -e "1. Enviar backup do servidor provisório:"
echo -e "   ${GREEN}scp backup.tar.gz usuario@este-servidor:~/${NC}"
echo ""
echo -e "2. Restaurar backup:"
echo -e "   ${GREEN}./restaurar-backup.sh ~/crm-backup-XXXXXXXX${NC}"
echo ""
echo -e "3. Configurar .env com a DATABASE_URL:"
echo -e "   ${GREEN}cat /tmp/crm_database_url.txt${NC}"
echo ""
echo -e "4. Iniciar aplicação:"
echo -e "   ${GREEN}cd /var/www/crm-comercial && pm2 start ecosystem.config.js${NC}"
echo ""
