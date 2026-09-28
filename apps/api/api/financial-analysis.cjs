const { prisma } = require('../lib/prisma.cjs');

/**
 * Calcula data de início baseado no período
 */
function getDateRange(periodo) {
  const now = new Date();
  const start = new Date();
  
  switch (periodo) {
    case 'mes':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    case 'trimestre':
      const quarter = Math.floor(now.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    case 'ano':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    default:
      return {};
  }
}

/**
 * GET /api/gestao/analise-financeira/dashboard
 * Retorna dashboard com dados financeiros consolidados
 */
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      console.log('📊 Análise Financeira - Dashboard chamado');
      
      const { periodo = 'mes', dataInicio, dataFim, vendedor, origem } = req.query || {};
      
      // Montar filtros
      let oportunidadesWhere = {
        stage: 'WON',
        closedAt: getDateRange(periodo)
      };
      
      let comissoesWhere = {
        status: 'APPROVED',
        createdAt: getDateRange(periodo)
      };
      
      // Filtros personalizados
      if (dataInicio && dataFim) {
        const start = new Date(dataInicio);
        const end = new Date(dataFim);
        end.setHours(23, 59, 59, 999);
        oportunidadesWhere.closedAt = { gte: start, lte: end };
        comissoesWhere.createdAt = { gte: start, lte: end };
      }
      
      if (vendedor) {
        oportunidadesWhere.seller = {
          name: { contains: vendedor, mode: 'insensitive' }
        };
      }
      
      if (origem && ['B2B', 'B2G'].includes(origem)) {
        oportunidadesWhere.company = {
          type: origem === 'B2B' ? 'B2B' : 'B2G'
        };
      }
      
      // Buscar oportunidades ganhas
      const oportunidades = await prisma.opportunity.findMany({
        where: oportunidadesWhere,
        include: {
          seller: { select: { id: true, name: true } },
          company: { select: { id: true, name: true, type: true } }
        },
        orderBy: { closedAt: 'desc' }
      });
      
      // Buscar comissões aprovadas
      const comissoes = await prisma.commission.findMany({
        where: comissoesWhere,
        include: {
          seller: { select: { id: true, name: true } },
          opportunity: {
            select: { id: true, name: true, value: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // Calcular totais
      const receita_bruta = oportunidades.reduce((sum, opp) => sum + (opp.value || 0), 0);
      const receita_b2b = oportunidades
        .filter(opp => opp.company?.type === 'B2B')
        .reduce((sum, opp) => sum + (opp.value || 0), 0);
      const receita_b2g = oportunidades
        .filter(opp => opp.company?.type === 'B2G')
        .reduce((sum, opp) => sum + (opp.value || 0), 0);
      
      const comissoes_total = comissoes.reduce((sum, com) => sum + (com.amount || 0), 0);
      const despesas = comissoes_total;
      
      const resultado_liquido = receita_bruta - despesas;
      const margem = receita_bruta > 0 ? resultado_liquido / receita_bruta : 0;
      
      // Tabelas de detalhes
      const tabela_oportunidades = oportunidades.map(opp => ({
        nome: opp.name,
        vendedor: opp.seller?.name || 'N/A',
        origem: opp.company?.type || 'N/A',
        valor: opp.value,
        data: new Date(opp.closedAt).toLocaleDateString('pt-BR')
      }));
      
      const tabela_comissoes = comissoes.map(com => ({
        vendedor: com.seller?.name || 'N/A',
        oportunidade: com.opportunity?.name || 'Manual',
        comissao: com.amount,
        percentual: com.percentage || 0,
        data: new Date(com.createdAt).toLocaleDateString('pt-BR')
      }));
      
      const result = {
        receita_bruta,
        receita_b2b,
        receita_b2g,
        despesas,
        comissoes: comissoes_total,
        resultado_liquido,
        margem,
        grafico_receitas_despesas: [],
        grafico_origem: [
          { origem: 'B2B', valor: receita_b2b },
          { origem: 'B2G', valor: receita_b2g }
        ].filter(item => item.valor > 0),
        grafico_evolucao: [],
        grafico_fluxo_caixa: [],
        tabela_oportunidades,
        tabela_comissoes,
        _meta: {
          periodo,
          dataInicio,
          dataFim,
          vendedor,
          origem,
          total_oportunidades: oportunidades.length,
          total_comissoes: comissoes.length
        }
      };
      
      console.log('✅ Resultado:', { receita_bruta, despesas, margem });
      res.json(result);
    } catch (error) {
      console.error('❌ Erro em financial-analysis:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
