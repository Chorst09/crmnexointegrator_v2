import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  Package,
  Home,
  Wrench,
  SlidersHorizontal,
  Trash2,
  Plus,
  Check,
  FilePlus2,
  Search,
  Save,
  FileText,
  ArrowRight,
  FolderOpen,
  Eye,
  Pencil,
  Loader2,
  BarChart3,
  PieChart
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const CALCULATOR_SETTINGS_STORAGE_KEY = 'crm-calculadoras-settings-v1';
const CALCULATOR_PROPOSALS_STORAGE_KEY = 'crm-calculadoras-propostas-v1';
const CALCULATOR_PROPOSALS_SESSION_KEY = 'crm-calculadoras-propostas-session-v1';
const ICMS_UF_ORDER = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
const ICMS_PR_ALIQUOTAS = {
  AC: 7,
  AL: 7,
  AP: 7,
  AM: 7,
  BA: 7,
  CE: 7,
  DF: 7,
  ES: 7,
  GO: 7,
  MA: 7,
  MG: 12,
  MS: 7,
  MT: 7,
  PA: 7,
  PB: 7,
  PI: 7,
  PR: 19.5,
  RJ: 12,
  RN: 7,
  RO: 7,
  RR: 7,
  RS: 12,
  SC: 12,
  SE: 7,
  SP: 12,
  TO: 7
};

const UF_OPTIONS = ICMS_UF_ORDER.slice().sort();
const DEFAULT_SALE_ITEM = {
  id: `sale_${Date.now()}`,
  description: 'Servidor Dell',
  quantity: 1,
  unitCost: 8500,
  creditoIcmsCompra: 1020,
  icmsDestLocal: 18,
  icmsST: false
};
const DEFAULT_RENTAL_ITEM = {
  id: `rental_${Date.now()}`,
  description: 'Servidor Dell',
  quantity: 1,
  assetValueBRL: 5000,
  sucataPercent: 10,
  icmsCompra: 0,
  icmsPr: 12,
  frete: 0
};
const DEFAULT_SERVICE_ITEM = {
  id: `service_${Date.now()}`,
  description: 'Consultoria de TI',
  estimatedHours: 20,
  baseSalary: 5000,
  contractType: 'clt'
};

