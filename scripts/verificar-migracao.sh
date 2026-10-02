#!/bin/bash

# ============================================
# Script de Verificação de Migração
# ============================================
# Verifica se a migração foi bem-sucedida
# ============================================

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Verificação de Migração${NC}"
echo -e "${BLUE}  CRM Comercial${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Função para verificar
check() {
    local name=$1
    local command=$2
    local expected=$3
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name"
        return 0
    else
        echo -e "${RED}✗${NC} $name"
        ((ERRORS++))
        return 1
    fi
}

warn() {
    local name=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name"
        return 0
    else
        echo -e "${YELLOW}⚠️${NC} $name"
        ((WARNINGS++))
        return 1
    fi
}

# 1. Verificar PostgreSQL
echo -e "${YELLOW}[1/9] Verificando PostgreSQL...${NC}"
check "PostgreSQL está rodando" "systemctl is-active postgresql"
check "Banco de dados 'crm_comercial' existe" "psql -U crm_user -h localhost -d crm_comercial -c 'SELECT 1' > /dev/null 2>&1"
echo ""

# 2. Verificar dados no banco
echo -e "${YELLOW}[2/9] Verificando dados no banco...${NC}"
USERS=$(psql -U crm_user -h localhost crm_comercial -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
COMPANIES=$(psql -U crm_user -h localhost crm_comercial -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null | tr -d ' ')
OPPORTUNITIES=$(psql -U crm_user -h localhost crm_comercial -t -c "SELECT COUNT(*) FROM opportunities;" 2>/dev/null | tr -d ' ')

if [ "$USERS" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Usuários: $USERS"
else
    echo -e "${YELLOW}⚠️${NC} Nenhum usuário encontrado"
    ((WARNINGS++))
fi

if [ "$COMPANIES" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Empresas: $COMPANIES"
else
    echo -e "${YELLOW}⚠️${NC} Nenhuma empresa encontrada"
    ((WARNINGS++))
fi

if [ "$OPPORTUNITIES" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Oportunidades: $OPPORTUNITIES"
else
    echo -e "${YELLOW}⚠️${NC} Nenhuma oportunidade encontrada"
    ((WARNINGS++))
fi
echo ""

# 3. Verificar Node.js e NPM
echo -e "${YELLOW}[3/9] Verificando Node.js e NPM...${NC}"
check "Node.js instalado" "command -v node"
check "NPM instalado" "command -v npm"
check "PM2 instalado" "command -v pm2"
echo ""

# 4. Verificar arquivos da aplicação
echo -e "${YELLOW}[4/9] Verificando arquivos da aplicação...${NC}"
check "Diretório /var/www/crm-comercial existe" "[ -d /var/www/crm-comercial ]"
check "Arquivo package.json (API) existe" "[ -f /var/www/crm-comercial/apps/api/package.json ]"
check "Arquivo package.json (Web) existe" "[ -f /var/www/crm-comercial/apps/web/package.json ]"
check "node_modules (API) existe" "[ -d /var/www/crm-comercial/apps/api/node_modules ]"
check "node_modules (Web) existe" "[ -d /var/www/crm-comercial/apps/web/node_modules ]"
echo ""

# 5. Verificar .env
echo -e "${YELLOW}[5/9] Verificando configurações...${NC}"
check ".env (API) existe" "[ -f /var/www/crm-comercial/apps/api/.env ]"
check ".env (Web) existe" "[ -f /var/www/crm-comercial/apps/web/.env ]"

if [ -f /var/www/crm-comercial/apps/api/.env ]; then
    if grep -q "DATABASE_URL" /var/www/crm-comercial/apps/api/.env; then
        echo -e "${GREEN}✓${NC} DATABASE_URL configurada"
    else
        echo -e "${RED}✗${NC} DATABASE_URL não configurada"
        ((ERRORS++))
    fi
fi
echo ""

# 6. Verificar PM2
echo -e "${YELLOW}[6/9] Verificando PM2...${NC}"
if pm2 list 2>/dev/null | grep -q "crm-api"; then
    echo -e "${GREEN}✓${NC} Processo 'crm-api' está registrado no PM2"
    
    if pm2 list 2>/dev/null | grep "crm-api" | grep -q "online"; then
        echo -e "${GREEN}✓${NC} Processo 'crm-api' está rodando"
    else
        echo -e "${YELLOW}⚠️${NC} Processo 'crm-api' não está rodando"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠️${NC} Processo 'crm-api' não está registrado no PM2"
    ((WARNINGS++))
fi
echo ""

# 7. Verificar portas
echo -e "${YELLOW}[7/9] Verificando portas...${NC}"
if netstat -tulpn 2>/dev/null | grep -q ":8081"; then
    echo -e "${GREEN}✓${NC} Porta 8081 está em uso"
else
    echo -e "${YELLOW}⚠️${NC} Porta 8081 não está em uso"
    ((WARNINGS++))
fi

if netstat -tulpn 2>/dev/null | grep -q ":5432"; then
    echo -e "${GREEN}✓${NC} Porta 5432 (PostgreSQL) está em uso"
else
    echo -e "${RED}✗${NC} Porta 5432 (PostgreSQL) não está em uso"
    ((ERRORS++))
fi
echo ""

# 8. Verificar firewall
echo -e "${YELLOW}[8/9] Verificando firewall...${NC}"
if command -v ufw > /dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✓${NC} UFW está ativo"
        
        if ufw status | grep -q "8081"; then
            echo -e "${GREEN}✓${NC} Porta 8081 está aberta no firewall"
        else
            echo -e "${YELLOW}⚠️${NC} Porta 8081 pode não estar aberta no firewall"
            ((WARNINGS++))
        fi
    else
        echo -e "${YELLOW}⚠️${NC} UFW não está ativo"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠️${NC} UFW não está instalado"
    ((WARNINGS++))
fi
echo ""

# 9. Verificar recursos
echo -e "${YELLOW}[9/9] Verificando recursos do sistema...${NC}"
MEMORY=$(free -h | grep Mem | awk '{print $2}')
DISK=$(df -h / | tail -1 | awk '{print $4}')
CPU=$(nproc)

echo -e "${GREEN}✓${NC} Memória disponível: $MEMORY"
echo -e "${GREEN}✓${NC} Espaço em disco: $DISK"
echo -e "${GREEN}✓${NC} CPU Cores: $CPU"
echo ""

# Resumo final
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Resumo da Verificação${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Migração bem-sucedida!${NC}"
    echo -e "  Todos os testes passaram."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Migração com avisos${NC}"
    echo -e "  Erros: 0"
    echo -e "  Avisos: $WARNINGS"
    echo ""
    echo -e "  Verifique os avisos acima e corrija se necessário."
    exit 0
else
    echo -e "${RED}✗ Migração com erros${NC}"
    echo -e "  Erros: $ERRORS"
    echo -e "  Avisos: $WARNINGS"
    echo ""
    echo -e "  Corrija os erros acima antes de continuar."
    exit 1
fi
