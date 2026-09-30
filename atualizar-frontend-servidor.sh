#!/bin/bash

# Script para atualizar o frontend no servidor

echo "🔄 Atualizando frontend no servidor..."

# 1. Fazer build local
echo "📦 Fazendo build do frontend..."
cd apps/web
npm run build

# 2. Copiar para o servidor
echo "📤 Enviando arquivos para o servidor..."
scp -r dist/* root@72.60.195.200:/var/www/crm-comercial/apps/web/dist/

echo "✅ Frontend atualizado com sucesso!"
echo "🌐 Acesse: http://crm.chorstconsult.com.br"
