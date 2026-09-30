"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Calendar,
  DollarSign,
  Eye,
  FileText,
  FolderOpen,
  History,
  Printer,
  Save,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RateioResultItem {
  prod?: {
    sku?: string;
    desc?: string;
    qty?: number;
    preco?: number;
    period?: number;
  };
  expenseRat?: number;
  novoCusto?: number;
  mgNova?: number;
  totV?: number;
  compositionRole?: "target" | "source";
  composedSourceSkus?: string[];
}

interface SavedRateio {
  id: number;
  nome: string;
  data: string;
  metodo?: string;
  snapshot?: {
    nf?: {
      numero?: string;
      emitente?: string;
    };
    responsavel?: string;
    justificativa?: string;
    items?: Array<{
      operationType?: "venda" | "locacao" | "servicos";
      period?: number;
      un?: string;
    }>;
    proposal?: {
      operationType?: "venda" | "locacao" | "servicos";
      period?: number;
    };
  };
  resultado?: {
    results?: RateioResultItem[];
    avgMgNova?: number;
  };
  resumo?: {
    totalItens?: number;
    totalDespesas?: number;
    totalCusto?: number;
    totalVenda?: number;
    margem?: number;
  };
}

const STORAGE_KEY = "precifica_rateios_v2";
const PRICING_SIMULATIONS_STORAGE_KEY = "pre_sales_pricing_simulations_v1";

const currency = (value: number | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);

const money = (value: number | undefined) => currency(value).replace(/\s/g, " ");

const percent = (value: number | undefined) =>
  `${((Number(value) || 0) * 100).toFixed(2)}%`;

