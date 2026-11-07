# Publicação Nexos — 07/11/2026

Publicação concluída em https://nexos.chorstconsult.com.br, no servidor `209.50.241.25`.

## Código e destino

- Repositório: https://github.com/Chorst09/nexoscrm, branch `main`.
- Commit de código publicado: `1b2ff769c1a1eb15f480d3d67a133785e95828f1`.
- A árvore local completa foi publicada preservando o histórico remoto, sem force push.
- Fontes, migrações, testes e documentação foram incluídos. Credenciais foram removidas dos scripts revisados; dumps e ZIPs de backup foram retirados da árvore versionada, preservando as cópias locais.
- Instalação ativa: `/var/www/crmnexointegrator_3026`.
- Processo reiniciado: somente `crmnexointegrator_3026`, porta `3026`.
- Frontend ativo: `/var/www/crmnexointegrator_3026/apps/web/releases/20261107-1b2ff769`.
- Frontend anterior preservado: `/var/www/crmnexointegrator_3026/apps/web/releases/legacy-20261107-1b2ff769`.

Foram atualizados 440 arquivos diferentes da aplicação. O frontend possui 252 arquivos verificados por SHA-256, com os assets antigos preservados para abas já abertas. Dependências do backend foram instaladas em staging com `npm ci`; Prisma Client 5.22.0 foi gerado e os 79 modelos foram consultados em transação somente de leitura antes da ativação.

## Preservação dos dados

Backup validado: `/var/www/crmnexointegrator_3026/backups/deploy-20261107-1b2ff769`.

O diretório, restrito a root, contém dump PostgreSQL custom validado com `pg_restore --list`, configurações, arquivos privados e uploads, fontes substituídas, dependências anteriores, manifesto das alterações e relatórios de validação.

Nenhuma migração de banco, seed, restauração de dados ou redefinição de senha foi executada em produção. Arquivos de ambiente e diretórios persistentes foram preservados. A comparação de contagens e hashes do conteúdo das tabelas principais, antes e depois da publicação, confirmou que os registros permaneceram iguais:

| Tabela | Registros |
| --- | ---: |
| User | 11 |
| Company | 352 |
| Opportunity | 376 |
| Contract | 0 |
| CompanyDocument | 0 |
| ContractAttachment | 0 |

Essa comparação cobre as seis tabelas listadas; o dump preserva o banco completo anterior à publicação.

## Validação

- Build de produção e três verificações obrigatórias de edição de oportunidades aprovados.
- 155 testes de regressão aprovados.
- Pré-validação isolada em loopback, com agendador de integrações desativado no processo temporário.
- API publicada: saúde, sessão autenticada, usuários, empresas, oportunidades, dashboards B2B/Geral, contratos e status de agendas responderam HTTP 200.
- Índice e JS/CSS públicos conferidos com o manifesto SHA-256 do build.
- Chrome em produção: dashboards B2B e Geral, filtro de 30 dias e layout mobile, sem erros de JavaScript ou respostas HTTP 500 das APIs.
- A verificação no navegador efetuou apenas leituras; não foram criados clientes, oportunidades, usuários, contratos ou eventos de teste.

## Reversão

Parar somente `crmnexointegrator_3026`, restaurar os arquivos existentes de `previous-source.tar.gz` conforme `changes.json`, remover somente os arquivos novos listados no manifesto e devolver `backend-node_modules` do backup para `backend/node_modules`. Reativar o frontend anterior por troca do link `apps/web/dist` e reiniciar somente esse processo. Conferir `/api/health` e o site público.

Não restaurar o dump sobre o banco em uso automaticamente: dados criados após esta publicação precisam ser preservados. A reversão de código não exige restauração de banco, pois esta publicação não executou migrações.
