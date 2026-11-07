# Revisão da recuperação Google Drive — 26/10/2026

## Escopo

Revisão do script `backend/scripts/drive-backup.py`, API e interface de recuperação. Nenhuma restauração sobre o banco de produção foi autorizada ou executada. Teste operacional solicitado para o pacote `doublecrm-full-20261026-180001.tar.gz` usando `prepare` e `test` em banco temporário.

## Achados

1. **Alta: recuperação de banco e arquivos não é atômica.** `restore()` confirma a restauração PostgreSQL antes de extrair os arquivos. Se a extração, ajuste de configuração ou reinício falhar, não há rollback automático dos arquivos/banco; o `finally` reinicia a API mesmo com recuperação parcial. O backup prévio chamado por `/BACKUP/backup-doublecrm.sh` guarda o dump, mas não a versão corrente dos arquivos/configurações. Preparar todos os arquivos em staging, preservar código/configuração atuais e implementar rollback antes de considerar a recuperação completa validada.

2. **Média: o teste de recuperação cobre apenas o banco.** `test_restore()` executa `pg_restore` em base temporária e conta tabelas. Para `files.tar.gz`, somente lista entradas e conta nomes contendo `/uploads/`; não extrai arquivos, não verifica a presença dos componentes obrigatórios e não inicia a aplicação. Portanto, sucesso no teste não comprova recuperação integral do serviço. Reutilizar a validação de caminhos da restauração no teste, extrair em diretório temporário e conferir componentes e uploads.

3. **Média: recuperação de aplicação pode misturar versões de dependências.** O backup exclui `node_modules`, mas a restauração no mesmo servidor não reinstala dependências do lockfile recuperado. Restaurar código antigo sobre dependências atuais pode impedir a inicialização. Usar uma release isolada e instalar dependências compatíveis antes da troca.

4. **Média: ausência de verificação funcional ao final da restauração.** O script considera sucesso após comandos de reinício do PM2. Não confirma healthcheck/banco nem frontend; um processo que reinicia repetidamente pode ser apresentado como recuperado. Acrescentar healthcheck com timeout e retorno de falha sem anunciar sucesso.

5. **Baixa: indicador de teste na interface não é específico da linha.** A lista habilita Testar para a cópia preparada, mas o último resultado é global; um teste antigo permanece visível após preparar outra cópia. Mostrar preparado/testado por arquivo e o alcance exato da validação.

## Proteções existentes verificadas no código

- Endpoints restritos a MASTER.
- Restauração real somente via CLI, com confirmação explícita.
- Download do Drive e SHA-256 externo, mais checksums internos.
- Lock de arquivo para operações concorrentes.
- Teste em banco temporário, removido ao final.
- Validação de caminhos e bloqueio de links no pacote antes de restaurar arquivos.
- Restauração do banco em transação única.

## Resultado operacional

- Pacote `doublecrm-full-20261026-180001.tar.gz` baixado do Drive e verificado com sucesso (SHA-256 externo e checksums internos).
- Restauração em banco temporário concluída: **127 tabelas**.
- Pacote de arquivos listado: **14 entradas de uploads** (essa contagem inclui entradas de diretório; não equivale a 14 arquivos nem comprova recuperação dos anexos).
- O comando de teste concluiu com código 0, incluindo a remoção da base temporária.
- Os 6 testes unitários existentes passaram.
- Nenhuma restauração sobre produção foi executada. Revisão documental; scripts e aplicação não foram alterados nem publicados.
