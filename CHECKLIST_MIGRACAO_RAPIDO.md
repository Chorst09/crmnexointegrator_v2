# ⚡ Checklist Rápido de Migração

## 🚀 Migração em 5 Fases

### FASE 1: Preparar Novo Servidor (5-10 min)

```bash
# 1. SSH no novo servidor
ssh root@SEU_IP_NOVO

# 2. Clonar repositório
git clone https://github.com/seu-usuario/crm-comercial.git
cd crm-comercial

# 3. Preparar servidor
chmod +x scripts/*.sh
./scripts/preparar-servidor-definitivo.sh

# ✓ Quando terminar, você terá:
# - Node.js 18
# - PostgreSQL
# - PM2
# - Firewall configurado
```

---

### FASE 2: Fazer Backup (5-15 min)

```bash
# 1. SSH no servidor provisório
ssh root@72.60.195.200

# 2. Clonar repositório
git clone https://github.com/seu-usuario/crm-comercial.git
cd crm-comercial

# 3. Fazer backup
chmod +x scripts/*.sh
./scripts/backup-completo.sh

# ✓ Anotar o diretório criado
# Exemplo: ~/crm-backup-20240218-143022
```

---

### FASE 3: Transferir Backup (5-30 min)

```bash
# 1. No seu Mac - Baixar do servidor provisório
scp -r root@72.60.195.200:~/crm-backup-20240218-143022 ~/Downloads/

# 2. No seu Mac - Enviar para novo servidor
scp -r ~/Downloads/crm-backup-20240218-143022 root@SEU_IP_NOVO:~/

# ✓ Verificar se chegou
ssh root@SEU_IP_NOVO "ls -lh ~/crm-backup-20240218-143022"
```

---

### FASE 4: Restaurar Backup (5-10 min)

```bash
# 1. SSH no novo servidor
ssh root@SEU_IP_NOVO

# 2. Restaurar
cd ~/crm-comercial/scripts
./restaurar-backup.sh ~/crm-backup-20240218-143022

# ✓ Quando terminar, você terá:
# - Banco de dados restaurado
# - Aplicação restaurada
# - Uploads restaurados
```

---

### FASE 5: Configurar e Iniciar (10-15 min)

```bash
# 1. SSH no novo servidor
ssh root@SEU_IP_NOVO

# 2. Atualizar .env da API
nano /var/www/crm-comercial/apps/api/.env

# Atualizar:
# NODE_ENV=production
# PORT=8081
# DATABASE_URL=postgresql://crm_user:SENHA@localhost:5432/crm_comercial
# CORS_ORIGIN=http://SEU_IP:8081

# 3. Atualizar .env do Frontend
nano /var/www/crm-comercial/apps/web/.env

# Atualizar:
# VITE_API_URL=http://SEU_IP:8081/api

# 4. Build do frontend
cd /var/www/crm-comercial/apps/web
npm run build

# 5. Iniciar aplicação
cd /var/www/crm-comercial
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# ✓ Quando terminar, execute:
# ./scripts/verificar-migracao.sh
```

---

## 🔍 Verificação Rápida

```bash
# SSH no novo servidor
ssh root@SEU_IP_NOVO

# Executar verificação
cd ~/crm-comercial/scripts
./verificar-migracao.sh

# ✓ Deve retornar: "Migração bem-sucedida!"
```

---

## 🧪 Teste de Login

```bash
# Abrir navegador
http://SEU_IP:8081

# Fazer login
Email: admin@crm.com
Senha: admin123

# ✓ Deve redirecionar para dashboard
```

---

## 🆘 Troubleshooting Rápido

### API não responde
```bash
pm2 logs crm-api --lines 50
pm2 restart crm-api
```

### Banco de dados não conecta
```bash
psql -U crm_user -h localhost -d crm_comercial -c "SELECT 1"
```

### Porta 8081 em uso
```bash
netstat -tulpn | grep 8081
lsof -i :8081
```

### Frontend não carrega
```bash
cd /var/www/crm-comercial/apps/web
npm run build
pm2 restart crm-api
```

---

## 📋 Checklist Essencial

- [ ] Novo servidor preparado
- [ ] Backup criado
- [ ] Backup transferido
- [ ] Backup restaurado
- [ ] .env atualizado
- [ ] Frontend buildado
- [ ] PM2 iniciado
- [ ] Verificação passou
- [ ] Login funciona
- [ ] Dashboard carrega

---

## ⏱️ Tempo Total: 35-90 minutos

**Desenvolvido com ❤️ para facilitar sua migração**
