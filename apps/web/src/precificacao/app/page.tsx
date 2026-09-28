
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  ArrowRight, Calculator, Box, PieChart, Sparkles, TrendingUp, BarChart3, Loader2, History, Clock, Share2,
  FilePlus2, FileText, Search, Save, Eye, Pencil, Trash2, X, Printer, Download, Plus
} from 'lucide-react';
import { PricingSimulator } from '@/app/components/pricing-simulator';
import { DREGenerator } from '@/app/components/dre-generator';
import { AIAnalysis } from '@/app/components/ai-analysis';
import { AnalyticsDashboard } from '@/app/components/analytics-dashboard';
import { ProductManager } from '@/app/components/product-manager';
import { ProductAllocation, SavedAllocation } from '@/app/components/product-allocation';
import { PricingEngine, PricingInput, PricingOutput, ProductItem } from '@/app/lib/pricing-engine';
import { formatCurrency, formatPercent } from '@/app/lib/formatters';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { scenarioService, SavedScenario, SavedScenarioMetadata } from '@/services/scenario-service';
import { Card, CardContent } from '@/components/ui/card';
import { Toaster } from '@/components/ui/toaster';
import { loadCalculatorPricingSettings } from '@/app/lib/calculator-settings';
import { buildApiUrl, getAuthHeaders } from '../../config/api';
import Modal from '../../components/Modal';

const PRICING_PROPOSALS_STORAGE_KEY = 'precificacao_propostas_v1';

type SimulatorStep = 'start' | 'proposal' | 'calculation';
type DistributorCostMode = 'SETUP' | 'RECORRENTE';
type InitialScenarioAction = 'history' | 'view' | 'edit' | null;

interface FinEdgeAppProps {
  initialScenarioId?: string | null;
  initialAction?: InitialScenarioAction;
}

interface DistributorSummary {
  id: string;
  nome: string;
}

interface DistributorBudgetDraft {
  distribuidorId: string;
  distribuidor: string;
  numeroOrcamento: string;
}

interface DistributorCostDraft {
  modalidade: DistributorCostMode;
  distribuidor: string;
  numeroOrcamento: string;
  item: string;
  quantidade: number;
  custoUnitario: number;
  observacoes: string;
}

interface DistributorCost extends DistributorCostDraft {
  id: string;
  distribuidorId?: string;
  data: string;
}

interface PricingProposalForm {
  number: string;
  opportunityId: string;
  opportunityNumber: string;
  opportunityTitle: string;
  clientCompany: string;
  clientContact: string;
  clientPhone: string;
  clientEmail: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
}

interface OpportunitySummary {
  id: string;
  number?: string;
  title?: string;
  projectName?: string;
  company?: {
    name?: string;
    contacts?: Array<{
      name?: string;
      phone?: string;
      email?: string;
    }>;
  };
}

interface SavedPricingProposal {
  id: string;
  number: string;
  proposalForm: PricingProposalForm;
  distributorCosts?: DistributorCost[];
  params: PricingInput;
  results: PricingOutput;
  createdAt: string;
  updatedAt: string;
}

interface IncomingQuotationItem {
  descricao?: string;
  description?: string;
  product?: {
    name?: string;
    price?: number;
  };
  quantidade?: number;
  quantity?: number;
  custoUnitario?: number;
  unitCost?: number;
  modalidade?: string;
  distribuidor?: string;
  fornecedor?: string;
  numeroOrcamento?: string;
  observacoes?: string;
}

interface IncomingQuotation {
  itens?: IncomingQuotationItem[];
  todosCustos?: Array<{
    id?: string;
    modalidade?: string;
    distribuidor?: string;
    fornecedor?: string;
    numeroOrcamento?: string;
    observacoesCotacao?: string;
    observacoes?: string;
    createdAt?: string;
    itens?: IncomingQuotationItem[];
  }>;
  modalidade?: string;
  numeroOrcamento?: string;
  distribuidor?: string;
  fornecedor?: string;
  observacoesCotacao?: string;
  observacoes?: string;
  solicitacaoId?: string;
  titulo?: string;
  nomeCliente?: string;
  cliente?: {
    nome?: string;
    contato?: string;
    telefone?: string;
    email?: string;
  };
}

interface PreSalesBudgetRequest {
  id?: string;
  __matchedBudgetNumber?: string;
  numero?: string;
  titulo?: string;
  modalidade?: string;
  nomeCliente?: string;
  lead?: {
    name?: string;
  };
  cliente?: {
    nome?: string;
  };
  contatoCliente?: string;
  telefoneCliente?: string;
  emailCliente?: string;
  items?: IncomingQuotationItem[];
  calculoDetalhes?: {
    cotacoes?: IncomingQuotation['todosCustos'];
  };
}

const normalizeSavedPricingProposals = (source: unknown): SavedPricingProposal[] => {
  if (Array.isArray(source)) return source as SavedPricingProposal[];
  if (source && typeof source === 'object') return Object.values(source) as SavedPricingProposal[];
  return [];
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

const generateProposalNumber = (proposals: SavedPricingProposal[] = []) => {
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

const buildProposalForm = (proposalNumber: string, managerDefaults = getManagerDefaults()): PricingProposalForm => ({
  number: proposalNumber || '',
  opportunityId: '',
  opportunityNumber: '',
  opportunityTitle: '',
  clientCompany: '',
  clientContact: '',
  clientPhone: '',
  clientEmail: '',
  managerName: managerDefaults.managerName || '',
  managerEmail: managerDefaults.managerEmail || '',
  managerPhone: managerDefaults.managerPhone || ''
});

const buildEmptyDistributorCost = (): DistributorCostDraft => ({
  modalidade: 'SETUP',
  distribuidor: '',
  numeroOrcamento: '',
  item: '',
  quantidade: 1,
  custoUnitario: 0,
  observacoes: ''
});

const buildEmptyDistributorBudget = (): DistributorBudgetDraft => ({
  distribuidorId: '',
  distribuidor: '',
  numeroOrcamento: ''
});

const buildEmptyPricingInput = (calculatorPricingSettings: ReturnType<typeof loadCalculatorPricingSettings>): PricingInput => ({
  upfrontItems: [],
  recurringItems: [],
  projectBillingMode: 'standard',
  durationMonths: 36,
  markupPercentage: calculatorPricingSettings.markupPercentage,
  taxRatePercentage: calculatorPricingSettings.taxRatePercentage,
  commissionPercentage: calculatorPricingSettings.commissionPercentage,
  operatingExpensePercentage: calculatorPricingSettings.operatingExpensePercentage,
  taxRegimeName: calculatorPricingSettings.regimeName,
});

const normalizeCostMode = (value?: string): DistributorCostMode => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'RECORRENTE' || normalized === 'LOCACAO' || normalized === 'LOCAÇÃO' || normalized === 'SERVICOS' || normalized === 'SERVIÇOS') {
    return 'RECORRENTE';
  }
  return 'SETUP';
};

const buildDistributorCostsFromQuotation = (quotation: IncomingQuotation): DistributorCost[] => {
  const costs: DistributorCost[] = [];
  const sourceQuotes = Array.isArray(quotation.todosCustos) ? quotation.todosCustos : [];

  sourceQuotes.forEach((quote, quoteIndex) => {
    if (!Array.isArray(quote.itens)) return;
    quote.itens.forEach((item, itemIndex) => {
      costs.push({
        id: `cot_${Date.now()}_${quoteIndex}_${itemIndex}`,
        modalidade: normalizeCostMode(item.modalidade || quote.modalidade || quotation.modalidade),
        distribuidor: quote.distribuidor || quote.fornecedor || item.distribuidor || item.fornecedor || '',
        numeroOrcamento: quote.numeroOrcamento || item.numeroOrcamento || quotation.numeroOrcamento || '',
        item: item.descricao || item.description || '',
        quantidade: Math.max(1, Number(item.quantidade ?? item.quantity) || 1),
        custoUnitario: Math.max(0, Number(item.custoUnitario ?? item.unitCost) || 0),
        observacoes: quote.observacoesCotacao || quote.observacoes || item.observacoes || '',
        data: quote.createdAt || new Date().toISOString()
      });
    });
  });

  if (costs.length > 0) return costs;

  return (quotation.itens || []).map((item, index) => ({
    id: `cot_${Date.now()}_${index}`,
    modalidade: normalizeCostMode(item.modalidade || quotation.modalidade),
    distribuidor: item.distribuidor || item.fornecedor || quotation.distribuidor || quotation.fornecedor || '',
    numeroOrcamento: item.numeroOrcamento || quotation.numeroOrcamento || '',
    item: item.descricao || item.description || '',
    quantidade: Math.max(1, Number(item.quantidade ?? item.quantity) || 1),
    custoUnitario: Math.max(0, Number(item.custoUnitario ?? item.unitCost) || 0),
    observacoes: item.observacoes || quotation.observacoesCotacao || quotation.observacoes || '',
    data: new Date().toISOString()
  }));
};

