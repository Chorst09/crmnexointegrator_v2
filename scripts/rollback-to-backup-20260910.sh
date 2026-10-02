#!/bin/bash
# Script de Rollback para Versão Funcional - 10/09/2026

echo "🚨 ROLLBACK PARA VERSÃO FUNCIONAL"
echo "=================================="
echo ""
echo "⚠️  ATENÇÃO: Este script fará rollback para a versão funcional testada"
echo ""
echo "Tag Git: v-backup-funcional-20260910-084933"
echo "Commit: 0dda50c"
echo ""

read -p "Deseja continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operação cancelada"
    exit 1
fi

echo ""
echo "📥 Fazendo checkout para a tag de backup..."
git checkout v-backup-funcional-20260910-084933

echo ""
echo "📦 Instalando dependências..."
npm run install:all

echo ""
echo "🔄 Aplicando migrations..."
cd apps/api && npx prisma migrate deploy

echo ""
echo "✅ Rollback concluído!"
echo ""
echo "Para voltar ao estado anterior, use:"
echo "  git checkout main"
echo ""

