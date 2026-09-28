#!/bin/bash

# ============================================================================
# Script de Configuração do Cron Job para Worker PNCP
# ============================================================================
# 
# Desenvolvido por: AI Assistant (Engenheiro de Dados)
# Data: 2026-09-03
# 
# Descrição:
# Script para configurar a execução diária automatizada do worker de 
# ingestão da API PNCP via cron job.
# 
# Uso:
# chmod +x install-cron.sh && ./install-cron.sh
# 
# ============================================================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
PROJECT_ROOT="/opt/nexoscrm"
WORKER_SCRIPT="$PROJECT_ROOT/scripts/workers/fetchPncpData.ts"
LOG_DIR="$PROJECT_ROOT/logs/workers"
LOG_FILE="$LOG_DIR/pncp-worker.log"
ERROR_LOG="$LOG_DIR/pncp-worker-error.log"
CRON_TIME="0 6" # 6:00 AM todos os dias

echo -e "${BLUE}🚀 Configurando Worker PNCP - Cron Job Setup${NC}"
echo "=================================================="

# Verifica se o script existe
if [ ! -f "$WORKER_SCRIPT" ]; then
    echo -e "${RED}❌ Erro: Worker script não encontrado em $WORKER_SCRIPT${NC}"
    exit 1
fi

# Cria diretório de logs se não existir
echo -e "${YELLOW}📁 Criando diretório de logs...${NC}"
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Cria arquivo de log se não existir
touch "$LOG_FILE"
touch "$ERROR_LOG"
chmod 644 "$LOG_FILE" "$ERROR_LOG"

# Verifica se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Erro: Node.js não está instalado${NC}"
    exit 1
fi

NODE_PATH=$(which node)
echo -e "${GREEN}✅ Node.js encontrado: $NODE_PATH${NC}"

# Verifica se npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Erro: npm não está instalado${NC}"
    exit 1
fi

# Instala dependências se necessário
echo -e "${YELLOW}📦 Verificando dependências...${NC}"
cd "$PROJECT_ROOT"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependências npm...${NC}"
    npm install
fi

# Verifica se TypeScript está disponível
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Erro: npx não está disponível${NC}"
    exit 1
fi

# Testa se o worker pode ser executado
echo -e "${YELLOW}🧪 Testando execução do worker...${NC}"
cd "$PROJECT_ROOT"
if npx ts-node --help &> /dev/null; then
    echo -e "${GREEN}✅ ts-node disponível${NC}"
    EXEC_COMMAND="$NODE_PATH $(npm root -g)/ts-node/dist/bin.js"
else
    echo -e "${YELLOW}⚠️  ts-node global não encontrado, usando npx...${NC}"
    EXEC_COMMAND="npx ts-node"
fi

# Cria o script wrapper para o cron
WRAPPER_SCRIPT="$PROJECT_ROOT/scripts/workers/run-pncp-worker.sh"
echo -e "${YELLOW}📝 Criando script wrapper...${NC}"

cat > "$WRAPPER_SCRIPT" << EOF
#!/bin/bash

# ============================================================================
# Script Wrapper para Worker PNCP
# Gerado automaticamente em $(date)
# ============================================================================

# Configura ambiente
export NODE_ENV=production
export PATH="$PATH"
export TZ="America/Sao_Paulo"

# Diretórios
PROJECT_ROOT="$PROJECT_ROOT"
LOG_DIR="$LOG_DIR"
LOG_FILE="$LOG_FILE"
ERROR_LOG="$ERROR_LOG"

# Função de log
log_message() {
    echo "[\$(date '+%Y-%m-%d %H:%M:%S')] \$1" >> "\$LOG_FILE"
}

# Início da execução
log_message "🚀 Iniciando Worker PNCP"

# Muda para o diretório do projeto
cd "\$PROJECT_ROOT"

# Executa o worker
$EXEC_COMMAND "\$PROJECT_ROOT/scripts/workers/fetchPncpData.ts" >> "\$LOG_FILE" 2>> "\$ERROR_LOG"
EXIT_CODE=\$?

# Log do resultado
if [ \$EXIT_CODE -eq 0 ]; then
    log_message "✅ Worker executado com sucesso (exit code: \$EXIT_CODE)"
else
    log_message "❌ Worker falhou com exit code: \$EXIT_CODE"
    # Envia notificação de erro (opcional)
    # echo "Worker PNCP falhou em \$(hostname) em \$(date)" | mail -s "ERRO Worker PNCP" admin@exemplo.com
fi

log_message "🏁 Execução finalizada"

# Rotação de logs (mantém últimos 30 dias)
find "\$LOG_DIR" -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true

exit \$EXIT_CODE
EOF

chmod +x "$WRAPPER_SCRIPT"
echo -e "${GREEN}✅ Script wrapper criado: $WRAPPER_SCRIPT${NC}"

