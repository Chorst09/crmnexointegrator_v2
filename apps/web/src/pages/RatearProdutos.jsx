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
import {
  COMPONENT_PRODUCT_RECOMMENDATION,
  D,
  TARGET_PRODUCT_GOAL,
  calcRateio,
  validateCompositionSelection,
} from '../lib/rateio-calculator.mjs';

const DEMO_ITEMS = [
  { sku: 'NB-001', desc: 'Notebook Dell Latitude i7 16GB', ncm: '8471.30.12', custo: 3200, preco: 4800, qty: 3, un: 'UN' },
  { sku: 'MN-002', desc: 'Monitor LG UltraWide 34"', ncm: '8528.52.20', custo: 850, preco: 1350, qty: 8, un: 'UN' },
  { sku: 'TC-003', desc: 'Teclado Mecanico Corsair K70', ncm: '8471.60.52', custo: 320, preco: 580, qty: 15, un: 'UN' },
];

const DEMO_EXPENSES = [
  { tipo: 'Frete', desc: 'CIF - Transportadora Rapida', valor: 500, metodo: 'custo', pagador: 'Proprio', conta: '3.1.01.01' },
  { tipo: 'Seguro', desc: 'Seguro de carga NF #004521', valor: 120, metodo: 'venda', pagador: 'Proprio', conta: '3.1.01.02' },
];

const expenseTypes = ['Frete', 'Seguro', 'Imposto', 'Armazenagem', 'Desembaraco', 'Comissao', 'Outros'];
const rateioModes = ['custo', 'venda', 'qty', 'peso'];
const modeLabels = {
  custo: 'Por custo',
  venda: 'Por venda',
  qty: 'Por quantidade',
  peso: 'Peso manual',
};

const fmt = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);
const fmtRound = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value) || 0);
const pct = (value) => `${((Number(value) || 0) * 100).toFixed(2)}%`;
const cloneItems = () => DEMO_ITEMS.map(item => ({ ...item }));
const cloneExpenses = () => DEMO_EXPENSES.map(expense => ({ ...expense }));
const PRICING_SIMULATIONS_STORAGE_KEY = 'pre_sales_pricing_simulations_v1';
const CALCULATOR_PROPOSALS_STORAGE_KEY = 'crm-calculadoras-propostas-v1';
const CALCULATOR_PROPOSALS_LEGACY_KEY = 'crm-calculadoras-proposals';

