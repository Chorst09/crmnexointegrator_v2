# Publicação em produção — 05/11/2026

Publicação concluída às 11h10 de Brasília em `200.142.149.2`, com acesso público em https://double.chorstconsult.com.br.

Foram publicados 20 arquivos de backend e 252 arquivos do frontend, incluindo origem/próxima ação dos leads, estrutura de integração com agendas, contratos com vencimento e cópia de anexos da oportunidade. Os módulos compartilhados carregados de apps/api também foram comparados; os módulos ativos de simuladores e B2G já correspondiam aos arquivos locais. A estrutura alternativa apps/api não foi publicada integralmente.

Foram aplicadas somente as migrações `20261105130000_company_lead_origin`, `20261105140000_company_lead_next_action` e `20261105150000_contract_expiration_and_opportunity_copy`, em uma transação explícita, pelo Prisma db execute. O cliente Prisma do backend foi regenerado. Não houve execução geral de migrate deploy nem db push. Somente `nexoscrm-api` foi reiniciada.

Backup no servidor: `/var/www/nexoscrm/backups/production-20261105-111032/`.

O diretório inclui dump completo PostgreSQL em formato custom, validado com pg_restore --list; cópia dos arquivos substituídos; arquivo de anexos privados, uploads e configuração; manifesto; contagens anteriores/posteriores e relatório deployment.json. O diretório possui acesso restrito a root.

Release anterior: `/var/www/nexoscrm/frontend/releases/20261105-092257-326544`.

Release ativa: `/var/www/nexoscrm/frontend/releases/20261105-111042-996549`.

As contagens antes/depois permaneceram iguais: 359 empresas, 384 oportunidades, 10 usuários, 6 documentos, zero contratos e zero anexos de contratos. Isso confirma contagens, não uma comparação integral do conteúdo dos registros. O dump preserva o estado anterior. Não foram anexados arquivos nem criados registros de teste em clientes reais.

O frontend foi ativado por troca atômica de link após conferir o manifesto SHA-256. Assets da release anterior foram preservados para abas abertas. Os hashes dos arquivos publicados do backend foram conferidos.

## Validação

- Build de produção e três verificações obrigatórias de edição de oportunidades aprovados.
- 56 testes de contratos, agendas, próxima ação e documentos aprovados.
- Regressões adicionais: 134 aprovações e duas falhas de verificações estáticas legadas em opportunity-create.test.cjs: campos financeiros ausentes no schema alternativo apps/api e declaração esperada em ensure-schema.cjs. O diff do schema ativo mostrou apenas alterações de leads, agendas e contratos; os campos financeiros do backend ativo permaneceram presentes. Essas duas inconsistências não foram corrigidas neste deploy.
- HTTPS: página inicial, login, JS/CSS de entrada e saúde da API com HTTP 200; hashes públicos de JS/CSS correspondem ao build local.
- API informa banco conectado após o reinício.
- Rotas de agendas, contratos e anexos recusam acesso sem autenticação com 401. Downloads públicos em /uploads/contracts permanecem bloqueados com 404.
- A rota existente /api/simulator/proposals usa autenticação opcional e retorna 200 sem token; seu módulo compartilhado já era idêntico ao local e não foi modificado nesta publicação.
- Site institucional https://doubletelecom.com.br responde com HTTP 200.

## Pendência de agendas

CALENDAR_TOKEN_KEY e as credenciais OAuth Google/Microsoft não estão configuradas no servidor. A estrutura foi publicada, mas conectar agendas e enviar avisos depende dessa configuração. Nenhuma integração real foi conectada ou validada. Instruções em LEAD_PROXIMA_ACAO_AGENDAS.md e CONTRATOS_VENCIMENTO_AGENDAS.md.

## Reversão

Restaurar os arquivos existentes do backup conforme changes.json; remover somente os novos arquivos listados no manifesto; regenerar o Prisma Client e reiniciar nexoscrm-api. Reativar a release anterior por troca atômica do link frontend/dist. As alterações aditivas do banco podem permanecer, preservando dados criados após a publicação. Não restaurar o dump sobre o banco em uso sem avaliar registros posteriores.

## Complemento: Editar Lead

Às 11h19 de Brasília foi publicada a release de frontend `/var/www/nexoscrm/frontend/releases/20261105-111901-914073`, com 252 arquivos verificados. Ela acrescenta Editar Lead na lista de Lead Scoring e na janela de decisão do lead. O formulário permite alterar os dados da empresa, origem, detalhes da origem e próxima ação com responsável/data/lembrete. Usa PUT na empresa existente, sem enviar contatos, status ou redistribuição automática. O cadastro de novos leads continua separado.

