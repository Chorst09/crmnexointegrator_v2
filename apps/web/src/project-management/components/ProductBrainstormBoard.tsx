import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Filter,
  Flame,
  Gauge,
  Grid2x2,
  Layers3,
  Lightbulb,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  StickyNote,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Users,
  Wand2,
} from 'lucide-react';

type ClusterType = 'Dores do Cliente' | 'Oportunidades' | 'Soluções & Features' | 'Riscos & Suposições';
type HorizonType = 'Now' | 'Next' | 'Later' | 'Icebox';
type QuadrantKey = 'quick_wins' | 'strategic' | 'fill_ins' | 'reassess';

export interface BrainstormIdea {
  id: string;
  title: string;
  description: string;
  cluster: ClusterType;
  color: string;
  votes: number;
  reach: number;      // 1-10
  impact: number;     // 0.25 | 0.5 | 1 | 2 | 3
  confidence: number; // 50 | 80 | 100 (%)
  effort: number;     // 1-10 (person-weeks)
  horizon: HorizonType;
  quadrant: QuadrantKey;
  owner: string;
  tags: string[];
}

export interface RoadmapWaveItem {
  id: string;
  wave: string;
  horizon: HorizonType;
  title: string;
  outcome: string;
  progress: number;
  color: string;
  linkedIdeaIds: string[];
}

interface BrainstormState {
  productName: string;
  vision: string;
  ideas: BrainstormIdea[];
  roadmap: RoadmapWaveItem[];
}

const STORAGE_KEY = 'pm-product-brainstorm-v2';

const CLUSTER_COLORS: Record<ClusterType, string> = {
  'Dores do Cliente': '#f43f5e',
  'Oportunidades': '#18c8df',
  'Soluções & Features': '#22c55e',
  'Riscos & Suposições': '#f59e0b',
};

const STICKY_PALETTE = ['#18c8df', '#22c55e', '#f59e0b', '#f43f5e', '#8b5cf6', '#3b82f6'];

const computeRiceScore = (idea: BrainstormIdea): number => {
  const effort = Math.max(0.5, Number(idea.effort || 1));
  const score = (Number(idea.reach || 1) * Number(idea.impact || 1) * (Number(idea.confidence || 80) / 100)) / effort;
  return Number((score * 10).toFixed(1));
};

