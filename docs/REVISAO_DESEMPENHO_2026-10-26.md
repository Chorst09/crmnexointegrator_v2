# Revisão de desempenho — 26/10/2026

Diagnóstico realizado entre aproximadamente 08:39 e 08:46, horário de São Paulo, no servidor `200.142.149.2` e no repositório local. Sintoma informado: demora constante ao abrir os módulos.

## Resultado

A amostra não mostrou saturação do servidor ou consultas bloqueadas. Foram identificados fatores que aumentam o custo de navegação: respostas JSON volumosas sem compressão no proxy e ausência de política explícita de cache para os arquivos dos módulos. Foram corrigidos no Apache em produção, com validação de sintaxe e recarga graciosa. A melhora medida é de volume transferido; não equivale a uma medição de tempo de renderização no navegador do usuário.

| Resposta | Sem compressão | Com gzip no proxy | Redução |
|---|---:|---:|---:|
| Empresas | 1.242.974 bytes | 84.180 bytes | 93% |
| Oportunidades | 987.937 bytes | 79.616 bytes | 92% |
| Dashboard geral | 473.278 bytes | 43.366 bytes | 91% |
| Dashboard B2B | 352.605 bytes | 33.991 bytes | 90% |
| Usuários | 11.485 bytes | 1.445 bytes | 87% |

## Estado do servidor e banco

- Ubuntu 22.04; carga inicial 0,07 / 0,03 / 0,00. Amostragem de `vmstat`: CPU 99–100% ociosa, sem espera relevante por I/O.
- Memória: 31 GiB totais, cerca de 1,3 GiB usados e 29 GiB disponíveis; swap sem utilização.
- Disco: raiz 36%, `/var` 63%; aproximadamente 8,8 GiB disponíveis em `/var`.
- Contêineres PostgreSQL, Apache e site em execução e saudáveis. API CRM em PM2, porta 3026; frontend estático em 3027.
- PostgreSQL: banco `doublecrm`, aproximadamente 31 MB; 50 conexões ociosas na primeira amostra; limite de 100 conexões. Sem deadlocks acumulados e sem arquivos temporários de consultas registrados nessa amostra.
- Principais volumes: aproximadamente 352 empresas, 376 oportunidades e 10.615 registros PNCP. Não há evidência para atribuir a lentidão atual à falta de índices: tabelas pequenas frequentemente usam leitura sequencial de forma apropriada.
- Sem eventos de OOM ou erros de I/O encontrados no filtro do kernel para os quatro dias anteriores.
- `systemd-networkd-wait-online` consta como falho; não foi demonstrada relação com a navegação atual.
- Health local: HTTP 200 em aproximadamente 94 ms. HTTP público da página inicial: aproximadamente 55 ms no teste local do operador.

## Mudanças já ativas em produção

Script versionável: `scripts/tune-crm-apache.py`, também instalado em `/var/www/nexoscrm/scripts/`.

1. Compressão de JSON e conteúdo textual nos dois virtual hosts CRM (`double` e `nexos`). Os arquivos JS já eram comprimidos pelo servidor estático; essa compressão foi preservada.
2. `Cache-Control: public, max-age=31536000, immutable` para JS/CSS com fingerprint no nome, somente quando o conteúdo e o status correspondem a um arquivo válido.
3. HTML com `no-cache`, permitindo revalidação de versões novas. API e uploads com `private, no-store`, evitando cache compartilhado de dados autenticados.
4. Atualização tanto da configuração em execução quanto de `/var/www/site-double/apache.conf`, utilizada no build do contêiner. Nenhuma mudança no virtual host do site institucional.

Backup original para reversão: `/var/www/nexoscrm/backups/performance-apache-20261026-084300/apache.conf`. Um segundo backup, anterior ao refinamento da condição de tipo de conteúdo, está em `performance-apache-20261026-084337`.

Reversão no servidor: copiar o backup original para `/var/www/site-double/apache.conf` e para `site-double-apache:/usr/local/apache2/conf/extra/httpd-vhosts.conf`, validar com `docker exec site-double-apache httpd -t` e recarregar com `docker exec site-double-apache httpd -k graceful`.

## Correções de código publicadas

Estas alterações foram publicadas às 08:50 de 26/10/2026, após autorização para commit e deploy, pelo commit `816d5689d847bd18f523f5e1ea0e47ac62784c95`, enviado à branch `main` no GitHub. As mudanças de Apache acima já estavam ativas antes dessa publicação.

- Rotas CommonJS, autenticação e Google Calendar passam a compartilhar o cliente Prisma do backend. O adaptador ESM também usa esse mesmo cliente, evitando pools independentes por módulo.
- Singleton do backend preservado também em produção. Removida a imposição automática de modo PgBouncer e cache de statements desabilitado: o ambiente inspecionado usa PostgreSQL diretamente; opções explícitas de conexão continuam preservadas.
- Cliente separado de `apps/api` recebe limite padrão de dez conexões e espera de pool de quinze segundos, preservando valores explícitos. Esse módulo já tinha alterações locais anteriores, que foram mantidas.
- Health check reutiliza o pool e limpa o temporizador, em vez de criar um cliente a cada chamada. No código anterior, uma falha antes de `$disconnect()` também podia deixar recursos sem liberação.
- Middleware `compression`, já declarado nas dependências do backend, protege instalações da API que não passam por esse Apache.

Nenhuma alteração local anterior foi revertida nem incluída indevidamente no commit; no arquivo compartilhado `apps/api/lib/prisma.cjs`, somente o trecho de limitação do pool entrou no commit. As mudanças anteriores desse arquivo que já existiam no servidor foram preservadas. Não houve deploy geral do frontend.

