#!/bin/bash

# Script com retry para macOS

set -e

echo "=========================================="
echo "  Enviando CRM para o Servidor"
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
    echo "   Verifique se você ainda está conectado"
    echo "   Tente reconectar: ssh root@72.60.195.200"
    exit 1
fi

echo "✅ Conexão SSH OK"
echo ""

echo "📦 Comprimindo arquivos..."
tar -czf crm-deploy.tar.gz apps/
SIZE=$(du -h crm-deploy.tar.gz | cut -f1)
echo "✅ Arquivo criado: $SIZE"
echo ""

echo "📤 Enviando para o servidor..."
echo "   Servidor: $SERVER"
echo "   Destino: $REMOTE_DIR"
echo ""

# Criar diretório no servidor
ssh "$SERVER" "mkdir -p $REMOTE_DIR" || true

# Enviar com retry
MAX_ATTEMPTS=3
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Tentativa $ATTEMPT de $MAX_ATTEMPTS..."
    
    if scp -P 22 crm-deploy.tar.gz "$SERVER:$REMOTE_DIR/"; then
        echo "✅ Arquivo enviado com sucesso!"
        break
    else
        ATTEMPT=$((ATTEMPT + 1))
        if [ $ATTEMPT -le $MAX_ATTEMPTS ]; then
            echo "⚠️  Falha na tentativa $((ATTEMPT-1)), aguardando 5 segundos..."
            sleep 5
        fi
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "❌ Falha ao enviar arquivo após $MAX_ATTEMPTS tentativas"
    exit 1
fi

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
echo "  ls -la"
echo ""
