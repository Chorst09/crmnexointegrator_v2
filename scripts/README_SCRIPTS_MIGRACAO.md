# 🛠️ Scripts de Migração do CRM

## 📋 Visão Geral

Esta pasta contém scripts automatizados para facilitar a migração do CRM do servidor provisório para o servidor definitivo.

## 📦 Scripts Disponíveis

### 1. `preparar-servidor-definitivo.sh`
**Onde executar**: Servidor definitivo (novo)

Prepara o servidor definitivo instalando todas as dependências necessárias.

**O que faz:**
- ✅ Atualiza o sistema operacional
- ✅ Instala Node.js 18 via NVM
- ✅ Instala PM2 globalmente
- ✅ Instala e configura PostgreSQL
- ✅ Cria usuário e banco de dados
- ✅ Configura firewall (portas 22, 80, 443, 8081)
- ✅ Cria estrutura de diretórios

**Como usar:**
```bash
# No servidor definitivo
chmod +x preparar-servidor-definitivo.sh
./preparar-servidor-definitivo.sh
```

**Tempo estimado**: 5-10 minutos

---

### 2. `backup-completo.sh`
**Onde executar**: Servidor provisório (Hostinger)

Cria um backup completo de tudo que precisa ser migrado.

**O que faz:**
- ✅ Backup do banco de dados PostgreSQL (compactado)
- ✅ Backup dos arquivos da aplicação
- ✅ Backup dos uploads e anexos
- ✅ Backup das configurações (.env, PM2)
- ✅ Gera relatório com checksums MD5
- ✅ Salva informações do sistema

**Como usar:**
```bash
# No servidor provisório
chmod +x backup-completo.sh
./backup-completo.sh
```

**Saída:**
```
~/crm-backup-YYYYMMDD-HHMMSS/
├── database.sql.gz          # Banco de dados
├── aplicacao.tar.gz         # Código da aplicação
├── uploads.tar.gz           # Arquivos enviados
├── system-info.txt          # Informações do sistema
└── VERIFICACAO.txt          # Checksums e verificação
```

**Tempo estimado**: 5-15 minutos (depende do tamanho do banco)

---

### 3. `restaurar-backup.sh`
**Onde executar**: Servidor definitivo (novo)

Restaura o backup no servidor definitivo.

**O que faz:**
- ✅ Verifica integridade dos arquivos de backup
- ✅ Restaura banco de dados PostgreSQL
- ✅ Configura permissões do banco
- ✅ Restaura arquivos da aplicação
- ✅ Restaura uploads e anexos
- ✅ Ajusta permissões dos arquivos

**Como usar:**
```bash
# No servidor definitivo
chmod +x restaurar-backup.sh
./restaurar-backup.sh ~/crm-backup-YYYYMMDD-HHMMSS
```

**Tempo estimado**: 5-10 minutos

---

### 4. `verificar-migracao.sh`
**Onde executar**: Servidor definitivo (novo)

Verifica se a migração foi bem-sucedida.

**O que faz:**
- ✅ Verifica PostgreSQL e conexão com banco
- ✅ Conta registros (usuários, empresas, oportunidades)
- ✅ Verifica Node.js, NPM e PM2
- ✅ Verifica status do processo crm-api
- ✅ Verifica arquivos da aplicação
- ✅ Testa endpoints da API
- ✅ Verifica logs de erro
- ✅ Verifica firewall
- ✅ Verifica recursos do sistema (memória, disco, CPU)

**Como usar:**
```bash
# No servidor definitivo
chmod +x verificar-migracao.sh
./verificar-migracao.sh
```

**Saída:**
- ✅ Verde: Tudo OK
- ⚠️ Amarelo: Avisos (não crítico)
- ❌ Vermelho: Erros (precisa correção)

**Tempo estimado**: 1-2 minutos

---

## 🚀 Fluxo Completo de Migração

### Passo 1: Preparar Servidor Definitivo
```bash
# SSH no servidor definitivo
ssh root@SEU_SERVIDOR_DEFINITIVO

# Baixar scripts (se ainda não tiver)
# Opção A: Via Git
git clone https://github.com/seu-repo/crm-comercial.git
cd crm-comercial/scripts

# Opção B: Via SCP (do seu Mac)
# scp -r scripts/ root@SEU_SERVIDOR_DEFINITIVO:~/

# Executar preparação
./preparar-servidor-definitivo.sh
```

### Passo 2: Fazer Backup no Servidor Provisório
```bash
# SSH no servidor provisório
ssh root@72.60.195.200

# Baixar scripts (se ainda não tiver)
cd ~
# ... copiar scripts ...

# Executar backup
./backup-completo.sh

# Anotar o diretório criado
# Exemplo: ~/crm-backup-20240218-143022
```

### Passo 3: Transferir Backup
```bash
# No seu Mac (novo terminal)
# Baixar do servidor provisório
scp -r root@72.60.195.200:~/crm-backup-YYYYMMDD-HHMMSS ~/Downloads/

# Enviar para servidor definitivo
scp -r ~/Downloads/crm-backup-YYYYMMDD-HHMMSS root@SEU_SERVIDOR_DEFINITIVO:~/
```

