# 🛠️ Comandos Úteis - CRM no Servidor

## 🚀 Deploy

```bash
# 1. Verificar segurança (opcional)
./verify-server-safety.sh usuario@72.60.195.200

# 2. Enviar arquivos
./deploy-to-server.sh usuario@72.60.195.200

# 3. Configurar no servidor
ssh usuario@72.60.195.200
cd /var/www/crm-comercial
./server-setup.sh
```

## 🔍 Verificação

```bash
# Verificar se Finanças Zen está OK
curl http://72.60.195.200

# Verificar se CRM está OK
curl http://72.60.195.200:8081/api/health

# Ver processos PM2
ssh usuario@72.60.195.200 "pm2 list"

# Ver portas em uso
ssh usuario@72.60.195.200 "sudo netstat -tulpn | grep LISTEN"
```

## 📊 PM2 - Gerenciamento

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs crm-api

# Ver logs com limite de linhas
pm2 logs crm-api --lines 100

# Reiniciar
pm2 restart crm-api

# Parar
pm2 stop crm-api

# Iniciar
pm2 start crm-api

# Remover
pm2 delete crm-api

# Monitorar recursos
pm2 monit

# Salvar configuração
pm2 save

# Ver informações detalhadas
pm2 show crm-api
```

## 🗄️ Banco de Dados

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql

# Conectar ao banco do CRM
psql -U crm_user -d crm_comercial -h localhost

# Listar bancos
\l

# Conectar a um banco
\c crm_comercial

# Listar tabelas
\dt

# Ver estrutura de uma tabela
\d "User"

# Executar query
SELECT * FROM "User";

# Sair
\q
```

## 🔄 Prisma

```bash
cd /var/www/crm-comercial/apps/api

# Gerar Prisma Client
npx prisma generate

# Executar migrações
npx prisma migrate deploy

# Criar nova migração (desenvolvimento)
npx prisma migrate dev --name nome_da_migracao

# Abrir Prisma Studio (GUI)
npx prisma studio

# Resetar banco (CUIDADO!)
npx prisma migrate reset

# Ver status das migrações
npx prisma migrate status

# Executar seed
npm run db:seed
```

## 🔥 Firewall

```bash
# Ver status
sudo ufw status

# Permitir porta 8081
sudo ufw allow 8081/tcp

# Bloquear porta
sudo ufw deny 8081/tcp

# Remover regra
sudo ufw delete allow 8081/tcp

# Habilitar firewall
sudo ufw enable

# Desabilitar firewall
sudo ufw disable
```

## 📝 Logs

```bash
# Logs do PM2
pm2 logs crm-api
pm2 logs crm-api --lines 200
pm2 logs crm-api --err  # Apenas erros

# Logs do sistema
tail -f /var/www/crm-comercial/logs/api-error.log
tail -f /var/www/crm-comercial/logs/api-out.log
tail -f /var/www/crm-comercial/logs/api-combined.log

# Logs do Nginx (se usado)
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log
```

## 🔄 Atualização do Código

```bash
# Opção 1: Via Git
ssh usuario@72.60.195.200
cd /var/www/crm-comercial
git pull origin main
cd apps/api && npm install && npx prisma generate
cd ../web && npm install && npm run build
pm2 restart crm-api

# Opção 2: Via deploy script
./deploy-to-server.sh usuario@72.60.195.200
# Depois no servidor:
cd /var/www/crm-comercial/apps/api
npm install && npx prisma generate && npx prisma migrate deploy
cd ../web && npm install && npm run build
pm2 restart crm-api
```

## 🧹 Limpeza

```bash
# Limpar node_modules
cd /var/www/crm-comercial
rm -rf apps/api/node_modules
rm -rf apps/web/node_modules

# Limpar build do frontend
rm -rf apps/web/dist

# Limpar logs antigos
pm2 flush crm-api

# Limpar backups antigos (mais de 30 dias)
find /var/www/crm-comercial/backup -name "*.tar.gz" -mtime +30 -delete
```

## 💾 Backup

```bash
# Backup do banco de dados
pg_dump -U crm_user -d crm_comercial > backup-$(date +%Y%m%d-%H%M%S).sql

# Backup dos arquivos
cd /var/www
tar -czf crm-backup-$(date +%Y%m%d-%H%M%S).tar.gz crm-comercial/

# Restaurar banco de dados
psql -U crm_user -d crm_comercial < backup-20260212-120000.sql
```

## 🔧 Troubleshooting

```bash
# Verificar se a porta está em uso
sudo netstat -tulpn | grep 8081

# Verificar processos Node.js
ps aux | grep node

# Matar processo na porta 8081 (se necessário)
sudo lsof -ti:8081 | xargs kill -9

# Verificar espaço em disco
df -h

# Verificar memória
free -h

# Verificar CPU
top

# Verificar conectividade
ping 72.60.195.200
curl http://72.60.195.200:8081/api/health

# Testar conexão com banco
psql -U crm_user -d crm_comercial -h localhost -c "SELECT 1"
```

## 🔐 Segurança

```bash
# Ver usuários do sistema
cat /etc/passwd

# Ver permissões dos arquivos
ls -la /var/www/crm-comercial

# Alterar proprietário
sudo chown -R usuario:usuario /var/www/crm-comercial

# Alterar permissões
sudo chmod -R 755 /var/www/crm-comercial

# Ver tentativas de login SSH
sudo tail -f /var/log/auth.log
```

## 📊 Monitoramento

```bash
# Monitorar em tempo real
pm2 monit

# Ver uso de recursos
pm2 status

# Ver métricas
pm2 describe crm-api

# Instalar PM2 Plus (monitoramento web)
pm2 plus
```

## 🔄 Reiniciar Serviços

```bash
# Reiniciar apenas o CRM
pm2 restart crm-api

# Reiniciar Nginx
sudo systemctl restart nginx

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Reiniciar servidor (CUIDADO!)
sudo reboot
```

## 🧪 Testes

```bash
# Testar API
curl http://72.60.195.200:8081/api/health
curl http://72.60.195.200:8081/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm.com","password":"admin123"}'

# Testar frontend
curl http://72.60.195.200:8081

# Testar com verbose
curl -v http://72.60.195.200:8081/api/health
```

## 📦 NPM

```bash
# Atualizar dependências
cd /var/www/crm-comercial/apps/api
npm update

# Ver dependências desatualizadas
npm outdated

# Limpar cache
npm cache clean --force

# Reinstalar tudo
rm -rf node_modules package-lock.json
npm install
```

## 🎯 Comandos Rápidos

```bash
# Status geral
ssh usuario@72.60.195.200 "pm2 list && df -h && free -h"

# Reiniciar tudo
ssh usuario@72.60.195.200 "cd /var/www/crm-comercial && pm2 restart crm-api"

# Ver logs
ssh usuario@72.60.195.200 "pm2 logs crm-api --lines 50"

# Backup rápido
ssh usuario@72.60.195.200 "pg_dump -U crm_user crm_comercial > /tmp/backup.sql"
```

## 📚 Referências

- PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
- Prisma: https://www.prisma.io/docs
- PostgreSQL: https://www.postgresql.org/docs/
- Nginx: https://nginx.org/en/docs/
