import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Rocket,
  CheckCircle2,
  Building2,
  UserCheck,
  TrendingUp,
  ClipboardList,
  FileSpreadsheet,
  Calculator,
  Send,
  Trophy,
  FolderKanban,
  CalendarCheck,
  ExternalLink,
  RefreshCw,
  X,
  Play,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { getAuthHeaders, buildApiUrl } from '../config/api';

const STEP_ICONS = {
  1: Building2,
  2: UserCheck,
  3: TrendingUp,
  4: ClipboardList,
  5: FileSpreadsheet,
  6: Calculator,
  7: Send,
  8: Trophy,
  9: FolderKanban,
  10: CalendarCheck
};

export default function B2BTestFlowModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Carrega o status / último teste executado ao abrir
  useEffect(() => {
    if (isOpen) {
      loadLastStatus();
    }
  }, [isOpen]);

  const loadLastStatus = async () => {
    try {
      setError(null);
      const res = await fetch(buildApiUrl('/test-flow/status'), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {
      console.warn('Aviso ao carregar status do teste:', err);
    }
  };

  const handleRunTestFlow = async () => {
    setLoading(true);
    setError(null);
    setCurrentStepIndex(1);

    // Simulação visual de progresso enquanto a requisição roda
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < 10 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await fetch(buildApiUrl('/test-flow/run'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ triggerSource: 'UI_MODAL' })
      });

      clearInterval(interval);
      setCurrentStepIndex(10);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || 'Falha ao executar o fluxo de teste');
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Erro ao processar fluxo de teste');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl my-8 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header do Modal */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-[rgb(var(--crm-surface-2-rgb)_/_1)] via-indigo-950/70 to-[rgb(var(--crm-surface-2-rgb)_/_1)] border-b border-[var(--crm-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/25">
              <Rocket className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] tracking-tight">
                  Teste de Fluxo B2B Completo (Todos os Módulos)
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  E2E 10 Fases
                </span>
              </div>
              <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">
                Empresa ➔ Lead ➔ Oportunidade ➔ Pré-Vendas ➔ Orçamento ➔ Precificação Comercial ➔ Fechamento Ganho ➔ Gestão de Projeto ➔ Kickoff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunTestFlow}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executando ({currentStepIndex}/10)...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Executar Novo Teste E2E</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo Principal com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[rgb(var(--crm-surface-2-rgb)_/_0.95)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Erro na execução do teste</p>
                <p className="text-xs text-rose-700 dark:text-rose-200 mt-0.5">{error}</p>
              </div>
              <button
                onClick={handleRunTestFlow}
                className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* Cards de Resumo Executivo das Entidades */}
          {result?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] shadow-sm">
                <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">Empresa B2B</span>
                <p className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] truncate mt-1">{result.summary.empresa}</p>
                <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Cliente Ativo
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] shadow-sm">
                <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">Oportunidade & Valor</span>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-1">{result.summary.valorTotalContrato}</p>
                <span className="inline-block mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {result.summary.statusComercial}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] shadow-sm">
                <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">Projeto Gerado</span>
                <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300 mt-1">{result.summary.projetoGerado}</p>
                <span className="inline-block mt-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                  5 Fases PMBOK
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] shadow-sm">
                <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">Reunião de Kickoff</span>
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mt-1">{result.summary.kickoffAgendado}</p>
                <span className="inline-block mt-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  Google Meet Agendada
                </span>
              </div>
            </div>
          )}

          {/* Stepper / Timeline dos 10 Passos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--crm-border)]">
              <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
                Linha do Tempo de Execução nos 10 Módulos do Sistema
              </h3>
              <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                Total de passos integrados: 10/10
              </span>
            </div>

            <div className="space-y-2.5">
              {(result?.logs || []).map((logItem, idx) => {
                const IconComponent = STEP_ICONS[logItem.step] || CheckCircle2;
                const isCurrentExecuting = loading && currentStepIndex === logItem.step;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrentExecuting
                        ? "bg-cyan-50/40 dark:bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                        : "bg-[rgb(var(--crm-surface-rgb)_/_0.5)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border-[var(--crm-border)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 p-2 rounded-lg ${
                            isCurrentExecuting
                              ? 'bg-cyan-500 text-white animate-spin'
                              : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[rgb(var(--crm-muted-rgb)_/_1)]">
                              Passo {logItem.step}
                            </span>
                            <span className="text-[rgb(var(--crm-muted-rgb)_/_1)]">•</span>
                            <h4 className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                              {logItem.title}
                            </h4>
                            {logItem.badge && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)]">
                                {logItem.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1 leading-relaxed">
                            {logItem.details}
                          </p>

                          {logItem.data && (
                            <div className="mt-2.5 p-2.5 rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] border border-[var(--crm-border)] text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[10px]">MRR Mensal:</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">R$ 3.500,00</span>
                              </div>
                              <div>
                                <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[10px]">Taxa Instalação:</span>
                                <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">R$ 1.500,00</span>
                              </div>
                              <div>
                                <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[10px]">Margem Lucro:</span>
                                <span className="font-semibold text-cyan-700 dark:text-cyan-400">48.5%</span>
                              </div>
                              <div>
                                <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[10px]">Lucro Líquido:</span>
                                <span className="font-semibold text-amber-700 dark:text-amber-400">R$ 1.670,00/mês</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Concluído
                        </span>

                        {/* Botões de atalho direto para o módulo */}
                        {logItem.step === 1 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/empresas');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Empresas <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 2 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/leads');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Leads <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 3 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/oportunidades');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Funil <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 4 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/atividades');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Atividades <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 5 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/pre-vendas');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Pré-Vendas <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 6 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/simuladores');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Simulador <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 7 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/propostas');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Propostas <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 8 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/oportunidades');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Ver Ganho <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 9 && (
                          <button
                            onClick={() => {
                              onClose();
                              if (result?.entities?.project?.id) {
                                navigate(`/projetos/${result.entities.project.id}`);
                              } else {
                                navigate('/projetos');
                              }
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Projeto <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {logItem.step === 10 && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate('/kickoff');
                            }}
                            className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors hover:underline"
                          >
                            Abrir Kickoff <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé de Ações Rápidas */}
        <div className="px-6 py-4 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border-t border-[var(--crm-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
            <Info className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
            <span>Navegue diretamente pelos módulos para inspecionar os dados criados no teste:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                onClose();
                navigate('/empresas');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors"
            >
              🏢 Empresas
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/oportunidades');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors"
            >
              💼 Oportunidades
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/pre-vendas');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors"
            >
              💡 Pré-Vendas
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/propostas');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors"
            >
              📋 Propostas
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/projetos');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors"
            >
              🚀 Projetos
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/kickoff');
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors"
            >
              📅 Kickoff
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