const DEFAULT_STATE: BrainstormState = {
  productName: 'NEXOS CRM & Inteligência B2B/B2G',
  vision: 'Transformar dados de mercado, editais e relacionamento em previsibilidade de receita com automação e IA.',
  ideas: [
    {
      id: 'idea-1',
      title: 'Copiloto IA para Resumo e Perguntas ao Edital',
      description: 'Extrair 17 blocos padrão ConLicitação e responder dúvidas jurídicas direto do PDF.',
      cluster: 'Soluções & Features',
      color: '#22c55e',
      votes: 14,
      reach: 9,
      impact: 3,
      confidence: 100,
      effort: 2,
      horizon: 'Now',
      quadrant: 'quick_wins',
      owner: 'Produto & IA',
      tags: ['B2G', 'IA', 'Editais'],
    },
    {
      id: 'idea-2',
      title: 'Proposta Comercial Automática 1-Clique',
      description: 'Gerar proposta Double 2026 em A4/PDF com itens puxados direto da Oportunidade B2B.',
      cluster: 'Oportunidades',
      color: '#18c8df',
      votes: 11,
      reach: 8,
      impact: 2,
      confidence: 100,
      effort: 1.5,
      horizon: 'Now',
      quadrant: 'quick_wins',
      owner: 'Comercial',
      tags: ['B2B', 'Propostas'],
    },
    {
      id: 'idea-3',
      title: 'Baixa visibilidade geográfica de contas',
      description: 'Times comerciais não enxergavam concentração por Cidade/UF nos mapas B2B e B2G.',
      cluster: 'Dores do Cliente',
      color: '#f43f5e',
      votes: 9,
      reach: 7,
      impact: 2,
      confidence: 80,
      effort: 2,
      horizon: 'Next',
      quadrant: 'strategic',
      owner: 'Dados & BI',
      tags: ['Dashboards', 'Mapa'],
    },
    {
      id: 'idea-4',
      title: 'Workflows n8n para Alertas de Licitação no WhatsApp',
      description: 'Notificar vendedores automaticamente quando surgir novo edital compatível com o portfólio.',
      cluster: 'Oportunidades',
      color: '#3b82f6',
      votes: 8,
      reach: 8,
      impact: 2,
      confidence: 80,
      effort: 3,
      horizon: 'Next',
      quadrant: 'strategic',
      owner: 'Automação',
      tags: ['n8n', 'Alertas'],
    },
    {
      id: 'idea-5',
      title: 'Dependência de APIs públicas instáveis (PNCP)',
      description: 'Timeouts e HTTP 502 em portais governamentais podem degradar a busca de anexos.',
      cluster: 'Riscos & Suposições',
      color: '#f59e0b',
      votes: 6,
      reach: 6,
      impact: 2,
      confidence: 80,
      effort: 2,
      horizon: 'Later',
      quadrant: 'fill_ins',
      owner: 'Arquitetura',
      tags: ['Resiliência', 'PNCP'],
    },
  ],
  roadmap: [
    {
      id: 'wave-1',
      wave: 'Onda 1 • Now',
      horizon: 'Now',
      title: 'Aceleração Comercial & IA Documental',
      outcome: 'Reduzir em 70% o tempo de análise de editais e emissão de propostas B2B.',
      progress: 85,
      color: '#22c55e',
      linkedIdeaIds: ['idea-1', 'idea-2'],
    },
    {
      id: 'wave-2',
      wave: 'Onda 2 • Next',
      horizon: 'Next',
      title: 'Automação Omnichannel & Inteligência Regional',
      outcome: 'Disparar alertas em tempo real via n8n e cruzar mapas B2B/B2G por UF.',
      progress: 40,
      color: '#18c8df',
      linkedIdeaIds: ['idea-3', 'idea-4'],
    },
    {
      id: 'wave-3',
      wave: 'Onda 3 • Later',
      horizon: 'Later',
      title: 'Cache Resiliente & Multi-Fontes Governamentais',
      outcome: 'Garantir 99.5% de disponibilidade mesmo com instabilidade no PNCP.',
      progress: 15,
      color: '#f59e0b',
      linkedIdeaIds: ['idea-5'],
    },
  ],
};

const QUADRANT_META: Record<QuadrantKey, { title: string; subtitle: string; badge: string; color: string }> = {
  quick_wins: {
    title: 'Quick Wins (Ganhos Rápidos)',
    subtitle: 'Alto Impacto • Baixo Esforço — Prioridade máxima',
    badge: 'Fazer Agora',
    color: '#22c55e',
  },
  strategic: {
    title: 'Projetos Estratégicos (Big Bets)',
    subtitle: 'Alto Impacto • Alto Esforço — Planejar em ondas',
    badge: 'Planejar',
    color: '#18c8df',
  },
  fill_ins: {
    title: 'Melhorias Incrementais',
    subtitle: 'Baixo Impacto • Baixo Esforço — Encaixar na sprint',
    badge: 'Quando possível',
    color: '#f59e0b',
  },
  reassess: {
    title: 'Reavaliar / Descartar',
    subtitle: 'Baixo Impacto • Alto Esforço — Evitar desperdício',
    badge: 'Icebox',
    color: '#f43f5e',
  },
};

const HORIZON_COLORS: Record<HorizonType, string> = {
  Now: '#22c55e',
  Next: '#18c8df',
  Later: '#f59e0b',
  Icebox: '#94a3b8',
};

const loadState = (): BrainstormState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.ideas)) return parsed;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
};

