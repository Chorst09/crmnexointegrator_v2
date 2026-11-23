# Infraestrutura de Produção — NEXOS CRM (ICP Docker)

## ⚠️ INFORMAÇÕES IMPORTANTES

**Domínio Principal:** `nexos.chorstconsult.com.br`  
**Ambiente:** Produção ICP VPS com Docker  
**Deploy:** Via GitHub Actions ou scripts em `deploy/icp/`

> ⚠️ **NUNCA commite credenciais neste arquivo**  
> Use GitHub Secrets para informações sensíveis

---

## Servidor de Produção

- **IP:** `209.50.241.25`
- **Usuário SSH:** `root`
- **Porta SSH:** `22`
- **Acesso:** Via chave SSH configurada em GitHub Secrets
- **Painel ICP:** https://vps8561.panel.icontainer.cloud:2090

---

## Arquitetura Atual (Docker)

| Componente | Detalhes |
|------------|----------|
| **Container App** | `nexos-icp` (porta interna 3000) |
| **Porta Mapeada** | `127.0.0.1:3015` → 3000 |
| **Banco de Dados** | PostgreSQL 17 (`postgresql_17` container) |
| **Database** | `nexos_icp` (porta 5432 interna) |
| **Nginx Proxy** | Gerenciado pelo ICP |
| **SSL/TLS** | Let's Encrypt via ICP |
| **Volumes** | `nexos-icp-uploads`, `nexos-icp-attachments` |

---

## Estrutura de Diretórios na VPS

```
/opt/nexos-icp-github/          ← Repositório clonado
├── apps/
│   ├── web/                    ← Frontend React/Vite
│   └── api/                    ← Backend Express + Prisma
├── deploy/icp/                 ← Scripts de deploy
│   ├── auto-deploy.sh          ← Deploy automático (local → VPS)
│   ├── quick-deploy.sh         ← Deploy rápido (na VPS)
│   └── admin.cjs               ← Utilitários admin
└── Dockerfile.icp              ← Multi-stage build

/opt/nexos-icp-config/          ← Configuração (modo 700)
├── app.env                     ← Variáveis de ambiente (modo 600)
├── current-release             ← Release ativo
└── previous-container          ← Container anterior (rollback)
```

---

## Deploy

### Via GitHub Actions (Recomendado)

Push para branch `main` dispara deploy automático.

**Configuração necessária:**
- GitHub Secrets configurados (ver `.github/workflows/deploy-icp.yml`)
- SSH key adicionada aos secrets

### Via Script Local

```bash
# Deploy com commit automático
./deploy/icp/auto-deploy.sh "Mensagem do commit"
```

### Via VPS (Manual)

```bash
ssh root@209.50.241.25
bash /opt/nexos-icp-github/deploy/icp/quick-deploy.sh
```

---

## Banco de Dados

- **Container:** `postgresql_17`
- **Database:** `nexos_icp`
- **User:** `nexos_icp`
- **Porta:** 5432 (interna Docker network)

### Acessar banco:
```bash
docker exec postgresql_17 psql -U nexos_icp -d nexos_icp
```

### Backup:
```bash
docker exec postgresql_17 pg_dump -U nexos_icp nexos_icp > backup.sql
```

---

## Comandos Úteis

```bash
# Ver status do container
docker ps -f name=nexos-icp

# Ver logs
docker logs nexos-icp --tail 100 -f

# Reiniciar aplicação
docker restart nexos-icp

# Health check
curl http://127.0.0.1:3015/api/health
curl https://nexos.chorstconsult.com.br/api/health

# Ver release atual
cat /opt/nexos-icp-config/current-release

# Rollback manual
bash /opt/nexos-icp-github/deploy/icp/rollback.sh
```

---

## Ambientes Legados (Descontinuados)

Os ambientes abaixo foram **desativados** e substituídos pela arquitetura Docker:

- ~~`/var/www/crmnexointegrator_3026`~~ (PM2)
- ~~`/var/www/crmnexointegrator_v2`~~ (PM2)
- ~~Banco `nexoscrm` porta 5433~~ (migrado para `nexos_icp`)

**Não utilizar esses diretórios ou bancos.**

---

## Segurança

- ✅ Credenciais em `/opt/nexos-icp-config/app.env` (modo 600)
- ✅ Sem senhas no código ou Git
- ✅ SSL/TLS gerenciado pelo ICP
- ✅ Container isolado em rede Docker
- ✅ Porta 3015 apenas localhost
- ✅ Fail2ban configurado (SSH brute-force protection)

**Leia:** `SEGURANCA.md` para guia completo

---

## Suporte e Documentação

- **Deploy Automático:** `DEPLOY_AUTO.md`
- **Segurança:** `SEGURANCA.md`
- **Quick Start:** `DEPLOY_QUICK_START.md`
- **ICP Deploy Guide:** `DEPLOY_ICP.md`
