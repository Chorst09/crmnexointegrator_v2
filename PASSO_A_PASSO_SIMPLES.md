# 🚀 Passo a Passo Simples - Deploy do CRM

## ⚠️ IMPORTANTE: Você precisa de 2 terminais

1. **Terminal 1**: Seu Mac (para enviar arquivos)
2. **Terminal 2**: Servidor SSH (você já está conectado)

---

## 📍 PASSO 1: No seu Mac

Abra um **NOVO terminal** no seu Mac e execute:

```bash
# Ir para o diretório do projeto
cd ~/caminho/do/projeto/crmcomercialkvm

# Enviar arquivos para o servidor
./enviar-para-servidor.sh
```

Isso vai comprimir e enviar os arquivos para o servidor.

---

## 📍 PASSO 2: No Servidor (terminal que você já tem aberto)

Depois que o PASSO 1 terminar, execute no servidor:

```bash
# Ir para o diretório
cd /var/www/crm-comercial

# Descompactar arquivos
tar -xzf crm-deploy.tar.gz

# Remover arquivo comprimido
rm crm-deploy.tar.gz

# Listar para confirmar
ls -la
```

Você deve ver as pastas `apps/` criadas.

---

## 📍 PASSO 3: Criar e executar script de instalação

No servidor, copie e cole este comando inteiro (tudo de uma vez):

```bash
cat > /var/www/crm-comercial/instalar.sh << 'SCRIPT_END'
#!/bin/bash
set -e

echo "=========================================="
echo "  Instalação do CRM - Porta 8081"
echo "=========================================="
echo ""

if [ ! -d "apps/api" ]; then
    echo "❌ Erro: Execute em /var/www/crm-comercial"
    exit 1
fi

echo "✅ Diretório correto"
echo ""

# Configuração do banco
echo "📋 Configuração do Banco de Dados"
echo ""
read -p "Nome do banco [crm_comercial]: " DB_NAME
DB_NAME=${DB_NAME:-crm_comercial}

read -p "Usuário do banco [crm_user]: " DB_USER
DB_USER=${DB_USER:-crm_user}

read -sp "Senha do banco: " DB_PASS
echo ""

JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "TROQUE-POR-UM-SEGREDO-FORTE-$(date +%s)")

echo ""
echo "🔧 Configurando API..."

cat > apps/api/.env << EOF
NODE_ENV=production
PORT=8081
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public
JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=http://72.60.195.200:8081,http://localhost:8081
EOF

cat > apps/web/.env << EOF
VITE_API_URL=http://72.60.195.200:8081/api
EOF

cat > ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'crm-api',
    cwd: '/var/www/crm-comercial/apps/api',
    script: 'server.cjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    error_file: '/var/www/crm-comercial/logs/api-error.log',
    out_file: '/var/www/crm-comercial/logs/api-out.log',
    log_file: '/var/www/crm-comercial/logs/api-combined.log',
    time: true
  }]
};
EOFPM2

mkdir -p logs

echo "✅ Configurações criadas"
echo ""
echo "📦 Instalando dependências da API..."
cd apps/api
npm install --production

echo ""
echo "🔨 Gerando Prisma Client..."
npx prisma generate

echo ""
echo "🗄️  Executando migrações..."
npx prisma migrate deploy

echo ""
echo "🌱 Populando banco..."
npm run db:seed || echo "⚠️  Seed falhou"

echo ""
echo "📦 Instalando dependências do Frontend..."
cd ../web
npm install

echo ""
echo "🏗️  Build do Frontend..."
npm run build

echo ""
echo "🚀 Iniciando com PM2..."
cd ../..

pm2 stop crm-api 2>/dev/null || true
pm2 delete crm-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "=========================================="
echo "  ✅ CRM Instalado!"
echo "=========================================="
echo ""
echo "🌐 URL: http://72.60.195.200:8081"
echo ""
echo "👤 Login: admin@crm.com / admin123"
echo ""
echo "📊 Comandos:"
echo "  pm2 logs crm-api"
echo "  pm2 status"
echo ""
echo "⚠️  Execute: sudo ufw allow 8081/tcp"
echo ""
SCRIPT_END
```

Depois execute:

```bash
chmod +x /var/www/crm-comercial/instalar.sh
cd /var/www/crm-comercial
./instalar.sh
```

---

## 📍 PASSO 4: Configurar Firewall

```bash
sudo ufw allow 8081/tcp
```

---

## 📍 PASSO 5: Testar

```bash
# Testar API
curl http://localhost:8081/api/health

# Ver logs
pm2 logs crm-api

# Ver status
pm2 status
```

---

## 🌐 Acessar

Abra no navegador: **http://72.60.195.200:8081**

Login: `admin@crm.com` / `admin123`

---

## 🆘 Problemas?

```bash
# Ver logs
pm2 logs crm-api

# Reiniciar
pm2 restart crm-api

# Ver processos
pm2 list
```

---

## ✅ Resumo dos Comandos

### No Mac:
```bash
cd ~/caminho/do/projeto/crmcomercialkvm
./enviar-para-servidor.sh
```

### No Servidor:
```bash
cd /var/www/crm-comercial
tar -xzf crm-deploy.tar.gz
rm crm-deploy.tar.gz
# Copiar e colar o script de instalação (PASSO 3)
chmod +x instalar.sh
./instalar.sh
sudo ufw allow 8081/tcp
```

Pronto! 🎉