const buildPricingItemsFromCosts = (costs: DistributorCost[]) => {
  const toProductItem = (cost: DistributorCost): ProductItem => ({
    id: cost.id,
    name: cost.item || cost.numeroOrcamento || 'Item do orçamento',
    description: [
      cost.distribuidor ? `Distribuidor: ${cost.distribuidor}` : '',
      cost.numeroOrcamento ? `Orçamento: ${cost.numeroOrcamento}` : '',
      cost.observacoes
    ].filter(Boolean).join(' | '),
    quantity: Math.max(1, Number(cost.quantidade) || 1),
    unitCost: Math.max(0, Number(cost.custoUnitario) || 0)
  });

  return {
    upfrontItems: costs.filter(cost => cost.modalidade !== 'RECORRENTE').map(toProductItem),
    recurringItems: costs.filter(cost => cost.modalidade === 'RECORRENTE').map(toProductItem)
  };
};

const getBudgetQuotesFromRequest = (request?: PreSalesBudgetRequest) => {
  const details = request?.calculoDetalhes && typeof request.calculoDetalhes === 'object'
    ? request.calculoDetalhes
    : {};
  return Array.isArray(details.cotacoes) ? details.cotacoes : [];
};

const getBudgetItemsFromRequest = (request?: PreSalesBudgetRequest): IncomingQuotationItem[] => (
  Array.isArray(request?.items)
    ? request.items
        .map((item) => ({
          descricao: item.descricao || item.product?.name || '',
          quantidade: Math.max(1, Number(item.quantidade ?? item.quantity) || 1),
          custoUnitario: Math.max(0, Number(item.custoUnitario ?? item.unitCost ?? item.product?.price) || 0),
          modalidade: item.modalidade || request?.modalidade || 'VENDA',
          distribuidor: 'Solicitação',
          numeroOrcamento: request?.__matchedBudgetNumber || request?.numero || ''
        }))
        .filter((item) => item.descricao)
    : []
);

const getBudgetItemCount = (request?: PreSalesBudgetRequest) => {
  const quoteItems = getBudgetQuotesFromRequest(request).reduce((sum, quote) => (
    sum + (Array.isArray(quote?.itens) ? quote.itens.length : 0)
  ), 0);
  return quoteItems || getBudgetItemsFromRequest(request).length;
};

const buildQuotationFromBudgetRequest = (request: PreSalesBudgetRequest): IncomingQuotation => {
  const todosCustos = getBudgetQuotesFromRequest(request);
  const numeroOrcamento = request.__matchedBudgetNumber || todosCustos[0]?.numeroOrcamento || request.numero || '';
  const nomeCliente = request.nomeCliente || request.lead?.name || request.cliente?.nome || '';
  const requestItems = getBudgetItemsFromRequest(request);

  return {
    itens: todosCustos.length > 0
      ? todosCustos.flatMap((quote) => Array.isArray(quote?.itens) ? quote.itens : [])
      : requestItems,
    todosCustos,
    modalidade: request.modalidade || todosCustos[0]?.modalidade || 'VENDA',
    numeroOrcamento,
    solicitacaoId: request.id || '',
    titulo: request.titulo || '',
    nomeCliente,
    cliente: {
      nome: nomeCliente,
      contato: request.contatoCliente || nomeCliente,
      telefone: request.telefoneCliente || '',
      email: request.emailCliente || ''
    }
  };
};

