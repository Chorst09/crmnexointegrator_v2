#!/bin/bash

# Script para executar NO SEU MAC (não no servidor!)
# Envia os arquivos do CRM para o servidor

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Enviando CRM para o Servidor${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Verificar se estamos no diretório correto
if [ ! -d "apps/api" ] || [ ! -d "apps/web" ]; then
    echo -e "${RED}❌ Erro: Execute este script na raiz do projeto (onde está a pasta apps/)${NC}"
    echo -e "${YELLOW}Diretório atual: $(pwd)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Diretório correto encontrado${NC}"
echo ""

SERVER="root@72.60.195.200"
REMOTE_DIR="/var/www/crm-comercial"

echo -e "${YELLOW}📦 Comprimindo arquivos...${NC}"

# Criar arquivo temporário
TEMP_FILE="crm-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

# Comprimir sem node_modules e dist (macOS compatível)
tar -czf "$TEMP_FILE" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.env' \
    apps/

echo -e "${GREEN}✅ Arquivos comprimidos: $TEMP_FILE${NC}"
echo ""

echo -e "${YELLOW}📤 Enviando para o servidor...${NC}"

# Criar diretório no servidor
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

# Enviar arquivo
scp "$TEMP_FILE" "$SERVER:$REMOTE_DIR/crm-deploy.tar.gz"

echo -e "${GREEN}✅ Arquivos enviados!${NC}"
echo ""

# Limpar arquivo temporário local
rm "$TEMP_FILE"

echo -e "${YELLOW}📋 Próximos passos:${NC}"
echo ""
echo "Execute no servidor (você já está conectado):"
echo ""
echo -e "${GREEN}cd /var/www/crm-comercial${NC}"
echo -e "${GREEN}tar -xzf crm-deploy.tar.gz${NC}"
echo -e "${GREEN}rm crm-deploy.tar.gz${NC}"
echo ""
echo "Depois copie e cole o script de instalação que vou mostrar..."
echo ""
