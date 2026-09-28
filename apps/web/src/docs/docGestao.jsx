// Documentação do módulo Gestão

export const docProdutosContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Catálogo centralizado de produtos e serviços oferecidos pela empresa. Os produtos cadastrados aqui podem ser referenciados nos orçamentos do Pré-Vendas e nas propostas comerciais.`
  },
  {
    title: '➕ Como cadastrar um produto',
    content: `1. Clique em "Novo Produto".
2. Preencha:
   • Nome (obrigatório).
   • Descrição — detalhes técnicos ou comerciais.
   • Categoria — agrupamento livre (ex: "Internet", "PABX", "Serviços Gerenciados").
   • Preço (R$) — preço de venda padrão.
   • Margem (%) — margem de lucro esperada.
   • Ativo — toggle para ativar/desativar.
3. Clique em Salvar.`
  },
  {
    title: '🔄 Ativando/Desativando rapidamente',
    content: `Clique diretamente no toggle de status na linha da tabela para ativar ou desativar um produto sem abrir o formulário de edição. A mudança é imediata.`
  },
  {
    title: '🔍 Filtros disponíveis',
    content: `• Busca textual — filtra por nome ou categoria do produto.
• Categoria — filtra por agrupamento específico.
• Status — Ativo / Inativo.`
  }
];

export const docVendedoresContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Gestão completa da equipe comercial: cadastro de vendedores, configuração de metas e organização por regiões. Disponível em três abas: Vendedores/Pré-Vendas, Metas e Regiões.`
  },
  {
    title: '➕ Como cadastrar um vendedor',
    content: `1. Clique em "Novo Vendedor" (apenas ADMIN/MASTER).
2. Preencha:
   • Nome e E-mail (obrigatórios).
   • Senha inicial.
   • Função: Vendedor / Pré-Vendas / Gerente / Diretor / Admin.
   • Região comercial de atuação.
   • Cota Mensal (R$) — meta mensal de vendas.
3. Configure as Comissões:
   • Venda Pontual (%) — projetos únicos.
   • Projetos 12, 24, 36, 48 e 60 meses (%) — projetos recorrentes por prazo.
4. Defina o Acesso por módulo: B2B e/ou B2G.
5. Clique em Salvar.`
  },
  {
    title: '💰 Como funcionam as comissões configuradas aqui',
    content: `As percentuais definidas por vendedor são usadas automaticamente no módulo Comissões ao calcular o valor devido.

Exemplo:
• Oportunidade de R$ 50.000 com projeto de 36 meses.
• Vendedor com commissionProject36 = 3,6%.
• Comissão calculada = R$ 1.800,00.`
  },
  {
    title: '🗺️ Aba Regiões',
    content: `Cadastro de regiões comerciais para segmentar carteiras de clientes.

Cada região tem:
• Nome e descrição/cobertura geográfica.
• Vendedores atribuídos à região.

Use regiões para organizar territórios e evitar conflito de carteiras entre vendedores.`
  },
  {
    title: '🎯 Aba Metas',
    content: `Define e acompanha metas de vendas por vendedor e período.

Cada meta exibe:
• Vendedor responsável.
• Período (mês/ano).
• Valor alvo (R$).
• Valor realizado (calculado automaticamente).
• % de atingimento da meta.`
  }
];

export const docComissoesContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Controle de comissões devidas aos vendedores por oportunidades ganhas. O sistema calcula automaticamente o valor da comissão com base nas regras configuradas por vendedor.`
  },
  {
    title: '🔢 Como o cálculo é feito',
    content: `Ao ganhar uma oportunidade, o sistema verifica:

• Se o projeto é Pontual (SINGLE): aplica o percentual de Venda Pontual do vendedor.
• Se o projeto é Mensal (MONTHLY): aplica o percentual correspondente ao prazo do contrato (12, 24, 36, 48 ou 60 meses).

