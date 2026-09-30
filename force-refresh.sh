#!/bin/bash

echo "🔄 Forçando atualização do frontend..."

# Limpar cache do Vite
echo "🗑️  Limpando cache do Vite..."
rm -rf apps/web/node_modules/.vite
rm -rf apps/web/dist

echo "✅ Cache limpo!"
echo ""
echo "📝 Agora faça o seguinte:"
echo "1. No terminal onde está rodando 'npm run dev', pressione Ctrl+C para parar"
echo "2. Execute novamente: npm run dev"
echo "3. No navegador, pressione Cmd+Shift+R (Mac) ou Ctrl+Shift+R (Windows/Linux)"
echo "4. Acesse: http://localhost:5174/"
echo ""
echo "Se ainda não funcionar, execute: npm run dev -- --force"
