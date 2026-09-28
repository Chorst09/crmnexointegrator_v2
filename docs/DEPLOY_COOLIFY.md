# Deploy no Coolify (KVM + PostgreSQL + Prisma)

Este projeto está pronto para deploy em **2 serviços** no Coolify:

- `apps/api` (Node + Prisma)
- `apps/web` (React/Vite servido por Nginx)

## 1) API (`apps/api`)

- Tipo: `Application`
- Build Pack: `Dockerfile`
- Base directory: `apps/api`
- Port: `3002`
- Healthcheck path: `/api/health`

### Variáveis obrigatórias

Use como base `apps/api/.env.example`:

- `NODE_ENV=production`
- `PORT=3002`
- `DATABASE_URL=postgresql://...`
- `JWT_SECRET=...`
- `CORS_ORIGIN=https://seu-frontend.com`

`CORS_ORIGIN` aceita múltiplos domínios separados por vírgula.

### Prisma em produção

No start da API já roda automaticamente:

1. `prisma generate`
2. `prisma migrate deploy`
3. `node server.cjs`

Ou seja, ao publicar no Coolify, as migrations serão aplicadas no PostgreSQL automaticamente.

## 2) Frontend (`apps/web`)

- Tipo: `Application`
- Build Pack: `Dockerfile`
- Base directory: `apps/web`
- Port: `80`

### Variável obrigatória

- `VITE_API_URL=https://api.seu-dominio.com/api`

Use como base `apps/web/.env.example`.

Importante: `VITE_API_URL` é variável de build do Vite, então deve estar definida no serviço frontend antes do deploy.

## 3) Ordem recomendada de publicação

1. Publicar API e validar `GET /api/health`
2. Definir `VITE_API_URL` no frontend apontando para a API publicada
3. Publicar frontend

## 4) Checklist rápido

- Banco PostgreSQL acessível pela API
- `DATABASE_URL` com `sslmode=require` quando necessário
- `JWT_SECRET` forte em produção
- `CORS_ORIGIN` com domínio real do frontend
- API e frontend em domínios HTTPS
