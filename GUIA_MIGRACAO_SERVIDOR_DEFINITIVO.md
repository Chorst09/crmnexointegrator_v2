# 🚀 Guia Completo de Migração para Servidor Definitivo

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Preparação do Ambiente Atual](#preparação-do-ambiente-atual)
3. [Backup Completo](#backup-completo)
4. [Preparação do Servidor Definitivo](#preparação-do-servidor-definitivo)
5. [Migração do Banco de Dados](#migração-do-banco-de-dados)
6. [Migração da Aplicação](#migração-da-aplicação)
7. [Configuração e Testes](#configuração-e-testes)
8. [Checklist Final](#checklist-final)

---

## 🎯 Visão Geral

### Situação Atual
- **Servidor Provisório**: Hostinger (72.60.195.200)
- **Porta**: 8081
- **Banco de Dados**: PostgreSQL (crm_comercial)
- **Diretório**: /var/www/crm-comercial
- **Processo PM2**: crm-api

### Objetivo
Migrar todo o sistema para um servidor definitivo sem perda de:
- ✅ Dados do banco (usuários, empresas, oportunidades, etc.)
- ✅ Configurações (.env, PM2, etc.)
- ✅ Arquivos enviados (uploads, anexos)
- ✅ Logs e histórico

---

## 📦 1. Preparação do Ambiente Atual

### 1.1 Conectar ao Servidor Provisório

```bash
# Conectar via SSH
ssh root@72.60.195.200
# ou
ssh seu-usuario@72.60.195.200
```

### 1.2 Verificar Status Atual

```bash
# Verificar processo PM2
pm2 list

# Verificar banco de dados
sudo -u postgres psql -c "\l" | grep crm_comercial

# Verificar espaço em disco
df -h

# Verificar tamanho do banco
sudo -u postgres psql -d crm_comercial -c "SELECT pg_size_pretty(pg_database_size('crm_comercial'));"
```

### 1.3 Documentar Configurações Atuais

```bash
# Salvar configurações do PM2
pm2 save
pm2 describe crm-api > ~/crm-pm2-config.txt

# Copiar arquivo .env
cd /var/www/crm-comercial/apps/api
cat .env > ~/crm-env-backup.txt

# Listar portas em uso
sudo netstat -tulpn | grep 8081
```

---

## 💾 2. Backup Completo

### 2.1 Criar Diretório de Backup

```bash
# No servidor provisório
mkdir -p ~/crm-backup-$(date +%Y%m%d)
cd ~/crm-backup-$(date +%Y%m%d)
```

### 2.2 Backup do Banco de Dados

```bash
# Backup completo do PostgreSQL
sudo -u postgres pg_dump crm_comercial > crm_comercial_backup.sql

# Backup com compressão (recomendado)
sudo -u postgres pg_dump crm_comercial | gzip > crm_comercial_backup.sql.gz

# Verificar tamanho do backup
ls -lh crm_comercial_backup.sql.gz

# Backup em formato custom (permite restore parcial)
sudo -u postgres pg_dump -Fc crm_comercial > crm_comercial_backup.dump
```

### 2.3 Backup dos Arquivos da Aplicação

```bash
# Backup do código e configurações
cd /var/www
tar -czf ~/crm-backup-$(date +%Y%m%d)/crm-aplicacao.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='logs/*.log' \
  crm-comercial/

# Backup APENAS dos arquivos essenciais
tar -czf ~/crm-backup-$(date +%Y%m%d)/crm-essencial.tar.gz \
  crm-comercial/apps/api/.env \
  crm-comercial/apps/api/prisma/ \
  crm-comercial/apps/api/uploads/ \
  crm-comercial/apps/web/.env \
  crm-comercial/ecosystem.config.js
```

### 2.4 Backup dos Uploads e Anexos

```bash
# Backup separado dos arquivos enviados
cd /var/www/crm-comercial/apps/api
tar -czf ~/crm-backup-$(date +%Y%m%d)/crm-uploads.tar.gz uploads/

# Listar arquivos de upload
find uploads/ -type f | wc -l
du -sh uploads/
```

### 2.5 Exportar Configurações do Sistema

```bash
# Salvar versões instaladas
node --version > ~/crm-backup-$(date +%Y%m%d)/versions.txt
npm --version >> ~/crm-backup-$(date +%Y%m%d)/versions.txt
pm2 --version >> ~/crm-backup-$(date +%Y%m%d)/versions.txt
psql --version >> ~/crm-backup-$(date +%Y%m%d)/versions.txt

# Salvar lista de pacotes globais
npm list -g --depth=0 > ~/crm-backup-$(date +%Y%m%d)/npm-global.txt

# Salvar configuração do PM2
pm2 save
cp ~/.pm2/dump.pm2 ~/crm-backup-$(date +%Y%m%d)/
```

### 2.6 Baixar Backup para Seu Computador

```bash
# No seu Mac, abra um novo terminal
cd ~/Documents

# Baixar todos os backups
scp -r root@72.60.195.200:~/crm-backup-$(date +%Y%m%d) ./

# Ou baixar arquivo por arquivo
scp root@72.60.195.200:~/crm-backup-*/crm_comercial_backup.sql.gz ./
scp root@72.60.195.200:~/crm-backup-*/crm-aplicacao.tar.gz ./
scp root@72.60.195.200:~/crm-backup-*/crm-uploads.tar.gz ./
```

---

## 🖥️ 3. Preparação do Servidor Definitivo

### 3.1 Requisitos Mínimos

```
CPU: 2+ cores
RAM: 4GB+ (recomendado 8GB)
Disco: 50GB+ SSD
SO: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
```

### 3.2 Conectar ao Servidor Definitivo

```bash
# Conectar via SSH
ssh root@SEU_SERVIDOR_DEFINITIVO
# ou
ssh seu-usuario@SEU_SERVIDOR_DEFINITIVO
```

### 3.3 Atualizar Sistema

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 3.4 Instalar Dependências

```bash
# Node.js 18+ (recomendado usar nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
nvm alias default 18

# PM2
npm install -g pm2

# PostgreSQL
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib -y

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib -y
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Git (opcional, mas recomendado)
sudo apt install git -y  # Ubuntu/Debian
sudo yum install git -y  # CentOS/RHEL
```

### 3.5 Configurar Firewall

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8081/tcp  # CRM API
sudo ufw enable

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --reload
```

---

## 🗄️ 4. Migração do Banco de Dados

### 4.1 Configurar PostgreSQL no Servidor Definitivo

```bash
# Criar usuário do banco
sudo -u postgres createuser crm_user -P
# Digite uma senha forte quando solicitado

# Criar banco de dados
sudo -u postgres createdb crm_comercial -O crm_user

# Configurar acesso local
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Adicionar linha:
# local   crm_comercial   crm_user                md5
# host    crm_comercial   crm_user   127.0.0.1/32 md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### 4.2 Enviar Backup do Banco

```bash
# No seu Mac
scp ~/Documents/crm-backup-*/crm_comercial_backup.sql.gz \
  root@SEU_SERVIDOR_DEFINITIVO:~/
```

### 4.3 Restaurar Banco de Dados

```bash
# No servidor definitivo
cd ~

# Descompactar backup
gunzip crm_comercial_backup.sql.gz

# Restaurar banco
sudo -u postgres psql crm_comercial < crm_comercial_backup.sql

# Ou se usou formato custom:
# sudo -u postgres pg_restore -d crm_comercial crm_comercial_backup.dump

# Verificar restauração
sudo -u postgres psql -d crm_comercial -c "\dt"
sudo -u postgres psql -d crm_comercial -c "SELECT COUNT(*) FROM \"User\";"
sudo -u postgres psql -d crm_comercial -c "SELECT COUNT(*) FROM \"Company\";"
sudo -u postgres psql -d crm_comercial -c "SELECT COUNT(*) FROM \"Opportunity\";"
```

### 4.4 Ajustar Permissões

```bash
# Dar permissões ao usuário crm_user
sudo -u postgres psql crm_comercial << EOF
GRANT ALL PRIVILEGES ON DATABASE crm_comercial TO crm_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_user;
EOF
```

---

## 📁 5. Migração da Aplicação

### 5.1 Criar Estrutura de Diretórios

```bash
# No servidor definitivo
sudo mkdir -p /var/www/crm-comercial
sudo chown -R $USER:$USER /var/www/crm-comercial
```

### 5.2 Enviar Arquivos da Aplicação

```bash
# No seu Mac
scp ~/Documents/crm-backup-*/crm-aplicacao.tar.gz \
  root@SEU_SERVIDOR_DEFINITIVO:/var/www/

scp ~/Documents/crm-backup-*/crm-uploads.tar.gz \
  root@SEU_SERVIDOR_DEFINITIVO:/var/www/
```

### 5.3 Descompactar e Configurar

```bash
# No servidor definitivo
cd /var/www

# Descompactar aplicação
tar -xzf crm-aplicacao.tar.gz

# Descompactar uploads
cd /var/www/crm-comercial/apps/api
tar -xzf /var/www/crm-uploads.tar.gz

# Instalar dependências do backend
cd /var/www/crm-comercial/apps/api
npm install --production

# Instalar dependências do frontend
cd /var/www/crm-comercial/apps/web
npm install
```

### 5.4 Configurar Variáveis de Ambiente

```bash
# Editar .env do backend
cd /var/www/crm-comercial/apps/api
nano .env
```

Ajuste as seguintes variáveis:

```env
NODE_ENV=production
PORT=8081

# IMPORTANTE: Atualizar com as credenciais do novo servidor
DATABASE_URL=postgresql://crm_user:SUA_SENHA_AQUI@localhost:5432/crm_comercial

JWT_SECRET=seu-segredo-jwt-forte-aqui

# Atualizar com o IP/domínio do novo servidor
CORS_ORIGIN=http://SEU_IP_OU_DOMINIO:8081
```

```bash
# Editar .env do frontend
cd /var/www/crm-comercial/apps/web
nano .env
```

```env
# Atualizar com o IP/domínio do novo servidor
VITE_API_URL=http://SEU_IP_OU_DOMINIO:8081/api
```

### 5.5 Build do Frontend

```bash
cd /var/www/crm-comercial/apps/web
npm run build

# Verificar se o build foi criado
ls -la dist/
```

### 5.6 Configurar PM2

```bash
# Criar arquivo de configuração do PM2
cd /var/www/crm-comercial
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'crm-api',
    script: './apps/api/server.cjs',
    cwd: '/var/www/crm-comercial',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    error_file: './logs/api-error.log',
    out_file: './logs/api-out.log',
    log_file: './logs/api-combined.log',
    time: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false
  }]
};
```

### 5.7 Iniciar Aplicação

```bash
# Criar diretório de logs
mkdir -p /var/www/crm-comercial/logs

# Iniciar com PM2
cd /var/www/crm-comercial
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
# Execute o comando que o PM2 mostrar

# Verificar status
pm2 status
pm2 logs crm-api --lines 50
```

---

## ✅ 6. Configuração e Testes

### 6.1 Testar Conexão com Banco

```bash
cd /var/www/crm-comercial/apps/api
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => console.log('✅ Conectado!')).catch(e => console.error('❌ Erro:', e));"
```

### 6.2 Testar API

```bash
# Testar health check
curl http://localhost:8081/api/health

# Testar login
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm.com","password":"admin123"}'
```

### 6.3 Testar Frontend

```bash
# Acessar no navegador
http://SEU_IP_OU_DOMINIO:8081

# Ou testar com curl
curl -I http://localhost:8081
```

### 6.4 Verificar Logs

```bash
# Logs do PM2
pm2 logs crm-api --lines 100

# Logs do sistema
tail -f /var/www/crm-comercial/logs/api-combined.log

# Logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### 6.5 Testar Funcionalidades Principais

1. **Login**: Testar com usuário admin
2. **Dashboard**: Verificar se os dados aparecem
3. **Empresas**: Listar empresas migradas
4. **Oportunidades**: Verificar pipeline
5. **Upload**: Testar envio de arquivo
6. **Relatórios**: Gerar um relatório

---

## 📋 7. Checklist Final

### 7.1 Antes de Desligar o Servidor Provisório

```
✅ Backup do banco realizado e testado
✅ Backup dos arquivos realizado
✅ Backup dos uploads realizado
✅ Backups baixados para seu computador
✅ Banco restaurado no servidor definitivo
✅ Aplicação funcionando no servidor definitivo
✅ Todos os dados visíveis (usuários, empresas, etc.)
✅ Login funcionando
✅ Upload de arquivos funcionando
✅ Relatórios funcionando
✅ PM2 configurado para iniciar no boot
✅ Firewall configurado
✅ DNS atualizado (se aplicável)
```

### 7.2 Manter Servidor Provisório Ativo

**IMPORTANTE**: Mantenha o servidor provisório ativo por pelo menos 7-14 dias após a migração:

```bash
# No servidor provisório, parar a aplicação (mas não deletar)
pm2 stop crm-api

# Manter os backups
ls -lh ~/crm-backup-*/
```

### 7.3 Monitoramento Pós-Migração

```bash
# No servidor definitivo
# Monitorar uso de recursos
pm2 monit

# Verificar logs diariamente
pm2 logs crm-api --lines 100

# Verificar espaço em disco
df -h

# Verificar uso de memória
free -h

# Verificar conexões do banco
sudo -u postgres psql -d crm_comercial -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## 🔄 8. Rollback (Se Necessário)

Se algo der errado, você pode voltar ao servidor provisório:

```bash
# No servidor provisório
pm2 start crm-api

# Atualizar DNS de volta (se mudou)
# Redirecionar tráfego de volta
```

---

## 📞 9. Suporte e Troubleshooting

### Problemas Comuns

**Erro de conexão com banco:**
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Verificar credenciais no .env
cat /var/www/crm-comercial/apps/api/.env | grep DATABASE_URL

# Testar conexão manual
psql -U crm_user -d crm_comercial -h localhost
```

**Aplicação não inicia:**
```bash
# Ver logs detalhados
pm2 logs crm-api --err --lines 200

# Verificar porta em uso
sudo netstat -tulpn | grep 8081

# Reiniciar aplicação
pm2 restart crm-api
```

**Frontend não carrega:**
```bash
# Verificar se o build existe
ls -la /var/www/crm-comercial/apps/web/dist/

# Verificar variável de ambiente
cat /var/www/crm-comercial/apps/web/.env

# Rebuild
cd /var/www/crm-comercial/apps/web
npm run build
pm2 restart crm-api
```

---

## 🎯 Resumo dos Comandos Principais

```bash
# === NO SERVIDOR PROVISÓRIO ===
# 1. Backup do banco
sudo -u postgres pg_dump crm_comercial | gzip > ~/crm_backup.sql.gz

# 2. Backup da aplicação
tar -czf ~/crm_app.tar.gz --exclude='node_modules' /var/www/crm-comercial/

# === NO SEU MAC ===
# 3. Baixar backups
scp root@72.60.195.200:~/crm_backup.sql.gz ./
scp root@72.60.195.200:~/crm_app.tar.gz ./

# === NO SERVIDOR DEFINITIVO ===
# 4. Restaurar banco
gunzip crm_backup.sql.gz
sudo -u postgres psql crm_comercial < crm_backup.sql

# 5. Descompactar aplicação
tar -xzf crm_app.tar.gz -C /var/www/

# 6. Instalar e iniciar
cd /var/www/crm-comercial/apps/api
npm install --production
pm2 start ecosystem.config.js
pm2 save
```

---

## ✨ Conclusão

Seguindo este guia, você terá:

1. ✅ Backup completo e seguro de todos os dados
2. ✅ Migração sem perda de informações
3. ✅ Servidor definitivo configurado e funcionando
4. ✅ Possibilidade de rollback se necessário
5. ✅ Documentação completa do processo

**Tempo estimado**: 2-4 horas (dependendo do tamanho do banco e velocidade da internet)

**Próximos passos recomendados**:
- Configurar SSL/HTTPS (Let's Encrypt)
- Configurar backups automáticos
- Configurar monitoramento (Grafana, Prometheus)
- Configurar domínio personalizado
- Implementar CI/CD

---

**Desenvolvido com ❤️ para garantir uma migração segura e sem perdas**
