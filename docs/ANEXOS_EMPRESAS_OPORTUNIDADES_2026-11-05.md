# Contratos e documentos por oportunidade

> Fluxo substituído pela [arquitetura com anexação na oportunidade e consulta na empresa](ARQUITETURA_ARQUIVOS_OPORTUNIDADES_2026-11-05.md). Este documento registra a primeira publicação.

Publicado em 05/11/2026 no servidor `200.142.149.2`.

Na edição da empresa, a seção **Contratos e documentos** permite selecionar arquivos de até 10 MB, informar o tipo (Contrato/Documento) e escolher obrigatoriamente a oportunidade de cada arquivo. Os arquivos são enviados ao atualizar a empresa. A mesma regra vale para o envio pela aba Documentos da visualização.

O seletor consulta apenas oportunidades da empresa e do tenant correspondente, incluindo oportunidades ganhas. A API recusa oportunidade ausente, inexistente, de outra empresa ou de outro tenant. Sem oportunidade cadastrada, o formulário orienta o cadastro antes de anexar. Uma empresa nova precisa ser salva antes desse fluxo.

A listagem mostra o tipo e a oportunidade do anexo, com download e exclusão autenticados. Os novos arquivos ficam em `backend/private-uploads/companies`, fora das rotas estáticas públicas; o backup completo existente inclui o diretório do backend. Documentos anteriores continuam legíveis sem vínculo inventado. Uma falha parcial mantém somente os arquivos pendentes para nova tentativa.

## Persistência e permissões

- `CompanyDocument.opportunityId` com chave estrangeira para Opportunity e exclusão restrita; campo nullable para documentos legados, mas obrigatório em todo novo envio pela API.
- `CompanyDocument.documentType`, com padrão DOCUMENT e tipos aceitos CONTRACT/DOCUMENT.
- Migração aditiva `20261105120000_company_document_opportunity` nas duas implementações. Em produção, somente essa migração foi aplicada, em transação; não houve execução geral de migrações pendentes.
- Rotas de documentos montadas antes da rota legada de empresas no backend de produção. A autorização usa a mesma regra de visibilidade da empresa.
- Oportunidades com anexos não podem ser excluídas ou transferidas explicitamente para outra empresa sem remover seus documentos. A exclusão da empresa remove metadados dos anexos antes das oportunidades na transação existente.
- Rotas: `GET /api/companies/:id/document-opportunities`, `GET/POST /api/companies/:id/documents`, `GET /api/companies/document/:documentId/download` e `DELETE /api/companies/document/:documentId`.

## Validação

- 12 testes com multipart real: envio, vínculo, download, exclusão, autorização, tamanho/tipo e limpeza após falha.
- Quatro testes de proteção do vínculo nas rotas de oportunidades.
- 65 regressões de empresas, atribuição e visibilidade aprovadas. O teste existente de visibilidade recebeu a dependência de assignment que faltava em seu contexto de execução.
- Schemas Prisma das duas implementações validados; sintaxe de dez arquivos conferida; build do frontend concluído, incluindo três verificações obrigatórias de edição de oportunidades.
- Navegador com APIs simuladas: seleção obrigatória por arquivo, contrato em oportunidade ganha, falha parcial sem duplicação, persistência visível e layouts de desktop/celular. Nenhum arquivo de teste foi anexado a clientes reais.
- Comparação com o frontend ativo: 229 chunks equivalentes ignorando referências de hash. As diferenças ficaram em Empresas, classificação de negócio da correção anterior, entrada gerada e CSS.
- Produção: integridade SHA-256 de oito arquivos de backend e 251 de frontend; API saudável com banco conectado; as cinco novas rotas/operações exigem autenticação.
- Cliente Prisma regenerado no servidor. A consulta real para Reali encontrou **B2B-2026-00382 — Segurança Reali (WON)** e **B2B-2026-00014 — Reali - Conectividade (NEGOTIATION)** disponíveis para associação. Chave estrangeira e índice conferidos; a tabela de documentos estava vazia antes e após o deploy.

## Publicação e reversão

Backup do código, snapshot anterior da tabela, manifestos e relatórios:

`/var/www/nexoscrm/backups/company-documents-20261105-wg6zkr0e/`

Frontend anterior: `/var/www/nexoscrm/frontend/releases/20261104-110900-012041`.

Frontend ativo: `/var/www/nexoscrm/frontend/releases/20261105-085542-861780`.

Somente `nexoscrm-api` foi reiniciada. A ativação do frontend usou troca atômica do link após verificar o manifesto, preservando assets de abas antigas. A reversão de código pode restaurar os arquivos do backup e a release anterior, regenerar o cliente Prisma e reiniciar a API; as colunas aditivas podem permanecer para preservar dados.
