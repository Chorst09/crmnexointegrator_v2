# Anexos PNCP — correção de 13/10/2026

O modal volta a consultar os arquivos oficiais ao abrir o edital, mesmo quando a
busca retorna apenas metadados. O download usa o sequencial real do documento,
preserva o nome e a extensão e apresenta erros com opção de tentar novamente.
O botão de ficha resumo foi removido da seção de anexos.

A API publicada não carregava as rotas antigas porque o módulo de resumo exigia
`jspdf`, ausente na imagem Docker. `backend/api/b2g-documents.js` fornece as rotas
de arquivos sem carregar Prisma, autenticação ou geração de resumos.

## Destino confirmado

| Item | Destino |
| --- | --- |
| Domínio | `https://nexos.chorstconsult.com.br` |
| Backend ativo | Docker `nexoscrm-backend` |
| API no host | `127.0.0.1:3002` → container `3001` |
| Banco | `nexoscrm`, usuário `nexoscrm` |
| PostgreSQL | Docker `nexoscrm-postgres`, host `5433` → container `5432` |
| Conexão da API | `postgres:5432/nexoscrm` na rede Docker |
| Frontend servido pelo Nginx | `/var/www/crmnexointegrator_3026/apps/web/dist` |
| Fontes do backend Docker | `/opt/nexoscrm/backend` |

O domínio `nexosv2.chorstconsult.com.br`, seu processo na porta `3025` e o banco
`crmnexointegrator_v2` não participaram desta publicação. O processo PM2 na porta
`3026` não é o backend usado pelo domínio acima.

## Publicação e reversão

Preparação e backups no servidor:
`/opt/nexoscrm/deployments/b2g-anexos-20261013-135417`.

A imagem publicada é `nexoscrm-backend:b2g-20261013-135417`, também marcada como
`nexoscrm-backend:latest`. A imagem anterior,
com os arquivos de upload preservados, é
`nexoscrm-backend:pre-b2g-20261013-135417`.

O backend foi recriado exclusivamente com:

```sh
docker compose -p nexoscrm \
  -f /opt/nexoscrm/docker-compose.production.yml \
  -f /opt/nexoscrm/deployments/b2g-anexos-20261013-135417/compose.override.yml \
  up -d --no-deps --no-build backend
```

O override inicia `node server.js`, sem executar `ensure-schema.cjs` ou Prisma
migrations. O PostgreSQL não foi recriado. O ID do container e o hash da estrutura
das colunas públicas foram comparados antes e depois e permaneceram iguais.

Para reverter apenas o backend, use o mesmo comando com `compose.rollback.yml`.
O frontend anterior está em `backup/frontend-dist`; seu `index.html` e seus assets
podem ser restaurados ao diretório servido pelo Nginx. As fontes anteriores
também foram preservadas em `backup`.

## Validação

```sh
node --test apps/api/api/b2g-anexos.test.cjs \
  apps/web/src/pages/licitacoes_components/pncp-documents.test.ts
npm run build --workspace apps/web
```

Os 17 testes cobrem identidade PNCP, IDs não consecutivos, anexo inexistente,
falha e nova tentativa, cache, extensões, rejeição de HTML e restrições do proxy.
O modal também foi exercitado no navegador em oito cenários.

O edital `00394429000100-1-002577/2026` retornou 13 anexos. O edital (documento 5,
320.726 bytes) e o TR (documento 2, 434.009 bytes) baixados pela API publicada
foram comparados aos arquivos originais do PNCP:

| Arquivo | SHA-256 |
| --- | --- |
| `EDITAL ASS.pdf` | `2f8a20fd29036f3b44a09fbfe8ba932bc4cdad03f026f56f37f79c205e7290c6` |
| `TR_.pdf` | `893aae5a911d368cddfd57ebd5c379116d12394f32fa8f9dd625694426f8ef8d` |

O teste de navegador usa o componente corrigido em uma página de validação
interceptada localmente, com CSS publicado e chamadas reais à API do domínio.
Não autentica em contas de usuários nem altera dados do aplicativo.
