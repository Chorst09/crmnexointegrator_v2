# BACKUPS — NexosCRM

Backups completos dos bancos de dados de produção gerados em **09/10/2026 às 10:04 (BRT)**.

---

## Arquivos

| Arquivo | Banco | Domínio | Porta | Tabelas | Registros |
|---|---|---|---|---|---|
| `nexoscrm-20261009-100420.dump` | `nexoscrm` | nexos.chorstconsult.com.br | 5433 (Docker) | 124 | ~12.543 |
| `nexosv2-20261009-100420.dump` | `crmnexointegrator_v2` | nexosv2.chorstconsult.com.br | 5432 (nativo) | 100 | ~1.352 |

Formato: **PostgreSQL Custom (-Fc)** — comprimido, inclui schema + dados.

---

## Servidor de Produção

- **IP:** `209.50.241.25`
- **Usuário SSH:** `root`

---

## Como Restaurar

### Banco nexoscrm (nexos.chorstconsult.com.br)

```bash
# 1. Enviar dump para o servidor
scp nexoscrm-20261009-100420.dump root@209.50.241.25:/tmp/

# 2. No servidor, restaurar no banco Docker (porta 5433)
ssh root@209.50.241.25
PGPASSWORD="NexosCRM@2024!" pg_restore \
  -h 127.0.0.1 -p 5433 -U nexoscrm -d nexoscrm \
  --clean --if-exists --no-owner --no-acl \
  /tmp/nexoscrm-20261009-100420.dump

# 3. Reiniciar o processo
pm2 restart crmnexointegrator_3026
```

### Banco nexosv2 (nexosv2.chorstconsult.com.br)

```bash
# 1. Enviar dump para o servidor
scp nexosv2-20261009-100420.dump root@209.50.241.25:/tmp/

# 2. No servidor, restaurar no banco nativo (porta 5432)
ssh root@209.50.241.25
sudo -u postgres pg_restore \
  -d crmnexointegrator_v2 \
  --clean --if-exists --no-owner --no-acl \
  /tmp/nexosv2-20261009-100420.dump

# 3. Reiniciar o processo
pm2 restart crmnexointegrator_v2_3025
```

---

## ⚠️ Atenção

- `--clean --if-exists` apaga e recria todas as tabelas — operação **destrutiva**
- Sempre gere um novo backup antes de restaurar
- O banco `nexoscrm` (porta 5433) roda dentro de um container Docker (`nexoscrm-postgres`)
- O banco `crmnexointegrator_v2` (porta 5432) roda no PostgreSQL nativo da VPS

---

## Gerar Novo Backup (manual)

Via SSH no servidor:

```bash
# Banco nexoscrm (Docker 5433)
PGPASSWORD="NexosCRM@2024!" pg_dump \
  -h 127.0.0.1 -p 5433 -U nexoscrm -d nexoscrm \
  --format=custom --no-owner --no-acl \
  -f "/root/backups/nexoscrm-$(date +%Y%m%d-%H%M%S).dump"

# Banco nexosv2 (5432)
PGPASSWORD="x5jwraIMKxcGBJpJ2k7du-I5sK6DZ5P8" pg_dump \
  -h localhost -p 5432 -U nexosv2_app -d crmnexointegrator_v2 \
  --format=custom --no-owner --no-acl \
  -f "/root/backups/nexosv2-$(date +%Y%m%d-%H%M%S).dump"
```
