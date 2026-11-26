import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  DollarSign,
  FileCheck2,
  FileText,
  Gavel,
  ListChecks,
  MessageSquareText,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import type { FichaTecnicaEditalTR } from './types';

interface ConLicitacaoResumoEditalProps {
  ficha: FichaTecnicaEditalTR;
  onChangeConsideracoes?: (texto: string) => void;
  onSaveConsideracoes?: (texto: string) => Promise<void> | void;
  savingConsideracoes?: boolean;
  getAuthHeaders?: () => Record<string, string>;
}

const val = (v: unknown, fallback = 'Não informado') => {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  if (!s || /^(?:null|undefined|não identificado)$/i.test(s)) return fallback;
  return s;
};

const formatCurrency = (v?: number | null) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return 'Não informado';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const daysUntilLabel = (dateStr?: string) => {
  if (!dateStr || /não/i.test(dateStr)) return null;
  const br = String(dateStr).match(/(\d{2})[/.](\d{2})[/.](\d{4})/);
  const iso = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})/);
  let dt: Date | null = null;
  if (br) dt = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  else if (iso) dt = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (!dt || Number.isNaN(dt.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
  if (diff > 0) return `Em ${diff} dia${diff > 1 ? 's' : ''}`;
  if (diff === 0) return 'Hoje';
  return `Há ${Math.abs(diff)} dia${Math.abs(diff) > 1 ? 's' : ''}`;
};

const SectionAccordion: React.FC<{
  id: string;
  title: string;
  icon: React.ReactNode;
  openSections: Record<string, boolean>;
  toggle: (id: string) => void;
  variant?: 'default' | 'danger' | 'warning';
  children: React.ReactNode;
}> = ({ id, title, icon, openSections, toggle, variant = 'default', children }) => {
  const isOpen = openSections[id] !== false;
  const containerCls =
    variant === 'danger'
      ? 'bg-rose-950/25 border-rose-500/40 shadow-sm'
      : variant === 'warning'
        ? 'bg-amber-950/25 border-amber-500/40 shadow-sm'
        : 'bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border-[var(--crm-border)] shadow-sm';

  const headerCls =
    variant === 'danger'
      ? 'bg-rose-500/10 border-b border-rose-500/30 text-rose-200'
      : variant === 'warning'
        ? 'bg-amber-500/10 border-b border-amber-500/30 text-amber-200'
        : 'bg-[rgb(var(--crm-surface-rgb)_/_0.65)] border-b border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]';

  return (
    <div className={`rounded-xl border overflow-hidden ${containerCls}`}>
      <button
        type="button"
        onClick={() => toggle(id)}
        className={`w-full px-5 py-3.5 flex items-center justify-between text-left transition-colors hover:brightness-110 ${headerCls}`}
      >
        <span className="flex items-center gap-2.5 text-sm font-bold tracking-tight">
          {icon}
          <span>{title}</span>
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 opacity-70" />
        ) : (
          <ChevronDown className="w-4 h-4 opacity-70" />
        )}
      </button>
      {isOpen && <div className="p-5">{children}</div>}
    </div>
  );
};

const FieldItem: React.FC<{ label: string; value: React.ReactNode; full?: boolean }> = ({
  label,
  value,
  full,
}) => (
  <div className={full ? 'md:col-span-2' : ''}>
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
      {label}
    </div>
    <div className="text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed whitespace-pre-line">
      {value}
    </div>
  </div>
);

