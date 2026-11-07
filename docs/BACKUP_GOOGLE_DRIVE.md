# Backup independente no Google Drive

Conta autorizada: `chorstconsult@gmail.com`. Pasta privada: `DOUBLECRM_BACKUP`.
Agendamento no servidor: `/etc/cron.d/doublecrm-drive-backup`, diariamente às
18h, com o servidor em `America/Sao_Paulo`. A rotina local das 02h30 permanece
separada. Acesso ao painel do Drive restrito a MASTER.

Cada pacote contém o dump PostgreSQL de `doublecrm`, uploads de `backend` e
`apps/api`, código e configuração da aplicação, frontend compilado e configuração
do Apache. Dependências `node_modules`, repositório Git e arquivos antigos de
backup não são incluídos. O dump é consistente no banco; arquivos enviados são
copiados em seguida, sem congelar as alterações feitas pelos usuários.

O upload é verificado baixando a cópia e conferindo SHA-256. Checksums internos
também são conferidos antes de preparar/restaurar o pacote. Cópias locais ficam
em `/BACKUP/GOOGLE_DRIVE`, com pasta 0700 e arquivos 0600. São mantidos somente
os 3 pacotes mais recentes no Google Drive e na cópia local desta rotina, com
seus checksums. A limpeza ocorre após o novo envio e sua verificação. O script
de recuperação e a configuração do rclone são preservados. A rotina local
independente das 02h30 permanece com sua retenção própria. A pasta contém
dados sensíveis e configurações: não compartilhar publicamente.

## Recuperação rápida no mesmo servidor

No módulo Configurações > Backup > Google Drive, selecione **Preparar restauração**.
Isso baixa a cópia do Drive e confere seus checksums. **Testar** restaura o banco
em uma base temporária e a remove ao final; não altera a base de produção.

Como root, execute o comando apresentado pelo painel:

```sh
python3 /var/www/nexoscrm/backend/scripts/drive-backup.py restore doublecrm-full-AAAAMMDD-HHMMSS.tar.gz RESTAURAR_DOUBLECRM
```

A restauração cria um dump prévio pela rotina `/BACKUP/backup-doublecrm.sh`,
para a API, restaura o banco em transação única e recupera os arquivos. Mantém a
senha corrente do banco nas URLs de conexão e reinicia a aplicação. Configurações
do Apache são recuperadas no host; em caso de alteração, o administrador deve
validar `httpd -t` e copiar a configuração para o container antes de recarregá-lo.
Não execute a restauração simultaneamente com importações, migrações ou outras
operações administrativas. Confirme o healthcheck e login após a recuperação.

## Perda do servidor

Baixe do Drive o pacote escolhido, seu `.sha256` e `RESTORE-doublecrm.py`.
Confira o SHA-256. Instale Docker/PostgreSQL 15, Node.js, PM2 e rclone. Crie os
diretórios protegidos em `/BACKUP`, configure novamente o rclone e disponibilize
o container `nexoscrm-postgres`, usuário `nexoscrm` e banco `doublecrm`.
Recupere a aplicação do `files.tar.gz` do pacote e reinstale dependências com o
lockfile correspondente. Recrie a rotina local `/BACKUP/backup-doublecrm.sh`
antes da restauração e os processos PM2 `nexoscrm-api` e `nexoscrm-frontend`.
Os arquivos contêm as configurações, mas provisionamento de um servidor novo
exige essas etapas administrativas; não se trata de uma imagem completa do SO.

## Operação

### Incidente de 23/10/2026

O cron local disparou às 02h30, mas `/usr/local/bin/check-website-health.sh`
reiniciou o Docker no mesmo segundo. O monitor procurava o container antigo
`double-website-prod` a cada cinco minutos e reiniciava todo o daemon quando
não o encontrava. O dump foi interrompido com `No such exec instance`.

Correção aplicada: o monitor acompanha `site-double-app` e `site-double-apache`
e inicia somente esses containers se estiverem parados, sem reiniciar o Docker.
A versão corrigida está em `scripts/check-website-health.sh`. A rotina local
está versionada em `scripts/backup-doublecrm.sh`. Os dois métodos de backup
fazem até três tentativas de dump/validação, com intervalo de 20 segundos.

Backup local de recuperação gerado em 23/10 às 09h04, com checksum conferido
e restauração de 126 tabelas em uma base temporária. O envio completo ao Drive
foi concluído às 09h05, com download de verificação e comparação SHA-256.
A cópia foi novamente baixada do Drive e restaurou 126 tabelas em uma base
temporária; o pacote contém também 14 entradas de uploads.
Os horários diários continuam às 02h30 (local) e às 18h (Drive), em Brasília.

A API agora informa atraso em relação ao último horário previsto e verifica
se o serviço cron está ativo. As alterações visuais correspondentes estão
no código local da interface e precisam ser incluídas na próxima publicação
do frontend; a intervenção deste incidente publicou somente o backend e os
scripts operacionais.

```sh
python3 /var/www/nexoscrm/backend/scripts/drive-backup.py run
python3 /var/www/nexoscrm/backend/scripts/drive-backup.py status
tail -f /BACKUP/GOOGLE_DRIVE/operations.log
```

O token OAuth está em `/BACKUP/GOOGLE_DRIVE/rclone.conf`; não copiar para a
interface ou logs. O rclone usa inicialmente o cliente OAuth compartilhado.
A versão atual informa sua descontinuação durante 2026: configurar um cliente
OAuth próprio do Google Cloud e refazer a autorização para continuidade.
Documentação oficial: <https://rclone.org/drive/#making-your-own-client-id>.
