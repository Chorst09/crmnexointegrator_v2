# Deploy Completo - CRM Comercial e Finanças Zen

## ✅ DEPLOY CONCLUÍDO

### Aplicações Configuradas

#### 1. CRM Comercial
- **URL**: http://crm.chorstconsult.com.br
- **Backend**: Porta 3000 (PM2: crm-api)
- **Frontend**: Servido pelo Nginx de `/var/www/crm-comercial/apps/web/dist`
- **Banco**: PostgreSQL (crm_com)
- **Login**: admin@crm.com / admin123

#### 2. Finanças Zen
- **URL**: http://financas.chorstconsult.com.br (aguardando propagação DNS)
- **Backend**: Porta 3001 (PM2: financaskvm)
- **Servido**: Next.js standalone

### Configurações Nginx

#### CRM (`/etc/nginx/conf.d/001-crm-chorstconsult.conf`)
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name crm.chorstconsult.com.br;

    root /var/www/crm-comercial/apps/web/dist;
    index index.html;

    # Frontend estático
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### Finanças (`/etc/nginx/conf.d/000-financaskvm.conf`)
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name financas.chorstconsult.com.br;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Variáveis de Ambiente

#### CRM API (`.env`)
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://Chorstconsult:<ADMIN_PASSWORD>@localhost:5432/crm_com
JWT_SECRET=seu-secret-super-seguro-aqui-mude-em-producao
CORS_ORIGIN=http://crm.chorstconsult.com.br,http://72.60.195.200:8081,http://localhost:8081
```

#### CRM Frontend (`.env`)
```bash
VITE_API_URL=/api
```

#### Finanças Zen (`.env`)
```bash
PORT=3001
# ... outras variáveis do Finanças
```

### PM2 Processos

```bash
pm2 list
# ┌────┬────────────────┬─────────┬─────────┬──────────┐
# │ id │ name           │ mode    │ status  │ port     │
# ├────┼────────────────┼─────────┼─────────┼──────────┤
# │ 4  │ crm-api        │ cluster │ online  │ 3000     │
# │ 3  │ financaskvm    │ fork    │ online  │ 3001     │
# └────┴────────────────┴─────────┴─────────┴──────────┘
```

### Banco de Dados

**PostgreSQL**
- Host: localhost
- Database: crm_com
- User: Chorstconsult
- Password: <ADMIN_PASSWORD>
- Todas as migrações aplicadas ✅
- Seed executado com usuário admin ✅

### DNS Configurado no KingHost

Registros DNS tipo A:
- `crm.chorstconsult.com.br` → 72.60.195.200
- `financas.chorstconsult.com.br` → 72.60.195.200

**Nota**: A propagação DNS pode levar de 5 minutos a 24 horas.

## 🔧 Comandos Úteis

### Gerenciar Processos PM2
```bash
# Ver status
ssh root@72.60.195.200 "pm2 list"

# Ver logs do CRM
ssh root@72.60.195.200 "pm2 logs crm-api --lines 100"

# Ver logs do Finanças
ssh root@72.60.195.200 "pm2 logs financaskvm --lines 100"

# Reiniciar CRM
ssh root@72.60.195.200 "pm2 restart crm-api"

# Reiniciar Finanças
ssh root@72.60.195.200 "pm2 restart financaskvm"

# Salvar configuração PM2
ssh root@72.60.195.200 "pm2 save"
```

### Gerenciar Nginx
```bash
# Testar configuração
ssh root@72.60.195.200 "sudo nginx -t"

# Recarregar configuração
ssh root@72.60.195.200 "sudo systemctl reload nginx"

# Ver status
ssh root@72.60.195.200 "sudo systemctl status nginx"

# Ver logs de erro
ssh root@72.60.195.200 "sudo tail -f /var/log/nginx/error.log"
```

### Testar Aplicações
```bash
# Testar CRM API
curl http://crm.chorstconsult.com.br/api/health

# Testar login CRM
curl -X POST http://crm.chorstconsult.com.br/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@crm.com","password":"admin123"}'

# Testar Finanças (após DNS propagar)
curl http://financas.chorstconsult.com.br/
```

### Verificar DNS
```bash
# Verificar propagação DNS
nslookup crm.chorstconsult.com.br
nslookup financas.chorstconsult.com.br

# Deve retornar: 72.60.195.200
```

### Banco de Dados
```bash
# Conectar ao PostgreSQL
ssh root@72.60.195.200 "psql -U Chorstconsult -d crm_com"