### Passo 4: Restaurar no Servidor Definitivo
```bash
# SSH no servidor definitivo
ssh root@SEU_SERVIDOR_DEFINITIVO

# Restaurar backup
cd ~/scripts  # ou onde estão os scripts
./restaurar-backup.sh ~/crm-backup-YYYYMMDD-HHMMSS
```

### Passo 5: Configurar Aplicação
```bash
# Ainda no servidor definitivo

# 1. Configurar .env do backend
nano /var/www/crm-comercial/apps/api/.env

# Atualizar:
# - DATABASE_URL (usar a que está em /tmp/crm_database_url.txt)
# - JWT_SECRET (gerar um novo ou usar o do backup)
# - CORS_ORIGIN (atualizar com IP/domínio do novo servidor)

# 2. Configurar .env do frontend
nano /var/www/crm-comercial/apps/web/.env

# Atualizar:
# - VITE_API_URL (atualizar com IP/domínio do novo servidor)

# 3. Instalar dependências
cd /var/www/crm-comercial/apps/api
npm install --production

cd /var/www/crm-comercial/apps/web
npm install
npm run build

# 4. Iniciar aplicação
cd /var/www/crm-comercial
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Executar o comando que aparecer
```

### Passo 6: Verificar Migração
```bash
# Ainda no servidor definitivo
cd ~/scripts
./verificar-migracao.sh
```

### Passo 7: Testar Aplicação
```bash
# Acessar no navegador
http://SEU_IP_OU_DOMINIO:8081

# Fazer login
# Email: admin@crm.com
# Senha: admin123

# Verificar:
# - Dashboard carrega
# - Empresas aparecem
# - Oportunidades aparecem
# - Upload de arquivo funciona
```

---

## 🔧 Troubleshooting

### Erro: "PostgreSQL não está rodando"
```bash
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Erro: "Não consegue conectar ao banco"
```bash
# Verificar credenciais
cat /var/www/crm-comercial/apps/api/.env | grep DATABASE_URL

# Testar conexão manual
psql -U crm_user -d crm_comercial -h localhost
```

### Erro: "PM2 não encontra o processo"
```bash
# Ver logs
pm2 logs crm-api --lines 100

# Reiniciar
pm2 restart crm-api

# Se não existir, iniciar
cd /var/www/crm-comercial
pm2 start ecosystem.config.js
```

### Erro: "API não responde"
```bash
# Verificar se a porta está em uso
sudo netstat -tulpn | grep 8081

# Ver logs
pm2 logs crm-api

# Verificar firewall
sudo ufw status
sudo ufw allow 8081/tcp
```

### Erro: "Frontend não carrega"
```bash
# Verificar se o build existe
ls -la /var/www/crm-comercial/apps/web/dist/

# Rebuild
cd /var/www/crm-comercial/apps/web
npm run build

# Reiniciar PM2
pm2 restart crm-api
```

---

## 📊 Checklist de Migração

### Antes de Começar
- [ ] Acesso SSH ao servidor provisório
- [ ] Acesso SSH ao servidor definitivo
- [ ] Espaço suficiente no servidor definitivo (50GB+)
- [ ] Scripts baixados em ambos os servidores

### No Servidor Definitivo
- [ ] Executar `preparar-servidor-definitivo.sh`
- [ ] Anotar DATABASE_URL gerada
- [ ] Verificar firewall configurado

### No Servidor Provisório
- [ ] Executar `backup-completo.sh`
- [ ] Anotar diretório de backup criado
- [ ] Verificar tamanho do backup

### Transferência
- [ ] Baixar backup para seu computador
- [ ] Enviar backup para servidor definitivo
- [ ] Verificar integridade (checksums)

### No Servidor Definitivo
- [ ] Executar `restaurar-backup.sh`
- [ ] Configurar .env do backend
- [ ] Configurar .env do frontend
- [ ] Instalar dependências
- [ ] Build do frontend
- [ ] Iniciar com PM2
- [ ] Executar `verificar-migracao.sh`

### Testes
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] Dados aparecem (empresas, oportunidades)
- [ ] Upload de arquivo funciona
- [ ] Relatórios funcionam

### Finalização
- [ ] Manter servidor provisório ativo por 7-14 dias
- [ ] Atualizar DNS (se aplicável)
- [ ] Configurar SSL/HTTPS
- [ ] Configurar backups automáticos
- [ ] Documentar credenciais

---

## 🎯 Tempo Total Estimado

| Etapa | Tempo |
|-------|-------|
| Preparar servidor definitivo | 5-10 min |
| Backup no servidor provisório | 5-15 min |
| Transferir backup | 5-30 min (depende da internet) |
| Restaurar no servidor definitivo | 5-10 min |
| Configurar aplicação | 10-15 min |
| Verificar e testar | 5-10 min |
| **TOTAL** | **35-90 min** |

---

## 📞 Suporte

Se encontrar problemas:

1. Execute `verificar-migracao.sh` para diagnóstico
2. Verifique os logs: `pm2 logs crm-api`
3. Consulte o guia completo: `GUIA_MIGRACAO_SERVIDOR_DEFINITIVO.md`

---

**Desenvolvido com ❤️ para facilitar sua migração**
