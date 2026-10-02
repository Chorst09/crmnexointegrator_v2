#!/bin/bash

# ============================================
# Script de Backup Completo do CRM
# ============================================
# Cria backup de banco de dados, aplicação
# e arquivos para migração
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Backup Completo do CRM${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Diretório de backup
BACKUP_DIR="$HOME/crm-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Diretório de backup: ${GREEN}$BACKUP_DIR${NC}"
echo ""

# 1. Backup do banco de dados
echo -e "${YELLOW}[1/5] Fazendo backup do banco de dados...${NC}"
if command -v pg_dump > /dev/null 2>&1; then
    # Tentar com variáveis de ambiente
    if [ -n "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/database.sql.gz"
    else
        # Tentar com credenciais padrão
        PGPASSWORD="${DB_PASSWORD:-postgres}" pg_dump -U crm_user -h localhost crm_comercial | gzip > "$BACKUP_DIR/database.sql.gz"
    fi
    
    DB_SIZE=$(du -h "$BACKUP_DIR/database.sql.gz" | cut -f1)
    echo -e "${GREEN}✓ Banco de dados: $DB_SIZE${NC}"
else
    echo -e "${RED}✗ pg_dump não encontrado${NC}"
    exit 1
fi
echo ""

# 2. Backup da aplicação
echo -e "${YELLOW}[2/5] Fazendo backup da aplicação...${NC}"
if [ -d "/var/www/crm-comercial" ]; then
    tar -czf "$BACKUP_DIR/aplicacao.tar.gz" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=dist \
        --exclude=.env.local \
        /var/www/crm-comercial > /dev/null 2>&1
    
    APP_SIZE=$(du -h "$BACKUP_DIR/aplicacao.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ Aplicação: $APP_SIZE${NC}"
else
    echo -e "${YELLOW}⚠️  Diretório /var/www/crm-comercial não encontrado${NC}"
fi
echo ""

# 3. Backup de uploads
echo -e "${YELLOW}[3/5] Fazendo backup de uploads...${NC}"
if [ -d "/var/www/crm-comercial/apps/api/uploads" ]; then
    tar -czf "$BACKUP_DIR/uploads.tar.gz" \
        /var/www/crm-comercial/apps/api/uploads > /dev/null 2>&1
    
    UPLOADS_SIZE=$(du -h "$BACKUP_DIR/uploads.tar.gz" | cut -f1)
    echo -e "${GREEN}✓ Uploads: $UPLOADS_SIZE${NC}"
else
    echo -e "${YELLOW}⚠️  Diretório de uploads não encontrado${NC}"
fi
echo ""

# 4. Backup de configurações
echo -e "${YELLOW}[4/5] Fazendo backup de configurações...${NC}"

# Salvar informações do sistema
cat > "$BACKUP_DIR/system-info.txt" << EOF
=== Informações do Sistema ===
Data: $(date)
Hostname: $(hostname)
OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
Kernel: $(uname -r)

=== Versões Instaladas ===
Node.js: $(node --version 2>/dev/null || echo "Não instalado")
NPM: $(npm --version 2>/dev/null || echo "Não instalado")
PM2: $(pm2 --version 2>/dev/null || echo "Não instalado")
PostgreSQL: $(psql --version 2>/dev/null || echo "Não instalado")

=== Banco de Dados ===
Database: crm_comercial
User: crm_user
Host: localhost
Port: 5432

=== Aplicação ===
Diretório: /var/www/crm-comercial
API Porta: 8081
Frontend Porta: 3000

=== Recursos ===
CPU Cores: $(nproc)
Memória Total: $(free -h | grep Mem | awk '{print $2}')
Disco Disponível: $(df -h / | tail -1 | awk '{print $4}')

=== Processos PM2 ===
$(pm2 list 2>/dev/null || echo "PM2 não está rodando")

=== Variáveis de Ambiente ===
NODE_ENV: ${NODE_ENV:-não definido}
PORT: ${PORT:-não definido}
EOF

echo -e "${GREEN}✓ Informações do sistema salvas${NC}"

# Salvar .env (sem valores sensíveis)
if [ -f "/var/www/crm-comercial/apps/api/.env" ]; then
    cp "/var/www/crm-comercial/apps/api/.env" "$BACKUP_DIR/.env.api.backup"
    echo -e "${GREEN}✓ .env da API salvo${NC}"
fi

if [ -f "/var/www/crm-comercial/apps/web/.env" ]; then
    cp "/var/www/crm-comercial/apps/web/.env" "$BACKUP_DIR/.env.web.backup"
    echo -e "${GREEN}✓ .env do Frontend salvo${NC}"
fi

echo ""

# 5. Gerar checksums e relatório
echo -e "${YELLOW}[5/5] Gerando checksums e relatório...${NC}"

cat > "$BACKUP_DIR/VERIFICACAO.txt" << EOF
=== Relatório de Backup ===
Data: $(date)
Diretório: $BACKUP_DIR

=== Arquivos de Backup ===
EOF

cd "$BACKUP_DIR"
for file in *; do
    if [ -f "$file" ] && [ "$file" != "VERIFICACAO.txt" ]; then
        SIZE=$(du -h "$file" | cut -f1)
        MD5=$(md5sum "$file" | awk '{print $1}')
        echo "Arquivo: $file" >> VERIFICACAO.txt
        echo "Tamanho: $SIZE" >> VERIFICACAO.txt
        echo "MD5: $MD5" >> VERIFICACAO.txt
        echo "" >> VERIFICACAO.txt
    fi
done

echo -e "${GREEN}✓ Checksums gerados${NC}"
echo ""

# Resumo final
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Backup Concluído com Sucesso!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Resumo do Backup:${NC}"
echo ""
echo -e "📁 Diretório: ${GREEN}$BACKUP_DIR${NC}"
echo ""
echo -e "📦 Arquivos criados:"
ls -lh "$BACKUP_DIR" | tail -n +2 | awk '{printf "   - %s (%s)\n", $9, $5}'
echo ""
echo -e "💾 Tamanho total: ${GREEN}$(du -sh "$BACKUP_DIR" | cut -f1)${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo ""
echo -e "1. Transferir backup para o novo servidor:"
echo -e "   ${GREEN}scp -r $BACKUP_DIR usuario@novo-servidor:~/${NC}"
echo ""
echo -e "2. Restaurar no novo servidor:"
echo -e "   ${GREEN}./restaurar-backup.sh $BACKUP_DIR${NC}"
echo ""
echo -e "3. Verificar integridade:"
echo -e "   ${GREEN}cat $BACKUP_DIR/VERIFICACAO.txt${NC}"
echo ""
