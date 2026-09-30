#!/bin/bash

# Script simplificado para macOS

set -e

echo "=========================================="
echo "  Enviando CRM para o Servidor"
echo "=========================================="
echo ""

# Verificar diretório
if [ ! -d "apps/api" ] || [ ! -d "apps/web" ]; then
    echo "❌ Erro: Execute na raiz do projeto"
    echo "Diretório atual: $(pwd)"
    exit 1
fi

echo "✅ Diretório correto"
echo ""

SERVER="root@72.60.195.200"
REMOTE_DIR="/var/www/crm-comercial"

echo "📦 Comprimindo arquivos..."

# Criar arquivo tar (método simples)
tar -czf crm-deploy.tar.gz apps/

echo "✅ Arquivos comprimidos"
echo ""

echo "📤 Enviando para o servidor..."

# Criar diretório no servidor
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

# Enviar arquivo
scp crm-deploy.tar.gz "$SERVER:$REMOTE_DIR/"

echo "✅ Arquivos enviados!"
echo ""

# Limpar
rm crm-deploy.tar.gz

echo "=========================================="
echo "  ✅ Envio Concluído!"
echo "=========================================="
echo ""
echo "Agora no servidor execute:"
echo ""
echo "  cd /var/www/crm-comercial"
echo "  tar -xzf crm-deploy.tar.gz"
echo "  rm crm-deploy.tar.gz"
echo ""
