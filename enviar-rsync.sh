#!/bin/bash

# Script usando rsync (mais robusto para arquivos grandes)

set -e

echo "=========================================="
echo "  Enviando CRM para o Servidor (rsync)"
echo "=========================================="
echo ""

# Verificar diretório
if [ ! -d "apps/api" ] || [ ! -d "apps/web" ]; then
    echo "❌ Erro: Execute na raiz do projeto"
    exit 1
fi

echo "✅ Diretório correto"
echo ""

SERVER="root@72.60.195.200"
REMOTE_DIR="/var/www/crm-comercial"

# Testar conexão SSH
echo "🔍 Testando conexão SSH..."
if ! ssh -o ConnectTimeout=5 "$SERVER" "echo OK" > /dev/null 2>&1; then
    echo "❌ Não consegui conectar ao servidor"
    exit 1
fi

echo "✅ Conexão SSH OK"
echo ""

# Criar diretório no servidor
echo "📁 Criando diretório no servidor..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

echo ""
echo "📤 Enviando arquivos com rsync..."
echo "   (Isso pode levar alguns minutos)"
echo ""

# Usar rsync com compressão e retry
rsync -avz \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.env' \
    --exclude='.git' \
    --exclude='*.log' \
    --delete \
    apps/ \
    "$SERVER:$REMOTE_DIR/apps/"

echo ""
echo "=========================================="
echo "  ✅ Envio Concluído!"
echo "=========================================="
echo ""
echo "Agora no servidor execute:"
echo ""
echo "  cd /var/www/crm-comercial"
echo "  ls -la"
echo ""
