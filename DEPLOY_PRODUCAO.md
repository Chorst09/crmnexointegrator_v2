# 🚀 Deploy NexosCRM - Servidor de Produção

## 📋 Informações do Servidor

- **IP**: 209.50.241.25
- **Usuário**: root
- **Porta SSH**: 22
- **Senha**: <SSH_PASSWORD>

## 🎯 Deploy Automático

Execute o script de deploy:

```bash
./deploy-servidor.sh
```

O script irá:
1. ✅ Preparar o servidor (instalar Docker se necessário)
2. 📦 Enviar arquivos da aplicação
3. 🐳 Fazer build dos containers
4. 🗄️ Executar migrations do banco
5. 👤 Criar usuário administrador

## 🌐 Acesso após Deploy

- **URL**: http://209.50.241.25
- **Login**: admin@nexoscrm.com
- **Senha**: <ADMIN_PASSWORD>

⚠️ **IMPORTANTE**: Troque a senha após o primeiro acesso!

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │────│  Frontend React  │    │  Backend Node   │
│   Porta 80      │    │  (Container)     │────│  Porta 3001     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                               ┌─────────────────┐
                                               │  PostgreSQL     │
                                               │  Porta 5432     │
                                               └─────────────────┘
```

## 🔧 Comandos Úteis no Servidor

```bash
# Acessar o servidor
ssh root@209.50.241.25

# Ver status dos containers
cd /opt/nexoscrm
docker compose -f docker-compose.production.yml ps

# Ver logs
docker compose -f docker-compose.production.yml logs -f

# Reiniciar aplicação
docker compose -f docker-compose.production.yml restart

# Parar aplicação
docker compose -f docker-compose.production.yml down

# Atualizar aplicação (após novo deploy)
docker compose -f docker-compose.production.yml up -d --build
```

## 🗄️ Backup do Banco

```bash
# Fazer backup
docker compose -f docker-compose.production.yml exec postgres pg_dump -U nexoscrm nexoscrm > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker compose -f docker-compose.production.yml exec -T postgres psql -U nexoscrm nexoscrm < backup.sql
```

## 🔐 Segurança

### Variáveis Importantes para Trocar:
- `JWT_SECRET` no arquivo `.env`
- `DB_PASSWORD` no arquivo `.env`
- Senha do usuário admin após primeiro login

### Firewall Recomendado:
```bash
# Permitir apenas portas necessárias
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS (futuro)
ufw enable
```

## 🚨 Troubleshooting

### Container não inicia:
```bash
docker compose -f docker-compose.production.yml logs backend
```

### Banco não conecta:
```bash
docker compose -f docker-compose.production.yml exec postgres pg_isready -U nexoscrm
```

### Frontend não carrega:
```bash
docker compose -f docker-compose.production.yml logs nginx
```

### Recriar tudo do zero:
```bash
docker compose -f docker-compose.production.yml down -v
docker system prune -f
docker compose -f docker-compose.production.yml up -d --build
```