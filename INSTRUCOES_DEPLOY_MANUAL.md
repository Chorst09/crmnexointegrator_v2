# 🚀 Deploy Manual - NexosCRM

O pacote `nexoscrm-deploy.tar.gz` foi criado com sucesso! 

## 📋 Passo a Passo

### 1️⃣ Conectar ao Servidor
```bash
ssh root@209.50.241.25
```
**Senha**: `<SSH_PASSWORD>`

### 2️⃣ Preparar Diretório
```bash
mkdir -p /opt/nexoscrm
cd /opt/nexoscrm
```

### 3️⃣ Instalar Docker (se necessário)
```bash
# Verificar se Docker existe
docker --version

# Se não existir, instalar:
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Instalar Docker Compose
apt-get update
apt-get install -y docker-compose-plugin
```

### 4️⃣ Sair e Enviar Arquivos
```bash
# Sair do servidor
exit

# Enviar pacote (do seu computador)
scp nexoscrm-deploy.tar.gz root@209.50.241.25:/opt/nexoscrm/
```

### 5️⃣ Conectar e Extrair
```bash
# Conectar novamente
ssh root@209.50.241.25

# Ir para diretório e extrair
cd /opt/nexoscrm
tar -xzf nexoscrm-deploy.tar.gz
cp .env.production .env
```

### 6️⃣ Fazer Deploy
```bash
# Subir containers
docker compose -f docker-compose.production.yml up -d --build

# Aguardar containers iniciarem (30 segundos)
sleep 30

# Verificar status
docker compose -f docker-compose.production.yml ps
```

### 7️⃣ Configurar Banco
```bash
# Executar migrations
docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy

# Criar usuário admin e configurações
docker compose -f docker-compose.production.yml exec backend node prisma/migrate-production.js
```

## ✅ Pronto!

**Acesse**: http://209.50.241.25
**Login**: admin@nexoscrm.com
**Senha**: <ADMIN_PASSWORD>

## 🔧 Comandos Úteis

```bash
# Ver logs
docker compose -f docker-compose.production.yml logs -f

# Reiniciar
docker compose -f docker-compose.production.yml restart

# Parar
docker compose -f docker-compose.production.yml down

# Status
docker compose -f docker-compose.production.yml ps
```

## 🚨 Se der erro

```bash
# Limpar tudo e recomeçar
docker compose -f docker-compose.production.yml down -v
docker system prune -f
docker compose -f docker-compose.production.yml up -d --build
```