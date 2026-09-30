# 🚀 Migração para Novo Servidor KVM - Guia Rápido

## 📌 Resumo

Este repositório contém todos os scripts e documentação necessários para migrar o CRM Comercial de um servidor provisório (Hostinger) para um novo servidor KVM.

## 🎯 O que você vai conseguir

✅ Migração completa do banco de dados PostgreSQL
✅ Migração da aplicação Node.js (API + Frontend)
✅ Migração de todos os arquivos de upload
✅ Migração de configurações e variáveis de ambiente
✅ Verificação automática de integridade
✅ Testes de funcionalidade

## 📦 Arquivos Disponíveis

### Scripts de Migração
- `scripts/preparar-servidor-definitivo.sh` - Prepara o novo servidor (5-10 min)
- `scripts/backup-completo.sh` - Faz backup completo (5-15 min)
- `scripts/restaurar-backup.sh` - Restaura backup (5-10 min)
- `scripts/verificar-migracao.sh` - Verifica se tudo funcionou (1-2 min)

### Documentação
- `GUIA_MIGRACAO_GITHUB.md` - Guia completo passo a passo
- `CHECKLIST_MIGRACAO_RAPIDO.md` - Checklist rápido para referência
- `scripts/README_SCRIPTS_MIGRACAO.md` - Documentação detalhada dos scripts

### Configuração
- `ecosystem.config.js` - Configuração do PM2 para produção

## ⚡ Início Rápido (35-90 minutos)

### 1️⃣ Preparar Novo Servidor

```bash
ssh root@SEU_IP_NOVO
git clone https://github.com/seu-usuario/crm-comercial.git
cd crm-comercial
chmod +x scripts/*.sh
./scripts/preparar-servidor-definitivo.sh
```

### 2️⃣ Fazer Backup

```bash
ssh root@72.60.195.200
git clone https://github.com/seu-usuario/crm-comercial.git
cd crm-comercial
chmod +x scripts/*.sh
./scripts/backup-completo.sh
# Anotar: ~/crm-backup-YYYYMMDD-HHMMSS
```

### 3️⃣ Transferir Backup

```bash
# No seu Mac
scp -r root@72.60.195.200:~/crm-backup-YYYYMMDD-HHMMSS ~/Downloads/
scp -r ~/Downloads/crm-backup-YYYYMMDD-HHMMSS root@SEU_IP_NOVO:~/
```

### 4️⃣ Restaurar Backup

```bash
ssh root@SEU_IP_NOVO
cd ~/crm-comercial/scripts
./restaurar-backup.sh ~/crm-backup-YYYYMMDD-HHMMSS
```

### 5️⃣ Configurar e Iniciar

```bash
ssh root@SEU_IP_NOVO

# Atualizar .env
nano /var/www/crm-comercial/apps/api/.env
# Atualizar DATABASE_URL, CORS_ORIGIN, etc.

nano /var/www/crm-comercial/apps/web/.env
# Atualizar VITE_API_URL

# Build e iniciar
cd /var/www/crm-comercial/apps/web && npm run build
cd /var/www/crm-comercial && pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

### 6️⃣ Verificar

```bash
ssh root@SEU_IP_NOVO
cd ~/crm-comercial/scripts
./verificar-migracao.sh

# Acessar no navegador
# http://SEU_IP:8081
# Login: admin@crm.com / admin123
```

## 📋 Pré-requisitos

### Servidor Provisório (Hostinger)
- ✅ PostgreSQL rodando
- ✅ Aplicação em `/var/www/crm-comercial`
- ✅ PM2 gerenciando processos

### Novo Servidor KVM
- ✅ Ubuntu 20.04 LTS ou similar
- ✅ Acesso root
- ✅ 50GB+ espaço em disco
- ✅ Conexão de internet estável

### Seu Computador
- ✅ Acesso SSH a ambos os servidores
- ✅ Git instalado
- ✅ Terminal/iTerm2

## 🔍 Troubleshooting

### PostgreSQL não conecta
```bash
psql -U crm_user -h localhost -d crm_comercial -c "SELECT 1"
```

### API não responde
```bash
pm2 logs crm-api --lines 50
pm2 restart crm-api
```

### Porta 8081 em uso
```bash
netstat -tulpn | grep 8081
```

### Frontend não carrega
```bash
cd /var/www/crm-comercial/apps/web
npm run build
pm2 restart crm-api
```

## 📚 Documentação Completa

Para instruções detalhadas, consulte:
- **Guia Completo**: `GUIA_MIGRACAO_GITHUB.md`
- **Checklist Rápido**: `CHECKLIST_MIGRACAO_RAPIDO.md`
- **Scripts**: `scripts/README_SCRIPTS_MIGRACAO.md`

## 🔐 Segurança

Após a migração:

1. **Alterar senhas padrão**
   ```bash
   sudo -u postgres psql -c "ALTER USER crm_user WITH PASSWORD 'senha_forte';"
   ```

2. **Configurar SSL/HTTPS**
   ```bash
   sudo apt-get install certbot
   sudo certbot certonly --standalone -d seu-dominio.com
   ```

3. **Configurar backups automáticos**
   ```bash
   crontab -e
   # Adicionar: 0 2 * * * /var/www/crm-comercial/scripts/backup-completo.sh
   ```

## 📊 Tempo Estimado

| Etapa | Tempo |
|-------|-------|
| Preparação | 5-10 min |
| Backup | 5-15 min |
| Transferência | 5-30 min |
| Restauração | 5-10 min |
| Configuração | 10-15 min |
| Verificação | 5-10 min |
| **TOTAL** | **35-90 min** |

## ✅ Checklist de Migração

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

## 🆘 Suporte

Se encontrar problemas:

1. Execute `./scripts/verificar-migracao.sh` para diagnóstico
2. Verifique os logs: `pm2 logs crm-api`
3. Consulte a documentação: `GUIA_MIGRACAO_GITHUB.md`

## 📞 Contato

Para dúvidas ou problemas, consulte a documentação ou abra uma issue no GitHub.

---

**Desenvolvido com ❤️ para facilitar sua migração**

Última atualização: 27 de Fevereiro de 2026