Exemplo:
• Oportunidade: R$ 80.000.
• Tipo: Projeto Mensal de 24 meses.
• Vendedor com commissionProject24 = 2,4%.
• Comissão = R$ 1.920,00.`
  },
  {
    title: '🔄 Fluxo de aprovação',
    content: `1. Pendente — comissão calculada, aguardando aprovação do gestor.
2. Aprovada — aprovada pelo gestor, aguardando pagamento.
3. Paga — pagamento confirmado (estado final).
4. Cancelada — cancelada por qualquer motivo (estado final).

Transições:
• Pendente → Aprovada ou Cancelada.
• Aprovada → Paga ou Cancelada.`
  },
  {
    title: '➕ Registrando uma comissão manualmente',
    content: `1. Clique em "Nova Comissão".
2. Preencha:
   • Oportunidade ID — referência da venda.
   • Vendedor — responsável pela venda.
   • Tipo de Projeto: Pontual ou Mensal.
   • Número de Meses (se mensal).
   • Percentual (%) — taxa aplicada.
   • Valor (R$) — valor calculado.
3. Clique em Salvar.`
  },
  {
    title: '✅ Aprovando e marcando como pago',
    content: `Na tabela de comissões:
• Clique em "Aprovar" para mudar de Pendente → Aprovada.
• Clique em "Marcar como Pago" para mudar de Aprovada → Paga.
• Clique em "Cancelar" para cancelar em qualquer etapa não finalizada.`
  },
  {
    title: '🔍 Filtros disponíveis',
    content: `• Vendedor — filtra por membro específico da equipe.
• Status — Pendente / Aprovada / Paga / Cancelada.
• Período — filtra por mês e ano de referência.`
  }
];

export const docRelatoriosContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Central de inteligência comercial com 7 tipos de relatório, filtros cruzados e exportação CSV. Todos os cálculos são feitos em tempo real a partir dos dados do sistema.`
  },
  {
    title: '📊 Tipos de relatório disponíveis',
    content: `1. Executivo — receita fechada, forecast ponderado, conversão, ticket médio.
2. Pipeline — funil aberto, distribuição por etapa, valor em negociação.
3. Vendedores — líder em receita, melhor conversão, forecast da equipe.
4. Clientes — base de clientes, leads quentes, distribuição B2B vs B2G.
5. Atividades — total, atrasadas, taxa de atraso, produtividade.
6. Contratos — contratos ativos, valor recorrente, vencem em 90 dias.
7. Perdas — valor perdido, motivos, canais críticos.`
  },
  {
    title: '🔍 Filtros cruzados (aplicam a todos os tipos)',
    content: `• Período: 30 dias / 90 dias / 6 meses / 12 meses / Todo histórico.
• Tipo de Negócio: Todos / B2B / B2G / B2C.
• Etapa: qualquer etapa do funil de vendas.
• Responsável: filtra por vendedor ou gestor.
• Origem: canal de geração da oportunidade.
• Valor Mínimo (R$): filtra apenas oportunidades acima do valor informado.
• Busca Textual: por título, empresa ou responsável.`
  },
  {
    title: '📥 Exportação CSV',
    content: `Clique em "Exportar CSV" para baixar todas as oportunidades filtradas.

Campos exportados:
Número, Oportunidade, Cliente, Tipo, Etapa, Responsável, Origem, Valor, Probabilidade, Previsão de Fechamento, Última Atualização.

O arquivo é gerado automaticamente no formato CSV, compatível com Excel e Google Sheets.`
  },
  {
    title: '💡 Dicas de uso',
    content: `• Use o filtro "Período: Mês Atual" combinado com "Responsável" para acompanhar o desempenho individual no mês.
• O relatório "Perdas" é excelente para reuniões de diagnóstico — identifica padrões de perda por motivo e origem.
• O relatório "Contratos" com filtro "vencendo em 90 dias" é essencial para antecipar renovações.
• Exporte o CSV mensalmente para criar dashboards externos no Excel ou Power BI.`
  }
];
