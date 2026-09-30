#!/bin/bash

echo "🔧 Corrigindo textos no dark mode em todo o sistema..."

# Função para adicionar dark mode aos textos
fix_file() {
    local file=$1
    echo "  📝 Processando: $file"
    
    # text-gray-900 -> text-gray-900 dark:text-gray-100
    sed -i '' 's/text-gray-900"/text-gray-900 dark:text-gray-100"/g' "$file"
    sed -i '' "s/text-gray-900'/text-gray-900 dark:text-gray-100'/g" "$file"
    
    # text-gray-800 -> text-gray-800 dark:text-gray-100
    sed -i '' 's/text-gray-800"/text-gray-800 dark:text-gray-100"/g' "$file"
    sed -i '' "s/text-gray-800'/text-gray-800 dark:text-gray-100'/g" "$file"
    
    # text-gray-700 -> text-gray-700 dark:text-gray-200
    sed -i '' 's/text-gray-700"/text-gray-700 dark:text-gray-200"/g' "$file"
    sed -i '' "s/text-gray-700'/text-gray-700 dark:text-gray-200'/g" "$file"
    
    # text-gray-600 -> text-gray-600 dark:text-gray-300
    sed -i '' 's/text-gray-600"/text-gray-600 dark:text-gray-300"/g' "$file"
    sed -i '' "s/text-gray-600'/text-gray-600 dark:text-gray-300'/g" "$file"
    
    # text-gray-500 -> text-gray-500 dark:text-gray-400
    sed -i '' 's/text-gray-500"/text-gray-500 dark:text-gray-400"/g' "$file"
    sed -i '' "s/text-gray-500'/text-gray-500 dark:text-gray-400'/g" "$file"
    
    # text-gray-400 -> text-gray-400 dark:text-gray-500
    sed -i '' 's/text-gray-400"/text-gray-400 dark:text-gray-500"/g' "$file"
    sed -i '' "s/text-gray-400'/text-gray-400 dark:text-gray-500'/g" "$file"
    
    # bg-white -> bg-white dark:bg-[#2d4a6f]
    sed -i '' 's/bg-white rounded/bg-white dark:bg-[#2d4a6f] rounded/g' "$file"
    sed -i '' 's/bg-white border/bg-white dark:bg-[#2d4a6f] border/g' "$file"
    sed -i '' 's/bg-white shadow/bg-white dark:bg-[#2d4a6f] shadow/g' "$file"
    sed -i '' 's/bg-white p-/bg-white dark:bg-[#2d4a6f] p-/g' "$file"
    
    # border-gray-200 -> border-gray-200 dark:border-blue-500/20
    sed -i '' 's/border-gray-200"/border-gray-200 dark:border-blue-500\/20"/g' "$file"
    sed -i '' "s/border-gray-200'/border-gray-200 dark:border-blue-500\/20'/g" "$file"
    
    # border-gray-300 -> border-gray-300 dark:border-blue-500/30
    sed -i '' 's/border-gray-300"/border-gray-300 dark:border-blue-500\/30"/g' "$file"
    sed -i '' "s/border-gray-300'/border-gray-300 dark:border-blue-500\/30'/g" "$file"
}

# Processar todos os arquivos JSX
echo "📂 Processando páginas..."
for file in apps/web/src/pages/*.jsx; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo ""
echo "📂 Processando componentes..."
for file in apps/web/src/components/*.jsx; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo ""
echo "📂 Processando layout..."
for file in apps/web/src/layout/*.jsx; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo ""
echo "✅ Correção concluída!"
echo "🔨 Executando build..."
