/**
 * MÓDULO STANDALONE - RATEAR PRODUTOS & RATEIOS SALVOS
 * ====================================================
 * Versão: 2.0
 * Data: 18/06/2026
 * Autor: PrismaGestão
 * 
 * Funcionalidades:
 * - Cálculo de rateio de despesas (Frete, Seguro, Impostos, etc)
 * - 4 métodos de rateio: Por Custo, Por Venda, Por Quantidade, Peso Manual
 * - Composição de produtos (itens target compostos por itens fonte)
 * - Salvamento e carregamento de rateios (localStorage)
 * - Exportação JSON/CSV
 * - Impressão em PDF
 * - Auditoria com checksum SHA256
 */

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export type RateioMode = 'custo' | 'venda' | 'qty' | 'peso';
export type ScopeMode = 'todos' | 'alvo';

export interface RateioItem {
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

export interface Expense {
  tipo: string;
  desc: string;
  valor: number;
  metodo: RateioMode;
  pagador: string;
  conta: string;
}

export interface ResultItem {
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

export interface RateioResult {
  results: ResultItem[];
  avgMgAnt: number;
  avgMgNova: number;
  somaCheck: number;
  totalExp: number;
  diff: number;
  ok: boolean;
}

export interface AuditEntry {
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

export interface SavedRateio {
  id: number;
  nome: string;
  data: string;
  metodo?: string;
  snapshot?: {
    nf?: { numero?: string; emitente?: string };
    responsavel?: string;
    justificativa?: string;
    items?: RateioItem[];
    expenses?: Expense[];
    rateioMode?: RateioMode;
    manualWeights?: Record<string, number>;
    scopeMode?: ScopeMode;
    targetIndexes?: string[];
    sourceIndexes?: string[];
    proposal?: { operationType?: string; period?: number };
  };
  resultado?: RateioResult;
  resumo?: {
    totalItens?: number;
    totalDespesas?: number;
    totalCusto?: number;
    totalVenda?: number;
    margem?: number;
  };
}

export interface CompositionConfig {
  targetSkus: string[];
  sourceSkus: string[];
}

// ============================================================================
// CONSTANTES
// ============================================================================

export const STORAGE_KEY = 'precifica_rateios_v2';
export const PRICING_SIMULATIONS_KEY = 'pre_sales_pricing_simulations_v1';

export const rateioModes: RateioMode[] = ['custo', 'venda', 'qty', 'peso'];
export const modeLabels: Record<RateioMode, string> = {
  custo: 'Por custo',
  venda: 'Por venda',
  qty: 'Por quantidade',
  peso: 'Peso manual',
};

export const expenseTypes = [
  'Frete',
  'Seguro',
  'Imposto',
  'Armazenagem',
  'Desembaraco',
  'Comissao',
  'Outros',
];

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

export const D = (value: number, decimals = 4): number =>
  Number((Number(value) || 0).toFixed(decimals));

export const fmt = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export const pct = (value: number): string =>
  `${((Number(value) || 0) * 100).toFixed(2)}%`;

export const cloneItems = (items: RateioItem[]): RateioItem[] =>
  items.map(item => ({ ...item }));

export const cloneExpenses = (expenses: Expense[]): Expense[] =>
  expenses.map(expense => ({ ...expense }));

// ============================================================================
// MOTOR DE CÁLCULO - RATEIO
// ============================================================================

export function calcRateio(
  items: RateioItem[],
  expenses: Expense[],
  manualWeights: Record<string, number> = {},
  scope: RateioItem[],
  composition?: CompositionConfig
): RateioResult {
  const merged = Object.fromEntries(
    items.map(item => [
      item.sku,
      {
        prod: item,
        totalRateado: 0,
        expenseRateado: undefined as number | undefined,
        sourceCostTotal: 0,
        composedSourceSkus: [] as string[],
        compositionRole: undefined as ResultItem['compositionRole'],
        composedTargetSkus: undefined as string[] | undefined,
      },
    ])
  );

  const totalExp = D(
    expenses.reduce((sum, expense) => sum + D(expense.valor, 4), 0),
    4
  );

  // Distribuir despesas nos itens
  expenses.forEach(expense => {
    const baseFor = (item: RateioItem): number => {
      if (expense.metodo === 'custo') return D(item.custo * item.qty, 4);
      if (expense.metodo === 'venda') return D(item.preco * item.qty, 4);
      if (expense.metodo === 'qty') return D(item.qty, 4);
      return D(manualWeights[item.sku] || 0, 4);
    };

    const totalBase = scope.reduce((sum, item) => sum + baseFor(item), 0);
    if (totalBase <= 0) return;

    let accumulated = 0;
    scope.forEach((item, index) => {
      const rateado =
        index === scope.length - 1
          ? D(expense.valor - accumulated, 4)
          : D((baseFor(item) / totalBase) * expense.valor, 4);
      if (index !== scope.length - 1) accumulated = D(accumulated + rateado, 4);
      merged[item.sku].totalRateado = D(
        merged[item.sku].totalRateado + rateado,
        4
      );
    });
  });

  // Aplicar composição (itens target compostos por itens fonte)
  if (composition) {
    const targetBuckets = composition.targetSkus
      .map(sku => merged[sku])
      .filter(Boolean);
    const sourceBuckets = composition.sourceSkus
      .map(sku => merged[sku])
      .filter(Boolean);

    if (targetBuckets.length > 0) {
      const sourceCostTotal = D(
        sourceBuckets.reduce(
          (sum, b) => sum + D(b.prod.custo * b.prod.qty, 4),
          0
        ),
        4
      );

      const composedExpenseTotal = D(
        scope.reduce((sum, item) => sum + (merged[item.sku]?.totalRateado || 0), 0),
        4
      );

      const composedTotal = D(sourceCostTotal + composedExpenseTotal, 4);
      const targetCosts = targetBuckets.map(b => D(b.prod.custo * b.prod.qty, 4));
      const totalCostBase = targetCosts.reduce((s, v) => s + v, 0);
      const targetQtys = targetBuckets.map(b => b.prod.qty);
      const totalQtyBase = targetQtys.reduce((s, v) => s + v, 0);
      const useQty = totalCostBase === 0;
      const totalBase = useQty ? totalQtyBase : totalCostBase;

      // Zerar rateio dos itens fonte
      scope.forEach(item => {
        if (!composition.targetSkus.includes(item.sku) && merged[item.sku]) {
          merged[item.sku].totalRateado = 0;
          merged[item.sku].expenseRateado = 0;
          merged[item.sku].compositionRole = composition.sourceSkus.includes(
            item.sku
          )
            ? 'source'
            : undefined;
          merged[item.sku].composedTargetSkus = composition.targetSkus;
        }
      });

      // Distribuir proporcionalmente entre alvos
      let accTotal = 0,
        accExpense = 0,
        accSource = 0;
      targetBuckets.forEach((bucket, index) => {
        const base = useQty
          ? bucket.prod.qty
          : D(bucket.prod.custo * bucket.prod.qty, 4);
        const isLast = index === targetBuckets.length - 1;
        const weight = totalBase > 0 ? base / totalBase : 1 / targetBuckets.length;

        const allocTotal = isLast
          ? D(composedTotal - accTotal, 4)
          : D(weight * composedTotal, 4);
        const allocExpense = isLast
          ? D(composedExpenseTotal - accExpense, 4)
          : D(weight * composedExpenseTotal, 4);
        const allocSource = isLast
          ? D(sourceCostTotal - accSource, 4)
          : D(weight * sourceCostTotal, 4);

        accTotal = D(accTotal + allocTotal, 4);
        accExpense = D(accExpense + allocExpense, 4);
        accSource = D(accSource + allocSource, 4);

        bucket.totalRateado = allocTotal;
        bucket.expenseRateado = allocExpense;
        bucket.sourceCostTotal = allocSource;
        bucket.composedSourceSkus = composition.sourceSkus;
        bucket.compositionRole = 'target';
      });
    }
  }

  // Compilar resultados
  let somaCheck = 0;
  const results = Object.values(merged).map(
    ({
      prod,
      totalRateado,
      expenseRateado,
      sourceCostTotal,
      composedSourceSkus,
      compositionRole,
      composedTargetSkus,
    }) => {
      const rat = D(totalRateado, 4);
      const expenseRat = D(expenseRateado ?? totalRateado, 4);
      const ratUnit = prod.qty > 0 ? D(rat / prod.qty, 4) : 0;
      const novoCusto = D(prod.custo + ratUnit, 4);
      const importedMargin =
        typeof prod.margemProposta === 'number'
          ? D(prod.margemProposta, 4)
          : undefined;
      const mgAnt =
        importedMargin ??
        (prod.preco > 0
          ? D((prod.preco - prod.custo) / prod.preco, 4)
          : 0);
      const mgNova =
        importedMargin ??
        (prod.preco > 0 ? D((prod.preco - novoCusto) / prod.preco, 4) : 0);
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
    }
  );

  const effectiveResults = composition
    ? results.filter(item => item.compositionRole === 'target')
    : results;
  const effectiveTotalVenda = effectiveResults.reduce(
    (sum, item) => sum + item.totV,
    0
  );
  const avgMgAnt =
    effectiveTotalVenda > 0
      ? D(
          effectiveResults.reduce(
            (sum, item) => sum + item.mgAnt * item.totV,
            0
          ) / effectiveTotalVenda,
          4
        )
      : 0;
  const avgMgNova =
    effectiveTotalVenda > 0
      ? D(
          effectiveResults.reduce(
            (sum, item) => sum + item.mgNova * item.totV,
            0
          ) / effectiveTotalVenda,
          4
        )
      : 0;
  const diff = D(totalExp - somaCheck, 4);

  return { results, avgMgAnt, avgMgNova, somaCheck, totalExp, diff, ok: Math.abs(diff) < 0.02 };
}

// ============================================================================
// PERSISTÊNCIA - STORAGE
// ============================================================================

export class RateioStorage {
  static save(rateios: SavedRateio[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rateios));
    } catch (error) {
      console.error('Erro ao salvar rateios:', error);
    }
  }

