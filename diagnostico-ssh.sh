#!/bin/bash
# ============================================
# Diagnóstico Completo de Conexão SSH
# ============================================

SERVER_IP="209.50.241.25"
SERVER_USER="root"
SERVER_PORT="22"
SERVER_PASS="<SSH_PASSWORD>"

echo "🔍 Diagnóstico completo de conexão SSH"
echo "======================================"
echo "IP: $SERVER_IP"
echo "Usuário: $SERVER_USER"
echo "Porta: $SERVER_PORT"
echo ""

# 1. Teste de conectividade básica
echo "1️⃣ Testando conectividade de rede..."
if ping -c 3 -W 5 $SERVER_IP > /dev/null 2>&1; then
    echo "✅ Ping: Servidor responde"
else
    echo "❌ Ping: Servidor não responde"
    echo "   Possíveis causas:"
    echo "   - Servidor offline"
    echo "   - Firewall bloqueando ICMP"
    echo "   - IP incorreto"
fi

echo ""

# 2. Teste de porta SSH
echo "2️⃣ Testando porta SSH ($SERVER_PORT)..."
if timeout 10 bash -c "</dev/tcp/$SERVER_IP/$SERVER_PORT" 2>/dev/null; then
    echo "✅ Porta SSH: Aberta e acessível"
else
    echo "❌ Porta SSH: Não acessível"
    echo "   Possíveis causas:"
    echo "   - SSH não está rodando"
    echo "   - Porta diferente de 22"
    echo "   - Firewall bloqueando"
fi

echo ""

# 3. Teste de SSH sem senha (para ver se aceita conexão)
echo "3️⃣ Testando handshake SSH..."
ssh_output=$(ssh -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP -p $SERVER_PORT exit 2>&1)
ssh_exit_code=$?

if [ $ssh_exit_code -eq 0 ]; then
    echo "✅ SSH: Conecta sem senha (chave SSH configurada)"
elif echo "$ssh_output" | grep -q "Permission denied"; then
    echo "✅ SSH: Servidor aceita conexão mas rejeita credenciais"
    echo "   Isso é normal - servidor está funcionando"
elif echo "$ssh_output" | grep -q "Connection refused"; then
    echo "❌ SSH: Conexão recusada"
    echo "   SSH não está rodando na porta $SERVER_PORT"
elif echo "$ssh_output" | grep -q "No route to host"; then
    echo "❌ SSH: Sem rota para o host"
    echo "   Problema de rede ou firewall"
elif echo "$ssh_output" | grep -q "Connection timed out"; then
    echo "❌ SSH: Timeout de conexão"
    echo "   Firewall ou servidor não responde"
else
    echo "⚠️  SSH: Resposta inesperada:"
    echo "   $ssh_output"
fi

echo ""

# 4. Teste com sshpass se disponível
echo "4️⃣ Testando autenticação com senha..."
if command -v sshpass &> /dev/null; then
    echo "   sshpass encontrado - testando com senha..."
    
    sshpass_output=$(sshpass -p "$SERVER_PASS" ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP -p $SERVER_PORT "echo 'Conexão OK'" 2>&1)
    sshpass_exit_code=$?
    
    if [ $sshpass_exit_code -eq 0 ]; then
        echo "✅ Autenticação: Sucesso com senha"
        echo "   Resposta: $sshpass_output"
    else
        echo "❌ Autenticação: Falhou com senha"
        echo "   Erro: $sshpass_output"
        
        if echo "$sshpass_output" | grep -q "Permission denied"; then
            echo "   Causa: Senha incorreta ou usuário inválido"
        elif echo "$sshpass_output" | grep -q "Connection refused"; then
            echo "   Causa: SSH não aceita conexões"
        fi
    fi
else
    echo "   sshpass não instalado - instalando..."
    
    # Tentar instalar sshpass
    if command -v brew &> /dev/null; then
        echo "   Instalando via Homebrew..."
        brew install sshpass 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "✅ sshpass instalado com sucesso"
            echo "   Execute o script novamente para testar com senha"
        else
            echo "❌ Falha ao instalar sshpass via Homebrew"
        fi
    elif command -v apt-get &> /dev/null; then
        echo "   Instalando via apt..."
        sudo apt-get update && sudo apt-get install -y sshpass
    elif command -v yum &> /dev/null; then
        echo "   Instalando via yum..."
        sudo yum install -y sshpass
    else
        echo "   ⚠️  Não foi possível instalar sshpass automaticamente"
        echo "   Instale manualmente:"
        echo "   - macOS: brew install sshpass"
        echo "   - Ubuntu/Debian: sudo apt-get install sshpass"
        echo "   - CentOS/RHEL: sudo yum install sshpass"
    fi
fi

echo ""

# 5. Teste manual
echo "5️⃣ Teste manual de SSH..."
echo "   Execute este comando manualmente:"
echo "   ssh -v $SERVER_USER@$SERVER_IP -p $SERVER_PORT"
echo ""
echo "   Se pedir senha, use: $SERVER_PASS"
echo ""

# 6. Portas alternativas comuns
echo "6️⃣ Testando portas SSH alternativas..."
for port in 2222 2200 22000; do
    if timeout 5 bash -c "</dev/tcp/$SERVER_IP/$port" 2>/dev/null; then
        echo "✅ Porta $port: Aberta (SSH pode estar aqui)"
    fi
done

echo ""
echo "🔧 Soluções sugeridas:"
echo "================================"
echo "1. Verifique se o IP está correto: $SERVER_IP"
echo "2. Confirme as credenciais com o provedor"
echo "3. Teste conexão manual: ssh $SERVER_USER@$SERVER_IP"
echo "4. Verifique se o servidor não está em manutenção"
echo "5. Confirme se SSH está habilitado para root"
echo ""
echo "📞 Entre em contato com o provedor se o problema persistir"