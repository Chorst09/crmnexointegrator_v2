'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Boxes,
  Calculator,
  Check,
  Download,
  FileJson,
  GitCompare,
  History,
  Plus,
  Printer,
  Receipt,
  Settings,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';

type TabId = 'nf' | 'rateio' | 'cenarios' | 'resultado' | 'config';
type DataSource = 'nfe' | 'api' | 'manual';
type RateioMode = 'custo' | 'venda' | 'qty' | 'peso';
type ScopeMode = 'todos' | 'alvo';

interface RateioItem {
  sku: string;
  desc: string;
  ncm: string;
  custo: number;
  preco: number;
  qty: number;
  un: string;
  margemProposta?: number;
  importedFromProposal?: boolean;
  operationType?: 'venda' | 'locacao' | 'servicos';
  period?: number;
}

interface Expense {
  tipo: string;
  desc: string;
  valor: number;
  metodo: RateioMode;
  pagador: string;
  conta: string;
}

interface ResultItem {
  prod: RateioItem;
  rat: number;
  expenseRat: number;
  ratUnit: number;
  novoCusto: number;
  mgAnt: number;
  mgNova: number;
  totC: number;
  totV: number;
  part: number;
  delta: number;
  sourceCostTotal?: number;
  composedSourceSkus?: string[];
  compositionRole?: 'target' | 'source';
  composedTargetSkus?: string[];
}

interface RateioResult {
  results: ResultItem[];
  avgMgAnt: number;
  avgMgNova: number;
  somaCheck: number;
  totalExp: number;
  diff: number;
  ok: boolean;
}

interface AuditEntry {
  ts: string;
  user: string;
  just: string;
  nfNum: string;
  mode: RateioMode;
  totalExp: number;
  avgAnt: number;
  avgNova: number;
  itens: number;
  ok: boolean;
  checksum: string;
  scopeLabel: string;
}

interface CompositionConfig {
  targetSkus: string[];
  sourceSkus: string[];
}

const DEMO_ITEMS: RateioItem[] = [
  { sku: 'NB-001', desc: 'Notebook Dell Latitude i7 16GB', ncm: '8471.30.12', custo: 3200, preco: 4800, qty: 3, un: 'UN' },
  { sku: 'MN-002', desc: 'Monitor LG UltraWide 34"', ncm: '8528.52.20', custo: 850, preco: 1350, qty: 8, un: 'UN' },
  { sku: 'TC-003', desc: 'Teclado Mecanico Corsair K70', ncm: '8471.60.52', custo: 320, preco: 580, qty: 15, un: 'UN' },
];

const DEMO_EXPENSES: Expense[] = [
  { tipo: 'Frete', desc: 'CIF - Transportadora Rapida', valor: 500, metodo: 'custo', pagador: 'Proprio', conta: '3.1.01.01' },
  { tipo: 'Seguro', desc: 'Seguro de carga NF #004521', valor: 120, metodo: 'venda', pagador: 'Proprio', conta: '3.1.01.02' },
];

const expenseTypes = ['Frete', 'Seguro', 'Imposto', 'Armazenagem', 'Desembaraco', 'Comissao', 'Outros'];
const rateioModes: RateioMode[] = ['custo', 'venda', 'qty', 'peso'];
const modeLabels: Record<RateioMode, string> = {
  custo: 'Por custo',
  venda: 'Por venda',
  qty: 'Por quantidade',
  peso: 'Peso manual',
};

const D = (value: number, decimals = 4) => Number((Number(value) || 0).toFixed(decimals));
const fmt = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const fmtRound = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value) || 0);
const pct = (value: number) => `${((Number(value) || 0) * 100).toFixed(2)}%`;
const cloneItems = () => DEMO_ITEMS.map(item => ({ ...item }));
const cloneExpenses = () => DEMO_EXPENSES.map(expense => ({ ...expense }));
const PRICING_SIMULATIONS_STORAGE_KEY = 'pre_sales_pricing_simulations_v1';

function calcRateio(
  items: RateioItem[],
  expenses: Expense[],
  manualWeights: Record<string, number>,
  scope: RateioItem[],
  composition?: CompositionConfig
): RateioResult {
  const merged = Object.fromEntries(items.map(item => [item.sku, {
    prod: item,
    totalRateado: 0,
    expenseRateado: undefined as number | undefined,
    sourceCostTotal: 0,
    composedSourceSkus: [] as string[],
    compositionRole: undefined as ResultItem['compositionRole'],
    composedTargetSkus: undefined as string[] | undefined,
  }]));
  const totalExp = D(expenses.reduce((sum, expense) => sum + D(expense.valor, 4), 0), 4);

  expenses.forEach(expense => {
    const baseFor = (item: RateioItem) => {
      if (expense.metodo === 'custo') return D(item.custo * item.qty, 4);
      if (expense.metodo === 'venda') return D(item.preco * item.qty, 4);
      if (expense.metodo === 'qty') return D(item.qty, 4);
      return D(manualWeights[item.sku] || 0, 4);
    };

    const totalBase = scope.reduce((sum, item) => sum + baseFor(item), 0);
    if (totalBase <= 0) return;

    let accumulated = 0;
    scope.forEach((item, index) => {
      const rateado = index === scope.length - 1
        ? D(expense.valor - accumulated, 4)
        : D((baseFor(item) / totalBase) * expense.valor, 4);
      if (index !== scope.length - 1) accumulated = D(accumulated + rateado, 4);
      merged[item.sku].totalRateado = D(merged[item.sku].totalRateado + rateado, 4);
    });
  });

  if (composition) {
    const targetBuckets = composition.targetSkus.map(sku => merged[sku]).filter(Boolean);
    const sourceBuckets = composition.sourceSkus.map(sku => merged[sku]).filter(Boolean);

    if (targetBuckets.length > 0) {
      // ── MÉDIA PONDERADA ──────────────────────────────────────────────────
      // Custo total dos componentes (itens fonte) — compartilhado entre TODOS os alvos
      const sourceCostTotal = D(sourceBuckets.reduce((sum, b) => sum + D(b.prod.custo * b.prod.qty, 4), 0), 4);

      // Despesas acessórias já rateadas nos itens do escopo
      const composedExpenseTotal = D(scope.reduce((sum, item) => sum + (merged[item.sku]?.totalRateado || 0), 0), 4);

      // Total a distribuir entre os alvos = custo componentes + despesas
      const composedTotal = D(sourceCostTotal + composedExpenseTotal, 4);

      // Base de ponderação: custo total de cada alvo (custo × qtd)
      // Se custo = 0, usa quantidade como fallback
      const targetCosts = targetBuckets.map(b => D(b.prod.custo * b.prod.qty, 4));
      const totalCostBase = targetCosts.reduce((s, v) => s + v, 0);
      const targetQtys = targetBuckets.map(b => b.prod.qty);
      const totalQtyBase = targetQtys.reduce((s, v) => s + v, 0);
      const useQty = totalCostBase === 0;
      const totalBase = useQty ? totalQtyBase : totalCostBase;

      // Zerar rateio dos itens fonte (eles compõem os alvos, não têm custo próprio no resultado)
      scope.forEach(item => {
        if (!composition.targetSkus.includes(item.sku) && merged[item.sku]) {
          merged[item.sku].totalRateado = 0;
          merged[item.sku].expenseRateado = 0;
          merged[item.sku].compositionRole = composition.sourceSkus.includes(item.sku) ? 'source' : undefined;
          merged[item.sku].composedTargetSkus = composition.targetSkus;
        }
      });

      // Distribuir proporcionalmente entre os alvos (média ponderada)
      let accTotal = 0, accExpense = 0, accSource = 0;
      targetBuckets.forEach((bucket, index) => {
        const base = useQty ? bucket.prod.qty : D(bucket.prod.custo * bucket.prod.qty, 4);
        const isLast = index === targetBuckets.length - 1;
        const weight = totalBase > 0 ? base / totalBase : 1 / targetBuckets.length;

        const allocTotal    = isLast ? D(composedTotal - accTotal, 4)         : D(weight * composedTotal, 4);
        const allocExpense  = isLast ? D(composedExpenseTotal - accExpense, 4) : D(weight * composedExpenseTotal, 4);
        const allocSource   = isLast ? D(sourceCostTotal - accSource, 4)      : D(weight * sourceCostTotal, 4);

        accTotal   = D(accTotal + allocTotal, 4);
        accExpense = D(accExpense + allocExpense, 4);
        accSource  = D(accSource + allocSource, 4);

        bucket.totalRateado    = allocTotal;
        bucket.expenseRateado  = allocExpense;
        bucket.sourceCostTotal = allocSource;
        bucket.composedSourceSkus = composition.sourceSkus;
        bucket.compositionRole = 'target';
      });
    }
  }

  let somaCheck = 0;
  const results = Object.values(merged).map(({ prod, totalRateado, expenseRateado, sourceCostTotal, composedSourceSkus, compositionRole, composedTargetSkus }) => {
    const rat = D(totalRateado, 4);
    const expenseRat = D(expenseRateado ?? totalRateado, 4);
    // ratUnit = adicional rateado por unidade. Em composição inclui componentes + despesas.
    const ratUnit = prod.qty > 0 ? D(rat / prod.qty, 4) : 0;
    // novoCusto é sempre custo unitário final: custo original + adicional unitário.
    const novoCusto = D(prod.custo + ratUnit, 4);
    const importedMargin = typeof prod.margemProposta === 'number' ? D(prod.margemProposta, 4) : undefined;
    const mgAnt = importedMargin ?? (prod.preco > 0 ? D((prod.preco - prod.custo) / prod.preco, 4) : 0);
    const mgNova = importedMargin ?? (prod.preco > 0 ? D((prod.preco - novoCusto) / prod.preco, 4) : 0);
    const totC = D(prod.custo * prod.qty, 4);
    const totV = D(prod.preco * prod.qty, 4);
    const part = totalExp > 0 ? D(expenseRat / totalExp, 4) : 0;
    somaCheck = D(somaCheck + expenseRat, 4);
    return {
      prod,
      rat,
      expenseRat,
      ratUnit,
      novoCusto,
      mgAnt,
      mgNova,
      totC,
      totV,
      part,
      delta: D(mgNova - mgAnt, 4),
      sourceCostTotal: D(sourceCostTotal || 0, 4),
      composedSourceSkus,
      compositionRole,
      composedTargetSkus,
    };
  });

  const effectiveResults = composition
    ? results.filter(item => item.compositionRole === 'target')
    : results;
  const effectiveTotalVenda = effectiveResults.reduce((sum, item) => sum + item.totV, 0);
  const avgMgAnt = effectiveTotalVenda > 0 ? D(effectiveResults.reduce((sum, item) => sum + item.mgAnt * item.totV, 0) / effectiveTotalVenda, 4) : 0;
  const avgMgNova = effectiveTotalVenda > 0 ? D(effectiveResults.reduce((sum, item) => sum + item.mgNova * item.totV, 0) / effectiveTotalVenda, 4) : 0;
  const diff = D(totalExp - somaCheck, 4);

  return { results, avgMgAnt, avgMgNova, somaCheck, totalExp, diff, ok: Math.abs(diff) < 0.02 };
}

