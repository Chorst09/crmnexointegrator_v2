# Padrão dos cards de indicadores

Referência: cards executivos enviados em 19/11/2026. Implementação local; este documento não registra publicação em produção.

## Modelo compartilhado

`apps/web/src/components/ExecutiveStatCard.jsx` e `ExecutiveStatCard.css` definem a superfície azul, degradê, borda iluminada, detalhes decorativos, ícone com brilho, tipografia sem serifa, valor branco e variação semântica.

Os pontos de entrada `DashboardKPICard`, `StatsCard` e `Card` reutilizam o componente. `AnimatedStats` mantém a animação numérica e respeita a preferência por movimento reduzido. Os dois componentes `StatCard.tsx` dos simuladores também o reutilizam.

Props preservadas: `title`, `value`, `subtitle`, `icon` (componente, elemento React ou emoji), `color`, `colorTheme`, `prefix`, `suffix`, `format`, `trend`, `trendValue`, `size`, `valueTitle`, `onClick` e conteúdo complementar. Cards acionáveis usam botão e foco visível. Percentuais e valores monetários mantêm suas unidades.

Não inserir séries ou variações fictícias para preencher o desenho. As linhas do fundo são decoração. Comparações só aparecem quando recebidas nas props.

## Cobertura

- CRM B2B: dashboard, empresas, leads, oportunidades, atividades, produtos, propostas e vendedores.
- B2G: dashboard, busca, monitoramento e análise de editais, indicadores da base salva.
- Pré-vendas: solicitações, orçamentos, registros, cadastros e POCs.
- Gestão: contratos, kickoff, pós-venda, comissões, metas, relatórios e análise financeira.
- Projetos: painel, atividade, equipe, capacidade e visões globais.
- Operação: automações, integrações e indicadores administrativos.
- Precificação e simuladores: painel, propostas, indicadores de calculadoras e rateios, nas duas árvores de componentes.

Cards com conteúdo financeiro complementar ou interação própria preservam sua estrutura e usam `nex-stat-surface`, `data-stat-value` e `data-stat-icon` para a mesma superfície. Tabelas, formulários, documentos comerciais e permissões não foram convertidos em indicadores.

## Conferência

- Build Vite em diretório temporário, sem substituir `apps/web/dist`.
- Proteção de edição de oportunidades: 3 testes no prebuild.
- Testes de cards, visuais e fluxos dos dashboards: 27 aprovados.
- Navegação com conta temporária comum em 17 rotas: sem erros JavaScript; rotas protegidas mantiveram a negativa de acesso.
- Financeiro, vendedores e integrações também renderizados isoladamente com a API limitada ao usuário de teste, sem mudar permissões para a conferência visual.
- Capturas em desktop e celular; sem overflow interno nos cards financeiros.
- Contas e registros temporários removidos ao final.

O resultado valida a revisão visual e a compilação. Não equivale a um teste funcional de todas as ações, integrações externas ou perfis administrativos.
