# Guia de Atualização - CRM Comercial

## 📋 Resumo das Alterações

As seguintes alterações foram feitas para sincronizar o código local com a configuração de produção:

### 1. Configuração de Ambiente (`.env`)

#### API (`apps/api/.env`)
- **Antes**: Porta 3002, banco local
- **Depois**: Porta 3000, banco `crm_com` no servidor

#### Frontend (`apps/web/.env`)
- **Antes**: `VITE_API_URL=http://localhost:3002/api`
- **Depois**: `VITE_API_URL=/api` (caminho relativo)

### 2. Docker Compose
- Removida versão obsoleta do `docker-compose.yml`

## 🚀 Como Usar

### Opção 1: Atualizar Localmente (Desenvolvimento)

```bash
./update-local.sh
```

Este script:
1. Instala dependências da API
2. Gera cliente Prisma
3. Instala dependências do Frontend
4. Faz build do Frontend

Depois, suba o Docker:
```bash
docker-compose up -d
```

Acesse: http://localhost:5173

### Opção 2: Deploy no Servidor (Produção)

```bash
./deploy-to-server.sh
```

Este script:
1. Faz pull do repositório no servidor
2. Instala dependências da API
3. Gera cliente Prisma
4. Aplica migrações do banco
5. Instala dependências do Frontend
6. Faz build do Frontend
7. Reinicia a API (PM2)
8. Recarrega Nginx
9. Testa a aplicação

Acesse: https://crm.chorstconsult.com.br

## 📝 Detalhes das Alterações

### Arquivo: `apps/api/.env`

```env
# ANTES
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm?schema=public
JWT_SECRET=dev-secret-key-change-in-production
CORS_ORIGIN=http://localhost:5173

# DEPOIS
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://Chorstconsult:<ADMIN_PASSWORD>@localhost:5432/crm_com
JWT_SECRET=seu-secret-super-seguro-aqui-mude-em-producao
CORS_ORIGIN=http://crm.chorstconsult.com.br,http://72.60.195.200:8081,http://localhost:8081
```

### Arquivo: `apps/web/.env`

```env
# ANTES
VITE_API_URL=http://localhost:3002/api

# DEPOIS
VITE_API_URL=/api
```

### Arquivo: `docker-compose.yml`

- Removida linha `version: '3.8'` (obsoleta)

## 🔍 Verificação

### Testar Localmente

```bash
# 1. Subir Docker
docker-compose up -d

# 2. Verificar se os serviços estão rodando
docker-compose ps

# 3. Acessar a aplicação
# Frontend: http://localhost:5173
# API: http://localhost:3002/api/health

# 4. Ver logs
docker-compose logs -f api
docker-compose logs -f web
```

### Testar no Servidor

```bash
# 1. Conectar ao servidor
ssh root@72.60.195.200

# 2. Ver status dos processos
pm2 list

# 3. Ver logs da API
pm2 logs crm-api --lines 50

# 4. Testar API
curl http://localhost:3000/api/health

# 5. Testar login
curl -X POST http://crm.chorstconsult.com.br/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@crm.com","password":"admin123"}'
```

## ⚠️ Notas Importantes

1. **Banco de Dados**: O servidor usa `crm_com`, não `crm`. Certifique-se de que as migrações foram aplicadas.

2. **Porta**: A API roda na porta 3000 no servidor, não 3002.

3. **CORS**: Certifique-se de que o `CORS_ORIGIN` inclui todos os domínios necessários.

4. **Frontend**: O build do frontend deve ser feito com `VITE_API_URL=/api` para que funcione corretamente no servidor.

5. **SSL/HTTPS**: O servidor usa HTTPS. Certifique-se de que o certificado SSL está configurado no Nginx.

## 🐛 Troubleshooting

### Erro: "Cannot find module 'express'"
```bash
cd apps/api
npm install
```

### Erro: "vite: command not found"
```bash
cd apps/web
npm install
```

### Erro: "Prisma client not found"
```bash
cd apps/api
npm run db:generate
```

### Erro: "Database connection failed"
- Verifique se o PostgreSQL está rodando
- Verifique a `DATABASE_URL` no `.env`
- Verifique as credenciais do banco

### API não responde
```bash
# Ver logs
pm2 logs crm-api --lines 100

# Reiniciar
pm2 restart crm-api

# Verificar porta
lsof -i :3000
```

### Frontend não carrega
```bash
# Verificar se o build foi feito
ls -la apps/web/dist/

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs: `pm2 logs crm-api`
2. Verifique a conexão com o banco: `psql -U Chorstconsult -d crm_com`
3. Verifique o Nginx: `sudo nginx -t`
4. Reinicie os serviços: `pm2 restart crm-api && sudo systemctl reload nginx`

## ✅ Checklist

- [ ] Executou `./update-local.sh` (desenvolvimento) ou `./deploy-to-server.sh` (produção)
- [ ] Verificou se os serviços estão rodando
- [ ] Testou a API com `curl`
- [ ] Testou o login
- [ ] Acessou a aplicação no navegador
- [ ] Verificou os logs para erros
