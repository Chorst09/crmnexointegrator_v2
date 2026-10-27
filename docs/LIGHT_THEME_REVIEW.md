# Revisão do modo claro — 27/10/2026

O modo claro usa superfícies brancas, fundo cinza suave, textos escuros e cores de status com contraste reforçado. As novas regras são restritas a `html:not(.dark)`.

## Abrangência

- Menu, cabeçalho, navegação ativa, cards, modais, tabelas, formulários, placeholders, estados de foco, badges e ações.
- CRM B2B/B2G, Pré-vendas, fornecedores, distribuidores, registro de oportunidades, projetos, precificação/rateios e dashboards.
- Gráficos Chart.js adaptam apenas rótulos, eixos, grades e tooltips ao tema e restauram as configurações originais no modo escuro.
- A busca B2G segue o tema central e deixou de forçar o modo escuro ao abrir.
- O dashboard modernizado recebeu os imports ausentes de CheckCircle e RadialLinearScale, necessários para completar a renderização durante a revisão.

## Manutenção

- `apps/web/src/styles/light-theme.css`: regras semânticas e tratamentos dos módulos legados.
- `apps/web/src/styles/light-utilities.css`: camada gerada para cores fixas legadas; não editar manualmente.
- `npm run theme:generate --workspace=apps/web`: regenerar a camada após adicionar cores legadas.
- `npm run check:theme --workspace=apps/web`: isolamento do tema, restauração de gráficos e integração B2G.
- O prebuild regenera a camada e executa as verificações do tema e da edição B2B.
- Para telas novas, preferir `--crm-ink`, `--crm-muted`, `--crm-surface` e demais tokens em vez de cores fixas.

## Validação realizada

- Leitura estática de 372 arquivos de interface e 1.840 variações de utilitários de cor.
- Navegação local nas 56 rotas estáticas autenticadas, com APIs simuladas. Após os ajustes, sem erros de renderização e sem falhas de contraste nos textos elegíveis da amostra automatizada.
- A medição de contraste considera texto visível sobre fundos sólidos e transparências; gradientes, imagens, canvas e conteúdo fora do viewport exigem inspeção visual.
- Inspeção de capturas de login, painel geral, B2B, Pré-vendas, projetos, busca B2G, precificação, fornecedores/distribuidores, formulário e modais. Modal também verificado em 390px, sem overflow horizontal.
- Comparação do CSS computado de 1.073 elementos em modo escuro com a nova folha ativada/desativada: nenhuma diferença.
- Dados simulados não substituem a verificação de todos os registros reais, permissões e estados de negócio em produção.
- Esta alteração não publica uma nova versão automaticamente.

## Complemento: cards e gradientes

A verificação anterior não mediu os fundos com gradiente e não abrangia todo o DOM dos módulos em tela cheia. Esses pontos foram corrigidos nesta rodada:

- `PageHeader` tem uma superfície clara explícita, aplicada a todas as telas que o reutilizam, incluindo Empresas, Lead, Oportunidades, Atividades e Kickoff.
- O gerador cobre também fundos compostos pelos utilitários `from`, `via` e `to`.
- Gradientes inline dos painéis de Simuladores, Precificação e B2G usam uma variável de superfície com o gradiente original como fallback no modo escuro.
- Cards de indicadores do simulador deixam de usar camadas decorativas escuras no modo claro; legendas do termômetro recebem cores legíveis.
- A auditoria `scripts/theme/audit-light-theme.cjs` agora inspeciona todos os módulos, inclui os extremos RGB dos gradientes, aguarda animações e mede também textos de conteúdo acessível após rolagem. Imagens, canvas e misturas CSS sem extremos RGB continuam exigindo inspeção visual.
- Executar com Playwright/Chrome disponíveis e servidor local ativo: `node scripts/theme/audit-light-theme.cjs`. As APIs são simuladas; nenhuma gravação é feita em produção. O relatório é escrito no diretório temporário.
- Teste adicional protege o cabeçalho compartilhado, as classes de gradiente e os dois caminhos de Simuladores contra a reintrodução desses fundos.
