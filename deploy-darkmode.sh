#!/bin/bash

echo "🚀 Fazendo deploy das melhorias de dark mode..."

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER="usuario@72.60.195.200"
PASSWORD='Ch@#horst1977#@'

echo -e "${BLUE}📤 Enviando arquivos para o servidor...${NC}"

# Usar sshpass se disponível, senão usar expect
if command -v sshpass &> /dev/null; then
    sshpass -p "$PASSWORD" scp crm-update-darkmode.tar.gz $SERVER:/tmp/
    
    echo -e "${BLUE}📦 Extraindo arquivos no servidor...${NC}"
    sshpass -p "$PASSWORD" ssh $SERVER << 'ENDSSH'
        cd /var/www/crm-comercial
        tar -xzf /tmp/crm-update-darkmode.tar.gz
        echo "✅ Arquivos extraídos"
        
        # Reiniciar serviço se existir
        if systemctl is-active --quiet crm-comercial; then
            sudo systemctl restart crm-comercial
            echo "✅ Serviço reiniciado"
        else
            echo "⚠️  Serviço não encontrado, apenas arquivos atualizados"
        fi
        
        # Limpar cache nginx
        sudo systemctl reload nginx 2>/dev/null || true
        
        rm /tmp/crm-update-darkmode.tar.gz
        echo "✅ Deploy concluído!"
ENDSSH
else
    echo "⚠️  sshpass não instalado. Instalando..."
    brew install hudochenkov/sshpass/sshpass
    
    if [ $? -eq 0 ]; then
        echo "✅ sshpass instalado. Execute o script novamente."
    else
        echo "❌ Erro ao instalar sshpass. Use o método manual:"
        echo ""
        echo "1. scp crm-update-darkmode.tar.gz $SERVER:/tmp/"
        echo "2. ssh $SERVER"
        echo "3. cd /var/www/crm-comercial && tar -xzf /tmp/crm-update-darkmode.tar.gz"
        echo "4. sudo systemctl restart crm-comercial"
    fi
fi

echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo ""
echo "🌐 Acesse: http://72.60.195.200:8081"
echo "💡 Faça um hard refresh (Ctrl+Shift+R) no navegador"