export default function ProductBrainstormBoard({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<BrainstormState>(loadState);
  const [activeTab, setActiveTab] = useState<'canvas' | 'rice' | 'matrix' | 'roadmap'>('canvas');
  const [searchTerm, setSearchTerm] = useState('');
  const [clusterFilter, setClusterFilter] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');
  const [newIdeaCluster, setNewIdeaCluster] = useState<ClusterType>('Oportunidades');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const totalVotes = useMemo(
    () => state.ideas.reduce((acc, it) => acc + Number(it.votes || 0), 0),
    [state.ideas]
  );

  const averageRice = useMemo(() => {
    if (!state.ideas.length) return 0;
    const sum = state.ideas.reduce((acc, it) => acc + computeRiceScore(it), 0);
    return Number((sum / state.ideas.length).toFixed(1));
  }, [state.ideas]);

  const filteredIdeas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...state.ideas]
      .filter((it) => {
        if (clusterFilter !== 'ALL' && it.cluster !== clusterFilter) return false;
        if (!q) return true;
        return (
          it.title.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.owner.toLowerCase().includes(q) ||
          it.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => computeRiceScore(b) - computeRiceScore(a));
  }, [state.ideas, searchTerm, clusterFilter]);

  const updateIdea = (id: string, patch: Partial<BrainstormIdea>) => {
    setState((prev) => ({
      ...prev,
      ideas: prev.ideas.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  };

  const handleCreateIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdeaTitle.trim()) return;
    const idea: BrainstormIdea = {
      id: `idea-${Date.now()}`,
      title: newIdeaTitle.trim(),
      description: newIdeaDesc.trim() || 'Detalhe a hipótese, dor do usuário ou critério de sucesso.',
      cluster: newIdeaCluster,
      color: CLUSTER_COLORS[newIdeaCluster],
      votes: 1,
      reach: 6,
      impact: 2,
      confidence: 80,
      effort: 2,
      horizon: 'Next',
      quadrant: 'quick_wins',
      owner: 'Produto',
      tags: [newIdeaCluster.split(' ')[0]],
    };
    setState((prev) => ({ ...prev, ideas: [idea, ...prev.ideas] }));
    setNewIdeaTitle('');
    setNewIdeaDesc('');
    setNewIdeaOpen(false);
  };

  const handleGenerateDiscoveryPack = () => {
    const samples: BrainstormIdea[] = [
      {
        id: `idea-ai-${Date.now()}-1`,
        title: 'Score de Propensão de Ganho em Editais B2G',
        description: 'Cruzar histórico de concorrentes e margem estimada para recomendar participar ou declinar.',
        cluster: 'Oportunidades',
        color: '#18c8df',
        votes: 5,
        reach: 8,
        impact: 3,
        confidence: 80,
        effort: 3,
        horizon: 'Next',
        quadrant: 'strategic',
        owner: 'IA & Pricing',
        tags: ['B2G', 'Score', 'IA'],
      },
      {
        id: `idea-ai-${Date.now()}-2`,
        title: 'Template de Proposta Interativa com Link Web',
        description: 'Enviar link rastreável da proposta Double 2026 com aceite eletrônico do cliente.',
        cluster: 'Soluções & Features',
        color: '#22c55e',
        votes: 7,
        reach: 9,
        impact: 2,
        confidence: 80,
        effort: 2,
        horizon: 'Now',
        quadrant: 'quick_wins',
        owner: 'B2B',
        tags: ['Propostas', 'Conversão'],
      },
    ];
    setState((prev) => ({ ...prev, ideas: [...samples, ...prev.ideas] }));
  };

  const handleExportMarkdown = () => {
    const md = [
      `# Brainstorming de Produto — ${state.productName}`,
      `> ${state.vision}`,
      '',
      '## Ranking RICE',
      ...filteredIdeas.map(
        (it, idx) =>
          `${idx + 1}. **${it.title}** (${it.cluster}) — RICE: **${computeRiceScore(it)}** | Votos: ${it.votes} | Horizonte: ${it.horizon}\n   ${it.description}`
      ),
      '',
      '## Roadmap (Now / Next / Later)',
      ...state.roadmap.map((w) => `- **${w.wave} — ${w.title}** (${w.progress}%): ${w.outcome}`),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brainstorming-produto-nexos.md';
    a.click();
  };

  return (
    <div className="h-full overflow-y-auto bg-transparent p-4 sm:p-6 lg:p-8 text-[var(--crm-ink)] space-y-6">
      {/* Cabeçalho Executivo */}
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.92)] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.8)] p-2 text-[var(--crm-muted)] hover:text-[var(--crm-ink)] transition-colors"
              title="Voltar para Quadros Mágicos"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                  <Lightbulb className="h-3.5 w-3.5" /> Quadro Inteligente
                </span>
                <span className="text-xs text-[var(--crm-muted)]">Discovery • RICE • Matriz 2×2 • Roadmap</span>
              </div>
              <input
                value={state.productName}
                onChange={(e) => setState((p) => ({ ...p, productName: e.target.value }))}
                className="mt-1.5 w-full bg-transparent text-xl sm:text-2xl font-black text-[var(--crm-ink)] outline-none focus:text-cyan-300"
              />
              <input
                value={state.vision}
                onChange={(e) => setState((p) => ({ ...p, vision: e.target.value }))}
                className="mt-1 w-full bg-transparent text-xs sm:text-sm text-[var(--crm-muted)] outline-none focus:text-[var(--crm-ink)]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNewIdeaOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" /> Nova Ideia / Post-it
            </button>
            <button
              type="button"
              onClick={handleGenerateDiscoveryPack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 px-3 py-2 text-xs font-bold text-indigo-300 transition-colors"
            >
              <Sparkles className="h-4 w-4" /> Sugerir Hipóteses
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.8)] hover:brightness-110 px-3 py-2 text-xs font-semibold text-[var(--crm-ink)]"
            >
              <Download className="h-4 w-4" /> Exportar MD
            </button>
            <button
              type="button"
              onClick={() => setState(JSON.parse(JSON.stringify(DEFAULT_STATE)))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-transparent hover:text-white px-3 py-2 text-xs font-semibold text-[var(--crm-muted)]"
              title="Restaurar quadro padrão"
            >
              <RotateCcw className="h-4 w-4" /> Restaurar
            </button>
          </div>
        </div>

        {/* 4 KPIs Executivos */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: StickyNote, label: 'Ideias & Hipóteses', value: String(state.ideas.length), sub: 'Em 4 clusters', color: '#18c8df' },
            { icon: ThumbsUp, label: 'Votos do Time', value: String(totalVotes), sub: 'Priorização colaborativa', color: '#22c55e' },
            { icon: Gauge, label: 'Score RICE Médio', value: String(averageRice), sub: '(Alcance × Impacto × Conf.) / Esforço', color: '#f59e0b' },
            { icon: Layers3, label: 'Ondas de Roadmap', value: `${state.roadmap.length} ondas`, sub: 'Now • Next • Later', color: '#6366f1' },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.7)] p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--crm-muted)]">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-black text-[var(--crm-ink)]">{kpi.value}</p>
                  <p className="text-[11px] text-[var(--crm-muted)] mt-0.5">{kpi.sub}</p>
                </div>
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${kpi.color}18`, color: kpi.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra de Navegação entre Modos + Busca */}
        <div className="mt-5 pt-4 border-t border-[var(--crm-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'canvas', label: 'Canvas & Post-its', icon: StickyNote },
              { id: 'rice', label: 'Tabela RICE', icon: TrendingUp },
              { id: 'matrix', label: 'Matriz 2×2 (Impacto × Esforço)', icon: Grid2x2 },
              { id: 'roadmap', label: 'Roadmap (Now / Next / Later)', icon: Layers3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    active
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-[rgb(var(--crm-surface-rgb)/0.8)] text-[var(--crm-muted)] hover:text-[var(--crm-ink)] border border-[var(--crm-border)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--crm-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar ideias ou tags..."
                className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.8)] pl-8 pr-3 py-1.5 text-xs text-[var(--crm-ink)] outline-none focus:border-cyan-400"
              />
            </div>
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.95)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)] outline-none focus:border-cyan-400"
            >
              <option value="ALL">Todos os Clusters</option>
              {Object.keys(CLUSTER_COLORS).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Modal Rápido Nova Ideia */}
      {newIdeaOpen && (
        <form
          onSubmit={handleCreateIdea}
          className="rounded-2xl border border-cyan-500/40 bg-[rgb(var(--crm-surface-2-rgb)/0.96)] p-5 shadow-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Adicionar Novo Post-it / Hipótese
            </h3>
            <button type="button" onClick={() => setNewIdeaOpen(false)} className="text-xs text-[var(--crm-muted)] hover:text-white">
              Fechar
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              required
              value={newIdeaTitle}
              onChange={(e) => setNewIdeaTitle(e.target.value)}
              placeholder="Título da ideia ou dor..."
              className="md:col-span-2 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.8)] px-3 py-2 text-sm text-[var(--crm-ink)] outline-none focus:border-cyan-400"
            />
            <select
              value={newIdeaCluster}
              onChange={(e) => setNewIdeaCluster(e.target.value as ClusterType)}
              className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.95)] px-3 py-2 text-sm text-[var(--crm-ink)] outline-none focus:border-cyan-400"
            >
              {Object.keys(CLUSTER_COLORS).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <textarea
            rows={2}
            value={newIdeaDesc}
            onChange={(e) => setNewIdeaDesc(e.target.value)}
            placeholder="Descreva o problema que resolve e o impacto esperado..."
            className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.8)] px-3 py-2 text-xs text-[var(--crm-ink)] outline-none focus:border-cyan-400"
          />
          <div className="flex justify-end gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">
              Adicionar ao Quadro
            </button>
          </div>
        </form>
      )}

      {/* TAB 1: CANVAS & STICKY NOTES AGRUPADOS POR CLUSTER */}
      {activeTab === 'canvas' && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(CLUSTER_COLORS) as ClusterType[]).map((cluster) => {
            const clusterColor = CLUSTER_COLORS[cluster];
            const items = filteredIdeas.filter((i) => i.cluster === cluster);
            return (
              <div
                key={cluster}
                className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.78)] p-4 flex flex-col gap-3 min-h-[420px]"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-[var(--crm-border)]">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: clusterColor }} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--crm-ink)]">{cluster}</h3>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-white/5 text-[var(--crm-muted)]">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {items.map((idea) => {
                    const rice = computeRiceScore(idea);
                    const isEditing = editingId === idea.id;
                    return (
                      <div
                        key={idea.id}
                        className="rounded-xl border p-3.5 transition-all hover:shadow-lg"
                        style={{
                          borderColor: `${idea.color}45`,
                          background: `linear-gradient(180deg, ${idea.color}16 0%, rgba(15,23,42,0.55) 100%)`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {isEditing ? (
                            <input
                              value={idea.title}
                              onChange={(e) => updateIdea(idea.id, { title: e.target.value })}
                              onBlur={() => setEditingId(null)}
                              autoFocus
                              className="w-full bg-black/30 rounded px-2 py-1 text-xs font-bold text-white outline-none border border-cyan-400"
                            />
                          ) : (
                            <h4
                              onClick={() => setEditingId(idea.id)}
                              className="text-xs sm:text-sm font-bold text-[var(--crm-ink)] leading-snug cursor-pointer hover:text-cyan-300"
                              title="Clique para editar título"
                            >
                              {idea.title}
                            </h4>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setState((p) => ({ ...p, ideas: p.ideas.filter((x) => x.id !== idea.id) }))
                            }
                            className="text-[var(--crm-muted)] hover:text-rose-400 p-0.5"
                            title="Excluir post-it"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="mt-1.5 text-[11px] text-[var(--crm-muted)] leading-relaxed">
                          {idea.description}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateIdea(idea.id, { votes: idea.votes + 1 })}
                              className="inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-cyan-500/30 px-2 py-1 text-[11px] font-bold text-white transition-colors"
                              title="Votar nesta ideia"
                            >
                              <ThumbsUp className="w-3 h-3 text-cyan-300" /> {idea.votes}
                            </button>
                            <span
                              className="rounded-md px-2 py-1 text-[10px] font-black"
                              style={{
                                backgroundColor: `${HORIZON_COLORS[idea.horizon]}22`,
                                color: HORIZON_COLORS[idea.horizon],
                              }}
                            >
                              {idea.horizon}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono font-bold text-amber-300">
                            RICE {rice}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            {STICKY_PALETTE.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => updateIdea(idea.id, { color: c })}
                                className={`w-3 h-3 rounded-full border ${
                                  idea.color === c ? 'border-white scale-125' : 'border-transparent opacity-60'
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <select
                            value={idea.cluster}
                            onChange={(e) =>
                              updateIdea(idea.id, {
                                cluster: e.target.value as ClusterType,
                                color: CLUSTER_COLORS[e.target.value as ClusterType],
                              })
                            }
                            className="bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-[var(--crm-muted)] outline-none"
                          >
                            {Object.keys(CLUSTER_COLORS).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: TABELA DE PRIORIZAÇÃO RICE */}
      {activeTab === 'rice' && (
        <div className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.9)] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[var(--crm-border)] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-[var(--crm-ink)]">Framework de Priorização RICE</h2>
              <p className="text-xs text-[var(--crm-muted)]">
                Score = (Alcance × Impacto × Confiança) ÷ Esforço. Ajuste os parâmetros em tempo real para ranquear o backlog.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[rgb(var(--crm-surface-rgb)/0.8)] border-b border-[var(--crm-border)] text-[var(--crm-muted)] uppercase">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Ideia / Iniciativa</th>
                  <th className="py-3 px-3 text-center">Votos</th>
                  <th className="py-3 px-3 text-center">Alcance (1-10)</th>
                  <th className="py-3 px-3 text-center">Impacto</th>
                  <th className="py-3 px-3 text-center">Confiança</th>
                  <th className="py-3 px-3 text-center">Esforço (sem)</th>
                  <th className="py-3 px-3 text-center">Score RICE</th>
                  <th className="py-3 px-4">Horizonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--crm-border)]">
                {filteredIdeas.map((idea, idx) => {
                  const score = computeRiceScore(idea);
                  return (
                    <tr key={idea.id} className="hover:bg-white/5">
                      <td className="py-3 px-4 font-mono font-bold text-[var(--crm-muted)]">{idx + 1}</td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-bold text-[var(--crm-ink)]">{idea.title}</div>
                        <div className="text-[11px] text-[var(--crm-muted)]">{idea.cluster} • {idea.owner}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => updateIdea(idea.id, { votes: idea.votes + 1 })}
                          className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-bold hover:bg-cyan-500/30"
                        >
                          <ThumbsUp className="w-3 h-3 text-cyan-300" /> {idea.votes}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={idea.reach}
                          onChange={(e) => updateIdea(idea.id, { reach: Number(e.target.value) })}
                          className="w-14 rounded border border-[var(--crm-border)] bg-black/20 px-1.5 py-1 text-center font-bold"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <select
                          value={idea.impact}
                          onChange={(e) => updateIdea(idea.id, { impact: Number(e.target.value) })}
                          className="rounded border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.95)] px-2 py-1 font-bold"
                        >
                          <option value={3}>3 (Massivo)</option>
                          <option value={2}>2 (Alto)</option>
                          <option value={1}>1 (Médio)</option>
                          <option value={0.5}>0.5 (Baixo)</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <select
                          value={idea.confidence}
                          onChange={(e) => updateIdea(idea.id, { confidence: Number(e.target.value) })}
                          className="rounded border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.95)] px-2 py-1 font-bold"
                        >
                          <option value={100}>100%</option>
                          <option value={80}>80%</option>
                          <option value={50}>50%</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min={0.5}
                          max={20}
                          step={0.5}
                          value={idea.effort}
                          onChange={(e) => updateIdea(idea.id, { effort: Number(e.target.value) })}
                          className="w-16 rounded border border-[var(--crm-border)] bg-black/20 px-1.5 py-1 text-center font-bold"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 font-mono font-black text-amber-300">
                          <Flame className="w-3 h-3" /> {score}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={idea.horizon}
                          onChange={(e) => updateIdea(idea.id, { horizon: e.target.value as HorizonType })}
                          className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.95)] px-2.5 py-1 font-bold"
                          style={{ color: HORIZON_COLORS[idea.horizon] }}
                        >
                          <option value="Now">Now</option>
                          <option value="Next">Next</option>
                          <option value="Later">Later</option>
                          <option value="Icebox">Icebox</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MATRIZ 2x2 IMPACTO x ESFORÇO */}
      {activeTab === 'matrix' && (
        <div className="grid gap-4 md:grid-cols-2">
          {(['quick_wins', 'strategic', 'fill_ins', 'reassess'] as QuadrantKey[]).map((qKey) => {
            const meta = QUADRANT_META[qKey];
            const items = filteredIdeas.filter((i) => i.quadrant === qKey);
            return (
              <div
                key={qKey}
                className="rounded-2xl border p-5 min-h-[260px] flex flex-col gap-3"
                style={{
                  borderColor: `${meta.color}40`,
                  background: `linear-gradient(180deg, ${meta.color}10 0%, rgba(15,23,42,0.75) 100%)`,
                }}
              >
                <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-[var(--crm-ink)]">{meta.title}</h3>
                    <p className="text-[11px] text-[var(--crm-muted)]">{meta.subtitle}</p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                    style={{ backgroundColor: `${meta.color}25`, color: meta.color }}
                  >
                    {meta.badge} ({items.length})
                  </span>
                </div>
                <div className="space-y-2.5 flex-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-[var(--crm-muted)] italic py-6 text-center">
                      Nenhuma hipótese neste quadrante.
                    </p>
                  ) : (
                    items.map((idea) => (
                      <div
                        key={idea.id}
                        className="rounded-xl border border-white/10 bg-black/25 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--crm-ink)] truncate">{idea.title}</div>
                          <div className="text-[10px] text-[var(--crm-muted)] mt-0.5">
                            RICE {computeRiceScore(idea)} • {idea.votes} votos • Esforço {idea.effort} sem
                          </div>
                        </div>
                        <select
                          value={idea.quadrant}
                          onChange={(e) => updateIdea(idea.id, { quadrant: e.target.value as QuadrantKey })}
                          className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-cyan-300 outline-none"
                        >
                          <option value="quick_wins">Quick Wins</option>
                          <option value="strategic">Estratégico</option>
                          <option value="fill_ins">Incremental</option>
                          <option value="reassess">Reavaliar</option>
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: ROADMAP OUTCOME-DRIVEN (NOW / NEXT / LATER) */}
      {activeTab === 'roadmap' && (
        <div className="grid gap-4 lg:grid-cols-3">
          {state.roadmap.map((wave) => {
            const linked = state.ideas.filter(
              (i) => wave.linkedIdeaIds.includes(i.id) || i.horizon === wave.horizon
            );
            return (
              <div
                key={wave.id}
                className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.9)] p-5 flex flex-col justify-between gap-4 shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-black uppercase"
                      style={{ backgroundColor: `${wave.color}20`, color: wave.color }}
                    >
                      {wave.wave}
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--crm-ink)]">{wave.progress}%</span>
                  </div>
                  <input
                    value={wave.title}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        roadmap: p.roadmap.map((w) => (w.id === wave.id ? { ...w, title: e.target.value } : w)),
                      }))
                    }
                    className="w-full bg-transparent text-base font-black text-[var(--crm-ink)] outline-none focus:text-cyan-300"
                  />
                  <textarea
                    rows={2}
                    value={wave.outcome}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        roadmap: p.roadmap.map((w) => (w.id === wave.id ? { ...w, outcome: e.target.value } : w)),
                      }))
                    }
                    className="w-full rounded-lg border border-[var(--crm-border)] bg-black/20 p-2.5 text-xs text-[var(--crm-muted)] outline-none focus:border-cyan-400"
                  />
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${wave.progress}%`, backgroundColor: wave.color }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={wave.progress}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        roadmap: p.roadmap.map((w) => (w.id === wave.id ? { ...w, progress: Number(e.target.value) } : w)),
                      }))
                    }
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div className="pt-3 border-t border-[var(--crm-border)] space-y-2">
                  <div className="text-[11px] font-bold uppercase text-[var(--crm-muted)]">
                    Iniciativas vinculadas ({linked.length})
                  </div>
                  {linked.map((it) => (
                    <div
                      key={it.id}
                      className="rounded-lg bg-black/25 border border-white/10 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-semibold text-[var(--crm-ink)] truncate">{it.title}</span>
                      <span className="font-mono text-[10px] font-bold text-amber-300 flex-shrink-0">
                        RICE {computeRiceScore(it)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
