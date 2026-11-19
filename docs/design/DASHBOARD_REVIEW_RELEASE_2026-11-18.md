# Revisão dos dashboards — 18/11/2026

Publicada em https://nexosv2.chorstconsult.com.br/dashboard-geral.

O Geral agora inclui os funis B2B e B2G, remove a seção “Nossos Módulos” e apresenta Performance da Equipe, Alertas e Ações e Próximos Compromissos abaixo dos cinco cards de operação. Alertas abrem os registros correspondentes, e a agenda consolidada permite consultar compromissos reais.

As consultas passaram a fornecer nomes, localização e valores persistidos, com escopo de empresa e responsável. A agenda aplica a classificação B2B/B2G; Pré-Vendas percorre todas as páginas autorizadas e informa falhas das fontes; o Financeiro respeita os filtros de acesso e ignora respostas antigas quando os filtros mudam. O gráfico B2G usa probabilidades individuais.

## Validação

- 99 testes de regressão e 3 testes obrigatórios de prebuild aprovados; build isolado concluído.
- Geral, B2B, visões exclusivas B2B/B2G e Financeiro responderam HTTP 200 usando o banco real, antes e depois da atualização da API. Os 22 módulos do Geral e os cinco módulos de cada mercado não reportaram falhas de consulta.
- 256 arquivos do pacote frontend verificados antes da ativação; 23 arquivos relevantes comparados por SHA-256 pelo domínio público após a ativação.
- API pública saudável, banco conectado e dashboard sem autenticação retornando HTTP 401.
- Conferência no Chrome: layout do Geral, ambos os funis, remoção da seção antiga, cards operacionais, agenda consolidada, lista completa de alertas e abertura dos detalhes da oportunidade pelo alerta. Pré-Vendas, Financeiro e dashboards B2G/B2B carregaram dados reais. A agenda consolidada estava sem compromissos futuros; não foi criado um registro artificial para essa conferência.

## Escopo e reversão

Build baseado em `d49f2ef`, com somente os arquivos de frontend listados no manifesto. Em `PreVendas.jsx`, foram aplicadas apenas as alterações desta revisão sobre a base, preservando a exclusão do trabalho externo já existente no histórico. A API recebeu somente os 12 arquivos listados no manifesto. Templates, dependências, CI/CD e arquivos de schema não foram publicados. Os arquivos públicos anteriores e os chunks antigos foram preservados.

Release: `/var/www/crmnexointegrator_v2/apps/web/releases/20261118-223122-457617`.

Backup: `/var/www/crmnexointegrator_v2/backups/dashboard-review-20261119-013053`.

Frontend anterior: `/var/www/crmnexointegrator_v2/apps/web/releases/20261118-165119-164616`.

O manifesto completo está em `DASHBOARD_REVIEW_RELEASE_2026-11-18.json`. O backup contém `rollback.json`, os arquivos anteriores da API e `release.json`. Para reverter, restaurar somente os arquivos listados, retirar helpers que antes não existiam, apontar `apps/web/dist` para o frontend anterior e reiniciar somente `crmnexointegrator_v2_3025`. Conferir a saúde pública após a inicialização.

A primeira tentativa foi revertida automaticamente após erro do PM2; a segunda concluiu após conferir a disponibilidade real da API. O host apresentou carga alta e inicialização de aproximadamente 48 segundos. Não foram enviadas alterações de schema nem executados comandos de migração por esta revisão. A rotina preexistente de inicialização do servidor informou garantir as tabelas B2G e de simuladores.

## Correção de acesso direto ao B2B

O diretório público `dashboard/`, que contém imagens, colidia com a rota `/dashboard`: o Nginx redirecionava para `/dashboard/` e respondia 403 ao tentar listar o diretório. O include `nginx/nexosv2-frontend.conf` passou a servir `index.html` nas duas rotas exatas, preservando `/dashboard/*.png`. Configuração validada com `nginx -t` e recarregada. No Chrome, a página antes em 403 voltou a carregar o aplicativo e os indicadores B2B.

Backup do include anterior: `/var/www/crmnexointegrator_v2/nginx/nexosv2-frontend.conf.before-dashboard-fix-20261118-224636`.
