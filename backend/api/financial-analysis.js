const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

/**
 * Calcula filtro de data baseado no período
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
 * Schema real: Opportunity usa actualCloseDate, owner, title, company.clientType
 *              Commission usa seller, opportunity.title
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { periodo = 'mes', dataInicio, dataFim, vendedor, origem } = req.query || {};

    let oportunidadesWhere = {
      stage: 'WON',
      actualCloseDate: getDateRange(periodo)
    };

    let comissoesWhere = {
      status: 'APPROVED',
      createdAt: getDateRange(periodo)
    };

    // Filtros personalizados por data
    if (dataInicio && dataFim) {
      const start = new Date(dataInicio);
      const end = new Date(dataFim);
      end.setHours(23, 59, 59, 999);
      oportunidadesWhere.actualCloseDate = { gte: start, lte: end };
      comissoesWhere.createdAt = { gte: start, lte: end };
    }

    // Filtro por vendedor
    if (vendedor) {
      oportunidadesWhere.owner = { name: { contains: vendedor, mode: 'insensitive' } };
    }

    // Filtro por origem (B2B / B2G) — campo real: clientType
    if (origem && ['B2B', 'B2G'].includes(origem)) {
      oportunidadesWhere.company = { clientType: origem };
    }

    // Buscar oportunidades ganhas
    const oportunidades = await prisma.opportunity.findMany({
      where: oportunidadesWhere,
      include: {
        owner: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, clientType: true } }
      },
      orderBy: { actualCloseDate: 'desc' }
    });

    // Buscar comissões aprovadas
    const comissoes = await prisma.commission.findMany({
      where: comissoesWhere,
      include: {
        seller: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true, value: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular totais
    const receita_bruta = oportunidades.reduce((sum, opp) => sum + (opp.value || 0), 0);
    const receita_b2b = oportunidades
      .filter(opp => opp.company?.clientType === 'B2B')
      .reduce((sum, opp) => sum + (opp.value || 0), 0);
    const receita_b2g = oportunidades
      .filter(opp => opp.company?.clientType === 'B2G')
      .reduce((sum, opp) => sum + (opp.value || 0), 0);

    const comissoes_total = comissoes.reduce((sum, com) => sum + (com.amount || 0), 0);
    const resultado_liquido = receita_bruta - comissoes_total;
    const margem = receita_bruta > 0 ? resultado_liquido / receita_bruta : 0;

    const tabela_oportunidades = oportunidades.map(opp => ({
      nome: opp.title,
      vendedor: opp.owner?.name || 'N/A',
      origem: opp.company?.clientType || 'N/A',
      valor: opp.value,
      data: opp.actualCloseDate
        ? new Date(opp.actualCloseDate).toLocaleDateString('pt-BR')
        : 'N/A'
    }));

    const tabela_comissoes = comissoes.map(com => ({
      vendedor: com.seller?.name || 'N/A',
      oportunidade: com.opportunity?.title || 'Manual',
      comissao: com.amount,
      percentual: com.percentage || 0,
      data: new Date(com.createdAt).toLocaleDateString('pt-BR')
    }));

    res.json({
      receita_bruta,
      receita_b2b,
      receita_b2g,
      despesas: comissoes_total,
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
        total_oportunidades: oportunidades.length,
        total_comissoes: comissoes.length
      }
    });
  } catch (error) {
    console.error('❌ [Análise Financeira] Erro:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