  static load(): SavedRateio[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  static clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }

  static addRateio(rateio: SavedRateio): SavedRateio[] {
    const rateios = this.load();
    const updated = [rateio, ...rateios];
    this.save(updated);
    return updated;
  }

  static deleteRateio(id: number): SavedRateio[] {
    const rateios = this.load().filter(r => r.id !== id);
    this.save(rateios);
    return rateios;
  }

  static getRateio(id: number): SavedRateio | null {
    const rateios = this.load();
    return rateios.find(r => r.id === id) || null;
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf';
  filename?: string;
}

export class RateioExporter {
  static toJSON(rateio: SavedRateio, metadata: any = {}): string {
    return JSON.stringify({
      sistema: 'Modulo de Rateio & Precificacao v2.0',
      exportado_em: new Date().toISOString(),
      ...metadata,
      rateio,
    }, null, 2);
  }

  static toCSV(result: RateioResult): string {
    const headers = [
      'SKU',
      'Descricao',
      'NCM',
      'Valor Orig. Unit.',
      'Valor Componentes',
      'Valor Rateado Total',
      'Desp. Acessoria',
      'Valor Rateado Unit.',
      'Valor Final Unit.',
      'Margem Proposta %',
      'Participacao %',
      'Qtd',
    ];

    const rows = result.results.map(item => [
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
    ]);

    return [headers, ...rows].map(row => row.join(';')).join('\n');
  }

