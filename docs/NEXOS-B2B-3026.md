# Dashboard B2B do Nexos — 14/10/2026

Portabilidade seletiva do commit `0a47007`, sem publicar alterações no Nexos V2. A implantação usa o frontend ativo de `/var/www/crmnexointegrator_3026`, preservando seus demais ajustes e o template comercial.

O domínio tinha frontend no diretório 3026, mas API Docker na porta 3002. A rota exata `/api/dashboard?type=b2b` passa a usar o processo `crmnexointegrator_3026` e o banco `nexoscrm` em `localhost:5433` (Docker encaminha para PostgreSQL interno 5432). Os outros dashboards, módulos e a rota de backup compartilhada mantêm seu backend anterior. O servidor virtual do Nexos V2 permanece igual.

A unidade systemd antiga `crmnexointegrator-v2.service` executava um ecosystem que reiniciava o processo 3026 a cada dez segundos. Ela é desativada; o processo real `crmnexointegrator_v2_3025` pertence a `pm2-root.service` e não é reiniciado nem alterado por este deploy.

Movimentação considera entrada (`leadEntryDate`, fallback `createdAt`) e fechamento real (`actualCloseDate`, fallback `exitDate` somente para perdas). Datas importadas à meia-noite preservam o dia cadastrado; timestamps usam America/Sao_Paulo. Meses ou dias sem movimentação têm zero; datas ausentes são informadas.

Pipeline e análises financeiras consideram somente oportunidades abertas. Histórico usa o período escolhido, por padrão ano atual. A previsão soma valores individuais ponderados, por `expectedCloseDate`, em seis meses; atrasadas e sem previsão são informadas separadamente. Usuários comuns têm responsável fixo; empresas sem tenant não recebem registros de outras empresas. A API seleciona somente os campos necessários e retorna erros genéricos.

Validação: testes de cálculos, períodos, alertas, categorias agrupadas, isolamento e permissões; teste visual com 362 registros sem vendas ganhas, 14 gráficos, desktop/celular e falha/tentativa novamente; build completo do código ativo. O banco não recebe migração nem atualização de dados.

O commit inclui os auxiliares de texto e documentos PNCP ausentes na base do repositório e necessários ao build completo, conforme a referência `0a47007`. Eles não são substituídos na produção; o artefato publicado mantém os arquivos ativos desses módulos.

Backup verificado: `/var/backups/nexos-b2b-20261014-094631`, contendo aplicação, dump de `nexoscrm`, Nginx, unidade antiga e estado PM2, com acesso restrito. A implantação exige checksums do código antes e depois, evitando sobrescrever mudanças posteriores à revisão.

Para rollback, restaure do `application.tgz` os dois arquivos de API, os quatro arquivos de frontend e `apps/web/dist`, restaure `nginx-nexoscrm.conf`, valide `nginx -t`, recarregue Nginx e reinicie somente `crmnexointegrator_3026`. Não é necessário restaurar o banco, pois os dados não foram modificados. Não reative a unidade antiga que causava o ciclo de reinícios.