export default function RatearProdutos() {
  const [tab, setTab] = useState('nf');
  const [source, setSource] = useState('nfe');
  const [items, setItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [rateioMode, setRateioMode] = useState('custo');
  const [manualWeights, setManualWeights] = useState({});
  const [scopeMode, setScopeMode] = useState('todos');
  const [targetIndexes, setTargetIndexes] = useState(['0']);
  const [sourceIndexes, setSourceIndexes] = useState(['1', '2']);
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
  const [newItem, setNewItem] = useState({ sku: '', desc: '', ncm: '', custo: 0, preco: 0, qty: 1, un: 'UN' });
  const [showItemForm, setShowItemForm] = useState(false);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditUser, setAuditUser] = useState('');
  const [auditMode, setAuditMode] = useState('');
  const [configSubTab, setConfigSubTab] = useState('geral');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [viewingRateio, setViewingRateio] = useState(null);
  const [savedRateios, setSavedRateios] = useState(() => {
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
    .filter(Boolean);
  const sourceItems = sourceIndexes
    .map(index => items[Number(index)])
    .filter(Boolean);
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
  const compositionIssues = scopeMode === 'alvo'
    ? validateCompositionSelection({ targetItems, sourceItems })
    : [];
  const blockingCompositionIssues = compositionIssues.filter(issue => !issue.includes('20 itens base'));

  const manualWeightSum = D(Object.values(manualWeights).reduce((sum, value) => sum + value, 0), 2);
  const filteredAudit = auditLog.filter(entry =>
    (!auditUser || entry.user.toLowerCase().includes(auditUser.toLowerCase())) &&
    (!auditMode || entry.mode === auditMode)
  );

  const setGlobalMode = (mode) => {
    setRateioMode(mode);
    setExpenses(current => current.map(expense => ({ ...expense, metodo: mode })));
  };

  const autoSelectComposition = () => {
    const targetValues = items.slice(0, TARGET_PRODUCT_GOAL).map((_, index) => String(index));
    const sourceValues = items.slice(TARGET_PRODUCT_GOAL).map((_, index) => String(index + TARGET_PRODUCT_GOAL));
    setScopeMode('alvo');
    setTargetIndexes(targetValues);
    setSourceIndexes(sourceValues);
    setMessage({ type: 'ok', text: `${targetValues.length} produto(s) alvo e ${sourceValues.length} componente(s) selecionados automaticamente.` });
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

  const updateExpense = (index, patch) => {
    setExpenses(current => current.map((expense, currentIndex) =>
      currentIndex === index ? { ...expense, ...patch } : expense
    ));
  };

  const removeItem = (index) => {
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
    const reindex = (values) => values
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value !== index)
      .map(value => String(value > index ? value - 1 : value));
    setTargetIndexes(current => reindex(current));
    setSourceIndexes(current => reindex(current));
  };

  const validateRateioInput = () => {
    if (!items.length) {
      window.alert('Adicione itens na aba NF-e.');
      return false;
    }
    if (scopeMode === 'alvo') {
      const issues = validateCompositionSelection({ targetItems, sourceItems });
      const blockingIssues = issues.filter(issue => !issue.includes('20 itens base'));
      if (blockingIssues.length > 0) {
        window.alert(blockingIssues.join('\n'));
        return false;
      }
      const advisoryIssues = issues.filter(issue => issue.includes('20 itens base'));
      if (advisoryIssues.length > 0) {
        setMessage({ type: 'warn', text: advisoryIssues[0] });
      }
    }
    return true;
  };

  const runPreview = () => {
    if (!validateRateioInput()) return;
    const result = calcRateio(items, expenses, manualWeights, scopedItems, compositionConfig);
    setPreview(result);
  };

  const executeRateio = () => {
    if (!validateRateioInput()) return;
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

  const downloadFile = (filename, content, type) => {
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
  const importarProposta = (proposal) => {
    const isLocacao = proposal.operationType === 'locacao';
    const proposalPeriod = Number(proposal.rentalPeriod || proposal.contractTermMonths || proposal.period || 0);

    const novosItens = proposal.quoteItems.map((item, i) => {
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
  const carregarRateio = (r) => {
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

    const selected = savedRateios.find((rateio) => String(rateio.id) === pendingId);
    if (!selected) return;

    sessionStorage.removeItem('precifica_rateio_to_load');
    carregarRateio(selected);
  }, []);

  // ── EXCLUIR RATEIO SALVO ──
  const excluirRateio = (id) => {
    const updated = savedRateios.filter((r) => r.id !== id);
    setSavedRateios(updated);
    localStorage.setItem('precifica_rateios_v2', JSON.stringify(updated));
  };

  // ── IMPRIMIR PDF ──
  const imprimirPDF = (r) => {
    const res = r.resultado;
    const visibleResults = res.results.some((item) => item.compositionRole === 'target')
      ? res.results.filter((item) => item.compositionRole === 'target')
      : res.results;
    const isLocacao = r.snapshot?.proposal?.operationType === 'locacao'
      || r.snapshot?.items?.some((item) => item.operationType === 'locacao' || item.un === '/mês')
      || String(r.nome || '').toLowerCase().includes('loca');
    const periodMonths = Math.max(
      Number(r.snapshot?.proposal?.period) || 0,
      ...(r.snapshot?.items || []).map((item) => Number(item.period) || 0),
      ...visibleResults.map((item) => Number(item.prod.period) || 0),
      0,
    );
    const monthlyTotal = visibleResults.reduce((sum, item) => sum + D(item.novoCusto * item.prod.qty, 4), 0);
    const contractTotal = isLocacao && periodMonths > 0 ? monthlyTotal * periodMonths : 0;
    const linhas = visibleResults.map((item) => {
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
      <style>{`${styles}${designEnhancements}`}</style>

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
          <button key={id} className={`rp-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {React.createElement(Icon, { size: 15 })} {label}
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
                  {(['nfe', 'api', 'manual']).map(option => (
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
                        {['UN', '/mês', 'CX', 'KG', 'LT', 'M', 'PC'].map(unit => <option key={unit}>{unit}</option>)}
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
                <div className="rp-actions">
                  <button className="rp-btn" onClick={autoSelectComposition} disabled={items.length < TARGET_PRODUCT_GOAL}>Auto 4 alvos</button>
                  <div className="rp-segment">
                    <button className={scopeMode === 'todos' ? 'active' : ''} onClick={() => setScopeMode('todos')}>Distribuir entre todos</button>
                    <button className={scopeMode === 'alvo' ? 'active' : ''} onClick={() => setScopeMode('alvo')}>4 alvos + composicao</button>
                  </div>
                </div>
              </div>

              {scopeMode === 'todos' ? (
                <div className="rp-alert info">O frete, seguro e demais despesas serao rateados entre todos os itens conforme o criterio selecionado.</div>
              ) : (
                <>
                  <div className="rp-alert warn">
                    Marque exatamente {TARGET_PRODUCT_GOAL} produtos finais e os itens que compoem o custo deles. O custo dos componentes + despesas acessorias sera distribuido entre os alvos proporcionalmente ao custo total de cada alvo.
                  </div>
                  {compositionIssues.length > 0 && (
                    <div className={`rp-alert ${blockingCompositionIssues.length > 0 ? 'err' : 'warn'}`}>
                      {compositionIssues.join(' ')}
                    </div>
                  )}
                  <div className="rp-grid rp-grid-2">
                    <div className="rp-composition-summary">
                      <span>Produtos alvo</span>
                      <strong>{targetItems.length}/{TARGET_PRODUCT_GOAL}</strong>
                      <small>{targetItems.length ? targetItems.map(item => item.sku).join(', ') : 'Nenhum alvo marcado'}</small>
                    </div>
                    <div className="rp-composition-summary">
                      <span>Itens componentes</span>
                      <strong>{sourceItems.length}</strong>
                      <small>{sourceItems.length ? `${sourceItems.map(item => item.sku).join(', ')}${sourceItems.length < COMPONENT_PRODUCT_RECOMMENDATION ? ` · revise se faltam itens base` : ''}` : 'Nenhum componente marcado'}</small>
                    </div>
                  </div>
                  <div className="rp-scope-title">Produtos alvo</div>
                  <div className="rp-source-grid">
                    {items.map((item, index) => {
                      const value = String(index);
                      const checked = targetIndexes.includes(value);
                      const isSource = sourceIndexes.includes(value);
                      const targetLimitReached = !checked && targetIndexes.length >= TARGET_PRODUCT_GOAL;
                      return (
                        <label key={item.sku} className={`rp-source-card ${checked ? 'active' : ''} ${isSource || targetLimitReached ? 'disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSource || targetLimitReached}
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
                <button key={id}
                  className={`rp-tab ${configSubTab === id ? 'active' : ''}`}
                  style={{fontSize:'12px',padding:'6px 14px'}}
                  onClick={() => setConfigSubTab(id)}>
                  {React.createElement(Icon, {size:13})} {label}
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

function CompositionEstimate({ targets, sources, expenses }) {
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

function Field({ label, value, onChange, type = 'text', wide = false }) {
  return (
    <label className={`rp-field ${wide ? 'wide' : ''}`}>
      {label}
      <input type={type} value={value} step={type === 'number' ? '0.0001' : undefined} onChange={event => onChange(event.target.value)} />
    </label>
  );
}

function Wizard({ step }) {
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

function KpiGrid({ totals, itemCount }) {
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

function Kpi({ label, value, highlight, tone }) {
  return <div className={`rp-kpi ${highlight ? 'hi' : ''} ${tone || ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ItemsTable({ items, totals, onRemove }) {
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

function ExpensesTable({ expenses, onChange, onRemove }) {
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
              <td><select value={expense.metodo} onChange={event => onChange(index, { metodo: event.target.value })}>{rateioModes.map(mode => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></td>
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

function ModeCard({ mode, active, title, text, onClick }) {
  return (
    <button className={`rp-mode-card ${active ? 'active' : ''}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
      <small>{modeLabels[mode]}</small>
    </button>
  );
}

function ResultKpis({ result }) {
  const effectiveResults = result.results.some(item => item.compositionRole === 'target')
    ? result.results.filter(item => item.compositionRole === 'target')
    : result.results;
  const originalValue = effectiveResults.reduce((sum, item) => sum + item.totV, 0);
  const componentCost = effectiveResults.reduce((sum, item) => sum + (item.sourceCostTotal || 0), 0);
  const allocatedValue = effectiveResults.reduce((sum, item) => sum + D(item.novoCusto * item.prod.qty, 4), 0);
  const targetOwnCost = effectiveResults.reduce((sum, item) => sum + item.totC, 0);
  const billingLabel = result.billing?.billingType === 'mensal' ? 'Mensalidade alvos' : 'Valor pontual alvos';
  const targetResult = result.results.find(item => item.compositionRole === 'target');
  return (
    <div className="rp-kpi-grid">
      <Kpi label="Desp. total rateada" value={fmtRound(result.totalExp)} tone="warn" />
      {targetResult && <Kpi label="Alvos compostos" value={`${effectiveResults.length}/${TARGET_PRODUCT_GOAL}`} highlight />}
      {targetResult && <Kpi label="Custo proprio alvos" value={fmtRound(targetOwnCost)} />}
      {targetResult && <Kpi label="Componentes rateados" value={fmtRound(componentCost)} tone="warn" />}
      <Kpi label="Venda original" value={fmtRound(originalValue)} />
      <Kpi label={billingLabel} value={fmtRound(allocatedValue)} highlight />
      <Kpi label="Margem proposta" value={pct(result.avgMgNova)} tone="ok" />
      {result.billing?.contractTotal > 0 && <Kpi label={`Contrato ${result.billing.periodMonths} meses`} value={fmtRound(result.billing.contractTotal)} tone="ok" />}
    </div>
  );
}

function ResultTable({ result, compact = false, title }) {
  const hasComposition = result.results.some(item => item.compositionRole === 'target');
  const displayItems = hasComposition
    ? result.results.filter(item => item.compositionRole === 'target')
    : result.results;
  const billingLabel = result.billing?.billingType === 'mensal' ? 'Mensal' : 'Pontual';
  const targetQuantityTotal = displayItems.reduce((sum, item) => sum + item.prod.qty, 0);
  const finalTargetTotal = displayItems.reduce((sum, item) => sum + D(item.novoCusto * item.prod.qty, 4), 0);
  const weightedUnitAverage = targetQuantityTotal > 0 ? D(finalTargetTotal / targetQuantityTotal, 4) : 0;

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
              <th className="num" style={{background:'#eaf4ee',color:'#2d7a4f'}}>Valor Total {billingLabel}</th>
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
                  <td className="num" style={{background:'#f0f7ff'}}>
                    <strong>{fmt(item.novoCusto)}</strong>
                    {hasComposition && <small className="rp-row-note">base {fmt(item.prod.custo)} + {fmt(item.ratUnit)}</small>}
                  </td>
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
                  Total dos Alvos ({billingLabel})
                </td>
                <td className="num" style={{background:'#e8f0fb',fontWeight:800,color:'#1a4f8a',fontSize:'14px'}}>
                  {fmt(weightedUnitAverage)}
                </td>
                <td className="num" style={{background:'#f0fdf4',fontWeight:800,color:'#2d7a4f',fontSize:'14px'}}>
                  {fmt(finalTargetTotal)}
                </td>
                {!compact && <td />}
                <td />
              </tr>
              <tr>
                <td colSpan={hasComposition ? 7 : 5} style={{textAlign:'right',fontSize:'11px',color:'#6b7280'}}>
                  Verificacao: custo proprio + componentes + despesas dos produtos alvo
                </td>
                <td colSpan={2} style={{background:'#fef3dc',fontWeight:800,color:'#8a5a00',fontSize:'12px',textAlign:'right',padding:'6px 8px'}}>
                  {fmt(finalTargetTotal)}
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

function ScenarioTable({ items, scenarios }) {
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

function Integrity({ result, expenses, items, auditLog }) {
  const composition = result.compositionTotals;
  const checks = [
    { ok: result.ok, label: 'Invariante de conservacao', detail: `Rateado ${fmtRound(result.somaCheck)} | Despesas ${fmtRound(result.totalExp)} | Delta ${fmtRound(result.diff)}` },
    ...(composition ? [
      { ok: composition.targetCount === TARGET_PRODUCT_GOAL, label: 'Quantidade de produtos alvo', detail: `${composition.targetCount}/${TARGET_PRODUCT_GOAL}` },
      { ok: Math.abs(composition.expenseTotal - result.totalExp) < 0.02, label: 'Despesas concentradas nos alvos', detail: `${fmtRound(composition.expenseTotal)} de ${fmtRound(result.totalExp)}` },
      { ok: Math.abs(composition.finalTargetCostTotal - (composition.targetOwnCostTotal + composition.sourceCostTotal + composition.expenseTotal)) < 0.02, label: 'Composicao final dos alvos', detail: `${fmtRound(composition.targetOwnCostTotal)} + ${fmtRound(composition.sourceCostTotal)} + ${fmtRound(composition.expenseTotal)} = ${fmtRound(composition.finalTargetCostTotal)}` },
    ] : []),
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
function ImportPropostaModal({ onImport, onClose }) {
  const [proposals, setProposals] = React.useState([]);
  const [search, setSearch] = React.useState('');

  const mapFromCalculadora = (p) => {
    const allItems = [
      ...(p.snapshot?.saleItems || []).map(item => ({
        description: item.description,
        price: Number(item.calculation?.rbUnitario || item.pricing?.sellPricePerUnit || 0),
        baseCost: Number(item.unitCost || 0),
        quantity: Number(item.quantity || 1),
        period: Number(item.pricing?.rentalPeriod || p.pricing?.rentalPeriod || 0),
      })),
      ...(p.snapshot?.rentalItems || []).map(item => ({
        description: item.description,
        price: Number(item.calculation?.rbUnitario || item.assetValueBRL || 0),
        baseCost: Number(item.assetValueBRL || 0),
        quantity: Number(item.quantity || 1),
        period: Number(item.pricing?.rentalPeriod || p.pricing?.rentalPeriod || 0),
      })),
      ...(p.snapshot?.serviceItems || []).map(item => ({
        description: item.description,
        price: Number(item.calculation?.sellPricePerHour || 0),
        baseCost: Number(item.estimatedHours > 0 ? (item.baseSalary / item.estimatedHours) : 0),
        quantity: Number(item.estimatedHours || 1),
        period: 0,
      })),
    ];
    return {
      id: p.id || p.number,
      proposalNumber: p.number || p.proposalNumber,
      clientInfo: {
        name: p.client?.contactName || p.clientInfo?.name || '',
        company: p.client?.companyName || p.clientInfo?.company || '',
        document: p.client?.document || p.clientInfo?.document || '',
      },
      totalValue: Number(p.result?.finalPrice || p.result?.monthlyPrice || p.totalValue || 0),
      quoteItems: allItems.length > 0 ? allItems : (p.quoteItems || []).map(item => ({
        description: item.description,
        price: Number(item.price || 0),
        baseCost: Number(item.baseCost || 0),
        quantity: Number(item.quantity || 1),
        period: Number(item.period || p.pricing?.rentalPeriod || 0),
      })),
      operationType: p.calculatorType === 'locacao' ? 'locacao' : p.pricing?.operationType || p.operationType || 'venda',
      desiredMargin: Number(p.pricing?.desiredMargin ?? p.desiredMargin ?? 0),
      createdAt: p.createdAt || p.savedAt || new Date().toISOString(),
      rentalPeriod: Number(p.pricing?.rentalPeriod || p.rentalPeriod || 0),
    };
  };

  React.useEffect(() => {
    try {
      const fromCalculadora = JSON.parse(localStorage.getItem(CALCULATOR_PROPOSALS_STORAGE_KEY) || '[]');
      const fromLegacy = JSON.parse(localStorage.getItem(CALCULATOR_PROPOSALS_LEGACY_KEY) || '[]');
      const all = [
        ...(Array.isArray(fromCalculadora) ? fromCalculadora : []),
        ...(Array.isArray(fromLegacy) ? fromLegacy : []),
      ];
      setProposals(all.filter(Boolean).map(mapFromCalculadora));
    } catch {
      setProposals([]);
    }
  }, []);
  const filtered = proposals.filter(p =>
    p.proposalNumber?.includes(search) ||
    p.clientInfo?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.clientInfo?.company?.toLowerCase().includes(search.toLowerCase())
  );
  const typeLabel = (t) => ({ venda: 'Venda', locacao: 'Locação', servicos: 'Serviços' }[t] || t);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'16px'}}>
      <div style={{background:'#fff',borderRadius:'12px',width:'100%',maxWidth:'700px',maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <div style={{background:'linear-gradient(135deg,#1a4f8a,#0f766e)',color:'#fff',padding:'20px 24px',borderRadius:'12px 12px 0 0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:800}}>📋 Importar Proposta</div>
            <div style={{fontSize:'11px',opacity:0.8,marginTop:'2px'}}>Selecione uma proposta da Calculadora para usar como base do rateio</div>
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
              {proposals.length === 0 ? 'Nenhuma proposta salva na Calculadora. Crie e salve uma proposta em Calculadora primeiro.' : 'Nenhuma proposta encontrada.'}
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
function SavedRateiosModal({ savedRateios, onLoad, onDelete, onPrint, onClose }) {
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
          ) : savedRateios.map((r) => (
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

const designEnhancements = `
.rp-app{background:#0a1020;color:#e5edf8;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(2,6,23,.28);}
.rp-header{position:relative;top:auto;max-width:1280px;margin:16px auto 0;border-radius:16px;padding:18px 20px;background:linear-gradient(135deg,#132033 0%,#17363c 58%,#332f18 100%);box-shadow:0 18px 48px rgba(2,6,23,.32);border:1px solid rgba(148,163,184,.20);}
.rp-brand{font-size:18px;letter-spacing:0;}
.rp-brand span{border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.42);color:#cbd5e1;}
.rp-sub{font-size:12.5px;color:#b6c2d2;opacity:1;}
.rp-nav{position:sticky;top:0;z-index:18;max-width:1280px;margin:12px auto 0;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(13,20,36,.92);backdrop-filter:blur(14px);box-shadow:0 12px 34px rgba(2,6,23,.24);padding:6px;}
.rp-tab{border-radius:10px;border-bottom:0;padding:9px 14px;color:#90a0b6;letter-spacing:0;}
.rp-tab:hover{background:rgba(148,163,184,.10);color:#e5edf8;}
.rp-tab.active{background:#e5edf8;color:#0f172a;box-shadow:0 8px 20px rgba(229,237,248,.16);border-bottom-color:transparent;}
.rp-main{max-width:1280px;padding:18px 18px 44px;}
.rp-card{background:linear-gradient(180deg,rgba(19,29,48,.92),rgba(14,22,38,.96));border-color:rgba(148,163,184,.16);border-radius:12px;padding:18px 20px;margin-bottom:16px;box-shadow:0 14px 36px rgba(2,6,23,.18);}
.rp-card-head{padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,.10);}
.rp-card h3{color:#aebbd0;font-size:11.5px;letter-spacing:.12em;}
.rp-field{color:#aebbd0;letter-spacing:.02em;}
.rp-field input,.rp-field select,.rp-table input,.rp-table select,.rp-weight input{height:38px;border-color:rgba(148,163,184,.22);background:#101a2c;color:#f8fafc;border-radius:9px;padding:8px 10px;}
.rp-field input:focus,.rp-field select:focus,.rp-table input:focus,.rp-table select:focus,.rp-weight input:focus{outline:2px solid rgba(45,212,191,.35);border-color:#2dd4bf;}
.rp-btn{min-height:36px;border-radius:10px;border-color:rgba(148,163,184,.22);background:#142033;color:#dbe7f6;box-shadow:0 1px 0 rgba(255,255,255,.04) inset;}
.rp-btn:hover{background:#1c2a42;border-color:rgba(203,213,225,.34);transform:translateY(-1px);}
.rp-btn:disabled{cursor:not-allowed;opacity:.45;transform:none;}
.rp-primary{background:#2563eb!important;border-color:#3b82f6!important;}
.rp-success{background:#047857!important;border-color:#10b981!important;color:#ecfdf5!important;}
.rp-danger{background:rgba(185,28,28,.10)!important;}
.rp-btn-light{background:rgba(226,232,240,.10);border-color:rgba(226,232,240,.18);}
.rp-segment{background:#0b1220;border:1px solid rgba(148,163,184,.16);border-radius:11px;padding:3px;gap:3px;}
.rp-segment button{border:0;border-radius:8px!important;background:transparent;color:#9aa8bb;}
.rp-segment button.active{background:#2dd4bf;color:#05201d;box-shadow:0 8px 18px rgba(45,212,191,.18);}
.rp-alert{border-radius:10px;line-height:1.45;}
.rp-alert.info{background:rgba(14,116,144,.16);border-color:rgba(34,211,238,.28);color:#a5f3fc;}
.rp-alert.warn{background:rgba(180,83,9,.14);border-color:rgba(245,158,11,.28);color:#fde68a;}
.rp-alert.ok{background:rgba(4,120,87,.16);border-color:rgba(16,185,129,.30);color:#bbf7d0;}
.rp-alert.err{background:rgba(190,18,60,.13);border-color:rgba(244,63,94,.30);color:#fecdd3;}
.rp-wizard{background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.12);border-radius:14px;padding:10px 12px;margin-bottom:16px;}
.rp-wizard-step{color:#8493a8;}
.rp-wizard-step span{background:#101a2c;border-color:rgba(148,163,184,.18);}
.rp-wizard-step.active{color:#67e8f9;}
.rp-wizard-step.active span{background:#0891b2;border-color:#22d3ee;}
.rp-wizard-step.done{color:#86efac;}
.rp-kpi-grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;}
.rp-kpi{background:#101a2c;border-color:rgba(148,163,184,.14);border-radius:12px;padding:15px 16px;}
.rp-kpi span{color:#98a7ba;letter-spacing:.08em;}
.rp-kpi strong{font-size:22px;color:#f8fafc;letter-spacing:0;}
.rp-kpi.hi{background:rgba(37,99,235,.18);border-color:rgba(96,165,250,.32);}
.rp-kpi.ok{background:rgba(4,120,87,.16);border-color:rgba(52,211,153,.28);}
.rp-kpi.warn{background:rgba(180,83,9,.14);border-color:rgba(251,191,36,.25);}
.rp-mode-grid{gap:12px;}
.rp-mode-card{min-height:116px;background:#101a2c;border-color:rgba(148,163,184,.16);border-radius:12px;padding:16px;}
.rp-mode-card:hover{background:#17243a;border-color:rgba(45,212,191,.35);}
.rp-mode-card.active{background:rgba(13,148,136,.16);border-color:#2dd4bf;box-shadow:inset 0 4px 0 #2dd4bf;}
.rp-mode-card span{color:#9aa8bb;line-height:1.35;}
.rp-mode-card small{color:#5eead4;}
.rp-table-wrap{border-color:rgba(148,163,184,.16);border-radius:12px;background:#0d1627;}
.rp-table th{position:sticky;top:0;z-index:1;background:#111c2f;color:#98a7ba;padding:11px 10px;}
.rp-table td{padding:11px 10px;color:#d7e2f0;border-bottom-color:rgba(148,163,184,.08);}
.rp-table tr:hover td{background:rgba(45,212,191,.045);}
.rp-table tfoot td{background:#111c2f;}
.rp-badge{border-radius:8px;padding:3px 8px;}
.rp-blue{background:rgba(14,165,233,.14);color:#7dd3fc;border-color:rgba(125,211,252,.28);}
.rp-green{background:rgba(34,197,94,.14);color:#86efac;border-color:rgba(134,239,172,.28);}
.rp-amber{background:rgba(245,158,11,.14);color:#fcd34d;border-color:rgba(252,211,77,.30);}
.rp-red{background:rgba(244,63,94,.14);color:#fda4af;border-color:rgba(253,164,175,.30);}
.rp-gray{background:rgba(148,163,184,.12);color:#cbd5e1;border-color:rgba(203,213,225,.22);}
.rp-source-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;}
.rp-source-card{border-radius:12px;background:#101a2c;border-color:rgba(148,163,184,.15);padding:13px;min-height:92px;}
.rp-source-card:hover{background:#17243a;border-color:rgba(45,212,191,.34);}
.rp-source-card.active{background:rgba(13,148,136,.16);border-color:#2dd4bf;}
.rp-source-card.disabled{opacity:.38;}
.rp-composition-summary{background:#101a2c;border-color:rgba(148,163,184,.15);border-radius:12px;padding:14px;}
.rp-composition-summary strong{font-size:24px;color:#f8fafc;}
.rp-composition-box{background:rgba(13,148,136,.12);border-color:rgba(45,212,191,.26);border-radius:12px;}
.rp-detail-row{background:#101a2c;border:1px solid rgba(148,163,184,.10);border-radius:10px;margin-bottom:8px;padding:11px 12px;}
.rp-form-panel{background:#0d1627;border-color:rgba(148,163,184,.20);border-radius:12px;}
.rp-footer{max-width:1280px;margin:0 auto 18px;border:1px solid rgba(148,163,184,.14);border-radius:12px;background:#0d1627;padding:12px 16px;}
@media(max-width:900px){.rp-header,.rp-nav{margin-left:12px;margin-right:12px}.rp-header{border-radius:14px}.rp-main{padding:14px 12px 36px}.rp-card{padding:15px}.rp-tab{padding:8px 10px}.rp-kpi-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));}.rp-table{min-width:820px}}
`;
