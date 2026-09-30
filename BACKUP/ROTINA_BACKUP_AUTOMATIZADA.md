# 🛡️ Documentação da Rotina de Backup Automatizada — NexosCRM v2

> **Ambiente:** Produção  
> **Domínio:** [https://nexosv2.chorstconsult.com.br/](https://nexosv2.chorstconsult.com.br/)  
> **Servidor VPS:** `209.50.241.25`  
> **Banco de Dados:** `crmnexointegrator_v2` (PostgreSQL 16)  
> **Fuso Horário:** `America/Sao_Paulo` (UTC-3)  
> **Data de Homologação:** 30 de Setembro de 2026  

---

## 1. Visão Geral

Para garantir a total segurança, disponibilidade e integridade dos dados reais de clientes, oportunidades, propostas e licitações no novo domínio **https://nexosv2.chorstconsult.com.br/**, foi implementada uma esteira profissional de backup diário com validação de integridade pós-dump, retenção de 30 dias e script de recuperação de desastres (Disaster Recovery).

---

## 2. Especificação do Agendamento (Cron)

O agendamento foi configurado no `crontab` do usuário `root` do servidor VPS, aproveitando o fuso horário configurado nativamente no sistema operacional (`America/Sao_Paulo`).

```cron
# Backup Diario NexosCRM v2 - Segunda a Sexta as 17:00 (America/Sao_Paulo)
0 17 * * 1-5 /var/www/crmnexointegrator_v2/scripts/backup-crmnexointegrator_v2.sh >> /var/log/crmnexointegrator_v2-backup.log 2>&1
```

### Detalhes do Cron:
* **Minuto:** `0`
* **Hora:** `17` (17h00 / 5:00 PM no horário de Brasília)
* **Dias do Mês:** `*` (todos os dias do mês)
* **Mês:** `*` (todos os meses)
* **Dias da Semana:** `1-5` (Segunda a Sexta-feira: 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta)
* **Destino do Log:** `/var/log/crmnexointegrator_v2-backup.log`

---

## 3. Arquitetura do Script de Backup

* **Script:** `/var/www/crmnexointegrator_v2/scripts/backup-crmnexointegrator_v2.sh`
* **Permissões:** `chmod +x` (Executável por `root`)
* **Diretório de Armazenamento:** `/var/backups/crmnexointegrator_v2/`
* **Permissões do Diretório:** `750` com grupo `postgres`

### Etapas Executadas em Cada Rotina:

1. **Pré-requisitos e Checagem de Ferramental:**
   * Garante a existência do diretório de destino `/var/backups/crmnexointegrator_v2`.
   * Valida a disponibilidade do utilitário `pg_dump`.

2. **Geração do Dump Estruturado (`-Fc`):**
   * Executa `pg_dump` no banco `crmnexointegrator_v2` em formato customizado binário com compressão gzip interna.
   * Padrão de nomeação: `crmnexointegrator_v2_YYYY-MM-DD_HH-MM-SS.dump`.
   * Exemplo: `crmnexointegrator_v2_2026-09-30_17-00-00.dump`.

3. **Validação de Tamanho e Não-Vacuidade:**
   * Checa se o arquivo gerado possui tamanho condizente com a base (bloqueia e alerta caso o dump possua menos de 50 KB).

4. **Verificação de Integridade Pós-Dump:**
   * Executa `pg_restore --list "$BACKUP_FILE"` para validar a tabela de conteúdos (TOC) e garantir que o arquivo não está truncado nem corrompido antes de marcá-lo como válido.

5. **Política de Rotação Automática (30 Dias):**
   * Executa limpeza automática de arquivos com mais de 30 dias de criação (`find ... -mtime +30 -delete`), mantendo o uso de disco controlado.

6. **Log e Notificação:**
   * Registra cada evento no arquivo de log com timestamp ISO/local, tamanho do dump em formato legível (ex.: `2.5M`) e total de backups disponíveis no disco.

---

## 4. Testes de Validação e Prova de Restauração

O processo de restauração foi submetido a teste prático em produção com as 100 tabelas da base:

| Métrica | Valor Testado | Status |
| :--- | :--- | :--- |
| **Total de Tabelas Restauradas** | 100 tabelas | ✅ 100% íntegro |
| **Licitações PNCP (`licitacoes_pncp`)** | 7.981 registros | ✅ 100% íntegro |
| **Oportunidades (`Opportunity`)** | 11 registros | ✅ 100% íntegro |
| **Usuários (`User`)** | 11 registros | ✅ 100% íntegro |
| **Empresas (`Company`)** | 8 registros | ✅ 100% íntegro |
| **Configurações de Sistema (`SystemSetting`)** | 8 registros | ✅ 100% íntegro |
| **Editais (`BidNotice`)** | 16 registros | ✅ 100% íntegro |
| **Tempo Médio de Restauração** | ~6 segundos | ✅ Alta velocidade |

---

## 5. Como Executar a Restauração (Disaster Recovery)

Foi disponibilizado um script auxiliar inteligente para restaurações:
`/var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh`

### A. Listar os backups existentes
```bash
/var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh --list
```

### B. Modo Sandbox / Validação de Integridade (Sem Alterar Produção)
Cria um banco temporário `crmnexointegrator_v2_test_restore`, restaura o dump, confere as 100 tabelas e apaga o banco de teste:
```bash
/var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh --test /var/backups/crmnexointegrator_v2/crmnexointegrator_v2_2026-09-30_09-36-51.dump
```

### C. Modo Restauração Real em Produção
* Cria automaticamente um snapshot de emergência do banco atual antes de tocar em qualquer dado.
* Interrompe o processo PM2 temporariamente.
* Recria a base `crmnexointegrator_v2` e restaura o dump selecionado.
* Reaplica as permissões de acesso ao usuário `chorst`.
* Reinicia o PM2 `crmnexointegrator_v2`.

```bash
/var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh --live /var/backups/crmnexointegrator_v2/<nome_do_arquivo>.dump
```
> *(O script exige a digitação de `CONFIRMAR RESTAURACAO` para evitar acidentes).*

### D. Restauração Manual via Linha de Comando (Opcional)
Se preferir executar manualmente via `psql`/`pg_restore`:
```bash
# 1. Parar PM2
pm2 stop crmnexointegrator_v2

# 2. Recriar banco
sudo -u postgres dropdb --if-exists crmnexointegrator_v2
sudo -u postgres createdb -O chorst crmnexointegrator_v2

# 3. Restaurar arquivo
sudo -u postgres pg_restore -d crmnexointegrator_v2 --no-owner --no-privileges /var/backups/crmnexointegrator_v2/arquivo_desejado.dump

# 4. Conceder permissões ao usuário da aplicação
sudo -u postgres psql -d crmnexointegrator_v2 -c "
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chorst;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chorst;
  GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO chorst;
"

# 5. Iniciar PM2
pm2 start crmnexointegrator_v2
```

---

## 6. Comandos de Manutenção e Monitoramento

### Acompanhar o log do backup diário em tempo real:
```bash
tail -f /var/log/crmnexointegrator_v2-backup.log
```

### Disparar um backup manual a qualquer momento:
```bash
/var/www/crmnexointegrator_v2/scripts/backup-crmnexointegrator_v2.sh
```

### Verificar o espaço em disco na VPS:
```bash
df -h /
```

### Conferir o agendamento no cron:
```bash
crontab -l | grep crmnexointegrator_v2
```

---

## 7. Políticas de Segurança e Boas Práticas

1. **Snapshots Automáticos:** Qualquer intervenção de restauração ao vivo gera previamente um snapshot automático em `/var/backups/crmnexointegrator_v2/pre_live_restore_*.dump`.
2. **Proteção de Acesso:** O diretório `/var/backups/crmnexointegrator_v2/` possui permissões estritas para evitar acessos não autorizados a dados confidenciais de clientes.
3. **Imutabilidade do Schema:** Todas as 100 tabelas do banco contam com índices e constraints sincronizados com o Prisma ORM da aplicação.