const DEFAULT_CALCULATOR_SETTINGS = {
  regimesTributarios: [
    {
      id: 'LUCRO_PRESUMIDO',
      nome: 'Lucro Presumido',
      pis: 0.65,
      cofins: 3,
      csll: 9,
      irpj: 15,
      icms: 18,
      iss: 5,
      cbs: 0,
      ibs: 0,
      is: 0,
      iva: 0,
      usaReforma: false,
      basePresuncaoVenda: 8,
      basePresuncaoServico: 32,
      ativo: true
    },
    {
      id: 'LUCRO_REAL',
      nome: 'Lucro Real',
      pis: 1.65,
      cofins: 7.6,
      csll: 9,
      irpj: 15,
      icms: 18,
      iss: 5,
      cbs: 0,
      ibs: 0,
      is: 0,
      iva: 0,
      usaReforma: false,
      basePresuncaoVenda: 8,
      basePresuncaoServico: 32,
      ativo: false
    },
    {
      id: 'SIMPLES_NACIONAL',
      nome: 'Simples Nacional',
      pis: 0,
      cofins: 0,
      csll: 0,
      irpj: 0,
      icms: 4,
      iss: 2,
      cbs: 0,
      ibs: 0,
      is: 0,
      iva: 0,
      usaReforma: false,
      basePresuncaoVenda: 100,
      basePresuncaoServico: 100,
      anexoI: 8,
      anexoIII: 11.2,
      ativo: false
    },
    {
      id: 'REFORMA_TRANSICAO_2026',
      nome: 'Reforma Tributária - Transição 2026',
      pis: 0,
      cofins: 0,
      csll: 9,
      irpj: 15,
      icms: 0,
      iss: 0,
      cbs: 0.9,
      ibs: 0.1,
      is: 0,
      iva: 1,
      usaReforma: true,
      basePresuncaoVenda: 8,
      basePresuncaoServico: 32,
      ativo: false
    },
    {
      id: 'REFORMA_IVA_REFERENCIAL',
      nome: 'Reforma Tributária - IVA Referencial',
      pis: 0,
      cofins: 0,
      csll: 9,
      irpj: 15,
      icms: 0,
      iss: 0,
      cbs: 8.5,
      ibs: 18.5,
      is: 0,
      iva: 27,
      usaReforma: true,
      basePresuncaoVenda: 8,
      basePresuncaoServico: 32,
      ativo: false
    }
  ],
  custosDespesas: {
    fretePadrao: 0,
    despesasFixasMensais: 0,
    despesasVariaveisPercentual: 0,
    comissaoVenda: 3,
    comissaoLocacao: 10,
    comissaoServico: 5,
    margemLucroServico: 20,
    despesasAdmin: 2,
    outrasDespesas: 1,
    custoFinanceiroMensal: 1.17,
    taxaDescontoVPL: 15,
    depreciacao: 0
  },
  maoDeObra: {
    encargosPercentual: 70,
    beneficiosPercentual: 15,
    encargos: {
      ferias: 8.33,
      tercoFerias: 2.78,
      decimoTerceiro: 8.33,
      inssBase: 20,
      inssSistemaS: 7.8,
      inssFerias13: 1.52,
      fgts: 8,
      fgtsFerias13: 1.56,
      multaFgts: 1.91,
      outros: 1
    },
    beneficios: {
      valeTransporte: 200,
      planoSaude: 300,
      alimentacao: 550
    },
    geral: {
      diasUteis: 21,
      horasDia: 8,
      salarioBase: 5000
    }
  },
  icmsInterestadual: {
    origemUf: 'PR',
    aliquotasPorUf: ICMS_PR_ALIQUOTAS
  },
  dadosEmpresa: {
    razaoSocial: 'Sua Empresa de TI',
    cnpj: '',
    uf: 'PR',
    address: 'Rua da Tecnologia, 123 - Centro',
    cityState: 'Curitiba - PR',
    phone: '(41) 99999-9999',
    email: 'contato@suaempresa.com'
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatCurrency = (value) => {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPercent = (value) => {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return '0,00%';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));
const createEntityId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatDateTime = (isoDate) => {
  if (!isoDate) return '-';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const generateProposalNumber = (proposals = []) => {
  const year = new Date().getFullYear();
  const nextSequence = proposals.reduce((max, proposal) => {
    const [sequence, sequenceYear] = String(proposal?.number || '').split('/');
    if (Number(sequenceYear) !== year) return max;
    const parsed = parseInt(sequence, 10);
    if (!Number.isFinite(parsed)) return max;
    return Math.max(max, parsed);
  }, 0) + 1;

  return `${String(nextSequence).padStart(4, '0')}/${year}`;
};

const getManagerDefaults = () => {
  try {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : {};
    return {
      managerName: user?.name || '',
      managerEmail: user?.email || '',
      managerPhone: user?.phone || ''
    };
  } catch {
    return {
      managerName: '',
      managerEmail: '',
      managerPhone: ''
    };
  }
};

const buildProposalForm = (proposalNumber, managerDefaults = {}) => ({
  number: proposalNumber || '',
  opportunityId: '',
  opportunityNumber: '',
  opportunityTitle: '',
  clientCompany: '',
  clientContact: '',
  clientPhone: '',
  clientEmail: '',
  clientDocument: '', // NOVO: CNPJ/Documento
  managerName: managerDefaults.managerName || '',
  managerEmail: managerDefaults.managerEmail || '',
  managerPhone: managerDefaults.managerPhone || '',
  premises: '' // NOVO: Premissas da Proposta
});

const normalizeSavedProposals = (source) => {
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') return Object.values(source);
  return [];
};

const normalizeModalidadeKey = (modalidade) => {
  const normalized = String(modalidade || '').trim().toUpperCase();
  if (normalized === 'LOCAÇÃO') return 'LOCACAO';
  if (normalized === 'SERVIÇOS' || normalized === 'SERVICOS') return 'SERVICO';
  return normalized || 'VENDA';
};

const normalizeLookupText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const getProposalDetailsFromRequest = (solicitacao = {}) => {
  const details = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
    ? solicitacao.calculoDetalhes
    : {};
  return details.dadosProposta && typeof details.dadosProposta === 'object'
    ? details.dadosProposta
    : {};
};

const pickCotacaoPartner = (cotacao = {}, fallback = {}) => {
  const items = Array.isArray(cotacao?.itens) ? cotacao.itens : [];
  const firstItemWithDistributor = items.find((item) => item?.distribuidor || item?.distribuidorId) || {};
  const firstItemWithSupplier = items.find((item) => item?.fornecedor || item?.fornecedorId) || {};

  return {
    distribuidorId: cotacao?.distribuidorId || firstItemWithDistributor?.distribuidorId || fallback?.distribuidorId || '',
    distribuidor: cotacao?.distribuidor || firstItemWithDistributor?.distribuidor || fallback?.distribuidor || '',
    fornecedorId: cotacao?.fornecedorId || firstItemWithSupplier?.fornecedorId || fallback?.fornecedorId || '',
    fornecedor: cotacao?.fornecedor || firstItemWithSupplier?.fornecedor || fallback?.fornecedor || ''
  };
};

const findPartnerByName = (items = [], name = '') => {
  const normalizedName = normalizeLookupText(name);
  if (!normalizedName) return null;
  return items.find((item) => normalizeLookupText(item?.nome) === normalizedName) || null;
};

const resolvePartnerSelection = (items = [], id = '', name = '') => {
  if (id) {
    const byId = items.find((item) => item.id === id);
    return {
      id,
      name: byId?.nome || name || ''
    };
  }
  const byName = findPartnerByName(items, name);
  return {
    id: byName?.id || '',
    name: name || byName?.nome || ''
  };
};

const normalizeCalculatorTypeFromModalidade = (modalidade) => {
  const normalized = normalizeModalidadeKey(modalidade);
  const tabMap = {
    VENDA: 'vendas',
    LOCACAO: 'locacao',
    SERVICO: 'servicos'
  };
  return tabMap[normalized] || 'vendas';
};

const modalidadeFromCalculatorType = (calculatorType) => {
  if (calculatorType === 'locacao') return 'LOCACAO';
  if (calculatorType === 'servicos') return 'SERVICO';
  return 'VENDA';
};

const normalizeQuotedItem = (item = {}) => ({
  descricao: item.descricao || item.description || '',
  quantidade: Math.max(1, toNumber(item.quantidade ?? item.quantity, 1)),
  custoUnitario: Math.max(0, toNumber(item.custoUnitario ?? item.unitCost ?? item.assetValueBRL ?? item.baseSalary, 0)),
  modalidade: item.modalidade || ''
});

const getCotacoesFromSolicitacao = (solicitacao) => {
  const details = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
    ? solicitacao.calculoDetalhes
    : {};
  return Array.isArray(details.cotacoes) ? details.cotacoes : [];
};

const getItemsFromSolicitacao = (solicitacao) => (
  Array.isArray(solicitacao?.items)
    ? solicitacao.items
        .map((item) => normalizeQuotedItem({
          descricao: item.descricao || item.product?.name || '',
          quantidade: item.quantidade,
          custoUnitario: item.custoUnitario ?? item.product?.price,
          modalidade: solicitacao?.modalidade || 'VENDA'
        }))
        .filter((item) => item.descricao)
    : []
);

const getBudgetItemCount = (solicitacao) => {
  const cotacoes = getCotacoesByModalidade(solicitacao);
  const quoteItems = cotacoes.reduce((sum, cotacao) => (
    sum + (Array.isArray(cotacao?.itens) ? cotacao.itens.length : 0)
  ), 0);
  return quoteItems || getItemsFromSolicitacao(solicitacao).length;
};

const getCotacoesByModalidade = (solicitacao = {}) => {
  const cotacoes = getCotacoesFromSolicitacao(solicitacao);
  const modalidade = normalizeModalidadeKey(solicitacao?.modalidade || cotacoes[0]?.modalidade || 'VENDA');
  const matching = cotacoes.filter((cotacao) => (
    normalizeModalidadeKey(cotacao?.modalidade || modalidade) === modalidade
  ));
  return matching.length > 0 ? matching : [];
};

const buildCotacaoItems = (cotacoes = []) => {
  const items = [];
  cotacoes.forEach((cotacao) => {
    if (!Array.isArray(cotacao.itens)) return;
    cotacao.itens.forEach((item) => {
      items.push(normalizeQuotedItem({ ...item, modalidade: item.modalidade || cotacao.modalidade }));
    });
  });
  return items;
};

const buildDistributorCostsFromCotacoes = (cotacoes = [], solicitacao = {}) => {
  const proposalDetails = getProposalDetailsFromRequest(solicitacao);
  const costs = [];
  cotacoes.forEach((cotacao, cotacaoIndex) => {
    const partner = pickCotacaoPartner(cotacao, proposalDetails);
    if (!Array.isArray(cotacao.itens)) return;
    cotacao.itens.forEach((item, itemIndex) => {
      const normalizedItem = normalizeQuotedItem(item);
      costs.push({
        id: `cost_${Date.now()}_${cotacaoIndex}_${itemIndex}`,
        modalidade: cotacao.modalidade || solicitacao.modalidade || 'VENDA',
        distribuidorId: partner.distribuidorId,
        distribuidor: partner.distribuidor,
        fornecedorId: partner.fornecedorId,
        fornecedor: partner.fornecedor,
        numeroOrcamento: cotacao.numeroOrcamento || solicitacao.numero || '',
        item: normalizedItem.descricao,
        quantidade: normalizedItem.quantidade,
        custoUnitario: normalizedItem.custoUnitario,
        observacoes: cotacao.observacoesCotacao || cotacao.observacoes || '',
        data: cotacao.createdAt || new Date().toISOString()
      });
    });
  });
  return costs;
};

const buildDistributorCostsFromSolicitacaoItems = (solicitacao = {}) => {
  const proposalDetails = getProposalDetailsFromRequest(solicitacao);
  const partner = pickCotacaoPartner({}, proposalDetails);
  return getItemsFromSolicitacao(solicitacao).map((item, index) => ({
    id: `cost_req_${Date.now()}_${index}`,
    modalidade: item.modalidade || solicitacao.modalidade || 'VENDA',
    distribuidorId: partner.distribuidorId,
    distribuidor: partner.distribuidor || 'Solicitação',
    fornecedorId: partner.fornecedorId,
    fornecedor: partner.fornecedor,
    numeroOrcamento: solicitacao.__matchedBudgetNumber || solicitacao.numero || '',
    item: item.descricao,
    quantidade: item.quantidade,
    custoUnitario: item.custoUnitario,
    observacoes: '',
    data: new Date().toISOString()
  }));
};

const buildDistributorCostsFromCotacaoPayload = (cotacaoData = {}) => {
  const modalidade = normalizeModalidadeKey(cotacaoData.modalidade || 'VENDA');
  const matchingCotacoes = Array.isArray(cotacaoData.todosCustos)
    ? cotacaoData.todosCustos.filter((cotacao) => (
        normalizeModalidadeKey(cotacao?.modalidade || modalidade) === modalidade
      ))
    : [];
  const fromCotacoes = buildDistributorCostsFromCotacoes(matchingCotacoes, {
    numero: cotacaoData.numeroOrcamento,
    modalidade,
    calculoDetalhes: { dadosProposta: cotacaoData }
  });
  if (fromCotacoes.length > 0) return fromCotacoes;

  return Array.isArray(cotacaoData.itens)
    ? cotacaoData.itens.map((item, index) => {
        const normalizedItem = normalizeQuotedItem(item);
        return {
          id: `cost_${Date.now()}_${index}`,
          modalidade: item.modalidade || cotacaoData.modalidade || 'VENDA',
          distribuidorId: item.distribuidorId || cotacaoData.distribuidorId || '',
          distribuidor: item.distribuidor || cotacaoData.distribuidor || '',
          fornecedorId: item.fornecedorId || cotacaoData.fornecedorId || '',
          fornecedor: item.fornecedor || cotacaoData.fornecedor || '',
          numeroOrcamento: item.numeroOrcamento || cotacaoData.numeroOrcamento || '',
          item: normalizedItem.descricao,
          quantidade: normalizedItem.quantidade,
          custoUnitario: normalizedItem.custoUnitario,
          observacoes: item.observacoes || cotacaoData.observacoesCotacao || cotacaoData.observacoes || '',
          data: new Date().toISOString()
        };
      })
    : [];
};

const findBudgetRequestByNumber = async (number) => {
  const normalizedNumber = String(number || '').trim().toUpperCase();
  if (!normalizedNumber) return null;

  const response = await fetch(buildApiUrl(`/pre-vendas/by-number/${encodeURIComponent(normalizedNumber)}`), {
    headers: getAuthHeaders()
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Falha ao consultar o módulo Orçamentos');

  const solicitacao = payload?.data || payload?.solicitacao || payload;
  if (!solicitacao || typeof solicitacao !== 'object') return null;
  solicitacao.__matchedBudgetNumber = solicitacao.__matchedBudgetNumber || normalizedNumber;
  return solicitacao;
};

const mapQuotedItemsToOperationItems = (items = [], targetTab) => {
  if (targetTab === 'locacao') {
    return items.map((item, idx) => ({
      ...DEFAULT_RENTAL_ITEM,
      id: `rental_${Date.now()}_${idx}`,
      description: item.descricao,
      quantity: item.quantidade,
      assetValueBRL: item.custoUnitario
    }));
  }

  if (targetTab === 'servicos') {
    return items.map((item, idx) => ({
      ...DEFAULT_SERVICE_ITEM,
      id: `service_${Date.now()}_${idx}`,
      description: item.descricao,
      estimatedHours: item.quantidade,
      baseSalary: item.custoUnitario
    }));
  }

  return items.map((item, idx) => ({
    ...DEFAULT_SALE_ITEM,
    id: `sale_${Date.now()}_${idx}`,
    description: item.descricao,
    quantity: item.quantidade,
    unitCost: item.custoUnitario
  }));
};

const normalizeSettings = (settings = {}) => {
  const source = settings || {};
  const initialRegimesSource = Array.isArray(source.regimesTributarios) && source.regimesTributarios.length > 0
    ? source.regimesTributarios
    : DEFAULT_CALCULATOR_SETTINGS.regimesTributarios;
  const regimesSource = [...initialRegimesSource];
  const existingRegimeIds = new Set(regimesSource.map((regime) => regime?.id).filter(Boolean));
  DEFAULT_CALCULATOR_SETTINGS.regimesTributarios.forEach((defaultRegime) => {
    if (!existingRegimeIds.has(defaultRegime.id)) {
      regimesSource.push(defaultRegime);
    }
  });

  const regimesTributarios = regimesSource.map((regime, index) => ({
    id: regime.id || `REGIME_${index + 1}`,
    nome: regime.nome || `Regime ${index + 1}`,
    pis: toNumber(regime.pis, 0),
    cofins: toNumber(regime.cofins, 0),
    csll: toNumber(regime.csll, 0),
    irpj: toNumber(regime.irpj, 0),
    icms: toNumber(regime.icms, 0),
    iss: toNumber(regime.iss, 0),
    cbs: toNumber(regime.cbs, 0),
    ibs: toNumber(regime.ibs, 0),
    is: toNumber(regime.is, 0),
    iva: toNumber(regime.iva, toNumber(regime.cbs, 0) + toNumber(regime.ibs, 0)),
    usaReforma: Boolean(
      regime.usaReforma
      || (regime.id || '').startsWith('REFORMA_')
      || (regime.nome || '').toLowerCase().includes('reforma')
      || (regime.nome || '').toLowerCase().includes('ibs')
      || (regime.nome || '').toLowerCase().includes('cbs')
      || (regime.nome || '').toLowerCase().includes('iva')
    ),
    basePresuncaoVenda: toNumber(regime.basePresuncaoVenda, 8),
    basePresuncaoServico: toNumber(regime.basePresuncaoServico, 32),
    anexoI: toNumber(regime.anexoI, regime.id === 'SIMPLES_NACIONAL' ? 8 : 0),
    anexoIII: toNumber(regime.anexoIII, regime.id === 'SIMPLES_NACIONAL' ? 11.2 : 0),
    ativo: Boolean(regime.ativo)
  }));

  if (!regimesTributarios.some((regime) => regime.ativo)) {
    regimesTributarios[0].ativo = true;
  }

  return {
    regimesTributarios,
    custosDespesas: {
      fretePadrao: toNumber(source?.custosDespesas?.fretePadrao, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.fretePadrao),
      despesasFixasMensais: toNumber(source?.custosDespesas?.despesasFixasMensais, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.despesasFixasMensais),
      despesasVariaveisPercentual: toNumber(source?.custosDespesas?.despesasVariaveisPercentual, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.despesasVariaveisPercentual),
      comissaoVenda: toNumber(source?.custosDespesas?.comissaoVenda, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.comissaoVenda),
      comissaoLocacao: toNumber(source?.custosDespesas?.comissaoLocacao, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.comissaoLocacao),
      comissaoServico: toNumber(source?.custosDespesas?.comissaoServico, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.comissaoServico),
      margemLucroServico: toNumber(source?.custosDespesas?.margemLucroServico, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.margemLucroServico),
      despesasAdmin: toNumber(source?.custosDespesas?.despesasAdmin, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.despesasAdmin),
      outrasDespesas: toNumber(source?.custosDespesas?.outrasDespesas, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.outrasDespesas),
      custoFinanceiroMensal: toNumber(source?.custosDespesas?.custoFinanceiroMensal, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.custoFinanceiroMensal),
      taxaDescontoVPL: toNumber(source?.custosDespesas?.taxaDescontoVPL, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.taxaDescontoVPL),
      depreciacao: toNumber(source?.custosDespesas?.depreciacao, DEFAULT_CALCULATOR_SETTINGS.custosDespesas.depreciacao)
    },
    maoDeObra: {
      encargosPercentual: toNumber(source?.maoDeObra?.encargosPercentual, DEFAULT_CALCULATOR_SETTINGS.maoDeObra.encargosPercentual),
      beneficiosPercentual: toNumber(source?.maoDeObra?.beneficiosPercentual, DEFAULT_CALCULATOR_SETTINGS.maoDeObra.beneficiosPercentual),
      encargos: Object.keys(DEFAULT_CALCULATOR_SETTINGS.maoDeObra.encargos).reduce((acc, key) => {
        acc[key] = toNumber(source?.maoDeObra?.encargos?.[key], DEFAULT_CALCULATOR_SETTINGS.maoDeObra.encargos[key]);
        return acc;
      }, {}),
      beneficios: Object.keys(DEFAULT_CALCULATOR_SETTINGS.maoDeObra.beneficios).reduce((acc, key) => {
        acc[key] = toNumber(source?.maoDeObra?.beneficios?.[key], DEFAULT_CALCULATOR_SETTINGS.maoDeObra.beneficios[key]);
        return acc;
      }, {}),
      geral: {
        diasUteis: toNumber(source?.maoDeObra?.geral?.diasUteis, DEFAULT_CALCULATOR_SETTINGS.maoDeObra.geral.diasUteis),
        horasDia: toNumber(source?.maoDeObra?.geral?.horasDia, DEFAULT_CALCULATOR_SETTINGS.maoDeObra.geral.horasDia),
        salarioBase: toNumber(source?.maoDeObra?.geral?.salarioBase, DEFAULT_CALCULATOR_SETTINGS.maoDeObra.geral.salarioBase)
      }
    },
    icmsInterestadual: {
      origemUf: source?.icmsInterestadual?.origemUf || DEFAULT_CALCULATOR_SETTINGS.icmsInterestadual.origemUf,
      aliquotasPorUf: ICMS_UF_ORDER.reduce((acc, uf) => {
        acc[uf] = toNumber(
          source?.icmsInterestadual?.aliquotasPorUf?.[uf],
          DEFAULT_CALCULATOR_SETTINGS.icmsInterestadual.aliquotasPorUf[uf]
        );
        return acc;
      }, {})
    },
    dadosEmpresa: {
      razaoSocial: source?.dadosEmpresa?.razaoSocial || DEFAULT_CALCULATOR_SETTINGS.dadosEmpresa.razaoSocial,
      cnpj: source?.dadosEmpresa?.cnpj || DEFAULT_CALCULATOR_SETTINGS.dadosEmpresa.cnpj,
      uf: source?.dadosEmpresa?.uf || DEFAULT_CALCULATOR_SETTINGS.dadosEmpresa.uf,
      address: source?.dadosEmpresa?.address || DEFAULT_CALCULATOR_SETTINGS.dadosEmpresa.address,
      cityState: source?.dadosEmpresa?.cityState || DEFAULT_CALCULATOR_SETTINGS.dadosEmpresa.cityState,
      phone: source?.dadosEmpresa?.phone || DEFAULT_CALCULATOR_SETTINGS.dadosEmpresa.phone,
      email: source?.dadosEmpresa?.email || DEFAULT_CALCULATOR_SETTINGS.dadosEmpresa.email
    }
  };
};

const resolveRegimeType = (regime) => {
  const nome = (regime?.nome || '').toLowerCase();
  if (
    regime?.usaReforma
    || (regime?.id || '').startsWith('REFORMA_')
    || nome.includes('reforma')
    || nome.includes('ibs')
    || nome.includes('cbs')
    || nome.includes('iva')
  ) return 'reforma';
  if (regime?.id === 'LUCRO_REAL' || nome.includes('real')) return 'real';
  if (regime?.id === 'SIMPLES_NACIONAL' || nome.includes('simples')) return 'simples';
  if (regime?.id === 'MEI' || nome.includes('mei')) return 'mei';
  return 'presumido';
};

const getReformaRates = (regimeRates = {}) => {
  const cbs = Math.max(0, toNumber(regimeRates.cbs, 0));
  const ibs = Math.max(0, toNumber(regimeRates.ibs, 0));
  const impostoSeletivo = Math.max(0, toNumber(regimeRates.is, 0));
  const ivaInformado = Math.max(0, toNumber(regimeRates.iva, cbs + ibs));
  const ivaBase = (cbs + ibs) > 0 ? (cbs + ibs) : ivaInformado;
  return {
    cbs,
    ibs,
    is: impostoSeletivo,
    iva: ivaBase,
    total: ivaBase + impostoSeletivo
  };
};

const getDirectTaxRateForOperation = (regime, operationType) => {
  if (regime?.type === 'reforma') {
    return getReformaRates(regime.rates).total / 100;
  }
  if (regime?.type === 'simples') {
    if (operationType === 'venda') return toNumber(regime.rates.anexoI, 0) / 100;
    return toNumber(regime.rates.anexoIII, 0) / 100;
  }
  if (operationType === 'servicos') {
    return (toNumber(regime.rates.pis, 0) + toNumber(regime.rates.cofins, 0) + toNumber(regime.rates.iss, 0)) / 100;
  }
  if (operationType === 'venda') {
    return (toNumber(regime.rates.pis, 0) + toNumber(regime.rates.cofins, 0) + toNumber(regime.rates.icms, 0)) / 100;
  }
  return (toNumber(regime.rates.pis, 0) + toNumber(regime.rates.cofins, 0)) / 100;
};

const getTaxLabelByRegime = (regime, operationType) => {
  if (regime?.type === 'reforma') {
    return 'IBS/CBS/IS';
  }
  if (regime?.type === 'simples') {
    return operationType === 'venda' ? 'Simples (Anexo I)' : 'Simples (Anexo III)';
  }
  if (operationType === 'servicos') {
    return 'PIS/COFINS/ISS';
  }
  if (operationType === 'venda') {
    return 'PIS/COFINS/ICMS';
  }
  return 'PIS/COFINS';
};

const pmt = (rate, periods, presentValue) => {
  if (periods <= 0 || presentValue < 0) return 0;
  if (rate === 0) return presentValue / periods;
  const pow = Math.pow(1 + rate, periods);
  return (rate * presentValue * pow) / (pow - 1);
};

const calculateOperation = ({
  operationType,
  activeRegimeId,
  regimes,
  outrosCustos,
  laborCostConfig,
  icmsInterstate,
  saleItems,
  rentalItems,
  serviceItems,
  rentalPeriod,
  desiredMargin,
  isIcmsContributor,
  destinationUF
}) => {
  const calculateHourlyCost = (baseSalary, contractType = 'clt') => {
    if (!laborCostConfig) return 0;
    const diasUteis = toNumber(laborCostConfig?.geral?.diasUteis, 21);
    const horasDia = toNumber(laborCostConfig?.geral?.horasDia, 8);
    const divisor = Math.max(1, diasUteis * horasDia);
    const salario = toNumber(baseSalary, 0);

    if (contractType === 'clt') {
      const encargosTotal = Object.values(laborCostConfig?.encargos || {})
        .reduce((acc, value) => acc + toNumber(value, 0), 0) / 100;
      const beneficiosTotal = Object.values(laborCostConfig?.beneficios || {})
        .reduce((acc, value) => acc + toNumber(value, 0), 0);
      return (salario + (salario * encargosTotal) + beneficiosTotal) / divisor;
    }

    return salario / divisor;
  };

  const regimeRaw = regimes.find((item) => item.id === activeRegimeId);
  if (!regimeRaw) {
    return {
      calculationResults: {
        finalPrice: 0,
        monthlyPrice: 0,
        taxRegimeName: 'Nenhum regime selecionado',
        taxRegimeType: null,
        divisor: null,
        itemCalculations: {},
        impostosValor: 0,
        margemEComissaoValor: 0,
        baseCost: 0,
        accountingCost: 0
      },
      operationAnalysis: [],
      calculateHourlyCost
    };
  }

  const regimeType = resolveRegimeType(regimeRaw);
  const regime = {
    id: regimeRaw.id,
    name: regimeRaw.nome,
    type: regimeType,
    rates: {
      pis: toNumber(regimeRaw.pis, 0),
      cofins: toNumber(regimeRaw.cofins, 0),
      irpj: toNumber(regimeRaw.irpj, 0),
      csll: toNumber(regimeRaw.csll, 0),
      presuncaoVenda: toNumber(regimeRaw.basePresuncaoVenda, 8),
      presuncaoServico: toNumber(regimeRaw.basePresuncaoServico, 32),
      icms: toNumber(regimeRaw.icms, 0),
      iss: toNumber(regimeRaw.iss, 0),
      cbs: toNumber(regimeRaw.cbs, 0),
      ibs: toNumber(regimeRaw.ibs, 0),
      is: toNumber(regimeRaw.is, 0),
      iva: toNumber(regimeRaw.iva, toNumber(regimeRaw.cbs, 0) + toNumber(regimeRaw.ibs, 0)),
      anexoI: toNumber(regimeRaw.anexoI, regimeType === 'simples' ? 8 : 0),
      anexoIII: toNumber(regimeRaw.anexoIII, regimeType === 'simples' ? 11.2 : 0)
    }
  };
  const reformaRates = getReformaRates(regime.rates);

  const comissaoVenda = toNumber(outrosCustos.comissaoVenda, 3);
  const comissaoLocacao = toNumber(outrosCustos.comissaoLocacao, 10);
  const comissaoServico = toNumber(outrosCustos.comissaoServico, 5);
  const despesasAdmin = toNumber(outrosCustos.despesasAdmin, 2);
  const outrasDespesas = toNumber(outrosCustos.outrasDespesas, 1);
  const custoFinanceiroMensal = toNumber(outrosCustos.custoFinanceiroMensal, 1.17);
  const taxaDescontoVPL = toNumber(outrosCustos.taxaDescontoVPL, 15);

  const itemCalculations = {};
  const operationAnalysis = [];

  let finalPrice = 0;
  let monthlyPrice = 0;
  let baseCost = 0;
  let accountingCost = 0;
  let impostosValor = 0;
  let margemEComissaoValor = 0;

  let comissaoRate = comissaoVenda / 100;
  if (operationType === 'locacao') comissaoRate = comissaoLocacao / 100;
  if (operationType === 'servicos') comissaoRate = comissaoServico / 100;
  const margemRate = toNumber(desiredMargin, 20) / 100;
  const despesasRate = (despesasAdmin + outrasDespesas) / 100;

  if (operationType === 'locacao') {
    const period = Math.max(0, toNumber(rentalPeriod, 12));
    let totalAssetCost = 0;

    rentalItems.forEach((item) => {
      const quantity = toNumber(item.quantity, 0);
      if (quantity === 0) {
        itemCalculations[item.id] = {
          monthlyCost: 0,
          monthlyCostTotal: 0,
          totalAssetCost: 0,
          totalBRL: 0,
          difal: 0,
          rbUnitario: 0,
          rbTotal: 0,
          marginComissaoValor: 0,
          impostosValor: 0
        };
        return;
      }

      const assetValue = toNumber(item.assetValueBRL, 0);
      const icmsCompra = toNumber(item.icmsCompra, 0);
      const icmsPrRate = toNumber(item.icmsPr, 0) / 100;
      let difal = 0;
      if (regime.type !== 'reforma') {
        const divisor = 1 - icmsPrRate;
        if (divisor > 0 && icmsPrRate > 0) {
          difal = (((assetValue - icmsCompra) / divisor) * icmsPrRate) - icmsCompra;
        }
      }
      const totalCost = (assetValue + (difal > 0 ? difal : 0) + toNumber(item.frete, 0)) * quantity;

      itemCalculations[item.id] = {
        totalAssetCost: totalCost,
        totalBRL: assetValue * quantity,
        difal: difal > 0 ? difal * quantity : 0
      };
      totalAssetCost += totalCost;
    });

    if (period > 0 && totalAssetCost > 0) {
      baseCost = pmt(custoFinanceiroMensal / 100, period, totalAssetCost);
      let revenueMonthly = 0;

      rentalItems.forEach((item) => {
        const quantity = toNumber(item.quantity, 0);
        if (quantity === 0) return;
        const assetCost = toNumber(itemCalculations[item.id]?.totalAssetCost, 0);
        const monthlyCostTotal = baseCost * (totalAssetCost > 0 ? assetCost / totalAssetCost : 0);
        const denominator = 1 - (margemRate + comissaoRate);
        const margemComissao = denominator > 0
          ? (monthlyCostTotal / denominator) * (margemRate + comissaoRate)
          : 0;
        const subtotal = monthlyCostTotal + margemComissao;

        const taxRate = getDirectTaxRateForOperation(regime, 'locacao');

        const rbMonthly = (1 - taxRate) > 0 ? subtotal / (1 - taxRate) : subtotal;
        const impostos = rbMonthly * taxRate;

        itemCalculations[item.id] = {
          ...itemCalculations[item.id],
          monthlyCost: quantity > 0 ? monthlyCostTotal / quantity : 0,
          monthlyCostTotal,
          marginComissaoValor: margemComissao,
          impostosValor: impostos,
          rbUnitario: quantity > 0 ? rbMonthly / quantity : 0,
          rbTotal: rbMonthly * period
        };

        revenueMonthly += rbMonthly;
        impostosValor += impostos;
        margemEComissaoValor += margemComissao;
      });

      monthlyPrice = revenueMonthly;
      finalPrice = revenueMonthly * period;

      const assetsTotal = rentalItems.reduce(
        (acc, item) => acc + toNumber(itemCalculations[item.id]?.totalAssetCost, 0),
        0
      );
      const taxRate = getDirectTaxRateForOperation(regime, 'locacao');
      const impostosMensais = revenueMonthly * taxRate;
      const receitaLiquida = revenueMonthly - impostosMensais;
      const comissao = revenueMonthly * comissaoRate;
      const custoProdutos = assetsTotal > 0 && period > 0 ? assetsTotal / period : 0;
      const custoFinanceiro = baseCost - custoProdutos;
      const lucroLiquido = receitaLiquida - custoProdutos - comissao - custoFinanceiro;
      const margemTotal = revenueMonthly > 0 ? (lucroLiquido / revenueMonthly) * 100 : 0;

      operationAnalysis.push({
        title: 'Análise de Margens',
        headers: { value: 'VALORES', percent: '%' },
        data: [
          { label: 'Receita Bruta', value: revenueMonthly, percent: 100, formatter: formatCurrency },
          { label: `(-) Impostos (${getTaxLabelByRegime(regime, 'locacao')})`, value: -impostosMensais, percent: revenueMonthly > 0 ? (-impostosMensais / revenueMonthly) * 100 : 0, formatter: formatCurrency },
          { label: '= Receita Líquida', value: receitaLiquida, percent: revenueMonthly > 0 ? (receitaLiquida / revenueMonthly) * 100 : 0, isTotal: true, formatter: formatCurrency },
          { label: '(-) custos produtos', value: -custoProdutos, percent: revenueMonthly > 0 ? (-custoProdutos / revenueMonthly) * 100 : 0, formatter: formatCurrency },
          { label: '(-) Comissão', value: -comissao, percent: revenueMonthly > 0 ? (-comissao / revenueMonthly) * 100 : 0, formatter: formatCurrency },
          { label: '(-) Custos Financeiros', value: -custoFinanceiro, percent: revenueMonthly > 0 ? (-custoFinanceiro / revenueMonthly) * 100 : 0, formatter: formatCurrency },
          { label: '= Lucro Líquido', value: lucroLiquido, percent: margemTotal, isTotal: true, isFinal: true, formatter: formatCurrency }
        ]
      });

      const receitaPayback = revenueMonthly - comissao - custoFinanceiro;
      operationAnalysis.push({
        title: 'PAYBACK',
        headers: { value: 'VALORES' },
        data: [
          { label: 'Receita', value: revenueMonthly, formatter: formatCurrency },
          { label: '(-) Comissões', value: -comissao, formatter: formatCurrency },
          { label: '(-) Custos Financeiros', value: -custoFinanceiro, formatter: formatCurrency },
          { label: '= Receita p/ Payback', value: receitaPayback, isTotal: true, isFinal: true, formatter: formatCurrency },
          { label: 'CUSTOS TOTAL', value: assetsTotal, isTotal: true, formatter: formatCurrency },
          { label: 'PAYBACK (Meses)', value: receitaPayback > 0 ? assetsTotal / receitaPayback : Infinity, isTotal: true, isFinal: true, formatter: (value) => (Number.isFinite(value) ? value.toFixed(2) : 'N/A') }
        ]
      });

      const discount = taxaDescontoVPL / 100;
      let pvRecebido = 0;
      const years = [];
      for (let year = 1; year <= 5; year += 1) {
        const startMonth = ((year - 1) * 12) + 1;
        const endMonth = 12 * year;
        let received = 0;
        if (period >= startMonth) {
          received = receitaPayback * (Math.min(period, endMonth) - startMonth + 1);
        }
        const pv = discount > 0 ? (received / Math.pow(1 + discount, year)) : received;
        years.push({ label: `Recebido Ano ${year}`, value: pv, formatter: (value) => (value === 0 ? '-' : formatCurrency(value)) });
        pvRecebido += pv;
      }
      const vpl = pvRecebido - assetsTotal;
      const vplPercent = assetsTotal > 0 ? (vpl / assetsTotal) * 100 : 0;

      operationAnalysis.push({
        title: 'VPL - VALOR PRESENTE LÍQUIDO',
        headers: { value: 'VALORES' },
        data: [
          { label: 'CUSTOS TOTAL', value: assetsTotal, formatter: formatCurrency, isHeader: true },
          { label: 'Taxa Desconto', value: discount * 100, formatter: formatPercent, isHeader: true },
          ...years,
          { label: 'VPL', value: vpl, isTotal: true, isFinal: true, formatter: formatCurrency },
          { label: 'VPL %', value: vplPercent, isTotal: true, isFinal: true, formatter: formatPercent }
        ]
      });
    }
  } else if (operationType === 'venda') {
    saleItems.forEach((item) => {
      const quantity = toNumber(item.quantity, 0);
      if (quantity === 0) {
        itemCalculations[item.id] = {
          baseCost: 0,
          icmsVendaCalculated: 0,
          rbUnitario: 0,
          impostosValor: 0,
          marginComissaoValor: 0,
          difalVenda: 0
        };
        return;
      }

      const unitCost = toNumber(item.unitCost, 0);
      const costWithCredit = unitCost - toNumber(item.creditoIcmsCompra, 0);
      const pisRate = toNumber(regime.rates.pis, 0) / 100;
      const cofinsRate = toNumber(regime.rates.cofins, 0) / 100;
      let icmsVendaRate = toNumber(icmsInterstate?.[destinationUF], regime.rates.icms) / 100;
      let difalRate = 0;

      if (regime.type === 'reforma') {
        const ibsParaExibicao = reformaRates.ibs > 0 ? reformaRates.ibs : reformaRates.iva;
        icmsVendaRate = toNumber(ibsParaExibicao, 0) / 100;
      } else {
        if (isIcmsContributor) {
          const icmsDestRate = toNumber(item.icmsDestLocal, 0) / 100;
          if (icmsDestRate > icmsVendaRate) difalRate = icmsDestRate - icmsVendaRate;
        }
        if (item.icmsST) {
          icmsVendaRate = 0;
          difalRate = 0;
        }
      }

      let rbUnitario = 0;
      let impostosUnit = 0;
      let margemComissaoUnit = 0;
      let lucroUnit = 0;

      if (regime.type === 'presumido' || regime.type === 'real') {
        const divisorMargem = 1 - comissaoRate - margemRate;
        const custoComMargem = divisorMargem > 0 ? costWithCredit / divisorMargem : 0;
        const baseImpostos = 1 - pisRate - cofinsRate - icmsVendaRate - difalRate;
        const difalValor = (baseImpostos > 0 ? custoComMargem / baseImpostos : 0) * difalRate;
        rbUnitario = baseImpostos > 0 ? custoComMargem / baseImpostos : 0;
        impostosUnit = (rbUnitario * pisRate) + (rbUnitario * cofinsRate) + (rbUnitario * icmsVendaRate) + difalValor;
        margemComissaoUnit = (rbUnitario - impostosUnit) * comissaoRate;
        lucroUnit = rbUnitario - impostosUnit - margemComissaoUnit - costWithCredit;
      } else if (regime.type === 'reforma') {
        const divisorMargem = 1 - comissaoRate - margemRate;
        const custoComMargem = divisorMargem > 0 ? costWithCredit / divisorMargem : 0;
        const reformaRate = getDirectTaxRateForOperation(regime, 'venda');
        const baseImpostos = 1 - reformaRate;
        rbUnitario = baseImpostos > 0 ? custoComMargem / baseImpostos : 0;
        impostosUnit = rbUnitario * reformaRate;
        margemComissaoUnit = (rbUnitario - impostosUnit) * comissaoRate;
        lucroUnit = rbUnitario - impostosUnit - margemComissaoUnit - costWithCredit;
      } else if (regime.type === 'simples') {
        const anexoRate = toNumber(regime.rates.anexoI, 0) / 100;
        const divisor = 1 - (comissaoRate + margemRate + anexoRate);
        rbUnitario = divisor > 0 ? costWithCredit / divisor : 0;
        impostosUnit = rbUnitario * anexoRate;
        margemComissaoUnit = rbUnitario * comissaoRate;
        lucroUnit = rbUnitario * margemRate;
      }

      itemCalculations[item.id] = {
        baseCost: unitCost,
        icmsVendaCalculated: icmsVendaRate * 100,
        rbUnitario,
        impostosValor: impostosUnit,
        marginComissaoValor: margemComissaoUnit + lucroUnit,
        difalVenda: regime.type === 'reforma' ? 0 : rbUnitario * difalRate
      };

      finalPrice += rbUnitario * quantity;
      baseCost += unitCost * quantity;
      accountingCost += costWithCredit * quantity;
      impostosValor += impostosUnit * quantity;
      margemEComissaoValor += (margemComissaoUnit + lucroUnit) * quantity;
    });

    if (finalPrice > 0) {
      let irpjValor = 0;
      let csllValor = 0;
      let impostosDiretos = 0;
      let comissaoValor = 0;
      let receitaLiquida = 0;
      let lucroOperacional = 0;
      let lucroLiquido = 0;
      const pis = toNumber(regime.rates.pis, 0);
      const cofins = toNumber(regime.rates.cofins, 0);
      const irpj = toNumber(regime.rates.irpj, 0);
      const csll = toNumber(regime.rates.csll, 0);
      const presuncaoVenda = toNumber(regime.rates.presuncaoVenda, 0);
      const icms = toNumber(regime.rates.icms, 0);
      const anexoI = toNumber(regime.rates.anexoI, 0);
      const icmsRate = toNumber(icmsInterstate?.[destinationUF], 0) / 100;
      let difalValor = 0;
      let icmsValor = 0;

      if (regime.type === 'presumido') {
        const pisValor = (pis / 100) * finalPrice;
        const cofinsValor = (cofins / 100) * finalPrice;
        icmsValor = finalPrice * icmsRate;
        if (isIcmsContributor && saleItems.length > 0) {
          const mediaDest = saleItems.reduce((acc, item) => acc + toNumber(item.icmsDestLocal, 0), 0) / saleItems.length / 100;
          if (mediaDest > icmsRate) difalValor = finalPrice * (mediaDest - icmsRate);
        }
        if (saleItems.some((item) => item.icmsST)) {
          icmsValor = 0;
          difalValor = 0;
        }
        impostosDiretos = pisValor + cofinsValor + icmsValor + difalValor;
        receitaLiquida = finalPrice - impostosDiretos;
        comissaoValor = receitaLiquida * comissaoRate;
        lucroOperacional = receitaLiquida - accountingCost - comissaoValor;
        irpjValor = (presuncaoVenda / 100) * finalPrice * (irpj / 100);
        csllValor = (presuncaoVenda / 100) * finalPrice * (csll / 100);
        lucroLiquido = lucroOperacional - irpjValor - csllValor;
      } else if (regime.type === 'real') {
        impostosDiretos = (pis / 100 * finalPrice) + (cofins / 100 * finalPrice) + (icms / 100 * finalPrice);
        receitaLiquida = finalPrice - impostosDiretos;
        comissaoValor = receitaLiquida * comissaoRate;
        lucroOperacional = receitaLiquida - accountingCost - comissaoValor;
        irpjValor = lucroOperacional > 0 ? (irpj / 100) * lucroOperacional : 0;
        csllValor = lucroOperacional > 0 ? (csll / 100) * lucroOperacional : 0;
        lucroLiquido = lucroOperacional - irpjValor - csllValor;
      } else if (regime.type === 'reforma') {
        const cargaReforma = reformaRates.total / 100;
        impostosDiretos = cargaReforma * finalPrice;
        receitaLiquida = finalPrice - impostosDiretos;
        comissaoValor = receitaLiquida * comissaoRate;
        lucroOperacional = receitaLiquida - accountingCost - comissaoValor;
        irpjValor = (presuncaoVenda / 100) * finalPrice * (irpj / 100);
        csllValor = (presuncaoVenda / 100) * finalPrice * (csll / 100);
        lucroLiquido = lucroOperacional - irpjValor - csllValor;
      } else if (regime.type === 'simples') {
        impostosDiretos = (anexoI / 100) * finalPrice;
        receitaLiquida = finalPrice - impostosDiretos;
        comissaoValor = receitaLiquida * comissaoRate;
        lucroOperacional = receitaLiquida - accountingCost - comissaoValor;
        lucroLiquido = lucroOperacional;
      }

      const markup = accountingCost > 0 ? finalPrice / accountingCost : 0;
      operationAnalysis.push({
        title: 'Análise de Venda',
        data: [
          { label: 'Preço de Custo:', value: accountingCost, formatter: formatCurrency },
          { label: 'Despesas fixas:', value: 0, formatter: formatPercent },
          { label: 'Despesas variáveis:', value: finalPrice > 0 ? (comissaoValor / finalPrice) * 100 : 0, formatter: formatPercent },
          { label: 'Margem de lucro:', value: toNumber(desiredMargin, 20), formatter: formatPercent },
          { label: 'Markup:', value: markup, isHighlighted: true, isLabelBold: true, formatter: (value) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
          { label: 'Preço de venda:', value: finalPrice, isHighlighted: true, formatter: formatCurrency }
        ]
      });
      operationAnalysis.push({
        title: 'Análise de Margens',
        headers: { value: 'VALORES', percent: '%' },
        data: [
          { label: 'Receita Bruta', value: finalPrice, percent: 100, formatter: formatCurrency },
          { label: `(-) Impostos (${getTaxLabelByRegime(regime, 'venda')})`, value: -impostosDiretos, percent: finalPrice > 0 ? (-impostosDiretos / finalPrice) * 100 : 0, formatter: formatCurrency },
          { label: '= Receita Líquida', value: receitaLiquida, percent: finalPrice > 0 ? (receitaLiquida / finalPrice) * 100 : 0, isTotal: true, formatter: formatCurrency },
          { label: '(-) Custo (CMV)', value: -accountingCost, percent: finalPrice > 0 ? (-accountingCost / finalPrice) * 100 : 0, formatter: formatCurrency },
          { label: '(-) Comissão', value: -comissaoValor, percent: finalPrice > 0 ? (-comissaoValor / finalPrice) * 100 : 0, formatter: formatCurrency },
          { label: '= Lucro Operacional', value: lucroOperacional, percent: finalPrice > 0 ? (lucroOperacional / finalPrice) * 100 : 0, isTotal: true, formatter: formatCurrency },
          { label: '(-) IRPJ/CSLL', value: -(irpjValor + csllValor), percent: finalPrice > 0 ? (-(irpjValor + csllValor) / finalPrice) * 100 : 0, formatter: formatCurrency, hideValue: !(regime.type === 'presumido' || regime.type === 'real' || regime.type === 'reforma') },
          { label: '= Lucro Líquido', value: lucroLiquido, percent: finalPrice > 0 ? (lucroLiquido / finalPrice) * 100 : 0, isTotal: true, isFinal: true, formatter: formatCurrency }
        ].filter((item) => !item.hideValue)
      });
      operationAnalysis.push({
        title: 'Indicadores',
        data: [
          { label: '% Lucro s/ Receita Líquida', value: receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0, isFinal: true, formatter: formatPercent },
          { label: 'Markup', value: markup, formatter: (value) => value.toFixed(4) }
        ]
      });
    }
  } else if (operationType === 'servicos') {
    serviceItems.forEach((item) => {
      const hourlyCost = calculateHourlyCost(toNumber(item.baseSalary, 0), item.contractType);
      const totalCost = toNumber(item.estimatedHours, 0) * hourlyCost;
      baseCost += totalCost;
      itemCalculations[item.id] = { hourlyCost, totalCost };
    });

    accountingCost = baseCost;

    let cargaDireta = 0;
    let cargaLucro = 0;
    if (regime.type === 'presumido') {
      const presuncao = toNumber(regime.rates.presuncaoServico, 0) / 100;
      cargaDireta = (toNumber(regime.rates.pis, 0) + toNumber(regime.rates.cofins, 0) + toNumber(regime.rates.iss, 0)) / 100;
      cargaLucro = ((toNumber(regime.rates.irpj, 0) + toNumber(regime.rates.csll, 0)) / 100) * presuncao;
    } else if (regime.type === 'real') {
      cargaDireta = (toNumber(regime.rates.pis, 0) + toNumber(regime.rates.cofins, 0) + toNumber(regime.rates.iss, 0)) / 100;
      cargaLucro = (toNumber(regime.rates.irpj, 0) + toNumber(regime.rates.csll, 0)) / 100;
    } else if (regime.type === 'reforma') {
      const presuncao = toNumber(regime.rates.presuncaoServico, 0) / 100;
      cargaDireta = getDirectTaxRateForOperation(regime, 'servicos');
      cargaLucro = ((toNumber(regime.rates.irpj, 0) + toNumber(regime.rates.csll, 0)) / 100) * presuncao;
    } else if (regime.type === 'simples') {
      cargaDireta = toNumber(regime.rates.anexoIII, 0) / 100;
    }

    const taxaOperacao = comissaoRate + despesasRate + margemRate;
    if (regime.type === 'real') {
      const divisorBase = 1 - cargaDireta - taxaOperacao;
      const base = divisorBase > 0 ? baseCost / divisorBase : 0;
      const lucroAntesImpostoLucro = base - (base * cargaDireta) - baseCost - (base * taxaOperacao);
      finalPrice = base + (lucroAntesImpostoLucro > 0 ? (lucroAntesImpostoLucro * cargaLucro) : 0);
    } else {
      const divisor = 1 - cargaDireta - taxaOperacao - cargaLucro;
      finalPrice = divisor > 0 ? baseCost / divisor : 0;
    }

    impostosValor = finalPrice * cargaDireta;
    if (regime.type === 'presumido' || regime.type === 'reforma') {
      impostosValor += finalPrice * cargaLucro;
    } else if (regime.type === 'real') {
      const lucroPosDiretos = finalPrice - impostosValor - baseCost - (finalPrice * taxaOperacao);
      if (lucroPosDiretos > 0) impostosValor += lucroPosDiretos * cargaLucro;
    }
    margemEComissaoValor = finalPrice - impostosValor - accountingCost - (finalPrice * despesasRate);

    const multiplier = baseCost > 0 ? finalPrice / baseCost : 0;
    serviceItems.forEach((item) => {
      if (!itemCalculations[item.id]) return;
      const sellPricePerHour = itemCalculations[item.id].hourlyCost * multiplier;
      itemCalculations[item.id].sellPricePerHour = sellPricePerHour;
      itemCalculations[item.id].totalSellPrice = sellPricePerHour * toNumber(item.estimatedHours, 0);
    });

    const horasTotais = serviceItems.reduce((acc, item) => acc + toNumber(item.estimatedHours, 0), 0);
    operationAnalysis.push({
      title: 'Indicadores',
      data: [
        { label: 'Horas Totais', value: horasTotais, formatter: (value) => value.toLocaleString('pt-BR') },
        { label: 'Valor/Hora Efetivo', value: horasTotais > 0 ? finalPrice / horasTotais : 0, formatter: formatCurrency },
        { label: 'Margem Real', value: finalPrice > 0 ? ((finalPrice - baseCost - impostosValor) / finalPrice) * 100 : 0, formatter: formatPercent }
      ]
    });
  }

  return {
    calculationResults: {
      finalPrice: operationType === 'locacao' ? monthlyPrice * Math.max(0, toNumber(rentalPeriod, 12)) : finalPrice,
      monthlyPrice: operationType === 'locacao' ? monthlyPrice : 0,
      taxRegimeName: regime.name,
      taxRegimeType: regime.type,
      divisor: null,
      itemCalculations,
      impostosValor,
      margemEComissaoValor,
      baseCost,
      accountingCost
    },
    operationAnalysis,
    calculateHourlyCost
  };
};

export default function Calculadoras({
  pageTitle = 'Calculadoras',
  pageSubtitle = 'Ferramentas especializadas para diferentes modelos de negócio',
  breadcrumbs = ['Home', 'Calculadoras'],
  showCalculatorCards = true,
  showPricingActions = false
}) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCotacaoModal, setShowCotacaoModal] = useState(false); // NOVO: Modal de seleção de cotações
  const [cotacoesDisponiveis, setCotacoesDisponiveis] = useState([]); // NOVO: Lista de cotações
  const [loadingCotacoes, setLoadingCotacoes] = useState(false); // NOVO: Loading das cotações
  
  // Estados para Custos (Orçamentos de Distribuidores)
  const [distributorCosts, setDistributorCosts] = useState([]); // Lista de custos adicionados
  const [preSalesDistributors, setPreSalesDistributors] = useState([]);
  const [preSalesSuppliers, setPreSalesSuppliers] = useState([]);
  const [currentBudget, setCurrentBudget] = useState({
    distribuidorId: '',
    distribuidor: '',
    fornecedorId: '',
    fornecedor: '',
    numeroOrcamento: ''
  });
  const [currentCost, setCurrentCost] = useState({
    modalidade: 'VENDA',
    item: '',
    quantidade: 1,
    custoUnitario: 0,
    observacoes: ''
  });
  
  const [settingsTab, setSettingsTab] = useState('regimes');
  const [currentTab, setCurrentTab] = useState('vendas');
  const [calculatorStep, setCalculatorStep] = useState('proposal');
  const [calculatorSettings, setCalculatorSettings] = useState(() => normalizeSettings(DEFAULT_CALCULATOR_SETTINGS));
  const [draftSettings, setDraftSettings] = useState(() => normalizeSettings(DEFAULT_CALCULATOR_SETTINGS));
  const [savedProposals, setSavedProposals] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activeProposalId, setActiveProposalId] = useState(null);
  const [proposalSearchNumber, setProposalSearchNumber] = useState('');
  const lastAutoBudgetSearchRef = useRef('');
  const [proposalFeedback, setProposalFeedback] = useState(null);
  const [homeFeedback, setHomeFeedback] = useState(null);
  const [preSalesSource, setPreSalesSource] = useState(null);
  const [previewProposal, setPreviewProposal] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [proposalForm, setProposalForm] = useState(() => buildProposalForm('', getManagerDefaults()));
  const [vendasData, setVendasData] = useState({
    regimeTributario: 'LUCRO_PRESUMIDO'
  });

  const [saleItems, setSaleItems] = useState([{ ...DEFAULT_SALE_ITEM }]);
  const [rentalItems, setRentalItems] = useState([{ ...DEFAULT_RENTAL_ITEM }]);
  const [serviceItems, setServiceItems] = useState([{ ...DEFAULT_SERVICE_ITEM }]);
  const [rentalPeriod, setRentalPeriod] = useState(12);
  const [desiredMargin, setDesiredMargin] = useState(20);
  const [isIcmsContributor, setIsIcmsContributor] = useState(false);
  const [destinationUF, setDestinationUF] = useState('SP');
  
  // Carrinho de itens da proposta
  const [proposalCart, setProposalCart] = useState({
    sales: [],
    rentals: [],
    services: []
  });
  const regimeAtivoHeader = calculatorSettings.regimesTributarios.find((regime) => regime.ativo)
    || calculatorSettings.regimesTributarios[0];
  const regimeAtivoId = regimeAtivoHeader?.id || calculatorSettings.regimesTributarios[0]?.id || 'LUCRO_PRESUMIDO';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CALCULATOR_SETTINGS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const normalized = normalizeSettings(parsed);
      setCalculatorSettings(normalized);
      setDraftSettings(deepClone(normalized));
      const regimeAtivo = normalized.regimesTributarios.find((regime) => regime.ativo)?.id
        || normalized.regimesTributarios[0]?.id
        || 'LUCRO_PRESUMIDO';
      setVendasData((prev) => ({ ...prev, regimeTributario: regimeAtivo }));
    } catch (error) {
      console.error('Erro ao carregar configurações das calculadoras:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CALCULATOR_PROPOSALS_STORAGE_KEY)
        || sessionStorage.getItem(CALCULATOR_PROPOSALS_SESSION_KEY);
      if (!stored) return;
      const parsed = normalizeSavedProposals(JSON.parse(stored));
      if (parsed.length === 0) return;
      setSavedProposals(parsed);
      setProposalSearchNumber(parsed[0]?.number || '');
    } catch (error) {
      console.error('Erro ao carregar propostas da calculadora:', error);
    }
  }, []);

  useEffect(() => {
    const loadOpportunities = async () => {
      try {
        const response = await fetch(buildApiUrl('/opportunities'), { headers: getAuthHeaders() });
        if (!response.ok) return;
        const data = await response.json();
        setOpportunities(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao carregar oportunidades para calculadora:', error);
      }
    };
    loadOpportunities();
  }, []);

  useEffect(() => {
    const loadPreSalesDistributors = async () => {
      try {
        const response = await fetch(buildApiUrl('/prevendas-cadastros'), { headers: getAuthHeaders() });
        if (!response.ok) return;
        const data = await response.json();
        setPreSalesDistributors(Array.isArray(data?.distribuidores) ? data.distribuidores : []);
        setPreSalesSuppliers(Array.isArray(data?.fornecedores) ? data.fornecedores : []);
      } catch (error) {
        console.error('Erro ao carregar distribuidores/fornecedores de pré-vendas:', error);
      }
    };
    loadPreSalesDistributors();
  }, []);

  useEffect(() => {
    if (!homeFeedback) return undefined;
    const timer = setTimeout(() => {
      setHomeFeedback(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [homeFeedback]);

  useEffect(() => {
    if (!showModal || calculatorStep !== 'proposal') return undefined;
    const normalizedNumber = String(proposalSearchNumber || '').trim().toUpperCase();
    if (!/^ORC-\d{3,}/.test(normalizedNumber)) return undefined;
    if (lastAutoBudgetSearchRef.current === normalizedNumber) return undefined;

    const timer = setTimeout(() => {
      lastAutoBudgetSearchRef.current = normalizedNumber;
      searchBudgetByNumber(normalizedNumber, { silentNotFound: true });
    }, 700);

    return () => clearTimeout(timer);
  }, [calculatorStep, proposalSearchNumber, showModal]);

  useEffect(() => {
    if (!regimeAtivoId) return;
    setVendasData((prev) => (
      prev.regimeTributario === regimeAtivoId
        ? prev
        : { ...prev, regimeTributario: regimeAtivoId }
    ));
  }, [regimeAtivoId]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    // Verificar se há dados de cotação no localStorage (fluxo Solicitações/Orçamentos → Calculadora)
    const cotacaoKey = urlParams.get('cotacaoKey');
    let cotacaoData = null;
    if (cotacaoKey) {
      try {
        cotacaoData = JSON.parse(localStorage.getItem(cotacaoKey) || 'null');
      } catch { cotacaoData = null; }
    }

    if (!urlParams.has('tipo') && !cotacaoData) return;
    setPreSalesSource(cotacaoData?.solicitacaoId ? {
      id: cotacaoData.solicitacaoId,
      numero: cotacaoData.numeroOrcamento || '',
      titulo: cotacaoData.titulo || '',
      origem: cotacaoData
    } : null);

    const tipo = urlParams.get('tipo') || cotacaoData?.modalidade || 'VENDA';
    const custoUnitario = toNumber(urlParams.get('custoUnitario'), 0);
    const quantidade = toNumber(urlParams.get('quantidade'), 1);
    const margemDesejada = toNumber(urlParams.get('margemDesejada'), 20);

    const tipoNorm = normalizeModalidadeKey(tipo);
    const targetTab = normalizeCalculatorTypeFromModalidade(tipoNorm);

    const nextProposalNumber = generateProposalNumber(savedProposals);
    const proposalNumberFromQuotation = cotacaoData?.numeroOrcamento || nextProposalNumber;
    const clienteCotacao = cotacaoData?.cliente && typeof cotacaoData.cliente === 'object' ? cotacaoData.cliente : {};
    const gerenteCotacao = cotacaoData?.gerente && typeof cotacaoData.gerente === 'object' ? cotacaoData.gerente : {};
    const managerDefaults = getManagerDefaults();
    const clientName = cotacaoData?.nomeCliente || clienteCotacao?.nome || '';
    setProposalForm({
      ...buildProposalForm(proposalNumberFromQuotation, managerDefaults),
      number: proposalNumberFromQuotation,
      opportunityId: cotacaoData?.oportunidadeId || cotacaoData?.opportunityId || '',
      opportunityTitle: cotacaoData?.oportunidadeTitulo || cotacaoData?.opportunityTitle || '',
      clientCompany: clientName,
      clientContact: clienteCotacao?.contato || clientName,
      clientPhone: clienteCotacao?.telefone || cotacaoData?.clientPhone || '',
      clientEmail: clienteCotacao?.email || cotacaoData?.clientEmail || '',
      clientDocument: clienteCotacao?.documento || clienteCotacao?.document || cotacaoData?.clientDocument || '',
      managerName: gerenteCotacao?.nome || cotacaoData?.managerName || managerDefaults.managerName || '',
      managerEmail: gerenteCotacao?.email || cotacaoData?.managerEmail || managerDefaults.managerEmail || '',
      managerPhone: gerenteCotacao?.telefone || cotacaoData?.managerPhone || managerDefaults.managerPhone || '',
      premises: cotacaoData?.premissas || cotacaoData?.premises || cotacaoData?.descricao || cotacaoData?.titulo || ''
    });
    setProposalSearchNumber(proposalNumberFromQuotation);
    setActiveProposalId(null);
    setProposalFeedback(null);
    setCalculatorStep('proposal');
    setDesiredMargin(margemDesejada);
    setVendasData((prev) => ({ ...prev, regimeTributario: regimeAtivoId }));
    setCurrentTab(targetTab);
    setCurrentCost({
      modalidade: modalidadeFromCalculatorType(targetTab),
      item: '',
      quantidade: 1,
      custoUnitario: 0,
      observacoes: ''
    });

    const distributorSelection = resolvePartnerSelection(
      preSalesDistributors,
      cotacaoData?.distribuidorId || '',
      cotacaoData?.distribuidor || ''
    );
    const supplierSelection = resolvePartnerSelection(
      preSalesSuppliers,
      cotacaoData?.fornecedorId || '',
      cotacaoData?.fornecedor || ''
    );

    // Pré-preencher itens da cotação
    if (cotacaoData?.itens && Array.isArray(cotacaoData.itens) && cotacaoData.itens.length > 0) {
      const itemsDaModalidade = cotacaoData.itens.filter((item) => (
        normalizeModalidadeKey(item?.modalidade || tipoNorm) === tipoNorm
      ));
      const quotedItems = (itemsDaModalidade.length > 0 ? itemsDaModalidade : cotacaoData.itens)
        .map((item) => normalizeQuotedItem({ ...item, modalidade: item.modalidade || tipoNorm }));
      const mappedItems = mapQuotedItemsToOperationItems(quotedItems, targetTab);
      const cotacaoCosts = buildDistributorCostsFromCotacaoPayload(cotacaoData);

      if (targetTab === 'locacao') setRentalItems(mappedItems);
      else if (targetTab === 'servicos') setServiceItems(mappedItems);
      else setSaleItems(mappedItems);

      setDistributorCosts(cotacaoCosts);
      setCurrentBudget({
        distribuidorId: cotacaoCosts[0]?.distribuidorId || distributorSelection.id,
        distribuidor: cotacaoCosts[0]?.distribuidor || distributorSelection.name,
        fornecedorId: cotacaoCosts[0]?.fornecedorId || supplierSelection.id,
        fornecedor: cotacaoCosts[0]?.fornecedor || supplierSelection.name,
        numeroOrcamento: cotacaoCosts[0]?.numeroOrcamento || cotacaoData.numeroOrcamento || ''
      });
      setCurrentCost((prev) => ({
        ...prev,
        modalidade: cotacaoCosts[0]?.modalidade
          ? normalizeModalidadeKey(cotacaoCosts[0].modalidade)
          : modalidadeFromCalculatorType(targetTab),
        item: '',
        quantidade: 1,
        custoUnitario: 0,
        observacoes: ''
      }));
      setProposalFeedback({
        type: 'success',
        text: `Cotação ${cotacaoData.numeroOrcamento || ''} carregada com ${quotedItems.length} item(ns).`
      });

      // Limpar localStorage após uso
      if (cotacaoKey) localStorage.removeItem(cotacaoKey);
    } else if (tipoNorm === 'VENDA' || targetTab === 'vendas') {
      setCurrentBudget({
        distribuidorId: distributorSelection.id,
        distribuidor: distributorSelection.name,
        fornecedorId: supplierSelection.id,
        fornecedor: supplierSelection.name,
        numeroOrcamento: cotacaoData?.numeroOrcamento || ''
      });
      setSaleItems((prev) => {
        const base = prev.length > 0 ? [...prev] : [{ ...DEFAULT_SALE_ITEM, id: `sale_${Date.now()}` }];
        base[0] = { ...base[0], unitCost: custoUnitario, quantity: Math.max(1, quantidade) };
        return base;
      });
      if (cotacaoKey) localStorage.removeItem(cotacaoKey);
    } else if (cotacaoData) {
      setCurrentBudget({
        distribuidorId: distributorSelection.id,
        distribuidor: distributorSelection.name,
        fornecedorId: supplierSelection.id,
        fornecedor: supplierSelection.name,
        numeroOrcamento: cotacaoData?.numeroOrcamento || ''
      });
      if (cotacaoKey) localStorage.removeItem(cotacaoKey);
    }

    setShowModal(true);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [preSalesDistributors, preSalesSuppliers, regimeAtivoId, savedProposals]);

  const operationType = currentTab === 'vendas'
    ? 'venda'
    : currentTab === 'locacao'
      ? 'locacao'
      : 'servicos';

  const calculationPreview = useMemo(() => calculateOperation({
    operationType,
    activeRegimeId: vendasData.regimeTributario,
    regimes: calculatorSettings.regimesTributarios,
    outrosCustos: calculatorSettings.custosDespesas,
    laborCostConfig: calculatorSettings.maoDeObra,
    icmsInterstate: calculatorSettings.icmsInterestadual?.aliquotasPorUf || ICMS_PR_ALIQUOTAS,
    saleItems,
    rentalItems,
    serviceItems,
    rentalPeriod,
    desiredMargin,
    isIcmsContributor,
    destinationUF
  }), [
    operationType,
    vendasData.regimeTributario,
    calculatorSettings,
    saleItems,
    rentalItems,
    serviceItems,
    rentalPeriod,
    desiredMargin,
    isIcmsContributor,
    destinationUF
  ]);

  const currentItems = operationType === 'venda'
    ? saleItems
    : operationType === 'locacao'
      ? rentalItems
      : serviceItems;

  const currentTotalLabel = operationType === 'venda'
    ? 'Custo Base Total'
    : operationType === 'locacao'
      ? 'Custo Total Ativos'
      : 'Custo Base Total';

  const currentTotalValue = useMemo(() => {
    const itemCalcs = calculationPreview.calculationResults.itemCalculations || {};
    if (operationType === 'venda') {
      return saleItems.reduce((acc, item) => acc + (toNumber(item.unitCost, 0) * toNumber(item.quantity, 0)), 0);
    }
    if (operationType === 'locacao') {
      return rentalItems.reduce((acc, item) => acc + toNumber(itemCalcs[item.id]?.totalAssetCost, 0), 0);
    }
    return serviceItems.reduce((acc, item) => acc + toNumber(itemCalcs[item.id]?.totalCost, 0), 0);
  }, [operationType, saleItems, rentalItems, serviceItems, calculationPreview]);
  const isReformaRegimeSelected = calculationPreview.calculationResults.taxRegimeType === 'reforma';
  const currentItemCount = currentItems.length;
  const currentRevenueValue = operationType === 'locacao'
    ? toNumber(calculationPreview.calculationResults.monthlyPrice, 0)
    : toNumber(calculationPreview.calculationResults.finalPrice, 0);
  const currentRevenueLabel = operationType === 'locacao' ? 'Receita Mensal' : 'Receita da Proposta';
  const currentBaseCost = toNumber(calculationPreview.calculationResults.baseCost, 0);
  const rawAccountingCost = toNumber(calculationPreview.calculationResults.accountingCost, 0);
  const currentAccountingCost = rawAccountingCost > 0 ? rawAccountingCost : currentBaseCost;
  const currentTaxes = toNumber(calculationPreview.calculationResults.impostosValor, 0);
  const currentNetRevenue = currentRevenueValue - currentTaxes;
  const currentGrossProfit = currentNetRevenue - currentAccountingCost;
  const currentMarginValue = toNumber(calculationPreview.calculationResults.margemEComissaoValor, 0);
  const currentGrossMarginPercent = currentRevenueValue > 0 ? (currentGrossProfit / currentRevenueValue) * 100 : 0;
  const currentTaxPercent = currentRevenueValue > 0 ? (currentTaxes / currentRevenueValue) * 100 : 0;
  const currentCostPercent = currentRevenueValue > 0 ? (currentAccountingCost / currentRevenueValue) * 100 : 0;
  const currentTotalContractValue = operationType === 'locacao'
    ? toNumber(calculationPreview.calculationResults.finalPrice, 0)
    : currentRevenueValue;
  const analyticsCards = [
    { label: currentRevenueLabel, value: currentRevenueValue, detail: operationType === 'locacao' ? `${toNumber(rentalPeriod, 12)} meses` : 'valor total' },
    { label: 'Custo Base', value: currentAccountingCost || currentBaseCost, detail: `${formatPercent(currentCostPercent)} da receita` },
    { label: 'Tributos', value: currentTaxes, detail: `${formatPercent(currentTaxPercent)} da receita` },
    { label: 'Margem Bruta', value: currentGrossProfit, detail: `${formatPercent(currentGrossMarginPercent)} da receita` }
  ];
  const dreRows = [
    { label: 'Receita Bruta', value: currentRevenueValue, percent: 100, emphasis: true },
    { label: '(-) Tributos', value: -currentTaxes, percent: -currentTaxPercent },
    { label: '= Receita Líquida', value: currentNetRevenue, percent: currentRevenueValue > 0 ? (currentNetRevenue / currentRevenueValue) * 100 : 0, subtotal: true },
    { label: '(-) Custo Base / CPV', value: -currentAccountingCost, percent: -currentCostPercent },
    { label: '= Resultado Gerencial', value: currentGrossProfit, percent: currentGrossMarginPercent, final: true }
  ];

  const calculadoras = [
    {
      id: 'vendas',
      title: 'Venda (Sales)',
      description: 'Precificação baseada em custos, impostos e margem de lucro',
      icon: Package,
      iconBg: 'bg-blue-500'
    },
    {
      id: 'locacao',
      title: 'Locação (MaaS/Rental)',
      description: 'Cálculo de mensalidade baseado em depreciação e ROI',
      icon: Home,
      iconBg: 'bg-green-500'
    },
    {
      id: 'servicos',
      title: 'Serviços (Service/SaaS)',
      description: 'Precificação por hora/homem e custos de projeto',
      icon: Wrench,
      iconBg: 'bg-purple-500'
    }
  ];

  const draftProposalNumber = proposalForm.number || generateProposalNumber(savedProposals);

  const operationColumns = useMemo(() => {
    if (operationType === 'venda') {
      const vendaBaseColumns = [
        { key: 'description', label: 'Descrição', kind: 'text', width: '220px' },
        { key: 'quantity', label: 'Qtde', kind: 'number', width: '90px', step: '1' },
        { key: 'unitCost', label: 'Custo Unit. R$', kind: 'number', width: '130px' },
        { key: 'creditoIcmsCompra', label: isReformaRegimeSelected ? 'Créd. Tributos R$' : 'Créd. ICMS R$', kind: 'number', width: '130px' },
        { key: 'baseCost', label: 'Custo Total', kind: 'readonly', width: '140px', format: 'currency', value: (item) => toNumber(item.unitCost, 0) * toNumber(item.quantity, 0) },
        { key: 'icmsVendaCalculated', label: isReformaRegimeSelected ? 'IBS (%)' : 'ICMS Venda %', kind: 'readonly', width: '120px', format: 'percent' },
        { key: 'marginComissaoValor', label: '(Margem+Comissão)', kind: 'readonly', width: '170px', format: 'currency', value: (item, calc) => toNumber(calc?.marginComissaoValor, 0) * toNumber(item.quantity, 0) },
        { key: 'impostosValor', label: 'Impostos', kind: 'readonly', width: '130px', format: 'currency', value: (item, calc) => toNumber(calc?.impostosValor, 0) * toNumber(item.quantity, 0) },
        { key: 'rbUnitario', label: 'Receita Bruta', kind: 'readonly', width: '150px', format: 'currency', value: (item, calc) => toNumber(calc?.rbUnitario, 0) * toNumber(item.quantity, 0) }
      ];
      if (isReformaRegimeSelected) {
        return vendaBaseColumns;
      }
      return [
        ...vendaBaseColumns.slice(0, 6),
        { key: 'icmsDestLocal', label: 'ICMS Dest. Local %', kind: 'number', width: '140px' },
        { key: 'difalVenda', label: 'DIFAL Venda', kind: 'readonly', width: '130px', format: 'currency', value: (item, calc) => toNumber(calc?.difalVenda, 0) * toNumber(item.quantity, 0) },
        { key: 'icmsST', label: 'ICMS ST', kind: 'checkbox', width: '90px' },
        ...vendaBaseColumns.slice(6)
      ];
    }

    if (operationType === 'locacao') {
      return [
        { key: 'description', label: 'Descrição', kind: 'text', width: '220px' },
        { key: 'quantity', label: 'Qtde', kind: 'number', width: '90px', step: '1' },
        { key: 'assetValueBRL', label: 'Valor Ativo R$', kind: 'number', width: '130px' },
        { key: 'sucataPercent', label: 'Sucata %', kind: 'number', width: '110px' },
        { key: 'icmsCompra', label: isReformaRegimeSelected ? 'Créd. Tributos' : 'ICMS Compra', kind: 'number', width: '120px' },
        { key: 'icmsPr', label: isReformaRegimeSelected ? 'IBS Origem %' : 'ICMS PR %', kind: 'number', width: '110px' },
        { key: 'difal', label: isReformaRegimeSelected ? 'Ajuste Destino' : 'DIFAL R$', kind: 'readonly', width: '120px', format: 'currency' },
        { key: 'frete', label: 'Frete R$', kind: 'number', width: '110px' },
        { key: 'totalAssetCost', label: 'Custo Ativo', kind: 'readonly', width: '130px', format: 'currency' },
        { key: 'monthlyCost', label: 'Custo Mensal', kind: 'readonly', width: '130px', format: 'currency' },
        { key: 'marginComissaoValor', label: '(Margem+Comissão)', kind: 'readonly', width: '170px', format: 'currency' },
        { key: 'impostosValor', label: 'Impostos', kind: 'readonly', width: '120px', format: 'currency' },
        { key: 'rbUnitario', label: 'Receita Unit/Mês', kind: 'readonly', width: '150px', format: 'currency' }
      ];
    }

    return [
      { key: 'description', label: 'Descrição', kind: 'text', width: '220px' },
      { key: 'estimatedHours', label: 'Horas', kind: 'number', width: '90px', step: '0.5' },
      { key: 'baseSalary', label: 'Salário Base R$', kind: 'number', width: '130px' },
      {
        key: 'contractType',
        label: 'Contrato',
        kind: 'select',
        width: '130px',
        options: [
          { value: 'clt', label: 'CLT' },
          { value: 'terceiro', label: 'Terceiro' }
        ]
      },
      { key: 'hourlyCost', label: 'Custo/Hora', kind: 'readonly', width: '120px', format: 'currency' },
      { key: 'sellPricePerHour', label: 'Preço/Hora', kind: 'readonly', width: '120px', format: 'currency' },
      { key: 'totalCost', label: 'Subtotal Custo', kind: 'readonly', width: '140px', format: 'currency' },
      { key: 'totalSellPrice', label: 'Subtotal/Venda', kind: 'readonly', width: '140px', format: 'currency' }
    ];
  }, [operationType, isReformaRegimeSelected]);

  const abrirConfiguracoes = () => {
    setDraftSettings(deepClone(calculatorSettings));
    setSettingsTab('regimes');
    setShowSettingsModal(true);
  };

  const atualizarDraftCampo = (secao, campo, valor) => {
    setDraftSettings((prev) => ({
      ...prev,
      [secao]: {
        ...prev[secao],
        [campo]: valor
      }
    }));
  };

  const atualizarRegimeDraft = (regimeId, campo, valor) => {
    setDraftSettings((prev) => ({
      ...prev,
      regimesTributarios: prev.regimesTributarios.map((regime) => (
        regime.id === regimeId ? { ...regime, [campo]: valor } : regime
      ))
    }));
  };

  const atualizarIcmsUfDraft = (uf, valor) => {
    setDraftSettings((prev) => ({
      ...prev,
      icmsInterestadual: {
        ...prev.icmsInterestadual,
        aliquotasPorUf: {
          ...prev.icmsInterestadual.aliquotasPorUf,
          [uf]: valor
        }
      }
    }));
  };

  const atualizarMaoObraGrupoDraft = (grupo, campo, valor) => {
    setDraftSettings((prev) => ({
      ...prev,
      maoDeObra: {
        ...prev.maoDeObra,
        [grupo]: {
          ...prev.maoDeObra[grupo],
          [campo]: valor
        }
      }
    }));
  };

  const atualizarMaoObraGeralDraft = (campo, valor) => {
    setDraftSettings((prev) => ({
      ...prev,
      maoDeObra: {
        ...prev.maoDeObra,
        geral: {
          ...prev.maoDeObra.geral,
          [campo]: valor
        }
      }
    }));
  };

  const adicionarRegimeDraft = () => {
    setDraftSettings((prev) => ({
      ...prev,
      regimesTributarios: [
        ...prev.regimesTributarios,
        {
          id: `REGIME_${Date.now()}`,
          nome: 'Novo Regime',
          pis: 0,
          cofins: 0,
          csll: 0,
          irpj: 0,
          icms: 0,
          iss: 0,
          cbs: 0,
          ibs: 0,
          is: 0,
          iva: 0,
          usaReforma: false,
          basePresuncaoVenda: 8,
          basePresuncaoServico: 32,
          anexoI: 8,
          anexoIII: 11.2,
          ativo: false
        }
      ]
    }));
  };

  const removerRegimeDraft = (regimeId) => {
    setDraftSettings((prev) => {
      if (prev.regimesTributarios.length <= 1) return prev;
      const nextRegimes = prev.regimesTributarios.filter((regime) => regime.id !== regimeId);
      if (!nextRegimes.some((regime) => regime.ativo)) {
        nextRegimes[0].ativo = true;
      }
      return { ...prev, regimesTributarios: nextRegimes };
    });
  };

  const ativarRegimeDraft = (regimeId) => {
    setDraftSettings((prev) => ({
      ...prev,
      regimesTributarios: prev.regimesTributarios.map((regime) => ({
        ...regime,
        ativo: regime.id === regimeId
      }))
    }));
  };

  const salvarConfiguracoes = () => {
    const normalized = normalizeSettings(draftSettings);
    setCalculatorSettings(normalized);
    setDraftSettings(deepClone(normalized));
    const regimeAtivo = normalized.regimesTributarios.find((regime) => regime.ativo)?.id
      || normalized.regimesTributarios[0]?.id
      || 'LUCRO_PRESUMIDO';
    setVendasData((prev) => ({ ...prev, regimeTributario: regimeAtivo }));
    try {
      localStorage.setItem(CALCULATOR_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.error('Erro ao salvar configurações das calculadoras:', error);
    }
    setShowSettingsModal(false);
  };

  const createItemId = (prefix) => createEntityId(prefix);

  const updateOperationItem = (itemId, field, value) => {
    if (operationType === 'venda') {
      setSaleItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
      return;
    }
    if (operationType === 'locacao') {
      setRentalItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
      return;
    }
    setServiceItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
  };

  const removeOperationItem = (itemId) => {
    if (operationType === 'venda') {
      setSaleItems((prev) => prev.filter((item) => item.id !== itemId));
      return;
    }
    if (operationType === 'locacao') {
      setRentalItems((prev) => prev.filter((item) => item.id !== itemId));
      return;
    }
    setServiceItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const addOperationItem = () => {
    if (operationType === 'venda') {
      setSaleItems((prev) => ([
        ...prev,
        {
          ...DEFAULT_SALE_ITEM,
          id: createItemId('sale')
        }
      ]));
      return;
    }

    if (operationType === 'locacao') {
      setRentalItems((prev) => ([
        ...prev,
        {
          ...DEFAULT_RENTAL_ITEM,
          id: createItemId('rental')
        }
      ]));
      return;
    }

    setServiceItems((prev) => ([
      ...prev,
      {
        ...DEFAULT_SERVICE_ITEM,
        id: createItemId('service'),
        baseSalary: toNumber(calculatorSettings.maoDeObra?.geral?.salarioBase, 5000)
      }
    ]));
  };

  const resetForm = () => {
    const regimePadrao = calculatorSettings.regimesTributarios.find((regime) => regime.ativo)?.id
      || calculatorSettings.regimesTributarios[0]?.id
      || 'LUCRO_PRESUMIDO';

    setVendasData({ regimeTributario: regimePadrao });
    setSaleItems([{ ...DEFAULT_SALE_ITEM, id: createItemId('sale') }]);
    setRentalItems([{ ...DEFAULT_RENTAL_ITEM, id: createItemId('rental') }]);
    setServiceItems([{
      ...DEFAULT_SERVICE_ITEM,
      id: createItemId('service'),
      baseSalary: toNumber(calculatorSettings.maoDeObra?.geral?.salarioBase, 5000)
    }]);
    setRentalPeriod(12);
    setDesiredMargin(20);
    setIsIcmsContributor(false);
    setDestinationUF('SP');
    setDistributorCosts([]); // Limpar custos de distribuidores
    setCurrentBudget({
      distribuidorId: '',
      distribuidor: '',
      fornecedorId: '',
      fornecedor: '',
      numeroOrcamento: ''
    });
  };

  const normalizeOperationItems = (items, defaultItem, prefix) => {
    if (!Array.isArray(items) || items.length === 0) {
      return [{ ...defaultItem, id: createItemId(prefix) }];
    }

    return items.map((item) => ({
      ...defaultItem,
      ...item,
      id: item?.id || createItemId(prefix)
    }));
  };

  const persistSavedProposals = (proposals) => {
    const ordered = [...proposals].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setSavedProposals(ordered);
    try {
      localStorage.setItem(CALCULATOR_PROPOSALS_STORAGE_KEY, JSON.stringify(ordered));
    } catch (error) {
      console.error('Erro ao salvar propostas da calculadora:', error);
      try {
        sessionStorage.setItem(CALCULATOR_PROPOSALS_SESSION_KEY, JSON.stringify(ordered));
      } catch (sessionError) {
        console.error('Erro ao salvar propostas da calculadora em sessionStorage:', sessionError);
      }
    }
  };

  const createBlankProposal = (tabId = currentTab) => {
    setPreSalesSource(null);
    setShowCotacaoModal(false);
    resetForm();
    setCurrentTab(tabId);
    setCurrentCost({
      modalidade: modalidadeFromCalculatorType(tabId),
      item: '',
      quantidade: 1,
      custoUnitario: 0,
      observacoes: ''
    });
    const nextNumber = generateProposalNumber(savedProposals);
    const managerDefaults = getManagerDefaults();
    setProposalForm(buildProposalForm(nextNumber, managerDefaults));
    setProposalSearchNumber(nextNumber);
    setActiveProposalId(null);
    setProposalFeedback(null);
    setCalculatorStep('proposal');
    clearProposalCart();
    setShowModal(true);
  };

  const startNewProposal = async (tabId = currentTab) => {
    // Buscar cotações disponíveis
    setLoadingCotacoes(true);
    try {
      const response = await fetch(buildApiUrl('/pre-vendas?limit=100'), { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        const solicitacoes = Array.isArray(data?.solicitacoes) ? data.solicitacoes : [];
        
        // Filtrar solicitações que têm custos/cotações
        const comCotacoes = solicitacoes.filter((sol) => (
          getCotacoesFromSolicitacao(sol).length > 0 || getItemsFromSolicitacao(sol).length > 0
        ));
        
        setCotacoesDisponiveis(comCotacoes);
        
        // Se houver cotações, mostrar o modal. Senão, criar proposta vazia
        if (comCotacoes.length > 0) {
          setShowCotacaoModal(true);
        } else {
          createBlankProposal(tabId);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar cotações:', error);
      createBlankProposal(tabId);
    } finally {
      setLoadingCotacoes(false);
    }
  };

  const selecionarCotacao = (solicitacao) => {
    // Fechar modal de seleção
    setShowCotacaoModal(false);
    setPreSalesSource({
      id: solicitacao?.id || '',
      numero: solicitacao?.__matchedBudgetNumber || solicitacao?.numero || '',
      titulo: solicitacao?.titulo || '',
      origem: solicitacao
    });
    
    // Preparar dados da cotação
    const todosCustos = getCotacoesByModalidade(solicitacao);
    const todosItensCotacao = buildCotacaoItems(todosCustos);
    const todosItens = todosItensCotacao.length > 0 ? todosItensCotacao : getItemsFromSolicitacao(solicitacao);
    const custosCotacao = buildDistributorCostsFromCotacoes(todosCustos, solicitacao);
    const custosDistribuidores = custosCotacao.length > 0 ? custosCotacao : buildDistributorCostsFromSolicitacaoItems(solicitacao);
    
    // Determinar modalidade e tab correta
    const modalidadeItem = solicitacao.modalidade || 'VENDA';
    const targetTab = normalizeCalculatorTypeFromModalidade(modalidadeItem);
    
    // Resetar form e criar nova proposta
    resetForm();
    setCurrentTab(targetTab);
    const nextNumber = generateProposalNumber(savedProposals);
    const managerDefaults = getManagerDefaults();
    const proposalNumber = solicitacao.__matchedBudgetNumber || solicitacao.numero || nextNumber;
    const requestDetails = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
      ? solicitacao.calculoDetalhes
      : {};
    const proposalDetails = requestDetails.dadosProposta && typeof requestDetails.dadosProposta === 'object'
      ? requestDetails.dadosProposta
      : {};
    const primaryCotacao = todosCustos[0] || {};
    const primaryPartner = pickCotacaoPartner(primaryCotacao, proposalDetails);
    const distributorSelection = resolvePartnerSelection(
      preSalesDistributors,
      custosDistribuidores[0]?.distribuidorId || primaryPartner.distribuidorId,
      custosDistribuidores[0]?.distribuidor || primaryPartner.distribuidor
    );
    const supplierSelection = resolvePartnerSelection(
      preSalesSuppliers,
      custosDistribuidores[0]?.fornecedorId || primaryPartner.fornecedorId,
      custosDistribuidores[0]?.fornecedor || primaryPartner.fornecedor
    );
    const clientName = proposalDetails.clienteOrgao || solicitacao.nomeCliente || solicitacao.lead?.name || '';
    setProposalForm({
      ...buildProposalForm(proposalNumber, managerDefaults),
      number: proposalNumber,
      opportunityId: solicitacao?.opportunityId || solicitacao?.opportunity?.id || '',
      opportunityTitle: solicitacao?.opportunity?.title || '',
      clientCompany: clientName,
      clientContact: proposalDetails.contatoCliente || clientName,
      clientPhone: proposalDetails.telefoneCliente || '',
      clientEmail: proposalDetails.emailCliente || '',
      clientDocument: proposalDetails.cnpjDocumento || '',
      managerName: proposalDetails.gerenteConta || solicitacao?.solicitante?.name || managerDefaults.managerName || '',
      managerEmail: proposalDetails.emailGerente || solicitacao?.solicitante?.email || managerDefaults.managerEmail || '',
      managerPhone: proposalDetails.telefoneGerente || managerDefaults.managerPhone || '',
      premises: proposalDetails.premissasProposta || solicitacao.descricao || solicitacao.titulo || ''
    });
    setProposalSearchNumber(proposalNumber);
    setActiveProposalId(null);
    setProposalFeedback({
      type: 'success',
      text: `Cotação ${solicitacao.numero} carregada com ${todosItens.length} item(ns) e ${custosDistribuidores.length} custo(s).`
    });
    setCalculatorStep('proposal');
    clearProposalCart();
    setDistributorCosts(custosDistribuidores);
    setCurrentBudget({
      distribuidorId: distributorSelection.id,
      distribuidor: distributorSelection.name,
      fornecedorId: supplierSelection.id,
      fornecedor: supplierSelection.name,
      numeroOrcamento: solicitacao.__matchedBudgetNumber || custosDistribuidores[0]?.numeroOrcamento || solicitacao.numero || ''
    });
    setCurrentCost((prev) => ({
      ...prev,
      modalidade: custosDistribuidores[0]?.modalidade
        ? normalizeModalidadeKey(custosDistribuidores[0].modalidade)
        : modalidadeFromCalculatorType(targetTab),
      item: '',
      quantidade: 1,
      custoUnitario: 0,
      observacoes: ''
    }));
    
    // Mapear itens para o formato correto baseado na modalidade
    const mappedItems = mapQuotedItemsToOperationItems(todosItens, targetTab);
    if (targetTab === 'locacao') setRentalItems(mappedItems);
    else if (targetTab === 'servicos') setServiceItems(mappedItems);
    else setSaleItems(mappedItems);
  };

  const criarPropostaVazia = () => {
    createBlankProposal(currentTab);
  };

  const openBudgetQueueForSelection = async () => {
    setLoadingCotacoes(true);
    try {
      const response = await fetch(buildApiUrl('/pre-vendas?limit=500'), { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Falha ao carregar a Fila de Orçamentos');
      const data = await response.json();
      const solicitacoes = Array.isArray(data?.solicitacoes)
        ? data.solicitacoes
        : Array.isArray(data?.data) ? data.data
          : Array.isArray(data) ? data
            : [];
      const disponiveis = solicitacoes.filter((solicitacao) => (
        getCotacoesFromSolicitacao(solicitacao).length > 0 || getItemsFromSolicitacao(solicitacao).length > 0
      ));
      setCotacoesDisponiveis(disponiveis);
      setShowCotacaoModal(true);
      setProposalFeedback(null);
    } catch (error) {
      setProposalFeedback({ type: 'error', text: error.message || 'Erro ao carregar a Fila de Orçamentos.' });
    } finally {
      setLoadingCotacoes(false);
    }
  };

  // Handlers para Custos (Orçamentos de Distribuidores)
  const handleCostFieldChange = (field, value) => {
    setCurrentCost((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBudgetDistributorChange = (distribuidorId) => {
    if (distribuidorId === '__loaded_distributor') return;
    if (!distribuidorId) {
      setCurrentBudget((prev) => ({
        ...prev,
        distribuidorId: '',
        distribuidor: ''
      }));
      return;
    }
    const selected = preSalesDistributors.find((item) => item.id === distribuidorId);
    setCurrentBudget((prev) => ({
      ...prev,
      distribuidorId,
      distribuidor: selected?.nome || ''
    }));
  };

  const handleBudgetSupplierChange = (fornecedorId) => {
    if (fornecedorId === '__loaded_supplier') return;
    if (!fornecedorId) {
      setCurrentBudget((prev) => ({
        ...prev,
        fornecedorId: '',
        fornecedor: ''
      }));
      return;
    }
    const selected = preSalesSuppliers.find((item) => item.id === fornecedorId);
    setCurrentBudget((prev) => ({
      ...prev,
      fornecedorId,
      fornecedor: selected?.nome || ''
    }));
  };

  const handleAddDistributorCost = () => {
    // Validação básica
    if (!currentBudget.distribuidor.trim() && !currentBudget.fornecedor.trim()) {
      alert('Por favor, selecione o distribuidor ou fornecedor');
      return;
    }
    if (!currentBudget.numeroOrcamento.trim()) {
      alert('Por favor, preencha o número do orçamento');
      return;
    }
    if (!currentCost.item.trim()) {
      alert('Por favor, preencha o item/descrição');
      return;
    }
    if (currentCost.quantidade <= 0) {
      alert('Quantidade deve ser maior que zero');
      return;
    }
    if (currentCost.custoUnitario <= 0) {
      alert('Custo unitário deve ser maior que zero');
      return;
    }

    // Adicionar custo à lista
    const novoCusto = {
      ...currentCost,
      distribuidorId: currentBudget.distribuidorId,
      distribuidor: currentBudget.distribuidor,
      fornecedorId: currentBudget.fornecedorId,
      fornecedor: currentBudget.fornecedor,
      numeroOrcamento: currentBudget.numeroOrcamento,
      id: `cost_${Date.now()}`,
      data: new Date().toISOString()
    };
    
    setDistributorCosts((prev) => [...prev, novoCusto]);
    applyDistributorCostToCalculator(novoCusto);
    
    // Limpar formulário
    setCurrentCost({
      modalidade: normalizeModalidadeKey(currentCost.modalidade || (currentTab === 'locacao' ? 'LOCACAO' : currentTab === 'servicos' ? 'SERVICO' : 'VENDA')),
      item: '',
      quantidade: 1,
      custoUnitario: 0,
      observacoes: ''
    });

    // Feedback
    setProposalFeedback({
      type: 'success',
      text: 'Custo adicionado com sucesso!'
    });
    
    setTimeout(() => setProposalFeedback(null), 3000);
  };

  const applyDistributorCostToCalculator = (cost) => {
    const modalidade = normalizeModalidadeKey(cost?.modalidade || 'VENDA');
    const quantity = Math.max(1, toNumber(cost?.quantidade, 1));
    const unitCost = Math.max(0, toNumber(cost?.custoUnitario, 0));
    const description = cost?.item || '';

    if (modalidade === 'LOCACAO') {
      setCurrentTab('locacao');
      setRentalItems((prev) => {
        const base = prev.length > 0 ? prev : [{ ...DEFAULT_RENTAL_ITEM, id: createItemId('rental') }];
        return base.map((item, index) => (
          index === 0
            ? {
                ...item,
                description,
                quantity,
                assetValueBRL: unitCost
              }
            : item
        ));
      });
      return;
    }

    if (modalidade === 'SERVICO') {
      setCurrentTab('servicos');
      setServiceItems((prev) => {
        const base = prev.length > 0 ? prev : [{
          ...DEFAULT_SERVICE_ITEM,
          id: createItemId('service'),
          baseSalary: toNumber(calculatorSettings.maoDeObra?.geral?.salarioBase, 5000)
        }];
        return base.map((item, index) => (
          index === 0
            ? {
                ...item,
                description,
                estimatedHours: quantity,
                baseSalary: unitCost
              }
            : item
        ));
      });
      return;
    }

    setCurrentTab('vendas');
    setSaleItems((prev) => {
      const base = prev.length > 0 ? prev : [{ ...DEFAULT_SALE_ITEM, id: createItemId('sale') }];
      return base.map((item, index) => (
        index === 0
          ? {
              ...item,
              description,
              quantity,
              unitCost
            }
          : item
      ));
    });
  };

  const handleRemoveDistributorCost = (costId) => {
    setDistributorCosts((prev) => prev.filter((cost) => cost.id !== costId));
  };

  const openProposal = (proposal, { keepModalOpen = true } = {}) => {
    if (!proposal) return;

    const pricing = proposal.pricing || {};
    const snapshot = proposal.snapshot || {};

    // Resolve target tab: if calculatorType is unknown/mixed, detect from snapshot contents
    let targetTab = proposal.calculatorType || 'vendas';
    if (targetTab !== 'vendas' && targetTab !== 'locacao' && targetTab !== 'servicos') {
      const snapSales = Array.isArray(snapshot.saleItems) ? snapshot.saleItems.length : 0;
      const snapRentals = Array.isArray(snapshot.rentalItems) ? snapshot.rentalItems.length : 0;
      const snapServices = Array.isArray(snapshot.serviceItems) ? snapshot.serviceItems.length : 0;
      targetTab = snapSales > 0 ? 'vendas' : snapRentals > 0 ? 'locacao' : snapServices > 0 ? 'servicos' : 'vendas';
    }

    setCurrentTab(targetTab);
    setVendasData((prev) => ({ ...prev, regimeTributario: pricing.regimeId || regimeAtivoId }));
    setDesiredMargin(toNumber(pricing.desiredMargin, 20));
    setIsIcmsContributor(Boolean(pricing.isIcmsContributor));
    setDestinationUF(pricing.destinationUF || 'SP');
    setRentalPeriod(toNumber(pricing.rentalPeriod, 12));
    setSaleItems(normalizeOperationItems(snapshot.saleItems, DEFAULT_SALE_ITEM, 'sale'));
    setRentalItems(normalizeOperationItems(snapshot.rentalItems, DEFAULT_RENTAL_ITEM, 'rental'));
    setServiceItems(normalizeOperationItems(snapshot.serviceItems, DEFAULT_SERVICE_ITEM, 'service'));
    
    // NOVO: Carregar custos de distribuidores
    const loadedDistributorCosts = Array.isArray(proposal.distributorCosts) ? proposal.distributorCosts : [];
    setDistributorCosts(loadedDistributorCosts);
    setCurrentBudget({
      distribuidorId: loadedDistributorCosts[0]?.distribuidorId || '',
      distribuidor: loadedDistributorCosts[0]?.distribuidor || '',
      fornecedorId: loadedDistributorCosts[0]?.fornecedorId || '',
      fornecedor: loadedDistributorCosts[0]?.fornecedor || '',
      numeroOrcamento: loadedDistributorCosts[0]?.numeroOrcamento || ''
    });

    setProposalForm({
      number: proposal.number || '',
      opportunityId: proposal?.opportunity?.id || proposal.opportunityId || '',
      opportunityNumber: proposal?.opportunity?.number || proposal.opportunityNumber || '',
      opportunityTitle: proposal?.opportunity?.title || proposal.opportunityTitle || '',
      clientCompany: proposal?.client?.companyName || '',
      clientContact: proposal?.client?.contactName || '',
      clientPhone: proposal?.client?.phone || '',
      clientEmail: proposal?.client?.email || '',
      clientDocument: proposal?.client?.document || '', // NOVO
      managerName: proposal?.accountManager?.name || '',
      managerEmail: proposal?.accountManager?.email || '',
      managerPhone: proposal?.accountManager?.phone || '',
      premises: proposal?.premises || '' // NOVO
    });
    setProposalSearchNumber(proposal.number || '');
    setActiveProposalId(proposal.id || null);
    setProposalFeedback({
      type: 'success',
      text: `Proposta ${proposal.number} carregada.`
    });
    setCalculatorStep('calculation');

    if (keepModalOpen) {
      setShowModal(true);
    }
  };

  const buildCurrentProposalPayload = (proposalId, createdAtBase = null) => {
    const nowIso = new Date().toISOString();
    const proposalNumber = (proposalForm.number || '').trim() || generateProposalNumber(savedProposals);
    const linkedOpportunity = opportunities.find((item) => item.id === proposalForm.opportunityId);

    return {
      id: proposalId || createItemId('proposal'),
      number: proposalNumber,
      calculatorType: currentTab,
      calculatorLabel: currentTab === 'vendas' ? 'Venda' : currentTab === 'locacao' ? 'Locação' : 'Serviços',
      opportunity: {
        id: proposalForm.opportunityId || '',
        number: linkedOpportunity?.number || proposalForm.opportunityNumber || '',
        title: linkedOpportunity?.title || proposalForm.opportunityTitle || ''
      },
      client: {
        companyName: proposalForm.clientCompany.trim(),
        contactName: proposalForm.clientContact.trim(),
        phone: proposalForm.clientPhone.trim(),
        email: proposalForm.clientEmail.trim(),
        document: proposalForm.clientDocument?.trim() || '' // NOVO
      },
      accountManager: {
        name: proposalForm.managerName.trim(),
        email: proposalForm.managerEmail.trim(),
        phone: proposalForm.managerPhone.trim()
      },
      premises: proposalForm.premises?.trim() || '', // NOVO
      pricing: {
        operationType,
        regimeId: vendasData.regimeTributario,
        regimeName: calculationPreview.calculationResults.taxRegimeName,
        desiredMargin: toNumber(desiredMargin, 20),
        destinationUF,
        rentalPeriod: toNumber(rentalPeriod, 12),
        isIcmsContributor
      },
      snapshot: {
        saleItems: proposalCart.sales.length > 0
          ? deepClone(proposalCart.sales)
          : deepClone(saleItems).map(item => ({
            ...item,
            calculation: calculationPreview.calculationResults.itemCalculations?.[item.id] || item.calculation || {}
          })),
        rentalItems: proposalCart.rentals.length > 0
          ? deepClone(proposalCart.rentals)
          : deepClone(rentalItems).map(item => ({
            ...item,
            calculation: calculationPreview.calculationResults.itemCalculations?.[item.id] || item.calculation || {},
            pricing: { rentalPeriod: toNumber(rentalPeriod, 12) }
          })),
        serviceItems: proposalCart.services.length > 0
          ? deepClone(proposalCart.services)
          : deepClone(serviceItems).map(item => ({
            ...item,
            calculation: calculationPreview.calculationResults.itemCalculations?.[item.id] || item.calculation || {}
          }))
      },
      distributorCosts: deepClone(distributorCosts), // NOVO: Salvar custos de distribuidores
      preSales: preSalesSource?.id ? {
        requestId: preSalesSource.id,
        number: preSalesSource.numero || proposalNumber,
        title: preSalesSource.titulo || ''
      } : null,
      result: {
        finalPrice: toNumber(calculationPreview.calculationResults.finalPrice, 0),
        monthlyPrice: toNumber(calculationPreview.calculationResults.monthlyPrice, 0),
        baseCost: toNumber(calculationPreview.calculationResults.baseCost, 0),
        impostosValor: toNumber(calculationPreview.calculationResults.impostosValor, 0),
        margemEComissaoValor: toNumber(calculationPreview.calculationResults.margemEComissaoValor, 0)
      },
      createdAt: createdAtBase || nowIso,
      updatedAt: nowIso
    };
  };

  const saveCurrentProposal = ({ silent = false } = {}) => {
    const numberTyped = (proposalForm.number || '').trim();
    const existing = savedProposals.find((proposal) => proposal.id === activeProposalId)
      || savedProposals.find((proposal) => numberTyped && proposal.number === numberTyped);
    const payload = buildCurrentProposalPayload(existing?.id || createItemId('proposal'), existing?.createdAt || null);
    payload.client.companyName = payload.client.companyName || 'Cliente não informado';
    payload.client.contactName = payload.client.contactName || 'Contato não informado';

    const nextProposals = existing
      ? savedProposals.map((proposal) => (proposal.id === payload.id ? payload : proposal))
      : [payload, ...savedProposals];

    persistSavedProposals(nextProposals);
    setActiveProposalId(payload.id);
    setProposalForm((prev) => ({ ...prev, number: payload.number }));
    setProposalSearchNumber(payload.number);

    if (!silent) {
      setProposalFeedback({
        type: 'success',
        text: `Proposta ${payload.number} salva com sucesso.`
      });
    }

    return payload;
  };

  const sendProposalToPreSalesReview = async (proposal) => {
    const requestId = proposal?.preSales?.requestId || preSalesSource?.id;
    if (!requestId) return null;

    const currentResponse = await fetch(buildApiUrl(`/pre-vendas/${encodeURIComponent(requestId)}`), {
      headers: getAuthHeaders()
    });
    if (!currentResponse.ok) {
      const data = await currentResponse.json().catch(() => ({}));
      throw new Error(data?.message || data?.error || 'Não foi possível carregar a solicitação para revisão.');
    }

    const currentPayload = await currentResponse.json().catch(() => ({}));
    const currentRequest = currentPayload?.data && typeof currentPayload.data === 'object'
      ? currentPayload.data
      : currentPayload;
    const currentDetails = currentRequest?.calculoDetalhes && typeof currentRequest.calculoDetalhes === 'object'
      ? currentRequest.calculoDetalhes
      : {};
    const previousReviewed = Array.isArray(currentDetails.propostasPrecificadas)
      ? currentDetails.propostasPrecificadas
      : [];
    const nowIso = new Date().toISOString();
    const pricingSummary = {
      id: proposal.id,
      number: proposal.number,
      calculatorType: proposal.calculatorType,
      calculatorLabel: proposal.calculatorLabel,
      client: proposal.client,
      opportunity: proposal.opportunity,
      distributorCosts: proposal.distributorCosts,
      snapshot: proposal.snapshot,
      pricing: proposal.pricing,
      result: proposal.result,
      pdfAvailable: true,
      reviewStatus: 'AGUARDANDO_APROVACAO',
      reviewStage: 'REVISAO',
      sentToReviewAt: nowIso,
      updatedAt: proposal.updatedAt || nowIso
    };
    const previousNotes = String(currentRequest?.observacoes || '').trim();
    const reviewNote = [
      previousNotes,
      `[${new Date().toLocaleString('pt-BR')}] Pré-vendas: Precificação concluída e enviada para revisão.`,
      `Proposta: ${proposal.number}`,
      `Valor final: ${formatCurrency(proposal?.result?.finalPrice || 0)}`,
      proposal?.result?.monthlyPrice ? `Valor mensal: ${formatCurrency(proposal.result.monthlyPrice)}` : null,
      '[FLOW_STAGE:REVISAO]'
    ].filter(Boolean).join('\n\n');

    const updateResponse = await fetch(buildApiUrl(`/pre-vendas/${encodeURIComponent(requestId)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        status: 'AGUARDANDO_APROVACAO',
        valorSugerido: proposal?.result?.finalPrice || 0,
        custoTotal: proposal?.result?.baseCost || 0,
        margemLucro: proposal?.pricing?.desiredMargin || 0,
        observacoes: reviewNote,
        calculoDetalhes: {
          ...currentDetails,
          propostaPrecificada: pricingSummary,
          propostasPrecificadas: [pricingSummary, ...previousReviewed.filter((item) => item?.id !== proposal.id)]
        }
      })
    });

    if (!updateResponse.ok) {
      const data = await updateResponse.json().catch(() => ({}));
      throw new Error(data?.message || data?.error || 'Não foi possível enviar a precificação para revisão.');
    }

    return updateResponse.json().catch(() => null);
  };

  const finishPreSalesPricingFlow = async (proposal) => {
    if (!proposal?.preSales?.requestId && !preSalesSource?.id) return false;
    await sendProposalToPreSalesReview(proposal);
    closeCalculatorModal();
    setHomeFeedback(`Proposta ${proposal.number} enviada para revisão em Solicitações.`);
    navigate('/solicitacoes');
    return true;
  };

  // Funções do carrinho de propostas
  const addToProposalCart = () => {
    const itemCalcs = calculationPreview.calculationResults.itemCalculations || {};
    
    if (operationType === 'venda' && saleItems.length > 0) {
      const salesWithCalc = saleItems.map((item) => ({
        ...deepClone(item),
        calculation: {
          rbUnitario: toNumber(itemCalcs[item.id]?.rbUnitario, 0),
          marginComissaoValor: toNumber(itemCalcs[item.id]?.marginComissaoValor, 0),
          impostosValor: toNumber(itemCalcs[item.id]?.impostosValor, 0),
          difalVenda: toNumber(itemCalcs[item.id]?.difalVenda, 0)
        },
        pricing: {
          regimeId: vendasData.regimeTributario,
          regimeName: calculationPreview.calculationResults.taxRegimeName,
          desiredMargin: toNumber(desiredMargin, 20),
          destinationUF,
          isIcmsContributor
        }
      }));
      
      setProposalCart((prev) => ({
        ...prev,
        sales: [...prev.sales, ...salesWithCalc]
      }));
      
      setSaleItems([{ ...DEFAULT_SALE_ITEM, id: createEntityId('sale') }]);
      setProposalFeedback({
        type: 'success',
        text: `${salesWithCalc.length} item(ns) de venda adicionado(s) à proposta.`
      });
    } else if (operationType === 'locacao' && rentalItems.length > 0) {
      const rentalsWithCalc = rentalItems.map((item) => ({
        ...deepClone(item),
        calculation: {
          monthlyCost: toNumber(itemCalcs[item.id]?.monthlyCost, 0),
          totalAssetCost: toNumber(itemCalcs[item.id]?.totalAssetCost, 0),
          rbUnitario: toNumber(itemCalcs[item.id]?.rbUnitario, 0),
          marginComissaoValor: toNumber(itemCalcs[item.id]?.marginComissaoValor, 0),
          impostosValor: toNumber(itemCalcs[item.id]?.impostosValor, 0),
          difal: toNumber(itemCalcs[item.id]?.difal, 0)
        },
        pricing: {
          regimeId: vendasData.regimeTributario,
          regimeName: calculationPreview.calculationResults.taxRegimeName,
          rentalPeriod: toNumber(rentalPeriod, 12),
          desiredMargin: toNumber(desiredMargin, 20)
        }
      }));
      
      setProposalCart((prev) => ({
        ...prev,
        rentals: [...prev.rentals, ...rentalsWithCalc]
      }));
      
      setRentalItems([{ ...DEFAULT_RENTAL_ITEM, id: createEntityId('rental') }]);
      setProposalFeedback({
        type: 'success',
        text: `${rentalsWithCalc.length} item(ns) de locação adicionado(s) à proposta.`
      });
    } else if (operationType === 'servicos' && serviceItems.length > 0) {
      const servicesWithCalc = serviceItems.map((item) => ({
        ...deepClone(item),
        calculation: {
          hourlyCost: toNumber(itemCalcs[item.id]?.hourlyCost, 0),
          sellPricePerHour: toNumber(itemCalcs[item.id]?.sellPricePerHour, 0),
          totalCost: toNumber(itemCalcs[item.id]?.totalCost, 0),
          totalSellPrice: toNumber(itemCalcs[item.id]?.totalSellPrice, 0)
        },
        pricing: {
          regimeId: vendasData.regimeTributario,
          regimeName: calculationPreview.calculationResults.taxRegimeName,
          desiredMargin: toNumber(desiredMargin, 20)
        }
      }));
      
      setProposalCart((prev) => ({
        ...prev,
        services: [...prev.services, ...servicesWithCalc]
      }));
      
      setServiceItems([{ ...DEFAULT_SERVICE_ITEM, id: createEntityId('service') }]);
      setProposalFeedback({
        type: 'success',
        text: `${servicesWithCalc.length} item(ns) de serviço adicionado(s) à proposta.`
      });
    }
  };

  const removeFromProposalCart = (type, itemId) => {
    setProposalCart((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== itemId)
    }));
  };

  const clearProposalCart = () => {
    setProposalCart({
      sales: [],
      rentals: [],
      services: []
    });
  };

  const getTotalCartItems = () => {
    return proposalCart.sales.length + proposalCart.rentals.length + proposalCart.services.length;
  };

  const saveProposalWithCart = () => {
    if (getTotalCartItems() === 0) {
      setProposalFeedback({
        type: 'error',
        text: 'Adicione pelo menos um item à proposta antes de salvar.'
      });
      return;
    }

    const numberTyped = (proposalForm.number || '').trim();
    const existing = savedProposals.find((proposal) => proposal.id === activeProposalId)
      || savedProposals.find((proposal) => numberTyped && proposal.number === numberTyped);
    
    const nowIso = new Date().toISOString();
    const proposalNumber = (proposalForm.number || '').trim() || generateProposalNumber(savedProposals);
    const linkedOpportunity = opportunities.find((item) => item.id === proposalForm.opportunityId);

    // Calcular totais consolidados
    let totalFinalPrice = 0;
    let totalMonthlyPrice = 0;
    let totalBaseCost = 0;
    let totalImpostos = 0;
    let totalMargemComissao = 0;

    proposalCart.sales.forEach((item) => {
      const qty = toNumber(item.quantity, 0);
      totalFinalPrice += toNumber(item.calculation?.rbUnitario, 0) * qty;
      totalBaseCost += toNumber(item.unitCost, 0) * qty;
      totalImpostos += toNumber(item.calculation?.impostosValor, 0) * qty;
      totalMargemComissao += toNumber(item.calculation?.marginComissaoValor, 0) * qty;
    });

    proposalCart.rentals.forEach((item) => {
      const qty = toNumber(item.quantity, 0);
      const monthlyRevenue = toNumber(item.calculation?.rbUnitario, 0) * qty;
      const period = toNumber(item.pricing?.rentalPeriod, 12);
      totalMonthlyPrice += monthlyRevenue;
      totalFinalPrice += monthlyRevenue * period;
      totalBaseCost += toNumber(item.calculation?.monthlyCost, 0) * qty * period;
      totalImpostos += toNumber(item.calculation?.impostosValor, 0) * qty;
      totalMargemComissao += toNumber(item.calculation?.marginComissaoValor, 0) * qty;
    });

    proposalCart.services.forEach((item) => {
      totalFinalPrice += toNumber(item.calculation?.totalSellPrice, 0);
      totalBaseCost += toNumber(item.calculation?.totalCost, 0);
      const sellPrice = toNumber(item.calculation?.totalSellPrice, 0);
      const cost = toNumber(item.calculation?.totalCost, 0);
      totalMargemComissao += (sellPrice - cost) * 0.7; // Aproximação
      totalImpostos += (sellPrice - cost) * 0.3; // Aproximação
    });

    // Determine calculatorType from actual cart contents
    const hasSales = proposalCart.sales.length > 0;
    const hasRentals = proposalCart.rentals.length > 0;
    const hasServices = proposalCart.services.length > 0;
    const nonMixedCount = [hasSales, hasRentals, hasServices].filter(Boolean).length;
    const calcType = nonMixedCount === 1
      ? (hasSales ? 'vendas' : hasRentals ? 'locacao' : 'servicos')
      : 'mixed';
    const calcLabel = calcType === 'vendas' ? 'Venda'
      : calcType === 'locacao' ? 'Locação'
        : calcType === 'servicos' ? 'Serviços'
          : 'Proposta Mista';

    const payload = {
      id: existing?.id || createItemId('proposal'),
      number: proposalNumber,
      calculatorType: calcType,
      calculatorLabel: calcLabel,
      opportunity: {
        id: proposalForm.opportunityId || '',
        number: linkedOpportunity?.number || proposalForm.opportunityNumber || '',
        title: linkedOpportunity?.title || proposalForm.opportunityTitle || ''
      },
      client: {
        companyName: proposalForm.clientCompany.trim() || 'Cliente não informado',
        contactName: proposalForm.clientContact.trim() || 'Contato não informado',
        phone: proposalForm.clientPhone.trim(),
        email: proposalForm.clientEmail.trim(),
        document: proposalForm.clientDocument?.trim() || ''
      },
      accountManager: {
        name: proposalForm.managerName.trim(),
        email: proposalForm.managerEmail.trim(),
        phone: proposalForm.managerPhone.trim()
      },
      premises: proposalForm.premises?.trim() || '',
      pricing: {
        operationType: calcType === 'vendas' ? 'venda' : calcType === 'locacao' ? 'locacao' : calcType === 'servicos' ? 'servicos' : 'mixed',
        regimeId: vendasData.regimeTributario,
        regimeName: calculationPreview.calculationResults.taxRegimeName,
        desiredMargin: toNumber(desiredMargin, 20),
        destinationUF,
        rentalPeriod: toNumber(rentalPeriod, 12),
        isIcmsContributor
      },
      snapshot: {
        saleItems: deepClone(proposalCart.sales),
        rentalItems: deepClone(proposalCart.rentals),
        serviceItems: deepClone(proposalCart.services)
      },
      distributorCosts: deepClone(distributorCosts),
      preSales: preSalesSource?.id ? {
        requestId: preSalesSource.id,
        number: preSalesSource.numero || proposalNumber,
        title: preSalesSource.titulo || ''
      } : null,
      result: {
        finalPrice: totalFinalPrice,
        monthlyPrice: totalMonthlyPrice,
        baseCost: totalBaseCost,
        impostosValor: totalImpostos,
        margemEComissaoValor: totalMargemComissao
      },
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso
    };

    const nextProposals = existing
      ? savedProposals.map((proposal) => (proposal.id === payload.id ? payload : proposal))
      : [payload, ...savedProposals];

    persistSavedProposals(nextProposals);
    setActiveProposalId(payload.id);
    setProposalForm((prev) => ({ ...prev, number: payload.number }));
    setProposalSearchNumber(payload.number);
    
    clearProposalCart();
    
    setProposalFeedback({
      type: 'success',
      text: `Proposta ${payload.number} salva com sucesso com ${getTotalCartItems()} itens.`
    });

    return payload;
  };

  const handleSaveProposalWithCart = async () => {
    const saved = saveProposalWithCart();
    if (!saved) return;
    try {
      const sentToReview = await finishPreSalesPricingFlow(saved);
      if (sentToReview) return;
    } catch (error) {
      setProposalFeedback({
        type: 'error',
        text: error.message || 'Proposta salva, mas não foi possível enviar para revisão.'
      });
      return;
    }
    closeCalculatorModal();
    setHomeFeedback('Proposta salva com sucesso');
  };

  const searchBudgetByNumber = async (number, options = {}) => {
    const normalizedNumber = (number || '').trim().toUpperCase();
    if (!normalizedNumber) {
      await openBudgetQueueForSelection();
      return false;
    }

    try {
      setLoadingCotacoes(true);
      const budgetRequest = await findBudgetRequestByNumber(normalizedNumber);
      if (budgetRequest) {
        selecionarCotacao(budgetRequest);
        return true;
      }
      if (!options.silentNotFound) {
        setProposalFeedback({ type: 'error', text: `Orçamento ${normalizedNumber} não encontrado no módulo Orçamentos.` });
      }
    } catch (error) {
      if (!options.silentNotFound) {
        setProposalFeedback({ type: 'error', text: error.message || 'Erro ao buscar orçamento no módulo Orçamentos.' });
      }
    } finally {
      setLoadingCotacoes(false);
    }
    return false;
  };

  const searchProposalByNumber = async () => {
    const normalizedNumber = (proposalSearchNumber || '').trim().toUpperCase();
    if (!normalizedNumber) {
      setProposalFeedback({ type: 'error', text: 'Informe o número da proposta para buscar.' });
      return;
    }

    const found = savedProposals.find((proposal) => String(proposal.number || '').toUpperCase() === normalizedNumber);
    if (!found) {
      await searchBudgetByNumber(normalizedNumber);
      return;
    }
    openProposal(found, { keepModalOpen: true });
  };

  const openProposalPreview = (proposal) => {
    if (!proposal) return;
    setPreviewProposal(proposal);
    setShowPreviewModal(true);
  };

  const closeProposalPreview = () => {
    setShowPreviewModal(false);
    setPreviewProposal(null);
  };

  const getProposalItemSummary = (proposal) => {
    const sales = proposal?.snapshot?.saleItems?.length || 0;
    const rentals = proposal?.snapshot?.rentalItems?.length || 0;
    const services = proposal?.snapshot?.serviceItems?.length || 0;
    return {
      sales,
      rentals,
      services,
      total: sales + rentals + services
    };
  };

  const getSaleItemMetrics = (item) => {
    const qty = Math.max(0, toNumber(item?.quantity, 0));
    const unitCost = toNumber(item?.unitCost, 0);
    const unitSell = toNumber(item?.calculation?.rbUnitario, 0);
    const total = unitSell > 0 ? unitSell * qty : unitCost * qty;
    return {
      qty,
      unitCost,
      unitSell,
      total
    };
  };

  const getRentalItemMetrics = (item) => {
    const qty = Math.max(0, toNumber(item?.quantity, 0));
    const assetValue = toNumber(item?.assetValueBRL, 0);
    const monthly = toNumber(item?.calculation?.rbUnitario, 0);
    const period = Math.max(0, toNumber(item?.pricing?.rentalPeriod, toNumber(item?.rentalPeriod, 0)));
    const total = monthly > 0 && period > 0 ? monthly * period * qty : 0;
    return {
      qty,
      assetValue,
      monthly,
      period,
      total
    };
  };

  const getServiceItemMetrics = (item) => {
    const hours = Math.max(0, toNumber(item?.estimatedHours, 0));
    const baseSalary = toNumber(item?.baseSalary, 0);
    const priceHour = toNumber(item?.calculation?.sellPricePerHour, 0);
    const total = toNumber(item?.calculation?.totalSellPrice, 0);
    return {
      hours,
      baseSalary,
      priceHour,
      total
    };
  };

  const generateProposalSummary = () => {
    const saved = saveCurrentProposal({ silent: true });
    if (!saved) return;

    const lines = [
      `Proposta: ${saved.number}`,
      `Calculadora: ${saved.calculatorLabel}`,
      `Data: ${formatDateTime(saved.updatedAt)}`,
      '',
      'Dados do Cliente',
      `Empresa: ${saved.client.companyName || '-'}`,
      `Contato: ${saved.client.contactName || '-'}`,
      `Telefone: ${saved.client.phone || '-'}`,
      `E-mail: ${saved.client.email || '-'}`,
      '',
      'Dados do Gerente',
      `Nome: ${saved.accountManager.name || '-'}`,
      `Telefone: ${saved.accountManager.phone || '-'}`,
      `E-mail: ${saved.accountManager.email || '-'}`,
      '',
      'Resultado',
      `Preço Final: ${formatCurrency(saved.result.finalPrice)}`,
      `Preço Mensal: ${formatCurrency(saved.result.monthlyPrice)}`,
      `Custo Base: ${formatCurrency(saved.result.baseCost)}`,
      `Margem+Comissão: ${formatCurrency(saved.result.margemEComissaoValor)}`,
      `Impostos: ${formatCurrency(saved.result.impostosValor)}`
    ];

    try {
      const file = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = `proposta-${saved.number.replace('/', '-')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      setProposalFeedback({
        type: 'success',
        text: `Resumo da proposta ${saved.number} gerado em arquivo .txt.`
      });
    } catch (error) {
      console.error('Erro ao gerar resumo da proposta:', error);
      setProposalFeedback({
        type: 'error',
        text: 'Não foi possível gerar o arquivo de proposta.'
      });
    }
  };

  const continueToCalculator = () => {
    const requiredFields = [
      proposalForm.clientCompany,
      proposalForm.clientDocument,
      proposalForm.clientContact,
      proposalForm.clientEmail,
      proposalForm.managerName,
      proposalForm.managerEmail,
      proposalForm.managerPhone,
      proposalForm.premises
    ];
    const hasMissingFields = requiredFields.some((value) => !String(value || '').trim());

    if (hasMissingFields) {
      setProposalFeedback({
        type: 'error',
        text: 'Preencha todos os dados da proposta antes de continuar para as calculadoras.'
      });
      return;
    }
    setProposalFeedback(null);
    setCalculatorStep('calculation');
  };

  const handleProposalOpportunityChange = (opportunityId) => {
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    const primaryContact = Array.isArray(opportunity?.company?.contacts) ? opportunity.company.contacts[0] : null;
    setProposalForm((prev) => ({
      ...prev,
      opportunityId,
      opportunityNumber: opportunity?.number || '',
      opportunityTitle: opportunity?.title || '',
      clientCompany: prev.clientCompany || opportunity?.company?.name || '',
      clientContact: prev.clientContact || primaryContact?.name || '',
      clientPhone: prev.clientPhone || primaryContact?.phone || '',
      clientEmail: prev.clientEmail || primaryContact?.email || ''
    }));
  };

  const abrirCalculadora = (tipo) => {
    createBlankProposal(tipo);
    setHomeFeedback(null);
  };

  const closeCalculatorModal = () => {
    setShowModal(false);
    setActiveProposalId(null);
    setProposalFeedback(null);
    setPreSalesSource(null);
    setCalculatorStep('proposal');
    clearProposalCart();
    resetForm();
  };

  const handleSaveAndReturnHome = async () => {
    const saved = saveCurrentProposal();
    if (!saved) return;
    try {
      const sentToReview = await finishPreSalesPricingFlow(saved);
      if (sentToReview) return;
    } catch (error) {
      setProposalFeedback({
        type: 'error',
        text: error.message || 'Proposta salva, mas não foi possível enviar para revisão.'
      });
      return;
    }
    closeCalculatorModal();
    setHomeFeedback('Proposta Salva com sucesso');
  };

  const handleGenerateProposalPdf = (proposal) => {
    if (!proposal) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setHomeFeedback('Não foi possível abrir a janela para gerar PDF. Libere pop-ups e tente novamente.');
      return;
    }

    const snapSaleItems = proposal?.snapshot?.saleItems || [];
    const snapRentalItems = proposal?.snapshot?.rentalItems || [];
    const snapServiceItems = proposal?.snapshot?.serviceItems || [];
    const itemCount = snapSaleItems.length + snapRentalItems.length + snapServiceItems.length;
    const rentalPeriodSaved = toNumber(proposal?.pricing?.rentalPeriod, 12);
    const escRow = (v) => escapeHtml(String(v ?? '-'));
    const cur = (v) => escapeHtml(formatCurrency(toNumber(v, 0)));

    const distributorCostsData = Array.isArray(proposal?.distributorCosts) ? proposal.distributorCosts : [];
    const distributorRows = distributorCostsData.map((dc, i) => {
      const qty = Math.max(0, toNumber(dc?.quantidade, 0));
      const unitCost = toNumber(dc?.custoUnitario, 0);
      return `<tr>
        <td>${escRow(dc.distribuidor || '-')}</td>
        <td>${escRow(dc.fornecedor || '-')}</td>
        <td>${escRow(dc.numeroOrcamento)}</td>
        <td>${escRow(dc.modalidade)}</td>
        <td>${escRow(dc.item)}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">${cur(unitCost)}</td>
        <td style="text-align:right">${cur(qty * unitCost)}</td>
      </tr>`;
    }).join('');

    const saleRows = snapSaleItems.map(item => {
      const qty = Math.max(0, toNumber(item?.quantity, 0));
      const unitSell = toNumber(item?.calculation?.rbUnitario, 0);
      const unitCost = toNumber(item?.unitCost, 0);
      const unit = unitSell > 0 ? unitSell : unitCost;
      return `<tr>
        <td>${escRow(item.description)}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">${cur(unit)}</td>
        <td style="text-align:right">${cur(unit * qty)}</td>
      </tr>`;
    }).join('');

    const rentalRows = snapRentalItems.map(item => {
      const qty = Math.max(0, toNumber(item?.quantity, 0));
      const monthly = toNumber(item?.calculation?.rbUnitario, 0);
      const p = Math.max(0, toNumber(item?.pricing?.rentalPeriod, rentalPeriodSaved));
      const total = monthly > 0 && p > 0 ? monthly * p * qty : 0;
      return `<tr>
        <td>${escRow(item.description)}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">${cur(monthly)}</td>
        <td style="text-align:center">${p}</td>
        <td style="text-align:right">${cur(total)}</td>
      </tr>`;
    }).join('');

    const serviceRows = snapServiceItems.map(item => {
      const hours = Math.max(0, toNumber(item?.estimatedHours, 0));
      const priceHour = toNumber(item?.calculation?.sellPricePerHour, 0);
      const total = toNumber(item?.calculation?.totalSellPrice, 0);
      return `<tr>
        <td>${escRow(item.description)}</td>
        <td style="text-align:center">${hours}h</td>
        <td style="text-align:right">${cur(priceHour)}</td>
        <td style="text-align:right">${cur(total)}</td>
      </tr>`;
    }).join('');

    const itemsHtml = [
      snapSaleItems.length > 0 ? `
        <section class="items-section">
          <h3>Itens — Venda</h3>
          <table><thead><tr>
            <th style="text-align:left">Descrição</th>
            <th style="text-align:center">Qtd</th>
            <th style="text-align:right">Preço Unit.</th>
            <th style="text-align:right">Total</th>
          </tr></thead><tbody>${saleRows}</tbody></table>
        </section>` : '',
      snapRentalItems.length > 0 ? `
        <section class="items-section">
          <h3>Itens — Locação</h3>
          <table><thead><tr>
            <th style="text-align:left">Descrição</th>
            <th style="text-align:center">Qtd</th>
            <th style="text-align:right">Mensal</th>
            <th style="text-align:center">Período</th>
            <th style="text-align:right">Total</th>
          </tr></thead><tbody>${rentalRows}</tbody></table>
        </section>` : '',
      snapServiceItems.length > 0 ? `
        <section class="items-section">
          <h3>Itens — Serviços</h3>
          <table><thead><tr>
            <th style="text-align:left">Descrição</th>
            <th style="text-align:center">Horas</th>
            <th style="text-align:right">Preço/Hora</th>
            <th style="text-align:right">Total</th>
          </tr></thead><tbody>${serviceRows}</tbody></table>
        </section>` : ''
    ].filter(Boolean).join('');

    const html = `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Proposta ${escapeHtml(proposal.number || '')}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 24px;
            color: #0f172a;
            background: #ffffff;
          }
          .header {
            border-bottom: 2px solid #1d4ed8;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 26px;
            font-weight: 700;
            margin: 0;
            color: #1d4ed8;
          }
          .subtitle {
            margin-top: 6px;
            color: #475569;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }
          .card {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px;
          }
          .card h3 {
            margin: 0 0 8px;
            color: #1e40af;
            font-size: 16px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin: 6px 0;
            font-size: 14px;
          }
          .label { color: #334155; }
          .value {
            color: #0f172a;
            font-weight: 600;
            text-align: right;
            white-space: nowrap;
          }
          .summary {
            border: 1px solid #93c5fd;
            background: #eff6ff;
            border-radius: 10px;
            padding: 12px;
            margin-top: 8px;
          }
          .summary h3 {
            margin: 0 0 8px;
            color: #1e40af;
          }
          .items-section {
            margin-top: 16px;
          }
          .items-section h3,
          .distributor-section h3 {
            margin: 0 0 8px;
            color: #1e40af;
            font-size: 16px;
          }
          .distributor-section {
            margin-top: 16px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background: #1d4ed8;
            color: #fff;
            padding: 8px 10px;
            font-weight: 600;
          }
          td {
            padding: 7px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          tr:nth-child(even) td { background: #f8fafc; }
          .footer {
            margin-top: 24px;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
          }
          @media print {
            body { margin: 12mm; }
          }
        </style>
        <script>
          (function () {
            function triggerPrint() {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 500);
            }

            if (document.readyState === 'complete') {
              triggerPrint();
            } else {
              window.addEventListener('load', triggerPrint, { once: true });
            }
          })();
        </script>
      </head>
      <body>
        <section class="header">
          <h1 class="title">Proposta Comercial</h1>
          <div class="subtitle">
            Nº ${escapeHtml(proposal.number || '-')} · ${escapeHtml(proposal.calculatorLabel || '-')} · Atualizada em ${escapeHtml(formatDateTime(proposal.updatedAt))}
          </div>
        </section>

        <section class="grid">
          <article class="card">
            <h3>Dados do Cliente</h3>
            <div class="row"><span class="label">Empresa</span><span class="value">${escapeHtml(proposal?.client?.companyName || '-')}</span></div>
            <div class="row"><span class="label">Contato</span><span class="value">${escapeHtml(proposal?.client?.contactName || '-')}</span></div>
            <div class="row"><span class="label">Telefone</span><span class="value">${escapeHtml(proposal?.client?.phone || '-')}</span></div>
            <div class="row"><span class="label">E-mail</span><span class="value">${escapeHtml(proposal?.client?.email || '-')}</span></div>
          </article>

          <article class="card">
            <h3>Dados do Gerente</h3>
            <div class="row"><span class="label">Nome</span><span class="value">${escapeHtml(proposal?.accountManager?.name || '-')}</span></div>
            <div class="row"><span class="label">Telefone</span><span class="value">${escapeHtml(proposal?.accountManager?.phone || '-')}</span></div>
            <div class="row"><span class="label">E-mail</span><span class="value">${escapeHtml(proposal?.accountManager?.email || '-')}</span></div>
            <div class="row"><span class="label">Regime</span><span class="value">${escapeHtml(proposal?.pricing?.regimeName || '-')}</span></div>
          </article>
        </section>

        ${distributorCostsData.length > 0 ? `
        <section class="distributor-section">
          <h3>Custos de Distribuidores e Fornecedores</h3>
          <table>
            <thead><tr>
              <th style="text-align:left">Distribuidor</th>
              <th style="text-align:left">Fornecedor</th>
              <th style="text-align:left">Nº Orçamento</th>
              <th style="text-align:left">Modalidade</th>
              <th style="text-align:left">Item</th>
              <th style="text-align:center">Qtde</th>
              <th style="text-align:right">Custo Unit.</th>
              <th style="text-align:right">Total</th>
            </tr></thead>
            <tbody>${distributorRows}</tbody>
          </table>
        </section>` : ''}

        <section class="summary">
          <h3>Resumo Financeiro</h3>
          <div class="row"><span class="label">Itens na proposta</span><span class="value">${escapeHtml(String(itemCount))}</span></div>
          <div class="row"><span class="label">Preço Final</span><span class="value">${escapeHtml(formatCurrency(toNumber(proposal?.result?.finalPrice, 0)))}</span></div>
          ${toNumber(proposal?.result?.monthlyPrice, 0) > 0 ? `<div class="row"><span class="label">Preço Mensal</span><span class="value">${escapeHtml(formatCurrency(toNumber(proposal?.result?.monthlyPrice, 0)))}</span></div>` : ''}
        </section>

        ${itemsHtml}

        <section class="footer">
          Documento gerado pelo módulo de Calculadoras.
        </section>
      </body>
      </html>
    `;

    const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(htmlBlob);
    printWindow.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const totalEncargosDraft = useMemo(() => Object.values(draftSettings.maoDeObra?.encargos || {})
    .reduce((acc, value) => acc + toNumber(value, 0), 0), [draftSettings]);

  const totalBeneficiosDraft = useMemo(() => Object.values(draftSettings.maoDeObra?.beneficios || {})
    .reduce((acc, value) => acc + toNumber(value, 0), 0), [draftSettings]);

  const custoHoraDraft = useMemo(() => {
    const salarioBase = toNumber(draftSettings.maoDeObra?.geral?.salarioBase, 0);
    const diasUteis = Math.max(1, toNumber(draftSettings.maoDeObra?.geral?.diasUteis, 21));
    const horasDia = Math.max(1, toNumber(draftSettings.maoDeObra?.geral?.horasDia, 8));
    return (salarioBase + (salarioBase * (totalEncargosDraft / 100)) + totalBeneficiosDraft) / (diasUteis * horasDia);
  }, [draftSettings, totalEncargosDraft, totalBeneficiosDraft]);

  const valorVendaHoraDraft = useMemo(() => {
    const despesasRate = (toNumber(draftSettings.custosDespesas?.despesasAdmin, 0) + toNumber(draftSettings.custosDespesas?.outrasDespesas, 0)) / 100;
    const comissaoRate = toNumber(draftSettings.custosDespesas?.comissaoServico, 0) / 100;
    const margemRate = toNumber(draftSettings.custosDespesas?.margemLucroServico, 0) / 100;
    const divisor = 1 - despesasRate - comissaoRate - margemRate;
    return divisor > 0 ? custoHoraDraft / divisor : 0;
  }, [draftSettings, custoHoraDraft]);

  const renderCell = (item, column) => {
    const calc = calculationPreview.calculationResults.itemCalculations?.[item.id] || {};

    if (column.kind === 'readonly') {
      const rawValue = column.value ? column.value(item, calc) : calc[column.key];
      let display = rawValue;
      if (column.format === 'currency') display = formatCurrency(toNumber(rawValue, 0));
      if (column.format === 'percent') display = formatPercent(toNumber(rawValue, 0));
      return <span className="text-slate-100 whitespace-nowrap">{display ?? '-'}</span>;
    }

    if (column.kind === 'checkbox') {
      return (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={Boolean(item[column.key])}
            onChange={(event) => updateOperationItem(item.id, column.key, event.target.checked)}
            className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-blue-500"
          />
        </div>
      );
    }

    if (column.kind === 'select') {
      return (
        <select
          value={item[column.key] ?? ''}
          onChange={(event) => updateOperationItem(item.id, column.key, event.target.value)}
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
        >
          {(column.options || []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    const inputType = column.kind === 'number' ? 'number' : 'text';
    return (
      <input
        type={inputType}
        step={column.step || '0.01'}
        value={item[column.key] ?? ''}
        onChange={(event) => {
          if (column.kind === 'number') {
            updateOperationItem(item.id, column.key, parseFloat(event.target.value) || 0);
            return;
          }
          updateOperationItem(item.id, column.key, event.target.value);
        }}
        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
      />
    );
  };

  const activeCalcLabel = currentTab === 'vendas' ? 'Venda' : currentTab === 'locacao' ? 'Locação' : 'Serviços';
  const headerActions = showPricingActions
    ? [
        {
          label: 'Ratear Produtos',
          icon: Calculator,
          onClick: () => { window.location.href = '/ratear-produtos'; }
        },
        {
          label: 'Configurações Gerais e Tributárias',
          icon: SlidersHorizontal,
          onClick: abrirConfiguracoes
        }
      ]
    : [
        {
          label: 'Configurações',
          icon: SlidersHorizontal,
          onClick: abrirConfiguracoes
        }
      ];

  return (
    <div className="precificacao-module space-y-6 text-[var(--crm-ink)]">
      <div>
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          icon={Calculator}
          gradient="blue"
          breadcrumbs={breadcrumbs}
          actions={headerActions}
        />
      </div>

      <div className="p-6 space-y-6">
        {homeFeedback ? (
          <div className="rounded-lg border border-emerald-400/60 bg-emerald-500/15 px-4 py-3 text-emerald-100 flex items-center justify-between gap-3">
            <span>{homeFeedback}</span>
            <button
              type="button"
              onClick={() => setHomeFeedback(null)}
              className="text-emerald-100/90 hover:text-white text-sm"
            >
              Fechar
            </button>
          </div>
        ) : null}

        <section className="crm-panel p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[var(--crm-ink)]">Controle da proposta</h2>
              <p className="text-sm text-[var(--crm-muted)]">Crie, localize e salve simulações de venda, locação e serviços.</p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-cyan-300/35 bg-gradient-to-br from-cyan-500/15 via-teal-500/10 to-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-[var(--crm-ink)] shadow-inner shadow-cyan-300/10">
              Regime ativo: <span className="ml-1 text-cyan-100">{regimeAtivoHeader?.nome || 'Não definido'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_auto] 2xl:items-end">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(180px,260px)_minmax(260px,1fr)]">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-1">Nº Proposta</label>
                <input
                  type="text"
                  value={draftProposalNumber}
                  readOnly
                  className="crm-input h-12 px-4 text-base font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-1">Propostas Salvas</label>
                <select
                  value=""
                  onChange={(event) => {
                    const proposal = savedProposals.find((item) => item.id === event.target.value);
                    if (proposal) openProposal(proposal, { keepModalOpen: true });
                  }}
                  className="crm-input h-12 px-4 text-base"
                >
                  <option value="">Selecione uma proposta salva</option>
                  {savedProposals.map((proposal) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposal.number} - {proposal?.client?.companyName || 'Sem cliente'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 2xl:min-w-[520px]">
              <button
                type="button"
                onClick={() => {
                  createBlankProposal(currentTab);
                  setHomeFeedback(null);
                }}
                className="crm-btn crm-btn-secondary h-12"
              >
                <FilePlus2 className="w-4 h-4" />
                Nova
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModal(true);
                  searchProposalByNumber();
                }}
                className="crm-btn crm-btn-secondary h-12"
              >
                <Search className="w-4 h-4" />
                Buscar
              </button>
              <button
                type="button"
                onClick={handleSaveAndReturnHome}
                className="crm-btn crm-btn-primary h-12"
              >
                <Save className="w-4 h-4" />
                {preSalesSource?.id ? 'Enviar para Revisão' : 'Salvar Simulação'}
              </button>
            </div>
          </div>
        </section>

        {showCalculatorCards ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {calculadoras.map((calc) => (
              <button
                key={calc.id}
                type="button"
                className="crm-card group min-h-[150px] p-5 text-left transition-all hover:-translate-y-0.5"
                onClick={() => abrirCalculadora(calc.id)}
              >
                <div className="flex h-full items-start gap-4">
                  <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${calc.iconBg} shadow-lg shadow-black/20`}>
                    <calc.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--crm-ink)]">{calc.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--crm-muted)]">{calc.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <section className="crm-panel p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-[var(--crm-ink)]">Propostas Salvas</h3>
              <p className="text-sm text-[var(--crm-muted)]">
                {savedProposals.length > 0
                  ? `${savedProposals.length} proposta(s) registrada(s) pelas calculadoras`
                  : 'Nenhuma proposta salva ainda'}
              </p>
            </div>
          </div>

          {savedProposals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--crm-border)] p-6 text-center text-[var(--crm-muted)]">
              Salve uma proposta em Venda, Locação ou Serviços para ela aparecer aqui.
            </div>
          ) : (
            <div className="space-y-3">
              {savedProposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="crm-card grid gap-4 p-4 lg:grid-cols-[minmax(220px,1fr)_180px_minmax(360px,auto)] lg:items-center"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-cyan-100">{proposal.number}</span>
                      <span className="rounded border border-cyan-300/30 bg-gradient-to-br from-cyan-500/15 via-teal-500/10 to-emerald-500/15 px-2 py-1 text-xs text-cyan-100">
                        {proposal.calculatorLabel || '-'}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--crm-ink)]">
                      {proposal?.client?.companyName || 'Sem empresa'} · {proposal?.client?.contactName || 'Sem contato'}
                    </p>
                    <p className="text-xs text-[var(--crm-muted)]">
                      Atualizada em {formatDateTime(proposal.updatedAt)}
                    </p>
                  </div>

                  <div className="crm-panel-muted px-4 py-3 lg:text-right">
                    <div>
                      <p className="text-xs text-[var(--crm-muted)] uppercase">Preço Final</p>
                      <p className="text-lg font-semibold text-[var(--crm-ink)]">
                        {formatCurrency(toNumber(proposal?.result?.finalPrice, 0))}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    <button
                      type="button"
                      onClick={() => handleGenerateProposalPdf(proposal)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => openProposalPreview(proposal)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/25"
                    >
                      <Eye className="w-4 h-4" />
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => openProposal(proposal, { keepModalOpen: true })}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => openProposal(proposal, { keepModalOpen: true })}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-gradient-to-br from-cyan-500/20 via-teal-500/10 to-emerald-500/20 px-3 text-sm font-semibold text-cyan-100 shadow-inner shadow-cyan-300/10 hover:border-cyan-200/60 hover:from-cyan-500/25 hover:to-emerald-500/25"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Excluir a proposta ${proposal.number}?`)) return;
                        persistSavedProposals(savedProposals.filter(p => p.id !== proposal.id));
                        if (activeProposalId === proposal.id) setActiveProposalId(null);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-3 text-sm font-semibold text-red-100 hover:bg-red-500/25"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal
        isOpen={showPreviewModal && !!previewProposal}
        onClose={closeProposalPreview}
        title="Visualizar Proposta"
      >
        {previewProposal && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="crm-panel-muted p-4">
                <h4 className="text-sm font-semibold text-[var(--crm-ink)] mb-3">Resumo</h4>
                <div className="space-y-2 text-sm text-[var(--crm-muted)]">
                  <div className="flex items-center justify-between">
                    <span>Nº Proposta</span>
                    <span className="font-semibold text-[var(--crm-ink)]">{previewProposal.number || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tipo</span>
                    <span className="font-semibold text-[var(--crm-ink)]">{previewProposal.calculatorLabel || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Atualizada em</span>
                    <span className="font-semibold text-[var(--crm-ink)]">{formatDateTime(previewProposal.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="crm-panel-muted p-4">
                <h4 className="text-sm font-semibold text-[var(--crm-ink)] mb-3">Valores</h4>
                <div className="space-y-2 text-sm text-[var(--crm-muted)]">
                  <div className="flex items-center justify-between">
                    <span>Preço Final</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-200">
                      {formatCurrency(toNumber(previewProposal?.result?.finalPrice, 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Preço Mensal</span>
                    <span className="font-semibold text-[var(--crm-ink)]">
                      {formatCurrency(toNumber(previewProposal?.result?.monthlyPrice, 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Itens</span>
                    <span className="font-semibold text-[var(--crm-ink)]">
                      {getProposalItemSummary(previewProposal).total}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="crm-panel-muted p-4">
              <h4 className="text-sm font-semibold text-[var(--crm-ink)] mb-3">Cliente</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[var(--crm-muted)]">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">Empresa</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{previewProposal?.client?.companyName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">Contato</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{previewProposal?.client?.contactName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">Telefone</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{previewProposal?.client?.phone || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">E-mail</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{previewProposal?.client?.email || '-'}</div>
                </div>
              </div>
            </div>

            <div className="crm-panel-muted p-4">
              <h4 className="text-sm font-semibold text-[var(--crm-ink)] mb-3">Gerente</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-[var(--crm-muted)]">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">Nome</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{previewProposal?.accountManager?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">Telefone</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{previewProposal?.accountManager?.phone || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-[var(--crm-muted)]">E-mail</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{previewProposal?.accountManager?.email || '-'}</div>
                </div>
              </div>
            </div>

            <div className="crm-panel-muted p-4">
              <h4 className="text-sm font-semibold text-[var(--crm-ink)] mb-3">Itens da Proposta</h4>
              {getProposalItemSummary(previewProposal).total === 0 ? (
                <div className="text-sm text-[var(--crm-muted)]">
                  Nenhum item cadastrado nesta proposta.
                </div>
              ) : (
                <div className="space-y-4">
                  {(previewProposal?.snapshot?.saleItems || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Venda</div>
                      <div className="space-y-2">
                        {previewProposal.snapshot.saleItems.map((item, index) => {
                          const metrics = getSaleItemMetrics(item);
                          return (
                            <div key={item.id || `sale-${index}`} className="rounded-xl border border-[color:var(--crm-border)] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold text-[var(--crm-ink)]">{item.description || 'Item sem descrição'}</div>
                                <div className="text-xs text-[var(--crm-muted)]">Qtd: {metrics.qty}</div>
                              </div>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[var(--crm-muted)]">
                                <div>
                                  <span className="block uppercase tracking-wide">Custo Unit.</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">{formatCurrency(metrics.unitCost)}</span>
                                </div>
                                <div>
                                  <span className="block uppercase tracking-wide">Preço Unit.</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">
                                    {metrics.unitSell > 0 ? formatCurrency(metrics.unitSell) : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block uppercase tracking-wide">Total</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">
                                    {metrics.total > 0 ? formatCurrency(metrics.total) : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(previewProposal?.snapshot?.rentalItems || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Locação</div>
                      <div className="space-y-2">
                        {previewProposal.snapshot.rentalItems.map((item, index) => {
                          const metrics = getRentalItemMetrics(item);
                          return (
                            <div key={item.id || `rental-${index}`} className="rounded-xl border border-[color:var(--crm-border)] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold text-[var(--crm-ink)]">{item.description || 'Item sem descrição'}</div>
                                <div className="text-xs text-[var(--crm-muted)]">Qtd: {metrics.qty}</div>
                              </div>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs text-[var(--crm-muted)]">
                                <div>
                                  <span className="block uppercase tracking-wide">Valor Ativo</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">{formatCurrency(metrics.assetValue)}</span>
                                </div>
                                <div>
                                  <span className="block uppercase tracking-wide">Mensal</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">
                                    {metrics.monthly > 0 ? formatCurrency(metrics.monthly) : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block uppercase tracking-wide">Período</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">{metrics.period || '-'}</span>
                                </div>
                                <div>
                                  <span className="block uppercase tracking-wide">Total</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">
                                    {metrics.total > 0 ? formatCurrency(metrics.total) : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(previewProposal?.snapshot?.serviceItems || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Serviços</div>
                      <div className="space-y-2">
                        {previewProposal.snapshot.serviceItems.map((item, index) => {
                          const metrics = getServiceItemMetrics(item);
                          return (
                            <div key={item.id || `service-${index}`} className="rounded-xl border border-[color:var(--crm-border)] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold text-[var(--crm-ink)]">{item.description || 'Item sem descrição'}</div>
                                <div className="text-xs text-[var(--crm-muted)]">Horas: {metrics.hours || '-'}</div>
                              </div>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[var(--crm-muted)]">
                                <div>
                                  <span className="block uppercase tracking-wide">Salário Base</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">{formatCurrency(metrics.baseSalary)}</span>
                                </div>
                                <div>
                                  <span className="block uppercase tracking-wide">Preço/Hora</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">
                                    {metrics.priceHour > 0 ? formatCurrency(metrics.priceHour) : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block uppercase tracking-wide">Total</span>
                                  <span className="font-semibold text-[var(--crm-ink)]">
                                    {metrics.total > 0 ? formatCurrency(metrics.total) : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeProposalPreview}
                className="crm-btn crm-btn-secondary"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => handleGenerateProposalPdf(previewProposal)}
                className="crm-btn crm-btn-ghost"
              >
                Gerar PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  closeProposalPreview();
                  openProposal(previewProposal, { keepModalOpen: true });
                }}
                className="crm-btn crm-btn-primary"
              >
                Abrir Proposta
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showModal}
        onClose={closeCalculatorModal}
        title={`Calculadora de ${activeCalcLabel}`}
        size="full"
        fullBleed
        backLabel="Voltar"
        onBack={closeCalculatorModal}
        showCloseButton={false}
        closeOnOverlayClick={false}
        backgroundColor="dark"
        contentClassName="p-0"
        panelClassName="bg-[var(--crm-bg-base-2)]"
      >
        <div className="precificacao-module min-h-full bg-transparent text-[var(--crm-ink)]">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="crm-panel p-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(190px,260px)_minmax(190px,260px)_1fr] xl:items-end">
              <div className="min-w-0">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-1">Nº Proposta</label>
                <input
                  type="text"
                  value={proposalForm.number}
                  onChange={(event) => {
                    const nextNumber = event.target.value;
                    setProposalForm((prev) => ({ ...prev, number: nextNumber }));
                    setProposalSearchNumber(nextNumber);
                  }}
                  className="crm-input px-4 py-3 text-base font-semibold"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-1">Buscar Nº</label>
                <input
                  type="text"
                  value={proposalSearchNumber}
                  onChange={(event) => setProposalSearchNumber(event.target.value)}
                  onBlur={() => {
                    if (String(proposalSearchNumber || '').trim().toUpperCase().startsWith('ORC-')) {
                      searchBudgetByNumber(proposalSearchNumber);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      searchProposalByNumber();
                    }
                  }}
                  className="crm-input px-4 py-3 text-base font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
                <button
                  type="button"
                  onClick={() => createBlankProposal(currentTab)}
                  className="crm-btn crm-btn-secondary px-4 py-3"
                >
                  <FilePlus2 className="w-4 h-4" />
                  Nova
                </button>
                <button
                  type="button"
                  onClick={searchProposalByNumber}
                  className="crm-btn crm-btn-secondary px-4 py-3"
                >
                  <Search className="w-4 h-4" />
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndReturnHome}
                  className="crm-btn crm-btn-primary px-4 py-3"
                >
                  <Save className="w-4 h-4" />
                  {preSalesSource?.id ? 'Enviar para Revisão' : 'Salvar Simulação'}
                </button>
                <button
                  type="button"
                  onClick={generateProposalSummary}
                  className="crm-btn crm-btn-secondary px-4 py-3"
                >
                  <FileText className="w-4 h-4" />
                  Gerar
                </button>
              </div>
            </div>
          </div>

          {proposalFeedback ? (
            <div className={`rounded-lg border px-4 py-3 text-sm ${
              proposalFeedback.type === 'error'
                ? 'border-red-400/50 bg-red-500/10 text-red-100'
                : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100'
            }`}>
              {proposalFeedback.text}
            </div>
          ) : null}

          {calculatorStep === 'proposal' && (
            <div className="crm-panel overflow-hidden">
              <div className="border-b border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.74)] px-5 py-4">
                <h4 className="text-xl font-bold text-[var(--crm-ink)]">Dados da Proposta</h4>
              </div>
              <div className="p-5 space-y-6">
                <div className="crm-card overflow-hidden">
                  <div className="border-b border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.74)] px-5 py-4">
                    <h3 className="text-xl font-bold text-[var(--crm-ink)]">Custos (Orçamentos de Distribuidores)</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_220px] xl:items-end">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Distribuidor</label>
                        <select
                          value={currentBudget.distribuidorId || (currentBudget.distribuidor ? '__loaded_distributor' : '')}
                          onChange={(e) => handleBudgetDistributorChange(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        >
                          <option value="">Selecione um distribuidor cadastrado</option>
                          {currentBudget.distribuidor && !currentBudget.distribuidorId ? (
                            <option value="__loaded_distributor">{currentBudget.distribuidor}</option>
                          ) : null}
                          {preSalesDistributors.map((distributor) => (
                            <option key={distributor.id} value={distributor.id}>
                              {distributor.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Fornecedor</label>
                        <select
                          value={currentBudget.fornecedorId || (currentBudget.fornecedor ? '__loaded_supplier' : '')}
                          onChange={(e) => handleBudgetSupplierChange(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        >
                          <option value="">Selecione um fornecedor cadastrado</option>
                          {currentBudget.fornecedor && !currentBudget.fornecedorId ? (
                            <option value="__loaded_supplier">{currentBudget.fornecedor}</option>
                          ) : null}
                          {preSalesSuppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">N° Orçamento</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="ORC-0001"
                            value={currentBudget.numeroOrcamento}
                            onChange={(e) => setCurrentBudget((prev) => ({ ...prev, numeroOrcamento: e.target.value }))}
                            onBlur={() => {
                              if (String(currentBudget.numeroOrcamento || '').trim().toUpperCase().startsWith('ORC-')) {
                                searchBudgetByNumber(currentBudget.numeroOrcamento);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                searchBudgetByNumber(currentBudget.numeroOrcamento);
                              }
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                          />
                          <button
                            type="button"
                            onClick={() => searchBudgetByNumber(currentBudget.numeroOrcamento)}
                            disabled={loadingCotacoes}
                            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-60"
                            title="Buscar na Fila de Orçamentos"
                          >
                            {loadingCotacoes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[180px_minmax(280px,1fr)_160px_180px] xl:items-end">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Modalidade</label>
                        <select 
                          value={currentCost.modalidade}
                          onChange={(e) => handleCostFieldChange('modalidade', e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        >
                          <option value="VENDA">Venda</option>
                          <option value="LOCACAO">Locação</option>
                          <option value="SERVICO">Serviços</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Item / Descrição</label>
                        <input
                          type="text"
                          placeholder="Switch 48 portas, servidor..."
                          value={currentCost.item}
                          onChange={(e) => handleCostFieldChange('item', e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Qtde</label>
                        <input
                          type="number"
                          min="1"
                          value={currentCost.quantidade}
                          onChange={(e) => handleCostFieldChange('quantidade', Number(e.target.value) || 1)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Custo Unit. R$</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={currentCost.custoUnitario}
                          onChange={(e) => handleCostFieldChange('custoUnitario', Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Observações</label>
                        <input
                          type="text"
                          placeholder="Condições comerciais, prazo, impostos inclusos..."
                          value={currentCost.observacoes}
                          onChange={(e) => handleCostFieldChange('observacoes', e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddDistributorCost}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar e Aplicar
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-700/50 overflow-hidden mt-4">
                      <div className="grid grid-cols-9 gap-2 bg-slate-900/60 px-4 py-2.5 text-xs font-medium text-slate-400 border-b border-slate-700/40">
                        <span>Modalidade</span>
                        <span>Distribuidor</span>
                        <span>Fornecedor</span>
                        <span>Orçamento</span>
                        <span className="col-span-2">Item</span>
                        <span>Qtde</span>
                        <span>Custo Unit.</span>
                        <span>Data</span>
                      </div>
                      {distributorCosts.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-slate-400">
                          Sem custos adicionados para esta proposta.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-700/30">
                          {distributorCosts.map((cost) => (
                            <div key={cost.id} className="grid grid-cols-9 gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/40">
                              <span className="truncate">{cost.modalidade}</span>
                              <span className="truncate">{cost.distribuidor || '-'}</span>
                              <span className="truncate">{cost.fornecedor || '-'}</span>
                              <span className="truncate">{cost.numeroOrcamento || '-'}</span>
                              <span className="col-span-2 truncate" title={cost.item}>{cost.item}</span>
                              <span>{cost.quantidade}</span>
                              <span>R$ {cost.custoUnitario.toFixed(2)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs">{new Date(cost.data).toLocaleDateString('pt-BR')}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDistributorCost(cost.id)}
                                  className="text-red-400 hover:text-red-300 ml-auto"
                                  title="Remover custo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cliente / Órgão e CNPJ lado a lado */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Cliente / Órgão</label>
                    <input
                      type="text"
                      placeholder="Nome do cliente ou órgão"
                      value={proposalForm.clientCompany}
                      onChange={(event) => setProposalForm((prev) => ({ ...prev, clientCompany: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">CNPJ / Documento</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={proposalForm.clientDocument || ''}
                      onChange={(event) => setProposalForm((prev) => ({ ...prev, clientDocument: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Contato e Email do Cliente */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Contato do Cliente</label>
                    <input
                      type="text"
                      placeholder="Nome do contato"
                      value={proposalForm.clientContact}
                      onChange={(event) => setProposalForm((prev) => ({ ...prev, clientContact: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Email do Cliente</label>
                    <input
                      type="email"
                      placeholder="email@cliente.com.br"
                      value={proposalForm.clientEmail}
                      onChange={(event) => setProposalForm((prev) => ({ ...prev, clientEmail: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Gerente de Conta e Email do Gerente */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Gerente de Conta</label>
                    <input
                      type="text"
                      placeholder="Nome do gerente"
                      value={proposalForm.managerName}
                      onChange={(event) => setProposalForm((prev) => ({ ...prev, managerName: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Email do Gerente</label>
                    <input
                      type="email"
                      placeholder="gerente@empresa.com.br"
                      value={proposalForm.managerEmail}
                      onChange={(event) => setProposalForm((prev) => ({ ...prev, managerEmail: event.target.value }))}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Telefone do Gerente */}
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Telefone do Gerente</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={proposalForm.managerPhone}
                    onChange={(event) => setProposalForm((prev) => ({ ...prev, managerPhone: event.target.value }))}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                  />
                </div>

                {/* Premissas da Proposta */}
                <div>
                  <h5 className="text-lg font-semibold text-blue-300 mb-2">Premissas da Proposta</h5>
                  <textarea
                    placeholder="Descreva escopo, validade da proposta, SLA, condições comerciais, exclusões etc."
                    value={proposalForm.premises || ''}
                    onChange={(event) => setProposalForm((prev) => ({ ...prev, premises: event.target.value }))}
                    rows={5}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none"
                  />
                </div>
              </div>

              <div className="px-5 pb-5 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCalculatorStep('home')}
                  className="px-6 py-3 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={continueToCalculator}
                  className="px-6 py-3 rounded-lg border border-blue-400/60 bg-blue-500/80 text-white hover:bg-blue-500 inline-flex items-center gap-2"
                >
                  Continuar para Calculadoras
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {calculatorStep === 'calculation' && (
            <>
              <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-400">Cliente</div>
                  <div className="text-lg font-semibold text-white">
                    {proposalForm.clientCompany || 'Sem empresa'} · {proposalForm.clientContact || 'Sem contato'}
                  </div>
                  {(proposalForm.opportunityNumber || proposalForm.opportunityTitle) && (
                    <div className="mt-1 text-xs font-semibold text-slate-400">
                      Oportunidade: {[proposalForm.opportunityNumber, proposalForm.opportunityTitle].filter(Boolean).join(' - ')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCalculatorStep('proposal')}
                  className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                >
                  Editar Dados da Proposta
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-600/30 bg-slate-800/60 p-2">
                {calculadoras.map((calc) => (
                  <button
                    key={calc.id}
                    type="button"
                    onClick={() => {
                      setCurrentTab(calc.id);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                      currentTab === calc.id
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <calc.icon className="w-4 h-4" />
                    <span>{calc.title.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {operationType === 'venda' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-3 rounded-lg border border-slate-700 bg-slate-900/80">
                  {!isReformaRegimeSelected ? (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={isIcmsContributor}
                        onChange={(event) => setIsIcmsContributor(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-600"
                      />
                      Consumidor final é contribuinte do ICMS?
                    </label>
                  ) : (
                    <div className="lg:col-span-2 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                      Regime de reforma ativo: cálculo de venda usa IBS/CBS/IS e não aplica DIFAL/ICMS-ST.
                    </div>
                  )}
                  {!isReformaRegimeSelected && (
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">UF Destino</label>
                      <select
                        value={destinationUF}
                        onChange={(event) => setDestinationUF(event.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                      >
                        {UF_OPTIONS.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Margem de Lucro Desejada (%)</label>
                    <input
                      type="number"
                      value={desiredMargin}
                      onChange={(event) => setDesiredMargin(parseFloat(event.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {operationType === 'locacao' && (
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Período do Contrato (meses)</label>
                      <input
                        type="number"
                        value={rentalPeriod}
                        onChange={(event) => setRentalPeriod(parseFloat(event.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Margem de Lucro Desejada (%)</label>
                    <input
                      type="number"
                      value={desiredMargin}
                      onChange={(event) => setDesiredMargin(parseFloat(event.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
                <h4 className="text-lg font-semibold text-blue-300 mb-4">⚙️ Parâmetros de Cálculo</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900">
                      <tr>
                        {operationColumns.map((column) => (
                          <th
                            key={column.key}
                            className="px-3 py-2 text-left text-slate-300 font-medium"
                            style={{ minWidth: column.width, width: column.width }}
                          >
                            {column.label}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-slate-300 font-medium w-12">&nbsp;</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item) => (
                        <tr key={item.id} className="border-t border-slate-800">
                          {operationColumns.map((column) => (
                            <td
                              key={`${item.id}-${column.key}`}
                              className="px-2 py-2 align-middle"
                              style={{ minWidth: column.width, width: column.width }}
                            >
                              {renderCell(item, column)}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeOperationItem(item.id)}
                              className="text-red-400 hover:text-red-300"
                              aria-label="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={addOperationItem}
                    className="px-4 py-2 rounded-lg border border-blue-400/40 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25 inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </button>
                  <div className="text-right">
                    <div className="text-sm text-slate-400">{currentTotalLabel}</div>
                    <div className="text-2xl font-bold text-white">{formatCurrency(currentTotalValue)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
                <div className="text-center mb-4">
                  <div className="text-sm text-slate-400">
                    {operationType === 'locacao' ? 'Preço Mensal Sugerido' : 'Preço Final Sugerido'}
                  </div>
                  <div className="text-4xl font-black text-cyan-300">
                    {formatCurrency(operationType === 'locacao'
                      ? calculationPreview.calculationResults.monthlyPrice
                      : calculationPreview.calculationResults.finalPrice)}
                  </div>
                  {operationType === 'locacao' && (
                    <div className="text-sm text-cyan-200">
                      Total Contrato: {formatCurrency(calculationPreview.calculationResults.finalPrice)}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 text-center border-t border-slate-700 pt-4">
                  <div>
                    <div className="text-xs text-slate-400 uppercase">Itens na proposta</div>
                    <div className="text-lg font-semibold text-white">
                      {currentItemCount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="inline-flex items-center gap-2 text-lg font-semibold text-cyan-300">
                      <BarChart3 className="h-5 w-5" />
                      Analytics
                    </h4>
                    <p className="mt-1 text-sm text-slate-400">Indicadores atualizados conforme os itens e parâmetros da calculadora.</p>
                  </div>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    {calculationPreview.calculationResults.taxRegimeName || 'Regime não definido'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {analyticsCards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                      <p className={`mt-2 text-xl font-bold ${card.value < 0 ? 'text-red-300' : 'text-white'}`}>
                        {formatCurrency(card.value)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total do contrato</p>
                    <p className="mt-2 text-lg font-bold text-white">{formatCurrency(currentTotalContractValue)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Margem + comissão</p>
                    <p className="mt-2 text-lg font-bold text-white">{formatCurrency(currentMarginValue)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Itens calculados</p>
                    <p className="mt-2 text-lg font-bold text-white">{currentItemCount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
                <div className="mb-4">
                  <h4 className="inline-flex items-center gap-2 text-lg font-semibold text-emerald-300">
                    <PieChart className="h-5 w-5" />
                    DRE Gerencial
                  </h4>
                  <p className="mt-1 text-sm text-slate-400">
                    {operationType === 'locacao'
                      ? 'Visão mensal da locação com total de contrato destacado no Analytics.'
                      : 'Visão gerencial da proposta com tributos e custos calculados.'}
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-700">
                  {dreRows.map((row) => (
                    <div
                      key={row.label}
                      className={`grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_160px_110px] sm:gap-3 ${
                        row.final
                          ? 'bg-emerald-500/10 text-emerald-100'
                          : row.subtotal
                            ? 'bg-slate-800/80 text-white'
                            : 'bg-slate-950/60 text-slate-200'
                      } border-b border-slate-800 last:border-b-0`}
                    >
                      <span className={row.emphasis || row.final || row.subtotal ? 'font-semibold' : ''}>{row.label}</span>
                      <span className={`font-mono sm:text-right ${row.value < 0 ? 'text-red-300' : row.final ? 'text-emerald-200' : 'text-slate-100'}`}>
                        {formatCurrency(row.value)}
                      </span>
                      <span className={`font-mono sm:text-right ${row.percent < 0 ? 'text-red-300' : 'text-slate-400'}`}>
                        {formatPercent(row.percent)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {calculationPreview.operationAnalysis.length > 0 && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 space-y-4">
                  <h4 className="text-lg font-semibold text-cyan-300">Análise</h4>
                  {calculationPreview.operationAnalysis.map((section) => (
                    <div key={section.title} className="rounded-lg border border-slate-700 p-3 bg-slate-950/40">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-slate-100">{section.title}</h5>
                        {section.headers ? (
                          <div className="text-xs text-slate-400 inline-flex gap-4">
                            <span>{section.headers.value}</span>
                            {section.headers.percent ? <span>{section.headers.percent}</span> : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        {section.data.map((row) => (
                          <div key={row.label} className={`flex items-center justify-between px-2 py-1 rounded ${row.isTotal ? 'bg-slate-800/70' : 'bg-slate-900/40'}`}>
                            <span className={`text-sm ${row.isFinal ? 'text-cyan-300 font-semibold' : 'text-slate-200'}`}>{row.label}</span>
                            <div className="text-sm font-mono inline-flex gap-4">
                              <span className={row.isFinal ? 'text-cyan-300 font-semibold' : 'text-slate-100'}>
                                {row.formatter ? row.formatter(row.value) : row.value}
                              </span>
                              {row.percent !== undefined ? (
                                <span className={row.isFinal ? 'text-cyan-300 font-semibold' : 'text-slate-400'}>
                                  {formatPercent(row.percent)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {getTotalCartItems() > 0 && (
                <div className="rounded-xl border border-green-600/50 bg-green-900/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-green-300">
                      🛒 Itens na Proposta ({getTotalCartItems()})
                    </h4>
                    <button
                      type="button"
                      onClick={clearProposalCart}
                      className="px-3 py-1 rounded-lg border border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25 text-sm inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Limpar Carrinho
                    </button>
                  </div>

                  {proposalCart.sales.length > 0 && (
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-950/40">
                      <h5 className="font-semibold text-blue-300 mb-2">Vendas ({proposalCart.sales.length})</h5>
                      <div className="space-y-2">
                        {proposalCart.sales.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40">
                            <div className="flex-1">
                              <span className="text-sm text-slate-200">{item.description}</span>
                              <span className="text-xs text-slate-400 ml-2">
                                Qtd: {item.quantity} × {formatCurrency(item.unitCost)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-cyan-300">
                                {formatCurrency(toNumber(item.calculation?.rbUnitario, 0) * toNumber(item.quantity, 0))}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromProposalCart('sales', item.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {proposalCart.rentals.length > 0 && (
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-950/40">
                      <h5 className="font-semibold text-green-300 mb-2">Locações ({proposalCart.rentals.length})</h5>
                      <div className="space-y-2">
                        {proposalCart.rentals.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40">
                            <div className="flex-1">
                              <span className="text-sm text-slate-200">{item.description}</span>
                              <span className="text-xs text-slate-400 ml-2">
                                Qtd: {item.quantity} × {formatCurrency(item.assetValueBRL)} ({item.pricing?.rentalPeriod || 12} meses)
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-cyan-300">
                                {formatCurrency(toNumber(item.calculation?.rbUnitario, 0) * toNumber(item.quantity, 0))}/mês
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromProposalCart('rentals', item.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {proposalCart.services.length > 0 && (
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-950/40">
                      <h5 className="font-semibold text-purple-300 mb-2">Serviços ({proposalCart.services.length})</h5>
                      <div className="space-y-2">
                        {proposalCart.services.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900/40">
                            <div className="flex-1">
                              <span className="text-sm text-slate-200">{item.description}</span>
                              <span className="text-xs text-slate-400 ml-2">
                                {item.estimatedHours}h × {formatCurrency(item.calculation?.sellPricePerHour || 0)}/h
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-cyan-300">
                                {formatCurrency(toNumber(item.calculation?.totalSellPrice, 0))}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromProposalCart('services', item.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setCalculatorStep('proposal')}
                  className="px-6 py-3 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                >
                  Voltar aos Dados
                </button>
                <button
                  type="button"
                  onClick={addToProposalCart}
                  className="px-6 py-3 rounded-lg border border-green-400/60 bg-green-500/80 text-white hover:bg-green-500 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar à Proposta
                </button>
                <button
                  type="button"
                  onClick={handleSaveProposalWithCart}
                  className="px-6 py-3 rounded-lg border border-blue-400/60 bg-blue-500/80 text-white hover:bg-blue-500 inline-flex items-center gap-2"
                  disabled={getTotalCartItems() === 0}
                >
                  <Save className="w-4 h-4" />
                  {preSalesSource?.id
                    ? `Enviar para Revisão ${getTotalCartItems() > 0 ? `(${getTotalCartItems()} itens)` : ''}`
                    : `Salvar Proposta ${getTotalCartItems() > 0 ? `(${getTotalCartItems()} itens)` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={closeCalculatorModal}
                  className="px-6 py-3 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
                >
                  Voltar
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          setDraftSettings(deepClone(calculatorSettings));
        }}
        title="⚙️ Configurações Gerais e Tributárias"
        size="large"
        backgroundColor="dark"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 min-h-[560px]">
            <aside className="bg-slate-900/95 border border-slate-700/60 rounded-xl p-3 space-y-2">
              {[
                { id: 'regimes', label: 'Regimes Tributários' },
                { id: 'custos', label: 'Custos e Despesas' },
                { id: 'mao', label: 'Mão de Obra' },
                { id: 'icms', label: 'ICMS Interestadual' },
                { id: 'empresa', label: 'Dados da Empresa' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSettingsTab(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    settingsTab === item.id
                      ? 'bg-blue-500/20 border-blue-400/60 text-blue-100'
                      : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </aside>

            <section className="bg-slate-900/95 border border-slate-700/60 rounded-xl p-4 overflow-y-auto">
              {settingsTab === 'regimes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xl font-bold text-white">Gerenciar Regimes</h4>
                      <p className="text-sm text-slate-400">
                        Campos de impostos e bases por regime tributário. Reforma tributária: use regimes com IBS/CBS/IS.
                      </p>
                      <p className="text-xs text-cyan-200/90 mt-1">
                        Referência oficial de transição: 2026 com CBS 0,9% e IBS 0,1%. Alíquotas cheias devem ser parametrizadas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={adicionarRegimeDraft}
                      className="px-4 py-2 rounded-lg border border-blue-400/40 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25 transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Regime
                    </button>
                  </div>

                  {draftSettings.regimesTributarios.map((regime) => (
                    <div key={regime.id} className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
                        <input
                          type="text"
                          value={regime.nome}
                          onChange={(event) => atualizarRegimeDraft(regime.id, 'nome', event.target.value)}
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                          placeholder="Nome do regime"
                        />
                        <button
                          type="button"
                          onClick={() => ativarRegimeDraft(regime.id)}
                          className={`px-4 py-3 rounded-lg border inline-flex items-center justify-center gap-2 ${
                            regime.ativo
                              ? 'bg-blue-500/70 border-blue-400 text-white'
                              : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          {regime.ativo ? <Check className="w-4 h-4" /> : null}
                          {regime.ativo ? 'Ativo' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removerRegimeDraft(regime.id)}
                          disabled={draftSettings.regimesTributarios.length <= 1}
                          className="px-4 py-3 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/15 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(regime.usaReforma)}
                          onChange={(event) => atualizarRegimeDraft(regime.id, 'usaReforma', event.target.checked)}
                          className="w-4 h-4 rounded border-slate-500 bg-slate-900 text-blue-500 focus:ring-blue-500"
                        />
                        Aplicar Reforma (IBS/CBS/IS)
                      </label>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { key: 'pis', label: 'PIS (%)' },
                          { key: 'cofins', label: 'COFINS (%)' },
                          { key: 'csll', label: 'CSLL (%)' },
                          { key: 'irpj', label: 'IRPJ (%)' },
                          { key: 'icms', label: 'ICMS (%) [Legado]' },
                          { key: 'iss', label: 'ISS (%) [Legado]' },
                          { key: 'cbs', label: 'CBS (%)' },
                          { key: 'ibs', label: 'IBS (%)' },
                          { key: 'is', label: 'IS (%)' },
                          { key: 'iva', label: 'IVA Referencial (%)' },
                          { key: 'basePresuncaoVenda', label: 'Base Presunção Venda (%)' },
                          { key: 'basePresuncaoServico', label: 'Base Presunção Serviço (%)' },
                          { key: 'anexoI', label: 'Anexo I (%)' },
                          { key: 'anexoIII', label: 'Anexo III (%)' }
                        ].map((field) => (
                          <div key={field.key}>
                            <label className="block text-xs text-slate-300 mb-1">{field.label}</label>
                            <input
                              type="number"
                              step="0.01"
                              value={regime[field.key] ?? 0}
                              onChange={(event) => atualizarRegimeDraft(regime.id, field.key, parseFloat(event.target.value) || 0)}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {settingsTab === 'custos' && (
                <div className="space-y-4">
                  <h4 className="text-xl font-bold text-white">Custos e Despesas</h4>
                  <p className="text-sm text-slate-400">Configurações globais copiadas das calculadoras de referência.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { key: 'comissaoVenda', label: 'Comissão Venda (%)' },
                      { key: 'comissaoLocacao', label: 'Comissão Locação (%)' },
                      { key: 'comissaoServico', label: 'Comissão Serviço (%)' },
                      { key: 'margemLucroServico', label: 'Margem Lucro Serviço (%)' },
                      { key: 'despesasAdmin', label: 'Despesas Adm. (%)' },
                      { key: 'outrasDespesas', label: 'Outras Despesas (%)' },
                      { key: 'custoFinanceiroMensal', label: 'Custo Financeiro Mensal (%)' },
                      { key: 'taxaDescontoVPL', label: 'Taxa Desconto VPL (%)' },
                      { key: 'depreciacao', label: 'Depreciação (%)' },
                      { key: 'fretePadrao', label: 'Frete Padrão (R$)' },
                      { key: 'despesasFixasMensais', label: 'Despesas Fixas Mensais (R$)' },
                      { key: 'despesasVariaveisPercentual', label: 'Despesas Variáveis (%)' }
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm text-slate-300 mb-2">{field.label}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={draftSettings.custosDespesas[field.key] ?? 0}
                          onChange={(event) => atualizarDraftCampo('custosDespesas', field.key, parseFloat(event.target.value) || 0)}
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {settingsTab === 'mao' && (
                <div className="space-y-6">
                  <h4 className="text-xl font-bold text-white">Mão de Obra</h4>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-slate-700 p-4 space-y-3">
                      <h5 className="font-semibold text-blue-300">Encargos Sociais (CLT)</h5>
                      {Object.entries(draftSettings.maoDeObra.encargos).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[1fr_120px] gap-3 items-center">
                          <span className="text-sm text-slate-300">{key}</span>
                          <input
                            type="number"
                            step="0.01"
                            value={value}
                            onChange={(event) => atualizarMaoObraGrupoDraft('encargos', key, parseFloat(event.target.value) || 0)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                          />
                        </div>
                      ))}
                      <div className="pt-2 border-t border-slate-700 text-right text-sm text-slate-300">
                        Total Encargos: <span className="font-semibold text-white">{formatPercent(totalEncargosDraft)}</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-xl border border-slate-700 p-4 space-y-3">
                        <h5 className="font-semibold text-blue-300">Benefícios (CLT)</h5>
                        {Object.entries(draftSettings.maoDeObra.beneficios).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-[1fr_140px] gap-3 items-center">
                            <span className="text-sm text-slate-300">{key}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={value}
                              onChange={(event) => atualizarMaoObraGrupoDraft('beneficios', key, parseFloat(event.target.value) || 0)}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                            />
                          </div>
                        ))}
                        <div className="pt-2 border-t border-slate-700 text-right text-sm text-slate-300">
                          Total Benefícios: <span className="font-semibold text-white">{formatCurrency(totalBeneficiosDraft)}</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 p-4 space-y-3">
                        <h5 className="font-semibold text-blue-300">Parâmetros Gerais</h5>
                        {[
                          { key: 'salarioBase', label: 'Salário Base Padrão' },
                          { key: 'diasUteis', label: 'Dias Úteis no Mês' },
                          { key: 'horasDia', label: 'Horas/Dia' }
                        ].map((field) => (
                          <div key={field.key}>
                            <label className="block text-sm text-slate-300 mb-1">{field.label}</label>
                            <input
                              type="number"
                              step="0.01"
                              value={draftSettings.maoDeObra.geral[field.key] ?? 0}
                              onChange={(event) => atualizarMaoObraGeralDraft(field.key, parseFloat(event.target.value) || 0)}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                            />
                          </div>
                        ))}
                        <div className="pt-3 border-t border-slate-700 space-y-1 text-sm">
                          <div className="flex justify-between text-slate-300">
                            <span>Custo/Hora (CLT)</span>
                            <span className="text-white font-semibold">{formatCurrency(custoHoraDraft)}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Valor/Venda (Hora)</span>
                            <span className="text-cyan-300 font-semibold">{formatCurrency(valorVendaHoraDraft)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'icms' && (
                <div className="space-y-6">
                  <h4 className="text-2xl font-bold text-white">
                    Alíquotas ICMS Interestadual (Origem: {draftSettings.icmsInterestadual.origemUf || 'PR'})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {ICMS_UF_ORDER.map((uf) => (
                      <div key={uf} className="space-y-2">
                        <label className="block text-lg font-bold text-slate-100">{uf}</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={draftSettings.icmsInterestadual.aliquotasPorUf?.[uf] ?? 0}
                            onChange={(event) => atualizarIcmsUfDraft(uf, parseFloat(event.target.value) || 0)}
                            className="w-full pl-4 pr-12 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-2xl"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 text-2xl font-semibold">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {settingsTab === 'empresa' && (
                <div className="space-y-4 max-w-3xl">
                  <h4 className="text-xl font-bold text-white">Dados da Empresa</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'razaoSocial', label: 'Razão Social', colSpan: true },
                      { key: 'cnpj', label: 'CNPJ' },
                      { key: 'uf', label: 'UF' },
                      { key: 'address', label: 'Endereço', colSpan: true },
                      { key: 'cityState', label: 'Cidade/Estado' },
                      { key: 'phone', label: 'Telefone' },
                      { key: 'email', label: 'Email', colSpan: true }
                    ].map((field) => (
                      <div key={field.key} className={field.colSpan ? 'md:col-span-2' : ''}>
                        <label className="block text-sm text-slate-300 mb-2">{field.label}</label>
                        <input
                          type="text"
                          value={draftSettings.dadosEmpresa[field.key] || ''}
                          onChange={(event) => atualizarDraftCampo('dadosEmpresa', field.key, event.target.value)}
                          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setShowSettingsModal(false);
                setDraftSettings(deepClone(calculatorSettings));
              }}
              className="px-6 py-3 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvarConfiguracoes}
              className="px-6 py-3 rounded-lg border border-blue-400/60 bg-blue-500/80 text-white hover:bg-blue-500"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Seleção de Cotações */}
      <Modal
        isOpen={showCotacaoModal}
        onClose={() => setShowCotacaoModal(false)}
        title="Selecionar Cotação para Precificação"
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Selecione uma cotação salva para carregar os custos automaticamente na calculadora,
            ou crie uma proposta vazia.
          </p>

          {loadingCotacoes ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent"></div>
              <p className="mt-3 text-sm text-slate-400">Carregando cotações...</p>
            </div>
          ) : cotacoesDisponiveis.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-600 p-8 text-center">
              <p className="text-slate-400">Nenhuma cotação disponível no momento.</p>
              <button
                type="button"
                onClick={criarPropostaVazia}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
              >
                <FilePlus2 className="h-4 w-4" />
                Criar Proposta Vazia
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {cotacoesDisponiveis.map((solicitacao) => {
                const details = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
                  ? solicitacao.calculoDetalhes : {};
                const cotacoes = Array.isArray(details.cotacoes) ? details.cotacoes : [];
                const totalItens = getBudgetItemCount(solicitacao);
                const modalidadeLabel = {
                  VENDA: 'Venda',
                  LOCACAO: 'Locação',
                  SERVICO: 'Serviço'
                }[solicitacao.modalidade] || 'Venda';

                return (
                  <button
                    key={solicitacao.id}
                    type="button"
                    onClick={() => selecionarCotacao(solicitacao)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left transition hover:border-sky-500/50 hover:bg-slate-800/80"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base font-semibold text-sky-300">{solicitacao.numero}</span>
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-100 border border-blue-400/30">
                            {modalidadeLabel}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 truncate">{solicitacao.titulo}</p>
                        {solicitacao.nomeCliente && (
                          <p className="text-xs text-slate-400 mt-1">Cliente: {solicitacao.nomeCliente}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {cotacoes.length} cotação(ões) • {totalItens} item(ns)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-5 w-5 text-sky-400" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={criarPropostaVazia}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <FilePlus2 className="h-4 w-4" />
              Criar Proposta Vazia
            </button>
            <button
              type="button"
              onClick={() => setShowCotacaoModal(false)}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