export default function RateioPrecificacaoV2() {
  const [tab, setTab] = useState<TabId>('nf');
  const [source, setSource] = useState<DataSource>('nfe');
  const [items, setItems] = useState<RateioItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rateioMode, setRateioMode] = useState<RateioMode>('custo');
  const [manualWeights, setManualWeights] = useState<Record<string, number>>({});
  const [scopeMode, setScopeMode] = useState<ScopeMode>('todos');
  const [targetIndexes, setTargetIndexes] = useState<string[]>(['0']);
  const [sourceIndexes, setSourceIndexes] = useState<string[]>(['1', '2']);
  const [responsavel, setResponsavel] = useState('Joao Silva');
  const [justificativa, setJustificativa] = useState('Rateio de frete e seguro NF #004521 - Fornecedor: Tech Distribuidora Ltda');
  const [nf, setNf] = useState({
    numero: '004521',
    emitente: 'Tech Distribuidora Ltda',
    cnpj: '12.345.678/0001-90',
    data: '2026-05-28',
    cfop: '5102',
    natureza: 'Venda de Mercadorias',
    centroCusto: 'CC-03 - TI / Suprimentos',
  });
  const [newItem, setNewItem] = useState<RateioItem>({ sku: '', desc: '', ncm: '', custo: 0, preco: 0, qty: 1, un: 'UN' });
  const [showItemForm, setShowItemForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [preview, setPreview] = useState<RateioResult | null>(null);
  const [lastResult, setLastResult] = useState<RateioResult | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditUser, setAuditUser] = useState('');
  const [auditMode, setAuditMode] = useState('');
  const [configSubTab, setConfigSubTab] = useState<'geral' | 'auditoria' | 'arquitetura'>('geral');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [viewingRateio, setViewingRateio] = useState<any>(null);
  const [savedRateios, setSavedRateios] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('precifica_rateios_v2') || '[]'); } catch { return []; }
  });
  const [rateioName, setRateioName] = useState('Novo Rateio');

  const totals = useMemo(() => {
    const totalCost = items.reduce((sum, item) => sum + D(item.custo * item.qty, 4), 0);
    const totalSale = items.reduce((sum, item) => sum + D(item.preco * item.qty, 4), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + D(expense.valor, 4), 0);
    const hasProposalMargin = items.some(item => typeof item.margemProposta === 'number');
    const margin = hasProposalMargin && totalSale > 0
      ? D(items.reduce((sum, item) => sum + (item.margemProposta || 0) * D(item.preco * item.qty, 4), 0) / totalSale, 4)
      : totalSale > 0 ? D((totalSale - totalCost) / totalSale, 4) : 0;
    return { totalCost, totalSale, totalExpenses, margin, profit: D(totalSale - totalCost, 4) };
  }, [items, expenses]);

  const targetItems = targetIndexes
    .map(index => items[Number(index)])
    .filter((item): item is RateioItem => Boolean(item));
  const sourceItems = sourceIndexes
    .map(index => items[Number(index)])
    .filter((item): item is RateioItem => Boolean(item && !targetItems.some(target => target.sku === item.sku)));
  const scopedItems = useMemo(() => {
    if (scopeMode === 'todos') return items;
    if (targetItems.length === 0) return items;
    const bySku = new Map([...targetItems, ...sourceItems].map(item => [item.sku, item]));
    return Array.from(bySku.values());
  }, [items, scopeMode, targetItems, sourceItems]);
  const compositionConfig = scopeMode === 'alvo' && targetItems.length > 0
    ? { targetSkus: targetItems.map(item => item.sku), sourceSkus: sourceItems.map(item => item.sku) }
    : undefined;
  const scopeLabel = compositionConfig
    ? `${targetItems.map(item => item.sku).join(', ') || 'Alvo'} composto por ${sourceItems.map(item => item.sku).join(', ') || 'sem fontes'}`
    : 'Distribuir entre todos';

  const manualWeightSum = D(Object.values(manualWeights).reduce((sum, value) => sum + value, 0), 2);
  const filteredAudit = auditLog.filter(entry =>
    (!auditUser || entry.user.toLowerCase().includes(auditUser.toLowerCase())) &&
    (!auditMode || entry.mode === auditMode)
  );

  const setGlobalMode = (mode: RateioMode) => {
    setRateioMode(mode);
    setExpenses(current => current.map(expense => ({ ...expense, metodo: mode })));
  };

  const loadDemo = () => {
    setItems(cloneItems());
    setExpenses(cloneExpenses());
    setManualWeights({});
    setScopeMode('todos');
    setTargetIndexes(['0']);
    setSourceIndexes(['1', '2']);
    setPreview(null);
    setMessage({ type: 'ok', text: 'Dados demo carregados com 3 itens e 2 despesas acessorias.' });
  };

  const clearAll = () => {
    setItems([]);
    setExpenses([]);
    setManualWeights({});
    setPreview(null);
    setLastResult(null);
    setScopeMode('todos');
    setTargetIndexes([]);
    setSourceIndexes([]);
    setMessage(null);
  };

  const addItem = () => {
    const sku = newItem.sku.trim() || `SKU-${String(items.length + 1).padStart(3, '0')}`;
    const desc = newItem.desc.trim();
    if (!desc) return setMessage({ type: 'err', text: 'Informe a descricao do produto.' });
    if (newItem.custo < 0) return setMessage({ type: 'err', text: 'Custo unitario invalido ou negativo.' });
    if (newItem.preco <= 0) return setMessage({ type: 'err', text: 'Preco de venda deve ser maior que zero.' });
    if (newItem.qty <= 0) return setMessage({ type: 'err', text: 'Quantidade deve ser maior que zero.' });

    setItems(current => [...current, {
      ...newItem,
      sku,
      desc,
      ncm: newItem.ncm.trim() || '-',
      custo: D(newItem.custo, 4),
      preco: D(newItem.preco, 4),
      qty: Math.floor(newItem.qty),
    }]);
    setNewItem({ sku: '', desc: '', ncm: '', custo: 0, preco: 0, qty: 1, un: 'UN' });
    setShowItemForm(false);
    setMessage(newItem.preco < newItem.custo
      ? { type: 'warn', text: 'Item incluido, mas o preco de venda esta menor que o custo.' }
      : null);
  };

  const updateExpense = (index: number, patch: Partial<Expense>) => {
    setExpenses(current => current.map((expense, currentIndex) =>
      currentIndex === index ? { ...expense, ...patch } : expense
    ));
  };

  const removeItem = (index: number) => {
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
    const reindex = (values: string[]) => values
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value !== index)
      .map(value => String(value > index ? value - 1 : value));
    setTargetIndexes(current => reindex(current));
    setSourceIndexes(current => reindex(current));
  };

  const runPreview = () => {
    if (!items.length) return window.alert('Adicione itens na aba NF-e.');
    if (scopeMode === 'alvo' && targetItems.length === 0) return window.alert('Selecione ao menos um produto alvo.');
    if (scopeMode === 'alvo' && sourceItems.length === 0) return window.alert('Selecione ao menos um produto para compor o custo do alvo.');
    const result = calcRateio(items, expenses, manualWeights, scopedItems, compositionConfig);
    setPreview(result);
  };

  const executeRateio = () => {
    if (!items.length) return window.alert('Adicione itens na aba NF-e.');
    if (scopeMode === 'alvo' && targetItems.length === 0) return window.alert('Selecione ao menos um produto alvo.');
    if (scopeMode === 'alvo' && sourceItems.length === 0) return window.alert('Selecione ao menos um produto para compor o custo do alvo.');
    const result = calcRateio(items, expenses, manualWeights, scopedItems, compositionConfig);
    setLastResult(result);
    setAuditLog(current => [{
      ts: new Date().toLocaleString('pt-BR'),
      user: responsavel || 'Sistema',
      just: justificativa,
      nfNum: nf.numero || '-',
      mode: rateioMode,
      totalExp: result.totalExp,
      avgAnt: result.avgMgAnt,
      avgNova: result.avgMgNova,
      itens: result.results.length,
      ok: result.ok,
      checksum: `SHA256-${Math.random().toString(36).slice(2, 14).toUpperCase()}`,
      scopeLabel,
    }, ...current]);
    setTab('resultado');
  };

  const scenarioResults = useMemo(() => {
    if (!items.length || !expenses.length) return [];
    return rateioModes.map(mode => ({
      mode,
      label: modeLabels[mode],
      result: calcRateio(items, expenses.map(expense => ({ ...expense, metodo: mode })), manualWeights, items),
    }));
  }, [items, expenses, manualWeights]);

  const downloadFile = (filename: string, content: string, type: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportJSON = () => {
    if (!lastResult) return window.alert('Execute um rateio primeiro.');
    downloadFile(`rateio_${Date.now()}.json`, JSON.stringify({
      metadata: {
        sistema: 'Modulo de Rateio & Precificacao Enterprise v2.0',
        exportado_em: new Date().toISOString(),
        nf_numero: nf.numero,
        nf_emitente: nf.emitente,
        usuario: responsavel,
        justificativa,
      },
      modo_rateio: rateioMode,
      escopo: scopeLabel,
      despesas: expenses,
      itens_originais: items,
      resultado: lastResult,
    }, null, 2), 'application/json');
  };

  const exportCSV = () => {
    if (!lastResult) return window.alert('Execute um rateio primeiro.');
    const rows = [
      ['SKU', 'Descricao', 'NCM', 'Valor Orig. Unit.', 'Valor Componentes', 'Valor Rateado Total', 'Desp. Acessoria', 'Valor Rateado Unit.', 'Valor Final Unit.', 'Margem Proposta %', 'Participacao %', 'Qtd'],
      ...lastResult.results.map(item => [
        item.prod.sku,
        item.prod.desc,
        item.prod.ncm,
        item.prod.custo.toFixed(4),
        (item.sourceCostTotal || 0).toFixed(4),
        item.rat.toFixed(4),
        item.expenseRat.toFixed(4),
        item.ratUnit.toFixed(4),
        item.novoCusto.toFixed(4),
        (item.mgNova * 100).toFixed(4),
        (item.part * 100).toFixed(4),
        String(item.prod.qty),
      ]),
    ];
    downloadFile(`rateio_${Date.now()}.csv`, rows.map(row => row.join(';')).join('\n'), 'text/csv;charset=utf-8;');
  };

  // ── NOVO RATEIO ──
  const novoRateio = () => {
    setItems([]);
    setExpenses([]);
    setPreview(null);
    setLastResult(null);
    setAuditLog([]);
    setRateioName('Novo Rateio');
    setManualWeights({});
    setScopeMode('todos');
    setTargetIndexes([]);
    setSourceIndexes([]);
    setNf({ numero: '', emitente: '', cnpj: '', data: '', cfop: '', natureza: '', centroCusto: '' });
    setResponsavel('');
    setJustificativa('');
    setMessage(null);
    setTab('nf');
  };

  // ── IMPORTAR PROPOSTA ──
  const importarProposta = (proposal: any) => {
    const isLocacao = proposal.operationType === 'locacao';
    const proposalPeriod = Number(proposal.rentalPeriod || proposal.contractTermMonths || proposal.period || 0);

    const novosItens: RateioItem[] = proposal.quoteItems.map((item: any, i: number) => {
      // Locação: custo e preço = mensalidade unitária (item.price = mensalidade/un)
      // Venda: custo = baseCost, preço = price unitário
      const precoUnit = D(item.price, 2);          // preço unitário já precificado pela proposta
      const custoUnit = isLocacao
        ? precoUnit                                // locação importada usa valor comercial mensal como base do rateio
        : D(item.baseCost || precoUnit, 2);
      const margemProposta = typeof proposal.desiredMargin === 'number'
        ? D(proposal.desiredMargin / 100, 4)
        : undefined;

      return {
        sku: `PROP-${proposal.proposalNumber}-${i + 1}`,
        desc: item.description,
        ncm: '8471.30.19',
        custo: custoUnit,
        preco: precoUnit,
        qty: item.quantity,
        un: isLocacao ? '/mês' : 'UN',
        margemProposta,
        importedFromProposal: true,
        operationType: proposal.operationType,
        period: Number(item.period || proposalPeriod || 0),
      };
    });

    setItems(novosItens);
    setManualWeights({});
    setScopeMode('todos');
    setTargetIndexes(novosItens[0] ? ['0'] : []);
    setSourceIndexes(novosItens.length > 1 ? novosItens.slice(1).map((_, index) => String(index + 1)) : []);
    setRateioName(`Proposta #${proposal.proposalNumber} - ${proposal.clientInfo?.company || proposal.clientInfo?.name}${isLocacao ? ` (locação)` : ''}`);
    setNf(prev => ({
      ...prev,
      numero: proposal.proposalNumber,
      emitente: proposal.clientInfo?.company || proposal.clientInfo?.name || '',
      data: proposal.createdAt?.slice(0, 10) || prev.data,
      natureza: isLocacao ? 'Locacao de Equipamentos' : prev.natureza,
    }));
    setShowImportModal(false);
    setTab('nf');
  };

  // ── SALVAR RATEIO ──
  const salvarRateio = () => {
    if (!lastResult) return window.alert('Execute um rateio antes de salvar.');
    const novo = {
      id: Date.now(),
      nome: rateioName,
      data: new Date().toLocaleString('pt-BR'),
      snapshot: {
        items,
        expenses,
        rateioMode,
        manualWeights,
        scopeMode,
        targetIndexes,
        sourceIndexes,
        nf,
        responsavel,
        justificativa,
        proposal: {
          operationType: items.find(item => item.operationType)?.operationType,
          period: items.reduce((max, item) => Math.max(max, Number(item.period) || 0), 0),
        },
      },
      resultado: lastResult,
      resumo: {
        totalItens: items.length,
        totalDespesas: expenses.reduce((s, e) => s + e.valor, 0),
        totalCusto: totals.totalCost,
        totalVenda: totals.totalSale,
        margem: totals.margin,
      },
    };
    const updated = [novo, ...savedRateios];
    setSavedRateios(updated);
    localStorage.setItem('precifica_rateios_v2', JSON.stringify(updated));
    window.alert(`Rateio "${rateioName}" salvo com sucesso!`);
  };

  // ── CARREGAR RATEIO SALVO ──
  const carregarRateio = (r: any) => {
    setItems(r.snapshot.items);
    setExpenses(r.snapshot.expenses);
    setRateioMode(r.snapshot.rateioMode);
    setManualWeights(r.snapshot.manualWeights || {});
    setScopeMode(r.snapshot.scopeMode || 'todos');
    setTargetIndexes(r.snapshot.targetIndexes || []);
    setSourceIndexes(r.snapshot.sourceIndexes || []);
    setNf(r.snapshot.nf);
    setResponsavel(r.snapshot.responsavel);
    setJustificativa(r.snapshot.justificativa);
    setLastResult(r.resultado);
    setRateioName(r.nome);
    setShowSavedModal(false);
    setTab('resultado');
  };

  useEffect(() => {
    const pendingId = sessionStorage.getItem('precifica_rateio_to_load');
    if (!pendingId) return;

    const selected = savedRateios.find((rateio: any) => String(rateio.id) === pendingId);
    if (!selected) return;

    sessionStorage.removeItem('precifica_rateio_to_load');
    carregarRateio(selected);
  }, []);

  // ── EXCLUIR RATEIO SALVO ──
  const excluirRateio = (id: number) => {
    const updated = savedRateios.filter((r: any) => r.id !== id);
    setSavedRateios(updated);
    localStorage.setItem('precifica_rateios_v2', JSON.stringify(updated));
  };

  // ── IMPRIMIR PDF ──
  const imprimirPDF = (r: any) => {
    const res: RateioResult = r.resultado;
    const visibleResults = res.results.some((item: ResultItem) => item.compositionRole === 'target')
      ? res.results.filter((item: ResultItem) => item.compositionRole === 'target')
      : res.results;
    const isLocacao = r.snapshot?.proposal?.operationType === 'locacao'
      || r.snapshot?.items?.some((item: RateioItem) => item.operationType === 'locacao' || item.un === '/mês')
      || String(r.nome || '').toLowerCase().includes('loca');
    const periodMonths = Math.max(
      Number(r.snapshot?.proposal?.period) || 0,
      ...(r.snapshot?.items || []).map((item: RateioItem) => Number(item.period) || 0),
      ...visibleResults.map((item: ResultItem) => Number(item.prod.period) || 0),
      0,
    );
    const monthlyTotal = visibleResults.reduce((sum: number, item: ResultItem) => sum + D(item.novoCusto * item.prod.qty, 4), 0);
    const contractTotal = isLocacao && periodMonths > 0 ? monthlyTotal * periodMonths : 0;
    const linhas = visibleResults.map((item: ResultItem) => {
      const totalRateado = D(item.novoCusto * item.prod.qty, 4);
      return `
      <tr>
        <td>${item.prod.sku}</td>
        <td>${item.prod.desc}</td>
        <td style="text-align:center">${item.prod.qty}</td>
        <td style="text-align:right;font-family:monospace">R$ ${item.prod.preco.toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">R$ ${item.expenseRat.toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#d97706">R$ ${totalRateado.toFixed(2)}<br/><small>R$ ${item.novoCusto.toFixed(2)} x ${item.prod.qty}</small></td>
        <td style="text-align:right;font-family:monospace;color:#059669">R$ ${item.novoCusto.toFixed(2)}</td>
        <td style="text-align:center;color:#059669">${(item.mgNova * 100).toFixed(2)}%</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Rateio — ${r.nome}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;}
.header{background:linear-gradient(135deg,#1e3a5f,#0f766e);color:#fff;padding:24px 32px;}
.header h1{font-size:20px;font-weight:800;}
.content{padding:24px 32px;}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;}
.kpi-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;}
.kpi-value{font-size:16px;font-weight:800;font-family:monospace;margin-top:4px;}
table{width:100%;border-collapse:collapse;font-size:11px;}
thead tr{background:#f1f5f9;}
th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;}
td{padding:8px 10px;border-bottom:1px solid #e2e8f0;}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>
<div class="header">
  <h1>📊 Rateio de Despesas — ${r.nome}</h1>
  <p style="font-size:11px;opacity:0.8;margin-top:4px;">NF: ${r.snapshot.nf.numero} · ${r.snapshot.nf.emitente} · Salvo: ${r.data}</p>
</div>
<div class="content">
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Total Itens</div><div class="kpi-value">${r.resumo.totalItens}</div></div>
    <div class="kpi"><div class="kpi-label">Total Despesas</div><div class="kpi-value" style="color:#dc2626">R$ ${r.resumo.totalDespesas.toFixed(2)}</div></div>
    <div class="kpi"><div class="kpi-label">Valor Original</div><div class="kpi-value" style="color:#d97706">R$ ${r.resumo.totalVenda.toFixed(2)}</div></div>
    <div class="kpi"><div class="kpi-label">Margem Proposta</div><div class="kpi-value" style="color:#059669">${(r.resumo.margem * 100).toFixed(2)}%</div></div>
  </div>
  <table>
    <thead><tr>
      <th>SKU</th><th>Descrição</th><th style="text-align:center">Qtd</th>
        <th style="text-align:right">Valor Orig. Unit.</th><th style="text-align:right">Despesa Rat.</th>
        <th style="text-align:right">Valor Rateado Total</th><th style="text-align:right">Valor Unit.</th><th style="text-align:center">Margem Proposta</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right;font-weight:800;text-transform:uppercase;">${isLocacao ? 'Cálculo mensal' : 'Total rateado'}</td>
        <td style="text-align:right;font-family:monospace;font-weight:800;color:#d97706">R$ ${monthlyTotal.toFixed(2)}</td>
        <td colspan="2"></td>
      </tr>
      ${isLocacao ? `<tr>
        <td colspan="5" style="text-align:right;font-weight:800;text-transform:uppercase;">Contrato${periodMonths > 0 ? ` (${periodMonths} meses)` : ''}</td>
        <td style="text-align:right;font-family:monospace;font-weight:800;color:#059669">${periodMonths > 0 ? `R$ ${contractTotal.toFixed(2)}` : '-'}</td>
        <td colspan="2"></td>
      </tr>` : ''}
    </tfoot>
  </table>
  <div class="footer"><p><strong>Precifica</strong> · Sistema de Precificação TI · precifica.chorstconsult.com.br</p></div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="rp-app">
      <style>{styles}</style>

      <header className="rp-header">
        <div>
          <div className="rp-brand"><Calculator size={22} /> Sistema de Rateio & Precificacao <span>Enterprise v2.0</span></div>
          <div className="rp-sub">NF-e, despesas acessorias, simulacao de cenarios e auditoria de margem.</div>
        </div>
        <div className="rp-actions">
          <span className="rp-badge rp-blue" style={{fontFamily:'monospace',fontSize:'11px'}}>{rateioName}</span>
          <button className="rp-btn" style={{background:'#7c3aed',color:'#fff'}} onClick={novoRateio}><Plus size={15} /> Novo Rateio</button>
          <button className="rp-btn rp-btn-light" onClick={() => setShowImportModal(true)}><Receipt size={15} /> Importar Proposta</button>
          <button className="rp-btn rp-btn-light" onClick={salvarRateio}><Check size={15} /> Salvar</button>
          <button className="rp-btn rp-btn-light" onClick={() => setShowSavedModal(true)}><History size={15} /> Salvos ({savedRateios.length})</button>
          <button className="rp-btn rp-btn-light" onClick={exportJSON}><FileJson size={15} /> JSON</button>
          <button className="rp-btn rp-btn-light" onClick={exportCSV}><Download size={15} /> CSV</button>
        </div>
      </header>

      <nav className="rp-nav">
        {[
          ['nf', 'NF-e / Itens', Boxes],
          ['rateio', 'Rateio', Calculator],
          ['cenarios', 'Cenarios', GitCompare],
          ['resultado', 'Resultado', BarChart3],
          ['config', 'Config', Settings],
        ].map(([id, label, Icon]) => (
          <button key={id as string} className={`rp-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id as TabId)}>
            {React.createElement(Icon as typeof Boxes, { size: 15 })} {label as string}
          </button>
        ))}
      </nav>

      <main className="rp-main">
        {tab === 'nf' && (
          <>
            <Wizard step={1} />
            <section className="rp-card">
              <div className="rp-card-head">
                <h3>Fonte de dados</h3>
                <div className="rp-segment">
                  {(['nfe', 'api', 'manual'] as DataSource[]).map(option => (
                    <button key={option} className={source === option ? 'active' : ''} onClick={() => setSource(option)}>
                      {option === 'nfe' ? 'XML NF-e' : option === 'api' ? 'API ERP' : 'Manual'}
                    </button>
                  ))}
                </div>
              </div>

              {source === 'nfe' && (
                <>
                  <div className="rp-grid rp-grid-3">
                    <Field label="Numero NF" value={nf.numero} onChange={value => setNf({ ...nf, numero: value })} />
                    <Field label="Emitente / Fornecedor" value={nf.emitente} onChange={value => setNf({ ...nf, emitente: value })} />
                    <Field label="CNPJ Emitente" value={nf.cnpj} onChange={value => setNf({ ...nf, cnpj: value })} />
                  </div>
                  <div className="rp-grid rp-grid-4">
                    <Field label="Data Emissao" type="date" value={nf.data} onChange={value => setNf({ ...nf, data: value })} />
                    <Field label="CFOP" value={nf.cfop} onChange={value => setNf({ ...nf, cfop: value })} />
                    <Field label="Natureza Operacao" value={nf.natureza} onChange={value => setNf({ ...nf, natureza: value })} />
                    <label className="rp-field">Centro de Custo
                      <select value={nf.centroCusto} onChange={event => setNf({ ...nf, centroCusto: event.target.value })}>
                        <option>CC-01 - Comercial</option>
                        <option>CC-02 - Estoque Central</option>
                        <option>CC-03 - TI / Suprimentos</option>
                        <option>CC-04 - Operacoes</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              {source === 'api' && (
                <div className="rp-alert info">
                  Endpoint configurado: <code>GET /api/v1/products</code>. Use o botao abaixo para carregar dados simulados do ERP.
                  <div className="rp-row"><button className="rp-btn rp-success" onClick={loadDemo}>Importar do ERP</button></div>
                </div>
              )}
              {source === 'manual' && <div className="rp-alert warn">Modo manual: insira os itens abaixo. Custo e preco de venda sao obrigatorios.</div>}
            </section>

            <section className="rp-card">
              <div className="rp-card-head">
                <h3>Itens da nota</h3>
                <div className="rp-actions">
                  <button className="rp-btn" onClick={() => setShowItemForm(value => !value)}><Plus size={15} /> Adicionar item</button>
                  <button className="rp-btn rp-danger" onClick={clearAll}><Trash2 size={15} /> Limpar tudo</button>
                </div>
              </div>

              {showItemForm && (
                <div className="rp-form-panel">
                  <div className="rp-grid rp-grid-3">
                    <Field label="Codigo / SKU" value={newItem.sku} onChange={value => setNewItem({ ...newItem, sku: value })} />
                    <Field label="Descricao do produto / servico" value={newItem.desc} onChange={value => setNewItem({ ...newItem, desc: value })} wide />
                    <Field label="NCM" value={newItem.ncm} onChange={value => setNewItem({ ...newItem, ncm: value })} />
                    <Field label="Custo Unit. (R$)" type="number" value={newItem.custo} onChange={value => setNewItem({ ...newItem, custo: Number(value) })} />
                    <Field label="Preco Venda (R$)" type="number" value={newItem.preco} onChange={value => setNewItem({ ...newItem, preco: Number(value) })} />
                    <Field label="Quantidade" type="number" value={newItem.qty} onChange={value => setNewItem({ ...newItem, qty: Number(value) })} />
                    <label className="rp-field">Un. Medida
                      <select value={newItem.un} onChange={event => setNewItem({ ...newItem, un: event.target.value })}>
                        {['UN', 'CX', 'KG', 'LT', 'M', 'PC'].map(unit => <option key={unit}>{unit}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="rp-row">
                    <button className="rp-btn rp-primary" onClick={addItem}><Check size={15} /> Confirmar</button>
                    <button className="rp-btn" onClick={() => setShowItemForm(false)}>Cancelar</button>
                  </div>
                </div>
              )}

              {message && <div className={`rp-alert ${message.type}`}>{message.text}</div>}
              <ItemsTable items={items} totals={totals} onRemove={removeItem} />
            </section>

            <KpiGrid totals={totals} itemCount={items.length} />
            <div className="rp-row"><button className="rp-btn rp-primary" onClick={() => setTab('rateio')}>Continuar para Despesas Acessorias</button></div>
          </>
        )}

        {tab === 'rateio' && (
          <>
            <Wizard step={2} />
            <section className="rp-card">
              <div className="rp-card-head">
                <h3>Despesas acessorias / Custos adicionais</h3>
                <button className="rp-btn" onClick={() => setExpenses(current => [...current, { tipo: 'Frete', desc: '', valor: 0, metodo: rateioMode, pagador: 'Proprio', conta: '3.1.01.01' }])}>
                  <Plus size={15} /> Nova despesa
                </button>
              </div>
              <div className="rp-alert info">Multiplas despesas com criterios independentes por linha. Cada despesa pode ter metodo de distribuicao e conta contabil proprios.</div>
              <ExpensesTable expenses={expenses} onChange={updateExpense} onRemove={index => setExpenses(current => current.filter((_, expenseIndex) => expenseIndex !== index))} />
            </section>

            <section className="rp-card">
              <div className="rp-card-head"><h3>Criterio de rateio principal</h3></div>
              <div className="rp-mode-grid">
                <ModeCard mode="custo" active={rateioMode === 'custo'} title="Por Custo de Entrada" text="Proporcional ao custo unitario x quantidade." onClick={() => setGlobalMode('custo')} />
                <ModeCard mode="venda" active={rateioMode === 'venda'} title="Por Valor de Venda" text="Proporcional ao preco de venda x quantidade." onClick={() => setGlobalMode('venda')} />
                <ModeCard mode="qty" active={rateioMode === 'qty'} title="Por Quantidade" text="Divide a despesa por unidade fisica." onClick={() => setGlobalMode('qty')} />
                <ModeCard mode="peso" active={rateioMode === 'peso'} title="Pesos Manuais (%)" text="Percentual definido manualmente por SKU." onClick={() => setGlobalMode('peso')} />
              </div>
            </section>

            {rateioMode === 'peso' && (
              <section className="rp-card">
                <div className="rp-card-head">
                  <h3>Pesos manuais por item</h3>
                  <span className={`rp-badge ${Math.abs(manualWeightSum - 100) < 0.01 ? 'rp-green' : 'rp-amber'}`}>Soma = {manualWeightSum}%</span>
                </div>
                <div className="rp-weight-list">
                  {items.map(item => (
                    <label key={item.sku} className="rp-weight">
                      <span className="rp-badge rp-blue">{item.sku}</span>
                      <span>{item.desc}</span>
                      <input type="number" min="0" max="100" step="0.01" value={manualWeights[item.sku] ?? ''} onChange={event => setManualWeights({ ...manualWeights, [item.sku]: D(Number(event.target.value), 4) })} />
                    </label>
                  ))}
                </div>
              </section>
            )}

            <section className="rp-card">
              <div className="rp-card-head">
                <h3>Definicao do escopo de rateio</h3>
                <div className="rp-segment">
                  <button className={scopeMode === 'todos' ? 'active' : ''} onClick={() => setScopeMode('todos')}>Distribuir entre todos</button>
                  <button className={scopeMode === 'alvo' ? 'active' : ''} onClick={() => setScopeMode('alvo')}>Produto alvo + composicao</button>
                </div>
              </div>

              {scopeMode === 'todos' ? (
                <div className="rp-alert info">O frete, seguro e demais despesas serao rateados entre todos os itens conforme o criterio selecionado.</div>
              ) : (
                <>
                  <div className="rp-alert warn">
                    Marque um ou mais produtos finais e os itens que compoem o custo deles. Exemplo: Notebook e outro kit como alvos, Monitor e Teclado como componentes.
                    O custo dos componentes + despesas acessorias sera distribuido entre os alvos proporcionalmente ao custo total de cada alvo.
                  </div>
                  <div className="rp-grid rp-grid-2">
                    <div className="rp-composition-summary">
                      <span>Produtos alvo</span>
                      <strong>{targetItems.length}</strong>
                      <small>{targetItems.length ? targetItems.map(item => item.sku).join(', ') : 'Nenhum alvo marcado'}</small>
                    </div>
                    <div className="rp-composition-summary">
                      <span>Itens componentes</span>
                      <strong>{sourceItems.length}</strong>
                      <small>{sourceItems.length ? sourceItems.map(item => item.sku).join(', ') : 'Nenhum componente marcado'}</small>
                    </div>
                  </div>
                  <div className="rp-scope-title">Produtos alvo</div>
                  <div className="rp-source-grid">
                    {items.map((item, index) => {
                      const value = String(index);
                      const checked = targetIndexes.includes(value);
                      const isSource = sourceIndexes.includes(value);
                      return (
                        <label key={item.sku} className={`rp-source-card ${checked ? 'active' : ''} ${isSource ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSource}
                            onChange={event => {
                              setTargetIndexes(current => event.target.checked
                                ? [...current, value]
                                : current.filter(currentValue => currentValue !== value));
                            }}
                          />
                          <span className="rp-badge rp-blue">{item.sku}</span>
                          <strong>{item.desc}</strong>
                          <small>{fmt(item.custo)} x {item.qty} = {fmt(item.custo * item.qty)}</small>
                        </label>
                      );
                    })}
                  </div>
                  <div className="rp-scope-title">Itens que compoem os alvos</div>
                  <div className="rp-source-grid">
                    {items.map((item, index) => {
                      const value = String(index);
                      const isTarget = targetIndexes.includes(value);
                      const checked = sourceIndexes.includes(value);
                      return (
                        <label key={item.sku} className={`rp-source-card ${checked ? 'active' : ''} ${isTarget ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isTarget}
                            onChange={event => {
                              setSourceIndexes(current => event.target.checked
                                ? [...current, value]
                                : current.filter(currentValue => currentValue !== value));
                            }}
                          />
                          <span className="rp-badge rp-blue">{item.sku}</span>
                          <strong>{item.desc}</strong>
                          <small>{fmt(item.custo)} x {item.qty} = {fmt(item.custo * item.qty)}</small>
                        </label>
                      );
                    })}
                  </div>
                  {targetItems.length > 0 && sourceItems.length > 0 && (
                    <CompositionEstimate targets={targetItems} sources={sourceItems} expenses={expenses} />
                  )}
                </>
              )}

              <div className="rp-grid rp-grid-2 rp-scope-users">
                <Field label="Usuario responsavel" value={responsavel} onChange={setResponsavel} />
                <Field label="Justificativa / Historico contabil" value={justificativa} onChange={setJustificativa} />
              </div>
            </section>

            {preview && <ResultTable result={preview} compact title="Pre-visualizacao do rateio" />}
            <div className="rp-row">
              <button className="rp-btn" onClick={runPreview}>Pre-visualizar</button>
              <button className="rp-btn rp-primary" onClick={executeRateio}><Check size={15} /> Executar Rateio</button>
              <button className="rp-btn" onClick={() => setTab('cenarios')}>Comparar cenarios</button>
            </div>
          </>
        )}

        {tab === 'cenarios' && (
          <section className="rp-card">
            <div className="rp-card-head"><h3>Comparador de cenarios - 4 metodos simultaneos</h3></div>
            {scenarioResults.length === 0 ? (
              <div className="rp-alert warn">Carregue os itens e despesas primeiro.</div>
            ) : (
              <ScenarioTable items={items} scenarios={scenarioResults} />
            )}
          </section>
        )}

        {tab === 'resultado' && (
          <>
            {!lastResult ? (
              <div className="rp-alert warn">Nenhum rateio executado ainda. Acesse a aba Rateio e clique em Executar Rateio.</div>
            ) : (
              <>
                <div className="rp-actions rp-result-actions">
                  <button className="rp-btn" onClick={exportJSON}><FileJson size={15} /> JSON</button>
                  <button className="rp-btn" onClick={exportCSV}><Download size={15} /> CSV</button>
                  <button className="rp-btn" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
                </div>
                <ResultKpis result={lastResult} />
                <ResultTable result={lastResult} title="Comparativo antes x depois do rateio" />
                <Integrity result={lastResult} expenses={expenses} items={items} auditLog={auditLog} />
              </>
            )}
          </>
        )}

        {tab === 'config' && (
          <>
            {/* Sub-tabs dentro de Config */}
            <div style={{display:'flex',gap:'8px',marginBottom:'16px',borderBottom:'1px solid #334155',paddingBottom:'8px'}}>
              {[
                ['geral','Configurações Gerais',Settings],
                ['auditoria','Auditoria',History],
                ['arquitetura','Arquitetura',ShieldCheck],
              ].map(([id,label,Icon]) => (
                <button key={id as string}
                  className={`rp-tab ${configSubTab === id ? 'active' : ''}`}
                  style={{fontSize:'12px',padding:'6px 14px'}}
                  onClick={() => setConfigSubTab(id as any)}>
                  {React.createElement(Icon as typeof Settings, {size:13})} {label as string}
                </button>
              ))}
            </div>
            {configSubTab === 'geral' && <ConfigPanel />}
            {configSubTab === 'auditoria' && (
              <div className="rp-side">
                <section className="rp-card">
                  <div className="rp-card-head"><h3>Configuracoes de auditoria</h3></div>
                  <div className="rp-grid rp-grid-2">
                    <div className="rp-field"><label>Responsavel</label><input className="rp-input" value={responsavel} onChange={e => setResponsavel(e.target.value)} /></div>
                    <div className="rp-field"><label>Justificativa</label><input className="rp-input" value={justificativa} onChange={e => setJustificativa(e.target.value)} /></div>
                  </div>
                </section>
                <section className="rp-card">
                  <div className="rp-card-head">
                    <h3>Log de auditoria</h3>
                    <button className="rp-btn rp-danger" onClick={() => setAuditLog([])}><Trash2 size={15} /> Limpar log</button>
                  </div>
                  {auditLog.length === 0
                    ? <p style={{color:'#64748b',fontSize:'13px',padding:'12px 0'}}>Nenhuma entrada de auditoria registrada.</p>
                    : auditLog.map((entry, i) => (
                      <div key={i} className="rp-audit-entry">
                        <span className="rp-audit-ts">{entry.ts}</span>
                        <span>{entry.user} - {entry.scopeLabel} - {entry.just}</span>
                        <code className="rp-audit-hash">{entry.checksum}</code>
                      </div>
                    ))
                  }
                </section>
              </div>
            )}
            {configSubTab === 'arquitetura' && <ArchitecturePanel />}
          </>
        )}
      </main>

      {/* Modais */}
      {showImportModal && (
        <ImportPropostaModal
          onImport={importarProposta}
          onClose={() => setShowImportModal(false)}
        />
      )}
      {showSavedModal && (
        <SavedRateiosModal
          savedRateios={savedRateios}
          onLoad={carregarRateio}
          onDelete={excluirRateio}
          onPrint={imprimirPDF}
          onClose={() => setShowSavedModal(false)}
        />
      )}

      <footer className="rp-footer">
        <span>Sistema de Rateio & Precificacao Enterprise v2.0</span>
        <span>Engine React + TypeScript | Auditoria com checksum | Exportacao JSON/CSV</span>
      </footer>
    </div>
  );
}

function CompositionEstimate({ targets, sources, expenses }: { targets: RateioItem[]; sources: RateioItem[]; expenses: Expense[] }) {
  const sourceTotal = D(sources.reduce((sum, item) => sum + D(item.custo * item.qty, 4), 0), 4);
  const expenseTotal = D(expenses.reduce((sum, expense) => sum + D(expense.valor, 4), 0), 4);
  const compositionTotal = D(sourceTotal + expenseTotal, 4);
  const targetCostBase = targets.reduce((sum, item) => sum + D(item.custo * item.qty, 4), 0);
  const targetQtyBase = targets.reduce((sum, item) => sum + item.qty, 0);
  const totalBase = targetCostBase > 0 ? targetCostBase : targetQtyBase;

  return (
    <div className="rp-composition-box">
      <div>
        <span>Produtos alvo</span>
        <strong>{targets.map(item => item.sku).join(', ')}</strong>
      </div>
      <div>
        <span>Custo componentes</span>
        <strong>{fmt(sourceTotal)}</strong>
      </div>
      <div>
        <span>Frete/seguro/despesas</span>
        <strong>{fmt(expenseTotal)}</strong>
      </div>
      {targets.map((target, index) => {
        const base = targetCostBase > 0 ? D(target.custo * target.qty, 4) : target.qty;
        const allocated = index === targets.length - 1
          ? D(compositionTotal - targets.slice(0, index).reduce((sum, item) => {
            const itemBase = targetCostBase > 0 ? D(item.custo * item.qty, 4) : item.qty;
            return sum + D((itemBase / totalBase) * compositionTotal, 4);
          }, 0), 4)
          : D((base / totalBase) * compositionTotal, 4);
        const composedUnit = target.qty > 0 ? D(target.custo + (allocated / target.qty), 4) : target.custo;
        return (
          <div key={target.sku}>
            <span>Custo unit. estimado {target.sku}</span>
            <strong>{fmt(composedUnit)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', wide = false }: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={`rp-field ${wide ? 'wide' : ''}`}>
      {label}
      <input type={type} value={value} step={type === 'number' ? '0.0001' : undefined} onChange={event => onChange(event.target.value)} />
    </label>
  );
}

function Wizard({ step }: { step: number }) {
  return (
    <div className="rp-wizard">
      {['NF-e / Itens', 'Despesas Acessorias', 'Rateio', 'Resultado'].map((label, index) => (
        <React.Fragment key={label}>
          <div className={`rp-wizard-step ${index + 1 === step ? 'active' : index + 1 < step ? 'done' : ''}`}>
            <span>{index + 1 < step ? <Check size={11} /> : index + 1}</span>{label}
          </div>
          {index < 3 && <div className="rp-wizard-line" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function KpiGrid({ totals, itemCount }: { totals: { totalCost: number; totalSale: number; totalExpenses: number; margin: number; profit: number }; itemCount: number }) {
  return (
    <div className="rp-kpi-grid">
      <Kpi label="Itens" value={String(itemCount)} />
      <Kpi label="Custo total" value={fmtRound(totals.totalCost)} />
      <Kpi label="Venda total" value={fmtRound(totals.totalSale)} highlight />
      <Kpi label="Margem media" value={pct(totals.margin)} tone={totals.margin > 0.2 ? 'ok' : totals.margin > 0.1 ? 'warn' : 'err'} />
      <Kpi label="Despesas" value={fmtRound(totals.totalExpenses)} tone="warn" />
      <Kpi label="Lucro bruto" value={fmtRound(totals.profit)} />
    </div>
  );
}

function Kpi({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: 'ok' | 'warn' | 'err' }) {
  return <div className={`rp-kpi ${highlight ? 'hi' : ''} ${tone || ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ItemsTable({ items, totals, onRemove }: { items: RateioItem[]; totals: { totalCost: number; totalSale: number; margin: number }; onRemove: (index: number) => void }) {
  return (
    <div className="rp-table-wrap">
      <table className="rp-table">
        <thead>
          <tr><th>SKU</th><th>Descricao</th><th>NCM</th><th className="num">C. Unit.</th><th className="num">P. Venda</th><th className="num">Qtd</th><th>Un</th><th className="num">C. Total</th><th className="num">V. Total</th><th className="num">Margem</th><th className="num">%NF</th><th /></tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={12} className="empty">Nenhum item. Clique em Dados demo ou adicione manualmente.</td></tr>}
          {items.map((item, index) => {
            const totalCost = D(item.custo * item.qty, 4);
            const totalSale = D(item.preco * item.qty, 4);
            const margin = item.preco > 0 ? D((item.preco - item.custo) / item.preco, 4) : 0;
            const nfPart = totals.totalSale > 0 ? D(totalSale / totals.totalSale, 4) : 0;
            return (
              <tr key={`${item.sku}-${index}`}>
                <td><span className="rp-badge rp-blue">{item.sku}</span></td>
                <td>{item.desc}</td>
                <td><code>{item.ncm}</code></td>
                <td className="num">{fmt(item.custo)}</td>
                <td className="num">{fmt(item.preco)}</td>
                <td className="num">{item.qty}</td>
                <td><span className="rp-badge rp-gray">{item.un}</span></td>
                <td className="num">{fmt(totalCost)}</td>
                <td className="num">{fmt(totalSale)}</td>
                <td className="num"><span className={`rp-badge ${margin < 0 ? 'rp-red' : margin < 0.15 ? 'rp-amber' : 'rp-green'}`}>{pct(margin)}</span></td>
                <td className="num">{pct(nfPart)}</td>
                <td><button className="rp-icon-btn danger" onClick={() => onRemove(index)}><X size={14} /></button></td>
              </tr>
            );
          })}
        </tbody>
        {items.length > 0 && <tfoot><tr><td colSpan={7}>TOTAL NF</td><td className="num">{fmt(totals.totalCost)}</td><td className="num">{fmt(totals.totalSale)}</td><td className="num">{pct(totals.margin)}</td><td colSpan={2} /></tr></tfoot>}
      </table>
    </div>
  );
}

function ExpensesTable({ expenses, onChange, onRemove }: { expenses: Expense[]; onChange: (index: number, patch: Partial<Expense>) => void; onRemove: (index: number) => void }) {
  const total = expenses.reduce((sum, expense) => sum + D(expense.valor, 4), 0);
  return (
    <div className="rp-table-wrap">
      <table className="rp-table">
        <thead><tr><th>Tipo</th><th>Descricao</th><th className="num">Valor (R$)</th><th>Metodo</th><th>Pagador</th><th>Conta</th><th /></tr></thead>
        <tbody>
          {expenses.length === 0 && <tr><td colSpan={7} className="empty">Nenhuma despesa. Clique em Nova despesa.</td></tr>}
          {expenses.map((expense, index) => (
            <tr key={`${expense.tipo}-${index}`}>
              <td><select value={expense.tipo} onChange={event => onChange(index, { tipo: event.target.value })}>{expenseTypes.map(type => <option key={type}>{type}</option>)}</select></td>
              <td><input value={expense.desc} onChange={event => onChange(index, { desc: event.target.value })} /></td>
              <td><input className="num-input" type="number" min="0" step="0.01" value={expense.valor} onChange={event => onChange(index, { valor: D(Number(event.target.value), 4) })} /></td>
              <td><select value={expense.metodo} onChange={event => onChange(index, { metodo: event.target.value as RateioMode })}>{rateioModes.map(mode => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></td>
              <td><select value={expense.pagador} onChange={event => onChange(index, { pagador: event.target.value })}>{['Proprio', 'Terceiro', 'Fornecedor'].map(payer => <option key={payer}>{payer}</option>)}</select></td>
              <td><input value={expense.conta} onChange={event => onChange(index, { conta: event.target.value })} /></td>
              <td><button className="rp-icon-btn danger" onClick={() => onRemove(index)}><X size={14} /></button></td>
            </tr>
          ))}
        </tbody>
        {expenses.length > 0 && <tfoot><tr><td colSpan={2}>Total despesas</td><td className="num">{fmt(total)}</td><td colSpan={4} /></tr></tfoot>}
      </table>
    </div>
  );
}

function ModeCard({ mode, active, title, text, onClick }: { mode: RateioMode; active: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button className={`rp-mode-card ${active ? 'active' : ''}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
      <small>{modeLabels[mode]}</small>
    </button>
  );
}

function ResultKpis({ result }: { result: RateioResult }) {
  const effectiveResults = result.results.some(item => item.compositionRole === 'target')
    ? result.results.filter(item => item.compositionRole === 'target')
    : result.results;
  const originalValue = effectiveResults.reduce((sum, item) => sum + item.totV, 0);
  const componentCost = effectiveResults.reduce((sum, item) => sum + (item.sourceCostTotal || 0), 0);
  const allocatedValue = effectiveResults.reduce((sum, item) => sum + D(item.novoCusto * item.prod.qty, 4), 0);
  const targetResult = result.results.find(item => item.compositionRole === 'target');
  return (
    <div className="rp-kpi-grid">
      <Kpi label="Desp. total rateada" value={fmtRound(result.totalExp)} tone="warn" />
      {targetResult && <Kpi label={`Valor unit. ${targetResult.prod.sku}`} value={fmt(targetResult.novoCusto)} highlight />}
      {targetResult && <Kpi label="Valor componentes" value={fmtRound(componentCost)} tone="warn" />}
      <Kpi label="Valor original" value={fmtRound(originalValue)} />
      <Kpi label="Valor rateado total" value={fmtRound(allocatedValue)} highlight />
      <Kpi label="Margem proposta" value={pct(result.avgMgNova)} tone="ok" />
    </div>
  );
}

function ResultTable({ result, compact = false, title }: { result: RateioResult; compact?: boolean; title: string }) {
  const hasComposition = result.results.some(item => item.compositionRole === 'target');
  // Mostrar apenas produtos alvo no resultado principal
  const displayItems = hasComposition
    ? result.results.filter(item => item.compositionRole === 'target')
    : result.results;

  return (
    <section className="rp-card">
      <div className="rp-card-head">
        <h3>{title}</h3>
        {hasComposition && (
          <span className="rp-badge rp-blue" style={{fontSize:'11px'}}>
            Exibindo apenas produtos alvo ({displayItems.length} de {result.results.length} itens)
          </span>
        )}
      </div>
      <div className="rp-table-wrap">
        <table className="rp-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th className="num">Qtd</th>
              <th className="num">Valor Orig.</th>
              {hasComposition && <th className="num">Valor Componentes</th>}
              <th className="num">{hasComposition ? 'Valor Rateado Total' : 'Desp. Rateada'}</th>
              {hasComposition && <th className="num">Desp. Acessoria</th>}
              <th className="num" style={{background:'#e8f0fb',color:'#1a4f8a'}}>Valor Unit. Rateado</th>
              <th className="num" style={{background:'#eaf4ee',color:'#2d7a4f'}}>Valor Total Rateado</th>
              {!compact && <>
                <th className="num">Margem Proposta</th>
              </>}
              <th className="num">Participacao</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.map(item => {
              const custoTotalFinal = D(item.novoCusto * item.prod.qty, 4);
              return (
                <tr key={item.prod.sku}>
                  <td><span className="rp-badge rp-blue">{item.prod.sku}</span></td>
                  <td>
                    {item.prod.desc}
                    {item.compositionRole === 'target' && item.composedSourceSkus && item.composedSourceSkus.length > 0 && (
                      <small className="rp-row-note">Inclui: {item.composedSourceSkus.join(', ')}</small>
                    )}
                  </td>
                  <td className="num">{item.prod.qty}</td>
                  <td className="num">{fmt(item.prod.preco)}</td>
                  {hasComposition && <td className="num">{item.sourceCostTotal ? fmt(item.sourceCostTotal) : '-'}</td>}
                  <td className="num strong-warn">{fmt(item.rat)}</td>
                  {hasComposition && <td className="num">{fmt(item.expenseRat)}</td>}
                  <td className="num" style={{background:'#f0f7ff'}}><strong>{fmt(item.novoCusto)}</strong></td>
                  <td className="num" style={{background:'#f0fdf4'}}>
                    <strong style={{color:'#2d7a4f'}}>{fmt(custoTotalFinal)}</strong>
                    <small className="rp-row-note">x {item.prod.qty} un.</small>
                  </td>
                  {!compact && <>
                    <td className="num"><span className="rp-badge rp-green">{pct(item.mgNova)}</span></td>
                  </>}
                  <td className="num">
                    <strong>{pct(item.part)}</strong>
                    <div className="rp-progress"><span style={{ width: `${Math.max(0, item.part * 100)}%` }} /></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {displayItems.length >= 1 && (
            <tfoot>
              <tr>
                <td colSpan={hasComposition ? 7 : 5} style={{textAlign:'right',fontWeight:800,fontSize:'12px',color:'#6b7280',textTransform:'uppercase'}}>
                  Total dos Alvos
                </td>
                <td className="num" style={{background:'#e8f0fb',fontWeight:800,color:'#1a4f8a',fontSize:'14px'}}>
                  {fmt(displayItems.reduce((s, i) => s + i.novoCusto, 0))}
                </td>
                <td className="num" style={{background:'#f0fdf4',fontWeight:800,color:'#2d7a4f',fontSize:'14px'}}>
                  {fmt(displayItems.reduce((s, i) => s + D(i.novoCusto * i.prod.qty, 4), 0))}
                </td>                {!compact && <td />}
                <td />
              </tr>
              <tr>
                <td colSpan={hasComposition ? 7 : 5} style={{textAlign:'right',fontSize:'11px',color:'#6b7280'}}>
                  Verificacao: valor rateado total dos produtos alvo
                </td>
                <td colSpan={2} style={{background:'#fef3dc',fontWeight:800,color:'#8a5a00',fontSize:'12px',textAlign:'right',padding:'6px 8px'}}>
                  {fmt(displayItems.reduce((s, i) => s + D(i.novoCusto * i.prod.qty, 4), 0))}
                </td>
                {!compact && <td />}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function ScenarioTable({ items, scenarios }: { items: RateioItem[]; scenarios: { mode: RateioMode; label: string; result: RateioResult }[] }) {
  return (
    <div className="rp-table-wrap">
      <table className="rp-table">
        <thead>
          <tr><th>SKU / Produto</th>{scenarios.map(scenario => <th key={scenario.mode} colSpan={3} className="num">{scenario.label}</th>)}</tr>
          <tr><th />{scenarios.map(scenario => <React.Fragment key={scenario.mode}><th className="num">Valor unit.</th><th className="num">Margem prop.</th><th className="num">Valor total</th></React.Fragment>)}</tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.sku}>
              <td><span className="rp-badge rp-blue">{item.sku}</span> {item.desc}</td>
              {scenarios.map(scenario => {
                const result = scenario.result.results.find(row => row.prod.sku === item.sku);
                return result ? (
                  <React.Fragment key={scenario.mode}>
                    <td className="num">{fmt(result.novoCusto)}</td>
                    <td className="num"><span className="rp-badge rp-green">{pct(result.mgNova)}</span></td>
                    <td className="num">{fmt(D(result.novoCusto * result.prod.qty, 4))}</td>
                  </React.Fragment>
                ) : <React.Fragment key={scenario.mode}><td>-</td><td>-</td><td>-</td></React.Fragment>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Integrity({ result, expenses, items, auditLog }: { result: RateioResult; expenses: Expense[]; items: RateioItem[]; auditLog: AuditEntry[] }) {
  const checks = [
    { ok: result.ok, label: 'Invariante de conservacao', detail: `Rateado ${fmtRound(result.somaCheck)} | Despesas ${fmtRound(result.totalExp)} | Delta ${fmtRound(result.diff)}` },
    { ok: true, label: 'Margem preservada da proposta', detail: pct(result.avgMgNova) },
    { ok: true, label: 'Valor rateado tratado como valor comercial', detail: 'Sem comparacao custo x preco de venda' },
    { ok: items.length > 0, label: 'Base de itens nao vazia', detail: `${items.length} item(ns)` },
    { ok: expenses.every(expense => expense.valor > 0), label: 'Todas as despesas com valor maior que zero', detail: '-' },
    { ok: Boolean(auditLog[0]?.checksum), label: 'Checksum de auditoria gerado', detail: auditLog[0]?.checksum || '-' },
  ];
  return (
    <section className="rp-card">
      <div className="rp-card-head"><h3>Validacoes de integridade do calculo</h3></div>
      {checks.map(check => (
        <div className="rp-detail-row" key={check.label}>
          <span><span className={`rp-badge ${check.ok ? 'rp-green' : 'rp-red'}`}>{check.ok ? 'OK' : 'Falha'}</span> {check.label}</span>
          <small>{check.detail}</small>
        </div>
      ))}
    </section>
  );
}

function ArchitecturePanel() {
  return (
    <section className="rp-card">
      <div className="rp-card-head"><h3>Arquitetura do modulo</h3></div>
      <div className="rp-grid rp-grid-3">
        <div className="rp-feature"><strong>Engine de rateio</strong><span>Calcula bases por custo, venda, quantidade ou pesos manuais, ajustando diferencas de arredondamento no ultimo item do escopo.</span></div>
        <div className="rp-feature"><strong>Auditoria</strong><span>Registra usuario, NF, justificativa, metodo, totais, integridade e checksum por operacao executada.</span></div>
        <div className="rp-feature"><strong>Exportacao</strong><span>Gera JSON estruturado e CSV com custos originais, despesa rateada, novo custo e margens por SKU.</span></div>
      </div>
      <pre className="rp-code">{`RateioSession {
  nf_numero: string
  modo_rateio: custo | venda | qty | peso
  despesas: Expense[]
  produtos_snapshot: Product[]
  resultado: {
    margem_ponderada_antes: decimal
    margem_ponderada_depois: decimal
    soma_rateada: decimal
    conservacao_ok: boolean
  }
}`}</pre>
    </section>
  );
}

function ConfigPanel() {
  return (
    <div className="rp-grid rp-grid-2">
      <section className="rp-card">
        <div className="rp-card-head"><h3>Dados da empresa</h3></div>
        <Field label="Razao Social" value="FJ Gestao de Riscos Ltda" onChange={() => undefined} />
        <Field label="CNPJ" value="XX.XXX.XXX/0001-XX" onChange={() => undefined} />
      </section>
      <section className="rp-card">
        <div className="rp-card-head"><h3>Precisao decimal</h3></div>
        <div className="rp-alert ok">Engine usa precisao fixa com 4 casas decimais e valida conservacao do total rateado.</div>
        <Field label="Conta contabil - Frete" value="3.1.01.01" onChange={() => undefined} />
      </section>
    </div>
  );
}

// ── MODAL IMPORTAR PROPOSTA ──────────────────────────────────────────────────
function ImportPropostaModal({ onImport, onClose }: { onImport: (p: any) => void; onClose: () => void }) {
  const [proposals, setProposals] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  React.useEffect(() => {
    try {
      const simulations = JSON.parse(localStorage.getItem(PRICING_SIMULATIONS_STORAGE_KEY) || '{}');
      const fromPricing = Object.values(simulations || {}).map((proposal: any) => ({
        ...proposal,
        id: proposal.proposalNumber,
        createdAt: proposal.savedAt,
        clientInfo: {
          name: proposal.clientName,
          company: proposal.clientName,
          document: proposal.clientDocument,
        },
        totalValue: (proposal.quoteItems || []).reduce((sum: number, item: any) => (
          sum + (Number(item.totalPrice) || Number(item.price) * Number(item.quantity) || 0)
        ), 0),
        quoteItems: (proposal.quoteItems || []).map((item: any) => ({
          ...item,
          price: Number(item.price) || 0,
          baseCost: Number(item.baseCost) || 0,
          quantity: Number(item.quantity) || 1,
        })),
      }));

      const legacy = JSON.parse(localStorage.getItem('savedProposals') || '[]');
      setProposals([...fromPricing, ...(Array.isArray(legacy) ? legacy : [])]);
    } catch {
      setProposals([]);
    }
  }, []);
  const filtered = proposals.filter(p =>
    p.proposalNumber?.includes(search) ||
    p.clientInfo?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.clientInfo?.company?.toLowerCase().includes(search.toLowerCase())
  );
  const typeLabel = (t: string) => ({ venda: 'Venda', locacao: 'Locação', servicos: 'Serviços' }[t] || t);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'16px'}}>
      <div style={{background:'#fff',borderRadius:'12px',width:'100%',maxWidth:'700px',maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <div style={{background:'linear-gradient(135deg,#1a4f8a,#0f766e)',color:'#fff',padding:'20px 24px',borderRadius:'12px 12px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:800}}>📋 Importar Proposta</div>
            <div style={{fontSize:'11px',opacity:0.8,marginTop:'2px'}}>Selecione uma proposta para usar como base do rateio</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:'6px',padding:'6px 10px',cursor:'pointer',fontSize:'16px'}}>✕</button>
        </div>
        <div style={{padding:'16px 24px',borderBottom:'1px solid #e2e6ed'}}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por número, cliente ou empresa..."
            style={{width:'100%',border:'1px solid #c8cfd9',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',boxSizing:'border-box'}} />
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 24px'}}>
          {filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:'32px',color:'#6b7280'}}>
              {proposals.length === 0 ? 'Nenhuma proposta salva. Crie propostas na Calculadora.' : 'Nenhuma proposta encontrada.'}
            </div>
          ) : filtered.map(p => (
            <div key={p.id} onClick={() => onImport(p)}
              style={{border:'1px solid #e2e6ed',borderRadius:'10px',padding:'14px 16px',marginBottom:'10px',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b7dd8', e.currentTarget.style.background = '#f0f7ff')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e6ed', e.currentTarget.style.background = '#fff')}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontWeight:800,fontSize:'14px',color:'#1a1f2e'}}>#{p.proposalNumber}</div>
                  <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>{p.clientInfo?.company || p.clientInfo?.name}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:800,color:'#1a4f8a',fontFamily:'monospace'}}>
                    {p.totalValue?.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}
                  </div>
                  <div style={{fontSize:'11px',color:'#6b7280'}}>{typeLabel(p.operationType)} · {p.quoteItems?.length} itens</div>
                </div>
              </div>
              <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'6px'}}>
                {new Date(p.createdAt).toLocaleDateString('pt-BR')} · Clique para importar
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:'12px 24px',borderTop:'1px solid #e2e6ed',textAlign:'right'}}>
          <button onClick={onClose} style={{border:'1px solid #c8cfd9',background:'#fff',borderRadius:'6px',padding:'8px 16px',cursor:'pointer',fontWeight:700}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL RATEIOS SALVOS ─────────────────────────────────────────────────────
function SavedRateiosModal({ savedRateios, onLoad, onDelete, onPrint, onClose }: {
  savedRateios: any[]; onLoad: (r: any) => void; onDelete: (id: number) => void; onPrint: (r: any) => void; onClose: () => void;
}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'16px'}}>
      <div style={{background:'#fff',borderRadius:'12px',width:'100%',maxWidth:'800px',maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <div style={{background:'linear-gradient(135deg,#4c1d95,#7c3aed)',color:'#fff',padding:'20px 24px',borderRadius:'12px 12px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:800}}>📁 Rateios Salvos</div>
            <div style={{fontSize:'11px',opacity:0.8,marginTop:'2px'}}>{savedRateios.length} rateio(s) salvo(s)</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:'6px',padding:'6px 10px',cursor:'pointer',fontSize:'16px'}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
          {savedRateios.length === 0 ? (
            <div style={{textAlign:'center',padding:'40px',color:'#6b7280'}}>Nenhum rateio salvo ainda. Execute um rateio e clique em "Salvar".</div>
          ) : savedRateios.map((r: any) => (
            <div key={r.id} style={{border:'1px solid #e2e6ed',borderRadius:'10px',padding:'16px',marginBottom:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                <div>
                  <div style={{fontWeight:800,fontSize:'14px',color:'#1a1f2e'}}>{r.nome}</div>
                  <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{r.data} · NF #{r.snapshot?.nf?.numero}</div>
                </div>
                <button onClick={() => onDelete(r.id)} style={{background:'transparent',border:'1px solid #efb7b7',color:'#8a2020',borderRadius:'6px',padding:'4px 8px',cursor:'pointer',fontSize:'11px',fontWeight:700}}>Excluir</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'12px'}}>
                {[
                  {label:'Itens',value:r.resumo?.totalItens},
                  {label:'Despesas',value:r.resumo?.totalDespesas?.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})},
                  {label:'Custo Total',value:r.resumo?.totalCusto?.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})},
                  {label:'Margem',value:`${((r.resumo?.margem||0)*100).toFixed(2)}%`},
                ].map((k,i) => (
                  <div key={i} style={{background:'#f8f9fb',border:'1px solid #e2e6ed',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                    <div style={{fontSize:'10px',color:'#6b7280',fontWeight:700,textTransform:'uppercase'}}>{k.label}</div>
                    <div style={{fontSize:'15px',fontWeight:800,marginTop:'4px',fontFamily:'monospace'}}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => onLoad(r)} style={{flex:1,background:'#e8f0fb',border:'1px solid #3b7dd8',color:'#1a4f8a',borderRadius:'6px',padding:'8px',cursor:'pointer',fontWeight:700,fontSize:'12px'}}>
                  ✏️ Carregar para Edição
                </button>
                <button onClick={() => onPrint(r)} style={{flex:1,background:'#eaf4ee',border:'1px solid #2d7a4f',color:'#2d7a4f',borderRadius:'6px',padding:'8px',cursor:'pointer',fontWeight:700,fontSize:'12px'}}>
                  🖨️ Imprimir PDF
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:'12px 24px',borderTop:'1px solid #e2e6ed',textAlign:'right'}}>
          <button onClick={onClose} style={{border:'1px solid #c8cfd9',background:'#fff',borderRadius:'6px',padding:'8px 16px',cursor:'pointer',fontWeight:700}}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

const styles = `.rp-app{min-height:100vh;background:#0b1120;color:#e2e8f0;font-family:Segoe UI,system-ui,-apple-system,sans-serif;font-size:13.5px}.rp-header{position:sticky;top:0;z-index:20;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#e2e8f0;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.4);border-bottom:1px solid rgba(255,255,255,.08)}.rp-brand{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#fff}.rp-brand span{font-size:11px;opacity:.65;background:rgba(255,255,255,.1);padding:2px 8px;border-radius:20px}.rp-sub{font-size:11px;opacity:.6;margin-top:2px;color:#94a3b8}.rp-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rp-nav{display:flex;overflow-x:auto;background:#0f172a;border-bottom:1px solid rgba(255,255,255,.08);padding:0 16px}.rp-tab{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#64748b;padding:11px 16px;border-bottom:3px solid transparent;white-space:nowrap;font-weight:600;font-size:12.5px;cursor:pointer}.rp-tab:hover{background:rgba(255,255,255,.05);color:#cbd5e1}.rp-tab.active{color:#38bdf8;border-bottom-color:#38bdf8}.rp-main{max-width:1280px;margin:0 auto;padding:20px 24px 42px}.rp-card{background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px 18px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)}.rp-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.rp-card h3{font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:0}.rp-grid{display:grid;gap:12px}.rp-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.rp-grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}.rp-field{display:flex;flex-direction:column;gap:4px;color:#94a3b8;font-size:11.5px;font-weight:700}.rp-field.wide{grid-column:span 2}.rp-field input,.rp-field select,.rp-table input,.rp-table select,.rp-weight input{border:1px solid rgba(255,255,255,.12);background:#1e293b;color:#e2e8f0;border-radius:6px;padding:7px 9px;font-size:13px;min-width:0}.rp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(255,255,255,.15);background:#1e293b;color:#e2e8f0;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}.rp-btn:hover{background:#334155;border-color:rgba(255,255,255,.25)}.rp-primary{background:#1d4ed8!important;color:#fff!important;border-color:#1d4ed8!important}.rp-success{background:#065f46!important;color:#6ee7b7!important;border-color:#065f46!important}.rp-danger{background:transparent!important;color:#f87171!important;border-color:rgba(248,113,113,.4)!important}.rp-btn-light{background:rgba(255,255,255,.1);color:#e2e8f0;border-color:rgba(255,255,255,.2)}.rp-btn-light:hover{background:rgba(255,255,255,.18)}.rp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.rp-segment{display:flex}.rp-segment button{border:1px solid rgba(255,255,255,.12);background:#1e293b;padding:6px 11px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}.rp-segment button:first-child{border-radius:6px 0 0 6px}.rp-segment button:last-child{border-radius:0 6px 6px 0}.rp-segment button.active{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.rp-form-panel{background:#0f172a;border:1px dashed rgba(255,255,255,.12);border-radius:8px;padding:14px;margin-bottom:12px}.rp-alert{border-radius:8px;padding:10px 12px;margin:10px 0;border:1px solid;font-size:12.5px}.rp-alert.info{background:rgba(56,189,248,.1);border-color:rgba(56,189,248,.3);color:#7dd3fc}.rp-alert.warn{background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.3);color:#fcd34d}.rp-alert.ok{background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.3);color:#6ee7b7}.rp-alert.err{background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.3);color:#fca5a5}.rp-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px}.rp-table{width:100%;border-collapse:collapse;min-width:900px}.rp-table th{background:#0f172a;color:#64748b;text-transform:uppercase;font-size:10.5px;letter-spacing:.04em;text-align:left;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08)}.rp-table td{padding:9px 8px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:middle;color:#cbd5e1}.rp-table tr:hover td{background:rgba(255,255,255,.03)}.rp-table tfoot td{font-weight:800;background:#0f172a;color:#e2e8f0}.rp-table .num,.num{text-align:right;font-variant-numeric:tabular-nums}.num-input{text-align:right;width:110px}.empty{text-align:center;color:#475569;padding:24px!important}.rp-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800}.rp-blue{background:rgba(56,189,248,.15);color:#38bdf8;border:1px solid rgba(56,189,248,.3)}.rp-green{background:rgba(52,211,153,.12);color:#34d399;border:1px solid rgba(52,211,153,.3)}.rp-amber{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.3)}.rp-red{background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.3)}.rp-gray{background:rgba(100,116,139,.15);color:#94a3b8;border:1px solid rgba(100,116,139,.3)}.rp-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}.rp-kpi{background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px}.rp-kpi span{display:block;color:#64748b;font-size:11px;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.rp-kpi strong{font-size:21px;font-weight:800;color:#e2e8f0}.rp-kpi.hi{background:rgba(29,78,216,.15);border-color:rgba(29,78,216,.3)}.rp-kpi.ok{background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.25)}.rp-kpi.warn{background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.25)}.rp-kpi.err{background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.25)}.rp-wizard{display:flex;align-items:center;gap:8px;margin-bottom:14px;color:#475569}.rp-wizard-step{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;white-space:nowrap}.rp-wizard-step span{width:23px;height:23px;border-radius:999px;background:#1e293b;border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;color:#64748b}.rp-wizard-step.active{color:#38bdf8}.rp-wizard-step.active span{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.rp-wizard-step.done{color:#34d399}.rp-wizard-step.done span{background:#065f46;color:#6ee7b7;border-color:#065f46}.rp-wizard-line{height:1px;flex:1;min-width:22px;background:rgba(255,255,255,.08)}.rp-mode-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.rp-mode-card{text-align:left;border:1px solid rgba(255,255,255,.08);background:#1e293b;border-radius:10px;padding:14px;cursor:pointer;transition:all .15s}.rp-mode-card:hover{border-color:rgba(56,189,248,.4);background:#1e3a5f}.rp-mode-card.active{border-color:#38bdf8;background:rgba(56,189,248,.1);box-shadow:inset 0 3px 0 #38bdf8}.rp-mode-card strong{display:block;color:#e2e8f0}.rp-mode-card span{display:block;color:#64748b;font-size:12px;margin:7px 0}.rp-mode-card small{display:block;color:#38bdf8;font-weight:800}.rp-weight-list{display:grid;gap:8px}.rp-weight{display:grid;grid-template-columns:auto 1fr 90px;gap:10px;align-items:center}.rp-icon-btn{border:1px solid rgba(255,255,255,.12);background:#1e293b;border-radius:6px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#94a3b8}.rp-icon-btn:hover{background:#334155}.rp-icon-btn.danger{color:#f87171;border-color:rgba(248,113,113,.3)}.strong-warn{color:#fbbf24;font-weight:800}.rp-progress{height:6px;background:#1e293b;border-radius:999px;margin-top:4px;overflow:hidden}.rp-progress span{display:block;height:100%;background:linear-gradient(90deg,#1d4ed8,#38bdf8);border-radius:999px}.rp-detail-row{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.06);padding:10px 0;gap:12px}.rp-detail-row small{color:#64748b;text-align:right}.rp-side{display:grid;grid-template-columns:280px 1fr;gap:14px}.rp-audit{border-bottom:1px solid rgba(255,255,255,.06);padding:12px 0}.rp-audit p{margin:8px 0 4px;color:#cbd5e1}.rp-audit small{color:#64748b}.rp-feature{background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px}.rp-feature strong{display:block;color:#e2e8f0}.rp-feature span{display:block;color:#64748b;margin-top:6px}.rp-code{background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px;margin-top:14px;overflow:auto;color:#94a3b8;font-family:monospace;font-size:12px}.rp-footer{background:#0f172a;border-top:1px solid rgba(255,255,255,.08);color:#475569;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 24px;font-size:11.5px}.rp-result-actions{justify-content:flex-end;margin-bottom:10px}.rp-source-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:12px}.rp-scope-title{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:14px}.rp-source-card{border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:11px;display:grid;grid-template-columns:auto auto 1fr;gap:8px;align-items:center;cursor:pointer;background:#1e293b;transition:all .15s}.rp-source-card:hover{border-color:rgba(56,189,248,.4);background:#1e3a5f}.rp-source-card.active{background:rgba(56,189,248,.1);border-color:#38bdf8}.rp-source-card.disabled{opacity:.4;cursor:not-allowed}.rp-source-card strong{grid-column:2 / -1;font-size:12.5px;color:#e2e8f0}.rp-source-card small{grid-column:2 / -1;color:#64748b}.rp-composition-summary{background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 12px}.rp-composition-summary span,.rp-composition-summary small{display:block;color:#64748b;font-size:11px}.rp-composition-summary strong{font-size:20px;color:#e2e8f0}.rp-composition-box{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:8px;padding:12px;margin-top:12px}.rp-composition-box span{display:block;color:#38bdf8;font-size:11px;font-weight:800}.rp-composition-box strong{display:block;margin-top:4px;color:#e2e8f0}.rp-scope-users{margin-top:12px}.rp-row-note{display:block;color:#475569;font-size:10.5px;margin-top:3px;text-align:left}.rp-audit-entry{border-bottom:1px solid rgba(255,255,255,.06);padding:8px 0;font-size:12px;color:#94a3b8}.rp-audit-ts{color:#38bdf8;margin-right:8px;font-family:monospace}.rp-audit-hash{display:block;color:#475569;font-family:monospace;font-size:10px;margin-top:4px}@media(max-width:900px){.rp-header{align-items:flex-start;flex-direction:column}.rp-grid-2,.rp-grid-3,.rp-grid-4,.rp-mode-grid,.rp-side{grid-template-columns:1fr}.rp-main{padding:16px}.rp-wizard{align-items:flex-start;flex-direction:column}.rp-wizard-line{display:none}.rp-table{min-width:760px}}`;
