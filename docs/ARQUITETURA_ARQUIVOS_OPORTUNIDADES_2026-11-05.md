# Arquivos na oportunidade e consulta consolidada na empresa

Esta decisão substitui o fluxo de anexação na edição da empresa publicado anteriormente em 05/11/2026.

## Modelo e decisão

A oportunidade é a origem de contratos anexados e documentos. Cada arquivo possui uma única identidade e uma única associação à oportunidade; a empresa oferece uma consulta consolidada desses mesmos registros, separada por tipo. Consultar pela empresa não copia arquivos nem cria novos contratos.

O armazenamento existente `CompanyDocument` já contém `opportunityId`, `companyId` e `documentType`. Foi reaproveitado sem renomear tabelas, mover arquivos ou executar migração. O nome físico da tabela é mantido por compatibilidade; a responsabilidade funcional do novo fluxo é da oportunidade.

`Contract` representa o cadastro comercial/financeiro existente, com número, valor, vigência e status; `ContractAttachment` representa seus anexos anteriores. Um arquivo classificado como CONTRACT não gera automaticamente esse cadastro, pois o upload não fornece dados suficientes para inventar valores ou vigências. Ambos os modelos e seus dados permanecem intactos. Cadastros anteriores sem associação exibem essa ausência explicitamente, sem atribuição automática.

## Fluxo publicado

- Em visualizar ou editar uma oportunidade, **Arquivos da oportunidade** contém duas áreas independentes: **Contratos** e **Documentos**. Cada área tem seu próprio seletor e botão de envio. A oportunidade é preenchida pela URL da API e a empresa é derivada do registro persistido, sem seleção manual ou confiança nesses campos enviados pelo navegador.
- Em visualizar empresa, a aba **Contratos** mostra somente os anexos CONTRACT, com as colunas Arquivo, Oportunidade e Ações. A aba **Documentos** mostra somente DOCUMENT. Cada linha permite baixar o arquivo e abrir sua oportunidade. Cadastros do módulo de contratos continuam disponíveis em uma seção própria quando existem.
- A edição da empresa não oferece upload; orienta a abrir suas oportunidades. A empresa funciona como consulta, evitando um segundo fluxo de cadastro.
- Arquivos são enviados pelos botões de sua própria seção. Falhas parciais mantêm somente os pendentes, sem repetir os já enviados. Há proteção contra salvar/fechar uma oportunidade descartando silenciosamente arquivos selecionados.

## API e autorização

Rotas principais:

- `GET/POST /api/opportunities/:opportunityId/documents`.
- `GET /api/opportunities/document/:documentId/download`.
- `DELETE /api/opportunities/document/:documentId`.
- `GET /api/companies/:companyId/documents?documentType=CONTRACT|DOCUMENT`.

O POST exige o tipo e rejeita um `opportunityId` no corpo que conflite com a URL. A empresa vem da oportunidade autorizada. A autorização acompanha o acesso às oportunidades: responsável, perfil administrativo, tenant, módulo B2B/B2G e proteção dos registros pessoais existentes. Uma empresa acessível não libera anexos de oportunidades de outro responsável. Documentos anteriores sem oportunidade continuam sob a regra de acesso à empresa.

Os endpoints anteriores da empresa permanecem compatíveis com abas antigas, usando a mesma tabela, armazenamento e controles de autorização. O frontend novo utiliza o endpoint da oportunidade. O armazenamento privado e as proteções contra exclusão/transferência de oportunidades com anexos foram preservados.

## Dados e implantação

Publicação concluída no servidor `200.142.149.2`, em 05/11/2026, com quatro arquivos de backend e 251 de frontend verificados por SHA-256. Somente a API foi reiniciada. Não houve mudança de schema, geração de cliente Prisma, UPDATE/DELETE de registros ou migração de dados.

A auditoria anterior encontrou zero registros nas tabelas CompanyDocument, Contract e ContractAttachment. Um snapshot completo e a comparação integral posterior confirmaram os mesmos dados. O mecanismo também compara os hashes dos arquivos existentes; nesta instalação não havia arquivos nessas tabelas. Nenhum arquivo de teste foi anexado a empresas reais.

Backup e relatórios de implantação:

`/var/www/nexoscrm/backups/opportunity-files-20261105-a0_979x2/`

Release anterior: `/var/www/nexoscrm/frontend/releases/20261105-085542-861780`.

Release ativa: `/var/www/nexoscrm/frontend/releases/20261105-092257-326544`.

A reversão restaura os arquivos anteriores e o link da release, sem exigir reversão de banco. Assets antigos permanecem disponíveis para abas abertas antes da publicação.

## Verificação

- 20 testes de API com multipart real, cobrindo origem automática, separação dos tipos, compatibilidade, acesso por responsável/tenant/módulo, falhas e limpeza de arquivos.
- 63 regressões de empresas, atribuição, visibilidade e proteção de vínculos aprovadas.
- Build e três verificações obrigatórias de edição aprovados; sete arquivos de backend validados por sintaxe.
- Navegador com APIs simuladas: envio separado na oportunidade, contrato em oportunidade ganha, consulta correta na empresa, ausência de upload na empresa, navegação de volta à oportunidade, cadastro anterior preservado, envio parcial sem duplicação e proteção de arquivos pendentes. Desktop e celular conferidos visualmente.
- API saudável, banco conectado e cinco operações protegidas retornando 401 sem autenticação. Consulta relacional de consolidação executada com sucesso no Prisma de produção, somente em leitura.
- O teste antigo de edição comercial abre e salva, mas falha na última expectativa financeira: espera 1800 e recebe 2050 para produtos mais setup. A comparação com o snapshot local inicial confirmou `OpportunityForm.jsx` idêntico e a lógica de gravação idêntica, exceto pela nova proteção de arquivos pendentes. Esse cálculo preexistente não foi alterado nesta tarefa.