const formatDateTime = (value: string | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const itemQuantity = (item: RateioResultItem) => Number(item.prod?.qty) || 0;

const itemUnitRateado = (item: RateioResultItem) => Number(item.novoCusto) || 0;

const itemRateadoTotal = (item: RateioResultItem) =>
  itemUnitRateado(item) * itemQuantity(item);

const getTargetResults = (results: RateioResultItem[]) => {
  const targetItems = results.filter((item) => item.compositionRole === "target");
  return targetItems.length > 0 ? targetItems : results;
};

const hasExplicitTargets = (results: RateioResultItem[]) =>
  results.some((item) => item.compositionRole === "target");

const originalValueFromItems = (items: RateioResultItem[]) =>
  items.reduce((sum, item) => {
    const totalVenda = Number(item.totV);
    if (Number.isFinite(totalVenda) && totalVenda > 0) return sum + totalVenda;
    return sum + (Number(item.prod?.preco) || 0) * (Number(item.prod?.qty) || 0);
  }, 0);

const visibleOriginalValue = (rateio: SavedRateio, visibleResults: RateioResultItem[]) => {
  const allResults = rateio.resultado?.results || [];
  if (!hasExplicitTargets(allResults)) return rateio.resumo?.totalVenda;
  return originalValueFromItems(visibleResults);
};

const visibleMargin = (rateio: SavedRateio) =>
  typeof rateio.resultado?.avgMgNova === "number"
    ? rateio.resultado.avgMgNova
    : rateio.resumo?.margem;

const isLocacaoRateio = (rateio: SavedRateio) => {
  if (rateio.snapshot?.proposal?.operationType === "locacao") return true;
  if (rateio.snapshot?.items?.some((item) => item.operationType === "locacao" || item.un === "/mês")) return true;
  return rateio.nome.toLowerCase().includes("loca");
};

const proposalPeriodFromStorage = (rateio: SavedRateio) => {
  if (typeof window === "undefined") return 0;
  try {
    const simulations = Object.values(JSON.parse(localStorage.getItem(PRICING_SIMULATIONS_STORAGE_KEY) || "{}") || {});
    const legacy = JSON.parse(localStorage.getItem("savedProposals") || "[]");
    const proposals = [...simulations, ...(Array.isArray(legacy) ? legacy : [])] as Array<{
      proposalNumber?: string;
      rentalPeriod?: number;
      contractTermMonths?: number;
      period?: number;
      quoteItems?: Array<{ period?: number }>;
    }>;
    const proposalNumber = rateio.snapshot?.nf?.numero;
    const proposal = proposals.find((item) => {
      const number = String(item.proposalNumber || "");
      return number && (number === proposalNumber || rateio.nome.includes(number));
    });
    if (!proposal) return 0;
    const itemPeriod = Math.max(...(proposal.quoteItems || []).map((item) => Number(item.period) || 0), 0);
    return Number(proposal.rentalPeriod || proposal.contractTermMonths || proposal.period || itemPeriod || 0);
  } catch {
    return 0;
  }
};

const contractPeriodMonths = (rateio: SavedRateio, results: RateioResultItem[]) => {
  const snapshotPeriod = Number(rateio.snapshot?.proposal?.period) || 0;
  const storedProposalPeriod = proposalPeriodFromStorage(rateio);
  const itemPeriods = [
    ...(rateio.snapshot?.items || []).map((item) => Number(item.period) || 0),
    ...results.map((item) => Number(item.prod?.period) || 0),
  ];
  return Math.max(snapshotPeriod, storedProposalPeriod, ...itemPeriods, 0);
};

const monthlyRateadoTotal = (results: RateioResultItem[]) =>
  results.reduce((sum, item) => sum + itemRateadoTotal(item), 0);

const calculationLine = (item: RateioResultItem) =>
  `${money(itemUnitRateado(item))} x ${itemQuantity(item)} un.`;

const methodLabel = (value?: string) => {
  if (!value) return "Por Custo";
  const labels: Record<string, string> = {
    cost: "Por Custo",
    custo: "Por Custo",
    weight: "Por Peso",
    peso: "Por Peso",
    quantity: "Por Quantidade",
    quantidade: "Por Quantidade",
    manual: "Manual",
  };
  return labels[value] || value;
};

export default function RateiosSalvosPage() {
  const router = useRouter();
  const [rateios, setRateios] = useState<SavedRateio[]>([]);
  const [query, setQuery] = useState("");
  const [selectedRateio, setSelectedRateio] = useState<SavedRateio | null>(null);

  useEffect(() => {
    try {
      setRateios(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      setRateios([]);
    }
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rateios;
    return rateios.filter((rateio) => {
      const nf = rateio.snapshot?.nf;
      return [rateio.nome, nf?.numero, nf?.emitente, rateio.data]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [query, rateios]);

  const totals = useMemo(
    () => ({
      despesas: rateios.reduce((sum, item) => sum + (Number(item.resumo?.totalDespesas) || 0), 0),
      processado: rateios.reduce((sum, item) => sum + (Number(item.resumo?.totalVenda) || 0), 0),
      itens: rateios.reduce((sum, item) => sum + (Number(item.resumo?.totalItens) || 0), 0),
    }),
    [rateios],
  );

  const deleteRateio = (id: number) => {
    if (!window.confirm("Excluir este rateio salvo?")) return;
    const updated = rateios.filter((rateio) => rateio.id !== id);
    setRateios(updated);
    setSelectedRateio((current) => (current?.id === id ? null : current));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const loadRateio = (id: number) => {
    sessionStorage.setItem("precifica_rateio_to_load", String(id));
    router.push("/pricing/ratear-produtos");
  };

  const printRateio = (rateio: SavedRateio) => {
    const results = rateio.resultado?.results || [];
    const visibleResults = getTargetResults(results);
    const originalValue = visibleOriginalValue(rateio, visibleResults);
    const margin = visibleMargin(rateio);
    const isLocacao = isLocacaoRateio(rateio);
    const periodMonths = contractPeriodMonths(rateio, visibleResults);
    const monthlyTotal = monthlyRateadoTotal(visibleResults);
    const contractTotal = isLocacao && periodMonths > 0 ? monthlyTotal * periodMonths : 0;
    const rows = visibleResults
      .map((item) => {
        const sku = item.prod?.sku || "-";
        const desc = item.prod?.desc || "-";
        const qty = Number(item.prod?.qty) || 0;
        const sourceNote = item.composedSourceSkus?.length
          ? `<small class="note">Inclui: ${escapeHtml(item.composedSourceSkus.join(", "))}</small>`
          : "";
        return `
          <tr>
            <td><span class="sku">${escapeHtml(sku)}</span></td>
            <td><strong>${escapeHtml(desc)}</strong>${sourceNote}</td>
            <td class="center">${qty}</td>
            <td class="right muted">${money(item.prod?.preco)}</td>
            <td class="right danger">${money(item.expenseRat)}</td>
            <td class="right amber">${money(itemRateadoTotal(item))}<small class="note right">${escapeHtml(calculationLine(item))}</small></td>
            <td class="right ok">${money(itemUnitRateado(item))}</td>
            <td class="center"><span class="pill">${percent(item.mgNova)}</span></td>
          </tr>
        `;
      })
      .join("");

    const win = window.open("", "_blank", "width=1120,height=800");
    if (!win) return;
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>${escapeHtml(rateio.nome)}</title>
      <style>
        *{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#162033;font-family:Arial,Helvetica,sans-serif;font-size:12px}
        .page{width:960px;margin:18px auto;background:#fff;padding:0 42px 34px;box-shadow:0 2px 18px rgba(15,23,42,.12)}
        .topline{display:flex;justify-content:space-between;padding:18px 0 8px;font-size:11px;color:#0f172a}
        .hero{background:linear-gradient(135deg,#155f9b,#0f8375);color:#fff;padding:26px 32px;margin-bottom:28px}
        .hero h1{font-size:24px;line-height:1.15;margin:0 0 8px;font-weight:800}
        .hero p{margin:2px 0;color:rgba(255,255,255,.78)}
        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
        .kpi{border:1px solid #dbe3ef;border-radius:9px;padding:14px 16px;background:#f8fafc}
        .kpi span{display:block;color:#64748b;text-transform:uppercase;font-size:10px;font-weight:800;margin-bottom:7px}
        .kpi strong{font-family:Consolas,monospace;font-size:18px}
        .danger{color:#dc2626}.amber{color:#d97706}.ok{color:#059669}.muted{color:#475569}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
        th{background:#edf2f8;color:#52627a;text-transform:uppercase;font-size:10px;text-align:left;padding:10px 12px}
        td{border-bottom:1px solid #dce4ef;padding:10px 12px;vertical-align:middle}
        .right{text-align:right;font-family:Consolas,monospace}.center{text-align:center}.sku{background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:4px 7px;font-family:Consolas,monospace}
        .pill{display:inline-block;border-radius:999px;background:#bbf7d0;color:#047857;font-weight:800;padding:3px 12px}
        .note{display:block;margin-top:4px;color:#64748b;font-size:9px}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:28px;border:1px solid #dbe3ef;border-radius:10px;padding:18px;background:#f8fafc}
        .summary{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:20px}
        .summary-card{border:1px solid #dbe3ef;border-radius:9px;padding:14px 16px;background:#f8fafc}
        .summary-card span{display:block;color:#64748b;text-transform:uppercase;font-size:10px;font-weight:800;margin-bottom:6px}
        .summary-card strong{font-family:Consolas,monospace;font-size:20px}
        .info p{margin:0 0 12px}.footer{border-top:1px solid #dbe3ef;margin-top:28px;padding-top:14px;text-align:center;color:#94a3b8;font-size:10px}
        @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:auto;margin:0;box-shadow:none}.topline{padding-top:0}}
      </style></head><body>
      <main class="page">
        <div class="topline"><span>${new Date().toLocaleString("pt-BR")}</span><span>Rateio — ${escapeHtml(rateio.nome)}</span></div>
        <section class="hero">
          <h1>Rateio de Despesas — ${escapeHtml(rateio.nome)}</h1>
          <p>NF: ${escapeHtml(rateio.snapshot?.nf?.numero || "-")} · ${escapeHtml(rateio.snapshot?.nf?.emitente || "-")} · Salvo: ${escapeHtml(formatDateTime(rateio.data))}</p>
          <p>Responsável: ${escapeHtml(rateio.snapshot?.responsavel || "-")}</p>
        </section>
        <section class="kpis">
          <div class="kpi"><span>Total itens</span><strong>${visibleResults.length}</strong></div>
          <div class="kpi"><span>Total despesas</span><strong class="danger">${money(rateio.resumo?.totalDespesas)}</strong></div>
          <div class="kpi"><span>Valor original</span><strong class="amber">${money(originalValue)}</strong></div>
          <div class="kpi"><span>Margem proposta</span><strong class="ok">${percent(margin)}</strong></div>
        </section>
        <table>
          <thead><tr><th>SKU</th><th>Descrição</th><th class="center">Qtd</th><th class="right">Valor orig.</th><th class="right">Desp. rat.</th><th class="right">Valor rateado total</th><th class="right">Valor unit.</th><th class="center">Margem proposta</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="summary">
          <div class="summary-card"><span>${isLocacao ? "Cálculo mensal" : "Total rateado"}</span><strong class="ok">${money(monthlyTotal)}</strong></div>
          ${
            isLocacao
              ? `<div class="summary-card"><span>Contrato${periodMonths > 0 ? ` (${periodMonths} meses)` : ""}</span><strong class="amber">${periodMonths > 0 ? money(contractTotal) : "-"}</strong></div>`
              : `<div class="summary-card"><span>Quantidade x unitário</span><strong class="amber">${visibleResults.length} linha(s)</strong></div>`
          }
        </section>
        <section class="info">
          <div><p><strong>Responsável:</strong> ${escapeHtml(rateio.snapshot?.responsavel || "-")}</p><p><strong>Justificativa:</strong> ${escapeHtml(rateio.snapshot?.justificativa || "-")}</p></div>
          <div>
            <p><strong>Método:</strong> ${escapeHtml(methodLabel(rateio.metodo))}</p>
            <p><strong>Total venda:</strong> ${money(originalValue)}</p>
            <p><strong>Cálculo mensal:</strong> ${money(monthlyTotal)}</p>
            ${isLocacao ? `<p><strong>Total contrato:</strong> ${periodMonths > 0 ? `${money(contractTotal)} (${periodMonths} meses)` : "Prazo não informado"}</p>` : ""}
          </div>
        </section>
        <div class="footer"><strong>PrismaGestão</strong> · Sistema de Gestão · prismagestao.chorstconsult.com.br</div>
      </main>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            <Save className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">Rateios Salvos</h1>
            <p className="text-muted-foreground">
              Histórico de rateios executados e salvos no sistema.
            </p>
          </div>
        </div>
        <Button asChild size="lg">
          <Link href="/pricing/ratear-produtos">
            <FileText className="mr-2 h-5 w-5" />
            Novo Rateio
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Total de Rateios" value={String(rateios.length)} icon={<Save />} tone="blue" />
        <Kpi title="Total Despesas Rateadas" value={currency(totals.despesas)} icon={<DollarSign />} tone="rose" />
        <Kpi title="Valor Original Processado" value={currency(totals.processado)} icon={<TrendingUp />} tone="amber" />
        <Kpi title="Total Itens Processados" value={String(totals.itens)} icon={<Calculator />} tone="cyan" />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome, NF ou emitente..."
          className="h-14 pl-12 text-base"
        />
      </div>

      <Card className="overflow-hidden border-primary/20 bg-card/80">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-5 p-8 text-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground/50" />
              <div>
                <h2 className="text-xl font-bold">Nenhum rateio salvo ainda</h2>
                <p className="mt-2 text-muted-foreground">
                  Execute um rateio no módulo "Ratear Produtos" e clique em "Salvar".
                </p>
              </div>
              <Button asChild>
                <Link href="/pricing/ratear-produtos">
                  <FileText className="mr-2 h-4 w-4" />
                  Ir para Ratear Produtos
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {filtered.map((rateio) => (
                <RateioCard
                  key={rateio.id}
                  rateio={rateio}
                  onView={() => setSelectedRateio(rateio)}
                  onPrint={() => printRateio(rateio)}
                  onDelete={() => deleteRateio(rateio.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRateio ? (
        <RateioPreviewModal
          rateio={selectedRateio}
          onClose={() => setSelectedRateio(null)}
          onPrint={() => printRateio(selectedRateio)}
          onLoad={() => loadRateio(selectedRateio.id)}
        />
      ) : null}
    </div>
  );
}

function RateioCard({
  rateio,
  onView,
  onPrint,
  onDelete,
}: {
  rateio: SavedRateio;
  onView: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const results = rateio.resultado?.results || [];
  const visibleResults = getTargetResults(results);
  const originalValue = visibleOriginalValue(rateio, visibleResults);
  const margin = visibleMargin(rateio);
  const isLocacao = isLocacaoRateio(rateio);
  const periodMonths = contractPeriodMonths(rateio, visibleResults);
  const monthlyTotal = monthlyRateadoTotal(visibleResults);
  const products = visibleResults.slice(0, 4);

  return (
    <div className="rounded-xl border border-primary/25 bg-slate-950/50 p-5 shadow-sm transition hover:border-primary/45">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="max-w-full truncate text-xl font-extrabold text-foreground">{rateio.nome}</h2>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-primary">
              NF #{rateio.snapshot?.nf?.numero || "-"}
            </Badge>
            <Badge variant="secondary">{methodLabel(rateio.metodo)}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDateTime(rateio.data)}
            </span>
            <span>{rateio.snapshot?.nf?.emitente || "Emitente nao informado"}</span>
            <span>{visibleResults.length} itens</span>
            <span>Resp: {rateio.snapshot?.responsavel || "-"}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            Ver
          </Button>
          <Button variant="outline" className="border-emerald-500/40 text-emerald-500 hover:text-emerald-500" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="destructive" onClick={onDelete} aria-label="Excluir rateio">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="my-5 h-px bg-border" />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Total despesas" value={currency(rateio.resumo?.totalDespesas)} tone="rose" />
        <Metric label="Valor original" value={currency(originalValue)} tone="amber" />
        <Metric label={isLocacao ? "Cálculo mensal" : "Total rateado"} value={currency(monthlyTotal)} tone="emerald" />
        <Metric label="Margem proposta" value={percent(margin)} tone="indigo" />
      </div>

      {isLocacao ? (
        <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold text-emerald-200">Total para o período do contrato</span>
            <span className="font-mono text-xl font-black text-emerald-400">
              {periodMonths > 0 ? currency(monthlyTotal * periodMonths) : "-"}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-200/75">
            {periodMonths > 0 ? `${currency(monthlyTotal)} mensal x ${periodMonths} meses` : "Prazo do contrato não informado no rateio salvo."}
          </p>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="mt-5">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Produtos alvo</p>
          <div className="flex flex-wrap gap-2">
            {products.map((item, index) => (
              <span
                key={`${item.prod?.sku || item.prod?.desc || "produto"}-${index}`}
                className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm"
              >
                <strong>{item.prod?.desc || "Produto"}</strong>
                <span className="ml-2 text-muted-foreground">Valor rateado:</span>
                <span className="ml-1 font-mono font-bold text-amber-500">{money(itemRateadoTotal(item))}</span>
                <span className="mx-1 text-muted-foreground">· Unit:</span>
                <span className="font-mono font-bold text-emerald-500">{money(itemUnitRateado(item))}</span>
              </span>
            ))}
            {visibleResults.length > products.length ? (
              <span className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                +{visibleResults.length - products.length} produto(s)
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RateioPreviewModal({
  rateio,
  onClose,
  onPrint,
  onLoad,
}: {
  rateio: SavedRateio;
  onClose: () => void;
  onPrint: () => void;
  onLoad: () => void;
}) {
  const results = rateio.resultado?.results || [];
  const visibleResults = getTargetResults(results);
  const originalValue = visibleOriginalValue(rateio, visibleResults);
  const margin = visibleMargin(rateio);
  const isLocacao = isLocacaoRateio(rateio);
  const periodMonths = contractPeriodMonths(rateio, visibleResults);
  const monthlyTotal = monthlyRateadoTotal(visibleResults);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-primary/30 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-blue-500 to-blue-700 p-6 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">{rateio.nome}</h2>
            <p className="mt-2 text-sm text-blue-100">
              NF #{rateio.snapshot?.nf?.numero || "-"} · {rateio.snapshot?.nf?.emitente || "-"} · {formatDateTime(rateio.data)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onPrint} className="bg-white/20 text-white hover:bg-white/30">
              <Printer className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/20 hover:text-white" aria-label="Fechar">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Total itens" value={String(visibleResults.length)} tone="blue" />
            <Metric label="Total despesas" value={currency(rateio.resumo?.totalDespesas)} tone="rose" />
            <Metric label="Valor original" value={currency(originalValue)} tone="amber" />
            <Metric label={isLocacao ? "Cálculo mensal" : "Total rateado"} value={currency(monthlyTotal)} tone="emerald" />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-700">
            <div className="border-b border-slate-700 bg-slate-900 px-5 py-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wide">Resultado do Rateio — Produtos Alvo</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-800 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-left">Produto</th>
                    <th className="px-4 py-3 text-center">Qtd</th>
                    <th className="px-4 py-3 text-right">Valor Orig.</th>
                    <th className="px-4 py-3 text-right">Desp. Rat.</th>
                    <th className="bg-amber-50 px-4 py-3 text-right text-slate-500">Valor Rateado Total</th>
                    <th className="bg-emerald-50 px-4 py-3 text-right text-slate-500">Valor Unit.</th>
                    <th className="px-4 py-3 text-center">Margem Proposta</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((item, index) => (
                    <tr key={`${item.prod?.sku || item.prod?.desc || "item"}-${index}`} className="border-t border-slate-800">
                      <td className="px-4 py-4">
                        <span className="rounded bg-blue-500/15 px-2 py-1 font-mono text-xs text-blue-400">{item.prod?.sku || "-"}</span>
                      </td>
                      <td className="px-4 py-4 font-bold">
                        {item.prod?.desc || "-"}
                        {item.composedSourceSkus?.length ? (
                          <small className="mt-1 block text-xs font-medium text-slate-400">
                            Inclui: {item.composedSourceSkus.join(", ")}
                          </small>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-center">{item.prod?.qty || 0}</td>
                      <td className="px-4 py-4 text-right font-mono text-slate-400">{currency(item.prod?.preco)}</td>
                      <td className="px-4 py-4 text-right font-mono text-rose-400">{currency(item.expenseRat)}</td>
                      <td className="bg-amber-50 px-4 py-4 text-right font-mono font-bold text-amber-500">
                        {currency(itemRateadoTotal(item))}
                        <small className="mt-1 block text-[10px] font-semibold text-amber-700">
                          {calculationLine(item)}
                        </small>
                      </td>
                      <td className="bg-emerald-50 px-4 py-4 text-right font-mono font-bold text-emerald-600">{currency(itemUnitRateado(item))}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-black text-emerald-800">
                          {percent(item.mgNova)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-700 bg-slate-900">
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-right text-xs font-black uppercase text-slate-400">
                      {isLocacao ? "Cálculo mensal" : "Total rateado"}
                    </td>
                    <td className="bg-amber-50 px-4 py-4 text-right font-mono text-base font-black text-amber-500">
                      {currency(monthlyTotal)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {isLocacao ? (
            <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-emerald-200/80">Total para o período do contrato</p>
                  <p className="mt-1 text-sm text-emerald-200/75">
                    {periodMonths > 0 ? `${currency(monthlyTotal)} mensal x ${periodMonths} meses` : "Prazo do contrato não informado no rateio salvo."}
                  </p>
                </div>
                <p className="font-mono text-2xl font-black text-emerald-400">
                  {periodMonths > 0 ? currency(monthlyTotal * periodMonths) : "-"}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 rounded-xl border border-slate-700 bg-slate-900 p-5 md:grid-cols-2">
            <div className="space-y-3">
              <p><strong>Responsável:</strong> <span className="text-slate-300">{rateio.snapshot?.responsavel || "-"}</span></p>
              <p><strong>Justificativa:</strong> <span className="text-slate-300">{rateio.snapshot?.justificativa || "-"}</span></p>
            </div>
            <div className="space-y-3">
              <p><strong>Método:</strong> <span className="text-slate-300">{methodLabel(rateio.metodo)}</span></p>
              <p><strong>Total venda:</strong> <span className="font-mono text-emerald-400">{currency(originalValue)}</span></p>
              <p><strong>Cálculo mensal:</strong> <span className="font-mono text-emerald-400">{currency(monthlyTotal)}</span></p>
              {isLocacao ? (
                <p>
                  <strong>Total contrato:</strong>{" "}
                  <span className="font-mono text-emerald-400">
                    {periodMonths > 0 ? currency(monthlyTotal * periodMonths) : "-"}
                  </span>
                  {periodMonths > 0 ? <span className="text-slate-400"> ({periodMonths} meses)</span> : null}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={onLoad}>
              <History className="mr-2 h-4 w-4" />
              Carregar para edição
            </Button>
            <Button onClick={onPrint}>
              <Printer className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: "blue" | "rose" | "amber" | "cyan";
}) {
  const tones = {
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-500",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-500",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-500",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-500",
  };

  return (
    <Card className={tones[tone]}>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          <p className="mt-3 text-2xl font-black">{value}</p>
        </div>
        <div className="rounded-lg bg-background/40 p-3 [&_svg]:h-6 [&_svg]:w-6">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "blue" | "rose" | "amber" | "emerald" | "indigo";
}) {
  const tones = {
    default: "text-foreground",
    blue: "text-blue-500",
    rose: "text-rose-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    indigo: "text-indigo-400",
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-center">
      <p className="text-xs font-extrabold uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-mono text-lg font-black", tones[tone])}>{value}</p>
    </div>
  );
}