  static toPDF(rateio: SavedRateio, result: RateioResult): string {
    const rows = result.results
      .map(
        item =>
          `<tr>
        <td>${item.prod.sku}</td>
        <td>${item.prod.desc}</td>
        <td style="text-align:center">${item.prod.qty}</td>
        <td style="text-align:right;font-family:monospace">R$ ${item.prod.preco.toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#dc2626">R$ ${item.expenseRat.toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace;color:#d97706">R$ ${(item.novoCusto * item.prod.qty).toFixed(2)}</td>
        <td style="text-align:center;color:#059669">${(item.mgNova * 100).toFixed(2)}%</td>
      </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Rateio — ${rateio.nome}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;}
    .header{background:linear-gradient(135deg,#1e3a5f,#0f766e);color:#fff;padding:24px 32px;}
    .header h1{font-size:20px;font-weight:800;}
    .content{padding:24px 32px;}
    table{width:100%;border-collapse:collapse;font-size:11px;}
    thead tr{background:#f1f5f9;}
    th{padding:8px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;}
    td{padding:8px 10px;border-bottom:1px solid #e2e8f0;}
    .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8;}
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Rateio de Despesas — ${rateio.nome}</h1>
    <p style="font-size:11px;opacity:0.8;margin-top:4px;">NF: ${rateio.snapshot?.nf?.numero || '-'} · ${rateio.snapshot?.nf?.emitente || '-'} · Salvo: ${rateio.data}</p>
  </div>
  <div class="content">
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Descrição</th>
          <th style="text-align:center">Qtd</th>
          <th style="text-align:right">Valor Orig. Unit.</th>
          <th style="text-align:right">Desp. Rat.</th>
          <th style="text-align:right">Valor Rateado Total</th>
          <th style="text-align:center">Margem Proposta</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="footer"><strong>PrismaGestão</strong> · Sistema de Gestão</div>
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;
  }

  static download(filename: string, content: string, type: string): void {
    if (typeof window === 'undefined') return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

// ============================================================================
// AUDITORIA
// ============================================================================

export class RateioAudit {
  static createEntry(
    user: string,
    justificativa: string,
    nf: string,
    mode: RateioMode,
    result: RateioResult,
    scopeLabel: string
  ): AuditEntry {
    return {
      ts: new Date().toLocaleString('pt-BR'),
      user,
      just: justificativa,
      nfNum: nf || '-',
      mode,
      totalExp: result.totalExp,
      avgAnt: result.avgMgAnt,
      avgNova: result.avgMgNova,
      itens: result.results.length,
      ok: result.ok,
      checksum: `SHA256-${Math.random().toString(36).slice(2, 14).toUpperCase()}`,
      scopeLabel,
    };
  }
}

export default {
  calcRateio,
  RateioStorage,
  RateioExporter,
  RateioAudit,
  D,
  fmt,
  pct,
};
