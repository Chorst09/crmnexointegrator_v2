# 📦 BACKUP — Documentações e Procedimentos Operacionais

Este diretório contém as especificações completas de segurança, procedimentos de Disaster Recovery e a documentação da rotina de backup automatizada do **NexosCRM v2**.

## Documentos Disponíveis:

* [🛡️ **ROTINA_BACKUP_AUTOMATIZADA.md**](./ROTINA_BACKUP_AUTOMATIZADA.md) — Documentação oficial da rotina diária de backup (Segunda a Sexta às 17h), incluindo cron, integridade pós-dump, política de retenção de 30 dias e guia passo a passo de restauração e testes.
* [**Scripts Operacionais**](../scripts/):
  * `scripts/backup-crmnexointegrator_v2.sh` — Script de backup automatizado
  * `scripts/restore-crmnexointegrator_v2.sh` — Script de validação e restauração (sandbox ou produção)
