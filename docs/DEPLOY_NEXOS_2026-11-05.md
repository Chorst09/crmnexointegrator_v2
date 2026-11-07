# Deploy Nexos — 05/11/2026

Concluído às 18h16 de Brasília em https://nexos.chorstconsult.com.br, servidor 209.50.241.25.

O virtual host Nginx serve /var/www/crmnexointegrator_3026/apps/web/dist e encaminha /api ao processo PM2 crmnexointegrator_3026, porta 3026. Os containers em /opt/nexoscrm e o serviço nexosv2 não são o destino deste domínio e não foram atualizados.

Foram publicados 90 arquivos diferentes do backend e módulos compartilhados, dependências instaladas em staging com npm ci e Prisma Client 5.22 gerado. Foi definido NODE_PATH para o node_modules do backend e a configuração PM2 foi salva. Inclui a correção da consulta de agenda para Master. O frontend contém 252 arquivos verificados por SHA-256, ativados em /var/www/crmnexointegrator_3026/apps/web/releases/20261105-181658-093957. Release anterior: /var/www/crmnexointegrator_3026/apps/web/releases/20261030-175136-759397. Assets antigos foram preservados para abas abertas.

Backup validado: /var/www/crmnexointegrator_3026/backups/nexos-deploy-20261105-181644/. Inclui dump PostgreSQL validado com pg_restore 17, configurações e arquivos privados, arquivos substituídos, node_modules anterior, manifesto e deployment.json. O diretório é restrito a root. Não houve migração de banco: o novo Prisma Client leu os 79 modelos existentes sem erros antes da publicação.

As contagens anteriores e posteriores permaneceram: 352 empresas, 376 oportunidades, 11 usuários, zero contratos e zero documentos de empresas. Isso verifica contagens, não o conteúdo integral de cada registro.

Validação: 95 testes de regressão aprovados; todos os imports literais do pacote resolvidos em staging; HTTPS da página e API com HTTP 200 e banco conectado; index e JS/CSS públicos correspondentes à release; contratos e status de agendas sem autenticação retornam 401 e caminho público de contratos retorna 404. Não foram criados registros de clientes nem eventos de teste. Integrações externas e fluxos autenticados de ponta a ponta não foram validados nesta etapa.

Durante a preparação, uma tentativa parou na validação do dump por incompatibilidade de pg_restore, antes de alterar a aplicação. A primeira ativação foi revertida automaticamente por ausência de pre-sales-closure.cjs no pacote herdado; o módulo foi incluído nas duas estruturas, todos os imports foram conferidos e a publicação final passou. O frontend só foi ativado após API saudável.

O deploy anterior em double.chorstconsult.com.br permanece documentado separadamente em DEPLOY_PRODUCAO_2026-11-05.md. A publicação do domínio Nexos foi solicitada e confirmada pelo usuário após esclarecer os destinos distintos.

Para reverter, restaurar os arquivos conforme changes.json (removendo apenas os novos listados), restaurar node_modules anterior e reativar a release anterior por troca do link dist; reiniciar apenas crmnexointegrator_3026. Não restaurar o dump sobre o banco ativo sem avaliar dados posteriores.
