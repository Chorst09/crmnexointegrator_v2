#!/bin/bash

# ============================================
# Script de Teste dos Scripts de Migração
# ============================================
# Valida se todos os scripts estão corretos
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Teste dos Scripts de Migração${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Função para testar
test_script() {
    local script=$1
    local name=$2
    
    echo -n "Testando $name... "
    
    if [ ! -f "$script" ]; then
        echo -e "${RED}✗ Arquivo não encontrado${NC}"
        ((ERRORS++))
        return 1
    fi
    
    if [ ! -x "$script" ]; then
        echo -e "${YELLOW}⚠️  Não é executável${NC}"
        ((WARNINGS++))
        return 1
    fi
    
    # Validar sintaxe bash
    if ! bash -n "$script" > /dev/null 2>&1; then
        echo -e "${RED}✗ Erro de sintaxe${NC}"
        ((ERRORS++))
        return 1
    fi
    
    echo -e "${GREEN}✓${NC}"
    return 0
}

# Função para testar arquivo
test_file() {
    local file=$1
    local name=$2
    
    echo -n "Verificando $name... "
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ Arquivo não encontrado${NC}"
        ((ERRORS++))
        return 1
    fi
    
    echo -e "${GREEN}✓${NC}"
    return 0
}

# 1. Testar scripts
echo -e "${YELLOW}[1/4] Testando scripts...${NC}"
test_script "preparar-servidor-definitivo.sh" "preparar-servidor-definitivo.sh"
test_script "backup-completo.sh" "backup-completo.sh"
test_script "restaurar-backup.sh" "restaurar-backup.sh"
test_script "verificar-migracao.sh" "verificar-migracao.sh"
echo ""

# 2. Testar documentação
echo -e "${YELLOW}[2/4] Testando documentação...${NC}"
test_file "../GUIA_MIGRACAO_GITHUB.md" "GUIA_MIGRACAO_GITHUB.md"
test_file "../CHECKLIST_MIGRACAO_RAPIDO.md" "CHECKLIST_MIGRACAO_RAPIDO.md"
test_file "README_SCRIPTS_MIGRACAO.md" "README_SCRIPTS_MIGRACAO.md"
echo ""

# 3. Testar configuração
echo -e "${YELLOW}[3/4] Testando configuração...${NC}"
test_file "../ecosystem.config.js" "ecosystem.config.js"

if [ -f "../ecosystem.config.js" ]; then
    echo -n "Validando ecosystem.config.js... "
    if node -c "../ecosystem.config.js" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ Erro de sintaxe${NC}"
        ((ERRORS++))
    fi
fi
echo ""

# 4. Testar dependências
echo -e "${YELLOW}[4/4] Testando dependências...${NC}"

echo -n "Verificando bash... "
if command -v bash > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ((ERRORS++))
fi

echo -n "Verificando tar... "
if command -v tar > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ((ERRORS++))
fi

echo -n "Verificando gzip... "
if command -v gzip > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ((ERRORS++))
fi

echo -n "Verificando md5sum... "
if command -v md5sum > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    ((ERRORS++))
fi

echo ""

# Resumo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Resumo dos Testes${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Todos os testes passaram!${NC}"
    echo ""
    echo "Os scripts estão prontos para uso."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Testes com avisos${NC}"
    echo "Erros: 0"
    echo "Avisos: $WARNINGS"
    echo ""
    echo "Corrija os avisos antes de usar os scripts."
    exit 0
else
    echo -e "${RED}✗ Testes falharam${NC}"
    echo "Erros: $ERRORS"
    echo "Avisos: $WARNINGS"
    echo ""
    echo "Corrija os erros antes de usar os scripts."
    exit 1
fi
