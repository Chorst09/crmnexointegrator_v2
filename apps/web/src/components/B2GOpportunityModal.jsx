import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Info, DollarSign, Calendar, Users,
  ShieldAlert, FileCheck, Check, X, Loader2, Pencil,
  FileText, Trash2, Plus, ChevronRight,
  Phone, Mail, MessageCircle, StickyNote, Send, MessageSquare
} from 'lucide-react';
import Modal from './Modal';
import { buildApiUrl, getAuthHeaders } from '../config/api';

// Helpers para ler/gravar dados B2G no campo description (JSON)
export function parseB2GData(description) {
  if (!description) return {};
  if (typeof description === 'object') return description;
  try {
    const parsed = JSON.parse(description);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

const CERTIFICATE_OPTIONS = [
  'SICAF atualizado', 'Certidão Federal', 'Certidão Estadual',
  'Certidão Municipal', 'FGTS', 'CNDT', 'Balanço Patrimonial'
];

const MODALITIES = ['Pregão Eletrônico', 'Concorrência', 'Tomada de Preços', 'Convite', 'Dispensa', 'Inexigibilidade'];
const PHASES = ['Análise', 'Proposta Enviada', 'Habilitação', 'Recurso', 'Suspenso', 'Homologado', 'Ganho', 'Perdido', 'NO GO'];
const SPHERES = ['Federal', 'Estadual', 'Municipal'];
const RISK_LEVELS = ['baixo', 'medio', 'alto'];
const COMPETITION_LEVELS = ['baixo', 'medio', 'alto'];
const CONTRACT_TYPES = ['Contrato', 'Ata de Registro de Preços', 'Ordem de Serviço', 'Dispensa', 'Pontual'];

const isPunctualContract = (contractType) =>
  String(contractType || '').trim().toUpperCase() === 'PONTUAL';

const parseMoneyInput = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoneyInput = (value) => {
  const parsed = parseMoneyInput(value);
  return parsed > 0 ? parsed.toFixed(2) : '';
};

const calculateB2GFinancials = (form) => {
  const monthlyValue = parseMoneyInput(form.estimatedMonthlyValue);
  const oneTimeValue = parseMoneyInput(form.estimatedOneTimeValue);
  const manualTotalValue = parseMoneyInput(form.estimatedValue);
  const contractTermMonths = isPunctualContract(form.contractType)
    ? 1
    : Math.max(parseInt(form.contractTermMonths, 10) || 0, 0);
  const calculatedTotal = monthlyValue > 0
    ? (monthlyValue * contractTermMonths) + oneTimeValue
    : (manualTotalValue || oneTimeValue);

  return {
    monthlyValue,
    oneTimeValue,
    totalValue: Number(calculatedTotal.toFixed(2)),
    contractTermMonths: contractTermMonths || 12
  };
};

const DECISION_COLORS = {
  'GO': 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  'NO GO': 'bg-red-500/20 text-red-300 border-red-400/40',
  'PENDING': 'bg-slate-500/20 text-slate-300 border-slate-400/40'
};

function InfoRow({ label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-200">{value || '-'}</div>
    </div>
  );
}

function parseStageDecisionDetails(details) {
  if (!details) return null;
  if (typeof details === 'object') return details;
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
        active
          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ============================================================
// MODAL DE DETALHES DA OPORTUNIDADE B2G
// ============================================================
export function B2GOpportunityDetailModal({ isOpen, onClose, opportunity, onEdit, onDecision, isAdmin }) {
  const [savingDecision, setSavingDecision] = useState(null);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpType, setFollowUpType] = useState('NOTE');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  const b2g = parseB2GData(opportunity?.description);

  // Labels
  const decisionLabel = { GO: 'GO', 'NO GO': 'NO GO', PENDING: 'Pendente' };
  const riskLabel = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
  const competitionLabel = { baixo: 'Baixa', medio: 'Média', alto: 'Alta' };
  const sphereLabel = { Federal: 'Federal', Estadual: 'Estadual', Municipal: 'Municipal' };

  useEffect(() => {
    if (!isOpen || !opportunity?.id) return;
    setLoadingFollowUps(true);
    fetch(buildApiUrl(`/opportunity-followups/${opportunity.id}`), { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFollowUps(Array.isArray(data) ? data : []))
      .catch(() => setFollowUps([]))
      .finally(() => setLoadingFollowUps(false));
  }, [isOpen, opportunity?.id]);

  const handleDecision = async (decision) => {
    if (!opportunity?.id) return;
    setSavingDecision(decision);
    try {
      const response = await fetch(
        buildApiUrl(`/opportunities/${opportunity.id}?clientType=B2G`),
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: opportunity.id,
            description: JSON.stringify({
              ...b2g,
              decision,
              decisionRecordedAt: new Date().toISOString()
            }),
            clientType: 'B2G'
          })
        }
      );
      if (response.ok) {
        const updated = await response.json();
        if (onDecision) onDecision(updated);
      }
    } catch (e) {
      console.error('Erro ao salvar decisão:', e);
    } finally {
      setSavingDecision(null);
    }
  };

  const handleAddFollowUp = async () => {
    const content = followUpText.trim();
    if (!opportunity?.id || !content) return;
    setSavingFollowUp(true);
    try {
      const res = await fetch(buildApiUrl('/opportunity-followups'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ opportunityId: opportunity.id, type: followUpType, content })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || errorData?.message || 'Erro ao salvar acompanhamento');
      }
      const created = await res.json();
      setFollowUps(prev => [created, ...prev]);
      setFollowUpText('');
      setFollowUpType('NOTE');
    } catch (e) { 
      console.error('Erro ao salvar acompanhamento B2G:', e);
      alert(e.message || 'Erro ao salvar acompanhamento');
    }
    finally { setSavingFollowUp(false); }
  };

  const handleDeleteFollowUp = async (id) => {
    if (!window.confirm('Deseja remover este acompanhamento?')) return;
    try {
      const res = await fetch(buildApiUrl(`/opportunity-followups/${id}`), {
        method: 'DELETE', 
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || errorData?.message || 'Erro ao remover acompanhamento');
      }
      setFollowUps(prev => prev.filter(f => f.id !== id));
    } catch (e) { 
      console.error('Erro ao remover acompanhamento B2G:', e);
      alert(e.message || 'Erro ao remover acompanhamento');
    }
  };

  if (!opportunity) return null;

  const currentDecision = b2g.decision || 'PENDING';
  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const formatDate = (v) => { if (!v) return '-'; try { return new Date(v).toLocaleDateString('pt-BR'); } catch { return v; } };
  const stageDecisionDetails = parseStageDecisionDetails(opportunity.stageDecisionDetails);
  const stageDecisionRows = stageDecisionDetails ? [
    {
      label: 'Resultado',
      value: stageDecisionDetails.decision === 'WON'
        ? 'Ganho'
        : stageDecisionDetails.decision === 'NO_GO'
          ? 'NO GO'
          : stageDecisionDetails.decision === 'LOST'
            ? 'Perdido'
            : stageDecisionDetails.decision
    },
    {
      label: stageDecisionDetails.decision === 'WON' ? 'Concorrente superado' : 'Concorrente',
      value: stageDecisionDetails.competitorName || stageDecisionDetails.wonFromCompetitor || stageDecisionDetails.lostToCompetitor
    },
    { label: 'Motivo', value: stageDecisionDetails.reason || stageDecisionDetails.winReason || stageDecisionDetails.lossReason || stageDecisionDetails.noGoReason },
    {
      label: 'Nosso preço',
      value: stageDecisionDetails.ourPrice !== null && stageDecisionDetails.ourPrice !== undefined
        ? formatCurrency(stageDecisionDetails.ourPrice)
        : ''
    },
    {
      label: 'Preço concorrente',
      value: stageDecisionDetails.competitorPrice !== null && stageDecisionDetails.competitorPrice !== undefined
        ? formatCurrency(stageDecisionDetails.competitorPrice)
        : ''
    },
    {
      label: 'Diferença',
      value: stageDecisionDetails.priceDifference !== null && stageDecisionDetails.priceDifference !== undefined
        ? formatCurrency(stageDecisionDetails.priceDifference)
        : ''
    },
    { label: 'Desclassificação', value: stageDecisionDetails.disqualificationReason },
    { label: 'Recurso', value: stageDecisionDetails.appealNotes }
  ].filter((row) => row.value) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="full"
      fullBleed
      showCloseButton={false}
      closeOnOverlayClick={false}
      backgroundColor="dark"
      contentClassName="p-0"
      panelClassName="bg-slate-950"
    >
      <div className="min-h-full bg-[linear-gradient(135deg,#020617,#0f172a_45%,#111827)] text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">

          {/* Header */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <button type="button" onClick={onClose} className="mt-1 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-white">{b2g.processNumber || opportunity.number || opportunity.title}</h1>
                  {b2g.modality && (
                    <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                      {b2g.modality}
                    </span>
                  )}
                  {b2g.currentPhase && (
                    <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                      {b2g.currentPhase}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${DECISION_COLORS[currentDecision]}`}>
                    {decisionLabel[currentDecision] || currentDecision}
                  </span>
                </div>
                <p className="text-base text-slate-400">{b2g.agency || opportunity.company?.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onEdit && onEdit(opportunity)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-all">
                <Pencil className="h-4 w-4" /> Editar Oportunidade
              </button>
            </div>
          </div>

          {/* Conteúdo em 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna principal (2/3) */}
            <div className="lg:col-span-2 space-y-6">

              {/* Informações do Objeto */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-4">
                <h2 className="text-lg font-bold text-white">Informações do Objeto</h2>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Objeto Resumido</div>
                  <p className="text-base font-semibold text-white">{b2g.objectSummary || '-'}</p>
                </div>
                {b2g.objectDetailed && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Descrição Detalhada</div>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{b2g.objectDetailed}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
                  <InfoRow label="Nome no Projeto" value={opportunity.projectName || b2g.projectName} />
                  <InfoRow label="Tipo de Cliente" value={
                    { NEW_CLIENT: 'Cliente Novo', BASE_CLIENT: 'Cliente da Base', RENEWAL: 'Renovação', NOVO_CLIENTE: 'Cliente Novo', CLIENTE_BASE: 'Cliente da Base', RENOVACAO: 'Renovação' }[opportunity.projectClientType] || '-'
                  } />
                  <InfoRow label="Segmento" value={sphereLabel[b2g.sphere] || b2g.sphere} />
                  <InfoRow label="Local" value={b2g.location} />
                  <InfoRow label="Origem" value={b2g.sourcePortal} />
                  <InfoRow label="Tipo" value={b2g.type} />
                  <InfoRow label="Portal Registro de OP" value={b2g.opportunityRegistrationPortal} />
                  <InfoRow label="Fabricante - Status" value={b2g.manufacturerRegistrationStatus} />
                </div>
              </div>

              {/* Acompanhamentos — idêntico ao B2B */}
              <div className="rounded-2xl border border-[color:var(--crm-border,#334155)] bg-[rgb(var(--crm-surface-rgb,15_23_42)_/_0.65)] p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Acompanhamentos</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Registre interações, próximos passos e decisões desta oportunidade.
                    </p>
                  </div>
                  <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-400">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Seletor de tipo */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'NOTE',     label: 'Nota',     icon: StickyNote    },
                      { value: 'CALL',     label: 'Ligação',  icon: Phone         },
                      { value: 'EMAIL',    label: 'Email',    icon: Mail          },
                      { value: 'MEETING',  label: 'Reunião',  icon: Users         },
                      { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle }
                    ].map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setFollowUpType(t.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          followUpType === t.value
                            ? 'bg-cyan-500 text-white'
                            : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <t.icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={followUpText}
                    onChange={e => setFollowUpText(e.target.value)}
                    placeholder="Ex: contato realizado com o órgão, retorno previsto, pendência documental, decisão do comitê..."
                    rows={4}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none min-h-[110px]"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddFollowUp}
                      disabled={savingFollowUp || !followUpText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/45 bg-[linear-gradient(135deg,#2563eb,#0891b2)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                    >
                      <Send className="h-4 w-4" />
                      {savingFollowUp ? 'Salvando...' : 'Salvar acompanhamento'}
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="mt-5 border-t border-slate-700/50 pt-5">
                  {loadingFollowUps ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">Carregando...</div>
                  ) : followUps.length > 0 ? (
                    <div className="space-y-3">
                      {followUps.map(fu => {
                        const TYPE_ICONS = { NOTE: StickyNote, CALL: Phone, EMAIL: Mail, MEETING: Users, WHATSAPP: MessageCircle };
                        const TYPE_LABELS = { NOTE: 'Nota', CALL: 'Ligação', EMAIL: 'Email', MEETING: 'Reunião', WHATSAPP: 'WhatsApp' };
                        const Icon = TYPE_ICONS[fu.type] || StickyNote;
                        return (
                          <div key={fu.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3 relative group">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                                  <Icon className="h-4 w-4" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-cyan-400">{TYPE_LABELS[fu.type] || fu.type}</span>
                                  <span className="text-xs text-slate-500">•</span>
                                  <span className="text-xs text-slate-500">{fu.user?.name}</span>
                                  <span className="text-xs text-slate-500">•</span>
                                  <span className="text-xs text-slate-500">
                                    {new Date(fu.createdAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{fu.content || fu.description}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteFollowUp(fu.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-red-400 hover:text-red-300"
                                title="Remover"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
                      Nenhum acompanhamento registrado nesta oportunidade.
                    </div>
                  )}
                </div>
              </div>

              {/* Dados Financeiros */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-4">
                <h2 className="text-lg font-bold text-white">Dados Financeiros e Contratuais</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                  {[
                    { label: 'Valor Mensal Estimado', value: formatCurrency(b2g.estimatedMonthlyValue) },
                    { label: 'Valor Total Estimado', value: formatCurrency(b2g.estimatedValue || opportunity.value) },
                    { label: 'Valor Pontual', value: formatCurrency(b2g.estimatedOneTimeValue) },
                    { label: 'Margem Estimada', value: b2g.estimatedMargin ? `${b2g.estimatedMargin}%` : '-' },
                    { label: 'Ticket Esperado', value: formatCurrency(b2g.expectedTicket) },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="text-lg font-bold text-cyan-300">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
                  <InfoRow label="Tipo Contrato" value={b2g.contractType} />
                  <InfoRow label="Prazo" value={b2g.contractTermMonths ? `${b2g.contractTermMonths} meses` : '-'} />
                  <InfoRow label="% Garantia" value={b2g.guaranteePercentage ? `${b2g.guaranteePercentage}%` : '-'} />
                  <InfoRow label="Reajuste" value={b2g.readjustmentClause ? 'Sim' : 'Não'} />
                </div>
              </div>

              {/* Prazos */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-3">
                <h2 className="text-lg font-bold text-white">Prazos Importantes</h2>
                {[
                  { label: 'Publicação', value: formatDate(b2g.publicationDate) },
                  { label: 'Abertura', value: formatDate(b2g.openingDate) },
                  { label: 'Impugnação', value: formatDate(b2g.challengeDeadline) },
                  { label: 'Entrega de Proposta', value: formatDate(b2g.proposalDeadline) },
                  { label: 'Vigência Estimada', value: formatDate(b2g.estimatedValidity) },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-dashed border-slate-700/50 last:border-0">
                    <span className="text-sm text-slate-400">{item.label}</span>
                    <span className="text-sm font-bold text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna lateral (1/3) */}
            <div className="space-y-6">

              {/* Tomada de Decisão */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Tomada de Decisão</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Fluxo Go / No Go para a oportunidade.</p>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Status da Decisão</div>
                  <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${DECISION_COLORS[currentDecision]}`}>
                    <span className="text-sm font-bold">{decisionLabel[currentDecision] || currentDecision}</span>
                    {currentDecision === 'GO' && <Check className="h-5 w-5 text-emerald-400" />}
                    {currentDecision === 'NO GO' && <X className="h-5 w-5 text-red-400" />}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDecision('GO')}
                    disabled={!!savingDecision}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-60 transition-all"
                  >
                    {savingDecision === 'GO' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Decidir GO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision('NO GO')}
                    disabled={!!savingDecision}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60 transition-all"
                  >
                    {savingDecision === 'NO GO' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Decidir NO GO
                  </button>
                </div>
                {b2g.decisionJustification && (
                  <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Justificativa</div>
                    <p className="text-xs text-slate-300 leading-relaxed italic">"{b2g.decisionJustification}"</p>
                  </div>
                )}
              </div>

              {stageDecisionDetails && (
                <div className="rounded-2xl border border-cyan-400/35 bg-cyan-500/10 p-5 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Resultado Registrado</h2>
                    <p className="text-xs text-cyan-100/70 mt-0.5">Dados informados no fechamento da fase.</p>
                  </div>
                  <div className="space-y-3">
                    {stageDecisionRows.map((row) => (
                      <InfoRow key={row.label} label={row.label} value={row.value} />
                    ))}
                  </div>
                  {stageDecisionDetails.notes && (
                    <div className="rounded-xl border border-cyan-300/20 bg-slate-950/35 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-100/60 mb-1">Acompanhamento</div>
                      <p className="text-sm text-cyan-50/85 whitespace-pre-wrap">{stageDecisionDetails.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Estratégia */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-4">
                <h2 className="text-base font-bold text-white">Estratégia Comercial</h2>
                <div className="space-y-3">
                  <InfoRow label="Lead Comercial" value={b2g.commercialLead} />
                  <InfoRow label="Lead Técnico" value={b2g.technicalLead} />
                  <InfoRow label="Parceiro" value={b2g.partner} />
                  <InfoRow label="Fabricante" value={b2g.manufacturer} />
                  <InfoRow label="Nível de Concorrência" value={competitionLabel[b2g.competitionLevel]} />
                  <InfoRow label="Probabilidade de Ganho" value={b2g.winProbability ? `${b2g.winProbability}%` : '-'} />
                </div>
                {b2g.mainCompetitors && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Concorrentes</div>
                    <p className="text-sm text-slate-400">{b2g.mainCompetitors}</p>
                  </div>
                )}
              </div>

              {/* Risco */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-3">
                <h2 className="text-base font-bold text-white">Risco e Jurídico</h2>
                <InfoRow label="Grau de Risco" value={{ baixo: 'Baixo', medio: 'Médio', alto: 'Alto' }[b2g.riskLevel] || b2g.riskLevel} />
                <InfoRow label="Tipo de Julgamento" value={b2g.judgmentType} />
                <InfoRow label="Exigências Restritivas" value={b2g.restrictiveRequirements ? 'Sim' : 'Não'} />
                {b2g.legalNotes && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Observações Jurídicas</div>
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{b2g.legalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL DE EDIÇÃO DE OPORTUNIDADE B2G (6 ABAS)
// ============================================================
const EMPTY_FORM = {
  processNumber:'', uasgId:'', agency:'', projectName:'',
  customerRelationship:'NEW_CLIENT', sphere:'Municipal', location:'',
  sourcePortal:'', opportunityRegistrationPortal:'', manufacturerRegistrationStatus:'',
  modality:'', type:'Eletrônico', objectSummary:'', objectDetailed:'',
  estimatedMonthlyValue:'', estimatedOneTimeValue:'', estimatedValue:'',
  maxAcceptableValue:'', estimatedMargin:'', expectedTicket:'',
  contractType:'Contrato', contractTermMonths:'12', readjustmentClause:false,
  guaranteePercentage:'', publicationDate:'', openingDate:'',
  challengeDeadline:'', proposalDeadline:'', estimatedValidity:'',
  currentPhase:'Análise', commercialLead:'', technicalLead:'',
  partner:'', manufacturer:'', competitionLevel:'medio',
  mainCompetitors:'', strategyDescription:'', winProbability:'50',
  decision:'PENDING', decisionJustification:'',
  briefingLink:'', documentChecklistComplete:false,
  certificatesRequired:[], samplesRequired:false, technicalVisitMandatory:false,
  judgmentType:'Menor Preço', restrictiveRequirements:false, riskLevel:'baixo',
  penalties:'', legalNotes:''
};

export function B2GOpportunityEditModal({ isOpen, onClose, opportunity, leads, onSaved, mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('identificacao');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Carregar dados ao abrir
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('identificacao');
    setError('');
    if (mode === 'create') {
      const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
      setForm({ ...EMPTY_FORM, commercialLead: user.name || '' });
    } else if (opportunity) {
      const b2g = parseB2GData(opportunity.description);
      setForm({
        ...EMPTY_FORM,
        processNumber: b2g.processNumber || opportunity.number || '',
        uasgId: b2g.uasgId || '',
        agency: b2g.agency || opportunity.company?.name || '',
        projectName: b2g.projectName || opportunity.projectName || '',
        customerRelationship: opportunity.projectClientType || b2g.customerRelationship || 'NEW_CLIENT',
        sphere: b2g.sphere || 'Municipal',
        location: b2g.location || '',
        sourcePortal: b2g.sourcePortal || '',
        opportunityRegistrationPortal: b2g.opportunityRegistrationPortal || '',
        manufacturerRegistrationStatus: b2g.manufacturerRegistrationStatus || '',
        modality: b2g.modality || '',
        type: b2g.type || 'Eletrônico',
        objectSummary: b2g.objectSummary || opportunity.title || '',
        objectDetailed: b2g.objectDetailed || b2g.objetoResumido || '',
        estimatedMonthlyValue: b2g.estimatedMonthlyValue || '',
        estimatedOneTimeValue: b2g.estimatedOneTimeValue || '',
        estimatedValue: b2g.estimatedValue || opportunity.value || '',
        maxAcceptableValue: b2g.maxAcceptableValue || '',
        estimatedMargin: b2g.estimatedMargin || '',
        expectedTicket: b2g.expectedTicket || '',
        contractType: b2g.contractType || 'Contrato',
        contractTermMonths: b2g.contractTermMonths || '12',
        readjustmentClause: b2g.readjustmentClause || false,
        guaranteePercentage: b2g.guaranteePercentage || '',
        publicationDate: b2g.publicationDate || '',
        openingDate: b2g.openingDate || '',
        challengeDeadline: b2g.challengeDeadline || '',
        proposalDeadline: b2g.proposalDeadline || '',
        estimatedValidity: b2g.estimatedValidity || '',
        currentPhase: b2g.currentPhase || b2g.faseAtual || 'Análise',
        commercialLead: b2g.commercialLead || '',
        technicalLead: b2g.technicalLead || '',
        partner: b2g.partner || '',
        manufacturer: b2g.manufacturer || '',
        competitionLevel: b2g.competitionLevel || 'medio',
        mainCompetitors: b2g.mainCompetitors || '',
        strategyDescription: b2g.strategyDescription || '',
        winProbability: b2g.winProbability ?? b2g.probabilidadeGanho ?? '50',
        decision: b2g.decision || 'PENDING',
        decisionJustification: b2g.decisionJustification || '',
        briefingLink: b2g.briefingLink || b2g.linkBriefing || '',
        documentChecklistComplete: b2g.documentChecklistComplete || false,
        certificatesRequired: b2g.certificatesRequired || [],
        samplesRequired: b2g.samplesRequired || false,
        technicalVisitMandatory: b2g.technicalVisitMandatory || false,
        judgmentType: b2g.judgmentType || 'Menor Preço',
        restrictiveRequirements: b2g.restrictiveRequirements || false,
        riskLevel: b2g.riskLevel || b2g.grauRisco || 'baixo',
        penalties: b2g.penalties || '',
        legalNotes: b2g.legalNotes || ''
      });
    }
  }, [isOpen, opportunity, mode]);

  const set = (key, value) => setForm(p => ({ ...p, [key]: value }));
  const setContractType = (value) => {
    setForm((prev) => {
      const next = {
        ...prev,
        contractType: value,
        contractTermMonths: isPunctualContract(value) ? '1' : prev.contractTermMonths
      };
      const { monthlyValue, totalValue } = calculateB2GFinancials(next);
      if (monthlyValue > 0) {
        next.estimatedValue = formatMoneyInput(totalValue);
      }
      return next;
    });
  };

  const setFinancial = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (isPunctualContract(next.contractType)) {
        next.contractTermMonths = '1';
      }
      const { monthlyValue, totalValue } = calculateB2GFinancials(next);
      if (monthlyValue > 0) {
        next.estimatedValue = formatMoneyInput(totalValue);
      }
      return next;
    });
  };

  useEffect(() => {
    const { monthlyValue, totalValue } = calculateB2GFinancials(form);
    if (isPunctualContract(form.contractType) && String(form.contractTermMonths || '') !== '1') {
      setForm((prev) => ({ ...prev, contractTermMonths: '1', estimatedValue: formatMoneyInput(totalValue) }));
      return;
    }
    if (monthlyValue <= 0) return;
    const nextTotal = formatMoneyInput(totalValue);
    if (nextTotal && nextTotal !== String(form.estimatedValue || '')) {
      setForm((prev) => ({ ...prev, estimatedValue: nextTotal }));
    }
  }, [form.contractType, form.estimatedMonthlyValue, form.estimatedOneTimeValue, form.contractTermMonths]);

  const handleSave = async () => {
    if (!form.objectSummary.trim()) { setError('Informe o Objeto Resumido.'); return; }
    if (mode === 'create' && !form.agency.trim()) { setError('Selecione a Empresa/Órgão.'); return; }
    setSaving(true); setError('');
    const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const companyId = mode === 'create'
      ? (leads?.find(l => l.name === form.agency)?.id || leads?.[0]?.id || '')
      : (opportunity?.companyId || opportunity?.company?.id || '');

    const financials = calculateB2GFinancials(form);
    const hasMonthlyContract = financials.monthlyValue > 0;
    const b2gData = {
      ...parseB2GData(opportunity?.description),
      processNumber: form.processNumber, uasgId: form.uasgId,
      agency: form.agency, projectName: form.projectName,
      customerRelationship: form.customerRelationship, sphere: form.sphere,
      location: form.location, sourcePortal: form.sourcePortal,
      opportunityRegistrationPortal: form.opportunityRegistrationPortal,
      manufacturerRegistrationStatus: form.manufacturerRegistrationStatus,
      modality: form.modality, type: form.type,
      objectSummary: form.objectSummary, objectDetailed: form.objectDetailed,
      estimatedMonthlyValue: financials.monthlyValue,
      estimatedOneTimeValue: financials.oneTimeValue,
      estimatedValue: financials.totalValue,
      maxAcceptableValue: parseMoneyInput(form.maxAcceptableValue),
      estimatedMargin: parseMoneyInput(form.estimatedMargin),
      expectedTicket: parseMoneyInput(form.expectedTicket),
      contractType: form.contractType, contractTermMonths: financials.contractTermMonths,
      readjustmentClause: form.readjustmentClause, guaranteePercentage: parseMoneyInput(form.guaranteePercentage),
      publicationDate: form.publicationDate, openingDate: form.openingDate,
      challengeDeadline: form.challengeDeadline, proposalDeadline: form.proposalDeadline,
      estimatedValidity: form.estimatedValidity, currentPhase: form.currentPhase,
      commercialLead: form.commercialLead, technicalLead: form.technicalLead,
      partner: form.partner, manufacturer: form.manufacturer,
      competitionLevel: form.competitionLevel, mainCompetitors: form.mainCompetitors,
      strategyDescription: form.strategyDescription,
      winProbability: parseMoneyInput(form.winProbability),
      decision: form.decision, decisionJustification: form.decisionJustification,
      briefingLink: form.briefingLink, documentChecklistComplete: form.documentChecklistComplete,
      certificatesRequired: form.certificatesRequired, samplesRequired: form.samplesRequired,
      technicalVisitMandatory: form.technicalVisitMandatory, judgmentType: form.judgmentType,
      restrictiveRequirements: form.restrictiveRequirements, riskLevel: form.riskLevel,
      penalties: form.penalties, legalNotes: form.legalNotes
    };

    try {
      let response;
      const isCreateMode = mode === 'create';
      const preservedPipelineStage = opportunity?.stage || 'QUALIFICATION';
      const preservedKanbanStage = opportunity?.b2gStage || undefined;
      const initialKanbanStage = form.currentPhase ? String(form.currentPhase).toUpperCase().replace(/ /g,'_') : undefined;
      const payload = {
        title: form.objectSummary || form.processNumber || 'Oportunidade B2G',
        projectName: form.projectName || form.objectSummary,
        projectClientType: form.customerRelationship,
        description: JSON.stringify(b2gData),
        value: financials.totalValue,
        projectType: hasMonthlyContract ? 'MONTHLY' : 'SINGLE',
        projectMonths: hasMonthlyContract ? financials.contractTermMonths : null,
        probability: parseMoneyInput(form.winProbability) || 50,
        stage: isCreateMode ? 'QUALIFICATION' : preservedPipelineStage,
        source: 'MANUAL',
        companyId, ownerId: user?.id || '', clientType: 'B2G',
        b2gStage: isCreateMode ? initialKanbanStage : preservedKanbanStage
      };
      console.log('[B2GOpportunityEditModal] Salvando oportunidade:', { mode, id: opportunity?.id, clientType: 'B2G' });
      if (isCreateMode) {
        response = await fetch(buildApiUrl('/opportunities?clientType=B2G'), {
          method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload)
        });
      } else {
        payload.id = opportunity.id;
        response = await fetch(buildApiUrl(`/opportunities/${opportunity.id}?clientType=B2G`), {
          method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload)
        });
      }
      const data = await response.json().catch(() => ({}));
      console.log('[B2GOpportunityEditModal] Resposta:', { ok: response.ok, data });
      if (!response.ok) throw new Error(data?.error || data?.message || 'Erro ao salvar.');
      if (onSaved) onSaved(data, mode);
      if (location.pathname.replace(/\/+$/, '') === '/oportunidades' && (data?.id || opportunity?.id)) {
        navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(data?.id || opportunity.id)}&mode=edit`, { replace: true });
      }
      console.log('[B2GOpportunityEditModal] Chamando onClose()');
      onClose();
    } catch (err) {
      console.error('[B2GOpportunityEditModal] Erro:', err);
      setError(err.message || 'Erro ao salvar oportunidade.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50";
  const selectCls = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50";
  const labelCls = "block text-xs font-semibold text-slate-400 mb-1";
  const sectionCls = "rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 space-y-4";

  const tabs = [
    { id:'identificacao', label:'Identificação', icon: Info },
    { id:'financeiro',    label:'Financeiro',    icon: DollarSign },
    { id:'prazos',        label:'Prazos',        icon: Calendar },
    { id:'estrategia',   label:'Estratégia',    icon: Users },
    { id:'documentos',   label:'Documentos',    icon: FileCheck },
    { id:'risco',        label:'Risco',         icon: ShieldAlert },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="full"
      fullBleed
      showCloseButton={false}
      closeOnOverlayClick={false}
      backgroundColor="dark"
      contentClassName="p-0"
      panelClassName="bg-slate-950"
    >
      <div className="min-h-full bg-[linear-gradient(135deg,#020617,#0f172a_45%,#111827)] text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6 pb-20">

          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-white">{mode === 'create' ? 'Nova Oportunidade B2G' : 'Editar Oportunidade'}</h2>
                <p className="text-sm text-slate-400">{mode === 'create' ? 'Cadastre os detalhes da oportunidade.' : 'Atualize os detalhes da oportunidade.'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-400/60 bg-blue-500/80 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          {/* Abas */}
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-2">
            {tabs.map(t => <TabBtn key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} icon={t.icon} label={t.label} />)}
          </div>

          {/* ABA: IDENTIFICAÇÃO */}
          {activeTab === 'identificacao' && (
            <div className={sectionCls}>
              <div>
                <h3 className="text-lg font-bold text-white">Identificação da Oportunidade</h3>
                <p className="text-xs text-slate-400">Informações básicas do órgão e modalidade.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Número do Edital / Processo</label>
                  <input className={inputCls} placeholder="Ex: PE 123/2024" value={form.processNumber} onChange={e => set('processNumber', e.target.value)} /></div>
                <div><label className={labelCls}>UASG / ID</label>
                  <input className={inputCls} placeholder="Ex: 123456" value={form.uasgId} onChange={e => set('uasgId', e.target.value)} /></div>
                <div><label className={labelCls}>Órgão / Entidade</label>
                  {mode === 'create' ? (
                    <select className={selectCls} value={form.agency} onChange={e => set('agency', e.target.value)}>
                      <option value="">Selecione o órgão...</option>
                      {(leads || []).map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  ) : (
                    <input className={inputCls} value={form.agency} onChange={e => set('agency', e.target.value)} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Nome no Projeto</label>
                  <input className={inputCls} placeholder="Ex: Modernização da Infraestrutura de Rede" value={form.projectName} onChange={e => set('projectName', e.target.value)} /></div>
                <div><label className={labelCls}>Tipo de Cliente</label>
                  <select className={selectCls} value={form.customerRelationship} onChange={e => set('customerRelationship', e.target.value)}>
                    <option value="NEW_CLIENT">Cliente Novo</option>
                    <option value="BASE_CLIENT">Cliente da Base</option>
                    <option value="RENEWAL">Renovação</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div><label className={labelCls}>Esfera</label>
                  <select className={selectCls} value={form.sphere} onChange={e => set('sphere', e.target.value)}>
                    {SPHERES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2"><label className={labelCls}>UF / Cidade</label>
                  <input className={inputCls} placeholder="PR - Curitiba" value={form.location} onChange={e => set('location', e.target.value)} /></div>
                <div><label className={labelCls}>Modalidade</label>
                  <select className={selectCls} value={form.modality} onChange={e => set('modality', e.target.value)}>
                    <option value="">Selecione...</option>
                    {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Tipo</label>
                  <select className={selectCls} value={form.type} onChange={e => set('type', e.target.value)}>
                    <option value="Eletrônico">Eletrônico</option>
                    <option value="Presencial">Presencial</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Portal</label>
                  <input className={inputCls} placeholder="Ex: Compras.gov" value={form.sourcePortal} onChange={e => set('sourcePortal', e.target.value)} /></div>
                <div><label className={labelCls}>Portal Registro de OP</label>
                  <input className={inputCls} placeholder="Ex: Partner Portal" value={form.opportunityRegistrationPortal} onChange={e => set('opportunityRegistrationPortal', e.target.value)} /></div>
                <div><label className={labelCls}>Fabricante - Status</label>
                  <select className={selectCls} value={form.manufacturerRegistrationStatus} onChange={e => set('manufacturerRegistrationStatus', e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Negado">Negado</option>
                  </select>
                </div>
              </div>
              <div><label className={labelCls}>Objeto Resumido</label>
                <input className={inputCls} placeholder="Ex: Firewall e Access Point" value={form.objectSummary} onChange={e => set('objectSummary', e.target.value)} /></div>
              <div><label className={labelCls}>Descrição Detalhada</label>
                <textarea className={inputCls + ' min-h-[100px] resize-none'} rows={4} placeholder="Descreva os itens e especificações do edital..." value={form.objectDetailed} onChange={e => set('objectDetailed', e.target.value)} /></div>
            </div>
          )}

          {/* ABA: FINANCEIRO */}
          {activeTab === 'financeiro' && (
            <div className={sectionCls}>
              <div><h3 className="text-lg font-bold text-white">Dados Financeiros</h3>
                <p className="text-xs text-slate-400">Valores estimados e condições contratuais.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2"><label className={labelCls}>Tipo de Contrato</label>
                  <select className={selectCls} value={form.contractType} onChange={e => setContractType(e.target.value)}>
                    {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Prazo Contratual (meses)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={inputCls}
                    placeholder="12"
                    value={isPunctualContract(form.contractType) ? '1' : form.contractTermMonths}
                    onChange={e => setFinancial('contractTermMonths', e.target.value)}
                    disabled={isPunctualContract(form.contractType)}
                  /></div>
                <div><label className={labelCls}>Garantia (%)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="0" value={form.guaranteePercentage} onChange={e => set('guaranteePercentage', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Temperatura do negócio (%)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="50" value={form.winProbability} onChange={e => set('winProbability', e.target.value)} /></div>
                <div><label className={labelCls}>Valor Estimado Mensal (R$)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="0,00" value={form.estimatedMonthlyValue} onChange={e => setFinancial('estimatedMonthlyValue', e.target.value)} /></div>
                <div><label className={labelCls}>Valor Estimado Pontual (R$)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="0,00" value={form.estimatedOneTimeValue} onChange={e => setFinancial('estimatedOneTimeValue', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Valor Total Estimado (R$)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="0,00" value={form.estimatedValue} onChange={e => setFinancial('estimatedValue', e.target.value)} /></div>
                <div><label className={labelCls}>Valor Máximo Aceitável (R$)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="0,00" value={form.maxAcceptableValue} onChange={e => set('maxAcceptableValue', e.target.value)} /></div>
                <div><label className={labelCls}>Margem Estimada (%)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="0" value={form.estimatedMargin} onChange={e => set('estimatedMargin', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Ticket Esperado (R$)</label>
                  <input type="text" inputMode="decimal" className={inputCls} placeholder="0,00" value={form.expectedTicket} onChange={e => set('expectedTicket', e.target.value)} /></div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox" id="readjustmentClause" checked={form.readjustmentClause} onChange={e => set('readjustmentClause', e.target.checked)} className="rounded accent-cyan-500" />
                <label htmlFor="readjustmentClause" className="text-sm text-slate-300 cursor-pointer">Cláusula de reajuste prevista</label>
              </div>
            </div>
          )}

          {/* ABA: PRAZOS */}
          {activeTab === 'prazos' && (
            <div className={sectionCls}>
              <div><h3 className="text-lg font-bold text-white">Prazos e Fase Atual</h3>
                <p className="text-xs text-slate-400">Datas importantes do processo licitatório.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Data de Publicação</label>
                  <input type="date" className={inputCls} value={form.publicationDate} onChange={e => set('publicationDate', e.target.value)} /></div>
                <div><label className={labelCls}>Data de Abertura</label>
                  <input type="date" className={inputCls} value={form.openingDate} onChange={e => set('openingDate', e.target.value)} /></div>
                <div><label className={labelCls}>Prazo de Impugnação</label>
                  <input type="date" className={inputCls} value={form.challengeDeadline} onChange={e => set('challengeDeadline', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Entrega de Proposta</label>
                  <input type="date" className={inputCls} value={form.proposalDeadline} onChange={e => set('proposalDeadline', e.target.value)} /></div>
                <div><label className={labelCls}>Vigência Estimada</label>
                  <input type="date" className={inputCls} value={form.estimatedValidity} onChange={e => set('estimatedValidity', e.target.value)} /></div>
                <div><label className={labelCls}>Fase Atual</label>
                  <select className={selectCls} value={form.currentPhase} onChange={e => set('currentPhase', e.target.value)}>
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ABA: ESTRATÉGIA */}
          {activeTab === 'estrategia' && (
            <div className={sectionCls}>
              <div><h3 className="text-lg font-bold text-white">Estratégia Comercial</h3>
                <p className="text-xs text-slate-400">Time responsável, parceiros e análise competitiva.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Lead Comercial</label>
                  <input className={inputCls} placeholder="Nome do responsável comercial" value={form.commercialLead} onChange={e => set('commercialLead', e.target.value)} /></div>
                <div><label className={labelCls}>Lead Técnico</label>
                  <input className={inputCls} placeholder="Nome do responsável técnico" value={form.technicalLead} onChange={e => set('technicalLead', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Parceiro</label>
                  <input className={inputCls} placeholder="Nome do parceiro envolvido" value={form.partner} onChange={e => set('partner', e.target.value)} /></div>
                <div><label className={labelCls}>Fabricante</label>
                  <input className={inputCls} placeholder="Nome do fabricante" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Nível de Concorrência</label>
                  <select className={selectCls} value={form.competitionLevel} onChange={e => set('competitionLevel', e.target.value)}>
                    {COMPETITION_LEVELS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Decisão GO/NO GO</label>
                  <select className={selectCls} value={form.decision} onChange={e => set('decision', e.target.value)}>
                    <option value="PENDING">Pendente</option>
                    <option value="GO">GO</option>
                    <option value="NO GO">NO GO</option>
                  </select>
                </div>
              </div>
              <div><label className={labelCls}>Principais Concorrentes</label>
                <input className={inputCls} placeholder="Ex: Empresa A, Empresa B" value={form.mainCompetitors} onChange={e => set('mainCompetitors', e.target.value)} /></div>
              <div><label className={labelCls}>Descrição da Estratégia</label>
                <textarea className={inputCls + ' min-h-[80px] resize-none'} rows={3} placeholder="Descreva a estratégia de abordagem..." value={form.strategyDescription} onChange={e => set('strategyDescription', e.target.value)} /></div>
              <div><label className={labelCls}>Justificativa da Decisão (IA ou Manual)</label>
                <textarea className={inputCls + ' min-h-[80px] resize-none'} rows={3} placeholder="Justificativa para GO ou NO GO..." value={form.decisionJustification} onChange={e => set('decisionJustification', e.target.value)} /></div>
            </div>
          )}

          {/* ABA: DOCUMENTOS */}
          {activeTab === 'documentos' && (
            <div className={sectionCls}>
              <div><h3 className="text-lg font-bold text-white">Documentação</h3>
                <p className="text-xs text-slate-400">Links, certidões e checklist documental.</p></div>
              <div><label className={labelCls}>Link do Briefing / Edital</label>
                <input type="url" className={inputCls} placeholder="https://..." value={form.briefingLink} onChange={e => set('briefingLink', e.target.value)} /></div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Certidões / Documentos Obrigatórios</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                  {CERTIFICATE_OPTIONS.map(cert => (
                    <label key={cert} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.certificatesRequired.includes(cert)}
                        onChange={e => set('certificatesRequired',
                          e.target.checked
                            ? [...form.certificatesRequired, cert]
                            : form.certificatesRequired.filter(c => c !== cert)
                        )}
                        className="rounded accent-cyan-500"
                      />
                      {cert}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 cursor-pointer">
                  <input type="checkbox" checked={form.documentChecklistComplete} onChange={e => set('documentChecklistComplete', e.target.checked)} className="rounded accent-cyan-500" />
                  <span className="text-sm text-slate-300">Checklist completo</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 cursor-pointer">
                  <input type="checkbox" checked={form.samplesRequired} onChange={e => set('samplesRequired', e.target.checked)} className="rounded accent-cyan-500" />
                  <span className="text-sm text-slate-300">Exige amostras</span>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 cursor-pointer">
                  <input type="checkbox" checked={form.technicalVisitMandatory} onChange={e => set('technicalVisitMandatory', e.target.checked)} className="rounded accent-cyan-500" />
                  <span className="text-sm text-slate-300">Visita técnica obrigatória</span>
                </label>
              </div>
            </div>
          )}

          {/* ABA: RISCO */}
          {activeTab === 'risco' && (
            <div className={sectionCls}>
              <div><h3 className="text-lg font-bold text-white">Risco e Jurídico</h3>
                <p className="text-xs text-slate-400">Avalie criticidade jurídica e operacional da oportunidade.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className={labelCls}>Tipo de Julgamento</label>
                  <input className={inputCls} placeholder="Ex: Menor Preço" value={form.judgmentType} onChange={e => set('judgmentType', e.target.value)} /></div>
                <div><label className={labelCls}>Grau de Risco</label>
                  <select className={selectCls} value={form.riskLevel} onChange={e => set('riskLevel', e.target.value)}>
                    {RISK_LEVELS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 mt-5 cursor-pointer">
                  <input type="checkbox" checked={form.restrictiveRequirements} onChange={e => set('restrictiveRequirements', e.target.checked)} className="rounded accent-cyan-500" />
                  <span className="text-sm text-slate-300">Exigências restritivas</span>
                </label>
              </div>
              <div><label className={labelCls}>Penalidades</label>
                <textarea className={inputCls + ' min-h-[80px] resize-none'} rows={3} placeholder="Descreva multas, sanções e impactos previstos." value={form.penalties} onChange={e => set('penalties', e.target.value)} /></div>
              <div><label className={labelCls}>Observações Jurídicas</label>
                <textarea className={inputCls + ' min-h-[100px] resize-none'} rows={4} placeholder="Anotações jurídicas, riscos adicionais e pontos de atenção." value={form.legalNotes} onChange={e => set('legalNotes', e.target.value)} /></div>
            </div>
          )}

          {/* Botões finais */}
          <div className="flex justify-between gap-3 pt-2">
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-all">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-400/60 bg-blue-500/80 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando...' : mode === 'create' ? 'Criar Oportunidade' : 'Salvar Alterações'}
            </button>
          </div>

        </div>
      </div>
    </Modal>
  );
}
