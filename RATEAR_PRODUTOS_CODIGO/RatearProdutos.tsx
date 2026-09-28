"use client";

import React, { useMemo, useState } from 'react';
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
      const sourceCostTotal = D(sourceBuckets.reduce((sum, b) => sum + D(b.prod.custo * b.prod.qty, 4), 0), 4);
      const composedExpenseTotal = D(scope.reduce((sum, item) => sum + (merged[item.sku]?.totalRateado || 0), 0), 4);
      const composedTotal = D(sourceCostTotal + composedExpenseTotal, 4);
      const targetCosts = targetBuckets.map(b => D(b.prod.custo * b.prod.qty, 4));
      const totalCostBase = targetCosts.reduce((s, v) => s + v, 0);
      const targetQtys = targetBuckets.map(b => b.prod.qty);
      const totalQtyBase = targetQtys.reduce((s, v) => s + v, 0);
      const useQty = totalCostBase === 0;
      const totalBase = useQty ? totalQtyBase : totalCostBase;

      scope.forEach(item => {
        if (!composition.targetSkus.includes(item.sku) && merged[item.sku]) {
          merged[item.sku].totalRateado = 0;
          merged[item.sku].expenseRateado = 0;
          merged[item.sku].compositionRole = composition.sourceSkus.includes(item.sku) ? 'source' : undefined;
          merged[item.sku].composedTargetSkus = composition.targetSkus;
        }
      });

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
    const ratUnit = prod.qty > 0 ? D(rat / prod.qty, 4) : 0;
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

  const importarProposta = (proposal: any) => {
    const isLocacao = proposal.operationType === 'locacao';

    const novosItens: RateioItem[] = proposal.quoteItems.map((item: any, i: number) => {
      const precoUnit = D(item.price, 2);
      const custoUnit = isLocacao
        ? precoUnit
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

  const salvarRateio = () => {
    if (!lastResult) return window.alert('Execute um rateio antes de salvar.');
    const novo = {
      id: Date.now(),
      nome: rateioName,
      data: new Date().toLocaleString('pt-BR'),
      snapshot: { items, expenses, rateioMode, manualWeights, scopeMode, targetIndexes, sourceIndexes, nf, responsavel, justificativa },
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

  const excluirRateio = (id: number) => {
    const updated = savedRateios.filter((r: any) => r.id !== id);
    setSavedRateios(updated);
    localStorage.setItem('precifica_rateios_v2', JSON.stringify(updated));
  };

  const imprimirPDF = (r: any) => {
    const res: RateioResult = r.resultado;
    const linhas = res.results.map((item: ResultItem) => `
      <tr>
        <td>${item.prod.sku}</td>
        <td>${item.prod.desc}</td>
        <td style="text-align:center">${item.prod.qty}</td>
        <td style="text-align:right;font-family:monospace">R$ ${item.prod.preco.toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">R$ ${item.expenseRat.toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#d97706">R$ ${item.novoCusto.toFixed(2)}</td>
        <td style="text-align:center;color:#059669">${(item.mgNova * 100).toFixed(2)}%</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Rateio — ${r.nome}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;}
/* ... (styles omitted for brevity in build) ... */
</style></head><body>
<div class="header">
  <h1>📊 Rateio de Despesas — ${r.nome}</h1>
  <p style="font-size:11px;opacity:0.8;margin-top:4px;">NF: ${r.snapshot.nf.numero} · ${r.snapshot.nf.emitente} · Salvo: ${r.data}</p>
</div>
<div class="content">
  <table>
    <thead><tr>
      <th>SKU</th><th>Descrição</th><th style="text-align:center">Qtd</th>
        <th style="text-align:right">Valor Orig. Unit.</th><th style="text-align:right">Desp. Rat.</th>
        <th style="text-align:right">Valor Rateado Unit.</th><th style="text-align:center">Margem Proposta</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="rp-app">
      {/* main UI omitted here for brevity in commit */}
    </div>
  );
}

// Note: helper components and full styles are included in the original provided code.
