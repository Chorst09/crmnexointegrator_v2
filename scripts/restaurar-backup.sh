#!/bin/bash

# ============================================
# Script de Restauração de Backup
# ============================================
# Restaura backup completo no novo servidor
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Restauração de Backup${NC}"
echo -e "${BLUE}  CRM Comercial${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar argumentos
if [ -z "$1" ]; then
    echo -e "${RED}Uso: $0 <diretório-backup>${NC}"
    echo ""
    echo "Exemplo:"
    echo "  $0 ~/crm-backup-20240218-143022"
    exit 1
fi

BACKUP_DIR="$1"

# Verificar se o diretório existe
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Erro: Diretório de backup não encontrado: $BACKUP_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}Diretório de backup: ${GREEN}$BACKUP_DIR${NC}"
echo ""

# Verificar integridade
echo -e "${YELLOW}[1/5] Verificando integridade do backup...${NC}"

if [ -f "$BACKUP_DIR/VERIFICACAO.txt" ]; then
    echo -e "${GREEN}✓ Arquivo de verificação encontrado${NC}"
    
    # Verificar checksums
    cd "$BACKUP_DIR"
    if command -v md5sum > /dev/null 2>&1; then
        echo "Verificando MD5..."
        while IFS= read -r line; do
            if [[ $line == MD5:* ]]; then
                MD5_EXPECTED=$(echo "$line" | cut -d' ' -f2)
                FILE_NAME=$(grep -B2 "MD5: $MD5_EXPECTED" VERIFICACAO.txt | head -1 | cut -d' ' -f2)
                
                if [ -f "$FILE_NAME" ]; then
                    MD5_ACTUAL=$(md5sum "$FILE_NAME" | awk '{print $1}')
                    if [ "$MD5_EXPECTED" = "$MD5_ACTUAL" ]; then
                        echo -e "   ${GREEN}✓${NC} $FILE_NAME"
                    else
                        echo -e "   ${RED}✗${NC} $FILE_NAME (checksum não corresponde)"
                        exit 1
                    fi
                fi
            fi
        done < VERIFICACAO.txt
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo de verificação não encontrado${NC}"
fi
echo ""

# 2. Restaurar banco de dados
echo -e "${YELLOW}[2/5] Restaurando banco de dados...${NC}"

if [ -f "$BACKUP_DIR/database.sql.gz" ]; then
    echo "Descompactando banco de dados..."
    gunzip -c "$BACKUP_DIR/database.sql.gz" | psql -U crm_user -h localhost crm_comercial > /dev/null 2>&1
    
    # Contar registros
    USERS=$(psql -U crm_user -h localhost crm_comercial -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    COMPANIES=$(psql -U crm_user -h localhost crm_comercial -t -c "SELECT COUNT(*) FROM companies;" 2>/dev/null || echo "0")
    OPPORTUNITIES=$(psql -U crm_user -h localhost crm_comercial -t -c "SELECT COUNT(*) FROM opportunities;" 2>/dev/null || echo "0")
    
    echo -e "${GREEN}✓ Banco de dados restaurado${NC}"
    echo -e "   - Usuários: $USERS"
    echo -e "   - Empresas: $COMPANIES"
    echo -e "   - Oportunidades: $OPPORTUNITIES"
else
    echo -e "${RED}✗ Arquivo de banco de dados não encontrado${NC}"
    exit 1
fi
echo ""

# 3. Restaurar aplicação
echo -e "${YELLOW}[3/5] Restaurando aplicação...${NC}"

if [ -f "$BACKUP_DIR/aplicacao.tar.gz" ]; then
    echo "Descompactando aplicação..."
    tar -xzf "$BACKUP_DIR/aplicacao.tar.gz" -C / > /dev/null 2>&1
    
    # Instalar dependências
    echo "Instalando dependências..."
    cd /var/www/crm-comercial/apps/api
    npm install --production > /dev/null 2>&1
    
    cd /var/www/crm-comercial/apps/web
    npm install > /dev/null 2>&1
    
    echo -e "${GREEN}✓ Aplicação restaurada${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo de aplicação não encontrado${NC}"
fi
echo ""

# 4. Restaurar uploads
echo -e "${YELLOW}[4/5] Restaurando uploads...${NC}"

if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
    echo "Descompactando uploads..."
    tar -xzf "$BACKUP_DIR/uploads.tar.gz" -C / > /dev/null 2>&1
    
    # Ajustar permissões
    chown -R nobody:nogroup /var/www/crm-comercial/apps/api/uploads 2>/dev/null || true
    chmod -R 755 /var/www/crm-comercial/apps/api/uploads 2>/dev/null || true
    
    UPLOAD_COUNT=$(find /var/www/crm-comercial/apps/api/uploads -type f 2>/dev/null | wc -l)
    echo -e "${GREEN}✓ Uploads restaurados ($UPLOAD_COUNT arquivos)${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo de uploads não encontrado${NC}"
fi
echo ""

# 5. Restaurar configurações
echo -e "${YELLOW}[5/5] Restaurando configurações...${NC}"

if [ -f "$BACKUP_DIR/.env.api.backup" ]; then
    cp "$BACKUP_DIR/.env.api.backup" /var/www/crm-comercial/apps/api/.env
    echo -e "${GREEN}✓ .env da API restaurado${NC}"
    echo -e "   ${YELLOW}⚠️  Verifique e atualize as variáveis de ambiente!${NC}"
fi

if [ -f "$BACKUP_DIR/.env.web.backup" ]; then
    cp "$BACKUP_DIR/.env.web.backup" /var/www/crm-comercial/apps/web/.env
    echo -e "${GREEN}✓ .env do Frontend restaurado${NC}"
fi

echo ""

# Resumo final
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Restauração Concluída!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo ""
echo -e "1. Verificar e atualizar .env:"
echo -e "   ${GREEN}nano /var/www/crm-comercial/apps/api/.env${NC}"
echo ""
echo -e "2. Atualizar DATABASE_URL com:"
echo -e "   ${GREEN}postgresql://crm_user:SENHA@localhost:5432/crm_comercial${NC}"
echo ""
echo -e "3. Atualizar CORS_ORIGIN com o novo IP/domínio"
echo ""
echo -e "4. Build do frontend:"
echo -e "   ${GREEN}cd /var/www/crm-comercial/apps/web && npm run build${NC}"
echo ""
echo -e "5. Iniciar aplicação:"
echo -e "   ${GREEN}cd /var/www/crm-comercial && pm2 start ecosystem.config.js${NC}"
echo ""
echo -e "6. Verificar migração:"
echo -e "   ${GREEN}./verificar-migracao.sh${NC}"
echo ""