# Backup do crontab atual
echo -e "${YELLOW}💾 Fazendo backup do crontab atual...${NC}"
BACKUP_FILE="$HOME/crontab.backup.$(date +%Y%m%d_%H%M%S)"
crontab -l > "$BACKUP_FILE" 2>/dev/null || echo "# Crontab vazio" > "$BACKUP_FILE"
echo -e "${GREEN}✅ Backup salvo em: $BACKUP_FILE${NC}"

# Remove entradas existentes do worker PNCP
echo -e "${YELLOW}🧹 Removendo entradas existentes do worker PNCP...${NC}"
crontab -l 2>/dev/null | grep -v "fetchPncpData\|run-pncp-worker" > /tmp/crontab.tmp || true

# Adiciona nova entrada
echo -e "${YELLOW}➕ Adicionando nova entrada no crontab...${NC}"
echo "$CRON_TIME * * * $WRAPPER_SCRIPT" >> /tmp/crontab.tmp

# Aplica o novo crontab
crontab /tmp/crontab.tmp
rm -f /tmp/crontab.tmp

echo -e "${GREEN}✅ Crontab atualizado com sucesso!${NC}"

# Mostra a configuração atual
echo -e "${BLUE}📋 Configuração atual do cron:${NC}"
crontab -l | grep -E "(fetchPncpData|run-pncp-worker)" || echo "Nenhuma entrada encontrada"

# Verifica se o cron está rodando
if systemctl is-active --quiet cron 2>/dev/null; then
    echo -e "${GREEN}✅ Serviço cron está ativo${NC}"
elif systemctl is-active --quiet crond 2>/dev/null; then
    echo -e "${GREEN}✅ Serviço crond está ativo${NC}"
else
    echo -e "${YELLOW}⚠️  Serviço cron pode não estar ativo. Verifique manualmente.${NC}"
fi

# Cria arquivo de configuração para monitoramento
CONFIG_FILE="$PROJECT_ROOT/.pncp-worker-config"
cat > "$CONFIG_FILE" << EOF
# Configuração do Worker PNCP
# Gerado em $(date)

WORKER_ENABLED=true
WORKER_SCHEDULE="$CRON_TIME * * *"
WORKER_SCRIPT="$WORKER_SCRIPT"
WRAPPER_SCRIPT="$WRAPPER_SCRIPT"
LOG_FILE="$LOG_FILE"
ERROR_LOG="$ERROR_LOG"
LAST_SETUP=$(date -Iseconds)
EOF

echo -e "${GREEN}✅ Arquivo de configuração criado: $CONFIG_FILE${NC}"

# Teste manual opcional
echo ""
echo -e "${BLUE}🧪 TESTE MANUAL (opcional):${NC}"
echo "Para testar manualmente:"
echo "  $WRAPPER_SCRIPT"
echo ""
echo -e "${BLUE}📊 MONITORAMENTO:${NC}"
echo "Logs de execução: $LOG_FILE"
echo "Logs de erro:     $ERROR_LOG"
echo ""
echo -e "${BLUE}⏰ AGENDAMENTO:${NC}"
echo "Execução diária às $(echo $CRON_TIME | sed 's/0 //')h00"
echo ""
echo -e "${BLUE}🔧 PARA DESABILITAR:${NC}"
echo "crontab -e (e comente/remova a linha do worker)"
echo ""
echo -e "${GREEN}🎉 Setup concluído com sucesso!${NC}"
echo "O worker será executado automaticamente todos os dias às $(echo $CRON_TIME | sed 's/0 //')h00"

# Verificação final
echo ""
echo -e "${YELLOW}🔍 Verificação final...${NC}"

# Testa se o wrapper pode ser executado
if [ -x "$WRAPPER_SCRIPT" ]; then
    echo -e "${GREEN}✅ Script wrapper é executável${NC}"
else
    echo -e "${RED}❌ Script wrapper não é executável${NC}"
fi

# Verifica permissões dos logs
if [ -w "$LOG_DIR" ]; then
    echo -e "${GREEN}✅ Diretório de logs tem permissão de escrita${NC}"
else
    echo -e "${RED}❌ Diretório de logs não tem permissão de escrita${NC}"
fi

# Verifica se o projeto tem node_modules
if [ -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
else
    echo -e "${YELLOW}⚠️  Dependências podem não estar instaladas${NC}"
fi

echo ""
echo -e "${BLUE}📋 PRÓXIMOS PASSOS:${NC}"
echo "1. Monitore os logs na primeira execução"
echo "2. Configure alertas de erro se necessário"
echo "3. Ajuste o horário de execução conforme necessário"
echo "4. Configure rotação de logs se desejado"

echo ""
echo -e "${GREEN}✨ Setup concluído! O Worker PNCP está configurado e pronto.${NC}"