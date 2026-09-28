#!/bin/bash

# Script que divide o arquivo em partes menores

set -e

echo "=========================================="
echo "  Enviando CRM em Partes"
echo "=========================================="
echo ""

if [ ! -d "apps/api" ] || [ ! -d "apps/web" ]; then
    echo "❌ Erro: Execute na raiz do projeto"
    exit 1
fi

echo "✅ Diretório correto"
echo ""

SERVER="root@72.60.195.200"
REMOTE_DIR="/var/www/crm-comercial"

echo "🔍 Testando conexão SSH..."
if ! ssh -o ConnectTimeout=5 "$SERVER" "echo OK" > /dev/null 2>&1; then
    echo "❌ Não consegui conectar ao servidor"
    exit 1
fi

echo "✅ Conexão SSH OK"
echo ""

# Criar diretório no servidor
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

echo "📦 Comprimindo arquivos..."
tar -czf crm-deploy.tar.gz apps/

SIZE=$(du -h crm-deploy.tar.gz | cut -f1)
echo "✅ Arquivo criado: $SIZE"
echo ""

echo "✂️  Dividindo em partes de 20MB..."
split -b 20m crm-deploy.tar.gz crm-part-

echo "✅ Arquivo dividido"
echo ""

echo "📤 Enviando partes..."
for part in crm-part-*; do
    echo "  Enviando $part..."
    scp "$part" "$SERVER:$REMOTE_DIR/" || {
        echo "❌ Erro ao enviar $part"
        exit 1
    }
done

echo ""
echo "✅ Todas as partes enviadas!"
echo ""

# Limpar arquivos locais
rm crm-deploy.tar.gz crm-part-*

echo "=========================================="
echo "  ✅ Envio Concluído!"
echo "=========================================="
echo ""
echo "Agora no servidor execute:"
echo ""
echo "  cd /var/www/crm-comercial"
echo "  cat crm-part-* > crm-deploy.tar.gz"
echo "  tar -xzf crm-deploy.tar.gz"
echo "  rm crm-part-* crm-deploy.tar.gz"
echo "  ls -la"
echo ""