const findBudgetRequestByNumber = async (number: string): Promise<PreSalesBudgetRequest | null> => {
  const normalizedNumber = String(number || '').trim().toUpperCase();
  if (!normalizedNumber) return null;

  const response = await fetch(buildApiUrl('/pre-vendas?limit=500'), { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Falha ao consultar a Fila de Orçamentos');

  const data = await response.json();
  const requests: PreSalesBudgetRequest[] = Array.isArray(data?.solicitacoes)
    ? data.solicitacoes
    : Array.isArray(data?.data) ? data.data
      : Array.isArray(data) ? data
        : [];

  return requests.find((request) => {
    const requestNumber = String(request?.numero || '').trim().toUpperCase();
    if (requestNumber === normalizedNumber) {
      request.__matchedBudgetNumber = request.numero || number;
      return true;
    }

    const matchedQuote = getBudgetQuotesFromRequest(request).find((quote) => (
      String(quote?.numeroOrcamento || '').trim().toUpperCase() === normalizedNumber
    ));
    if (matchedQuote) {
      request.__matchedBudgetNumber = matchedQuote.numeroOrcamento || number;
      return true;
    }
    return false;
  }) || null;
};

const isMonthlyProratedPricing = (input?: PricingInput) => {
  if (!input) return false;
  if (input.projectBillingMode === 'monthly') return true;
  return (input.recurringItems || []).some((item) => (
    String(item.description || '').toLowerCase().includes('rateado de')
  ));
};

const isMonthlyProratedScenario = (scenario: SavedScenario) => (
  Boolean(scenario.metadata?.allocation) || isMonthlyProratedPricing(scenario.inputs)
);

const buildScenarioMetadataFromProposalForm = (form: PricingProposalForm): SavedScenarioMetadata => ({
  proposalNumber: form.number.trim(),
  clientCompany: form.clientCompany.trim(),
  clientContact: form.clientContact.trim(),
  opportunityNumber: form.opportunityNumber.trim(),
  opportunityTitle: form.opportunityTitle.trim()
});

const stringifyPricingInput = (input?: PricingInput) => {
  try {
    return JSON.stringify(input || {});
  } catch {
    return '';
  }
};

const isProratedProductItem = (item?: ProductItem) => (
  String(item?.description || '').toLowerCase().includes('rateado de')
);

const buildMonthlyProratedParams = (input: PricingInput): PricingInput => {
  const duration = Math.max(1, Number(input.durationMonths) || 1);
  const now = Date.now();
  const alreadyMonthlyItems = input.recurringItems.filter(isProratedProductItem);
  const itemsToProrate = [
    ...input.upfrontItems,
    ...input.recurringItems.filter((item) => !isProratedProductItem(item))
  ];

  if (itemsToProrate.length === 0) {
    return {
      ...input,
      projectBillingMode: 'monthly',
      upfrontItems: [],
      recurringItems: alreadyMonthlyItems
    };
  }

  const proratedItems = itemsToProrate.map((item, index) => {
    const originalUnitCost = Math.max(0, Number(item.unitCost) || 0);
    const monthlyUnitCost = Math.round((originalUnitCost / duration) * 100) / 100;
    const sourceDescription = item.description ? `${item.description} | ` : '';
    return {
      ...item,
      id: isProratedProductItem(item) ? item.id : `monthly_${item.id}_${now}_${index}`,
      description: `${sourceDescription}Rateado de ${formatCurrency(originalUnitCost)} em ${duration} meses`,
      unitCost: monthlyUnitCost
    };
  });

  return {
    ...input,
    projectBillingMode: 'monthly',
    upfrontItems: [],
    recurringItems: [...alreadyMonthlyItems, ...proratedItems]
  };
};

export default function FinEdgeApp({ initialScenarioId = null, initialAction = null }: FinEdgeAppProps = {}) {
  const { toast } = useToast();
  const calculatorPricingSettings = loadCalculatorPricingSettings();
  const [params, setParams] = useState<PricingInput>(() => buildEmptyPricingInput(calculatorPricingSettings));
  const [results, setResults] = useState<PricingOutput>(() => PricingEngine.calculate(params));
  const [hasGeneratedResults, setHasGeneratedResults] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [history, setHistory] = useState<SavedScenario[]>([]);
  const [simulatorStep, setSimulatorStep] = useState<SimulatorStep>('start');
  const [savedPricingProposals, setSavedPricingProposals] = useState<SavedPricingProposal[]>([]);
  const [proposalSearchNumber, setProposalSearchNumber] = useState('');
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [proposalFeedback, setProposalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBudgetSearchLoading, setIsBudgetSearchLoading] = useState(false);
  const [showBudgetQueueModal, setShowBudgetQueueModal] = useState(false);
  const [budgetQueue, setBudgetQueue] = useState<PreSalesBudgetRequest[]>([]);
  const [proposalForm, setProposalForm] = useState<PricingProposalForm>(() => buildProposalForm('', getManagerDefaults()));
  const [preSalesDistributors, setPreSalesDistributors] = useState<DistributorSummary[]>([]);
  const [currentBudget, setCurrentBudget] = useState<DistributorBudgetDraft>(() => buildEmptyDistributorBudget());
  const [currentCost, setCurrentCost] = useState<DistributorCostDraft>(() => buildEmptyDistributorCost());
  const [distributorCosts, setDistributorCosts] = useState<DistributorCost[]>([]);
  const [viewingScenario, setViewingScenario] = useState<SavedScenario | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('simulator');
  const [initialScenarioApplied, setInitialScenarioApplied] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const data = await scenarioService.getLatestScenarios();
      setHistory(data);
    } catch (err) {
      console.error("Falha ao carregar histórico:", err);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRICING_PROPOSALS_STORAGE_KEY);
      const parsed = normalizeSavedPricingProposals(stored ? JSON.parse(stored) : []);
      setSavedPricingProposals(parsed);
      setProposalSearchNumber(parsed[0]?.number || '');
    } catch (error) {
      console.error('Erro ao carregar precificações salvas:', error);
      setSavedPricingProposals([]);
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
        console.error('Erro ao carregar oportunidades para precificação:', error);
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
      } catch (error) {
        console.error('Erro ao carregar distribuidores de pré-vendas:', error);
      }
    };
    loadPreSalesDistributors();
  }, []);

  useEffect(() => {
    if (!proposalFeedback) return undefined;
    const timer = window.setTimeout(() => setProposalFeedback(null), 4200);
    return () => window.clearTimeout(timer);
  }, [proposalFeedback]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const cotacaoKey = urlParams.get('cotacaoKey');
    if (!cotacaoKey) return;

    try {
      const raw = localStorage.getItem(cotacaoKey);
      const quotation: IncomingQuotation | null = raw ? JSON.parse(raw) : null;
      if (!quotation) return;

      const costs = buildDistributorCostsFromQuotation(quotation);
      const pricingItems = buildPricingItemsFromCosts(costs);
      const proposalNumber = quotation.numeroOrcamento || generateProposalNumber(savedPricingProposals);
      const clientName = quotation.nomeCliente || quotation.cliente?.nome || '';
      const clientContact = quotation.cliente?.contato || clientName;

      const nextForm: PricingProposalForm = {
        ...buildProposalForm(proposalNumber, getManagerDefaults()),
        number: proposalNumber,
        opportunityTitle: quotation.titulo || '',
        clientCompany: clientName,
        clientContact,
        clientPhone: quotation.cliente?.telefone || '',
        clientEmail: quotation.cliente?.email || ''
      };

      const nextParams: PricingInput = {
        ...buildEmptyPricingInput(loadCalculatorPricingSettings()),
        upfrontItems: pricingItems.upfrontItems,
        recurringItems: pricingItems.recurringItems
      };

      setProposalForm(nextForm);
      setProposalSearchNumber(proposalNumber);
      setActiveProposalId(null);
      setCurrentBudget({
        distribuidorId: '',
        distribuidor: costs[0]?.distribuidor || '',
        numeroOrcamento: costs[0]?.numeroOrcamento || quotation.numeroOrcamento || ''
      });
      setCurrentCost(buildEmptyDistributorCost());
      setDistributorCosts(costs);
      setParams(nextParams);
      setResults(PricingEngine.calculate(nextParams));
      setHasGeneratedResults(false);
      setSimulatorStep('proposal');
      setActiveTab('simulator');
      setProposalFeedback({
        type: 'success',
        text: `Orçamento ${proposalNumber} carregado com ${costs.length} custo(s) para precificação.`
      });
      localStorage.removeItem(cotacaoKey);
    } catch (error) {
      console.error('Erro ao carregar orçamento enviado para precificação:', error);
      setProposalFeedback({ type: 'error', text: 'Não foi possível carregar os dados do orçamento para precificação.' });
    } finally {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [savedPricingProposals]);

  useEffect(() => {
    const refreshCalculatorSettings = () => {
      const next = loadCalculatorPricingSettings();
      setHasGeneratedResults(false);
      setParams(prev => ({
        ...prev,
        markupPercentage: next.markupPercentage,
        taxRatePercentage: next.taxRatePercentage,
        commissionPercentage: next.commissionPercentage,
        operatingExpensePercentage: next.operatingExpensePercentage,
        taxRegimeName: next.regimeName,
      }));
    };

    refreshCalculatorSettings();
    window.addEventListener('storage', refreshCalculatorSettings);
    return () => window.removeEventListener('storage', refreshCalculatorSettings);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = value === '' ? 0 : parseFloat(value);
    
    setHasGeneratedResults(false);
    setParams(prev => ({
      ...prev,
      [name]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleItemChange = (type: 'upfront' | 'recurring', id: string, field: keyof ProductItem, value: string | number) => {
    const key = type === 'upfront' ? 'upfrontItems' : 'recurringItems';
    setHasGeneratedResults(false);
    setParams(prev => ({
      ...prev,
      [key]: prev[key].map(item => {
        if (item.id === id) {
          let updatedValue = value;
          if (field === 'quantity' || field === 'unitCost') {
            updatedValue = value === '' ? 0 : (typeof value === 'string' ? parseFloat(value) || 0 : value);
          }
          return { ...item, [field]: updatedValue };
        }
        return item;
      })
    }));
  };

  const handleAddItem = (type: 'upfront' | 'recurring') => {
    const key = type === 'upfront' ? 'upfrontItems' : 'recurringItems';
    const newItem: ProductItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: type === 'upfront' ? 'Novo Setup' : 'Novo Recorrente',
      description: '',
      quantity: 1,
      unitCost: 0
    };
    setHasGeneratedResults(false);
    setParams(prev => ({
      ...prev,
      [key]: [...prev[key], newItem]
    }));
  };

  const handleRemoveItem = (type: 'upfront' | 'recurring', id: string) => {
    const key = type === 'upfront' ? 'upfrontItems' : 'recurringItems';
    setHasGeneratedResults(false);
    setParams(prev => ({
      ...prev,
      [key]: prev[key].filter(item => item.id !== id)
    }));
  };

  const handleProjectBillingModeChange = (mode: 'standard' | 'monthly') => {
    setHasGeneratedResults(false);
    setParams(prev => ({
      ...prev,
      projectBillingMode: mode
    }));
  };

  const handleApplyMonthlyProration = () => {
    setHasGeneratedResults(false);
    setParams(prev => buildMonthlyProratedParams(prev));
    setProposalFeedback({
      type: 'success',
      text: 'Projeto mensal aplicado: produtos rateados pelo prazo do contrato.'
    });
  };

  const handleCalculate = useCallback(async () => {
    const effectiveParams = params.projectBillingMode === 'monthly'
      ? buildMonthlyProratedParams(params)
      : params;

    // 1. CÁLCULO LOCAL IMEDIATO - Os números na tela mudam na hora
    const newResults = PricingEngine.calculate(effectiveParams);
    setParams(effectiveParams);
    setResults(newResults);
    setHasGeneratedResults(true);
    
    // Inicia estado de processamento para o salvamento em nuvem
    setIsCalculating(true);
    
    try {
      // 2. TENTA SALVAR NO FIREBASE
      await scenarioService.saveScenario(effectiveParams, newResults, buildScenarioMetadataFromProposalForm(proposalForm));
      await loadHistory();
      
      toast({
        title: "Cálculo Concluído",
        description: "Cenário atualizado e salvo com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao persistir dados:", error);
      toast({
        title: "Aviso",
        description: "Cálculo realizado, mas houve um erro ao sincronizar com a nuvem.",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  }, [params, proposalForm, toast, loadHistory]);

  const handleAllocationSavedToHistory = useCallback(async (allocation: SavedAllocation) => {
    const scenarioParams: PricingInput = {
      ...params,
      projectBillingMode: 'monthly'
    };
    const scenarioResults = PricingEngine.calculate(scenarioParams);

    try {
      await scenarioService.saveScenario(scenarioParams, scenarioResults, {
        ...buildScenarioMetadataFromProposalForm(proposalForm),
        allocation: {
          id: allocation.id,
          name: allocation.name,
          method: allocation.method,
          durationMonths: allocation.durationMonths,
          totalMonthlyAllocated: allocation.totalMonthlyAllocated,
          results: allocation.results
        }
      });
      await loadHistory();
      setResults(scenarioResults);
      setHasGeneratedResults(true);
      setProposalFeedback({
        type: 'success',
        text: `Rateio ${allocation.name} salvo no Histórico da Precificação.`
      });
    } catch (error) {
      console.error('Erro ao salvar rateio no histórico:', error);
      setProposalFeedback({
        type: 'error',
        text: 'Rateio salvo na aba, mas não foi possível enviar para o Histórico.'
      });
    }
  }, [params, proposalForm, loadHistory]);

  const persistPricingProposals = (items: SavedPricingProposal[]) => {
    const ordered = [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setSavedPricingProposals(ordered);
    localStorage.setItem(PRICING_PROPOSALS_STORAGE_KEY, JSON.stringify(ordered));
  };

  const startNewPricing = () => {
    const nextNumber = generateProposalNumber(savedPricingProposals);
    const nextForm = buildProposalForm(nextNumber, getManagerDefaults());
    const emptyParams = buildEmptyPricingInput(loadCalculatorPricingSettings());
    setProposalForm(nextForm);
    setProposalSearchNumber(nextNumber);
    setActiveProposalId(null);
    setProposalFeedback(null);
    setCurrentBudget(buildEmptyDistributorBudget());
    setCurrentCost(buildEmptyDistributorCost());
    setDistributorCosts([]);
    setParams(emptyParams);
    setResults(PricingEngine.calculate(emptyParams));
    setHasGeneratedResults(false);
    setSimulatorStep('proposal');
  };

  const continueToItems = () => {
    if (!proposalForm.clientCompany.trim() || !proposalForm.clientContact.trim()) {
      setProposalFeedback({
        type: 'error',
        text: 'Informe o nome da empresa cliente e o nome do contato antes de adicionar itens.'
      });
      return;
    }

    if (distributorCosts.length === 0) {
      setProposalFeedback({
        type: 'error',
        text: 'Adicione ao menos um orçamento de distribuidor antes de continuar.'
      });
      return;
    }

    setProposalFeedback(null);
    setSimulatorStep('calculation');
  };

  const handleCostFieldChange = (field: keyof DistributorCostDraft, value: string | number) => {
    setCurrentCost(prev => ({ ...prev, [field]: value }));
  };

  const handleBudgetDistributorChange = (distribuidorId: string) => {
    const selected = preSalesDistributors.find((item) => item.id === distribuidorId);
    setCurrentBudget(prev => ({
      ...prev,
      distribuidorId,
      distribuidor: selected?.nome || ''
    }));
  };

  const applyDistributorCostToItems = (cost: DistributorCost) => {
    const key = cost.modalidade === 'RECORRENTE' ? 'recurringItems' : 'upfrontItems';
    const item: ProductItem = {
      id: cost.id,
      name: cost.item || cost.numeroOrcamento || 'Item do orçamento',
      description: [
        cost.distribuidor ? `Distribuidor: ${cost.distribuidor}` : '',
        cost.numeroOrcamento ? `Orçamento: ${cost.numeroOrcamento}` : '',
        cost.observacoes
      ].filter(Boolean).join(' | '),
      quantity: Math.max(1, Number(cost.quantidade) || 1),
      unitCost: Math.max(0, Number(cost.custoUnitario) || 0)
    };

    setHasGeneratedResults(false);
    setParams(prev => ({
      ...prev,
      [key]: [...prev[key].filter(existing => existing.id !== cost.id), item]
    }));
  };

  const handleAddDistributorCost = () => {
    try {
      const quantidade = Math.max(1, Number(currentCost.quantidade) || 1);
      const custoUnitario = Math.max(0, Number(currentCost.custoUnitario) || 0);

      if (!currentBudget.distribuidor.trim() || !currentBudget.numeroOrcamento.trim()) {
        setProposalFeedback({
          type: 'error',
          text: 'Selecione o distribuidor e informe o número do orçamento antes de adicionar produtos.'
        });
        return;
      }

      if (!currentCost.item.trim() || custoUnitario <= 0) {
        setProposalFeedback({
          type: 'error',
          text: 'Informe item/descrição e custo unitário para adicionar o produto ao orçamento.'
        });
        return;
      }

      const id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

      const cost: DistributorCost = {
        ...currentCost,
        distribuidorId: currentBudget.distribuidorId,
        distribuidor: currentBudget.distribuidor,
        numeroOrcamento: currentBudget.numeroOrcamento,
        id,
        quantidade,
        custoUnitario,
        data: new Date().toISOString()
      };

      setDistributorCosts(prev => [...prev, cost]);
      applyDistributorCostToItems(cost);
      setCurrentCost(prev => ({
        ...buildEmptyDistributorCost(),
        modalidade: prev.modalidade
      }));
      setProposalFeedback({ type: 'success', text: 'Produto adicionado ao orçamento e aplicado aos itens da precificação.' });
    } catch (error) {
      console.error('Erro ao adicionar custo do distribuidor:', error);
      setProposalFeedback({
        type: 'error',
        text: 'Erro ao adicionar produto. Verifique o console para mais detalhes.'
      });
    }
  };

  const handleRemoveDistributorCost = (costId: string) => {
    setDistributorCosts(prev => prev.filter(cost => cost.id !== costId));
    setParams(prev => ({
      ...prev,
      upfrontItems: prev.upfrontItems.filter(item => item.id !== costId),
      recurringItems: prev.recurringItems.filter(item => item.id !== costId)
    }));
    setHasGeneratedResults(false);
  };

  const handleProposalOpportunityChange = (opportunityId: string) => {
    const opportunity = opportunities.find((item) => item.id === opportunityId);
    const primaryContact = Array.isArray(opportunity?.company?.contacts) ? opportunity.company.contacts[0] : null;
    setProposalForm((prev) => ({
      ...prev,
      opportunityId,
      opportunityNumber: opportunity?.number || '',
      opportunityTitle: opportunity?.title || opportunity?.projectName || '',
      clientCompany: prev.clientCompany || opportunity?.company?.name || '',
      clientContact: prev.clientContact || primaryContact?.name || '',
      clientPhone: prev.clientPhone || primaryContact?.phone || '',
      clientEmail: prev.clientEmail || primaryContact?.email || ''
    }));
  };

  const applyBudgetRequestToPricing = (request: PreSalesBudgetRequest) => {
    const quotation = buildQuotationFromBudgetRequest(request);
    const costs = buildDistributorCostsFromQuotation(quotation);
    const pricingItems = buildPricingItemsFromCosts(costs);
    const proposalNumber = quotation.numeroOrcamento || generateProposalNumber(savedPricingProposals);
    const clientName = quotation.nomeCliente || quotation.cliente?.nome || '';
    const clientContact = quotation.cliente?.contato || clientName;
    const nextParams: PricingInput = {
      ...buildEmptyPricingInput(loadCalculatorPricingSettings()),
      upfrontItems: pricingItems.upfrontItems,
      recurringItems: pricingItems.recurringItems
    };

    setProposalForm({
      ...buildProposalForm(proposalNumber, getManagerDefaults()),
      number: proposalNumber,
      opportunityTitle: quotation.titulo || '',
      clientCompany: clientName,
      clientContact,
      clientPhone: quotation.cliente?.telefone || '',
      clientEmail: quotation.cliente?.email || ''
    });
    setProposalSearchNumber(proposalNumber);
    setActiveProposalId(null);
    setCurrentBudget({
      distribuidorId: '',
      distribuidor: costs[0]?.distribuidor || '',
      numeroOrcamento: costs[0]?.numeroOrcamento || proposalNumber
    });
    setCurrentCost(buildEmptyDistributorCost());
    setDistributorCosts(costs);
    setParams(nextParams);
    setResults(PricingEngine.calculate(nextParams));
    setHasGeneratedResults(false);
    setSimulatorStep('proposal');
    setActiveTab('simulator');
    setProposalFeedback({
      type: 'success',
      text: `Orçamento ${proposalNumber} carregado da Fila de Orçamentos com ${costs.length} custo(s).`
    });
  };

  const openBudgetQueueForSelection = async () => {
    try {
      setIsBudgetSearchLoading(true);
      const response = await fetch(buildApiUrl('/pre-vendas?limit=500'), { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Falha ao carregar a Fila de Orçamentos');

      const data = await response.json();
      const requests: PreSalesBudgetRequest[] = Array.isArray(data?.solicitacoes)
        ? data.solicitacoes
        : Array.isArray(data?.data) ? data.data
          : Array.isArray(data) ? data
            : [];

      setBudgetQueue(requests.filter((request) => (
        getBudgetQuotesFromRequest(request).length > 0 || getBudgetItemsFromRequest(request).length > 0
      )));
      setShowBudgetQueueModal(true);
      setProposalFeedback(null);
    } catch (error) {
      setProposalFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar a Fila de Orçamentos.'
      });
    } finally {
      setIsBudgetSearchLoading(false);
    }
  };

  const searchBudgetRequestByNumber = async (number: string) => {
    const normalizedNumber = String(number || '').trim();
    if (!normalizedNumber) {
      await openBudgetQueueForSelection();
      return false;
    }

    try {
      setIsBudgetSearchLoading(true);
      const request = await findBudgetRequestByNumber(normalizedNumber);
      if (!request) {
        setProposalFeedback({ type: 'error', text: `Orçamento ${normalizedNumber} não encontrado na Fila de Orçamentos.` });
        return false;
      }
      applyBudgetRequestToPricing(request);
      return true;
    } catch (error) {
      setProposalFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao buscar orçamento na Fila de Orçamentos.'
      });
      return false;
    } finally {
      setIsBudgetSearchLoading(false);
    }
  };

  const savePricingProposal = () => {
    const proposalNumber = (proposalForm.number || '').trim() || generateProposalNumber(savedPricingProposals);
    const now = new Date().toISOString();
    const calculatedResults = PricingEngine.calculate(params);
    setResults(calculatedResults);

    const existing = activeProposalId
      ? savedPricingProposals.find(item => item.id === activeProposalId)
      : savedPricingProposals.find(item => item.number === proposalNumber);

    const payload: SavedPricingProposal = {
      id: existing?.id || crypto.randomUUID?.() || `prec_${Date.now()}`,
      number: proposalNumber,
      proposalForm: {
        ...proposalForm,
        number: proposalNumber,
        opportunityId: proposalForm.opportunityId,
        opportunityNumber: proposalForm.opportunityNumber,
        opportunityTitle: proposalForm.opportunityTitle,
        clientCompany: proposalForm.clientCompany.trim(),
        clientContact: proposalForm.clientContact.trim(),
        clientPhone: proposalForm.clientPhone.trim(),
        clientEmail: proposalForm.clientEmail.trim(),
        managerName: proposalForm.managerName.trim(),
        managerEmail: proposalForm.managerEmail.trim(),
        managerPhone: proposalForm.managerPhone.trim(),
      },
      distributorCosts,
      params,
      results: calculatedResults,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const next = existing
      ? savedPricingProposals.map(item => item.id === existing.id ? payload : item)
      : [payload, ...savedPricingProposals];

    persistPricingProposals(next);
    setProposalForm(payload.proposalForm);
    setProposalSearchNumber(proposalNumber);
    setActiveProposalId(payload.id);
    setProposalFeedback({ type: 'success', text: `Precificação ${proposalNumber} salva.` });
  };

  const searchPricingProposal = async () => {
    const numberTyped = proposalSearchNumber.trim();
    if (!numberTyped) {
      setProposalFeedback({ type: 'error', text: 'Informe o número da proposta para buscar.' });
      return;
    }

    const found = savedPricingProposals.find(item => item.number === numberTyped);
    if (!found) {
      await searchBudgetRequestByNumber(numberTyped);
      return;
    }

    setProposalForm(found.proposalForm);
    const loadedDistributorCosts = found.distributorCosts || [];
    setDistributorCosts(loadedDistributorCosts);
    setCurrentBudget({
      distribuidorId: loadedDistributorCosts[0]?.distribuidorId || '',
      distribuidor: loadedDistributorCosts[0]?.distribuidor || '',
      numeroOrcamento: loadedDistributorCosts[0]?.numeroOrcamento || ''
    });
    setParams(found.params);
    setResults(found.results);
    setHasGeneratedResults(true);
    setActiveProposalId(found.id);
    setSimulatorStep('calculation');
    setProposalFeedback({ type: 'success', text: `Precificação ${found.number} carregada.` });
  };

  const addPricingToBudget = useCallback(() => {
    if (!hasGeneratedResults) {
      setProposalFeedback({ type: 'error', text: 'Gere a precificação antes de adicionar ao orçamento.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const proposalNumber = (proposalForm.number || '').trim() || generateProposalNumber(savedPricingProposals);
    const existing = activeProposalId
      ? savedPricingProposals.find(item => item.id === activeProposalId)
      : savedPricingProposals.find(item => item.number === proposalNumber);

    const payload: SavedPricingProposal = {
      id: existing?.id || crypto.randomUUID?.() || `prec_${Date.now()}`,
      number: proposalNumber,
      proposalForm: {
        ...proposalForm,
        number: proposalNumber,
        clientCompany: proposalForm.clientCompany.trim(),
        clientContact: proposalForm.clientContact.trim(),
        clientPhone: proposalForm.clientPhone.trim(),
        clientEmail: proposalForm.clientEmail.trim(),
        managerName: proposalForm.managerName.trim(),
        managerEmail: proposalForm.managerEmail.trim(),
        managerPhone: proposalForm.managerPhone.trim(),
      },
      distributorCosts,
      params,
      results,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso
    };

    const nextProposals = existing
      ? savedPricingProposals.map(item => item.id === existing.id ? payload : item)
      : [payload, ...savedPricingProposals];

    persistPricingProposals(nextProposals);
    setProposalForm(payload.proposalForm);
    setProposalSearchNumber(proposalNumber);
    setActiveProposalId(payload.id);
    setProposalFeedback({
      type: 'success',
      text: `Orçamento ${proposalNumber} salvo nesta calculadora.`
    });
    toast({
      title: 'Orçamento salvo',
      description: `A precificação ${proposalNumber} foi salva na própria calculadora.`,
    });
  }, [activeProposalId, hasGeneratedResults, params, proposalForm, results, savedPricingProposals, toast]);

  const handleViewScenario = (item: SavedScenario) => {
    setViewingScenario(item);
  };

  const findSavedProposalForScenario = (item: SavedScenario) => {
    const metadataNumber = item.metadata?.proposalNumber;
    if (metadataNumber) {
      const byNumber = savedPricingProposals.find((proposal) => proposal.number === metadataNumber);
      if (byNumber) return byNumber;
    }

    const itemParams = stringifyPricingInput(item.inputs);
    return savedPricingProposals.find((proposal) => (
      stringifyPricingInput(proposal.params) === itemParams
    ));
  };

  const getScenarioMetadata = (item: SavedScenario): SavedScenarioMetadata => {
    const savedProposal = findSavedProposalForScenario(item);
    const matchesCurrentForm = stringifyPricingInput(item.inputs) === stringifyPricingInput(params);
    return {
      proposalNumber: item.metadata?.proposalNumber || savedProposal?.number || (matchesCurrentForm ? proposalForm.number : '') || '',
      clientCompany: item.metadata?.clientCompany || savedProposal?.proposalForm.clientCompany || (matchesCurrentForm ? proposalForm.clientCompany : '') || '',
      clientContact: item.metadata?.clientContact || savedProposal?.proposalForm.clientContact || (matchesCurrentForm ? proposalForm.clientContact : '') || '',
      opportunityNumber: item.metadata?.opportunityNumber || savedProposal?.proposalForm.opportunityNumber || (matchesCurrentForm ? proposalForm.opportunityNumber : '') || '',
      opportunityTitle: item.metadata?.opportunityTitle || savedProposal?.proposalForm.opportunityTitle || (matchesCurrentForm ? proposalForm.opportunityTitle : '') || ''
    };
  };

  const handleEditScenario = (item: SavedScenario) => {
    const savedProposal = findSavedProposalForScenario(item);
    const metadata = getScenarioMetadata(item);
    const proposalNumber = metadata.proposalNumber || savedProposal?.number || proposalForm.number || generateProposalNumber(savedPricingProposals);
    const baseProposalForm = savedProposal?.proposalForm || buildProposalForm(proposalNumber, getManagerDefaults());

    setParams(item.inputs);
    setResults(item.results);
    setProposalForm({
      ...baseProposalForm,
      number: proposalNumber,
      clientCompany: metadata.clientCompany || baseProposalForm.clientCompany || '',
      clientContact: metadata.clientContact || baseProposalForm.clientContact || '',
      opportunityNumber: metadata.opportunityNumber || baseProposalForm.opportunityNumber || '',
      opportunityTitle: metadata.opportunityTitle || baseProposalForm.opportunityTitle || ''
    });
    setProposalSearchNumber(proposalNumber);
    setActiveProposalId(savedProposal?.id || null);
    setHasGeneratedResults(true);
    setViewingScenario(null);
    setSimulatorStep('calculation');
    setActiveTab('simulator');
    toast({ title: "Cenário Restaurado", description: "Cálculo e dados do cliente aplicados com sucesso." });
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await scenarioService.deleteScenario(id);
      setHistory(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
      if (viewingScenario?.id === id) setViewingScenario(null);
      toast({ title: "Cenário Excluído", description: "O cenário foi removido do histórico." });
    } catch (error) {
      console.error("Erro ao excluir cenário:", error);
      toast({ title: "Erro", description: "Não foi possível excluir o cenário.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!initialAction) return;

    const marker = `${initialAction}:${initialScenarioId || 'all'}`;
    if (initialScenarioApplied === marker) return;

    if (initialAction === 'history' && !initialScenarioId) {
      setActiveTab('history');
      setInitialScenarioApplied(marker);
      return;
    }

    if (!initialScenarioId) return;
    const scenario = history.find((item) => item.id === initialScenarioId);
    if (!scenario) return;

    if (initialAction === 'view') {
      setViewingScenario(scenario);
      setActiveTab('history');
    } else if (initialAction === 'edit') {
      handleEditScenario(scenario);
    } else {
      setActiveTab('history');
    }

    setInitialScenarioApplied(marker);
  }, [history, initialAction, initialScenarioApplied, initialScenarioId]);

  const emptyResults = useMemo(
    () => PricingEngine.calculate(buildEmptyPricingInput(calculatorPricingSettings)),
    [calculatorPricingSettings]
  );
  const displayedResults = hasGeneratedResults ? results : emptyResults;
  const standardPricingHistory = useMemo(
    () => history.filter((item) => !isMonthlyProratedScenario(item)),
    [history]
  );
  const proratedPricingHistory = useMemo(
    () => history.filter((item) => isMonthlyProratedScenario(item)),
    [history]
  );

  const renderHistoryCard = (item: SavedScenario, variant: 'standard' | 'prorated') => {
    const metadata = getScenarioMetadata(item);

    return (
    <Card key={item.id} className="rounded-2xl shadow-sm border-slate-200 transition-all group hover:border-primary/20">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div
            className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
            onClick={() => handleEditScenario(item)}
          >
            <div className={cn(
              "p-3 rounded-xl shrink-0",
              variant === 'prorated' ? "bg-cyan-50 text-cyan-700" : "bg-primary/10 text-primary"
            )}>
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('pt-BR') : 'Agora'}
                </p>
                <span className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                  variant === 'prorated'
                    ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                )}>
                  {variant === 'prorated' ? 'Com rateio' : 'Precificação'}
                </span>
              </div>
              <p className="text-lg font-bold text-slate-900 truncate">
                {formatCurrency(item.results.finalMonthlyPrice)} <span className="text-sm font-normal text-slate-500">/mês</span>
              </p>
              <p className="mt-1 truncate text-sm font-bold text-slate-700">
                Cliente: {metadata.clientCompany || 'Cliente não informado'}
              </p>
              {metadata.clientContact ? (
                <p className="truncate text-xs font-semibold text-slate-500">
                  Contato: {metadata.clientContact}
                </p>
              ) : null}
              {item.metadata?.allocation ? (
                <p className="mt-1 truncate text-xs font-bold text-cyan-700">
                  Rateio: {item.metadata.allocation.name} · {formatCurrency(item.metadata.allocation.totalMonthlyAllocated)}/mês
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-5 sm:gap-6 ml-16 sm:ml-0">
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Setup</p>
              <p className="text-sm font-bold text-slate-800">{item.inputs.upfrontItems?.length || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Rec.</p>
              <p className="text-sm font-bold text-slate-800">{item.inputs.recurringItems?.length || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Margem</p>
              <p className={cn("text-sm font-bold", item.results.metrics.ebitdaMargin >= 20 ? "text-emerald-600" : "text-amber-600")}>
                {formatPercent(item.results.metrics.ebitdaMargin)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-16 sm:ml-0">
            <button
              onClick={() => handleViewScenario(item)}
              title="Visualizar em PDF"
              className="h-9 px-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-sky-100 hover:border-sky-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={() => handleEditScenario(item)}
              title="Editar cenário"
              className="h-9 px-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-blue-100 hover:border-blue-300 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            {deleteConfirmId === item.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteScenario(item.id)}
                  title="Confirmar exclusão"
                  className="h-9 rounded-xl border border-red-300 bg-red-100 px-3 text-[11px] font-bold text-red-700 inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  title="Cancelar"
                  className="h-9 w-9 rounded-xl border border-slate-300 bg-white text-slate-500 hover:text-slate-700 inline-flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirmId(item.id)}
                title="Excluir cenário"
                className="h-9 px-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-red-100 hover:border-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  const renderHistorySection = (
    title: string,
    description: string,
    items: SavedScenario[],
    variant: 'standard' | 'prorated'
  ) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs font-semibold text-slate-500">{description}</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{items.length} salvo(s)</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => renderHistoryCard(item, variant))}
        </div>
      </section>
    );
  };

  return (
    <div className="precificacao-module min-h-screen bg-transparent font-body text-[var(--crm-ink)] pb-20">
      <Toaster />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        
        {/* Enterprise Header */}
        <header className="bg-white px-8 py-6 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="p-4 bg-primary text-white rounded-2xl shadow-indigo-200 shadow-xl">
              <Calculator size={32} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-headline text-slate-900">FinEdge Architect</h1>
              <p className="text-slate-400 text-sm font-medium tracking-wide flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                DRE & Precificação Profissional
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-10 lg:border-l border-slate-100 lg:pl-10">
            <div className="space-y-1 text-center md:text-left">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">TCV (Contrato Total)</p>
              <p className="text-2xl font-bold text-primary tabular-nums font-headline">
                {formatCurrency(displayedResults.totalContractValue)}
              </p>
            </div>
            <div className="space-y-1 text-center md:text-left">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Margem EBITDA</p>
              <div className="flex items-center justify-center md:justify-start space-x-2">
                <TrendingUp className={cn("w-4 h-4", displayedResults.metrics.ebitdaMargin >= 20 ? 'text-emerald-500' : 'text-amber-500')} />
                <p className={cn(
                  "text-2xl font-bold tabular-nums font-headline",
                  displayedResults.metrics.ebitdaMargin >= 20 ? 'text-emerald-600' : 'text-amber-600'
                )}>
                  {formatPercent(displayedResults.metrics.ebitdaMargin)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 items-start">
          <main className="space-y-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex justify-between items-center mb-6 overflow-x-auto pb-2">
                <TabsList className="bg-white border border-slate-200 p-1.5 h-auto rounded-2xl shadow-sm">
                  <TabsTrigger value="simulator" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm">
                    <Box size={16} className="mr-2" /> Calculadora
                  </TabsTrigger>
                  <TabsTrigger value="allocation" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm">
                    <Share2 size={16} className="mr-2" /> Rateio de Produtos
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm">
                    <BarChart3 size={16} className="mr-2" /> Analytics
                  </TabsTrigger>
                  <TabsTrigger value="dre" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm">
                    <PieChart size={16} className="mr-2" /> DRE Gerencial
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm">
                    <Sparkles size={16} className="mr-2" /> AI Advisor
                  </TabsTrigger>
                  <TabsTrigger value="history" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold text-sm">
                    <History size={16} className="mr-2" /> Histórico
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="simulator" className="focus-visible:outline-none space-y-8">
                {simulatorStep === 'start' && (
                  <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Calculadora</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900 font-headline">Inicie uma nova precificação</h2>
                        <p className="mt-2 max-w-2xl text-sm text-slate-500">
                          Cadastre os dados da proposta antes de adicionar produtos e serviços ao cálculo.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startNewPricing}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-6 py-4 text-sm font-bold text-white shadow-md hover:bg-primary/90 transition-colors"
                      >
                        <FilePlus2 className="w-5 h-5" />
                        Nova Precificação
                      </button>
                    </CardContent>
                  </Card>
                )}

                {simulatorStep !== 'start' && (
                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="grid grid-cols-1 gap-4 border-b border-slate-100 bg-slate-50/80 p-5 xl:grid-cols-[minmax(190px,260px)_minmax(190px,260px)_1fr] xl:items-end">
                      <div className="min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nº Proposta</label>
                        <input
                          type="text"
                          value={proposalForm.number}
                          onChange={(event) => {
                            const nextNumber = event.target.value;
                            setProposalForm((prev) => ({ ...prev, number: nextNumber }));
                            setProposalSearchNumber(nextNumber);
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Buscar Nº</label>
                        <input
                          type="text"
                          value={proposalSearchNumber}
                          onChange={(event) => setProposalSearchNumber(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
                        <button type="button" onClick={startNewPricing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-700 transition hover:bg-cyan-500/20">
                          <FilePlus2 className="w-4 h-4" /> Nova
                        </button>
                        <button type="button" onClick={searchPricingProposal} disabled={isBudgetSearchLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-700 transition hover:bg-cyan-500/20 disabled:opacity-60">
                          {isBudgetSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
                        </button>
                        <button type="button" onClick={savePricingProposal} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90">
                          <Save className="w-4 h-4" /> Salvar
                        </button>
                        <button type="button" onClick={handleCalculate} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/20">
                          <FileText className="w-4 h-4" /> Gerar
                        </button>
                      </div>
                    </div>

                    {proposalFeedback && (
                      <div className={cn(
                        "mx-5 mt-5 rounded-2xl border px-4 py-3 text-xs font-bold",
                        proposalFeedback.type === 'error'
                          ? "border-red-100 bg-red-50 text-red-700"
                          : "border-emerald-100 bg-emerald-50 text-emerald-700"
                      )}>
                        {proposalFeedback.text}
                      </div>
                    )}

                    {simulatorStep === 'proposal' && (
                      <>
                        <div className="border-b border-slate-100 bg-cyan-600 px-6 py-5">
                          <h2 className="text-2xl font-bold text-white font-headline">Informações da Proposta</h2>
                        </div>
                        <div className="border-b border-slate-100 bg-slate-50/60 p-6">
                          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="border-b border-slate-100 px-6 py-5">
                              <h3 className="text-xl font-bold text-slate-900 font-headline">Custos (Orçamentos de Distribuidores)</h3>
                              <p className="mt-1 text-sm text-slate-500">
                                Cadastre os orçamentos recebidos antes de avançar para os itens da precificação.
                              </p>
                            </div>
                            <div className="space-y-4 p-6">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,1fr)_220px] md:items-end">
                                <div>
                                  <label className="block text-sm font-semibold text-slate-500 mb-1.5">Distribuidor</label>
                                  <select
                                    value={currentBudget.distribuidorId}
                                    onChange={(event) => handleBudgetDistributorChange(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                  >
                                    <option value="">Selecione um distribuidor cadastrado</option>
                                    {preSalesDistributors.map((distributor) => (
                                      <option key={distributor.id} value={distributor.id}>
                                        {distributor.nome}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-500 mb-1.5">Nº Orçamento</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="ORC-0001"
                                      value={currentBudget.numeroOrcamento}
                                      onChange={(event) => setCurrentBudget(prev => ({ ...prev, numeroOrcamento: event.target.value }))}
                                      className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => searchBudgetRequestByNumber(currentBudget.numeroOrcamento)}
                                      disabled={isBudgetSearchLoading}
                                      className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-700 transition hover:bg-cyan-500/20 disabled:opacity-60"
                                      title="Buscar na Fila de Orçamentos"
                                    >
                                      {isBudgetSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[180px_minmax(280px,1fr)_160px_180px] xl:items-end">
                                <div>
                                  <label className="block text-sm font-semibold text-slate-500 mb-1.5">Modalidade</label>
                                  <select
                                    value={currentCost.modalidade}
                                    onChange={(event) => handleCostFieldChange('modalidade', event.target.value as DistributorCostMode)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                  >
                                    <option value="SETUP">Setup / CAPEX</option>
                                    <option value="RECORRENTE">Recorrente / OPEX</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-500 mb-1.5">Item / Descrição</label>
                                  <input
                                    type="text"
                                    placeholder="Servidor, licença, serviço..."
                                    value={currentCost.item}
                                    onChange={(event) => handleCostFieldChange('item', event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-500 mb-1.5">Qtde</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={currentCost.quantidade}
                                    onChange={(event) => handleCostFieldChange('quantidade', Number(event.target.value) || 1)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-500 mb-1.5">Custo Unit. R$</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={currentCost.custoUnitario}
                                    onChange={(event) => handleCostFieldChange('custoUnitario', Number(event.target.value) || 0)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
                                <div>
                                  <label className="block text-sm font-semibold text-slate-500 mb-1.5">Observações</label>
                                  <input
                                    type="text"
                                    placeholder="Condições comerciais, prazo, impostos inclusos..."
                                    value={currentCost.observacoes}
                                    onChange={(event) => handleCostFieldChange('observacoes', event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAddDistributorCost}
                                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-primary/90 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                  Adicionar e Aplicar
                                </button>
                              </div>

                              <div className="overflow-hidden rounded-2xl border border-slate-200">
                                <div className="hidden grid-cols-8 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 lg:grid">
                                  <span>Modalidade</span>
                                  <span>Distribuidor</span>
                                  <span>Orçamento</span>
                                  <span className="col-span-2">Item</span>
                                  <span>Qtde</span>
                                  <span>Custo Unit.</span>
                                  <span>Data</span>
                                </div>
                                {distributorCosts.length === 0 ? (
                                  <div className="px-4 py-6 text-sm font-semibold text-slate-400">
                                    Sem custos adicionados para esta proposta.
                                  </div>
                                ) : (
                                  <div className="divide-y divide-slate-100">
                                    {distributorCosts.map((cost) => (
                                      <div key={cost.id} className="grid grid-cols-1 gap-2 px-4 py-4 text-sm text-slate-600 lg:grid-cols-8 lg:items-center">
                                        <span className="font-bold text-slate-900">{cost.modalidade === 'RECORRENTE' ? 'Recorrente' : 'Setup'}</span>
                                        <span className="truncate">{cost.distribuidor}</span>
                                        <span className="truncate">{cost.numeroOrcamento || '-'}</span>
                                        <span className="col-span-2 truncate" title={cost.item}>{cost.item}</span>
                                        <span>{cost.quantidade}</span>
                                        <span className="font-bold text-slate-900">{formatCurrency(cost.custoUnitario)}</span>
                                        <span className="flex items-center justify-between gap-2">
                                          {new Date(cost.data).toLocaleDateString('pt-BR')}
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveDistributorCost(cost.id)}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                            title="Remover orçamento"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 p-6">
                          <div className="xl:col-span-2">
                            <label className="block text-sm font-semibold text-slate-500 mb-1.5">Oportunidade</label>
                            <select
                              value={proposalForm.opportunityId}
                              onChange={(event) => handleProposalOpportunityChange(event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                            >
                              <option value="">Selecione a oportunidade vinculada</option>
                              {opportunities.map((opportunity) => (
                                <option key={opportunity.id} value={opportunity.id}>
                                  {[opportunity.number, opportunity.title || opportunity.projectName, opportunity.company?.name]
                                    .filter(Boolean)
                                    .join(' - ')}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-2xl font-bold text-sky-600 font-headline">Dados do Cliente</h3>
                            <div>
                              <label className="block text-sm font-semibold text-slate-500 mb-1.5">Nome da Empresa Cliente</label>
                              <input value={proposalForm.clientCompany} onChange={(event) => setProposalForm(prev => ({ ...prev, clientCompany: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-500 mb-1.5">Nome do Contato</label>
                              <input value={proposalForm.clientContact} onChange={(event) => setProposalForm(prev => ({ ...prev, clientContact: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-500 mb-1.5">Telefone</label>
                              <input value={proposalForm.clientPhone} onChange={(event) => setProposalForm(prev => ({ ...prev, clientPhone: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-500 mb-1.5">E-mail</label>
                              <input type="email" value={proposalForm.clientEmail} onChange={(event) => setProposalForm(prev => ({ ...prev, clientEmail: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-2xl font-bold text-sky-600 font-headline">Dados do Gerente de Contas</h3>
                            <div>
                              <label className="block text-sm font-semibold text-slate-500 mb-1.5">Nome do Gerente</label>
                              <input value={proposalForm.managerName} onChange={(event) => setProposalForm(prev => ({ ...prev, managerName: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-500 mb-1.5">E-mail do Gerente</label>
                              <input type="email" value={proposalForm.managerEmail} onChange={(event) => setProposalForm(prev => ({ ...prev, managerEmail: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-slate-500 mb-1.5">Telefone do Gerente</label>
                              <input value={proposalForm.managerPhone} onChange={(event) => setProposalForm(prev => ({ ...prev, managerPhone: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end px-6 pb-6">
                          <button type="button" onClick={continueToItems} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-primary/90 transition-colors">
                            <ArrowRight className="w-4 h-4" />
                            Continuar para Adicionar Itens
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {simulatorStep === 'calculation' && (
                  <>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shadow-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cliente</p>
                        <p className="text-lg font-bold text-slate-900">
                          {proposalForm.clientCompany || 'Sem empresa'} · {proposalForm.clientContact || 'Sem contato'}
                        </p>
                        {proposalForm.opportunityNumber || proposalForm.opportunityTitle ? (
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Oportunidade: {[proposalForm.opportunityNumber, proposalForm.opportunityTitle].filter(Boolean).join(' - ')}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSimulatorStep('proposal')}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:text-primary hover:border-primary/30"
                      >
                        Editar Dados da Proposta
                      </button>
                    </div>
                    {hasGeneratedResults && (
                      <PricingSimulator
                        results={results}
                        params={params}
                        onAddToBudget={addPricingToBudget}
                      />
                    )}
                    <ProductManager
                      params={params}
                      upfrontItems={params.upfrontItems}
                      recurringItems={params.recurringItems}
                      onParamChange={handleInputChange}
                      onItemChange={handleItemChange}
                      onAddItem={handleAddItem}
                      onRemoveItem={handleRemoveItem}
                      onCalculate={handleCalculate}
                      isCalculating={isCalculating}
                      onProjectBillingModeChange={handleProjectBillingModeChange}
                      onApplyMonthlyProration={handleApplyMonthlyProration}
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="allocation" className="focus-visible:outline-none">
                <ProductAllocation params={params} onSaveAllocation={handleAllocationSavedToHistory} />
              </TabsContent>

              <TabsContent value="analytics" className="focus-visible:outline-none">
                <AnalyticsDashboard results={displayedResults} params={params} />
              </TabsContent>

              <TabsContent value="dre" className="focus-visible:outline-none">
                <DREGenerator results={displayedResults} durationMonths={params.durationMonths} />
              </TabsContent>

              <TabsContent value="ai" className="focus-visible:outline-none">
                <AIAnalysis results={displayedResults} params={params} />
              </TabsContent>

              <TabsContent value="history" className="focus-visible:outline-none">
                <div className="grid grid-cols-1 gap-4">
                  {history.length === 0 ? (
                    <Card className="rounded-3xl border-dashed border-2 p-12 text-center">
                      <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400">Nenhum cenário salvo ainda no histórico.</p>
                    </Card>
                  ) : (
                    <>
                      {renderHistorySection(
                        'Apenas precificação',
                        'Cenários sem aplicação de rateio mensal de produtos.',
                        standardPricingHistory,
                        'standard'
                      )}
                      {renderHistorySection(
                        'Precificação com rateio',
                        'Cenários em que os produtos foram rateados pelo prazo do contrato.',
                        proratedPricingHistory,
                        'prorated'
                      )}
                    </>
                  )}
                </div>

                {/* View Scenario Modal - Pronto para Impressão */}
                {viewingScenario && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setViewingScenario(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between p-6 border-b border-slate-100 print:hidden">
                        <h2 className="text-lg font-bold text-slate-900 font-headline">Visualizar Precificação</h2>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.print()}
                            className="h-9 px-4 rounded-xl border border-primary/20 bg-primary text-white text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                          >
                            <Printer className="w-4 h-4" /> Imprimir / PDF
                          </button>
                          <button onClick={() => setViewingScenario(null)} className="h-9 w-9 rounded-xl border border-slate-300 bg-white text-slate-500 hover:text-slate-700 inline-flex items-center justify-center transition-colors shadow-sm">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-6 sm:p-8 space-y-6 print:space-y-4 print:p-4">
                        {/* Cabeçalho print-friendly */}
                        <div className="text-center hidden print:block mb-6">
                          <h1 className="text-2xl font-bold text-slate-900">Precificação - FinEdge Architect</h1>
                          <p className="text-sm text-slate-500 mt-1">
                            {viewingScenario.createdAt?.toDate ? viewingScenario.createdAt.toDate().toLocaleString('pt-BR') : 'Data não informada'}
                          </p>
                          <hr className="mt-4 border-slate-200" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 p-5 border border-primary/10">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Preço Final Mensal</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(viewingScenario.results.finalMonthlyPrice)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">/mês</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">TCV - Total do Contrato</p>
                            <p className="text-2xl font-bold text-slate-900">{formatCurrency(viewingScenario.results.totalContractValue)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{viewingScenario.inputs.durationMonths} meses</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Margem EBITDA</p>
                            <p className={cn("text-lg font-bold", viewingScenario.results.metrics.ebitdaMargin >= 20 ? "text-emerald-600" : "text-amber-600")}>
                              {formatPercent(viewingScenario.results.metrics.ebitdaMargin)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Markup</p>
                            <p className="text-lg font-bold text-slate-900">{formatPercent(viewingScenario.inputs.markupPercentage)}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Setup (itens)</p>
                            <p className="text-lg font-bold text-slate-900">{viewingScenario.inputs.upfrontItems?.length || 0}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Recorrentes</p>
                            <p className="text-lg font-bold text-slate-900">{viewingScenario.inputs.recurringItems?.length || 0}</p>
                          </div>
                        </div>

                        {viewingScenario.metadata?.allocation ? (
                          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-5">
                            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                              Rateio mensal aplicado
                            </h3>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome do rateio</p>
                                <p className="text-sm font-bold text-slate-900">{viewingScenario.metadata.allocation.name}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Método</p>
                                <p className="text-sm font-bold text-slate-900">
                                  {viewingScenario.metadata.allocation.method === 'proportional' ? 'Proporcional' : 'Igualitário'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total rateado/mês</p>
                                <p className="text-sm font-bold text-cyan-700">{formatCurrency(viewingScenario.metadata.allocation.totalMonthlyAllocated)}</p>
                              </div>
                            </div>
                            <div className="mt-4 overflow-x-auto rounded-xl border border-cyan-100 bg-white">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-cyan-50 text-left">
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Produto alvo</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Original/mês</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Rateado/mês</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Venda/mês</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-cyan-50">
                                  {viewingScenario.metadata.allocation.results.map((allocationItem) => (
                                    <tr key={allocationItem.productId}>
                                      <td className="px-4 py-3 font-medium text-slate-800">
                                        {allocationItem.name}
                                        {allocationItem.breakdown.length > 0 ? (
                                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                            Fontes: {allocationItem.breakdown.map((source) => source.sourceName).join(', ')}
                                          </p>
                                        ) : null}
                                      </td>
                                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(allocationItem.originalMonthlyCost)}</td>
                                      <td className="px-4 py-3 text-right text-cyan-700">+{formatCurrency(allocationItem.allocatedMonthlyCost)}</td>
                                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(allocationItem.saleMonthlyPrice || allocationItem.totalMonthlyCost)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : null}

                        {/* Tabela de itens Setup */}
                        {viewingScenario.inputs.upfrontItems && viewingScenario.inputs.upfrontItems.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              Itens de Setup
                            </h3>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-left">
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Item</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Qtd</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Valor Unit.</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {viewingScenario.inputs.upfrontItems.map((upfrontItem) => (
                                    <tr key={upfrontItem.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 font-medium text-slate-800">{upfrontItem.name}</td>
                                      <td className="px-4 py-3 text-right text-slate-600">{upfrontItem.quantity}</td>
                                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(upfrontItem.unitCost)}</td>
                                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(upfrontItem.quantity * upfrontItem.unitCost)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Tabela de itens Recorrentes */}
                        {viewingScenario.inputs.recurringItems && viewingScenario.inputs.recurringItems.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Itens Recorrentes
                            </h3>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-left">
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500">Item</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Qtd</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Valor Unit.</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right">Total/mês</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {viewingScenario.inputs.recurringItems.map((recItem) => (
                                    <tr key={recItem.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 font-medium text-slate-800">{recItem.name}</td>
                                      <td className="px-4 py-3 text-right text-slate-600">{recItem.quantity}</td>
                                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(recItem.unitCost)}</td>
                                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(recItem.quantity * recItem.unitCost)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Resumo financeiro */}
                        <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200">
                          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Resumo Financeiro
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Receita Rec. Mensal</p>
                              <p className="text-base font-bold text-slate-900">{formatCurrency(viewingScenario.results.metrics.totalRecurringRevenue)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Custos Operacionais</p>
                              <p className="text-base font-bold text-slate-900">{formatCurrency(viewingScenario.results.metrics.totalOperatingCosts)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resultado Líquido</p>
                              <p className={cn("text-base font-bold", viewingScenario.results.metrics.netResult >= 0 ? "text-emerald-600" : "text-red-600")}>
                                {formatCurrency(viewingScenario.results.metrics.netResult)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Rodapé print */}
                        <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100 hidden print:block">
                          Documento gerado pelo FinEdge Architect - {new Date().toLocaleString('pt-BR')}
                        </div>

                        <div className="flex gap-3 pt-2 print:hidden">
                          <button
                            onClick={() => window.print()}
                            className="flex-1 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
                          >
                            <Printer className="w-4 h-4" /> Imprimir / Gerar PDF
                          </button>
                          <button
                            onClick={() => { handleEditScenario(viewingScenario); }}
                            className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:text-primary hover:border-primary/30 transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
                          >
                            <Pencil className="w-4 h-4" /> Editar Cenário
                          </button>
                          <button
                            onClick={() => setViewingScenario(null)}
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors shadow-sm"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Modal
              isOpen={showBudgetQueueModal}
              onClose={() => setShowBudgetQueueModal(false)}
              title="Fila de Orçamentos"
              size="large"
              backgroundColor="dark"
            >
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Selecione um orçamento salvo para carregar automaticamente cliente, distribuidor e produtos na precificação.
                </p>

                {isBudgetSearchLoading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
                    <p className="mt-3 text-sm text-slate-400">Carregando Fila de Orçamentos...</p>
                  </div>
                ) : budgetQueue.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-8 text-center">
                    <p className="text-sm text-slate-400">Nenhum orçamento com custos disponível no momento.</p>
                  </div>
                ) : (
                  <div className="max-h-[520px] space-y-3 overflow-y-auto">
                    {budgetQueue.map((request) => {
                      const quotes = getBudgetQuotesFromRequest(request);
                      const totalItems = getBudgetItemCount(request);
                      const firstQuote = quotes[0];
                      const budgetNumber = firstQuote?.numeroOrcamento || request.numero || '-';
                      const clientName = request.nomeCliente || request.lead?.name || request.cliente?.nome || 'Cliente não informado';

                      return (
                        <button
                          key={request.id || budgetNumber}
                          type="button"
                          onClick={() => {
                            applyBudgetRequestToPricing(request);
                            setShowBudgetQueueModal(false);
                          }}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-left transition hover:border-cyan-400/50 hover:bg-slate-900"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-base font-semibold text-cyan-300">{budgetNumber}</span>
                                <span className="rounded-full border border-blue-400/30 bg-blue-500/20 px-2 py-1 text-xs font-semibold text-blue-100">
                                  {request.modalidade || firstQuote?.modalidade || 'VENDA'}
                                </span>
                              </div>
                              <p className="mt-2 truncate text-sm font-semibold text-white">{request.titulo || 'Orçamento sem título'}</p>
                              <p className="mt-1 text-xs text-slate-400">Cliente: {clientName}</p>
                              <p className="mt-1 text-xs text-slate-500">{quotes.length} cotação(ões) • {totalItems} item(ns)</p>
                            </div>
                            <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Modal>
          </main>
        </div>
      </div>
    </div>
  );
}
