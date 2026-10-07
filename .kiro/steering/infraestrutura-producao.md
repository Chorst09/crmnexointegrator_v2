# Infraestrutura de Produção — NEXOS Integrator

## ⚠️ REGRA CRÍTICA — LEIA ANTES DE QUALQUER DEPLOY

**Nunca aplique alterações em mais de um domínio sem confirmação explícita do usuário.**
O domínio de trabalho padrão é `nexos.chorstconsult.com.br` (projeto `crmnexointegrator_3026`).
O domínio `nexosv2.chorstconsult.com.br` é ambiente secundário — **NÃO alterar sem permissão**.

---

## Mapeamento de Domínios e Projetos

| Domínio | Diretório no servidor | Porta API | PM2 process | Banco |
|---|---|---|---|---|
| `nexos.chorstconsult.com.br` | `/var/www/crmnexointegrator_3026` | `3026` | `crmnexointegrator_3026` | `nexoscrm` (porta 5433) |
| `nexosv2.chorstconsult.com.br` | `/var/www/crmnexointegrator_v2` | `3025` | `crmnexointegrator_v2` | `nexoscrm` (porta 5433) |

> Ambos compartilham o mesmo banco `nexoscrm`. Alterações no schema ou dados afetam os dois.

---

## Servidor de Produção

- **IP:** `209.50.241.25`
- **Usuário SSH:** `root`
- **Porta SSH:** `22`
- **Nginx config:** `/etc/nginx/sites-enabled/nexoscrm`
- **Frontend servido de:** `/var/www/crmnexointegrator_3026/apps/web/dist`

---

## Fluxo de Deploy Correto

### Sempre confirmar ANTES de fazer deploy:

1. **Qual domínio está sendo alterado?** → Confirmar com o usuário
2. **Usar apenas o projeto mapeado** → Não aplicar em outros projetos por conta própria
3. **Deploy padrão** vai para `crmnexointegrator_3026` (nexos.chorstconsult.com.br)

### Passos do deploy para `nexos.chorstconsult.com.br`:

```bash
# 1. Copiar arquivos via scp para o diretório CORRETO
sshpass -p 'SENHA' scp arquivo.jsx root@209.50.241.25:/var/www/crmnexointegrator_3026/...

# 2. Rebuild do frontend (se alterou JSX/TSX)
ssh root@209.50.241.25 'cd /var/www/crmnexointegrator_3026/apps/web && npm run build'

# 3. Reiniciar a API (se alterou backend .cjs/.js)
ssh root@209.50.241.25 'pm2 restart crmnexointegrator_3026'

# 4. Verificar health
ssh root@209.50.241.25 'curl -s http://localhost:3026/api/health'
```

---

## Estrutura dos Projetos

```
/var/www/crmnexointegrator_3026/
├── apps/
│   ├── web/
│   │   ├── src/          ← código-fonte do frontend
│   │   └── dist/         ← build servido pelo nginx
│   └── api/              ← NÃO É AQUI — ver backend/
└── backend/
    ├── server.js          ← entry point da API (PM2 aponta aqui)
    ├── api/
    │   ├── admin-backup.cjs
    │   └── ...
    └── lib/
        ├── prisma.cjs
        └── auth.cjs
```

> ⚠️ O backend usa `/var/www/crmnexointegrator_3026/backend/` — **NÃO** `apps/api/`.
> Sempre verificar com `pm2 show crmnexointegrator_3026 | grep "script path"` qual arquivo é o entry point.

---

## Banco de Dados

- **Nome:** `nexoscrm`
- **Porta:** `5433` (PostgreSQL via Docker)
- **Container Docker:** `nexoscrm-postgres`
- **Usuário:** `nexoscrm`

### Executar SQL diretamente:
```bash
PGPASSWORD="NexosCRM@2024!" psql -h 127.0.0.1 -p 5433 -U nexoscrm -d nexoscrm
```

---

## Scripts úteis no servidor

```bash
# Ver status de todos os processos
pm2 status

# Ver logs em tempo real
pm2 logs crmnexointegrator_3026

# Verificar tabelas e contagem de registros
PGPASSWORD="NexosCRM@2024!" psql -h 127.0.0.1 -p 5433 -U nexoscrm -d nexoscrm \
  -c "SELECT table_name, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name=t.table_name) as cols FROM information_schema.tables t WHERE table_schema='public' ORDER BY table_name"
```
