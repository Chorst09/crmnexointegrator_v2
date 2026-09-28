import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calculator,
  Clock,
  FilePlus2,
  FileText,
  FolderOpen,
  History,
  Pencil,
  PieChart,
  Search,
  Share2,
  Trash2,
  X
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import FinEdgeArchitect from '../precificacao/app/page';
import { scenarioService } from '../precificacao/services/scenario-service';

const formatCurrency = (value) => {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPercent = (value) => {
  const number = Number(value || 0);
  return `${number.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

const getScenarioDate = (scenario) => {
  const rawDate = scenario?.createdAt?.toDate ? scenario.createdAt.toDate() : scenario?.createdAt;
  const date = rawDate instanceof Date ? rawDate : rawDate ? new Date(rawDate) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const isMonthlyProratedPricing = (input) => {
  if (!input) return false;
  if (input.projectBillingMode === 'monthly') return true;
  return (input.recurringItems || []).some((item) => (
    String(item.description || '').toLowerCase().includes('rateado de')
  ));
};

const isMonthlyProratedScenario = (scenario) => (
  Boolean(scenario?.metadata?.allocation) || isMonthlyProratedPricing(scenario?.inputs)
);

const getScenarioClient = (scenario) => (
  scenario?.metadata?.clientCompany || 'Cliente não informado'
);

const getScenarioContact = (scenario) => (
  scenario?.metadata?.clientContact || ''
);

const getScenarioNumber = (scenario) => (
  scenario?.metadata?.proposalNumber || scenario?.metadata?.opportunityNumber || scenario?.id || '-'
);

const getScenarioTimestamp = (scenario) => {
  const date = getScenarioDate(scenario);
  return date ? date.toLocaleString('pt-BR') : 'Data não informada';
};

export default function PrecificacaoHome() {
  const navigate = useNavigate();
  const [showArchitect, setShowArchitect] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('cotacaoKey');
  });
  const [pricingHistory, setPricingHistory] = useState([]);
  const [architectLaunch, setArchitectLaunch] = useState({ action: null, scenarioId: null, key: 0 });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [historyFeedback, setHistoryFeedback] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const refresh = async () => {
      const scenarios = await scenarioService.getLatestScenarios();
      if (isMounted) setPricingHistory(Array.isArray(scenarios) ? scenarios : []);
    };

    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const summary = useMemo(() => {
    const totalContractValue = pricingHistory.reduce((sum, scenario) => (
      sum + Number(scenario?.results?.totalContractValue || 0)
    ), 0);
    const lastUpdatedDate = pricingHistory.map(getScenarioDate).filter(Boolean)[0];
    const lastUpdated = lastUpdatedDate
      ? lastUpdatedDate.toLocaleDateString('pt-BR')
      : '-';

    return {
      total: pricingHistory.length,
      totalContractValue,
      lastUpdated
    };
  }, [pricingHistory]);

  const standardPricingHistory = useMemo(
    () => pricingHistory.filter((item) => !isMonthlyProratedScenario(item)),
    [pricingHistory]
  );

  const proratedPricingHistory = useMemo(
    () => pricingHistory.filter((item) => isMonthlyProratedScenario(item)),
    [pricingHistory]
  );

  const openArchitect = (action = null, scenarioId = null) => {
    setArchitectLaunch((prev) => ({
      action,
      scenarioId,
      key: prev.key + 1
    }));
    setShowArchitect(true);
  };

  const deleteScenarioFromHome = async (scenarioId) => {
    try {
      await scenarioService.deleteScenario(scenarioId);
      setPricingHistory((prev) => prev.filter((item) => item.id !== scenarioId));
      setDeleteConfirmId(null);
      setHistoryFeedback({ type: 'success', text: 'Precificação excluída do histórico.' });
    } catch (error) {
      console.error('Erro ao excluir precificação salva:', error);
      setHistoryFeedback({ type: 'error', text: 'Não foi possível excluir esta precificação.' });
    }
  };

  if (showArchitect) {
    return (
      <FinEdgeArchitect
        key={architectLaunch.key}
        initialAction={architectLaunch.action}
        initialScenarioId={architectLaunch.scenarioId}
      />
    );
  }

  const modules = [
    {
      title: 'FinEdge Architect',
      description: 'Abrir o simulador de DRE, custos, margem, impostos e preço final.',
      icon: Calculator,
      iconBg: 'bg-blue-500',
      onClick: () => openArchitect()
    },
    {
      title: 'Rateio de Produtos',
      description: 'Distribuir custos mensais por produto e salvar rateios por cenário.',
      icon: Share2,
      iconBg: 'bg-cyan-500',
      onClick: () => openArchitect()
    },
    {
      title: 'DRE Gerencial',
      description: 'Conferir receita, impostos, CPV, comissão, despesas e EBITDA.',
      icon: PieChart,
      iconBg: 'bg-emerald-500',
      onClick: () => openArchitect()
    }
  ];

  const renderHistoryCard = (scenario, variant = 'standard') => {
    const margin = Number(scenario?.results?.metrics?.ebitdaMargin || 0);
    const isProrated = variant === 'prorated';

    return (
      <div
        key={scenario.id}
        className="group w-full rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 text-left shadow-xl shadow-black/10 transition-all hover:border-cyan-400/50 hover:bg-slate-900"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => openArchitect('edit', scenario.id)}
            className="flex min-w-0 flex-1 items-center gap-4 text-left"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isProrated ? 'bg-cyan-500/15 text-cyan-200' : 'bg-blue-500/15 text-blue-200'} border ${isProrated ? 'border-cyan-400/30' : 'border-blue-400/30'}`}>
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {getScenarioTimestamp(scenario)}
                </p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${isProrated ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>
                  {isProrated ? 'Com rateio' : 'Precificação'}
                </span>
              </div>
              <p className="mt-1 text-lg font-bold text-white">
                {formatCurrency(scenario?.results?.finalMonthlyPrice)}
                <span className="text-sm font-normal text-slate-400"> /mês</span>
              </p>
              <p className="mt-1 truncate text-sm font-bold text-slate-200">
                Cliente: {getScenarioClient(scenario)}
              </p>
              {getScenarioContact(scenario) ? (
                <p className="truncate text-xs font-semibold text-slate-400">
                  Contato: {getScenarioContact(scenario)}
                </p>
              ) : null}
              {scenario?.metadata?.allocation ? (
                <p className="mt-1 truncate text-xs font-bold text-cyan-200">
                  Rateio: {scenario.metadata.allocation.name} · {formatCurrency(scenario.metadata.allocation.totalMonthlyAllocated)}/mês
                </p>
              ) : null}
            </div>
          </button>

          <div className="grid grid-cols-3 gap-4 text-center sm:w-[260px]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Setup</p>
              <p className="text-sm font-bold text-slate-100">{scenario?.inputs?.upfrontItems?.length || 0}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Rec.</p>
              <p className="text-sm font-bold text-slate-100">{scenario?.inputs?.recurringItems?.length || 0}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Margem</p>
              <p className={`text-sm font-bold ${margin >= 20 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {formatPercent(margin)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => openArchitect('view', scenario.id)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/20"
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => openArchitect('edit', scenario.id)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-400/10 px-3 text-xs font-semibold text-blue-200 transition hover:bg-blue-400/20"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
            {deleteConfirmId === scenario.id ? (
              <>
                <button
                  type="button"
                  onClick={() => deleteScenarioFromHome(scenario.id)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-300/60 bg-red-500/20 px-3 text-xs font-bold text-red-100 transition hover:bg-red-500/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600/70 bg-slate-900 text-slate-300 transition hover:bg-slate-800"
                  title="Cancelar exclusão"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteConfirmId(scenario.id)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-400/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Número: {getScenarioNumber(scenario)}
        </p>
      </div>
    );
  };

  const renderHistorySection = (title, description, items, variant) => {
    if (items.length === 0) return null;

    return (
      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="text-base font-bold text-white">{title}</h4>
            <p className="text-xs font-semibold text-slate-400">{description}</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{items.length} salvo(s)</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => renderHistoryCard(item, variant))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Precificação"
        subtitle="Entrada central para simulações financeiras, DRE gerencial, rateio de produtos e histórico de precificações."
        icon={Calculator}
        gradient="blue"
        breadcrumbs={['Home', 'Pré-Vendas', 'Precificação']}
        actions={[
          {
            label: 'Abrir FinEdge',
            icon: Calculator,
            variant: 'primary',
            onClick: () => openArchitect()
          },
          {
            label: 'Orçamentos',
            icon: FileText,
            onClick: () => navigate('/orcamentos')
          }
        ]}
      />

      <div className="p-6 space-y-6">
        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-4 md:p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Controle de precificação</h2>
              <p className="text-sm text-slate-400">Crie, abra e acompanhe precificações salvas no módulo.</p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm font-semibold text-cyan-100">
              Precificações salvas: <span className="ml-1 text-cyan-300">{summary.total}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Valor total salvo</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(summary.totalContractValue)}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última atualização</p>
              <p className="mt-2 text-2xl font-bold text-white">{summary.lastUpdated}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => openArchitect()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-blue-400/60 bg-blue-500/85 px-4 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
              >
                <FilePlus2 className="h-4 w-4" />
                Nova
              </button>
              <button
                type="button"
                onClick={() => openArchitect()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {modules.map((module) => (
            <button
              key={module.title}
              type="button"
              onClick={module.onClick}
              className="group min-h-[150px] rounded-xl border border-slate-700/70 bg-slate-900/70 p-5 text-left shadow-xl shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-slate-900"
            >
              <div className="flex h-full items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${module.iconBg} shadow-lg shadow-black/20`}>
                  <module.icon className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white">{module.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{module.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4 md:p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Precificações Salvas</h3>
              <p className="text-sm text-slate-400">
                {pricingHistory.length > 0
                  ? `${pricingHistory.length} registro(s) disponíveis no Histórico do FinEdge Architect`
                  : 'Nenhuma precificação salva ainda'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openArchitect('history')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-600/70 bg-slate-900 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              <History className="h-4 w-4" />
              Ver histórico
            </button>
          </div>

          {historyFeedback ? (
            <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
              historyFeedback.type === 'error'
                ? 'border-red-400/30 bg-red-400/10 text-red-100'
                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
            }`}>
              {historyFeedback.text}
            </div>
          ) : null}

          {pricingHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-8 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-slate-500" />
              <p className="mt-3 text-sm text-slate-400">As próximas precificações salvas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-6">
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
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate('/orcamentos')}
            className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-5 text-left transition hover:border-cyan-400/50 hover:bg-slate-900"
          >
            <FileText className="h-6 w-6 text-cyan-300" />
            <h3 className="mt-3 text-base font-semibold text-white">Fila de Orçamentos</h3>
            <p className="mt-2 text-sm text-slate-300">Buscar orçamentos aprovados para enviar à precificação.</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/calculadoras')}
            className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-5 text-left transition hover:border-cyan-400/50 hover:bg-slate-900"
          >
            <BarChart3 className="h-6 w-6 text-emerald-300" />
            <h3 className="mt-3 text-base font-semibold text-white">Calculadoras</h3>
            <p className="mt-2 text-sm text-slate-300">Acessar as calculadoras de venda, locação e serviços.</p>
          </button>
        </section>
      </div>
    </div>
  );
}