export const ConLicitacaoResumoEdital: React.FC<ConLicitacaoResumoEditalProps> = ({
  ficha,
  onChangeConsideracoes,
  onSaveConsideracoes,
  savingConsideracoes = false,
  getAuthHeaders,
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [qaError, setQaError] = useState<string | null>(null);
  const [localConsideracoes, setLocalConsideracoes] = useState(ficha.consideracoes_licitante || '');

  const toggle = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: prev[id] === false }));

  const cl = useMemo(() => {
    const raw = (ficha.conlicitacao && typeof ficha.conlicitacao === 'object' ? ficha.conlicitacao : {}) as Record<string, any>;
    const req = ficha.requisitos_habilitacao || ({} as any);
    const prazos = ficha.prazos_e_locais || ({} as any);
    const risco = ficha.pontos_de_atencao_risco || ({} as any);

    const legacyHabDocs = [
      ...(req.habilitacao_juridica || []),
      ...(req.certidoes_e_registros_especificos || []),
      ...(req.exigencias_contabeis || []).map((c: any) =>
        typeof c === 'string' ? c : `${c.nome_indice}: ${c.regra}`
      ),
    ];

    const garantiaText = val(risco.garantia_contratual, '');
    const semGarantia = !garantiaText || /n[aã]o\s+(?:exig|haver|identificad)|dispensad/i.test(garantiaText);

    return {
      identificacao: {
        numero_licitacao: val(raw.identificacao?.numero_licitacao || ficha.processo_administrativo || ficha.id_licitacao),
        modalidade: val(raw.identificacao?.modalidade || ficha.modalidade_contratacao),
        uasg: val(raw.identificacao?.uasg),
        portal_realizacao: val(raw.identificacao?.portal_realizacao || ficha.portal_compras),
        contratacao: val(raw.identificacao?.contratacao || ficha.modalidade_contratacao),
        regulamentacao_pregoeiro: val(raw.identificacao?.regulamentacao_pregoeiro),
        objeto: val(raw.identificacao?.objeto || ficha.resumo_executivo),
      },
      sessao_publica: {
        data: val(raw.sessao_publica?.data || ficha.data_abertura),
        horario: val(raw.sessao_publica?.horario, 'Conforme edital'),
        modo_disputa: val(raw.sessao_publica?.modo_disputa || ficha.modo_disputa),
        intervalo_minimo: val(raw.sessao_publica?.intervalo_minimo),
      },
      orgao_responsavel: {
        orgao: val(raw.orgao_responsavel?.orgao || ficha.orgao_comprador),
        cidade_uf: val(raw.orgao_responsavel?.cidade_uf, ''),
        cnpj: val(raw.orgao_responsavel?.cnpj || ficha.orgao_cnpj, ''),
        endereco: val(raw.orgao_responsavel?.endereco || prazos.locais_prestacao_entrega?.[0]),
        email: val(raw.orgao_responsavel?.email),
        telefone: val(raw.orgao_responsavel?.telefone),
      },
      detalhes_licitacao: {
        valor_estimado: val(raw.detalhes_licitacao?.valor_estimado, formatCurrency(ficha.valor_estimado_total)),
        criterio_julgamento: val(raw.detalhes_licitacao?.criterio_julgamento || ficha.criterio_julgamento),
        prazo_entrega: val(raw.detalhes_licitacao?.prazo_entrega || prazos.prazo_inicio_entrega),
        preferencia_me_epp: val(raw.detalhes_licitacao?.preferencia_me_epp),
        restricoes_regionalidade: val(raw.detalhes_licitacao?.restricoes_regionalidade),
        prova_de_conceito: val(raw.detalhes_licitacao?.prova_de_conceito, 'Não mencionado'),
        margem_preferencia: val(raw.detalhes_licitacao?.margem_preferencia),
        visita_tecnica: val(
          raw.detalhes_licitacao?.visita_tecnica ||
            (risco.regras_vistoria?.obrigatoria === true
              ? 'Obrigatória'
              : risco.regras_vistoria?.obrigatoria === false
                ? 'Facultativa'
                : risco.regras_vistoria?.detalhes_e_prazo)
        ),
        amostra: val(raw.detalhes_licitacao?.amostra || risco.exigencia_amostra_poc),
      },
      seguro_garantia: {
        garantia_proposta: raw.seguro_garantia?.garantia_proposta || {
          exige: false,
          titulo: 'Não exige Garantia de Proposta',
          descricao: 'Não há no edital exigência identificada de garantia de proposta (caução provisória).',
        },
        garantia_contrato: raw.seguro_garantia?.garantia_contrato || {
          exige: !semGarantia,
          titulo: semGarantia ? 'Não exige Garantia de Contrato' : 'Exige Garantia de Contrato',
          descricao: garantiaText || 'Garantia contratual de execução não informada no edital.',
        },
        garantia_adicional: raw.seguro_garantia?.garantia_adicional || {
          exige: false,
          titulo: 'Não exige Garantia Adicional',
          descricao: 'Não há previsão de garantia adicional nos termos dos arts. 59 ou 60 da Lei 14.133/2021.',
        },
        garantia_retomada: raw.seguro_garantia?.garantia_retomada || {
          exige: false,
          titulo: 'Não exige Garantia de Retomada',
          descricao: 'Não há cláusula de retomada ou seguro-garantia com assunção pela seguradora identificada.',
        },
      },
      entrega_execucao: {
        data_prazo: val(raw.entrega_execucao?.data_prazo || prazos.prazo_inicio_entrega),
        local_entrega_execucao: val(
          raw.entrega_execucao?.local_entrega_execucao || prazos.locais_prestacao_entrega?.join(' | ')
        ),
      },
      prazos_importantes: {
        tipo_fornecimento: val(raw.prazos_importantes?.tipo_fornecimento || prazos.regime_execucao),
        manifestacao_recurso: val(raw.prazos_importantes?.manifestacao_recurso),
        documentacao_complementar: val(raw.prazos_importantes?.documentacao_complementar),
        recursos_contrarrazoes: val(raw.prazos_importantes?.recursos_contrarrazoes),
        documento_original: val(raw.prazos_importantes?.documento_original),
        esclarecimentos: val(raw.prazos_importantes?.esclarecimentos || ficha.data_fim_esclarecimento),
        prazo_contratual_arp: val(raw.prazos_importantes?.prazo_contratual_arp || prazos.vigencia_contrato),
        limite_impugnacao: val(raw.prazos_importantes?.limite_impugnacao || ficha.data_fim_impugnacao),
        limite_envio_propostas: val(raw.prazos_importantes?.limite_envio_propostas || ficha.data_limite_proposta),
        vigencia_contrato_ata: val(raw.prazos_importantes?.vigencia_contrato_ata || prazos.vigencia_contrato),
      },
      criterios_proposta_julgamento: {
        validade_proposta: val(raw.criterios_proposta_julgamento?.validade_proposta),
        exigencias_proposta_comercial: val(raw.criterios_proposta_julgamento?.exigencias_proposta_comercial),
        criterios_desempate: val(raw.criterios_proposta_julgamento?.criterios_desempate),
        programa_integridade: val(raw.criterios_proposta_julgamento?.programa_integridade, 'Não mencionado'),
      },
      resumo_itens: {
        total_itens_lotes: val(raw.resumo_itens?.total_itens_lotes, String(ficha.matriz_itens?.length || 0)),
        categorias_principais: val(
          raw.resumo_itens?.categorias_principais ||
            (ficha.matriz_itens || [])
              .slice(0, 4)
              .map((i) => i.especificacao_sucinta)
              .join('; ')
        ),
        descricao_geral: val(raw.resumo_itens?.descricao_geral || ficha.resumo_executivo),
        observacoes: val(
          raw.resumo_itens?.observacoes,
          `ID Licitação: ${ficha.id_licitacao}${ficha.portal_compras ? ` | Fonte: ${ficha.portal_compras}` : ''}`
        ),
      },
      documentos_habilitacao:
        Array.isArray(raw.documentos_habilitacao) && raw.documentos_habilitacao.length > 0
          ? raw.documentos_habilitacao
          : legacyHabDocs,
      atestado_capacidade_tecnica: val(
        raw.atestado_capacidade_tecnica || req.atestados_capacidade_tecnica?.join('\n')
      ),
      anexos_declaracoes: Array.isArray(raw.anexos_declaracoes) ? raw.anexos_declaracoes : [],
      outras_informacoes_relevantes:
        Array.isArray(raw.outras_informacoes_relevantes) && raw.outras_informacoes_relevantes.length > 0
          ? raw.outras_informacoes_relevantes
          : risco.pontos_de_atencao_gerais || [],
      condicoes_pagamento: val(raw.condicoes_pagamento),
      penalidades_multas:
        Array.isArray(raw.penalidades_multas) && raw.penalidades_multas.length > 0
          ? raw.penalidades_multas
          : risco.clausulas_punitivas_multas || [],
      analise_critica: {
        conflito_objeto_minuta: val(raw.analise_critica?.conflito_objeto_minuta),
        conflito_prazo_vigencia_arp: val(raw.analise_critica?.conflito_prazo_vigencia_arp),
        conflito_prazos_entrega: val(raw.analise_critica?.conflito_prazos_entrega),
        permite_subcontratacao: val(raw.analise_critica?.permite_subcontratacao),
        previsao_reajuste_repactuacao: val(raw.analise_critica?.previsao_reajuste_repactuacao),
        permite_renovacao_contrato: val(raw.analise_critica?.permite_renovacao_contrato),
        estabelece_condicoes_pagamento: val(raw.analise_critica?.estabelece_condicoes_pagamento),
      },
    };
  }, [ficha]);

  const sessionBadge = daysUntilLabel(cl.sessao_publica.data);

  const handleAskEdital = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setQaError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(getAuthHeaders ? getAuthHeaders() : {}),
      };
      const res = await fetch('/api/analise-tr/pergunte-edital', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: q,
          fichaId: ficha.id || ficha.id_licitacao,
          ficha,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`);
      setQaHistory((prev) => [...prev, { q, a: data.answer || 'Sem resposta.' }]);
      setQuestion('');
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Falha ao consultar IA.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho + Pergunte ao Edital */}
      <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">
              Resumo do Edital {cl.identificacao.numero_licitacao}
            </h2>
            <p className="text-xs font-mono text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">
              Nº Controle / PNCP: {ficha.id_licitacao}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAskOpen(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-400/40 text-cyan-200 hover:brightness-125 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            Pergunte ao Edital
          </button>
        </div>

        {/* Top 3 KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] p-4">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-1">
              <DollarSign className="w-4 h-4" />
              Valor Estimado
            </div>
            <div className="text-lg sm:text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">
              {ficha.pricesWithheld ? 'Sigiloso' : formatCurrency(ficha.valor_estimado_total)}
            </div>
          </div>

          <div className="rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] p-4">
            <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-semibold mb-1">
              <Gavel className="w-4 h-4" />
              Modalidade
            </div>
            <div className="text-base sm:text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] leading-snug">
              {cl.identificacao.contratacao}
            </div>
            {cl.sessao_publica.modo_disputa !== 'Não informado' && (
              <span className="inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {cl.sessao_publica.modo_disputa}
              </span>
            )}
          </div>

          <div className="rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] p-4">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold mb-1">
              <Calendar className="w-4 h-4" />
              Data da Sessão
            </div>
            <div className="text-base sm:text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">
              {cl.sessao_publica.data}
            </div>
            {sessionBadge && (
              <span className="inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {sessionBadge}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 1. Identificação da Licitação */}
      <SectionAccordion
        id="identificacao"
        title="Identificação da Licitação"
        icon={<FileText className="w-4 h-4 text-cyan-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Objeto" value={cl.identificacao.objeto} full />
          <FieldItem label="Número da licitação" value={cl.identificacao.numero_licitacao} />
          <FieldItem label="Modalidade" value={cl.identificacao.modalidade} />
          <FieldItem label="UASG" value={cl.identificacao.uasg} />
          <FieldItem label="Portal de realização" value={cl.identificacao.portal_realizacao} />
          <FieldItem label="Contratação" value={cl.identificacao.contratacao} />
          <FieldItem label="Regulamentação / Pregoeiro" value={cl.identificacao.regulamentacao_pregoeiro} />
        </div>
      </SectionAccordion>

      {/* 2. Informações da Sessão Pública */}
      <SectionAccordion
        id="sessao"
        title="Informações da Sessão Pública"
        icon={<Calendar className="w-4 h-4 text-indigo-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Data" value={cl.sessao_publica.data} />
          <FieldItem label="Modo de Disputa" value={cl.sessao_publica.modo_disputa} />
          <FieldItem label="Horário" value={cl.sessao_publica.horario} />
          <FieldItem label="Intervalo mínimo" value={cl.sessao_publica.intervalo_minimo} />
        </div>
      </SectionAccordion>

      {/* 3. Órgão Responsável */}
      <SectionAccordion
        id="orgao"
        title="Órgão Responsável"
        icon={<Building2 className="w-4 h-4 text-emerald-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem
            label="Órgão"
            value={`${cl.orgao_responsavel.orgao}${cl.orgao_responsavel.cidade_uf ? ` — ${cl.orgao_responsavel.cidade_uf}` : ''}`}
          />
          <FieldItem label="Endereço" value={cl.orgao_responsavel.endereco} />
          <FieldItem label="E-mail" value={cl.orgao_responsavel.email} />
          <FieldItem label="Telefone" value={cl.orgao_responsavel.telefone} />
        </div>
      </SectionAccordion>

      {/* 4. Detalhes da Licitação */}
      <SectionAccordion
        id="detalhes"
        title="Detalhes da Licitação"
        icon={<ClipboardList className="w-4 h-4 text-cyan-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Valor estimado / orçamento" value={cl.detalhes_licitacao.valor_estimado} />
          <FieldItem label="Critério de julgamento" value={cl.detalhes_licitacao.criterio_julgamento} />
          <FieldItem label="Prazo de entrega" value={cl.detalhes_licitacao.prazo_entrega} />
          <FieldItem label="Preferência ME/EPP" value={cl.detalhes_licitacao.preferencia_me_epp} />
          <FieldItem label="Restrições de regionalidade" value={cl.detalhes_licitacao.restricoes_regionalidade} />
          <FieldItem label="Exigência de prova de conceito" value={cl.detalhes_licitacao.prova_de_conceito} />
          <FieldItem label="Margem de preferência" value={cl.detalhes_licitacao.margem_preferencia} />
          <FieldItem label="Exigência de visita técnica" value={cl.detalhes_licitacao.visita_tecnica} />
          <FieldItem label="Exigência de amostra" value={cl.detalhes_licitacao.amostra} />
        </div>
      </SectionAccordion>

      {/* 5. Seguro Garantia (4 sub-cards) */}
      <SectionAccordion
        id="garantia"
        title="Seguro Garantia"
        icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="space-y-3">
          {[
            cl.seguro_garantia.garantia_proposta,
            cl.seguro_garantia.garantia_contrato,
            cl.seguro_garantia.garantia_adicional,
            cl.seguro_garantia.garantia_retomada,
          ].map((g, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3.5 ${
                g?.exige
                  ? 'bg-amber-500/10 border-amber-500/40'
                  : 'bg-[rgb(var(--crm-surface-rgb)_/_0.75)] border-[var(--crm-border)]'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">
                {g?.titulo}
              </div>
              <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] leading-relaxed">
                {g?.descricao}
              </p>
            </div>
          ))}
        </div>
      </SectionAccordion>

      {/* 6. Informações sobre entrega e execução */}
      <SectionAccordion
        id="entrega"
        title="Informações sobre entrega e execução"
        icon={<Clock className="w-4 h-4 text-blue-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Data / Prazo" value={cl.entrega_execucao.data_prazo} />
          <FieldItem label="Local de entrega ou da execução" value={cl.entrega_execucao.local_entrega_execucao} />
        </div>
      </SectionAccordion>

      {/* 7. Prazos importantes */}
      <SectionAccordion
        id="prazos"
        title="Prazos importantes"
        icon={<Calendar className="w-4 h-4 text-amber-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Tipo de fornecimento" value={cl.prazos_importantes.tipo_fornecimento} />
          <FieldItem label="Prazo para manifestação de recurso" value={cl.prazos_importantes.manifestacao_recurso} />
          <FieldItem label="Prazo para envio de documentação complementar" value={cl.prazos_importantes.documentacao_complementar} />
          <FieldItem label="Prazo para recursos e contrarrazões" value={cl.prazos_importantes.recursos_contrarrazoes} />
          <FieldItem label="Prazo para envio de documento original" value={cl.prazos_importantes.documento_original} />
          <FieldItem label="Esclarecimentos" value={cl.prazos_importantes.esclarecimentos} />
          <FieldItem label="Prazo contratual ou ARP" value={cl.prazos_importantes.prazo_contratual_arp} />
          <FieldItem label="Limite para impugnação" value={cl.prazos_importantes.limite_impugnacao} />
          <FieldItem label="Limite para envio de propostas" value={cl.prazos_importantes.limite_envio_propostas} />
          <FieldItem label="Prazo de vigência do contrato ou ata" value={cl.prazos_importantes.vigencia_contrato_ata} />
        </div>
      </SectionAccordion>

      {/* 8. Critérios da Proposta e Julgamento */}
      <SectionAccordion
        id="criterios"
        title="Critérios da Proposta e Julgamento"
        icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Validade da proposta" value={cl.criterios_proposta_julgamento.validade_proposta} />
          <FieldItem label="Exigências da proposta comercial" value={cl.criterios_proposta_julgamento.exigencias_proposta_comercial} />
          <FieldItem label="Critérios de desempate" value={cl.criterios_proposta_julgamento.criterios_desempate} />
          <FieldItem label="Programa de Integridade" value={cl.criterios_proposta_julgamento.programa_integridade} />
        </div>
      </SectionAccordion>

      {/* 9. Resumo dos Itens */}
      <SectionAccordion
        id="resumo_itens"
        title="Resumo dos Itens"
        icon={<ListChecks className="w-4 h-4 text-cyan-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Total de Itens / Lotes" value={cl.resumo_itens.total_itens_lotes} />
          <FieldItem label="Categorias principais" value={cl.resumo_itens.categorias_principais} />
          <FieldItem label="Descrição Geral" value={cl.resumo_itens.descricao_geral} />
          <FieldItem label="Observações" value={cl.resumo_itens.observacoes} />
        </div>
      </SectionAccordion>

      {/* 10. Documentos de habilitação exigidos */}
      <SectionAccordion
        id="habilitacao"
        title="Documentos de habilitação exigidos"
        icon={<FileCheck2 className="w-4 h-4 text-blue-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        {cl.documentos_habilitacao.length > 0 ? (
          <ul className="space-y-1.5 text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] list-disc pl-5">
            {cl.documentos_habilitacao.map((doc: string, idx: number) => (
              <li key={idx}>{doc}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Não informado</p>
        )}
      </SectionAccordion>

      {/* 11. Atestado de capacidade técnica */}
      <SectionAccordion
        id="atestado"
        title="Atestado de capacidade técnica"
        icon={<FileText className="w-4 h-4 text-indigo-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <p className="text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] whitespace-pre-line leading-relaxed">
          {cl.atestado_capacidade_tecnica}
        </p>
      </SectionAccordion>

      {/* 12. Anexos e declarações */}
      <SectionAccordion
        id="anexos"
        title="Anexos e declarações"
        icon={<FileText className="w-4 h-4 text-cyan-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        {cl.anexos_declaracoes.length > 0 ? (
          <ul className="space-y-1.5 text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] list-disc pl-5">
            {cl.anexos_declaracoes.map((anexo: string, idx: number) => (
              <li key={idx}>{anexo}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Não informado</p>
        )}
      </SectionAccordion>

      {/* 13. Outras informações relevantes */}
      <SectionAccordion
        id="outras"
        title="Outras informações relevantes"
        icon={<FileText className="w-4 h-4 text-slate-300" />}
        openSections={openSections}
        toggle={toggle}
      >
        {cl.outras_informacoes_relevantes.length > 0 ? (
          <ul className="space-y-1.5 text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] list-disc pl-5">
            {cl.outras_informacoes_relevantes.map((info: string, idx: number) => (
              <li key={idx}>{info}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Não informado</p>
        )}
      </SectionAccordion>

      {/* 14. Condições de pagamento */}
      <SectionAccordion
        id="pagamento"
        title="Condições de pagamento"
        icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <p className="text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] whitespace-pre-line leading-relaxed">
          {cl.condicoes_pagamento}
        </p>
      </SectionAccordion>

      {/* 15. Penalidades e multas */}
      <SectionAccordion
        id="penalidades"
        title="Penalidades e multas"
        icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
        openSections={openSections}
        toggle={toggle}
        variant="danger"
      >
        {cl.penalidades_multas.length > 0 ? (
          <ul className="space-y-1.5 text-xs sm:text-sm text-rose-100 list-disc pl-5">
            {cl.penalidades_multas.map((pen: string, idx: number) => (
              <li key={idx}>{pen}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-rose-200/80">Regras padrão da Lei 14.133/2021.</p>
        )}
      </SectionAccordion>

      {/* 16. Análise crítica */}
      <SectionAccordion
        id="analise_critica"
        title="Análise crítica"
        icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
        openSections={openSections}
        toggle={toggle}
        variant="warning"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldItem label="Conflito objeto / minuta" value={cl.analise_critica.conflito_objeto_minuta} />
          <FieldItem label="Previsão de reajuste / repactuação" value={cl.analise_critica.previsao_reajuste_repactuacao} />
          <FieldItem label="Conflito prazo de vigência / ARP" value={cl.analise_critica.conflito_prazo_vigencia_arp} />
          <FieldItem label="Permite renovação de contrato" value={cl.analise_critica.permite_renovacao_contrato} />
          <FieldItem label="Conflito prazos de entrega" value={cl.analise_critica.conflito_prazos_entrega} />
          <FieldItem label="Estabelece condições de pagamento" value={cl.analise_critica.estabelece_condicoes_pagamento} />
          <FieldItem label="Permite subcontratação" value={cl.analise_critica.permite_subcontratacao} />
        </div>
      </SectionAccordion>

      {/* 17. Análise e Considerações do Licitante */}
      <SectionAccordion
        id="consideracoes"
        title="Análise e Considerações do Licitante"
        icon={<Star className="w-4 h-4 text-cyan-400" />}
        openSections={openSections}
        toggle={toggle}
      >
        <div className="space-y-3">
          <label className="block text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
            Escreva suas considerações após a análise dessa oportunidade (estas anotações acompanham a conversão para Oportunidade B2G):
          </label>
          <textarea
            rows={4}
            value={localConsideracoes}
            onChange={(e) => {
              setLocalConsideracoes(e.target.value);
              onChangeConsideracoes?.(e.target.value);
            }}
            placeholder="Escreva aqui suas considerações estratégicas, margens, riscos ou decisões..."
            className="w-full rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] px-3.5 py-2.5 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] focus:outline-hidden focus:border-cyan-400"
          />
          {onSaveConsideracoes && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingConsideracoes}
                onClick={() => onSaveConsideracoes(localConsideracoes)}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {savingConsideracoes ? 'Salvando...' : 'Salvar Considerações'}
              </button>
            </div>
          )}
        </div>
      </SectionAccordion>

      {/* Modal: Pergunte ao Edital (IA) */}
      {askOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-cyan-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-[var(--crm-border)] flex items-center justify-between bg-[rgb(var(--crm-surface-rgb)_/_0.8)]">
              <div className="flex items-center gap-2">
                <MessageSquareText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    Pergunte ao Edital — IA
                  </h3>
                  <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    {cl.identificacao.numero_licitacao} • {cl.orgao_responsavel.orgao}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAskOpen(false)}
                className="p-1.5 rounded-lg text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {qaHistory.length === 0 && (
                <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4 rounded-xl border border-[var(--crm-border)]">
                  Faça perguntas específicas sobre cláusulas, prazos, garantia, habilitação técnica, itens ou penalidades deste edital.
                </div>
              )}
              {qaHistory.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3.5 py-2">
                    Você: {item.q}
                  </div>
                  <div className="text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] rounded-lg px-4 py-3 whitespace-pre-line leading-relaxed">
                    {item.a}
                  </div>
                </div>
              ))}
              {qaError && (
                <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3.5 py-2">
                  {qaError}
                </div>
              )}
            </div>

            <form
              onSubmit={handleAskEdital}
              className="p-4 border-t border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.8)] flex gap-2"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex: Qual o prazo de entrega e garantia exigida?"
                className="flex-1 rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] px-3.5 py-2 text-xs sm:text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] focus:outline-hidden focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                {asking ? 'Consultando...' : 'Perguntar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
