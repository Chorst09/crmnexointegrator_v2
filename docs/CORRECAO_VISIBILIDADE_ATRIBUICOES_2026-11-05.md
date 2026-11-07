# Visibilidade de oportunidades e atividades atribuídas

## Correção local

O acesso global do Master (`getTenantCompanyId`/`getTenantId` retornando `null`) estava sendo usado para gravar o tenant de atividades. Na criação de oportunidades, o backend também aceitava tenant enviado no corpo e podia gravar `null` quando o Master não o informava. As listagens do gerente filtram pelo próprio tenant e ocultam esses registros, mesmo quando `ownerId`/`assignedToId` estão corretos.

As rotas de criação de oportunidades e atividades em `backend` e `apps/api/api` passam a resolver o tenant pelo responsável selecionado quando o operador é Master. Para administradores, o tenant autenticado continua obrigatório como limite de acesso. O corpo enviado pelo navegador não escolhe o tenant. Responsáveis inexistentes retornam erro; atividades não são silenciosamente atribuídas ao criador. Empresas e oportunidades vinculadas precisam ser compatíveis com o tenant resolvido.

O status `WON`, o responsável e o fluxo de comissão são preservados. As listagens continuam usando o tenant e as permissões existentes.

Também foi corrigida a classificação B2B/B2G nas três implementações de oportunidades e no utilitário do frontend: `LICIT` e `EDITAL` sem limites de palavra confundiam “solicitação”, “solicitou” e “credital” com sinais de licitação.

## Recuperação de registros existentes

`backend/scripts/repair-assigned-record-tenants.cjs` audita oportunidades e atividades de um responsável explícito. Por padrão, não escreve no banco. Com `--apply`, exige diretório de backup, salva os registros antes de escrever e corrige somente tenants ausentes, compatíveis com os vínculos existentes. Divergências de tenants não nulos são apresentadas para revisão, sem correção automática.

O reparo altera somente `tenantCompanyId`, preserva `updatedAt` e usa uma transação com verificações de concorrência. Status, valores, datas de fechamento e responsáveis permanecem intactos.

Exemplo no diretório do backend do servidor, com o ambiente de produção já carregado:

```sh
node scripts/repair-assigned-record-tenants.cjs --owner-email=silvana.taborda@doubletelecom.com.br
node scripts/repair-assigned-record-tenants.cjs --owner-email=silvana.taborda@doubletelecom.com.br --apply --backup-dir=/var/www/nexoscrm/backups/assigned-record-tenants-20261105
```

## Validação e publicação

- Testes de criação por Admin/Master e leitura pelo gerente nas seis rotas, incluindo oportunidades ganhas, outro gerente, isolamento entre tenants e responsável inválido.
- Testes de recuperação com backup e proteção contra concorrência.
- Regressões de classificação B2B/B2G e dos fluxos de pré-vendas.
- Sintaxe das rotas e script verificada; build do frontend concluído com as três verificações de edição de oportunidades.
- Duas verificações preexistentes de `opportunity-create.test.cjs` falham por campos de receita ausentes no schema alternativo de `apps/api` e no script de inicialização do backend; esses arquivos não foram alterados nesta correção.

## Publicação concluída

Publicado em 05/11/2026 no servidor informado pelo usuário, `200.142.149.2`, após autorização e fornecimento direto do acesso SSH. Foram atualizadas somente as três rotas de produção em `backend/api` e instalado o utilitário de recuperação. A comparação com os arquivos do servidor confirmou que as diferenças eram exclusivamente desta correção. A release do frontend foi preservada; as oportunidades retornadas pela API já incluem a classificação explícita B2B/B2G.

Backup das rotas anteriores, manifesto de integridade e relatório de validação em:

`/var/www/nexoscrm/backups/assigned-record-tenants-20261105-mart11pl/`

O caso relatado foi confirmado: **B2B-2026-00382 — Segurança Reali**, ID `aa7ef499-920b-4e2f-be10-1802abeb48ba`, estava como `WON`, atribuída à Silvana, com `tenantCompanyId` nulo, enquanto o cliente e a gerente pertenciam ao mesmo tenant da Double.

A auditoria dos perfis comerciais da Double encontrou cinco oportunidades com tenant ausente. Todas foram recuperadas em uma transação, com backup anterior aos dados, incluindo três da Silvana, uma do Fabio e uma do Luciano. Os quatro registros pessoais do Master permaneceram intactos. Nenhuma atividade dos gerentes estava sem tenant.

Registros recuperados: `B2B-2026-00382`, `B2B-2026-00003`, `B2B-2026-00001`, `B2B-2026-00004` e `B2G-2026-00007`. A comparação integral de cada registro antes/depois confirmou que somente `tenantCompanyId` mudou, preservando inclusive `updatedAt`, valores, datas, responsável e status.

Validação final:

- **114 testes de regressão aprovados**, além das três verificações de edição do build já concluído.
- Quatro arquivos publicados com SHA-256 correspondente ao pacote validado.
- Somente `nexoscrm-api` reiniciada; saúde HTTP 200 e banco conectado.
- As três rotas protegidas continuam retornando HTTP 401 sem autenticação; frontend HTTP 200.
- Consulta no banco com os filtros reais de responsável, tenant e `WON` inclui **Segurança Reali** para Silvana, com classificação B2B confirmada pelo classificador publicado.
- Não houve teste pela sessão da Silvana na interface. A revisão automática rejeitou um teste que geraria token JWT para essa identidade; esse método não foi executado nem substituído por outra forma de personificação. A verificação usou consultas administrativas aos dados e filtros publicados.
