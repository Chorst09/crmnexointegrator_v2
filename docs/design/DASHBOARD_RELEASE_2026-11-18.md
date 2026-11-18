# Publicação dos dashboards — 18/11/2026

Publicado em https://nexosv2.chorstconsult.com.br.

O build foi produzido em diretório isolado com a base `d49f2ef` e somente os 27 arquivos de frontend alterados neste trabalho: Dashboard Geral, modelo completo B2B/B2G, cinco cards, ícones/gráficos 3D, fundos próprios, busca e navegação por operação. A API recebeu apenas os dois handlers de dashboard e as duas cópias do helper de consulta por mercado. A lista exata e os hashes estão em `DASHBOARD_RELEASE_2026-11-18.json`.

As implementações já estavam versionadas no commit `9abf913`. Como esse commit também contém trabalho externo, ele não foi implantado integralmente. Foram excluídas desta publicação as alterações de Pré-Vendas, CI/CD, schema, migrações, dependências e templates PPTX. Arquivos públicos preexistentes de produção foram preservados, inclusive templates e branding. Não houve alteração de banco, credenciais ou uploads.

## Verificação

- 34 testes de regressão e 3 testes obrigatórios de prebuild aprovados.
- Build isolado concluído.
- 15 arquivos públicos comparados por SHA-256, incluindo HTML, entrada JS/CSS, chunks dos dashboards e os dois fundos.
- API saudável e banco conectado após reiniciar somente `crmnexointegrator_v2_3025`.
- Handlers reais Geral, B2B e visões exclusivas B2B/B2G retornaram HTTP 200 em verificações internas somente de leitura.
- Nenhuma sobreposição de oportunidades entre os dois mercados na consulta de produção verificada.
- O endpoint público sem autenticação continua retornando HTTP 401.
- A conferência visual no navegador não foi concluída: a ferramenta CUA encerrou a conexão (`Transport closed`). Os testes de renderização e os arquivos públicos foram verificados; não se afirma equivalência visual exata com os prints.

## Release e reversão

Release ativa: `/var/www/crmnexointegrator_v2/apps/web/releases/20261118-165119-164616`.

Backup de código e manifesto: `/var/www/crmnexointegrator_v2/backups/dashboard-20261118-165105`.

Frontend anterior preservado: `/var/www/crmnexointegrator_v2/apps/web/releases/dashboard-before-20261118-165105`.

Para reverter, restaurar somente os arquivos anteriores listados no manifesto de backup, retirar os helpers novos que antes não existiam, apontar `apps/web/dist` para o frontend anterior e reiniciar somente `crmnexointegrator_v2_3025`. Conferir `/api/health`. Não restaurar banco: esta publicação não executou migrações ou escritas em registros.

O commit de registro usa `[skip ci]` porque a implantação acima já foi executada de forma restrita; o workflow preexistente, fora do escopo deste trabalho, não foi modificado nem acionado para implantar outras alterações.
