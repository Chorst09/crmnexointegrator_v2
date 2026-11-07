# Atividades da Silvana no Pré-vendas — 03/11/2026

Foram identificadas duas atividades pendentes de `silvana.taborda@doubletelecom.com.br` com destino B2B, embora destinadas ao Pré-vendas. Os perfis comerciais com acesso ao módulo também estavam limitados às próprias atividades pela API.

A rota `activities-simple` agora permite que esses usuários consultem e atualizem atividades cujo fluxo tenha origem ou destino em Pré-vendas, dentro do mesmo tenant. Atividades comerciais de outros responsáveis continuam restritas. O filtro explícito de responsável permanece válido. A implementação alternativa em `apps/api` também passa a gravar o tenant nas novas atividades.

Em produção, somente o destino das atividades `e4399da7-b0cf-4cc6-95df-afc1f62e1d29` e `bd54f02a-4cfe-41ed-8a42-f3e1f6e16152` foi ajustado para `PRE_VENDAS`, preservando descrição, responsável, prazo e status pendente. Não foram criadas atividades duplicadas.

O patch foi aplicado apenas em `/var/www/nexoscrm/backend/api/activities-simple.cjs`, com validação de sintaxe e reinício apenas de `nexoscrm-api`. Backup do código anterior e dos dois registros em `/var/www/nexoscrm/backups/pre-sales-visibility-20261103-171314/`.

## Validação

- Dez testes de regressão passaram: fila compartilhada, restrição sem acesso ao módulo, ausência de tenant, filtro de responsável e atualização protegida, nas duas implementações.
- Sintaxe das duas rotas validada com `node --check`.
- API saudável após a publicação: HTTP 200 em `/api/health`.
- Pela sessão normal já aberta do CRM, em perfil MASTER, foi acionado **Atualizar** em **Pré-vendas → Solicitações**. As duas atividades apareceram na etapa **Entrada**: “Alexandria SD Wan - Conectividade” e “Wi-fi Zone Instituto DR Murilo Fischer”.
- A visibilidade dos perfis comerciais foi verificada por testes de regressão; não foi realizada troca de usuário na sessão de produção.

## Revisão de todos os vendedores

A primeira conferência ficou restrita às atividades da Silvana. Na revisão ampliada, foram auditados os seis usuários com perfil `USER`/`SELLER` da Double e todas as sete atividades da empresa, inclusive registros sem metadados de fluxo. Não foram encontrados tenants ausentes ou divergentes nas atividades desses vendedores.

As duas tarefas pendentes do Fabio também estavam com destino B2B: `f09ee19b-cc59-4f1c-92df-a2b36316fa39` (Intelle 200 Mbps) e `3dd1a590-c795-4f6d-822a-3c1540464760` (Intelle 50 Mbps). Foram encaminhadas a `PRE_VENDAS`, preservando conteúdo, responsável, prazo e status. Backup remoto em `/var/www/nexoscrm/backups/pre-sales-all-sellers-20261103-171728/`.

A conferência final no banco encontrou **quatro tarefas ativas, todas com destino Pré-vendas**. A tarefa automática de contato inicial com lead continua no Comercial. A reunião comercial concluída e a atividade já devolvida ao Comercial preservam seus destinos e histórico.

As quatro demandas foram conferidas na etapa Entrada de **Pré-vendas → Solicitações**, pela sessão normal MASTER já aberta. Os testes passaram a incluir Fabio, outros vendedores e novos operadores, sem regras dependentes de nomes ou IDs: **12 testes passaram**. A regra de acesso compartilhado publicada anteriormente já atende a todos os vendedores; nesta revisão não foi necessário alterar novamente o código de produção ou reiniciar a API.

Novas demandas aparecem nessa fila quando cadastradas com destino **Pré-vendas**. Uma tarefa cadastrada explicitamente como B2B continua sendo uma atividade comercial.
