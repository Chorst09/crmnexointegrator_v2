const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma.cjs');
const { canAccessChorstData, CHORST_EMAIL } = require('../lib/chorst-privacy.cjs');
const { financialSegment, financialStage, splitFinancialRevenue, summarizeFinancialRevenue, financialRevenueAnalysis, financialStages } = require('../lib/financial-revenue.cjs');

function getDateFilter(periodo, dataInicio, dataFim) {
  if (dataInicio && dataFim) {
    const start = new Date(dataInicio);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dataFim);
    end.setHours(23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  const now = new Date();
  const start = new Date();
  switch (periodo) {
    case 'mes':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    case 'trimestre': {
      const quarter = Math.floor(now.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    }
    case 'ano':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    case 'todos':
    default:
      return null;
  }
}

function formatSimulatorType(type) {
  const map = {
    'FIBER': 'Internet Fibra',
    'RADIO': 'Internet Rádio',
    'DOUBLE': 'Double Fibra + Rádio',
    'VM': 'Máquina Virtual (Cloud)',
    'REDE_MAN_MPLS_RADIO': 'Rede MAN / MPLS Rádio',
    'EVENTOS_TI': 'Eventos TI',
    'PABX_SIP': 'Telefonia PABX SIP',
    'SDWAN': 'SD-WAN Seguro'
  };
  return map[type] || type || 'Outros';
}

const handleDashboard = async (req, res) => {
  try {
    const { periodo = 'todos', dataInicio, dataFim, vendedor, segmento = 'todos' } = req.query || {};
    const dateFilter = getDateFilter(periodo, dataInicio, dataFim);
    const canSeeChorst = canAccessChorstData(req.user);

    const oppWhere = {};
    if (dateFilter) {
      oppWhere.createdAt = dateFilter;
    }
    if (vendedor) {
      oppWhere.owner = { name: { contains: vendedor, mode: 'insensitive' } };
    }
    if (!canSeeChorst) {
      oppWhere.owner = {
        ...(oppWhere.owner || {}),
        email: { not: CHORST_EMAIL }
      };
    }

    const commWhere = { status: 'APPROVED' };
    if (dateFilter) {
      commWhere.createdAt = dateFilter;
    }
    if (vendedor) {
      commWhere.seller = { name: { contains: vendedor, mode: 'insensitive' } };
    }
    if (!canSeeChorst) {
      commWhere.seller = {
        ...(commWhere.seller || {}),
        email: { not: CHORST_EMAIL }
      };
    }

    const simWhere = {};
    if (dateFilter) {
      simWhere.createdAt = dateFilter;
    }
    if (vendedor) {
      simWhere.OR = [
        { accountManager: { contains: vendedor, mode: 'insensitive' } },
        { createdBy: { contains: vendedor, mode: 'insensitive' } }
      ];
    }
    if (!canSeeChorst) {
      simWhere.NOT = [
        { createdBy: CHORST_EMAIL },
        { accountManager: CHORST_EMAIL }
      ];
    }

    const [rawOpportunities, allCommissions, allSimProposals] = await Promise.all([
      prisma.opportunity.findMany({
        where: oppWhere,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true, clientType: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.commission.findMany({
        where: commWhere,
        include: {
          seller: { select: { id: true, name: true, email: true } },
          opportunity: { select: { id: true, title: true, value: true, number: true, b2gStage: true, projectClientType: true, company: { select: { clientType: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.simulatorProposal.findMany({
        where: simWhere,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const allOpportunities = rawOpportunities.map(item => ({ ...item, stage: financialStage(item), clientType: financialSegment(item), _revenue: splitFinancialRevenue(item) }));

    const oppsB2B = allOpportunities.filter(o => o.clientType === 'B2B');
    const oppsB2G = allOpportunities.filter(o => o.clientType === 'B2G');

    const wonB2B = oppsB2B.filter(o => o.stage === 'WON');
    const wonB2G = oppsB2G.filter(o => o.stage === 'WON');
    const wonAll = allOpportunities.filter(o => o.stage === 'WON');

    const openB2B = oppsB2B.filter(o => o.stage !== 'WON' && o.stage !== 'LOST');
    const openB2G = oppsB2G.filter(o => o.stage !== 'WON' && o.stage !== 'LOST');
    const openAll = allOpportunities.filter(o => o.stage !== 'WON' && o.stage !== 'LOST');

    const receitaB2BRealizada = summarizeFinancialRevenue(wonB2B).total;
    const receitaB2GRealizada = summarizeFinancialRevenue(wonB2G).total;
    const receitaRealizadaTotal = receitaB2BRealizada + receitaB2GRealizada;

    const pipelineB2B = summarizeFinancialRevenue(openB2B).total;
    const pipelineB2G = summarizeFinancialRevenue(openB2G).total;
    const pipelineTotal = pipelineB2B + pipelineB2G;

    const comissoesB2B = allCommissions
      .filter(c => financialSegment(c.opportunity || {}) === 'B2B')
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const comissoesB2G = allCommissions
      .filter(c => financialSegment(c.opportunity || {}) === 'B2G')
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const comissoesTotal = allCommissions.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    const resultadoLiquidoB2B = receitaB2BRealizada - comissoesB2B;
    const margemB2B = receitaB2BRealizada > 0 ? resultadoLiquidoB2B / receitaB2BRealizada : 0;

    const resultadoLiquidoB2G = receitaB2GRealizada - comissoesB2G;
    const margemB2G = receitaB2GRealizada > 0 ? resultadoLiquidoB2G / receitaB2GRealizada : 0;

    const resultadoLiquidoGeral = receitaRealizadaTotal - comissoesTotal;
    const margemGeral = receitaRealizadaTotal > 0 ? resultadoLiquidoGeral / receitaRealizadaTotal : 0;

    const ticketMedioWonB2B = wonB2B.length > 0 ? receitaB2BRealizada / wonB2B.length : 0;
    const ticketMedioWonB2G = wonB2G.length > 0 ? receitaB2GRealizada / wonB2G.length : 0;
    const ticketMedioWonGeral = wonAll.length > 0 ? receitaRealizadaTotal / wonAll.length : 0;

    let valorTotalEstimadoSimulador = 0;
    let valorPonderadoEstimadoSimulador = 0;

    const simPorTipoMap = {};
    const simPorStatusMap = {};
    const simPorTemperatura = {
      frio: { faixa: 'Frio (0% - 25%)', min: 0, max: 25, count: 0, valor_total: 0, valor_ponderado: 0 },
      morno: { faixa: 'Morno (26% - 50%)', min: 26, max: 50, count: 0, valor_total: 0, valor_ponderado: 0 },
      quente: { faixa: 'Quente (51% - 75%)', min: 51, max: 75, count: 0, valor_total: 0, valor_ponderado: 0 },
      fechamento: { faixa: 'Muito Quente (76% - 100%)', min: 76, max: 100, count: 0, valor_total: 0, valor_ponderado: 0 }
    };

    const simProposalsFormatted = allSimProposals.map(p => {
      const val = Number(p.value) || 0;
      const temp = p.forecastTemperature != null ? Number(p.forecastTemperature) : 50;
      const prob = Math.max(0, Math.min(100, temp));
      const valPonderado = (val * prob) / 100;

      valorTotalEstimadoSimulador += val;
      valorPonderadoEstimadoSimulador += valPonderado;

      const typeKey = p.type || 'OUTROS';
      if (!simPorTipoMap[typeKey]) {
        simPorTipoMap[typeKey] = {
          tipo: typeKey,
          label: formatSimulatorType(typeKey),
          count: 0,
          valor_total: 0,
          valor_ponderado: 0
        };
      }
      simPorTipoMap[typeKey].count += 1;
      simPorTipoMap[typeKey].valor_total += val;
      simPorTipoMap[typeKey].valor_ponderado += valPonderado;

      const statusKey = p.status || 'Em Aberto';
      if (!simPorStatusMap[statusKey]) {
        simPorStatusMap[statusKey] = {
          status: statusKey,
          count: 0,
          valor_total: 0,
          valor_ponderado: 0
        };
      }
      simPorStatusMap[statusKey].count += 1;
      simPorStatusMap[statusKey].valor_total += val;
      simPorStatusMap[statusKey].valor_ponderado += valPonderado;

      if (prob <= 25) {
        simPorTemperatura.frio.count += 1;
        simPorTemperatura.frio.valor_total += val;
        simPorTemperatura.frio.valor_ponderado += valPonderado;
      } else if (prob <= 50) {
        simPorTemperatura.morno.count += 1;
        simPorTemperatura.morno.valor_total += val;
        simPorTemperatura.morno.valor_ponderado += valPonderado;
      } else if (prob <= 75) {
        simPorTemperatura.quente.count += 1;
        simPorTemperatura.quente.valor_total += val;
        simPorTemperatura.quente.valor_ponderado += valPonderado;
      } else {
        simPorTemperatura.fechamento.count += 1;
        simPorTemperatura.fechamento.valor_total += val;
        simPorTemperatura.fechamento.valor_ponderado += valPonderado;
      }

      return {
        id: p.id,
        baseId: p.baseId,
        title: p.title || `Proposta #${p.baseId || p.id?.slice(0, 8)}`,
        client: p.client || 'Cliente Não Informado',
        type: p.type || 'FIBER',
        typeLabel: formatSimulatorType(p.type),
        value: val,
        forecastTemperature: prob,
        valor_ponderado: valPonderado,
        status: p.status || 'Aguardando Aprovação do Cliente',
        accountManager: p.accountManager || p.createdBy || 'Comercial',
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString()
      };
    });

    const simuladorPorTipoList = Object.values(simPorTipoMap).sort((a, b) => b.valor_total - a.valor_total);
    const simuladorPorStatusList = Object.values(simPorStatusMap).sort((a, b) => b.valor_total - a.valor_total);
    const simuladorPorTemperaturaList = Object.values(simPorTemperatura);

    const graficoComparativoSegmentos = [
      {
        categoria: 'B2B Privado',
        realizado: Math.round(receitaB2BRealizada),
        pipeline: Math.round(pipelineB2B),
        estimativa_simulador: 0
      },
      {
        categoria: 'B2G Público',
        realizado: Math.round(receitaB2GRealizada),
        pipeline: Math.round(pipelineB2G),
        estimativa_simulador: 0
      },
      {
        categoria: 'Simulador (Estimativa)',
        realizado: 0,
        pipeline: 0,
        estimativa_simulador: Math.round(valorPonderadoEstimadoSimulador)
      }
    ];

    const graficoReceitasDespesas = [
      {
        origem: 'B2B Realizado',
        receita: Math.round(receitaB2BRealizada),
        despesa: Math.round(comissoesB2B),
        liquido: Math.round(resultadoLiquidoB2B)
      },
      {
        origem: 'B2G Realizado',
        receita: Math.round(receitaB2GRealizada),
        despesa: Math.round(comissoesB2G),
        liquido: Math.round(resultadoLiquidoB2G)
      }
    ];

    const graficoOrigem = [
      { origem: 'B2B Realizado', valor: Math.round(receitaB2BRealizada) },
      { origem: 'B2G Realizado', valor: Math.round(receitaB2GRealizada) }
    ].filter(item => item.valor > 0);

    const formatOpp = opp => ({
      id: opp.id,
      nome: opp.title,
      vendedor: opp.owner?.name || 'N/A',
      origem: opp.clientType || financialSegment(opp),
      cliente: opp.company?.name || 'N/A',
      estagio: opp.stage,
      valor: opp._revenue.total,
      ...opp._revenue,
      data: opp.actualCloseDate
        ? new Date(opp.actualCloseDate).toLocaleDateString('pt-BR')
        : opp.createdAt
        ? new Date(opp.createdAt).toLocaleDateString('pt-BR')
        : 'N/A'
    });

    const tabelaOportunidadesB2B = oppsB2B.map(formatOpp);
    const tabelaOportunidadesB2G = oppsB2G.map(formatOpp);
    const tabelaOportunidadesGeral = allOpportunities.map(formatOpp);

    const tabelaComissoes = allCommissions.map(com => ({
      id: com.id,
      vendedor: com.seller?.name || 'N/A',
      oportunidade: com.opportunity?.title || 'Comissão Manual',
      origem: financialSegment(com.opportunity || {}),
      comissao: com.amount || 0,
      percentual: com.percentage || 0,
      data: new Date(com.createdAt).toLocaleDateString('pt-BR')
    }));

    res.json({
      geral: {
        revenue: financialRevenueAnalysis(allOpportunities),
        receita_realizada: receitaRealizadaTotal,
        receita_b2b_realizada: receitaB2BRealizada,
        receita_b2g_realizada: receitaB2GRealizada,
        pipeline_em_aberto: pipelineTotal,
        pipeline_b2b_em_aberto: pipelineB2B,
        pipeline_b2g_em_aberto: pipelineB2G,
        despesas: comissoesTotal,
        comissoes: comissoesTotal,
        resultado_liquido: resultadoLiquidoGeral,
        margem: margemGeral,
        total_ganhas: wonAll.length,
        total_em_aberto: openAll.length,
        ticket_medio: ticketMedioWonGeral,
        grafico_comparativo: graficoComparativoSegmentos,
        grafico_receitas_despesas: graficoReceitasDespesas,
        grafico_origem: graficoOrigem,
        tabela_oportunidades: tabelaOportunidadesGeral,
        tabela_comissoes: tabelaComissoes
      },

      b2b: {
        revenue: financialRevenueAnalysis(oppsB2B),
        receita_realizada: receitaB2BRealizada,
        pipeline_em_aberto: pipelineB2B,
        total_ganhas: wonB2B.length,
        total_em_aberto: openB2B.length,
        ticket_medio: ticketMedioWonB2B,
        despesas: comissoesB2B,
        resultado_liquido: resultadoLiquidoB2B,
        margem: margemB2B,
        tabela_oportunidades: tabelaOportunidadesB2B,
        estagios: financialStages(oppsB2B, 'B2B')
      },

      b2g: {
        revenue: financialRevenueAnalysis(oppsB2G),
        receita_realizada: receitaB2GRealizada,
        pipeline_em_aberto: pipelineB2G,
        total_ganhas: wonB2G.length,
        total_em_aberto: openB2G.length,
        ticket_medio: ticketMedioWonB2G,
        despesas: comissoesB2G,
        resultado_liquido: resultadoLiquidoB2G,
        margem: margemB2G,
        tabela_oportunidades: tabelaOportunidadesB2G,
        estagios: financialStages(oppsB2G, 'B2G')
      },

      simulador: {
        isEstimativa: true,
        aviso: 'As propostas do Simulador representam cotações e projeções de pipeline comercial, não compondo a receita financeira realizada definitiva.',
        total_propostas: allSimProposals.length,
        valor_total_estimado: valorTotalEstimadoSimulador,
        valor_ponderado_estimado: valorPonderadoEstimadoSimulador,
        ticket_medio_estimado: allSimProposals.length > 0 ? valorTotalEstimadoSimulador / allSimProposals.length : 0,
        ticket_medio_ponderado: allSimProposals.length > 0 ? valorPonderadoEstimadoSimulador / allSimProposals.length : 0,
        taxa_media_probabilidade: valorTotalEstimadoSimulador > 0 ? (valorPonderadoEstimadoSimulador / valorTotalEstimadoSimulador) * 100 : 0,
        por_temperatura: simuladorPorTemperaturaList,
        por_tipo: simuladorPorTipoList,
        por_status: simuladorPorStatusList,
        propostas: simProposalsFormatted
      },

      receita_bruta: receitaRealizadaTotal,
      receita_b2b: receitaB2BRealizada,
      receita_b2g: receitaB2GRealizada,
      despesas: comissoesTotal,
      comissoes: comissoesTotal,
      resultado_liquido: resultadoLiquidoGeral,
      margem: margemGeral,
      tabela_oportunidades: wonAll.map(formatOpp),
      tabela_comissoes: tabelaComissoes,

      _meta: {
        periodo,
        dataInicio,
        dataFim,
        segmento,
        total_oportunidades: allOpportunities.length,
        total_comissoes: allCommissions.length,
        total_simulador: allSimProposals.length
      }
    });
  } catch (error) {
    console.error('❌ [Análise Financeira] Erro ao consolidar métricas:', error);
    res.status(500).json({ error: error.message || 'Erro ao carregar análise financeira' });
  }
};

router.get('/dashboard', handleDashboard);
router.get('/', handleDashboard);

module.exports = router;
