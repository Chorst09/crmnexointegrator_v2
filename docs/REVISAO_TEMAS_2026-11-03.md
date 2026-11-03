# Revisão dos temas — 03/11/2026

## Correção

As telas usavam paletas locais com fundos e textos fixos. Os componentes de CRM, B2G, licitações, simuladores, calculadoras, rateio e projetos agora usam as variáveis compartilhadas `--crm-*` para superfícies, textos e bordas. Cores de status, séries de dados e marca continuam identificando sua função.

O ThemeProvider é a única autoridade do tema. O módulo de licitações compartilha a preferência e oferece o seletor Claro/Escuro/Auto. Gráficos em canvas resolvem as variáveis para cores concretas e atualizam quando o tema muda. O CSS interno do rateio foi extraído para `RatearProdutos.css`. Documentos para exportação mantêm a paleta de papel isolada da interface.

## Verificação reproduzível

Com o frontend local ou preview iniciado:

```sh
npm run check:theme --workspace=crm-web
npm run check:theme:interactions --workspace=crm-web
```

`THEME_BASE_URL` seleciona a URL local e `THEME_BROWSER_PATH` seleciona o executável do navegador. No macOS o padrão usa o Chrome instalado; em outros sistemas, use o Chromium do Playwright. `THEME_AUDIT_OUTPUT` seleciona a pasta de evidências da auditoria de rotas.

A auditoria percorre as 60 rotas estáticas em claro e escuro, coleta erros de renderização e verifica superfícies e gradientes, inclusive abaixo da área visível. As APIs são interceptadas com dados de teste; nenhum registro real é consultado ou alterado. Decorações saturadas dos gráficos não são tratadas como fundos da interface.

As interações verificam alternância, persistência, mudanças do sistema operacional, gráficos montados, recolhimento do menu e formulários de empresas, oportunidades, licitações, atividades, usuários e calculadoras. Também foram conferidas visualmente as capturas das telas principais. A navegação com dados vazios não cobre todas as combinações possíveis de dados ou permissões; adicionalmente, os fluxos existentes de dashboard B2B com 362 oportunidades e busca de TI com resultados preenchidos foram exercitados nos dois temas.

O build de produção e os três testes de proteção da edição de oportunidades passaram. O teste antigo de dashboard tem três expectativas de títulos de receita anteriores à composição atual; na execução complementar de tema essas verificações de texto foram omitidas, mantendo os testes de dados, 14 gráficos, filtros, layout móvel e falha/repetição de API.

## Publicação

Frontend publicado em `https://double.chorstconsult.com.br`, release `/var/www/nexoscrm/frontend/releases/20261103-083803-876228`. Os 250 arquivos do pacote foram verificados por SHA-256 antes da troca atômica da release. A versão anterior foi preservada. HTML e assets de entrada do domínio público conferidos com a versão instalada.