Teste de navegador com APIs simuladas validou pesquisa por CNPJ, preenchimento dos dados atuais, alteração da origem e próxima ação, preservação de contatos/status, formulário aberto após erro da API e reinicialização ao cadastrar novo lead. Build e verificações de edição aprovados. Nenhum cliente real foi alterado no teste. A publicação foi somente de frontend, sem nova migração nem reinício da API; a release anterior deste complemento é `20261105-111042-996549`.

## Complemento: responsáveis dos leads

Às 11h24 foi corrigida a listagem action=sellers de leadDistribution nas duas estruturas da API. A consulta antiga do backend ativo considerava apenas o perfil SELLER; agora considera os perfis comerciais habilitados no módulo e no mesmo tenant. Admin/Master recebem a lista completa desse ambiente; outros perfis recebem somente seu próprio cadastro. São retornados apenas identificação, nome, e-mail e estatísticas comerciais necessárias. A mudança da listagem não altera as estratégias internas de distribuição automática.

Foram publicados quatro arquivos, sem mudanças no banco ou frontend. Somente nexoscrm-api foi reiniciada. Backup: `/var/www/nexoscrm/backups/lead-account-managers-20261105-112415/`. Os 26 testes de listagem/atribuição passaram. A execução somente de leitura do handler real em produção confirmou 10 responsáveis para cada Admin/Master e somente 1 para cada usuário comercial comum. API saudável e banco conectado após o reinício.

## Complemento: acesso à agenda

Às 11h28 foi publicada a release `/var/www/nexoscrm/frontend/releases/20261105-112827-761589`, com 252 arquivos verificados, acrescentando o botão Minha agenda no cabeçalho de Lead. O botão abre uma janela com Google Calendar e Microsoft Outlook; a seção existente na página também foi preservada. Credenciais OAuth continuam pendentes. Build e teste de abertura da janela com APIs simuladas aprovados. Release anterior: `/var/www/nexoscrm/frontend/releases/20261105-111901-914073`. Sem mudanças no backend ou banco.

## Configuração Google Calendar

Às 11h38 as credenciais OAuth Google fornecidas foram configuradas exclusivamente no servidor, com callback `https://double.chorstconsult.com.br/api/lead-calendar/google/callback`. Foi gerada a chave CALENDAR_TOKEN_KEY. Configurações anterior e atual estão protegidas no diretório `/var/www/nexoscrm/backups/google-calendar-config-20261105-113848/`, com arquivos 0600 e diretório 0700. Não há valores secretos neste relatório ou no código.

Somente nexoscrm-api foi reiniciada. A verificação autenticada de /api/lead-calendar/status confirmou Google configured=true e Microsoft configured=false. API pública saudável e banco conectado. Ainda falta cada usuário concluir o consentimento Google; a configuração do cliente no Console, consentimento e criação de eventos reais não foram validados nesta etapa. A pendência Google descrita nas seções anteriores foi resolvida no servidor; Microsoft continua pendente.


## Retomada após interrupção — 18h08 de Brasília

A comparação SHA-256 do pacote /tmp/nexos-all-changes.tar.gz confirmou que todos os arquivos de frontend preparados já estavam publicados na release 20261105-170153-384110, apontada por dist e current. A API estava saudável. Não foi necessário republicar o frontend.

Foram publicados quatro arquivos: backend/prisma/schema.prisma, backend/lib/lead-calendar.cjs, apps/api/lib/lead-calendar.cjs e apps/api/public/proposta-comercial-double.pptx. O schema foi alinhado ao campo Contract.alertDays já existente no banco, e o Prisma Client foi regenerado. A consulta de agenda passou a incluir contractScope como condição completa, evitando a falha ao expandir AND inexistente para Master; os filtros adicionais de tenant e responsável permanecem aplicados. O modelo de proposta da API foi alinhado ao pacote preparado. A estrutura alternativa apps/api não foi publicada integralmente; diferenças de arquivos inativos, testes, nginx.conf e package-lock não foram sobrescritas.

Backup: /var/www/nexoscrm/backups/resume-final-20261105-180827/. Inclui os arquivos anteriores, manifesto, relatório e dump PostgreSQL validado com pg_restore --list. Nenhuma migração foi executada. Somente nexoscrm-api foi reiniciada.

Validação: 28 testes de contratos/agendas aprovados, incluindo regressão Master nas duas estruturas. Prisma Client reconhece alertDays; consultas de contratos usadas pelas duas conexões de agenda passaram em leitura. Página pública e API responderam HTTP 200, banco conectado; index e JS/CSS públicos correspondem à release ativa. A verificação não criou eventos ou alterou clientes. O trabalhador normal de agenda continua ativo; não foi feita validação ponta a ponta dos provedores externos nesta retomada.