# Listar usuários do CRM
ssh root@72.60.195.200 "psql -U Chorstconsult -d crm_com -c 'SELECT id, name, email, role FROM \"User\";'"

# Backup do banco
ssh root@72.60.195.200 "pg_dump -U Chorstconsult crm_com > backup_crm_$(date +%Y%m%d).sql"
```

## 🚀 Próximos Passos

### 1. Configurar SSL/HTTPS (Recomendado)
```bash
# Instalar Certbot
ssh root@72.60.195.200 "sudo apt install certbot python3-certbot-nginx -y"

# Obter certificado SSL para CRM
ssh root@72.60.195.200 "sudo certbot --nginx -d crm.chorstconsult.com.br"

# Obter certificado SSL para Finanças
ssh root@72.60.195.200 "sudo certbot --nginx -d financas.chorstconsult.com.br"

# Renovação automática já está configurada
```

### 2. Configurar Backup Automático
```bash
# Criar script de backup
ssh root@72.60.195.200 "cat > /root/backup-crm.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/root/backups
mkdir -p \$BACKUP_DIR
DATE=\$(date +%Y%m%d_%H%M%S)
pg_dump -U Chorstconsult crm_com > \$BACKUP_DIR/crm_\$DATE.sql
# Manter apenas últimos 7 dias
find \$BACKUP_DIR -name 'crm_*.sql' -mtime +7 -delete
EOF"

# Tornar executável
ssh root@72.60.195.200 "chmod +x /root/backup-crm.sh"

# Adicionar ao crontab (backup diário às 2h)
ssh root@72.60.195.200 "echo '0 2 * * * /root/backup-crm.sh' | crontab -"
```

### 3. Monitoramento
```bash
# Instalar PM2 monitoring (opcional)
ssh root@72.60.195.200 "pm2 install pm2-logrotate"

# Configurar alertas por email (opcional)
# Configurar integração com serviços de monitoramento
```

### 4. Segurança Adicional
- Configurar firewall (ufw)
- Configurar fail2ban
- Atualizar senhas padrão
- Revisar permissões de arquivos

## 📝 Notas Importantes

1. **Porta 80**: Única porta HTTP aberta pelo provedor Hostinger
2. **Roteamento**: Baseado em domínios (server_name no Nginx)
3. **PM2**: Configurado para reiniciar automaticamente no boot
4. **CORS**: Configurado para aceitar requisições do domínio CRM
5. **Frontend**: Build estático servido pelo Nginx
6. **API**: Proxy reverso do Nginx para Node.js

## 🐛 Troubleshooting

### CRM não carrega
```bash
# Verificar se o processo está rodando
ssh root@72.60.195.200 "pm2 list"

# Verificar logs
ssh root@72.60.195.200 "pm2 logs crm-api --lines 50"

# Verificar Nginx
ssh root@72.60.195.200 "sudo nginx -t && sudo systemctl status nginx"
```

### Erro 500 no login
```bash
# Verificar logs da API
ssh root@72.60.195.200 "pm2 logs crm-api --lines 100"

# Verificar conexão com banco
ssh root@72.60.195.200 "psql -U Chorstconsult -d crm_com -c 'SELECT 1;'"

# Verificar CORS
ssh root@72.60.195.200 "cat /var/www/crm-comercial/apps/api/.env | grep CORS"
```

### DNS não resolve
- Aguardar propagação (até 24h)
- Verificar configuração no painel KingHost
- Limpar cache DNS local: `sudo dscacheutil -flushcache` (Mac)
- Testar com DNS público: `nslookup crm.chorstconsult.com.br 8.8.8.8`

## ✅ Checklist Final

- [x] CRM API rodando na porta 3000
- [x] Finanças rodando na porta 3001
- [x] Nginx configurado para ambos
- [x] DNS configurado no KingHost
- [x] CORS configurado corretamente
- [x] Frontend do CRM buildado com API correta
- [x] PM2 configurado para auto-start
- [x] Banco de dados PostgreSQL funcionando
- [x] Migrações aplicadas
- [x] Usuário admin criado
- [ ] SSL/HTTPS (próximo passo)
- [ ] Backup automático (próximo passo)
- [ ] DNS Finanças propagado (aguardando)

## 🎉 Status Final

**CRM Comercial**: ✅ FUNCIONANDO
- URL: http://crm.chorstconsult.com.br
- Login: admin@crm.com / admin123

**Finanças Zen**: ⏳ AGUARDANDO DNS
- URL: http://financas.chorstconsult.com.br
- Status: Aplicação rodando, aguardando propagação DNS
