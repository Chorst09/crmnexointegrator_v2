# 🛡️ Documentação da Rotina de Backup Automatizada — NexosCRM v2

Consulte a documentação completa no diretório dedicado:
👉 [**BACKUP/ROTINA_BACKUP_AUTOMATIZADA.md**](./BACKUP/ROTINA_BACKUP_AUTOMATIZADA.md)

### Resumo Rápido da Configuração:
* **Banco Alvo:** `crmnexointegrator_v2` (PostgreSQL 16)
* **Domínio:** https://nexosv2.chorstconsult.com.br/
* **Agendamento Cron:** `0 17 * * 1-5` (Segunda a Sexta às 17:00 no horário de Brasília)
* **Script de Backup:** `/var/www/crmnexointegrator_v2/scripts/backup-crmnexointegrator_v2.sh`
* **Script de Restauração:** `/var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh`
* **Diretório de Armazenamento:** `/var/backups/crmnexointegrator_v2/`
* **Retenção:** 30 dias com rotação automática
* **Log:** `/var/log/crmnexointegrator_v2-backup.log`
