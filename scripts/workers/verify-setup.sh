#!/bin/bash

# ============================================================================
# Script de Verificação da Instalação do Worker PNCP
# ============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verificação de Setup - Worker PNCP${NC}"
echo "============================================"

# Verifica estrutura de diretórios
echo -e "${YELLOW}📁 Verificando estrutura de diretórios...${NC}"
if [ -f "fetchPncpData.js" ]; then
    echo -e "${GREEN}✅ fetchPncpData.js encontrado${NC}"
else
    echo -e "${RED}❌ fetchPncpData.js não encontrado${NC}"
fi

if [ -f "types/pncp.types.ts" ]; then
    echo -e "${GREEN}✅ Tipos TypeScript encontrados${NC}"
else
    echo -e "${RED}❌ Tipos TypeScript não encontrados${NC}"
fi

if [ -f "setup/install-cron.sh" ]; then
    echo -e "${GREEN}✅ Script de instalação do cron encontrado${NC}"
else
    echo -e "${RED}❌ Script de instalação do cron não encontrado${NC}"
fi

# Verifica dependências
echo -e "${YELLOW}📦 Verificando dependências...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules presente${NC}"
else
    echo -e "${RED}❌ Dependências não instaladas${NC}"
fi

# Verifica Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js não instalado${NC}"
fi

# Verifica banco de dados
echo -e "${YELLOW}🗄️ Verificando banco de dados...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL CLI disponível${NC}"
    
    if psql -d nexoscrm -c "SELECT 1;" &> /dev/null; then
        echo -e "${GREEN}✅ Conexão com banco OK${NC}"
        
        # Verifica tabela
        if psql -d nexoscrm -c "\dt licitacoes_pncp" &> /dev/null; then
            echo -e "${GREEN}✅ Tabela licitacoes_pncp existe${NC}"
            
            # Conta índices
            INDICES=$(psql -d nexoscrm -t -c "SELECT count(*) FROM pg_indexes WHERE tablename = 'licitacoes_pncp';" | xargs)
            echo -e "${GREEN}✅ $INDICES índices criados${NC}"
        else
            echo -e "${RED}❌ Tabela licitacoes_pncp não existe${NC}"
        fi
    else
        echo -e "${RED}❌ Não foi possível conectar ao banco nexoscrm${NC}"
    fi
else
    echo -e "${RED}❌ PostgreSQL CLI não disponível${NC}"
fi

# Teste de compilação TypeScript
echo -e "${YELLOW}🔧 Verificando compilação...${NC}"
if [ -f "fetchPncpData.js" ]; then
    echo -e "${GREEN}✅ Arquivo JavaScript compilado existe${NC}"
else
    echo -e "${YELLOW}⚠️ Tentando compilar TypeScript...${NC}"
    if npx tsc fetchPncpData.ts --target es2020 --module commonjs --skipLibCheck &> /dev/null; then
        echo -e "${GREEN}✅ Compilação TypeScript OK${NC}"
    else
        echo -e "${RED}❌ Erro na compilação TypeScript${NC}"
    fi
fi

# Teste básico do worker
echo -e "${YELLOW}🧪 Testando execução do worker...${NC}"
if node fetchPncpData.js --help &> /dev/null; then
    echo -e "${GREEN}✅ Worker executa sem erros${NC}"
else
    echo -e "${RED}❌ Worker não executa corretamente${NC}"
fi

# Verificação de logs
echo -e "${YELLOW}📝 Verificando estrutura de logs...${NC}"
if [ -d "../../logs/workers" ]; then
    echo -e "${GREEN}✅ Diretório de logs existe${NC}"
else
    echo -e "${YELLOW}⚠️ Criando diretório de logs...${NC}"
    mkdir -p ../../logs/workers
    echo -e "${GREEN}✅ Diretório de logs criado${NC}"
fi

# Verificação do cron (se instalado)
echo -e "${YELLOW}⏰ Verificando configuração do cron...${NC}"
if crontab -l 2>/dev/null | grep -q "fetchPncpData\|run-pncp-worker"; then
    echo -e "${GREEN}✅ Cron job configurado${NC}"
    echo -e "${BLUE}📋 Configuração atual:${NC}"
    crontab -l | grep -E "(fetchPncpData|run-pncp-worker)" || true
else
    echo -e "${YELLOW}⚠️ Cron job não configurado${NC}"
    echo -e "${BLUE}💡 Para configurar, execute: ./setup/install-cron.sh${NC}"
fi

# Resumo final
echo ""
echo -e "${BLUE}📊 RESUMO DA VERIFICAÇÃO${NC}"
echo "========================"

# Contador de checks
CHECKS_PASSED=0
TOTAL_CHECKS=10

# Incrementar baseado nas verificações acima
if [ -f "fetchPncpData.js" ]; then ((CHECKS_PASSED++)); fi
if [ -f "types/pncp.types.ts" ]; then ((CHECKS_PASSED++)); fi
if [ -f "setup/install-cron.sh" ]; then ((CHECKS_PASSED++)); fi
if [ -d "node_modules" ]; then ((CHECKS_PASSED++)); fi
if command -v node &> /dev/null; then ((CHECKS_PASSED++)); fi
if command -v psql &> /dev/null; then ((CHECKS_PASSED++)); fi
if psql -d nexoscrm -c "SELECT 1;" &> /dev/null 2>&1; then ((CHECKS_PASSED++)); fi
if psql -d nexoscrm -c "\dt licitacoes_pncp" &> /dev/null 2>&1; then ((CHECKS_PASSED++)); fi
if node fetchPncpData.js --help &> /dev/null 2>&1; then ((CHECKS_PASSED++)); fi
if [ -d "../../logs/workers" ]; then ((CHECKS_PASSED++)); fi

PERCENTAGE=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

echo -e "${GREEN}✅ Verificações passaram: $CHECKS_PASSED/$TOTAL_CHECKS ($PERCENTAGE%)${NC}"

if [ $CHECKS_PASSED -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}🎉 SETUP COMPLETO - Worker PNCP pronto para produção!${NC}"
    echo ""
    echo -e "${BLUE}🚀 PRÓXIMOS PASSOS:${NC}"
    echo "1. Configurar cron job: ./setup/install-cron.sh"
    echo "2. Monitorar primeira execução"
    echo "3. Configurar alertas de erro (opcional)"
elif [ $CHECKS_PASSED -ge 7 ]; then
    echo -e "${YELLOW}⚠️ SETUP QUASE COMPLETO - Verifique itens em falta${NC}"
else
    echo -e "${RED}❌ SETUP INCOMPLETO - Corrija os problemas identificados${NC}"
fi

echo ""
echo -e "${BLUE}📖 Para mais informações, consulte: README.md${NC}"
echo -e "${BLUE}🔧 Para instalar cron: ./setup/install-cron.sh${NC}"
echo -e "${BLUE}🧪 Para testar: node fetchPncpData.js --help${NC}"