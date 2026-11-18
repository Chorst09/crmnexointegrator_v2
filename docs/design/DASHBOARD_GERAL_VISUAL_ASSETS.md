# Dashboard Geral — recursos visuais

Revisão de 18/11/2026 para a referência azul/neon fornecida pelo usuário.

- Fundo: `apps/web/public/dashboard/nexos-city-energy.png`, criado pela ferramenta integrada `image_gen` (sem CLI/API externa), 2172 × 724 px. Asset de fundo, sem texto ou dados; títulos, indicadores e controles continuam em HTML/SVG.
- Trilhas de luz: `apps/web/public/dashboard/neon-ribbons.svg`, desenho vetorial local.
- Ícones esculpidos, barras extrudadas, funil com bordas elípticas e plataforma: `ExecutiveVisuals.jsx`, vetores dinâmicos renderizados em SVG.
- Limites estaduais: `brazilStatesGeometry.json`, simplificação da geometria pública em https://github.com/codeforamerica/click_that_hood/blob/master/public/data/brazil-states.geojson. Fonte de aquisição, sem alteração dos registros do CRM.

## Prompt final do fundo

Use case: stylized-concept. Create a production website background image asset, wide panoramic 3:1 composition. This is ONLY the background artwork for a premium Brazilian CRM executive dashboard, NOT a dashboard screenshot. NO text, NO logos, NO UI, NO cards, NO charts, NO icons. Deep almost black midnight navy (#010b20) scene with photorealistic grand white stone urban commercial office buildings along the RIGHT HALF, cool electric blue night lighting. The LEFT HALF must be mostly dark clean navy negative space for white welcome heading overlay. Brilliant thin flowing cyan and electric blue fiber optic energy ribbons arc diagonally from lower left toward upper right around the buildings, small luminous particles and subtle network grid, beautiful volumetric bloom, polished dramatic futuristic commercial intelligence aesthetic. Keep bright highlights concentrated right of center. Sharp visible architecture, not dim or hazy. Cinematic high contrast, glossy 3D lighting, ultra detailed. Output 1536x512 if possible.

## Comportamento preservado

Os gráficos usam os valores existentes. O potencial pode ser exibido pela legenda do gráfico de receita. O mapa aceita coordenadas reais ou localização aproximada pelo estado cadastrado (UF), identificada no texto e nos títulos dos pontos. A ausência de localização não cria pontos ilustrativos. As cores do donut respeitam o percentual calculado, inclusive zero.

## Modelo completo e cinco cards de módulos

Os dashboards Geral (`/dashboard-geral`), B2B (`/dashboard` e `/dashboard-b2b`) e B2G (`/b2g-dashboard`) compartilham a estrutura de cinco KPIs, três gráficos principais, ranking/alertas/agenda, cinco cards de módulos e navegação com ícones 3D. As análises específicas continuam abaixo da composição principal; no painel compartilhado, os detalhes complementares ficam em “Análises detalhadas da carteira”. O relatório de Receitas B2B permanece com seus controles e memória de cálculo.

Cards novos, nesta ordem: B2B Privado, B2G Governo, Pré-Vendas, Gestão e GovFlow B2G. O acesso acompanha as permissões dos módulos. O card de Pré-Vendas usa solicitações, concluídas e taxa de conclusão, correspondentes aos dados efetivamente disponíveis. Gestão mostra empresas únicas, percentual com status ativo e soma dos contratos no horizonte carregado; seu donut separa valores por situação contratual. GovFlow conta editais em análise e vencimentos entre hoje e os próximos 30 dias, excluindo situações encerradas. Datas sem horário respeitam o dia civil local.

## Separação por operação e fundos próprios

O Dashboard Geral mantém os cinco cards combinados descritos acima. B2B e B2G usam o mesmo modelo completo, com conteúdo exclusivo de cada operação, inclusive busca, agenda, navegação lateral e atalhos. O endpoint `type=module-overview&market=B2B|B2G` consulta somente a operação solicitada, respeitando tenant e responsável; não há fallback para dados gerais.

B2B: Pipeline B2B, Clientes B2B, Propostas B2B, Contratos B2B e Receitas B2B. B2G: Pipeline B2G, Órgãos B2G, Licitações B2G, Agenda B2G e GovFlow B2G. Os indicadores dos cinco cards representam a carteira atual da operação; os gráficos principais preservam seus filtros próprios. O botão de atualização recarrega também essa visão.

O B2G usa `nexos-city-energy.png` com edifícios e trilhas ciano. O B2B usa `apps/web/public/dashboard/nexos-b2b-globe-energy.png`, gerado pela ferramenta integrada `image_gen` em modo de geração: globo holográfico, skyline comercial e ondas elétricas azuis. Os cards B2B recebem vidro azul, verde, roxo e âmbar. A imagem é apenas fundo decorativo; todo o painel continua funcional em HTML/SVG/canvas.

### Prompt final do fundo B2B

Use case: stylized-concept. Production website background asset for a premium commercial B2B CRM dashboard, panoramic 3:1. Match this described reference: midnight navy almost-black futuristic business backdrop, a luminous electric-blue realistic holographic globe in the UPPER RIGHT, visible continents, thin cyan orbital rings, vibrant flowing fiber-optic blue energy waves arcing across the lower edge and rising along the right side, tiny luminous network particles, a modern commercial city skyline along the far RIGHT horizon. LEFT and CENTER must remain dark clean navy negative space for overlaid white dashboard text, clear crisp high contrast bright cyan on right. Polished cinematic 3D, glass and holographic surfaces, volumetric blue bloom, premium commercial technology aesthetic. No government buildings, no courthouse, no flags, no capitol. NO UI, NO cards, NO letters, NO text, NO logos, NO charts. Background artwork only. Wide 2172x724 or equivalent 3:1 composition.