## Validação da publicação

- Publicação restrita a 14 arquivos de código da API e um teste de regressão, com checagem dos hashes dos originais antes de qualquer substituição e dos arquivos instalados após a troca.
- Backup completo dos arquivos alterados e manifesto em `/var/www/nexoscrm/backups/performance-api-20261026-085016-816d568/`. O manifesto registra hashes, permissões e estado anterior de cada arquivo. A publicação previa reversão automática caso o reinício ou o health check falhassem; não foi necessário acioná-la.
- Processo `nexoscrm-api` reiniciado pelo PM2; health check HTTP 200 com banco conectado após a reinicialização. Os demais processos e contêineres não foram reiniciados.
- Conexões ociosas observadas após a publicação e encerramento do processo de teste: 11, contra 50 na primeira amostra. Essa contagem varia conforme o uso; não representa teste de capacidade sob carga.
- Em execução real, confirmado que os adaptadores ESM e CommonJS apontam para a mesma instância Prisma.
- Quinze endpoints autenticados verificados: catorze retornaram HTTP 200 e JSON válido; `/api/workflows` retornou HTTP 500. A mesma falha foi reproduzida isoladamente com o arquivo original anterior ao deploy, demonstrando que é preexistente: o modelo `Workflow` não expõe a relação `executions` solicitada em `_count`. Essa pendência não foi alterada na publicação de desempenho.
- Confirmados gzip na API diretamente pela porta 3026 e cache imutável no asset de entrada servido pelo Apache. Página inicial e asset retornaram HTTP 200.
- Cinco testes de pool executados no próprio servidor, todos aprovados. Os dois novos testes cobrem limites padrão e preservação de limites explícitos do cliente de `apps/api`.
- Evidências sem tokens ou dados pessoais: `verification.json` e `workflow-baseline.json` no diretório de backup da publicação. Identificador da versão ativa em `/var/www/nexoscrm/DEPLOYED_PERFORMANCE.json`.

## Pendências identificadas

| Prioridade | Achado | Consequência e próximo passo |
|---|---|---|
| Alta | HTTPS de `double.chorstconsult.com.br` falhou na validação do nome do certificado. Apache tem virtual host HTTPS do domínio institucional, não do CRM. | Configurar certificado e virtual host próprios para o CRM. Não atribuir a lentidão geral a isso sem confirmar a URL usada pelo usuário. |
| Alta | `audit_logs` no banco tem estrutura legada; faltam campos como `user_name` esperados pelo Prisma. Logs mostram erros e fallback. | Preparar migração compatível com o histórico existente; validar leitura e gravação de auditoria antes de aplicar. Nenhuma alteração de schema foi feita nesta revisão. |
| Média | Listagem de Automações (`/api/workflows`) solicita `_count.executions`, relação inexistente no modelo `Workflow`. | Falha HTTP 500 confirmada tanto no código original quanto após o deploy. Ajustar o contrato da consulta ao modelo persistido em correção própria. |
| Média | Listagens de empresas/oportunidades retornam relações completas e não têm paginação na consulta principal. | Criar respostas de resumo e paginação em conjunto com os consumidores, sem truncar listas unilateralmente. Compressão reduz tráfego, mas não elimina serialização ou renderização desses objetos. |
| Média | Bundle de Projetos tem aproximadamente 2,1 MB bruto / 646 KB gzip em um dos arquivos inspecionados. | Medir execução e renderização no navegador e separar recursos pesados por ação. O cache aplicado ajuda visitas seguintes, não elimina o custo da primeira execução. |
| Média | Arquivo de asset inexistente pode receber `index.html` com HTTP 200 pelo fallback do servidor estático. | Ajustar o servidor estático para devolver 404 em `/assets/` ausente. O cache novo foi protegido para não armazenar esse HTML como asset imutável. |
| Média | Banco publicado em `0.0.0.0:5433`; API e frontend escutam em interfaces externas. | Conferir regras de firewall e clientes legítimos antes de restringir bind/rede. Não foram alterados acessos nesta revisão. |
| Baixa | Há muitos arquivos antigos preservados nas releases do frontend; diretório de releases tem cerca de 856 MB. | Definir retenção que preserve abas abertas e rollback; não foi feita limpeza. |

## Validação e limites

- Apache `httpd -t`: `Syntax OK`; recarga graciosa concluída.
- Nove endpoints autenticados consultados por GET através do virtual host CRM após a mudança: dashboards B2B e geral, empresas, oportunidades, pré-vendas, lead scoring com ação `stats`, distribuição com ação `sellers`, produtos e usuários; todos HTTP 200 e JSON válido, com e sem gzip. Tokens temporários não foram gravados em arquivos nem incluídos no relatório.
- Conferidos headers de JS válido, HTML e asset inexistente; HTML de fallback permanece `no-cache`.
- Site institucional continuou retornando HTTP 200 após a recarga.
- Vinte testes locais passaram: pool Prisma, manutenção do banco real como fonte de dados e regressões dos dashboards B2B/geral. Sintaxe de `backend/server.js` e script Python validada; `git diff --check` sem erros.
- Transformação de configuração testada como idempotente e restrita aos dois virtual hosts CRM.
- Não foram feitos testes de carga, migrações de banco, limpeza de dados ou emissão de certificados. Não houve medição de navegação autenticada em um navegador do usuário; o tempo percebido após as mudanças ainda precisa ser confirmado nesse ambiente.
