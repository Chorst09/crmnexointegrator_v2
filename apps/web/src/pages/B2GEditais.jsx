import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowUpDown,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Brain,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck2,
  FileSearch,
  FileText,
  FileUp,
  Gavel,
  History,
  Landmark,
  LayoutGrid,
  List,
  Loader2,
  Gauge,
  Maximize2,
  Percent,
  Snowflake,
  Sun,
  Thermometer,
  Flame,
  Clock3,
  Zap,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Tag,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
  Workflow,
  MessageSquare,
  Send,
  Phone,
  Mail,
  MessageCircle,
  StickyNote
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

import AnimatedStats from '../components/AnimatedStats';
import B2GFunnelStrategic from '../components/B2GFunnelStrategic';
import DashboardKPICard from '../components/DashboardKPICard';
import DashboardAdvancedChart from '../components/DashboardAdvancedChart';
import TemperatureGauge from '../components/TemperatureGauge';
import Modal from '../components/Modal';
import OpportunityForm from '../components/OpportunityForm';
import CloseOpportunityModal from '../components/CloseOpportunityModal';
import { B2GOpportunityDetailModal, B2GOpportunityEditModal, parseB2GData } from '../components/B2GOpportunityModal';
import B2GOpportunityAlerts from '../components/B2GOpportunityAlerts';
import PresentationControls from '../components/PresentationControls';
import PipelineDashboardModel from '../components/PipelineDashboardModel';
import FiltrosTIAvancados from '../components/FiltrosTIAvancados';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import { isCompanyInClientType, isOpportunityInClientType } from '../utils/businessModel';
import { hydrateActivityFlow } from '../utils/activityFlow';
import { DASHBOARD_COLORS } from '../constants/dashboardTheme';
import '../styles/dashboardEffects.css';

const TYPE_OPTIONS = [
  { value: 'EDITAL', label: 'Edital' },
  { value: 'TERMO_REFERENCIA', label: 'Termo de Referência (TR)' },
  { value: 'ATA_REGISTRO_PRECOS', label: 'Ata de Registro de Preços' },
  { value: 'DOCUMENTACAO', label: 'Documentação' }
];

const STATUS_OPTIONS = [
  { value: 'MONITORANDO', label: 'Monitorando' },
  { value: 'ANALISE_EM_ANDAMENTO', label: 'Análise em andamento' },
  { value: 'ANALISE_CONCLUIDA', label: 'Análise concluída' },
  { value: 'PROPOSTA_EM_PREPARACAO', label: 'Proposta em preparação' },
  { value: 'ENVIADA', label: 'Enviada' },
  { value: 'SUSPENSA', label: 'Suspensa' },
  { value: 'ENCERRADA', label: 'Encerrada' }
];

const DOC_STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'CONCLUIDO', label: 'Concluído' }
];

const OPPORTUNITY_STAGE_LABELS = {
  LEAD: 'Lead',
  QUALIFICATION: 'Qualificação',
  DIAGNOSIS: 'Diagnóstico',
  PROPOSAL: 'Proposta',
  NEGOTIATION: 'Negociação',
  WON: 'Ganha',
  LOST: 'Perdida',
  ANALISE: 'Análise',
  PROPOSTA_ENVIADA: 'Proposta enviada',
  HABILITACAO: 'Habilitação',
  RECURSO: 'Recurso',
  SUSPENSO: 'Suspenso',
  HOMOLOGADO: 'Homologado',
  CONCLUIDO: 'Concluído',
  GANHO: 'Ganho',
  NO_GO: 'No Go',
  PERDIDO: 'Perdido'
};

const PROJECT_CLIENT_TYPE_LABELS = {
  NEW_CLIENT: 'Cliente Novo',
  BASE_CLIENT: 'Cliente da Base',
  RENEWAL: 'Renovação'
};

const COMPANY_STATUS_LABELS = {
  LEAD: 'Lead',
  PROSPECT: 'Prospect',
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
  CHURNED: 'Perdida'
};

const ACTIVITY_TYPE_LABELS = {
  CALL: 'Ligação',
  MEETING: 'Reunião',
  EMAIL: 'E-mail',
  TASK: 'Tarefa',
  FOLLOW_UP: 'Follow-up',
  SOLICITACAO_ORCAMENTO: 'Solicitação de orçamento'
};

const ACTIVITY_STATUS_LABELS = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada'
};

const ACTIVITY_KANBAN_STATUS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const STATUS_STYLES = {
  MONITORANDO: 'bg-sky-500/10 text-sky-700 dark:text-sky-200 border-sky-500/30',
  ANALISE_EM_ANDAMENTO: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-200 border-indigo-500/30',
  ANALISE_CONCLUIDA: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
  PROPOSTA_EM_PREPARACAO: 'bg-amber-500/10 text-amber-700 dark:text-amber-200 border-amber-500/30',
  ENVIADA: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
  SUSPENSA: 'bg-orange-500/10 text-orange-700 dark:text-orange-200 border-orange-500/30',
  ENCERRADA: 'bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-500/30'
};

const TYPE_LABELS = {
  EDITAL: 'Edital',
  TERMO_REFERENCIA: 'TR',
  ATA_REGISTRO_PRECOS: 'Ata RP',
  DOCUMENTACAO: 'Documentação'
};
const MAX_INLINE_AI_UPLOAD_BYTES = 3 * 1024 * 1024;

const KANBAN_COLUMNS = [
  { id: 'ANALISE', label: 'ANÁLISE', tone: 'default' },
  { id: 'PROPOSTA_ENVIADA', label: 'PROPOSTA ENVIADA', tone: 'default' },
  { id: 'HABILITACAO', label: 'HABILITAÇÃO', tone: 'default' },
  { id: 'RECURSO', label: 'RECURSO', tone: 'default' },
  { id: 'SUSPENSO', label: 'SUSPENSO', tone: 'default' },
  { id: 'HOMOLOGADO', label: 'HOMOLOGADO', tone: 'default' },
  { id: 'CONCLUIDO', label: 'CONCLUÍDO', tone: 'default' },
  { id: 'GANHO', label: 'GANHO', tone: 'success' },
  { id: 'NO_GO', label: 'NO GO', tone: 'warning' },
  { id: 'PERDIDO', label: 'PERDIDO', tone: 'danger' }
];

const KANBAN_STAGE_TO_PIPELINE_STAGE = {
  ANALISE: 'DIAGNOSIS',
  PROPOSTA_ENVIADA: 'PROPOSAL',
  HABILITACAO: 'NEGOTIATION',
  RECURSO: 'NEGOTIATION',
  SUSPENSO: 'NEGOTIATION',
  HOMOLOGADO: 'NEGOTIATION',
  CONCLUIDO: 'WON',
  GANHO: 'WON',
  NO_GO: 'LOST',
  PERDIDO: 'LOST'
};

const KANBAN_FINAL_COLUMNS = new Set(['GANHO', 'NO_GO', 'PERDIDO']);
const KANBAN_PROGRESS_FLOW = KANBAN_COLUMNS
  .map((column) => column.id)
  .filter((columnId) => !KANBAN_FINAL_COLUMNS.has(columnId));

const KANBAN_COLUMN_LABELS = Object.fromEntries(
  KANBAN_COLUMNS.map((column) => [column.id, column.label])
);

const DASHBOARD_FUNNEL_META = [
  { id: 'ANALISE', label: 'Análise', width: 100, gradient: 'from-[#ff436d] to-[#f4375f]' },
  { id: 'PROPOSTA_ENVIADA', label: 'Proposta enviada', width: 90, gradient: 'from-[#f8b313] to-[#f39b0a]' },
  { id: 'HABILITACAO', label: 'Habilitação', width: 80, gradient: 'from-[#21c88f] to-[#1ab385]' },
  { id: 'RECURSO', label: 'Recurso', width: 70, gradient: 'from-[#24c7e7] to-[#1faed0]' },
  { id: 'SUSPENSO', label: 'Suspenso', width: 65, gradient: 'from-[#a0aec0] to-[#8b9bb0]' },
  { id: 'HOMOLOGADO', label: 'Homologado', width: 60, gradient: 'from-[#4b87f3] to-[#3b79e8]' },
  { id: 'CONCLUIDO', label: 'Concluído', width: 50, gradient: 'from-[#8b61ff] to-[#7b53ef]' },
  { id: 'GANHO', label: 'Ganho', width: 44, gradient: 'from-[#36d483] to-[#2bc47a]' },
  { id: 'NO_GO', label: 'No Go', width: 36, gradient: 'from-[#f3ab1c] to-[#e89c15]' },
  { id: 'PERDIDO', label: 'Perdido', width: 32, gradient: 'from-[#e53e3e] to-[#c53030]' }
];

const DASHBOARD_STAGE_TONES = {
  ANALISE: '#ef4444',
  PROPOSTA_ENVIADA: '#f97316',
  HABILITACAO: '#facc15',
  RECURSO: '#84cc16',
  SUSPENSO: '#22c55e',
  HOMOLOGADO: '#06b6d4',
  CONCLUIDO: '#2563eb',
  GANHO: '#22c55e',
  NO_GO: '#f59e0b',
  PERDIDO: '#ef4444'
};

const DASHBOARD_PROBABILITY_LEVELS = [
  { id: 100, label: '100%', min: 90, max: 100, width: 100, gradient: 'from-[#42dcf4] to-[#149ccd]', palette: ['#4fe3f1', '#20a8d0', '#116580'], text: '#ffffff' },
  { id: 75, label: '75%', min: 70, max: 89, width: 88, gradient: 'from-[#a7afff] to-[#5b52ea]', palette: ['#aab3ff', '#6258ea', '#302a91'], text: '#ffffff' },
  { id: 50, label: '50%', min: 45, max: 69, width: 76, gradient: 'from-[#ffc321] to-[#ea8a03]', palette: ['#ffd260', '#ef9c08', '#8d5603'], text: '#ffffff' },
  { id: 25, label: '25%', min: 1, max: 44, width: 64, gradient: 'from-[#ff88a6] to-[#dd205d]', palette: ['#ff8dad', '#df2661', '#8d163e'], text: '#ffffff' },
  { id: 0, label: '0%', min: -1, max: 0, width: 52, gradient: 'from-[#ffa654] to-[#ed5b02]', palette: ['#ffad63', '#f45d09', '#963002'], text: '#ffffff' }
];

const DASHBOARD_TEMPERATURE_FILTERS = [
  { id: 'ALL', label: 'Todas', value: null, icon: Thermometer },
  { id: '0', label: '0%', value: 0, icon: Snowflake },
  { id: '25', label: '25%', value: 25, icon: Snowflake },
  { id: '50', label: '50%', value: 50, icon: Sun },
  { id: '75', label: '75%', value: 75, icon: Flame },
  { id: '100', label: '100%', value: 100, icon: Flame }
];

const PERIOD_OPTIONS = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '180', label: 'Últimos 180 dias' }
];

const toFiniteNumber = (value) => {
  const normalized = typeof value === 'string'
    ? value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickPositiveNumber = (...values) => {
  for (const value of values) {
    const parsed = toFiniteNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

const getB2GOpportunityFinancials = (item = {}) => {
  const b2g = parseB2GData(item?.description);
  const monthlyValue = pickPositiveNumber(b2g.estimatedMonthlyValue, b2g.valorEstimadoMensal);
  const oneTimeValue = pickPositiveNumber(b2g.estimatedOneTimeValue, b2g.valorEstimadoPontual);
  const contractType = String(b2g.contractType || b2g.tipoContrato || '').trim().toUpperCase();
  const contractMonths = contractType === 'PONTUAL'
    ? 1
    : Math.max(toFiniteNumber(b2g.contractTermMonths || b2g.prazoContratual || item?.projectMonths), 1);
  const savedTotal = pickPositiveNumber(b2g.estimatedValue, b2g.valorEstimadoTotal);
  const rawValue = pickPositiveNumber(item?.value, item?.estimatedValue);
  const isMonthly = String(item?.projectType || '').toUpperCase() === 'MONTHLY' || monthlyValue > 0;
  const totalValue = isMonthly && monthlyValue > 0
    ? (monthlyValue * contractMonths) + oneTimeValue
    : (savedTotal || rawValue || oneTimeValue);

  return {
    monthlyValue: monthlyValue || (isMonthly ? totalValue / contractMonths : 0),
    oneTimeValue: oneTimeValue || (!isMonthly ? totalValue : 0),
    totalValue,
    contractMonths,
    isMonthly
  };
};

const getB2GResourceSummary = (item = {}) => {
  const b2g = parseB2GData(item?.description);
  const resourceData = b2g.recursoData && typeof b2g.recursoData === 'object' ? b2g.recursoData : {};
  const description =
    resourceData.recursoDescription ||
    b2g.recursoDescricao ||
    b2g.resourceDescription ||
    b2g.appealDescription ||
    '';
  const mainPoints =
    resourceData.mainPoints ||
    b2g.recursoPontosPrincipais ||
    b2g.resourceMainPoints ||
    b2g.appealMainPoints ||
    '';
  const deadline =
    resourceData.deadline ||
    b2g.recursoPrazo ||
    b2g.resourceDeadline ||
    b2g.appealDeadline ||
    '';
  const responsible =
    resourceData.responsibleParty ||
    b2g.recursoResponsavel ||
    b2g.resourceResponsible ||
    b2g.appealResponsible ||
    '';
  const type =
    resourceData.recursoType ||
    b2g.recursoTipo ||
    b2g.resourceType ||
    'Recurso';

  if (!description && !mainPoints && !deadline && !responsible) return null;

  return { type, description, mainPoints, deadline, responsible };
};

const renderB2GResourceSummary = (item) => {
  const summary = getB2GResourceSummary(item);
  if (!summary) return null;

  return (
    <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-50">
      <div className="flex items-center gap-2 font-black uppercase tracking-[0.08em] text-red-200">
        <MessageSquare className="h-3.5 w-3.5" />
        {summary.type}
      </div>
      {summary.description && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap leading-relaxed text-red-50/90">
          {summary.description}
        </p>
      )}
      {summary.mainPoints && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap leading-relaxed text-red-100/85">
          Pontos: {summary.mainPoints}
        </p>
      )}
      {(summary.deadline || summary.responsible) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-red-100/80">
          {summary.deadline && <span>Prazo: {formatDateFlexible(summary.deadline)}</span>}
          {summary.responsible && <span>Responsavel: {summary.responsible}</span>}
        </div>
      )}
    </div>
  );
};

const KANBAN_TONE_STYLES = {
  default: {
    title: 'text-[var(--crm-ink)]',
    badge: 'border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] text-[var(--crm-muted)]'
  },
  success: {
    title: 'text-emerald-600 dark:text-emerald-300',
    badge: 'border-emerald-500/40 bg-emerald-500/18 text-emerald-700 dark:text-emerald-200'
  },
  warning: {
    title: 'text-amber-600 dark:text-amber-300',
    badge: 'border-amber-500/40 bg-amber-500/18 text-amber-700 dark:text-amber-200'
  },
  danger: {
    title: 'text-rose-600 dark:text-rose-300',
    badge: 'border-rose-500/40 bg-rose-500/18 text-rose-700 dark:text-rose-200'
  }
};

const HISTORICAL_OUTCOME_IDS = new Set(['NO_GO', 'PERDIDO', 'GANHO']);

const HISTORICAL_OUTCOME_META = {
  NO_GO: {
    label: 'NO GO',
    className: 'border-amber-500/40 bg-amber-500/16 text-amber-700 dark:text-amber-200'
  },
  PERDIDO: {
    label: 'PERDIDO',
    className: 'border-rose-500/40 bg-rose-500/16 text-rose-700 dark:text-rose-200'
  },
  GANHO: {
    label: 'GANHO',
    className: 'border-emerald-500/40 bg-emerald-500/16 text-emerald-700 dark:text-emerald-200'
  }
};

const ANALYSIS_DETAIL_TABS = [
  { id: 'GERAL', label: 'GERAL' },
  { id: 'PRAZOS', label: 'PRAZOS' },
  { id: 'EXIGENCIAS', label: 'EXIGÊNCIAS' },
  { id: 'DOCUMENTACAO', label: 'DOCUMENTAÇÃO' },
  { id: 'ITENS_TR', label: 'ITENS / TR' },
  { id: 'RISCOS_IA', label: 'RISCOS / IA' }
];

const PATH_TAB_MAP = {
  '/b2g-editais': 'dashboard',
  '/b2g-dashboard': 'dashboard',
  '/b2g-leads': 'leads',
  '/b2g-oportunidades': 'oportunidades',
  '/b2g-analise': 'analise',
  '/b2g-resumos': 'resumos',
  '/b2g-atas': 'atas',
  '/b2g-atividades': 'atividades',
  '/b2g-documentacao': 'documentacao',
  '/b2g-relatorios': 'relatorios',
  '/b2g-historico': 'historico'
};

const TAB_PAGE_META = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Visão executiva do funil de editais e da operação comercial B2G.',
    icon: BarChart3,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Dashboard']
  },
  leads: {
    title: 'Leads',
    subtitle: 'Órgãos e contas públicas em acompanhamento comercial.',
    icon: Users,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Leads']
  },
  oportunidades: {
    title: 'Oportunidades',
    subtitle: 'Pipeline de licitações com estágio, valor e probabilidade.',
    icon: Target,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Oportunidades']
  },
  analise: {
    title: 'Analise de Editais e TR com IA',
    subtitle: 'Extraia informações do edital completo ou gere caderno técnico do TR.',
    icon: Brain,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Analise de Editais e TR com IA']
  },
  resumos: {
    title: 'Resumos de Edital',
    subtitle: 'Resumos executivos para leitura rápida e tomada de decisão.',
    icon: FileText,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Resumos de Edital']
  },
  atas: {
    title: 'Atas de Registro de Preços',
    subtitle: 'Gestão e priorização de atas de registro de preços no funil B2G.',
    icon: Landmark,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Atas de Registro de Preços']
  },
  atividades: {
    title: 'Atividades',
    subtitle: 'Acompanhamento operacional de tarefas e compromissos da equipe.',
    icon: Workflow,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Atividades']
  },
  documentacao: {
    title: 'Documentação',
    subtitle: 'Repositório de documentos para certidões, atestados e habilitações B2G.',
    icon: ClipboardCheck,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Documentação']
  },
  relatorios: {
    title: 'Relatórios Estratégicos',
    subtitle: 'Indicadores para priorização comercial e decisões de investimento.',
    icon: TrendingUp,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Relatórios Estratégicos']
  },
  historico: {
    title: 'Histórico',
    subtitle: 'Histórico de oportunidades NO GO, perdidas e ganhas.',
    icon: History,
    breadcrumbs: ['Home', 'B2G GOVERNO', 'Histórico']
  }
};

const INITIAL_FORM = {
  type: 'EDITAL',
  title: '',
  referenceCode: '',
  organization: '',
  stateCode: '',
  modality: '',
  objectDescription: '',
  estimatedValue: '',
  openingDate: '',
  proposalDueDate: '',
  sourceUrl: '',
  tags: '',
  documentText: ''
};

const INITIAL_DOC_FORM = {
  name: '',
  required: true,
  notes: ''
};

const INITIAL_B2G_REPOSITORY_FORM = {
  name: '',
  category: 'Jurídico',
  expirationDate: ''
};

const B2G_REPOSITORY_CATEGORY_OPTIONS = [
  'Jurídico',
  'Fiscal',
  'Técnico',
  'Habilitação',
  'Financeiro',
  'Outros'
];

const B2G_REPOSITORY_EXPIRING_THRESHOLD_DAYS = 30;

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
};

const formatCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};

const parseStageDecisionDetails = (details) => {
  if (!details) return null;
  if (typeof details === 'object' && !Array.isArray(details)) return details;
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getStageDecisionSummary = (opportunity) => {
  const data = parseStageDecisionDetails(opportunity?.stageDecisionDetails);
  if (!data) return null;

  const columnId = resolveKanbanColumnId(data.b2gStage || opportunity?.b2gStage || opportunity?.stage || data.decision);
  const decisionLabel =
    data.decision === 'WON' || columnId === 'GANHO' ? 'Ganho' :
    data.decision === 'NO_GO' || columnId === 'NO_GO' ? 'NO GO' :
    data.decision === 'LOST' || columnId === 'PERDIDO' ? 'Perdido' :
    data.decision || columnId || 'Decisão';
  const reason = data.reason || data.winReason || data.lossReason || data.noGoReason || opportunity?.lossReason || '';
  const competitor = data.competitorName || data.wonFromCompetitor || data.lostToCompetitor || '';
  const description = data.notes || '';
  const priceDifference = data.priceDifference !== null && data.priceDifference !== undefined
    ? formatCurrency(data.priceDifference)
    : '';

  return {
    decisionLabel,
    reason,
    competitor,
    description,
    priceDifference,
    disqualificationReason: data.disqualificationReason || '',
    appealNotes: data.appealNotes || ''
  };
};

const renderStageDecisionSummary = (opportunity, { compact = false } = {}) => {
  const summary = getStageDecisionSummary(opportunity);
  if (!summary) return null;

  const detailLines = [
    summary.reason ? `Motivo: ${summary.reason}` : '',
    !compact && summary.competitor ? `Concorrente: ${summary.competitor}` : '',
    !compact && summary.priceDifference ? `Diferença: ${summary.priceDifference}` : '',
    !compact && summary.disqualificationReason ? `Desclassificação: ${summary.disqualificationReason}` : '',
    !compact && summary.appealNotes ? `Recurso: ${summary.appealNotes}` : ''
  ].filter(Boolean);

  return (
    <div className={[
      'rounded-xl border bg-cyan-500/10 text-cyan-50',
      compact ? 'mb-3 border-cyan-400/25 p-3' : 'border-cyan-400/35 p-4'
    ].join(' ')}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-cyan-200">
        <MessageSquare className="h-3.5 w-3.5" />
        Decisão: {summary.decisionLabel}
      </div>
      {summary.description && (
        <p className={[
          'mt-2 leading-relaxed text-cyan-50/90 whitespace-pre-wrap',
          compact ? 'line-clamp-3 text-xs' : 'text-sm'
        ].join(' ')}>
          {summary.description}
        </p>
      )}
      {detailLines.length > 0 && (
        <div className={compact ? 'mt-2 space-y-1 text-xs text-cyan-100/80' : 'mt-3 grid gap-2 text-sm text-cyan-100/85 sm:grid-cols-2'}>
          {detailLines.map((line) => (
            <div key={line} className="line-clamp-2">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const formatCurrencyNoCents = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(n);
};

const formatCurrencyAxisK = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'R$ 0k';
  return `R$ ${Math.round(n / 1000)}k`;
};

const formatCompactCurrency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'R$ 0';
  if (Math.abs(n) >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(2).replace('.', ',')} bi`;
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace('.', ',')} mil`;
  return formatCurrencyNoCents(n);
};

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const toText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.trim();
};

const toTextArray = (value, limit = 20) =>
  (Array.isArray(value) ? value : [])
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, limit);

const toChecklistArray = (value, limit = 20) =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      if (typeof item === 'string') {
        const text = toText(item);
        if (!text) return null;
        return {
          item: text,
          status: 'pendente',
          details: 'Sem observações.'
        };
      }

      const row = asObject(item);
      if (!row) return null;

      const title = toText(row.item || row.name || row.termRequirement);
      if (!title) return null;

      const rawStatus = String(row.status || row.meetsRequirement || '').toUpperCase();
      const status =
        rawStatus === 'OK' || rawStatus === 'CONCLUIDO' || rawStatus === 'ATENDE'
          ? 'ok'
          : rawStatus === 'EM_ANDAMENTO'
            ? 'em_andamento'
            : 'pendente';

      const details = toText(row.details || row.datasheetEvidence || row.rationale) || 'Sem observações.';

      return {
        item: title,
        status,
        details
      };
    })
    .filter(Boolean)
    .slice(0, limit);

const DOCUMENTATION_MATCH_KEYWORDS = [
  'documento',
  'documentacao',
  'habilitacao',
  'certidao',
  'certificado',
  'atestado',
  'declaracao',
  'comprovante',
  'comprovacao',
  'regularidade fiscal',
  'qualificacao tecnica',
  'qualificacao economico financeira',
  'balanco',
  'registro',
  'licenca',
  'credenciamento',
  'cnd',
  'fgts',
  'inss',
  'sicaf',
  'crc',
  'crea',
  'cau',
  'anvisa',
  'iso',
  'contrato social',
  'estatuto social',
  'procuracao'
];

const DOCUMENTATION_GROUP_HINTS = ['jurid', 'fiscal', 'habilit', 'econom', 'document', 'certific'];

const normalizeKeywordMatch = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isDocumentationRequirement = (itemText, groupLabel = '') => {
  const normalizedItem = normalizeKeywordMatch(itemText);
  if (!normalizedItem) return false;

  const normalizedGroup = normalizeKeywordMatch(groupLabel);
  if (DOCUMENTATION_GROUP_HINTS.some((hint) => normalizedGroup.includes(hint))) {
    return true;
  }

  return DOCUMENTATION_MATCH_KEYWORDS.some((keyword) => normalizedItem.includes(keyword));
};

const buildDocumentationChecklist = ({ requirementGroups, checklistDocumentacao, limit = 40 }) => {
  const groups = Array.isArray(requirementGroups) ? requirementGroups : [];
  const checklist = Array.isArray(checklistDocumentacao) ? checklistDocumentacao : [];
  const seen = new Set();
  const rows = [];

  const pushRow = (value, fallbackDetails = 'Sem observações.') => {
    const row = asObject(value) || {};
    const item = toText(row.item || row.name || value);
    if (!item) return;

    const dedupeKey = normalizeKeywordMatch(item);
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    rows.push({
      item,
      status: toText(row.status) || 'pendente',
      details: toText(row.details) || fallbackDetails
    });
  };

  checklist.forEach((item) => {
    pushRow(item, 'Checklist operacional gerado automaticamente pela IA.');
  });

  groups.forEach((group) => {
    const groupLabel = toText(group?.label) || 'Requisitos';
    const items = Array.isArray(group?.items) ? group.items : [];
    items.forEach((item) => {
      const itemText = toText(item);
      if (!itemText || !isDocumentationRequirement(itemText, groupLabel)) return;

      pushRow(
        {
          item: itemText,
          status: 'pendente',
          details: `Categoria: ${groupLabel}`
        },
        `Categoria: ${groupLabel}`
      );
    });
  });

  if (rows.length === 0) {
    groups.forEach((group) => {
      const groupLabel = toText(group?.label) || 'Requisitos';
      const items = Array.isArray(group?.items) ? group.items : [];
      items.forEach((item) => {
        const itemText = toText(item);
        if (!itemText) return;

        pushRow(
          {
            item: itemText,
            status: 'pendente',
            details: `Categoria: ${groupLabel}`
          },
          `Categoria: ${groupLabel}`
        );
      });
    });
  }

  return rows.slice(0, limit);
};

const toItemsArray = (value, limit = 20) =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const name = toText(row.name);
      if (!name) return null;
      return {
        name,
        quantity: toText(row.quantity) || 'Não identificado',
        specs: toText(row.specs) || 'Não identificado'
      };
    })
    .filter(Boolean)
    .slice(0, limit);

const toTechnicalNotebookArray = (value, limit = 20) =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const termRequirement = toText(row.termRequirement);
      if (!termRequirement) return null;
      const meetsRequirement = String(row.meetsRequirement || '').toUpperCase() === 'ATENDE' ? 'ATENDE' : 'NAO_ATENDE';
      return {
        termRequirement,
        meetsRequirement,
        datasheetEvidence: toText(row.datasheetEvidence),
        rationale: toText(row.rationale)
      };
    })
    .filter(Boolean)
    .slice(0, limit);

const toCompliantEquipmentArray = (value, limit = 20) =>
  (Array.isArray(value) ? value : [])
    .map((item) => {
      const row = asObject(item);
      if (!row) return null;
      const model = toText(row.model);
      if (!model) return null;
      return {
        model,
        manufacturer: toText(row.manufacturer) || 'Não informado',
        rationale: toText(row.rationale) || 'Sem justificativa.'
      };
    })
    .filter(Boolean)
    .slice(0, limit);

const parseFlexibleDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;

    const brMatch = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (brMatch) {
      const day = Number(brMatch[1]);
      const month = Number(brMatch[2]);
      let year = Number(brMatch[3]);
      if (year < 100) year += 2000;
      const parsed = new Date(year, month - 1, day);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateFlexible = (value) => {
  if (!value) return '-';
  const parsed = parseFlexibleDate(value);
  if (parsed) return parsed.toLocaleDateString('pt-BR');

  const text = toText(value);
  return text || '-';
};

const daysUntilFlexible = (value) => {
  const parsed = parseFlexibleDate(value);
  if (!parsed) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const formatFileSize = (bytes) => {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = num;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getRepositoryDocumentValidity = (expirationDate) => {
  const remainingDays = daysUntilFlexible(expirationDate);
  if (remainingDays === null) {
    return {
      status: 'VALID',
      label: 'Válido',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
      remainingDays: null
    };
  }

  if (remainingDays < 0) {
    return {
      status: 'EXPIRED',
      label: 'Expirado',
      className: 'bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-500/30',
      remainingDays
    };
  }

  if (remainingDays <= B2G_REPOSITORY_EXPIRING_THRESHOLD_DAYS) {
    return {
      status: 'EXPIRING',
      label: 'Expirando',
      className: 'bg-amber-500/18 text-amber-700 dark:text-amber-200 border-amber-500/35',
      remainingDays
    };
  }

  return {
    status: 'VALID',
    label: 'Válido',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
    remainingDays
  };
};

const clampScore = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const tryParseObject = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return asObject(parsed);
  } catch (_error) {
    return null;
  }
};

const looksLikeEditalTemplate = (value) => {
  const data = asObject(value);
  if (!data) return false;
  const general = asObject(data.general);
  const deadlines = asObject(data.deadlines);
  const requirements = asObject(data.requirements);
  const hasGeneral = Boolean(general && (
    general.openingDate !== undefined ||
    general.openingTime !== undefined ||
    general.portal !== undefined ||
    general.agency !== undefined ||
    general.modality !== undefined ||
    general.objectSummary !== undefined
  ));
  const hasDeadlines = Boolean(deadlines && (
    deadlines.publicationDate !== undefined ||
    deadlines.proposalDeadline !== undefined ||
    deadlines.contractTerm !== undefined
  ));
  const hasRequirements = Boolean(requirements && (
    Array.isArray(requirements.legal) ||
    Array.isArray(requirements.technical) ||
    Array.isArray(requirements.economic) ||
    Array.isArray(requirements.fiscal)
  ));
  const hasItemsOrRisks = Array.isArray(data.items) || Array.isArray(data.risks);
  return hasGeneral && hasDeadlines && hasRequirements && hasItemsOrRisks;
};

const looksLikeTrTemplate = (value) => {
  const data = asObject(value);
  if (!data) return false;
  return (
    String(data.analysisType || '').toLowerCase() === 'tr' ||
    Array.isArray(data.technicalNotebook) ||
    Array.isArray(data.termRequirements) ||
    asObject(data.complianceOverview) !== null
  );
};

const extractTemplateAnalysis = (notice) => {
  const aiAnalysis = asObject(notice?.aiAnalysis) || {};

  const templateData = asObject(aiAnalysis.templateExtractedData);
  if (templateData) {
    const nestedType = toText(templateData.analysisType).toLowerCase();
    if (nestedType === 'edital' || nestedType === 'tr') {
      return templateData;
    }
    if (looksLikeEditalTemplate(templateData) || looksLikeTrTemplate(templateData)) {
      return templateData;
    }
  }

  const directType = toText(aiAnalysis.analysisType).toLowerCase();
  if (directType === 'edital' || directType === 'tr') {
    return aiAnalysis;
  }

  const documentPayload = tryParseObject(notice?.documentText);
  if (documentPayload) {
    const payloadType = toText(documentPayload.analysisType).toLowerCase();
    if (payloadType === 'edital' || payloadType === 'tr') {
      return documentPayload;
    }
    if (looksLikeEditalTemplate(documentPayload) || looksLikeTrTemplate(documentPayload)) {
      return documentPayload;
    }
  }

  return null;
};

const buildNoticeAnalysisView = (notice) => {
  if (!notice) return null;

  const aiAnalysis = asObject(notice.aiAnalysis) || {};
  const template = extractTemplateAnalysis(notice) || {};
  const templateType = toText(template.analysisType).toLowerCase();
  const isTrAnalysis = templateType === 'tr' || notice.type === 'TERMO_REFERENCIA';

  const general = asObject(template.general) || {};
  const deadlines = asObject(template.deadlines) || {};
  const requirements = asObject(template.requirements) || {};

  const legalRequirements = toTextArray(requirements.legal, 20);
  const technicalRequirements = toTextArray(requirements.technical, 20);
  const economicRequirements = toTextArray(requirements.economic, 20);
  const fiscalRequirements = toTextArray(requirements.fiscal, 20);
  const termRequirements = toTextArray(template.termRequirements, 30);

  const technicalNotebook = toTechnicalNotebookArray(template.technicalNotebook, 25);
  const items = toItemsArray(template.items, 25);
  const compliantEquipment = toCompliantEquipmentArray(template.compliantEquipment, 20);

  const checklistFromAi = toChecklistArray(aiAnalysis.checklistDocumentacao, 25);

  const requirementGroups = isTrAnalysis
    ? [
        { id: 'tr', label: 'Requisitos do TR', items: termRequirements }
      ].filter((group) => group.items.length > 0)
    : [
        { id: 'legal', label: 'Jurídicas', items: legalRequirements },
        { id: 'technical', label: 'Técnicas', items: technicalRequirements },
        { id: 'economic', label: 'Econômicas', items: economicRequirements },
        { id: 'fiscal', label: 'Fiscais', items: fiscalRequirements }
      ].filter((group) => group.items.length > 0);

  const checklistDocumentacao = checklistFromAi.length
    ? checklistFromAi
    : requirementGroups
        .flatMap((group) =>
          group.items.map((item) => ({
            item,
            status: 'pendente',
            details: `Categoria: ${group.label}`
          }))
        )
        .slice(0, 25);
  const documentationChecklist = buildDocumentationChecklist({
    requirementGroups,
    checklistDocumentacao
  });

  const complianceOverview = asObject(template.complianceOverview) || {};
  const totalRequirementsRaw = Number(complianceOverview.totalRequirements);
  const metRequirementsRaw = Number(complianceOverview.metRequirements);
  const totalRequirements = Number.isFinite(totalRequirementsRaw)
    ? totalRequirementsRaw
    : isTrAnalysis
      ? Math.max(technicalNotebook.length, termRequirements.length)
      : 0;
  const metFromNotebook = technicalNotebook.filter((row) => row.meetsRequirement === 'ATENDE').length;
  const metRequirements = Number.isFinite(metRequirementsRaw) ? metRequirementsRaw : metFromNotebook;

  const scoreFromAi = Number(aiAnalysis.scoreAderencia);
  const scoreAderencia = Number.isFinite(scoreFromAi)
    ? clampScore(scoreFromAi)
    : totalRequirements > 0
      ? clampScore((metRequirements / totalRequirements) * 100)
      : 0;

  const fallbackRecommendation =
    scoreAderencia >= 75 ? 'GO' : scoreAderencia >= 55 ? 'GO_COM_RESSALVAS' : 'NO_GO';

  const recommendation = toText(aiAnalysis.recomendacao) || fallbackRecommendation;
  const risksFromTemplate = toTextArray(template.risks, 20);
  const risks = risksFromTemplate.length ? risksFromTemplate : toTextArray(aiAnalysis.riscos, 20);

  const opportunities = toTextArray(aiAnalysis.oportunidades, 20);
  const keyPoints = toTextArray(aiAnalysis.pontosChave, 20);

  const nextActions = (() => {
    const actions = toTextArray(aiAnalysis.proximasAcoes, 20);
    if (actions.length > 0) return actions;
    if (isTrAnalysis) {
      return [
        'Validar requisitos não atendidos com equipe técnica.',
        'Atualizar caderno técnico com evidências de atendimento.',
        'Revisar estratégia comercial conforme risco de não conformidade.'
      ];
    }
    return [
      'Conferir marcos críticos e prazo de proposta.',
      'Validar documentação obrigatória por categoria.',
      'Ajustar estratégia comercial para mitigar riscos apontados.'
    ];
  })();

  return {
    analysisType: isTrAnalysis ? 'tr' : 'edital',
    isTrAnalysis,
    summary: toText(aiAnalysis.resumoExecutivo) || toText(template.trSummary) || notice.summary || '',
    recommendation,
    scoreAderencia,
    generatedAt: aiAnalysis.generatedAt || notice.updatedAt || notice.createdAt,
    keyPoints,
    risks,
    opportunities,
    nextActions,
    checklistDocumentacao,
    documentationChecklist,
    requirementGroups,
    items,
    termRequirements,
    technicalNotebook,
    compliantEquipment,
    complianceOverview: {
      totalRequirements,
      metRequirements,
      fullCompliance:
        typeof complianceOverview.fullCompliance === 'boolean'
          ? complianceOverview.fullCompliance
          : totalRequirements > 0 && metRequirements >= totalRequirements
    },
    general: {
      openingDate: toText(general.openingDate) || notice.openingDate || null,
      openingTime: toText(general.openingTime) || null,
      agency: toText(general.agency) || notice.organization || 'Não identificado',
      modality: toText(general.modality) || notice.modality || 'Não identificado',
      portal: toText(general.portal) || notice.sourceUrl || 'Não identificado',
      objectSummary: toText(general.objectSummary) || notice.objectDescription || notice.summary || 'Objeto não identificado.'
    },
    deadlines: {
      openingDate: toText(general.openingDate) || notice.openingDate || null,
      publicationDate: toText(deadlines.publicationDate) || null,
      impugnationDeadline: toText(deadlines.impugnationDeadline) || null,
      clarificationDeadline: toText(deadlines.clarificationDeadline) || null,
      proposalDeadline: toText(deadlines.proposalDeadline) || notice.proposalDueDate || null,
      contractTerm: toText(deadlines.contractTerm) || null
    }
  };
};

const toSafeFileName = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'resumo-edital-tr';

const toComparableText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const checklistStatusLabel = (value) => {
  if (value === 'ok' || value === 'CONCLUIDO') return 'Concluído';
  if (value === 'em_andamento' || value === 'EM_ANDAMENTO') return 'Em andamento';
  return 'Pendente';
};

const checklistStatusClassName = (value) => {
  if (value === 'ok' || value === 'CONCLUIDO') {
    return 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200';
  }
  if (value === 'em_andamento' || value === 'EM_ANDAMENTO') {
    return 'border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-200';
  }
  return 'border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.56)] text-[var(--crm-muted)]';
};

const labelFrom = (list, value, fallback = '-') =>
  list.find((item) => item.value === value)?.label || fallback;

const scoreColor = (score) => {
  if (score >= 75) return 'text-emerald-700 dark:text-emerald-200';
  if (score >= 55) return 'text-amber-700 dark:text-amber-200';
  return 'text-red-700 dark:text-red-200';
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const toTimestamp = (value) => {
  const d = new Date(value || 0);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
};

const getTemperatureBand = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 44) return 25;
  if (n <= 69) return 50;
  if (n <= 89) return 75;
  return 100;
};

const normalizeStateCode = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toUpperCase().slice(0, 2);
};

const extractStateCodeFromText = (value) => {
  if (!value || typeof value !== 'string') return '';
  const m = value.toUpperCase().match(/(?:^|\s|\/|-)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:$|\s|\/|-)/);
  return m?.[1] || '';
};

const getNoticeStateCode = (notice) =>
  normalizeStateCode(notice?.stateCode) || extractStateCodeFromText(notice?.organization);

const isNoticeAnalysisCompleted = (notice) => {
  if (!notice || !notice.aiAnalysis || typeof notice.aiAnalysis !== 'object') return false;
  const templateData = extractTemplateAnalysis(notice);
  return Boolean(
    templateData ||
    notice.aiAnalysis.generatedAt ||
    notice.aiAnalysis.recomendacao ||
    notice.aiAnalysis.scoreAderencia !== undefined ||
    notice.aiAnalysis.resumoExecutivo ||
    notice.summary
  );
};

const getNoticeDisplayStatus = (notice) => {
  const status = String(notice?.status || '');
  if (!status) return '';
  if (status === 'ANALISE_EM_ANDAMENTO' && isNoticeAnalysisCompleted(notice)) {
    return 'ANALISE_CONCLUIDA';
  }
  return status;
};

const normalizeStageToken = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const resolveKanbanColumnId = (stage) => {
  const token = normalizeStageToken(stage);
  if (!token) return 'ANALISE';

  if (KANBAN_COLUMNS.some((column) => column.id === token)) return token;

  if (['WON', 'GANHO', 'GANHA'].includes(token)) return 'GANHO';
  if (['LOST', 'PERDIDO', 'PERDIDA'].includes(token)) return 'PERDIDO';
  if (token === 'NO_GO' || token === 'NOGO' || token === 'NO_GO_RECOMENDADO') return 'NO_GO';

  if (['LEAD', 'QUALIFICATION', 'QUALIFICACAO', 'DIAGNOSIS', 'DIAGNOSTICO', 'ANALISE', 'ANALYSIS'].includes(token)) {
    return 'ANALISE';
  }

  if (['PROPOSAL', 'PROPOSTA', 'PROPOSTA_ENVIADA', 'NEGOTIATION', 'NEGOCIACAO', 'PROPOSTA_EM_PREPARACAO'].includes(token)) {
    return 'PROPOSTA_ENVIADA';
  }

  if (token.includes('HABILIT')) return 'HABILITACAO';
  if (token.includes('RECURS')) return 'RECURSO';
  if (token.includes('SUSP')) return 'SUSPENSO';
  if (token.includes('HOMOLOG')) return 'HOMOLOGADO';
  if (token.includes('CONCLUI')) return 'CONCLUIDO';

  return 'ANALISE';
};

const mapKanbanColumnToPipelineStage = (columnId) =>
  KANBAN_STAGE_TO_PIPELINE_STAGE[columnId] || 'DIAGNOSIS';

const getNextKanbanColumnId = (columnId) => {
  const currentIndex = KANBAN_PROGRESS_FLOW.indexOf(columnId);
  if (currentIndex < 0 || currentIndex >= KANBAN_PROGRESS_FLOW.length - 1) return null;
  return KANBAN_PROGRESS_FLOW[currentIndex + 1];
};

const normalizeEntityId = (value) => (value === undefined || value === null ? '' : String(value));

const resolveSavedAnalysisScope = () => {
  try {
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : {};
    const userId = String(user?.id || user?.userId || '').trim();
    if (!userId) return null;

    const companyId = String(
      localStorage.getItem('companyId') ||
        localStorage.getItem('selectedCompanyId') ||
        localStorage.getItem('tenantId') ||
        'crm-b2g-default'
    ).trim();

    const roleRaw = String(user?.role || '').toUpperCase();
    const userRole =
      roleRaw === 'ADMIN' || roleRaw === 'DIRECTOR' || roleRaw === 'MANAGER' ? 'admin' : 'user';

    return {
      companyId: companyId || 'crm-b2g-default',
      userId,
      userRole
    };
  } catch (_error) {
    return null;
  }
};

const buildSavedSummaryNotice = (savedRecord) => {
  if (!savedRecord || typeof savedRecord !== 'object') return null;

  const extractedData = asObject(savedRecord.extractedData) || {};
  const general = asObject(extractedData.general) || {};
  const deadlines = asObject(extractedData.deadlines) || {};
  const analysisType = toText(extractedData.analysisType).toLowerCase();
  const isTr = analysisType === 'tr';
  const processedAt = toText(savedRecord.processedAt) || savedRecord.createdAt || savedRecord.updatedAt || null;
  const title = toText(savedRecord.fileName) || toText(savedRecord.analysisId) || 'Resumo sem título';
  const objectSummary =
    toText(general.objectSummary) ||
    toText(extractedData.trSummary) ||
    'Objeto não identificado.';
  const agency = toText(general.agency) || 'Órgão não identificado';

  return {
    id: `saved-${savedRecord.id}`,
    __savedRecordId: savedRecord.id,
    __savedOriginalFileDataUri: savedRecord.originalFileDataUri || null,
    __savedSummaryPdfDataUri: savedRecord.summaryPdfDataUri || null,
    title,
    type: isTr ? 'TERMO_REFERENCIA' : 'EDITAL',
    status: 'ANALISE_CONCLUIDA',
    organization: agency,
    stateCode: extractStateCodeFromText(agency),
    modality: toText(general.modality) || '',
    objectDescription: objectSummary,
    summary: objectSummary,
    sourceUrl: toText(general.portal) || '',
    openingDate: toText(general.openingDate) || null,
    proposalDueDate: toText(deadlines.proposalDeadline) || null,
    estimatedValue: null,
    createdAt: processedAt,
    updatedAt: processedAt,
    aiAnalysis: {
      generatedAt: processedAt,
      resumoExecutivo: toText(extractedData.trSummary) || objectSummary,
      templateExtractedData: extractedData
    }
  };
};

export default function B2GEditais() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [notices, setNotices] = useState([]);
  const [savedSummaryRecords, setSavedSummaryRecords] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activities, setActivities] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState('');

  const [form, setForm] = useState(INITIAL_FORM);
  const [docForm, setDocForm] = useState(INITIAL_DOC_FORM);
  const [repositoryDocuments, setRepositoryDocuments] = useState([]);
  const [repositoryDocumentsLoading, setRepositoryDocumentsLoading] = useState(false);
  const [repositorySearch, setRepositorySearch] = useState('');
  const [repositoryModalOpen, setRepositoryModalOpen] = useState(false);
  const [repositoryForm, setRepositoryForm] = useState(INITIAL_B2G_REPOSITORY_FORM);
  const [repositoryUploadFile, setRepositoryUploadFile] = useState(null);
  const [uploadingRepositoryDocument, setUploadingRepositoryDocument] = useState(false);
  const [viewingRepositoryDocumentId, setViewingRepositoryDocumentId] = useState('');
  const [downloadingRepositoryDocumentId, setDownloadingRepositoryDocumentId] = useState('');
  const [deletingRepositoryDocumentId, setDeletingRepositoryDocumentId] = useState('');
  const [analysisInstruction, setAnalysisInstruction] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [opportunitiesViewMode, setOpportunitiesViewMode] = useState('kanban');
  const [activitiesViewMode, setActivitiesViewMode] = useState('kanban');
  const [showOpportunityFilters, setShowOpportunityFilters] = useState(false);
  const [opportunitySortMode, setOpportunitySortMode] = useState('probability');
  const [analysisMode, setAnalysisMode] = useState('EDITAL');
  const [analysisFile, setAnalysisFile] = useState(null);
  const [analysisDetailTab, setAnalysisDetailTab] = useState('GERAL');
  const [convertingNoticeId, setConvertingNoticeId] = useState('');
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [draggedOpportunityId, setDraggedOpportunityId] = useState('');
  const [draggedOpportunitySnapshot, setDraggedOpportunitySnapshot] = useState(null);
  const [dragOverOpportunityColumn, setDragOverOpportunityColumn] = useState('');
  const [movingOpportunityId, setMovingOpportunityId] = useState('');
  const [pendingOpportunityOutcome, setPendingOpportunityOutcome] = useState(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [deletingLeadId, setDeletingLeadId] = useState('');
  // Estados do modal de edição de oportunidade B2G
  const [showOpportunityEditModal, setShowOpportunityEditModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [opportunityEditForm, setOpportunityEditForm] = useState({
    title: '', projectName: '', projectClientType: 'NEW_CLIENT', projectType: 'SINGLE',
    projectMonths: '12', description: '', value: '', probability: 50,
    stage: 'LEAD', source: 'MANUAL', expectedCloseDate: '', companyId: '', ownerId: ''
  });
  const [opportunityEditSubmitting, setOpportunityEditSubmitting] = useState(false);
  const [opportunityEditError, setOpportunityEditError] = useState('');
  // Estado para modo de criação vs edição no modal de oportunidade
  const [opportunityModalMode, setOpportunityModalMode] = useState('edit'); // 'edit' | 'create'
  // Estados para acompanhamentos de oportunidades B2G
  const [b2gFollowUps, setB2gFollowUps] = useState([]);
  const [b2gFollowUpText, setB2gFollowUpText] = useState('');
  const [b2gFollowUpType, setB2gFollowUpType] = useState('NOTE');
  const [b2gFollowUpSubmitting, setB2gFollowUpSubmitting] = useState(false);
  const [b2gFollowUpError, setB2gFollowUpError] = useState('');
  const [b2gLoadingFollowUps, setB2gLoadingFollowUps] = useState(false);
  const [selectedLeadAnalysisId, setSelectedLeadAnalysisId] = useState('');
  const [leadAnalysisDecision, setLeadAnalysisDecision] = useState('ANALISE');
  const [leadAnalysisNotes, setLeadAnalysisNotes] = useState('');
  const [savingLeadAnalysis, setSavingLeadAnalysis] = useState(false);
  const [deletingOpportunityId, setDeletingOpportunityId] = useState('');
  const [deletingNoticeId, setDeletingNoticeId] = useState('');
  const [deletingSavedSummaryId, setDeletingSavedSummaryId] = useState('');
  const [savedSummariesLoading, setSavedSummariesLoading] = useState(false);
  const [selectedSavedSummaryId, setSelectedSavedSummaryId] = useState('');
  const [savedSummaryModalOpen, setSavedSummaryModalOpen] = useState(false);
  const [savingSavedSummaryId, setSavingSavedSummaryId] = useState('');
  const [showAtaModal, setShowAtaModal] = useState(false);
  const [convertingSavedSummaryId, setConvertingSavedSummaryId] = useState('');
  const [dashboardPresentationMode, setDashboardPresentationMode] = useState(false);
  const [dashboardPresentationProgress, setDashboardPresentationProgress] = useState({ current: 1, total: 1 });
  const [showOpportunityAlertsModal, setShowOpportunityAlertsModal] = useState(false);
  const [opportunityOpeningAlerts, setOpportunityOpeningAlerts] = useState([]);
  const [opportunityOpeningAlertsLoading, setOpportunityOpeningAlertsLoading] = useState(false);
  const analysisFileInputRef = useRef(null);
  const repositoryFileInputRef = useRef(null);
  const dashboardPresentationRef = useRef(null);
  const draggedOpportunityRef = useRef(null);
  const b2gOpportunityRequestRef = useRef(0);
  const [advancedFilters, setAdvancedFilters] = useState({
    organization: '',
    stateCode: '',
    modality: ''
  });
  const [filtrosTI, setFiltrosTI] = useState({
    categoriasSelecionadas: [],
    termoLivre: '',
    ativo: false
  });
  const [dashboardTemperatureFilter, setDashboardTemperatureFilter] = useState('ALL');
  const [dashboardPhaseFilter, setDashboardPhaseFilter] = useState('ALL');
  const [dashboardPeriod, setDashboardPeriod] = useState('30');
  const [dashboardOwnerFilter, setDashboardOwnerFilter] = useState('ALL');

  const activeTab = PATH_TAB_MAP[location.pathname] || 'dashboard';
  const pageMeta = TAB_PAGE_META[activeTab] || TAB_PAGE_META.dashboard;
  const noticeIdFromQuery = useMemo(
    () => new URLSearchParams(location.search).get('noticeId') || '',
    [location.search]
  );
  const opportunityIdFromQuery = useMemo(
    () => new URLSearchParams(location.search).get('opportunityId') || '',
    [location.search]
  );
  const modeFromQuery = useMemo(
    () => (new URLSearchParams(location.search).get('mode') || '').toLowerCase(),
    [location.search]
  );
  const currentUserRole = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return '';
      const user = JSON.parse(raw);
      return String(user?.role || '').toUpperCase();
    } catch (_error) {
      return '';
    }
  }, []);
  const isAdmin = currentUserRole === 'ADMIN' || currentUserRole === 'MASTER';

  const selectedNotice = useMemo(
    () => notices.find((item) => item.id === selectedNoticeId) || null,
    [notices, selectedNoticeId]
  );
  const selectedNoticeAnalysis = useMemo(
    () => buildNoticeAnalysisView(selectedNotice),
    [selectedNotice]
  );
  const selectedOpportunity = useMemo(
    () => opportunities.find((item) => item.id === selectedOpportunityId) || null,
    [opportunities, selectedOpportunityId]
  );
  const selectedOpportunityKanban = useMemo(() => {
    if (!selectedOpportunity) return null;
    const columnId = resolveKanbanColumnId(selectedOpportunity?.b2gStage || selectedOpportunity?.stage);
    return KANBAN_COLUMNS.find((column) => column.id === columnId) || null;
  }, [selectedOpportunity]);

  const filteredNotices = useMemo(() => {
    const orgFilter = advancedFilters.organization.trim().toLowerCase();
    const stateFilter = normalizeStateCode(advancedFilters.stateCode);
    const modalityFilter = advancedFilters.modality.trim().toLowerCase();

    return notices.filter((item) => {
      if (orgFilter && !(item?.organization || '').toLowerCase().includes(orgFilter)) {
        return false;
      }

      const itemStateCode = getNoticeStateCode(item);
      if (stateFilter && itemStateCode !== stateFilter) {
        return false;
      }

      if (modalityFilter && !(item?.modality || '').toLowerCase().includes(modalityFilter)) {
        return false;
      }

      return true;
    });
  }, [advancedFilters.modality, advancedFilters.organization, advancedFilters.stateCode, notices]);

  const organizationFilterOptions = useMemo(() => {
    return [...new Set(
      notices
        .map((item) => item?.organization || '')
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [notices]);

  const ufFilterOptions = useMemo(() => {
    const noticeUFs = notices.map((item) => getNoticeStateCode(item));
    const leadUFs = leads.map((item) => normalizeStateCode(item?.state));
    const opportunityUFs = opportunities.map((item) => normalizeStateCode(item?.company?.state));

    return [...new Set(
      [...noticeUFs, ...leadUFs, ...opportunityUFs].filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [leads, notices, opportunities]);

  const availableUfFilterOptions = useMemo(
    () => [...new Set([...UF_OPTIONS, ...ufFilterOptions])].sort((a, b) => a.localeCompare(b)),
    [ufFilterOptions]
  );

  const modalityFilterOptions = useMemo(() => {
    return [...new Set(
      notices
        .map((item) => (item?.modality || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [notices]);

  const savedSummaryCards = useMemo(() => {
    return savedSummaryRecords
      .map((record) => {
        const notice = buildSavedSummaryNotice(record);
        if (!notice) return null;
        const analysisView = buildNoticeAnalysisView(notice);
        if (!analysisView) return null;

        const targetTitle = toComparableText(notice.title);
        const targetOrganization = toComparableText(notice.organization);
        const linkedNotice =
          notices.find((item) => {
            const noticeTitle = toComparableText(item?.title);
            const noticeOrganization = toComparableText(item?.organization);
            const sameTitle =
              noticeTitle && targetTitle && (noticeTitle === targetTitle || noticeTitle.includes(targetTitle) || targetTitle.includes(noticeTitle));
            const sameOrganization =
              noticeOrganization && targetOrganization && (noticeOrganization === targetOrganization || noticeOrganization.includes(targetOrganization) || targetOrganization.includes(noticeOrganization));
            return sameTitle && sameOrganization;
          }) ||
          notices.find((item) => {
            const noticeTitle = toComparableText(item?.title);
            return noticeTitle && targetTitle && (noticeTitle === targetTitle || noticeTitle.includes(targetTitle) || targetTitle.includes(noticeTitle));
          }) ||
          null;

        const itemsCount = analysisView.isTrAnalysis
          ? Math.max(analysisView.technicalNotebook.length, analysisView.termRequirements.length)
          : analysisView.items.length;

        return {
          id: String(record.id || ''),
          record,
          notice,
          analysisView,
          linkedNoticeId: linkedNotice?.id || '',
          itemsCount,
          risksCount: analysisView.risks.length
        };
      })
      .filter(Boolean);
  }, [notices, savedSummaryRecords]);

  const filteredSavedSummaryCards = useMemo(() => {
    const orgFilter = advancedFilters.organization.trim().toLowerCase();
    const stateFilter = normalizeStateCode(advancedFilters.stateCode);
    const modalityFilter = advancedFilters.modality.trim().toLowerCase();

    return savedSummaryCards.filter((card) => {
      const notice = card.notice;
      if (!notice) return false;

      if (orgFilter && !(notice.organization || '').toLowerCase().includes(orgFilter)) {
        return false;
      }

      const itemStateCode = getNoticeStateCode(notice);
      if (stateFilter && itemStateCode !== stateFilter) {
        return false;
      }

      if (modalityFilter && !(notice.modality || '').toLowerCase().includes(modalityFilter)) {
        return false;
      }

      return true;
    });
  }, [advancedFilters.modality, advancedFilters.organization, advancedFilters.stateCode, savedSummaryCards]);

  const summaries = useMemo(
    () => filteredSavedSummaryCards.map((card) => card.notice),
    [filteredSavedSummaryCards]
  );

  const selectedSavedSummaryCard = useMemo(
    () => filteredSavedSummaryCards.find((card) => card.id === selectedSavedSummaryId) || null,
    [filteredSavedSummaryCards, selectedSavedSummaryId]
  );

  const selectedSavedSummaryNotice = useMemo(
    () => selectedSavedSummaryCard?.notice || null,
    [selectedSavedSummaryCard]
  );

  const selectedSavedSummaryAnalysis = useMemo(
    () => selectedSavedSummaryCard?.analysisView || null,
    [selectedSavedSummaryCard]
  );

  const atas = useMemo(
    () => filteredNotices.filter((item) => item.type === 'ATA_REGISTRO_PRECOS'),
    [filteredNotices]
  );

  const documentationItems = useMemo(
    () => (Array.isArray(selectedNotice?.documentation) ? selectedNotice.documentation : []),
    [selectedNotice]
  );

  const filteredRepositoryDocuments = useMemo(() => {
    const term = repositorySearch.trim().toLowerCase();
    const rows = Array.isArray(repositoryDocuments) ? repositoryDocuments : [];
    if (!term) return rows;
    return rows.filter((item) => {
      const haystack = [
        item?.name,
        item?.category,
        item?.originalName,
        item?.createdByName
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [repositoryDocuments, repositorySearch]);

  const stats = useMemo(() => {
    const docsPending = filteredNotices.reduce((acc, item) => {
      const docs = normalizeArray(item.documentation);
      return acc + docs.filter((doc) => doc?.status !== 'CONCLUIDO').length;
    }, 0);

    const analysisDone = filteredNotices.filter((item) => !!item.aiAnalysis).length;
    const inProgress = filteredNotices.filter((item) => item.status === 'ANALISE_EM_ANDAMENTO').length;

    return {
      total: filteredNotices.length,
      analysisDone,
      atas: atas.length,
      docsPending,
      inProgress
    };
  }, [filteredNotices, atas.length]);

  const documentationStats = useMemo(() => {
    const rows = Array.isArray(repositoryDocuments) ? repositoryDocuments : [];
    const totals = rows.reduce(
      (acc, item) => {
        const validity = getRepositoryDocumentValidity(item?.expirationDate);
        if (validity.status === 'EXPIRED') {
          acc.expired += 1;
        } else if (validity.status === 'EXPIRING') {
          acc.expiring += 1;
        } else {
          acc.valid += 1;
        }
        return acc;
      },
      { valid: 0, expiring: 0, expired: 0 }
    );

    const total = rows.length;
    const completionRate = total > 0 ? Math.round((totals.valid / total) * 100) : 0;

    return {
      total,
      valid: totals.valid,
      expiring: totals.expiring,
      expired: totals.expired,
      completionRate,
      completed: totals.valid,
      pending: totals.expiring + totals.expired
    };
  }, [repositoryDocuments]);

  const advancedFilteredLeads = useMemo(() => {
    const orgFilter = advancedFilters.organization.trim().toLowerCase();
    const stateFilter = normalizeStateCode(advancedFilters.stateCode);
    const modalityFilter = advancedFilters.modality.trim().toLowerCase();

    return leads.filter((item) => {
      const orgText = [item?.name, item?.legalName].filter(Boolean).join(' ').toLowerCase();
      if (orgFilter && !orgText.includes(orgFilter)) {
        return false;
      }

      const itemStateCode = normalizeStateCode(item?.state);
      if (stateFilter && itemStateCode !== stateFilter) {
        return false;
      }

      if (modalityFilter) {
        const modalityText = [
          item?.segment,
          item?.marketSegment,
          item?.source,
          item?.name
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!modalityText.includes(modalityFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [advancedFilters.modality, advancedFilters.organization, advancedFilters.stateCode, leads]);

  const advancedFilteredOpportunities = useMemo(() => {
    const orgFilter = advancedFilters.organization.trim().toLowerCase();
    const stateFilter = normalizeStateCode(advancedFilters.stateCode);
    const modalityFilter = advancedFilters.modality.trim().toLowerCase();

    return opportunities.filter((item) => {
      const orgText = [item?.company?.name, item?.title].filter(Boolean).join(' ').toLowerCase();
      if (orgFilter && !orgText.includes(orgFilter)) {
        return false;
      }

      const itemStateCode = normalizeStateCode(item?.company?.state || item?.state);
      if (stateFilter && itemStateCode !== stateFilter) {
        return false;
      }

      if (modalityFilter) {
        const modalityText = [
          item?.title,
          item?.description,
          item?.company?.segment,
          item?.source
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!modalityText.includes(modalityFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [advancedFilters.modality, advancedFilters.organization, advancedFilters.stateCode, opportunities]);

  const filteredActivities = useMemo(() => {
    const orgFilter = advancedFilters.organization.trim().toLowerCase();
    const stateFilter = normalizeStateCode(advancedFilters.stateCode);
    const modalityFilter = advancedFilters.modality.trim().toLowerCase();

    return activities.filter((item) => {
      const isB2GActivity =
        String(item?.company?.clientType || '').toUpperCase() === 'B2G' ||
        Boolean(item?.opportunity?.b2gStage) ||
        String(item?.flow?.sourceArea || '').toUpperCase() === 'B2G' ||
        String(item?.flow?.targetArea || '').toUpperCase() === 'B2G';

      if (!isB2GActivity) {
        return false;
      }

      const orgText = [
        item?.company?.name,
        item?.opportunity?.company?.name,
        item?.subject
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (orgFilter && !orgText.includes(orgFilter)) {
        return false;
      }

      const itemStateCode = normalizeStateCode(
        item?.company?.state || item?.opportunity?.company?.state || item?.state
      );
      if (stateFilter && itemStateCode !== stateFilter) {
        return false;
      }

      if (modalityFilter) {
        const modalityText = [
          item?.subject,
          item?.description,
          item?.opportunity?.title
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!modalityText.includes(modalityFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [activities, advancedFilters.modality, advancedFilters.organization, advancedFilters.stateCode]);

  const opportunityStats = useMemo(() => {
    const total = advancedFilteredOpportunities.length;
    const won = advancedFilteredOpportunities.filter((item) => item?.stage === 'WON').length;
    const lost = advancedFilteredOpportunities.filter((item) => item?.stage === 'LOST').length;
    const totalValue = advancedFilteredOpportunities.reduce((sum, item) => sum + Number(item?.value || 0), 0);
    const wonValue = advancedFilteredOpportunities
      .filter((item) => item?.stage === 'WON')
      .reduce((sum, item) => sum + Number(item?.value || 0), 0);

    return {
      total,
      won,
      lost,
      totalValue,
      wonValue,
      conversionRate: total > 0 ? (won / total) * 100 : 0,
      avgTicket: total > 0 ? totalValue / total : 0
    };
  }, [advancedFilteredOpportunities]);

  const leadStats = useMemo(() => {
    const total = advancedFilteredLeads.length;
    const leadsCount = advancedFilteredLeads.filter((item) => item?.status === 'LEAD').length;
    const prospects = advancedFilteredLeads.filter((item) => item?.status === 'PROSPECT').length;
    const hot = advancedFilteredLeads.filter((item) => Number(item?.leadScore || 0) >= 80).length;
    return { total, leadsCount, prospects, hot };
  }, [advancedFilteredLeads]);

  const upcomingDeadlines = useMemo(() => {
    return filteredNotices
      .filter((item) => item?.proposalDueDate)
      .sort((a, b) => toTimestamp(a.proposalDueDate) - toTimestamp(b.proposalDueDate))
      .slice(0, 6);
  }, [filteredNotices]);

  const openActivities = useMemo(() => {
    return filteredActivities
      .filter((item) => item?.status !== 'COMPLETED' && item?.status !== 'CANCELLED')
      .sort((a, b) => toTimestamp(a.dueDate || a.createdAt) - toTimestamp(b.dueDate || b.createdAt));
  }, [filteredActivities]);

  const filteredLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase();
    if (!term) return advancedFilteredLeads;

    return advancedFilteredLeads.filter((item) => {
      const haystack = [
        item?.name,
        item?.segment,
        item?.city,
        item?.state,
        item?.status
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [advancedFilteredLeads, leadSearch]);

  const filteredOpportunities = useMemo(() => {
    const term = opportunitySearch.trim().toLowerCase();
    if (!term) return advancedFilteredOpportunities;

    return advancedFilteredOpportunities.filter((item) => {
      const haystack = [
        item?.title,
        item?.company?.name,
        item?.owner?.name,
        item?.stage
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [advancedFilteredOpportunities, opportunitySearch]);

  const selectedLeadAnalysis = useMemo(
    () => leads.find((item) => item.id === selectedLeadAnalysisId) || null,
    [leads, selectedLeadAnalysisId]
  );

  const sortedFilteredOpportunities = useMemo(() => {
    const rows = filteredOpportunities.slice();

    rows.sort((a, b) => {
      if (opportunitySortMode === 'value') {
        return Number(b?.value || 0) - Number(a?.value || 0);
      }
      return (
        Number(b?.probability || 0) - Number(a?.probability || 0) ||
        Number(b?.value || 0) - Number(a?.value || 0)
      );
    });

    return rows;
  }, [filteredOpportunities, opportunitySortMode]);

  const opportunityKanbanColumns = useMemo(() => {
    const base = KANBAN_COLUMNS.map((column) => ({ ...column, items: [] }));
    const byId = new Map(base.map((column) => [column.id, column]));

    sortedFilteredOpportunities.forEach((item) => {
      const columnId = resolveKanbanColumnId(item?.b2gStage || item?.stage);
      const bucket = byId.get(columnId) || byId.get('ANALISE');
      bucket.items.push(item);
    });

    return base;
  }, [sortedFilteredOpportunities]);

  const strategicByOrganization = useMemo(() => {
    const map = new Map();
    filteredNotices.forEach((item) => {
      const key = item?.organization || 'Órgão não informado';
      const prev = map.get(key) || { count: 0, value: 0 };
      map.set(key, {
        count: prev.count + 1,
        value: prev.value + Number(item?.estimatedValue || 0)
      });
    });

    return [...map.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredNotices]);

  const stageDistribution = useMemo(() => {
    const map = new Map();
    sortedFilteredOpportunities.forEach((item) => {
      const stage = item?.stage || 'LEAD';
      const prev = map.get(stage) || { count: 0, value: 0 };
      map.set(stage, {
        count: prev.count + 1,
        value: prev.value + Number(item?.value || 0)
      });
    });

    return [...map.entries()]
      .map(([stage, data]) => ({ stage, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [sortedFilteredOpportunities]);

  const historicalOutcomeOpportunities = useMemo(() => {
    return advancedFilteredOpportunities
      .filter((item) => HISTORICAL_OUTCOME_IDS.has(resolveKanbanColumnId(item?.b2gStage || item?.stage)))
      .sort(
        (a, b) =>
          toTimestamp(b?.actualCloseDate || b?.updatedAt || b?.createdAt) -
          toTimestamp(a?.actualCloseDate || a?.updatedAt || a?.createdAt)
      );
  }, [advancedFilteredOpportunities]);

  const historicalNoGoCount = useMemo(
    () =>
      historicalOutcomeOpportunities.filter(
        (item) => resolveKanbanColumnId(item?.b2gStage || item?.stage) === 'NO_GO'
      ).length,
    [historicalOutcomeOpportunities]
  );

  const historicalLostCount = useMemo(
    () =>
      historicalOutcomeOpportunities.filter(
        (item) => resolveKanbanColumnId(item?.b2gStage || item?.stage) === 'PERDIDO'
      ).length,
    [historicalOutcomeOpportunities]
  );

  const historicalWonCount = useMemo(
    () =>
      historicalOutcomeOpportunities.filter(
        (item) => resolveKanbanColumnId(item?.b2gStage || item?.stage) === 'GANHO'
      ).length,
    [historicalOutcomeOpportunities]
  );

  const leadRegionalCoverage = useMemo(
    () => new Set(filteredLeads.map((item) => normalizeStateCode(item?.state)).filter(Boolean)).size,
    [filteredLeads]
  );

  const openOpportunitiesCount = useMemo(
    () =>
      filteredOpportunities.filter((item) => !['WON', 'LOST'].includes(item?.stage)).length,
    [filteredOpportunities]
  );

  const highProbabilityOpportunities = useMemo(
    () => filteredOpportunities.filter((item) => Number(item?.probability || 0) >= 70).length,
    [filteredOpportunities]
  );

  const activitiesStats = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const openRows = filteredActivities.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item?.status));
    const overdue = openRows.filter((item) => {
      const due = toTimestamp(item?.dueDate);
      return due > 0 && due < now;
    }).length;
    const dueSoon = openRows.filter((item) => {
      const due = toTimestamp(item?.dueDate);
      return due >= now && due <= now + sevenDays;
    }).length;

    return {
      total: filteredActivities.length,
      open: openRows.length,
      overdue,
      dueSoon
    };
  }, [filteredActivities]);

  const activitiesByStatus = useMemo(() => {
    return ACTIVITY_KANBAN_STATUS.reduce((acc, status) => {
      acc[status] = filteredActivities
        .filter((item) => item.status === status)
        .slice()
        .sort((a, b) => toTimestamp(b.createdAt || b.dueDate) - toTimestamp(a.createdAt || a.dueDate));
      return acc;
    }, {});
  }, [filteredActivities]);

  const atasStats = useMemo(() => {
    const active = atas.filter((item) => !['ENCERRADA', 'SUSPENSA'].includes(item?.status)).length;
    const sent = atas.filter((item) => item?.status === 'ENVIADA').length;
    const inProgress = atas.filter((item) => item?.status === 'ANALISE_EM_ANDAMENTO').length;
    return { total: atas.length, active, sent, inProgress };
  }, [atas]);

  const summaryCoverage = useMemo(() => {
    if (filteredNotices.length === 0) return 0;
    return Math.round((summaries.length / filteredNotices.length) * 100);
  }, [filteredNotices.length, summaries.length]);

  const analyzedNotices = useMemo(
    () => filteredNotices.filter((item) => item?.aiAnalysis && typeof item.aiAnalysis === 'object'),
    [filteredNotices]
  );

  const nonConformTRCount = useMemo(
    () =>
      analyzedNotices.filter((item) => {
        if (item?.type !== 'TERMO_REFERENCIA') return false;
        const recommendation = String(item?.aiAnalysis?.recomendacao || '').toUpperCase();
        const score = Number(item?.aiAnalysis?.scoreAderencia || 0);
        return recommendation === 'NO_GO' || score < 55;
      }).length,
    [analyzedNotices]
  );

  const analysisTimeSavedHours = useMemo(() => {
    const base = analyzedNotices.length * 2;
    const extra = nonConformTRCount;
    return Math.max(base + extra, 0);
  }, [analyzedNotices.length, nonConformTRCount]);

  const dashboardSourceOpportunities = useMemo(() => {
    const periodDays = Math.max(Number(dashboardPeriod) || 30, 1);
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;

    return opportunities.filter((item) => {
      const timestamp = toTimestamp(item?.createdAt || item?.updatedAt);
      return timestamp <= 0 || timestamp >= cutoff;
    });
  }, [dashboardPeriod, opportunities]);

  const dashboardOpportunities = useMemo(() => {
    return dashboardSourceOpportunities.map((item) => {
      const columnId = resolveKanbanColumnId(item?.b2gStage || item?.stage);
      const probability = clampScore(item?.probability);
      const financials = getB2GOpportunityFinancials(item);
      const organization =
        item?.company?.name ||
        item?.organization ||
        item?.accountName ||
        'Órgão não informado';
      const title = item?.title || item?.name || 'Edital sem título';

      return {
        ...item,
        __columnId: columnId,
        __stageLabel: KANBAN_COLUMN_LABELS[columnId] || OPPORTUNITY_STAGE_LABELS[item?.stage] || 'Análise',
        __temperatureBand: getTemperatureBand(probability),
        __probability: probability,
        __value: financials.totalValue,
        __monthlyValue: financials.monthlyValue,
        __punctualValue: financials.oneTimeValue,
        __contractMonths: financials.contractMonths,
        __isMonthly: financials.isMonthly,
        __organization: organization,
        __title: title
      };
    });
  }, [dashboardSourceOpportunities]);

  const dashboardFilteredOpportunities = useMemo(() => {
    return dashboardOpportunities.filter((item) => {
      if (dashboardTemperatureFilter !== 'ALL' && item.__temperatureBand !== Number(dashboardTemperatureFilter)) {
        return false;
      }
      if (dashboardPhaseFilter !== 'ALL' && item.__columnId !== dashboardPhaseFilter) {
        return false;
      }
      if (dashboardOwnerFilter !== 'ALL' && item.ownerId !== dashboardOwnerFilter) {
        return false;
      }
      return true;
    });
  }, [dashboardOpportunities, dashboardPhaseFilter, dashboardTemperatureFilter, dashboardOwnerFilter]);

  const dashboardTotals = useMemo(() => {
    let pipelineValue = 0;
    let monthlyValue = 0;
    let punctualValue = 0;
    let projectedValue = 0;
    let openValue = 0;
    let wonValue = 0;
    let lostValue = 0;
    let openCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let goCount = 0;

    dashboardFilteredOpportunities.forEach((item) => {
      const value = item.__value;
      const probability = item.__probability;
      const columnId = item.__columnId;
      const projectType = item.__isMonthly ? 'MONTHLY' : (item?.projectType || 'SINGLE');
      const monthlyPart = item.__monthlyValue || (projectType === 'MONTHLY' ? (value / item.__contractMonths) : value);

      pipelineValue += value;
      projectedValue += value * (probability / 100);

      if (projectType === 'MONTHLY') {
        monthlyValue += monthlyPart;
        punctualValue += item.__punctualValue || 0;
      } else {
        punctualValue += value;
      }

      if (columnId === 'GANHO') {
        wonValue += value;
        wonCount += 1;
      } else if (columnId === 'PERDIDO' || columnId === 'NO_GO') {
        lostValue += value;
        lostCount += 1;
      } else {
        openValue += value;
        openCount += 1;
        if (probability >= 70) {
          goCount += 1;
        }
      }
    });

    const totalCount = dashboardFilteredOpportunities.length;
    const fallbackMonthlyValue = monthlyValue > 0 ? monthlyValue : wonValue;

    return {
      pipelineValue,
      monthlyValue: fallbackMonthlyValue,
      punctualValue: Math.max(punctualValue, 0),
      projectedValue,
      openValue,
      wonValue,
      lostValue,
      openCount,
      wonCount,
      lostCount,
      goCount,
      totalCount,
      winRate: (wonCount + lostCount) > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0
    };
  }, [dashboardFilteredOpportunities]);

  const dashboardForecastScore = useMemo(() => {
    if (dashboardFilteredOpportunities.length === 0) return 0;
    const avg =
      dashboardFilteredOpportunities.reduce((sum, item) => sum + item.__probability, 0) /
      dashboardFilteredOpportunities.length;
    return clampScore(avg);
  }, [dashboardFilteredOpportunities]);

  const dashboardFunnelRows = useMemo(() => {
    return DASHBOARD_FUNNEL_META.map((meta) => {
      const rows = dashboardFilteredOpportunities.filter((item) => item.__columnId === meta.id);
      return {
        ...meta,
        count: rows.length,
        value: rows.reduce((sum, item) => sum + item.__value, 0)
      };
    });
  }, [dashboardFilteredOpportunities]);

  const dashboardProjectionBars = useMemo(
    () => [
      { key: 'open', label: 'Em aberto', value: dashboardTotals.openValue, color: '#37c6df' },
      { key: 'won', label: 'Ganhas', value: dashboardTotals.wonValue, color: '#36d483' },
      { key: 'lost', label: 'Perdidas', value: dashboardTotals.lostValue, color: '#f3ab1c' },
      { key: 'proj', label: 'Projeção', value: dashboardTotals.projectedValue, color: '#9d5eff' }
    ],
    [dashboardTotals]
  );

  const dashboardProjectionMax = useMemo(() => {
    const max = Math.max(...dashboardProjectionBars.map((item) => Number(item.value || 0)), 0);
    return max > 0 ? max : 1;
  }, [dashboardProjectionBars]);

  const dashboardProbabilityLevels = useMemo(() => {
    return DASHBOARD_PROBABILITY_LEVELS.map((level) => {
      const rows = dashboardFilteredOpportunities.filter((item) => (
        item.__probability >= level.min && item.__probability <= level.max
      ));
      return {
        ...level,
        count: rows.length,
        value: rows.reduce((sum, item) => sum + item.__value, 0)
      };
    });
  }, [dashboardFilteredOpportunities]);

  const dashboardProbabilitySummary = useMemo(() => {
    const probabilities = dashboardFilteredOpportunities
      .map((item) => item.__probability)
      .sort((a, b) => a - b);
    const totalOpps = probabilities.length;
    const avg =
      totalOpps > 0
        ? probabilities.reduce((sum, value) => sum + value, 0) / totalOpps
        : 0;
    const median =
      totalOpps === 0
        ? 0
        : totalOpps % 2 === 0
          ? (probabilities[totalOpps / 2 - 1] + probabilities[totalOpps / 2]) / 2
          : probabilities[Math.floor(totalOpps / 2)];
    const highConfidence = dashboardFilteredOpportunities.filter((item) => item.__probability >= 75).length;
    const lowConfidence = dashboardFilteredOpportunities.filter((item) => item.__probability <= 25).length;
    const totalValue = dashboardFilteredOpportunities.reduce((sum, item) => sum + item.__value, 0);
    return {
      totalOpps,
      avg,
      median,
      highConfidence,
      lowConfidence,
      totalValue
    };
  }, [dashboardFilteredOpportunities]);

  const dashboardPhaseOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Todas as fases' },
      ...DASHBOARD_FUNNEL_META.map((item) => ({ value: item.id, label: item.label }))
    ],
    []
  );

  const dashboardTemperatureRows = dashboardFilteredOpportunities;

  const dashboardTemperatureStats = useMemo(() => {
    const total = dashboardTemperatureRows.length;
    const totalValue = dashboardTemperatureRows.reduce((sum, item) => sum + item.__value, 0);
    const avgTicket = total > 0 ? totalValue / total : 0;
    const biggest = dashboardTemperatureRows.reduce(
      (max, item) => (item.__value > (max?.__value || 0) ? item : max),
      null
    );
    return {
      total,
      totalValue,
      avgTicket,
      biggestValue: biggest?.__value || 0
    };
  }, [dashboardTemperatureRows]);

  const dashboardTopEditais = useMemo(() => {
    return dashboardTemperatureRows
      .slice()
      .sort((a, b) => b.__value - a.__value)
      .slice(0, 6);
  }, [dashboardTemperatureRows]);

  const dashboardTopEditaisMaxValue = useMemo(() => {
    const max = Math.max(...dashboardTopEditais.map((item) => Number(item.__value || 0)), 0);
    return max > 0 ? max : 1;
  }, [dashboardTopEditais]);

  const dashboardStageValueRows = useMemo(() => {
    return DASHBOARD_FUNNEL_META.map((meta) => {
      const value = dashboardTemperatureRows
        .filter((item) => item.__columnId === meta.id)
        .reduce((sum, item) => sum + item.__value, 0);
      return {
        id: meta.id,
        label: meta.label,
        value
      };
    });
  }, [dashboardTemperatureRows]);

  const dashboardStageValueMax = useMemo(() => {
    const max = Math.max(...dashboardStageValueRows.map((item) => Number(item.value || 0)), 0);
    return max > 0 ? max : 1;
  }, [dashboardStageValueRows]);

  const monthlyProjectData = useMemo(() => {
    const byMonth = {};
    const projectSet = new Set();
    const topN = 6;

    dashboardFilteredOpportunities.forEach((item) => {
      const date = parseFlexibleDate(item.createdAt);
      if (!date) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const project = item.__organization || 'Não identificado';
      const totalValue = Number(item.__value) || 0;
      const projectType = item.__isMonthly ? 'MONTHLY' : (item?.projectType || 'SINGLE');
      const monthlyPart = item.__monthlyValue || (projectType === 'MONTHLY' ? (totalValue / item.__contractMonths) : totalValue);

      if (!byMonth[monthKey]) byMonth[monthKey] = {};
      if (!byMonth[monthKey][project]) byMonth[monthKey][project] = 0;
      byMonth[monthKey][project] += monthlyPart;
      projectSet.add(project);
    });

    const projectTotals = [];
    projectSet.forEach((project) => {
      let total = 0;
      Object.values(byMonth).forEach((month) => { total += month[project] || 0; });
      projectTotals.push({ project, total });
    });

    const topProjects = new Set(
      projectTotals
        .sort((a, b) => b.total - a.total)
        .slice(0, topN)
        .map((p) => p.project)
    );

    const months = Object.keys(byMonth).sort();

    const palette = [
      '#49c5ff', '#6de0a0', '#f8b525', '#9164ff', '#f56b88',
      '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#22d3ee'
    ];

    const datasets = [];
    let colorIndex = 0;
    topProjects.forEach((project) => {
      datasets.push({
        label: project,
        data: months.map((month) => byMonth[month][project] || 0),
        backgroundColor: palette[colorIndex % palette.length],
        borderRadius: 4,
        borderSkipped: false
      });
      colorIndex += 1;
    });

    return { months, datasets };
  }, [dashboardFilteredOpportunities]);

  const dashboardCriticalDeadlines = useMemo(() => {
    return filteredNotices
      .filter((item) => {
        const remaining = daysUntilFlexible(item?.proposalDueDate);
        return remaining !== null && remaining >= 0 && remaining <= 7;
      })
      .sort((a, b) => toTimestamp(a?.proposalDueDate) - toTimestamp(b?.proposalDueDate))
      .slice(0, 5);
  }, [filteredNotices]);

  const dashboardRecentResults = useMemo(() => {
    return historicalOutcomeOpportunities.slice(0, 4).map((item) => {
      const columnId = resolveKanbanColumnId(item?.b2gStage || item?.stage);
      return {
        ...item,
        __columnId: columnId,
        __value: Number(item?.value || 0)
      };
    });
  }, [historicalOutcomeOpportunities]);

  const dashboardSlaStats = useMemo(() => {
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    const in48h = now + 48 * 60 * 60 * 1000;
    const openRows = openActivities;

    let overdue = 0;
    let due24h = 0;
    let due48h = 0;
    let inReview = 0;

    openRows.forEach((item) => {
      if (item?.status === 'IN_PROGRESS') {
        inReview += 1;
      }

      const due = toTimestamp(item?.dueDate);
      if (!due) return;

      if (due < now) {
        overdue += 1;
      } else if (due <= in24h) {
        due24h += 1;
      } else if (due <= in48h) {
        due48h += 1;
      }
    });

    return {
      open: openRows.length,
      overdue,
      due24h,
      due48h,
      inReview
    };
  }, [openActivities]);

  const dashboardCriticalActivity = useMemo(() => {
    const now = Date.now();
    const soonLimit = now + 48 * 60 * 60 * 1000;
    return openActivities.find((item) => {
      const due = toTimestamp(item?.dueDate);
      return due > 0 && due <= soonLimit;
    }) || null;
  }, [openActivities]);

  const loadNotices = async ({ preserveSelection = true } = {}) => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/b2g/editais'), { headers: getAuthHeaders() });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json().catch(() => []);
      const rows = Array.isArray(data) ? data : [];
      setNotices(rows);

      if (rows.length === 0) {
        setSelectedNoticeId('');
        return;
      }

      if (!preserveSelection || !rows.some((item) => item.id === selectedNoticeId)) {
        setSelectedNoticeId(rows[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar editais B2G:', error);
      setFeedback({ type: 'error', message: 'Não foi possível carregar os editais B2G.' });
    } finally {
      setLoading(false);
    }
  };

  const refreshB2GOpportunities = async () => {
    const requestId = b2gOpportunityRequestRef.current + 1;
    b2gOpportunityRequestRef.current = requestId;

    try {
      const response = await fetch(buildApiUrl('/opportunities?clientType=B2G'), {
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json().catch(() => []);
      const rows = Array.isArray(data) ? data : [];
      if (requestId === b2gOpportunityRequestRef.current) {
        setOpportunities(
          rows.filter((item) => isOpportunityInClientType(item, 'B2G', item?.company || null))
        );
      }
    } catch (error) {
      console.error('Erro ao sincronizar oportunidades B2G:', error);
    }
  };

  const loadSupportData = async () => {
    try {
      setSupportLoading(true);
      const [companiesRes, , activitiesRes] = await Promise.all([
        fetch(buildApiUrl('/companies?clientType=B2G'), { headers: getAuthHeaders() }),
        refreshB2GOpportunities(),
        fetch(buildApiUrl('/activities-simple?clientType=B2G'), { headers: getAuthHeaders() })
      ]);

      if (companiesRes.ok) {
        const companiesData = await companiesRes.json().catch(() => []);
        const companiesRows = Array.isArray(companiesData) ? companiesData : [];
        setLeads(companiesRows.filter((item) => isCompanyInClientType(item, 'B2G')));
      } else {
        setLeads([]);
      }

      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json().catch(() => []);
        setActivities(Array.isArray(activitiesData) ? activitiesData.map(hydrateActivityFlow) : []);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados complementares B2G:', error);
      setLeads([]);
      setActivities([]);
    } finally {
      setSupportLoading(false);
    }
  };

  const loadOpportunityOpeningAlerts = async () => {
    try {
      setOpportunityOpeningAlertsLoading(true);
      const response = await fetch(buildApiUrl('/b2g/oportunidades/alertas/abertura'), {
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao carregar alertas de abertura.');
      }
      setOpportunityOpeningAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
    } catch (error) {
      console.error('Erro ao carregar alertas de abertura B2G:', error);
      setOpportunityOpeningAlerts([]);
    } finally {
      setOpportunityOpeningAlertsLoading(false);
    }
  };

  const loadRepositoryDocuments = async () => {
    try {
      setRepositoryDocumentsLoading(true);
      const response = await fetch(buildApiUrl('/b2g/documentos'), {
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao carregar repositório de documentos.');
      }
      setRepositoryDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar repositório documental B2G:', error);
      setRepositoryDocuments([]);
      if (activeTab === 'documentacao') {
        setFeedback({
          type: 'error',
          message: error.message || 'Não foi possível carregar os documentos do repositório.'
        });
      }
    } finally {
      setRepositoryDocumentsLoading(false);
    }
  };

  const resetRepositoryForm = () => {
    setRepositoryForm(INITIAL_B2G_REPOSITORY_FORM);
    setRepositoryUploadFile(null);
    if (repositoryFileInputRef.current) {
      repositoryFileInputRef.current.value = '';
    }
  };

  const handleOpenRepositoryModal = () => {
    setRepositoryModalOpen(true);
  };

  const handleCloseRepositoryModal = () => {
    if (uploadingRepositoryDocument) return;
    setRepositoryModalOpen(false);
    resetRepositoryForm();
  };

  const handlePickRepositoryFile = () => {
    repositoryFileInputRef.current?.click();
  };

  const handleSelectRepositoryFile = (event) => {
    const file = event.target.files?.[0] || null;
    setRepositoryUploadFile(file);
    if (file && !repositoryForm.name.trim()) {
      const base = String(file.name || '').replace(/\.[^.]+$/, '').trim();
      if (base) {
        setRepositoryForm((prev) => ({ ...prev, name: base }));
      }
    }
  };

  const handleUploadRepositoryDocument = async (event) => {
    event.preventDefault();
    if (!repositoryUploadFile) {
      setFeedback({ type: 'error', message: 'Selecione um arquivo PDF, DOC ou DOCX.' });
      return;
    }

    const extension = String(repositoryUploadFile.name || '')
      .toLowerCase()
      .split('.')
      .pop();
    if (!['pdf', 'doc', 'docx'].includes(extension)) {
      setFeedback({ type: 'error', message: 'Formato inválido. Use PDF, DOC ou DOCX.' });
      return;
    }

    try {
      setUploadingRepositoryDocument(true);
      const formData = new FormData();
      formData.append('file', repositoryUploadFile);
      formData.append('name', repositoryForm.name.trim());
      formData.append('category', repositoryForm.category);
      if (repositoryForm.expirationDate) {
        formData.append('expirationDate', repositoryForm.expirationDate);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/b2g/documentos/upload'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao enviar documento.');
      }

      setFeedback({ type: 'success', message: 'Documento enviado para o repositório B2G.' });
      setRepositoryModalOpen(false);
      resetRepositoryForm();
      await loadRepositoryDocuments();
    } catch (error) {
      console.error('Erro ao enviar documento B2G:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao enviar documento.' });
    } finally {
      setUploadingRepositoryDocument(false);
    }
  };

  const fetchDocumentBlob = async (endpoint) => {
    const response = await fetch(buildApiUrl(endpoint), {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'Falha ao acessar documento.');
    }
    return response.blob();
  };

  const handleViewRepositoryDocument = async (item) => {
    if (!item?.id) return;
    try {
      setViewingRepositoryDocumentId(item.id);
      const blob = await fetchDocumentBlob(`/b2g/documentos/${item.id}/view`);
      const objectUrl = URL.createObjectURL(blob);
      const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        URL.revokeObjectURL(objectUrl);
        throw new Error('Não foi possível abrir nova aba para visualizar o documento.');
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      console.error('Erro ao visualizar documento:', error);
      setFeedback({ type: 'error', message: error.message || 'Falha ao visualizar documento.' });
    } finally {
      setViewingRepositoryDocumentId('');
    }
  };

  const handleDownloadRepositoryDocument = async (item) => {
    if (!item?.id) return;
    try {
      setDownloadingRepositoryDocumentId(item.id);
      const blob = await fetchDocumentBlob(`/b2g/documentos/${item.id}/download`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = item.originalName || item.name || `documento-${item.id}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Erro ao baixar documento:', error);
      setFeedback({ type: 'error', message: error.message || 'Falha ao baixar documento.' });
    } finally {
      setDownloadingRepositoryDocumentId('');
    }
  };

  const handleDeleteRepositoryDocument = async (item) => {
    if (!item?.id) return;
    if (!window.confirm(`Excluir o documento "${item.name}"?`)) return;

    try {
      setDeletingRepositoryDocumentId(item.id);
      const response = await fetch(buildApiUrl(`/b2g/documentos/${item.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao excluir documento.');
      }
      setFeedback({ type: 'success', message: 'Documento removido do repositório.' });
      await loadRepositoryDocuments();
    } catch (error) {
      console.error('Erro ao remover documento B2G:', error);
      setFeedback({ type: 'error', message: error.message || 'Falha ao remover documento.' });
    } finally {
      setDeletingRepositoryDocumentId('');
    }
  };

  const handleExportRepositoryKit = async () => {
    try {
      const response = await fetch(buildApiUrl('/b2g/documentos/export-kit'), {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao exportar kit documental.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `kit-documentacao-b2g-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Erro ao exportar kit documental B2G:', error);
      setFeedback({ type: 'error', message: error.message || 'Falha ao exportar kit documental.' });
    }
  };

  const loadSavedSummaries = async ({ preserveSelection = true } = {}) => {
    const scope = resolveSavedAnalysisScope();
    if (!scope) {
      setSavedSummaryRecords([]);
      setSelectedSavedSummaryId('');
      return;
    }

    try {
      setSavedSummariesLoading(true);
      const response = await fetch(buildApiUrl('/analyses/saved'), {
        headers: {
          ...getAuthHeaders(),
          'x-company-id': scope.companyId,
          'x-user-id': scope.userId,
          'x-user-role': scope.userRole
        }
      });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.message || 'Não foi possível carregar os resumos salvos.');
      }

      const rows = Array.isArray(data) ? data : [];
      setSavedSummaryRecords(rows);

      if (rows.length === 0) {
        setSelectedSavedSummaryId('');
        return;
      }

      if (!preserveSelection || !rows.some((item) => String(item.id) === selectedSavedSummaryId)) {
        setSelectedSavedSummaryId(String(rows[0].id));
      }
    } catch (error) {
      console.error('Erro ao carregar resumos salvos:', error);
      setSavedSummaryRecords([]);
      if (activeTab === 'resumos' || activeTab === 'analise') {
        setFeedback({
          type: 'error',
          message: error.message || 'Falha ao carregar os resumos salvos.'
        });
      }
    } finally {
      setSavedSummariesLoading(false);
    }
  };

  const refreshAll = async () => {
    setFeedback({ type: '', message: '' });
    await Promise.all([
      loadNotices({ preserveSelection: true }),
      loadSupportData(),
      loadRepositoryDocuments(),
      loadSavedSummaries({ preserveSelection: true })
    ]);

    if (selectedNoticeId) {
      await loadHistory(selectedNoticeId);
    }
  };

  const loadHistory = async (noticeId) => {
    if (!noticeId) {
      setHistory([]);
      return;
    }

    try {
      setHistoryLoading(true);
      const response = await fetch(buildApiUrl(`/b2g/editais/${noticeId}/historico`), {
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => []);
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      loadNotices({ preserveSelection: true }),
      loadSupportData(),
      loadRepositoryDocuments(),
      loadSavedSummaries({ preserveSelection: true })
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== 'dashboard') return undefined;

    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshB2GOpportunities();
    };

    refreshB2GOpportunities();
    const intervalId = window.setInterval(refreshB2GOpportunities, 30000);
    window.addEventListener('focus', refreshB2GOpportunities);
    document.addEventListener('visibilitychange', syncWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshB2GOpportunities);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'dashboard' && activeTab !== 'oportunidades') return undefined;

    loadOpportunityOpeningAlerts();
    const intervalId = window.setInterval(loadOpportunityOpeningAlerts, 60000);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (selectedNoticeId) {
      loadHistory(selectedNoticeId);
    } else {
      setHistory([]);
    }
  }, [selectedNoticeId]);

  useEffect(() => {
    if (!noticeIdFromQuery) return;
    if (notices.some((item) => item.id === noticeIdFromQuery)) {
      setSelectedNoticeId(noticeIdFromQuery);
    }
  }, [noticeIdFromQuery, notices]);

  useEffect(() => {
    if (filteredNotices.length === 0) {
      if (selectedNoticeId) {
        setSelectedNoticeId('');
      }
      return;
    }

    if (!filteredNotices.some((item) => item.id === selectedNoticeId)) {
      setSelectedNoticeId(filteredNotices[0].id);
    }
  }, [filteredNotices, selectedNoticeId]);

  useEffect(() => {
    if (filteredSavedSummaryCards.length === 0) {
      if (selectedSavedSummaryId) {
        setSelectedSavedSummaryId('');
      }
      return;
    }

    if (!filteredSavedSummaryCards.some((item) => item.id === selectedSavedSummaryId)) {
      setSelectedSavedSummaryId(filteredSavedSummaryCards[0].id);
    }
  }, [filteredSavedSummaryCards, selectedSavedSummaryId]);

  useEffect(() => {
    setAnalysisDetailTab('GERAL');
  }, [selectedNoticeId]);

  useEffect(() => {
    if (selectedSavedSummaryId) {
      setAnalysisDetailTab('GERAL');
    }
  }, [selectedSavedSummaryId]);

  useEffect(() => {
    if (activeTab !== 'resumos' && savedSummaryModalOpen) {
      setSavedSummaryModalOpen(false);
    }
  }, [activeTab, savedSummaryModalOpen]);

  const handleCreateNotice = async (event) => {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!form.title.trim() || !form.organization.trim()) {
      setFeedback({ type: 'error', message: 'Preencha ao menos Título e Órgão.' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        type: form.type,
        title: form.title.trim(),
        referenceCode: form.referenceCode.trim(),
        organization: form.organization.trim(),
        stateCode: normalizeStateCode(form.stateCode),
        modality: form.modality.trim(),
        objectDescription: form.objectDescription.trim(),
        estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue),
        openingDate: form.openingDate || null,
        proposalDueDate: form.proposalDueDate || null,
        sourceUrl: form.sourceUrl.trim(),
        tags: form.tags
      };

      if (form.documentText.trim()) {
        payload.documentText = form.documentText.trim();
      }

      const response = await fetch(buildApiUrl('/b2g/editais'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao cadastrar edital.');
      }

      setForm(INITIAL_FORM);
      setFeedback({ type: 'success', message: form.type === 'ATA_REGISTRO_PRECOS' ? 'ATA cadastrada com sucesso.' : 'Edital/TR cadastrado com sucesso.' });
      if (form.type === 'ATA_REGISTRO_PRECOS') setShowAtaModal(false);

      await loadNotices({ preserveSelection: false });
      if (data?.id) setSelectedNoticeId(data.id);
    } catch (error) {
      console.error('Erro ao criar edital:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao cadastrar edital.' });
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedNotice = async (patch, changeNote = '') => {
    if (!selectedNotice) return null;

    const response = await fetch(buildApiUrl(`/b2g/editais/${selectedNotice.id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...patch, changeNote })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Falha ao atualizar edital.');
    }

    setNotices((prev) => prev.map((item) => (item.id === data.id ? data : item)));
    await loadHistory(selectedNotice.id);
    return data;
  };

  const handleStatusChange = async (nextStatus) => {
    try {
      setFeedback({ type: '', message: '' });
      await updateSelectedNotice(
        { status: nextStatus },
        `Status alterado para ${labelFrom(STATUS_OPTIONS, nextStatus, nextStatus)}.`
      );
      setFeedback({ type: 'success', message: 'Status atualizado.' });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao atualizar status.' });
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedNotice) return;

    try {
      setAnalyzing(true);
      setFeedback({ type: '', message: '' });
      const response = await fetch(buildApiUrl(`/b2g/editais/${selectedNotice.id}/analisar`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ instruction: analysisInstruction })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao executar análise.');
      }

      if (data?.notice) {
        setNotices((prev) => prev.map((item) => (item.id === data.notice.id ? data.notice : item)));
      } else {
        await loadNotices({ preserveSelection: true });
      }

      await loadHistory(selectedNotice.id);
      setFeedback({ type: 'success', message: 'Análise de Edital/TR executada com IA.' });
    } catch (error) {
      console.error('Erro ao analisar edital:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao analisar edital.' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddDocumentation = async (event) => {
    event.preventDefault();
    if (!selectedNotice) return;
    if (!docForm.name.trim()) {
      setFeedback({ type: 'error', message: 'Informe o nome do documento.' });
      return;
    }

    try {
      const nextDocs = [
        ...documentationItems,
        {
          id: `doc_${Date.now()}`,
          name: docForm.name.trim(),
          required: docForm.required,
          status: 'PENDENTE',
          notes: docForm.notes.trim()
        }
      ];

      await updateSelectedNotice(
        { documentation: nextDocs },
        `Documento "${docForm.name.trim()}" adicionado ao checklist.`
      );
      setDocForm(INITIAL_DOC_FORM);
      setFeedback({ type: 'success', message: 'Checklist de documentação atualizado.' });
    } catch (error) {
      console.error('Erro ao adicionar documento:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao atualizar documentação.' });
    }
  };

  const handleUpdateDocumentation = async (docId, patch) => {
    if (!selectedNotice) return;

    try {
      const nextDocs = documentationItems.map((item) =>
        item.id === docId ? { ...item, ...patch } : item
      );
      await updateSelectedNotice({ documentation: nextDocs }, 'Checklist de documentação atualizado.');
    } catch (error) {
      console.error('Erro ao atualizar documentação:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao atualizar documentação.' });
    }
  };

  const handleRemoveDocumentation = async (docId) => {
    if (!selectedNotice) return;

    try {
      const nextDocs = documentationItems.filter((item) => item.id !== docId);
      await updateSelectedNotice({ documentation: nextDocs }, 'Documento removido do checklist.');
      setFeedback({ type: 'success', message: 'Documento removido.' });
    } catch (error) {
      console.error('Erro ao remover documento:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao remover documento.' });
    }
  };

  const openNoticeAnalysis = (noticeId) => {
    if (!noticeId) {
      navigate('/b2g-analise');
      return;
    }
    navigate(`/b2g-analise?noticeId=${encodeURIComponent(noticeId)}`);
  };

  const handlePickAnalysisFile = () => {
    analysisFileInputRef.current?.click();
  };

  const handleSelectAnalysisFile = (event) => {
    const file = event.target.files?.[0] || null;
    setAnalysisFile(file);
  };

  const fileToDataUri = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
          resolve(reader.result);
          return;
        }
        reject(new Error('Falha ao converter arquivo para Data URI.'));
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo para análise.'));
      reader.readAsDataURL(file);
    });

  const handleAnalyzeSelectedFile = async () => {
    if (!analysisFile) {
      setFeedback({ type: 'error', message: 'Selecione um arquivo PDF para análise.' });
      return;
    }

    if (analysisFile.size > 20 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Arquivo acima de 20MB. Selecione um PDF menor.' });
      return;
    }

    const isPdfMime = String(analysisFile.type || '').toLowerCase().includes('pdf');
    const isPdfName = String(analysisFile.name || '').toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfName) {
      setFeedback({ type: 'error', message: 'Formato inválido. Envie um arquivo PDF.' });
      return;
    }

    setFeedback({ type: '', message: '' });
    setAnalyzing(true);

    try {
      const shouldRunInlineAi = analysisFile.size <= MAX_INLINE_AI_UPLOAD_BYTES;
      let aiData = null;
      let fileDataUri = '';
      let aiFallbackReason = '';

      if (shouldRunInlineAi) {
        try {
          fileDataUri = await fileToDataUri(analysisFile);
          const aiEndpoint = analysisMode === 'TR' ? '/ai-analysis/tr' : '/ai-analysis/edital';
          const aiPayload =
            analysisMode === 'TR'
              ? {
                  fileDataUri,
                  analyzedModelName: selectedNotice?.title || analysisFile.name.replace(/\.pdf$/i, ''),
                  analyzedModelManufacturer: '',
                  analyzedModelSpecs:
                    analysisInstruction?.trim() || 'Especificações do modelo não informadas pelo usuário.'
                }
              : { fileDataUri };

          const aiResponse = await fetch(buildApiUrl(aiEndpoint), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(aiPayload)
          });
          const aiResponseData = await aiResponse.json().catch(() => ({}));
          if (!aiResponse.ok) {
            throw new Error(aiResponseData?.message || 'Falha na análise AI de edital/TR.');
          }

          aiData =
            aiResponseData && typeof aiResponseData === 'object' && !Array.isArray(aiResponseData)
              ? aiResponseData
              : null;
        } catch (aiError) {
          aiFallbackReason =
            (aiError instanceof Error ? aiError.message : String(aiError || '')).trim() ||
            'Falha ao executar análise de IA.';
          aiData = null;
          console.warn('Falha na análise inline de IA. Seguindo com fluxo local em /b2g/analisar-arquivo.', aiError);
        }
      } else {
        aiFallbackReason = 'Arquivo acima de 3MB para análise inline de IA.';
      }

      let savedHistory = false;
      const scope = resolveSavedAnalysisScope();
      if (scope && aiData && fileDataUri) {
        const saveResponse = await fetch(buildApiUrl('/analyses/saved'), {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'x-company-id': scope.companyId,
            'x-user-id': scope.userId,
            'x-user-role': scope.userRole
          },
          body: JSON.stringify({
            analysisId: `${analysisMode.toLowerCase()}-${Date.now()}-${toSafeFileName(analysisFile.name)}`,
            fileName: analysisFile.name,
            processedAt: new Date().toISOString(),
            extractedData: aiData,
            originalFileDataUri: fileDataUri,
            summaryPdfDataUri: null
          })
        });
        if (saveResponse.ok) {
          savedHistory = true;
          const savedRow = await saveResponse.json().catch(() => null);
          if (savedRow?.id) {
            setSavedSummaryRecords((prev) => {
              const next = prev.filter((item) => item.id !== savedRow.id);
              return [savedRow, ...next];
            });
            setSelectedSavedSummaryId(String(savedRow.id));
          }
        } else {
          const saveError = await saveResponse.json().catch(() => ({}));
          console.warn('Falha ao salvar histórico em /analyses/saved:', saveError?.message || saveError?.error || saveResponse.status);
        }
      }

      const formData = new FormData();
      formData.append('file', analysisFile);
      formData.append('mode', analysisMode === 'TR' ? 'TR' : 'EDITAL');
      formData.append('instruction', analysisInstruction || '');
      if (aiData && typeof aiData === 'object') {
        formData.append('aiExtractedData', JSON.stringify(aiData));
      }

      const token = localStorage.getItem('token');
      const analyzeResponse = await fetch(buildApiUrl('/b2g/analisar-arquivo'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const analyzeData = await analyzeResponse.json().catch(() => ({}));

      if (!analyzeResponse.ok || !analyzeData?.notice) {
        throw new Error(analyzeData?.error || analyzeData?.message || 'Não foi possível concluir a análise do arquivo.');
      }

      setNotices((prev) => {
        const next = prev.filter((item) => item.id !== analyzeData.notice.id);
        return [analyzeData.notice, ...next];
      });
      setSelectedNoticeId(analyzeData.notice.id);
      await loadHistory(analyzeData.notice.id);
      if (savedHistory) {
        await loadSavedSummaries({ preserveSelection: true });
      }

      setAnalysisFile(null);
      if (analysisFileInputRef.current) {
        analysisFileInputRef.current.value = '';
      }
      const historySuffix = savedHistory ? ' Histórico salvo em /analyses/saved.' : '';
      const aiFallbackSuffix = aiData
        ? ''
        : ` Fluxo AI avançado indisponível nesta tentativa (${(aiFallbackReason || 'indisponível').slice(0, 180)}).`;
      const pagesSuffix = analyzeData?.upload?.numPages
        ? ` ${analyzeData.upload.numPages} página(s) processada(s).`
        : '';
      const warningSuffix = Array.isArray(analyzeData?.warnings) && analyzeData.warnings.length > 0
        ? ` Aviso: ${String(analyzeData.warnings[0]).slice(0, 220)}`
        : '';
      setFeedback({
        type: 'success',
        message: `Documento analisado${aiData ? ' com IA' : ' com análise local'}, resumo processado e fluxo B2G atualizado com sucesso.${historySuffix}${aiFallbackSuffix}${pagesSuffix}${warningSuffix}`
      });
    } catch (error) {
      console.error('Erro ao analisar arquivo enviado:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao analisar documento enviado.' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveCurrentAnalysis = async () => {
    if (!selectedNotice?.id || !selectedNotice?.aiAnalysis) {
      setFeedback({ type: 'error', message: 'Execute a análise para salvar o resumo.' });
      return;
    }

    setSavingAnalysis(true);
    try {
      await updateSelectedNotice(
        {
          summary: selectedNotice.summary,
          aiAnalysis: selectedNotice.aiAnalysis
        },
        'Resumo da análise salvo manualmente.'
      );
      setFeedback({ type: 'success', message: 'Resumo salvo com sucesso.' });
    } catch (error) {
      console.error('Erro ao salvar análise:', error);
      setFeedback({ type: 'error', message: error.message || 'Não foi possível salvar a análise.' });
    } finally {
      setSavingAnalysis(false);
    }
  };

  const handleDownloadSummary = (notice) => {
    if (!notice?.id) return;

    const pdfDataUri = notice.__savedSummaryPdfDataUri;
    if (pdfDataUri && pdfDataUri.startsWith('data:application/pdf')) {
      const anchor = document.createElement('a');
      anchor.href = pdfDataUri;
      anchor.download = `${toSafeFileName(notice.title)}-resumo.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    const analysisView = buildNoticeAnalysisView(notice);
    const analysis = notice.aiAnalysis || {};
    const requirementLines = (analysisView?.requirementGroups || []).flatMap((group) =>
      group.items.map((item) => `[${group.label}] ${item}`)
    );
    const lines = [
      `RESUMO DE EDITAL/TR - ${notice.title || 'Sem título'}`,
      '',
      `Tipo: ${TYPE_LABELS[notice.type] || notice.type || '-'}`,
      `Órgão: ${analysisView?.general?.agency || notice.organization || '-'}`,
      `UF: ${getNoticeStateCode(notice) || '-'}`,
      `Modalidade: ${analysisView?.general?.modality || notice.modality || '-'}`,
      `Referência: ${notice.referenceCode || '-'}`,
      `Abertura: ${formatDateFlexible(analysisView?.deadlines?.openingDate || notice.openingDate)}`,
      `Prazo proposta: ${formatDateFlexible(analysisView?.deadlines?.proposalDeadline || notice.proposalDueDate)}`,
      `Valor estimado: ${formatCurrency(notice.estimatedValue)}`,
      '',
      'RESUMO EXECUTIVO',
      analysisView?.summary || notice.summary || analysis.resumoExecutivo || 'Sem resumo.',
      '',
      `Recomendação IA: ${analysisView?.recommendation || analysis.recomendacao || '-'}`,
      `Score de aderência: ${Number(analysisView?.scoreAderencia ?? analysis.scoreAderencia ?? 0)} / 100`,
      '',
      'PONTOS-CHAVE'
    ];

    (analysisView?.keyPoints || analysis.pontosChave || []).forEach((item) => {
      lines.push(`- ${item}`);
    });

    lines.push('', 'PRAZOS');
    lines.push(`- Publicação: ${formatDateFlexible(analysisView?.deadlines?.publicationDate)}`);
    lines.push(`- Impugnação: ${formatDateFlexible(analysisView?.deadlines?.impugnationDeadline)}`);
    lines.push(`- Esclarecimentos: ${formatDateFlexible(analysisView?.deadlines?.clarificationDeadline)}`);
    lines.push(`- Vigência contratual: ${analysisView?.deadlines?.contractTerm || '-'}`);

    lines.push('', 'EXIGÊNCIAS');
    requirementLines.forEach((item) => {
      lines.push(`- ${item}`);
    });

    lines.push('', 'RISCOS');
    (analysisView?.risks || analysis.riscos || []).forEach((item) => {
      lines.push(`- ${item}`);
    });

    lines.push('', 'ITENS / TR');
    if (analysisView?.isTrAnalysis) {
      (analysisView.technicalNotebook || []).forEach((item) => {
        lines.push(`- [${item.meetsRequirement}] ${item.termRequirement}`);
        if (item.datasheetEvidence) lines.push(`  Evidência: ${item.datasheetEvidence}`);
      });
    } else {
      (analysisView?.items || []).forEach((item) => {
        lines.push(`- ${item.name} | Quantidade: ${item.quantity} | Especificação: ${item.specs}`);
      });
    }

    lines.push('', 'OPORTUNIDADES');
    (analysisView?.opportunities || analysis.oportunidades || []).forEach((item) => {
      lines.push(`- ${item}`);
    });

    lines.push('', 'PRÓXIMAS AÇÕES');
    (analysisView?.nextActions || analysis.proximasAcoes || []).forEach((item) => {
      lines.push(`- ${item}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${toSafeFileName(notice.title)}-resumo.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleOpenOriginalDocument = (notice) => {
    const savedDataUri = typeof notice?.__savedOriginalFileDataUri === 'string'
      ? notice.__savedOriginalFileDataUri
      : '';
    if (savedDataUri.startsWith('data:')) {
      window.open(savedDataUri, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!notice?.sourceUrl) {
      setFeedback({ type: 'error', message: 'Este resumo não possui link de documento original.' });
      return;
    }
    window.open(notice.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConvertNoticeToOpportunity = async (notice) => {
    if (!notice?.id || convertingNoticeId) return;

    setConvertingNoticeId(notice.id);
    setFeedback({ type: '', message: '' });
    try {
      const response = await fetch(buildApiUrl(`/b2g/editais/${notice.id}/converter-oportunidade`), {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.opportunity?.id) {
        throw new Error(data?.error || 'Não foi possível converter o resumo em oportunidade.');
      }

      setOpportunities((prev) => {
        const next = prev.filter((item) => item.id !== data.opportunity.id);
        return [data.opportunity, ...next];
      });
      setFeedback({ type: 'success', message: 'Resumo convertido com sucesso. Redirecionando para Oportunidades...' });
      navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(data.opportunity.id)}&mode=edit`);
    } catch (error) {
      console.error('Erro ao converter resumo em oportunidade:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao converter resumo em oportunidade.' });
    } finally {
      setConvertingNoticeId('');
    }
  };

  const handleDeleteAnalysis = async (notice) => {
    if (!isAdmin || !notice?.id || deletingNoticeId) return;
    if (!window.confirm(`Excluir a análise "${notice.title || 'sem título'}"?`)) return;

    setDeletingNoticeId(notice.id);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(buildApiUrl(`/b2g/editais/${notice.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Não foi possível excluir a análise.');
      }

      setNotices((prev) => prev.filter((item) => item.id !== notice.id));
      if (selectedNoticeId === notice.id) {
        setSelectedNoticeId('');
        setHistory([]);
      }

      setFeedback({ type: 'success', message: 'Análise excluída com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir análise:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao excluir análise.' });
    } finally {
      setDeletingNoticeId('');
    }
  };

  const openSavedSummaryDetails = (savedRecordId) => {
    if (!savedRecordId) return;
    setSelectedSavedSummaryId(String(savedRecordId));
    setAnalysisDetailTab('GERAL');
    setSavedSummaryModalOpen(true);
  };

  const closeSavedSummaryDetails = () => {
    setSavedSummaryModalOpen(false);
  };

  const handleDeleteSavedSummary = async (card) => {
    if (!card?.id || deletingSavedSummaryId) return;
    if (!window.confirm(`Excluir o resumo salvo "${card.notice?.title || 'sem título'}"?`)) return;

    const scope = resolveSavedAnalysisScope();
    if (!scope) {
      setFeedback({ type: 'error', message: 'Sessão inválida para excluir resumo salvo.' });
      return;
    }

    setDeletingSavedSummaryId(card.id);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(buildApiUrl(`/analyses/saved/${card.id}`), {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'x-company-id': scope.companyId,
          'x-user-id': scope.userId,
          'x-user-role': scope.userRole
        }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || 'Não foi possível excluir o resumo salvo.');
      }

      setSavedSummaryRecords((prev) => prev.filter((item) => String(item.id) !== card.id));
      if (selectedSavedSummaryId === card.id) {
        setSelectedSavedSummaryId('');
        setSavedSummaryModalOpen(false);
      }
      setFeedback({ type: 'success', message: 'Resumo salvo excluído com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir resumo salvo:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao excluir resumo salvo.' });
    } finally {
      setDeletingSavedSummaryId('');
    }
  };

  const handleSaveSavedSummary = async (card) => {
    if (!card?.id || savingSavedSummaryId) return;
    const scope = resolveSavedAnalysisScope();
    if (!scope) {
      setFeedback({ type: 'error', message: 'Sessão inválida para salvar resumo.' });
      return;
    }

    setSavingSavedSummaryId(card.id);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(buildApiUrl('/analyses/saved'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'x-company-id': scope.companyId,
          'x-user-id': scope.userId,
          'x-user-role': scope.userRole
        },
        body: JSON.stringify({
          analysisId: String(card.record?.analysisId || `saved-${card.id}`),
          fileName: card.record?.fileName || card.notice?.title || 'resumo.pdf',
          processedAt:
            card.record?.processedAt ||
            card.notice?.updatedAt ||
            card.notice?.createdAt ||
            new Date().toISOString(),
          extractedData:
            card.record?.extractedData ||
            card.notice?.aiAnalysis?.templateExtractedData ||
            {},
          originalFileDataUri: card.record?.originalFileDataUri || null,
          summaryPdfDataUri: card.record?.summaryPdfDataUri || null
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Não foi possível salvar o resumo.');
      }

      setSavedSummaryRecords((prev) => {
        const next = prev.filter((item) => String(item.id) !== String(data.id));
        return [data, ...next];
      });
      setSelectedSavedSummaryId(String(data.id));
      setFeedback({ type: 'success', message: 'Resumo salvo com sucesso.' });
    } catch (error) {
      console.error('Erro ao salvar resumo no histórico:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao salvar resumo.' });
    } finally {
      setSavingSavedSummaryId('');
    }
  };

  const ensureNoticeForSavedSummary = async (card) => {
    if (!card?.notice) return null;
    if (card.linkedNoticeId) {
      return notices.find((item) => item.id === card.linkedNoticeId) || null;
    }

    const payload = {
      type: card.notice.type || 'EDITAL',
      title: card.notice.title || card.record?.fileName || 'Resumo sem título',
      organization: card.notice.organization || 'Órgão não identificado',
      stateCode: card.notice.stateCode || '',
      modality: card.notice.modality || '',
      objectDescription:
        card.analysisView?.general?.objectSummary ||
        card.notice.objectDescription ||
        card.notice.summary ||
        '',
      openingDate: card.notice.openingDate || null,
      proposalDueDate: card.notice.proposalDueDate || null,
      sourceUrl: card.notice.sourceUrl || '',
      summary: card.notice.summary || card.analysisView?.summary || '',
      status: 'ANALISE_CONCLUIDA',
      aiAnalysis: card.notice.aiAnalysis || null
    };

    const createResponse = await fetch(buildApiUrl('/b2g/editais'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const createData = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok || !createData?.id) {
      throw new Error(createData?.error || 'Não foi possível criar edital base para conversão.');
    }

    setNotices((prev) => {
      const exists = prev.some((item) => item.id === createData.id);
      if (exists) return prev;
      return [createData, ...prev];
    });
    return createData;
  };

  const handleConvertSavedSummaryToOpportunity = async (card) => {
    if (!card?.id || convertingSavedSummaryId) return;

    setConvertingSavedSummaryId(card.id);
    setFeedback({ type: '', message: '' });

    try {
      const notice = await ensureNoticeForSavedSummary(card);
      if (!notice?.id) {
        throw new Error('Não foi possível preparar o resumo para conversão.');
      }

      const response = await fetch(buildApiUrl(`/b2g/editais/${notice.id}/converter-oportunidade`), {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.opportunity?.id) {
        throw new Error(data?.error || 'Não foi possível converter em oportunidade.');
      }

      setOpportunities((prev) => {
        const next = prev.filter((item) => item.id !== data.opportunity.id);
        return [data.opportunity, ...next];
      });
      setFeedback({ type: 'success', message: 'Resumo convertido com sucesso. Redirecionando...' });
      navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(data.opportunity.id)}&mode=edit`);
    } catch (error) {
      console.error('Erro ao converter resumo do histórico em oportunidade:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao converter resumo.' });
    } finally {
      setConvertingSavedSummaryId('');
    }
  };

  const openOpportunityDetails = async (opportunity) => {
    if (!opportunity?.id) return;
    setSelectedOpportunityId(opportunity.id);
    setB2gFollowUpText('');
    setB2gFollowUpType('NOTE');
    setB2gFollowUpError('');
    setB2gFollowUps([]);
    // Carregar follow-ups
    setB2gLoadingFollowUps(true);
    try {
      const res = await fetch(buildApiUrl(`/opportunity-followups/${opportunity.id}`), { headers: getAuthHeaders() });
      if (res.ok) setB2gFollowUps(await res.json());
    } catch (e) {
      console.error('Erro ao carregar acompanhamentos B2G:', e);
    } finally {
      setB2gLoadingFollowUps(false);
    }
  };

  const closeOpportunityDetails = () => {
    setSelectedOpportunityId('');
    setB2gFollowUps([]);
    setB2gFollowUpText('');
    setB2gFollowUpError('');
  };

  const handleAddB2GFollowUp = async () => {
    const content = b2gFollowUpText.trim();
    if (!selectedOpportunityId || !content) {
      setB2gFollowUpError('Informe o acompanhamento antes de salvar.');
      return;
    }
    setB2gFollowUpSubmitting(true);
    setB2gFollowUpError('');
    try {
      const res = await fetch(buildApiUrl('/opportunity-followups'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ opportunityId: selectedOpportunityId, type: b2gFollowUpType, content })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Erro ao salvar acompanhamento.');
      }
      const created = await res.json();
      setB2gFollowUps(prev => [created, ...prev]);
      setB2gFollowUpText('');
      setB2gFollowUpType('NOTE');
    } catch (e) {
      setB2gFollowUpError(e.message);
    } finally {
      setB2gFollowUpSubmitting(false);
    }
  };

  const handleDeleteB2GFollowUp = async (followUpId) => {
    if (!window.confirm('Deseja remover este acompanhamento?')) return;
    try {
      const res = await fetch(buildApiUrl(`/opportunity-followups/${followUpId}`), {
        method: 'DELETE', headers: getAuthHeaders()
      });
      if (res.ok) setB2gFollowUps(prev => prev.filter(f => f.id !== followUpId));
    } catch (e) {
      console.error('Erro ao remover acompanhamento:', e);
    }
  };

  const handleEditOpportunity = (opportunity) => {
    if (!opportunity?.id) return;
    closeOpportunityDetails();
    setOpportunityModalMode('edit');
    setEditingOpportunity(opportunity);
    setOpportunityEditError('');
    setShowOpportunityEditModal(true);
  };

  const handleSubmitOpportunityEdit = async () => {
    const isCreating = opportunityModalMode === 'create';

    if (!isCreating && !editingOpportunity?.id) return;

    if (!opportunityEditForm.title.trim()) {
      setOpportunityEditError('Informe o título da oportunidade.');
      return;
    }
    if (!opportunityEditForm.companyId) {
      setOpportunityEditError('Selecione uma empresa/órgão.');
      return;
    }

    setOpportunityEditSubmitting(true);
    setOpportunityEditError('');

    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;

    const payload = {
      title: opportunityEditForm.title.trim(),
      projectName: opportunityEditForm.projectName.trim() || opportunityEditForm.title.trim(),
      projectClientType: opportunityEditForm.projectClientType,
      projectType: opportunityEditForm.projectType,
      projectMonths: parseInt(opportunityEditForm.projectMonths) || 12,
      description: opportunityEditForm.description,
      value: parseFloat(opportunityEditForm.value) || 0,
      probability: parseInt(opportunityEditForm.probability) || 50,
      stage: opportunityEditForm.stage,
      source: opportunityEditForm.source || 'MANUAL',
      expectedCloseDate: opportunityEditForm.expectedCloseDate || null,
      companyId: opportunityEditForm.companyId,
      ownerId: opportunityEditForm.ownerId || user?.id || '',
      clientType: 'B2G'
    };

    try {
      let response;
      if (isCreating) {
        response = await fetch(buildApiUrl('/opportunities?clientType=B2G'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
      } else {
        payload.id = editingOpportunity.id;
        response = await fetch(
          buildApiUrl(`/opportunities/${encodeURIComponent(editingOpportunity.id)}?clientType=B2G`),
          { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) }
        );
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || 'Erro ao salvar oportunidade.');

      if (isCreating) {
        setOpportunities(prev => [data, ...prev]);
        setFeedback({ type: 'success', message: 'Oportunidade criada com sucesso!' });
      } else {
        setOpportunities(prev => prev.map(o => o.id === editingOpportunity.id ? { ...o, ...data } : o));
        setFeedback({ type: 'success', message: 'Oportunidade atualizada com sucesso!' });
      }

      setShowOpportunityEditModal(false);
      setEditingOpportunity(null);
      await refreshB2GOpportunities();
    } catch (err) {
      setOpportunityEditError(err.message || 'Erro ao salvar oportunidade.');
    } finally {
      setOpportunityEditSubmitting(false);
    }
  };

  const handleNewOpportunity = () => {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    setOpportunityModalMode('create');
    setEditingOpportunity(null);
    setOpportunityEditForm({
      title: '',
      projectName: '',
      projectClientType: 'NEW_CLIENT',
      projectType: 'SINGLE',
      projectMonths: '12',
      description: '',
      value: '',
      probability: 50,
      stage: 'QUALIFICATION',
      source: 'MANUAL',
      expectedCloseDate: '',
      companyId: leads.length > 0 ? leads[0].id : '',
      ownerId: user?.id || ''
    });
    setOpportunityEditError('');
    setShowOpportunityEditModal(true);
  };

  const handleDeleteOpportunity = async (opportunity) => {
    if (!isAdmin || !opportunity?.id || deletingOpportunityId) return;
    if (!window.confirm(`Excluir a oportunidade "${opportunity.title || 'sem título'}"?`)) return;

    setDeletingOpportunityId(opportunity.id);
    try {
      const response = await fetch(
        buildApiUrl(`/opportunities/${encodeURIComponent(opportunity.id)}?clientType=B2G`),
        {
        method: 'DELETE',
        headers: getAuthHeaders()
      }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Não foi possível excluir a oportunidade.');
      }

      setOpportunities((prev) => prev.filter((item) => item.id !== opportunity.id));
      if (selectedOpportunityId === opportunity.id) {
        closeOpportunityDetails();
      }
      setFeedback({ type: 'success', message: 'Oportunidade excluída com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir oportunidade:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao excluir oportunidade.' });
    } finally {
      setDeletingOpportunityId('');
    }
  };

  const handleDeleteLead = async (lead) => {
    if (!isAdmin || !lead?.id || deletingLeadId) return;
    if (!window.confirm(`Excluir o lead "${lead.name || 'sem nome'}"?`)) return;

    setDeletingLeadId(lead.id);
    try {
      const response = await fetch(buildApiUrl(`/companies/${encodeURIComponent(lead.id)}?clientType=B2G`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Não foi possível excluir o lead.');
      }

      const mustCloseOpportunityDetails = Boolean(
        selectedOpportunity &&
        (selectedOpportunity.companyId === lead.id || selectedOpportunity.company?.id === lead.id)
      );

      setLeads((prev) => prev.filter((item) => item.id !== lead.id));
      setOpportunities((prev) =>
        prev.filter((item) => {
          const opportunityCompanyId = item?.companyId || item?.company?.id;
          return opportunityCompanyId !== lead.id;
        })
      );
      if (mustCloseOpportunityDetails) {
        closeOpportunityDetails();
      }
      setFeedback({ type: 'success', message: 'Lead excluído com sucesso.' });
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao excluir lead.' });
    } finally {
      setDeletingLeadId('');
    }
  };

  const inferLeadDecision = (lead) => {
    const text = `${lead?.segment || ''}\n${lead?.address || ''}`.toUpperCase();
    if (text.includes('NO GO')) return 'NO_GO';
    if (/\bGO\b/.test(text)) return 'GO';
    return 'ANALISE';
  };

  const openLeadAnalysis = (lead) => {
    if (!lead?.id) return;
    setSelectedLeadAnalysisId(lead.id);
    setLeadAnalysisDecision(inferLeadDecision(lead));
    setLeadAnalysisNotes('');
    setFeedback({ type: '', message: '' });
  };

  const closeLeadAnalysis = () => {
    if (savingLeadAnalysis) return;
    setSelectedLeadAnalysisId('');
    setLeadAnalysisDecision('ANALISE');
    setLeadAnalysisNotes('');
  };

  const handleSaveLeadAnalysis = async () => {
    const lead = selectedLeadAnalysis;
    if (!lead?.id || savingLeadAnalysis) return;

    const decisionConfig = {
      ANALISE: { label: 'Em análise', status: 'LEAD', score: 65 },
      GO: { label: 'GO', status: 'PROSPECT', score: 85 },
      NO_GO: { label: 'NO GO', status: 'INACTIVE', score: 20 }
    }[leadAnalysisDecision] || { label: 'Em análise', status: 'LEAD', score: 65 };

    const previousNotes = String(lead.address || '').trim();
    const analysisBlock = [
      `Decisão B2G: ${decisionConfig.label}`,
      `Atualizado em: ${new Date().toLocaleString('pt-BR')}`,
      leadAnalysisNotes.trim() ? `Observações: ${leadAnalysisNotes.trim()}` : ''
    ].filter(Boolean).join('\n');
    const nextAddress = [previousNotes, analysisBlock].filter(Boolean).join('\n\n---\n');

    setSavingLeadAnalysis(true);
    try {
      // 1. Atualizar a empresa (lead)
      const response = await fetch(buildApiUrl(`/companies/${encodeURIComponent(lead.id)}?clientType=B2G`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: lead.id,
          name: lead.name,
          document: lead.document,
          segment: `B2G Governo | ${decisionConfig.label}`,
          size: lead.size,
          website: lead.website,
          address: nextAddress,
          city: lead.city,
          state: lead.state,
          status: decisionConfig.status,
          leadScore: decisionConfig.score,
          contacts: lead.contacts || []
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Não foi possível salvar a análise do lead.');
      }

      setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, ...data } : item)));

      // 2. Se GO: criar oportunidade e redirecionar
      if (leadAnalysisDecision === 'GO') {
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;

        // Extrair dados do edital do campo address
        const addressText = String(lead.address || '');
        const extractField = (label) => {
          const match = addressText.match(new RegExp(`${label}:\\s*(.+)`));
          return match ? match[1].trim() : '';
        };

        const b2gData = {
          orgaoEntidade: lead.name || '',
          objetoResumido: extractField('Objeto'),
          modalidade: extractField('Modalidade'),
          portal: extractField('Fonte'),
          linkBriefing: extractField('Link') || lead.website || '',
          ufCidade: [lead.city, lead.state].filter(Boolean).join('/') || '',
          decisao: 'GO',
          probabilidadeGanho: 75,
          faseAtual: 'analise',
          grauRisco: 'Médio',
          observacoes: leadAnalysisNotes.trim(),
          convertedAt: new Date().toISOString(),
          sourcePortal: extractField('Fonte') || 'PNCP'
        };

        const oppTitle = `[B2G] ${(extractField('Edital') ? extractField('Edital') + ' - ' : '')}${lead.name || 'Oportunidade B2G'}`.slice(0, 220);

        const oppResponse = await fetch(buildApiUrl('/opportunities?clientType=B2G'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            clientType: 'B2G',
            title: oppTitle,
            description: JSON.stringify(b2gData),
            value: 0,
            probability: 75,
            stage: 'DIAGNOSIS',
            source: 'MANUAL',
            companyId: lead.id,
            ownerId: user?.id || null
          })
        });

        const oppData = await oppResponse.json().catch(() => ({}));

        if (oppResponse.ok && oppData?.id) {
          setOpportunities((prev) => {
            const next = prev.filter((item) => item.id !== oppData.id);
            return [oppData, ...next];
          });
          setFeedback({ type: 'success', message: 'GO! Oportunidade criada. Redirecionando...' });
          setSelectedLeadAnalysisId('');
          setLeadAnalysisDecision('ANALISE');
          setLeadAnalysisNotes('');
          // Redirecionar para oportunidades B2G
          setTimeout(() => {
            navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(oppData.id)}&mode=edit`);
          }, 1000);
          return;
        } else {
          setFeedback({ type: 'success', message: `GO salvo. Erro ao criar oportunidade: ${oppData?.error || 'tente novamente.'}` });
        }
      } else {
        setFeedback({ type: 'success', message: `Decisão ${decisionConfig.label} salva no lead B2G.` });
      }

      setSelectedLeadAnalysisId('');
      setLeadAnalysisDecision('ANALISE');
      setLeadAnalysisNotes('');
    } catch (error) {
      console.error('Erro ao salvar análise do lead:', error);
      setFeedback({ type: 'error', message: error.message || 'Erro ao salvar análise do lead.' });
    } finally {
      setSavingLeadAnalysis(false);
    }
  };

  const handleKanbanDragStart = (event, opportunity) => {
    const opportunityId = normalizeEntityId(opportunity?.id);
    if (!opportunityId || movingOpportunityId) return;

    draggedOpportunityRef.current = opportunity;
    setDraggedOpportunityId(opportunityId);
    setDraggedOpportunitySnapshot(opportunity);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', opportunityId);
    event.dataTransfer.setData('text', opportunityId);
    event.dataTransfer.setData('application/x-opportunity-id', opportunityId);
  };

  const handleKanbanDragOver = (event, columnId) => {
    event.preventDefault();
    if (!draggedOpportunityRef.current || movingOpportunityId) return;
    event.dataTransfer.dropEffect = 'move';
    if (dragOverOpportunityColumn !== columnId) {
      setDragOverOpportunityColumn(columnId);
    }
  };

  const handleKanbanDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragOverOpportunityColumn('');
    }
  };

  const handleKanbanDragEnd = () => {
    draggedOpportunityRef.current = null;
    setDraggedOpportunityId('');
    setDraggedOpportunitySnapshot(null);
    setDragOverOpportunityColumn('');
  };

  const moveOpportunityToKanbanColumn = async (opportunity, targetColumnId, outcomePayload = null) => {
    const opportunityId = normalizeEntityId(opportunity?.id);
    if (!opportunityId || !targetColumnId) return;

    const currentColumnId = resolveKanbanColumnId(opportunity?.b2gStage || opportunity?.stage);
    if (currentColumnId === targetColumnId) return;

    if (KANBAN_FINAL_COLUMNS.has(targetColumnId) && !outcomePayload) {
      setPendingOpportunityOutcome({ opportunity, targetColumnId });
      return;
    }

    const nextPipelineStage = mapKanbanColumnToPipelineStage(targetColumnId);
    const prevStage = opportunity.stage;
    const prevB2gStage = opportunity.b2gStage || null;
    const prevStageDecisionDetails = opportunity.stageDecisionDetails || null;
    const prevLossReason = opportunity.lossReason || null;
    const nextStageDecisionDetails = KANBAN_FINAL_COLUMNS.has(targetColumnId)
      ? outcomePayload?.stageDecisionDetails
      : null;
    const nextLossReason = KANBAN_FINAL_COLUMNS.has(targetColumnId)
      ? outcomePayload?.lossReason || null
      : null;

    setMovingOpportunityId(opportunityId);
    setOpportunities((prev) =>
      prev.map((item) =>
        normalizeEntityId(item.id) === opportunityId
          ? {
              ...item,
              stage: nextPipelineStage,
              b2gStage: targetColumnId,
              stageDecisionDetails: nextStageDecisionDetails,
              lossReason: nextLossReason
            }
          : item
      )
    );

    try {
      const response = await fetch(
        buildApiUrl(`/opportunities/${encodeURIComponent(opportunityId)}?clientType=B2G`),
        {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          stage: nextPipelineStage,
          b2gStage: targetColumnId,
          stageDecisionDetails: nextStageDecisionDetails,
          lossReason: nextLossReason
        })
      }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Falha ao mover oportunidade no Kanban.');
      }

      if (data?.id) {
        const updatedId = normalizeEntityId(data.id);
        setOpportunities((prev) =>
          prev.map((item) =>
            normalizeEntityId(item.id) === updatedId
              ? { ...item, ...data }
              : item
          )
        );
      }
    } catch (error) {
      setOpportunities((prev) =>
        prev.map((item) =>
          normalizeEntityId(item.id) === opportunityId
            ? {
                ...item,
                stage: prevStage,
                b2gStage: prevB2gStage,
                stageDecisionDetails: prevStageDecisionDetails,
                lossReason: prevLossReason
              }
            : item
        )
      );
      setFeedback({ type: 'error', message: error.message || 'Não foi possível mover a oportunidade.' });
    } finally {
      setMovingOpportunityId('');
    }
  };

  const handleConfirmOpportunityOutcome = async (payload) => {
    const request = pendingOpportunityOutcome;
    setPendingOpportunityOutcome(null);
    if (!request?.opportunity || !request.targetColumnId) return;
    await moveOpportunityToKanbanColumn(request.opportunity, request.targetColumnId, payload);
  };

  const handleKanbanDrop = async (event, targetColumnId) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverOpportunityColumn('');

    const transferId =
      normalizeEntityId(event.dataTransfer.getData('text/plain')) ||
      normalizeEntityId(event.dataTransfer.getData('application/x-opportunity-id')) ||
      normalizeEntityId(event.dataTransfer.getData('text'));
    const effectiveOpportunityId =
      transferId ||
      normalizeEntityId(draggedOpportunityRef.current?.id) ||
      normalizeEntityId(draggedOpportunityId);

    if (!effectiveOpportunityId || movingOpportunityId) {
      draggedOpportunityRef.current = null;
      setDraggedOpportunityId('');
      setDraggedOpportunitySnapshot(null);
      return;
    }

    const draggedOpportunity =
      sortedFilteredOpportunities.find((item) => normalizeEntityId(item.id) === effectiveOpportunityId) ||
      opportunities.find((item) => normalizeEntityId(item.id) === effectiveOpportunityId) ||
      (normalizeEntityId(draggedOpportunityRef.current?.id) === effectiveOpportunityId
        ? draggedOpportunityRef.current
        : null) ||
      (normalizeEntityId(draggedOpportunitySnapshot?.id) === effectiveOpportunityId
        ? draggedOpportunitySnapshot
        : null);

    if (!draggedOpportunity) {
      setFeedback({ type: 'error', message: 'Não foi possível identificar o card arrastado. Tente novamente.' });
      draggedOpportunityRef.current = null;
      setDraggedOpportunityId('');
      setDraggedOpportunitySnapshot(null);
      return;
    }

    await moveOpportunityToKanbanColumn(draggedOpportunity, targetColumnId);
    draggedOpportunityRef.current = null;
    setDraggedOpportunityId('');
    setDraggedOpportunitySnapshot(null);
  };

  const handleDashboardFullscreen = async () => {
    if (typeof document === 'undefined') return;

    try {
      if (document.fullscreenElement === dashboardPresentationRef.current) {
        await document.exitFullscreen();
        return;
      }
      dashboardPresentationRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      await dashboardPresentationRef.current?.requestFullscreen();
    } catch (_error) {
      // ignore browser-level fullscreen failures
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const syncPresentationMode = () => {
      setDashboardPresentationMode(document.fullscreenElement === dashboardPresentationRef.current);
    };

    document.addEventListener('fullscreenchange', syncPresentationMode);
    syncPresentationMode();

    return () => document.removeEventListener('fullscreenchange', syncPresentationMode);
  }, []);

  const getDashboardPresentationSteps = () => {
    const container = dashboardPresentationRef.current;
    if (!container) return [];

    return Array.from(container.children).filter(
      (child) =>
        child instanceof HTMLElement &&
        child.dataset.presentationControls !== 'true' &&
        child.offsetHeight > 40
    );
  };

  const resolveDashboardCurrentStepIndex = (steps, container) => {
    const anchor = container.scrollTop + container.clientHeight * 0.24;
    const matchIndex = steps.findIndex((step) => {
      const top = step.offsetTop;
      const bottom = top + step.offsetHeight;
      return top <= anchor && bottom > anchor;
    });

    if (matchIndex !== -1) return matchIndex;

    return steps.reduce(
      (best, step, index) => {
        const distance = Math.abs(step.offsetTop - anchor);
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY }
    ).index;
  };

  const updateDashboardPresentationProgress = () => {
    const container = dashboardPresentationRef.current;
    if (!container) return;

    const steps = getDashboardPresentationSteps();
    if (steps.length === 0) {
      setDashboardPresentationProgress({ current: 1, total: 1 });
      return;
    }

    const currentIndex = resolveDashboardCurrentStepIndex(steps, container);
    const next = { current: currentIndex + 1, total: steps.length };

    setDashboardPresentationProgress((prev) => (
      prev.current === next.current && prev.total === next.total ? prev : next
    ));
  };

  const scrollDashboardPresentation = (direction) => {
    const container = dashboardPresentationRef.current;
    if (!container) return;

    const steps = getDashboardPresentationSteps();

    if (steps.length === 0) {
      container.scrollBy({ top: direction * container.clientHeight * 0.85, behavior: 'smooth' });
      return;
    }

    const currentIndex = resolveDashboardCurrentStepIndex(steps, container);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = Math.min(Math.max(baseIndex + direction, 0), steps.length - 1);

    const target = steps[nextIndex];
    if (!target) return;

    const top = Math.max(target.offsetTop - 12, 0);
    container.scrollTo({ top, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!dashboardPresentationMode) return undefined;

    const container = dashboardPresentationRef.current;
    if (!container) return undefined;

    const sync = () => updateDashboardPresentationProgress();
    const raf = requestAnimationFrame(sync);

    container.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [dashboardPresentationMode]);

  useEffect(() => {
    if (!dashboardPresentationMode) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        scrollDashboardPresentation(1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        scrollDashboardPresentation(-1);
      } else if (event.key === 'Escape') {
        handleDashboardFullscreen();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dashboardPresentationMode]);

  const dashboardOutcomeBadgeClass = (columnId) => {
    if (columnId === 'GANHO') {
      return 'border-emerald-400/45 bg-emerald-400/14 text-emerald-100';
    }
    if (columnId === 'PERDIDO' || columnId === 'NO_GO') {
      return 'border-rose-400/45 bg-rose-400/16 text-rose-100';
    }
    if (columnId === 'SUSPENSO') {
      return 'border-amber-300/50 bg-amber-300/14 text-amber-100';
    }
    return 'border-[#76beff66] bg-[#0b2141] text-[#d5e8ff]';
  };

  const renderAdvancedFilters = ({
    title = 'Filtros avançados',
    showModality = true
  } = {}) => (
    <div className="crm-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">
        {title}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="text-xs font-semibold text-[var(--crm-muted)]">Órgão</label>
          <input
            className="crm-input mt-1"
            list="b2g-org-options"
            value={advancedFilters.organization}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, organization: e.target.value }))}
            placeholder="Digite ou selecione um órgão"
          />
          <datalist id="b2g-org-options">
            {organizationFilterOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div className="w-full min-w-[110px] sm:w-[120px]">
          <label className="text-xs font-semibold text-[var(--crm-muted)]">UF</label>
          <select
            className="crm-input mt-1"
            value={advancedFilters.stateCode}
            onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, stateCode: e.target.value }))}
          >
            <option value="">Todas</option>
            {availableUfFilterOptions.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>

        {showModality && (
          <div className="min-w-[220px] flex-1">
            <label className="text-xs font-semibold text-[var(--crm-muted)]">Modalidade</label>
            <input
              className="crm-input mt-1"
              list="b2g-modality-options"
              value={advancedFilters.modality}
              onChange={(e) => setAdvancedFilters((prev) => ({ ...prev, modality: e.target.value }))}
              placeholder="Digite ou selecione uma modalidade"
            />
            <datalist id="b2g-modality-options">
              {modalityFilterOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        )}

        <button
          type="button"
          className="crm-btn crm-btn-secondary h-10 px-4"
          onClick={() => setAdvancedFilters({ organization: '', stateCode: '', modality: '' })}
          disabled={!advancedFilters.organization && !advancedFilters.stateCode && !advancedFilters.modality}
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );

  const renderB2GStrategicDashboard = () => {
    const topEditaisTicks = [1, 0.75, 0.5, 0.25, 0].map((factor) => dashboardTopEditaisMaxValue * factor);
    const projectionTicks = [1, 0.75, 0.5, 0.25, 0].map((factor) => dashboardProjectionMax * factor);
    const listRows = dashboardTemperatureRows.slice().sort((a, b) => b.__value - a.__value);
    const primaryResult = dashboardRecentResults[0] || null;

    return (
      <div
        ref={dashboardPresentationRef}
        className={[
          'space-y-6',
          dashboardPresentationMode
            ? 'h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[#041a38] p-4 pb-28 sm:p-6'
            : ''
        ].join(' ')}
      >
        <section
          className="relative overflow-hidden rounded-[20px] border border-[#79c2ff52] p-3 text-[#dbeeff] shadow-[0_36px_70px_-50px_rgba(6,20,45,0.96)] lg:p-4"
          style={{
            background:
              'linear-gradient(130deg, rgba(12,46,85,0.96) 0%, rgba(8,30,58,0.97) 48%, rgba(19,58,101,0.95) 100%)'
          }}
        >
          <div className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-[#88c3ff24] blur-[80px]" />
          <div className="pointer-events-none absolute right-20 top-4 h-52 w-52 rounded-full bg-[#66e2ff26] blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-[#4f7cff1f] blur-[90px]" />

          <button
            type="button"
            onClick={handleDashboardFullscreen}
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-[#84c5ff3d] bg-[#0b1f3d]/90 px-2.5 py-1.5 text-xs font-semibold text-[#edf7ff] transition-colors hover:bg-[#12305a]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Apresentação
          </button>

          <div className="relative grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#79beff5c] bg-[#295f9f47] px-3 py-1.5 text-xs font-semibold text-[#d6edff]">
                <Zap className="h-3.5 w-3.5 text-[#7dd8ff]" />
                Visão Comercial Estratégica
              </div>

              <h2 className="mt-3 text-xl font-black leading-tight text-[#8fd0ff] sm:text-2xl">
                Painel Estratégico
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm font-medium text-[#c8dfff] sm:text-base">
                Visão geral da performance comercial e pipeline de governo.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/b2g-analise')}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[#5ab8f6] to-[#3a65f2] px-4 text-xs font-bold text-white shadow-[0_20px_40px_-24px_rgba(54,128,246,0.9)] transition-transform hover:-translate-y-0.5 sm:text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Nova Licitação
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/b2g-relatorios')}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#7ab8ff66] bg-[#0a1e3d]/95 px-4 text-xs font-semibold text-[#e6f2ff] transition-colors hover:bg-[#123263] sm:text-sm"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Relatórios
                </button>
                <div className="flex items-center gap-2">
                  <select
                    value={dashboardPeriod}
                    onChange={(e) => setDashboardPeriod(e.target.value)}
                    className="h-10 rounded-lg border border-[#7ab8ff66] bg-[#0a1e3d]/95 px-2.5 py-1.5 text-xs font-medium text-[#e6f2ff] focus:outline-none focus:border-[#8fd1ff]"
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { loadNotices({ preserveSelection: true }); loadSupportData(); }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#7ab8ff66] bg-[#0a1e3d]/95 text-[#e6f2ff] transition-colors hover:bg-[#123263]"
                    title="Atualizar dados do dashboard"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div
                className="rounded-xl border border-[#7ec3ff45] p-3"
                style={{
                  background:
                    'linear-gradient(150deg, rgba(27,72,123,0.82) 0%, rgba(18,45,87,0.9) 72%, rgba(12,32,62,0.98) 100%)'
                }}
              >
                <div className="text-xs uppercase tracking-[0.12em] text-[#8bb3d7]">
                  Pipeline
                </div>
                <div className="mt-1.5 break-words text-xl font-black leading-none text-[#8fd2ff] sm:text-2xl">
                  {formatCurrency(dashboardTotals.pipelineValue)}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] sm:text-xs">
                  <span className="text-[#afcae4]">Mensal</span>
                  <span className="font-bold text-[#7bdca5]">{formatCurrency(dashboardTotals.monthlyValue)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs">
                  <span className="text-[#afcae4]">Pontual</span>
                  <span className="font-bold text-[#f5c94b]">{formatCurrency(dashboardTotals.punctualValue)}</span>
                </div>
              </div>

              <div
                className="rounded-xl border border-[#7ec3ff45] p-3"
                style={{
                  background:
                    'linear-gradient(150deg, rgba(24,62,106,0.8) 0%, rgba(14,37,74,0.92) 76%, rgba(9,26,54,0.98) 100%)'
                }}
              >
                <div className="text-xs uppercase tracking-[0.12em] text-[#9bb8d7]">
                  Vitória
                </div>
                <div className="mt-1.5 text-xl font-black leading-none text-[#84de9f] sm:text-2xl">
                  {dashboardTotals.winRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardKPICard
            title="Previsão de Sucesso"
            icon={TrendingUp}
            colorTheme="magenta"
            size="compact"
            value={
              <div className="relative mx-auto mt-1 h-20 w-36 overflow-hidden">
                <TemperatureGauge
                  value={Number(dashboardForecastScore) || 0}
                  size="small"
                  colorTheme="magenta"
                />
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-lg font-black text-[#ecf5ff]">
                  {(Number(dashboardForecastScore) || 0).toFixed(1)}%
                </div>
              </div>
            }
            status="active"
          />

          <DashboardKPICard
            title="Total em Pipeline"
            icon={TrendingUp}
            value={formatCurrencyNoCents(Number(dashboardTotals?.pipelineValue) || 0)}
            subtitle="Volume em análise comercial"
            colorTheme="cyan"
            status="active"
            size="compact"
          />

          <DashboardKPICard
            title="Taxa de Vitória"
            icon={Gauge}
            value={`${(Number(dashboardTotals?.winRate) || 0).toFixed(1)}%`}
            subtitle="Conversão média"
            colorTheme="green"
            status="active"
            size="compact"
          />

          <DashboardKPICard
            title="Licitações GO"
            icon={CheckCircle2}
            value={Number(dashboardTotals?.goCount) || 0}
            subtitle="Ativas em proposta"
            colorTheme="blue"
            status="active"
            size="compact"
          />

          <DashboardKPICard
            title="Prazos Próximos"
            icon={Clock3}
            value={String((dashboardCriticalDeadlines?.length || 0)).padStart(2, '0')}
            subtitle="Abertura em 7 dias"
            colorTheme="pink"
            status="active"
            size="compact"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.9fr_1fr]">
          <div
            className="rounded-[20px] border border-[#78c5ff50] p-5 text-[#d9edff] lg:p-6"
            style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg md:text-xl font-black leading-tight text-[#dcecff]">Funil de Vendas Estratégico</h3>
                <p className="mt-1 text-sm font-medium text-[#aac6e4]">Distribuição das oportunidades por fase</p>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#8dc8ff59] bg-[#2b5f925e]">
                <Target className="h-6 w-6 text-[#8fd1ff]" />
              </span>
            </div>

            <div className="mt-5 h-[420px]">
              <B2GFunnelStrategic
                funnelRows={dashboardFunnelRows}
                activeStage={dashboardPhaseFilter}
                selectedTemperature={dashboardTemperatureFilter}
              />
            </div>
          </div>

          <div
            className="rounded-[20px] border border-[#78c5ff50] p-5 text-[#d9edff] lg:p-6"
            style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-bold uppercase tracking-[0.1em] text-[#66c3ff]">Projeção Comercial</div>
                <h3 className="mt-2 text-lg md:text-xl font-black leading-tight text-[#dcecff]">Previsões de Venda</h3>
                <p className="mt-1 text-sm font-medium leading-tight text-[#aac6e4]">
                  Composição do pipeline por origem
                  <br />
                  e impacto de perdas.
                </p>
              </div>

              <div className="rounded-2xl bg-[#6f84b852] px-4 py-3 text-center">
                <div className="text-sm font-bold uppercase leading-tight tracking-[0.08em] text-[#c6d6ea]">Taxa de Conversão</div>
                <div className="mt-1 text-lg md:text-xl font-black leading-none text-[#66d7ea]">
                  {dashboardTotals.winRate.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="relative mt-6 h-[250px]">
              <DashboardAdvancedChart
                title="Previsões de Venda"
                subtitle="Composição do pipeline por origem e impacto de perdas."
                type="bar"
                colorTheme="warm"
                data={{
                  labels: dashboardProjectionBars.map((bar) => bar.label),
                  values: dashboardProjectionBars.map((bar) => bar.value),
                  colors: dashboardProjectionBars.map((bar) => bar.color)
                }}
                isEmpty={dashboardProjectionBars.length === 0}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[#3fa3bb4f] px-4 py-4 text-center">
                <div className="text-sm font-bold uppercase tracking-[0.08em] text-[#bad8e9]">Total projetado</div>
                <div className="mt-2 text-base md:text-lg font-black text-[#dcecff]">
                  {formatCurrency(dashboardTotals.projectedValue)}
                </div>
              </div>
              <div className="rounded-2xl bg-[#7e85bf5a] px-4 py-4 text-center">
                <div className="text-sm font-bold uppercase tracking-[0.08em] text-[#cad4ea]">Projetos ativos</div>
                <div className="mt-2 text-base md:text-lg font-black text-[#dcecff]">
                  {dashboardTotals.openCount} Oportunidades
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="rounded-[22px] border border-[#78c5ff50] p-4 text-[#d9edff] lg:p-6"
          style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
        >
          <style>
            {`
              .b2g-probability-shell {
                background:
                  radial-gradient(circle at 20% 12%, rgba(102, 215, 234, 0.18), transparent 28%),
                  linear-gradient(125deg, rgba(8, 29, 58, 0.72), rgba(18, 58, 103, 0.74), rgba(9, 25, 54, 0.78));
                background-size: 180% 180%;
                animation: b2gProbabilityGradient 9s ease-in-out infinite;
              }

              .b2g-probability-shell::after {
                position: absolute;
                inset: 12px;
                content: '';
                border-radius: 18px;
                background:
                  linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent),
                  repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 18px);
                opacity: 0.64;
                pointer-events: none;
              }

              @keyframes b2gProbabilityGradient {
                0%, 100% { background-position: 0% 45%; }
                50% { background-position: 100% 55%; }
              }

              @media (prefers-reduced-motion: reduce) {
                .b2g-probability-shell { animation: none; }
              }
            `}
          </style>

          <h3 className="text-lg font-black leading-tight text-[#dcecff]">Probabilidade de Ganho (%)</h3>
          <p className="mt-1 text-sm font-medium text-[#aac6e4]">
            Distribuição por faixas com participação e volume financeiro do pipeline.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[#74b9f353] bg-[linear-gradient(145deg,rgba(13,43,80,0.98),rgba(7,25,53,0.96))] px-3 py-2.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)]">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Total de opps</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{dashboardProbabilitySummary.totalOpps}</div>
            </div>
            <div className="rounded-xl border border-[#74b9f353] bg-[linear-gradient(145deg,rgba(13,43,80,0.98),rgba(7,25,53,0.96))] px-3 py-2.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)]">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Média</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{dashboardProbabilitySummary.avg.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-[#74b9f353] bg-[linear-gradient(145deg,rgba(13,43,80,0.98),rgba(7,25,53,0.96))] px-3 py-2.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)]">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Mediana</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{dashboardProbabilitySummary.median.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-[#8adba77a] bg-[linear-gradient(145deg,rgba(81,140,128,0.72),rgba(25,71,66,0.58))] px-3 py-2.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)]">
              <div className="text-[11px] font-semibold uppercase text-[#42c592]">Alta confiança</div>
              <div className="mt-1 text-xl font-black text-[#13b981]">{dashboardProbabilitySummary.highConfidence}</div>
            </div>
            <div className="rounded-xl border border-[#f2db6b95] bg-[linear-gradient(145deg,rgba(142,122,93,0.74),rgba(82,63,49,0.58))] px-3 py-2.5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)]">
              <div className="text-[11px] font-semibold uppercase text-[#f18a36]">Baixa confiança</div>
              <div className="mt-1 text-xl font-black text-[#f07819]">{dashboardProbabilitySummary.lowConfidence}</div>
          </div>
        </div>

        <div className="b2g-probability-shell relative mt-5 overflow-hidden rounded-[20px] border border-[#74b9f353] p-4 lg:p-6">
          <div className="relative z-10 space-y-5">
            {dashboardProbabilityLevels.map((level) => (
                <div key={level.id} className="grid grid-cols-[52px_1fr_104px] items-center gap-3">
                  <div className="text-lg font-black text-[#b5cee9] md:text-xl">{level.label}</div>
                  <div className="relative h-[66px]">
                    <div
                      className="absolute left-0 top-1.5 h-[56px] min-w-[170px]"
                      style={{ width: `${level.width}%` }}
                    >
                      <div
                        className="absolute -right-4 top-2 h-[48px] w-8 skew-y-[8deg] rounded-r-xl opacity-75"
                        style={{ background: level.palette[2] }}
                      />
                      <div
                        className="absolute bottom-[-8px] left-4 right-[-10px] h-4 skew-x-[24deg] rounded-b-xl opacity-55"
                        style={{ background: level.palette[2] }}
                      />
                      <div
                        className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[18px] border border-white/25 px-4 text-center shadow-[0_24px_48px_-28px_rgba(0,0,0,0.95)]"
                        style={{
                          background: `linear-gradient(135deg, ${level.palette[0]} 0%, ${level.palette[1]} 55%, ${level.palette[2]} 100%)`,
                          color: level.text
                        }}
                      >
                        <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.42),transparent)] opacity-75" />
                        <div className="text-base font-black leading-none md:text-lg">{level.label}</div>
                        <div className="mt-1 text-xs font-bold md:text-sm">{level.count} oportunidade(s)</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#9fb9d7]">Pipeline</div>
                    <div className="text-sm font-black text-[#dcecff] md:text-base">{formatCurrencyNoCents(level.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#74b9f353] bg-[#0b2243]/75 px-4 py-3 text-sm md:text-base font-medium text-[#c7dff9]">
            Pipeline total analisado nas faixas:
            {' '}
            <span className="font-black text-[#e5f1ff]">{formatCurrencyNoCents(dashboardProbabilitySummary.totalValue)}</span>
          </div>
        </section>

        <section
          className="rounded-[22px] border border-[#78c5ff50] p-4 text-[#d9edff] lg:p-6"
          style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black leading-tight text-[#dcecff]">
                <Thermometer className="h-5 w-5 text-[#74c5ff]" />
                Temperatura do Negócio por Edital
              </h3>
              <p className="mt-1 text-sm font-medium text-[#aac6e4]">
                Filtre por temperatura e fase para visualizar os editais com seus respectivos valores.
              </p>
            </div>

            <select
              value={dashboardPhaseFilter}
              onChange={(event) => setDashboardPhaseFilter(event.target.value)}
            className="h-11 min-w-[260px] rounded-xl border border-[#77bff968] bg-[#091b37] px-4 text-sm font-medium text-[#d8ebff]"
            >
              {dashboardPhaseOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {DASHBOARD_TEMPERATURE_FILTERS.map((item) => {
              const Icon = item.icon;
              const selected = dashboardTemperatureFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDashboardTemperatureFilter(item.id)}
                  className={[
                    'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs md:text-sm font-semibold transition-colors',
                    selected
                      ? 'border-[#87d5ff] bg-[#67c3f6] text-[#10385f]'
                      : 'border-[#78c3ff4f] bg-[#0b2141] text-[#d3e7ff] hover:bg-[#12345f]'
                  ].join(' ')}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[#74b9f353] bg-[#0b2243] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Editais filtrados</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{dashboardTemperatureStats.total}</div>
            </div>
            <div className="rounded-xl border border-[#74b9f353] bg-[#0b2243] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Valor total</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{formatCurrencyNoCents(dashboardTemperatureStats.totalValue)}</div>
            </div>
            <div className="rounded-xl border border-[#74b9f353] bg-[#0b2243] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Ticket médio</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{formatCurrencyNoCents(dashboardTemperatureStats.avgTicket)}</div>
            </div>
            <div className="rounded-xl border border-[#74b9f353] bg-[#0b2243] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Maior edital</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{formatCurrencyNoCents(dashboardTemperatureStats.biggestValue)}</div>
            </div>
          </div>

          {/* Lista de oportunidades ao filtrar por temperatura */}
          {dashboardTemperatureFilter !== 'ALL' && (
            <div className="mt-4 rounded-[18px] border border-[#74b9f353] bg-[#0b2243]/85 p-4">
              <h4 className="mb-3 text-base font-black text-[#dcecff]">
                Oportunidades com temperatura {dashboardTemperatureFilter}%
                <span className="ml-2 text-sm font-medium text-[#8fd1ff]">({dashboardTemperatureRows.length})</span>
              </h4>
              {dashboardTemperatureRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#74b9f353] p-6 text-center text-sm italic text-[#a9c6e3]">
                  Nenhuma oportunidade para esta temperatura.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#74b9f353] text-[10px] uppercase tracking-[0.08em] text-[#9fb9d7]">
                        <th className="px-2 py-2 text-left">Oportunidade</th>
                        <th className="px-2 py-2 text-left">Órgão / Empresa</th>
                        <th className="px-2 py-2 text-left">Vendedor</th>
                        <th className="px-2 py-2 text-right">Valor</th>
                        <th className="px-2 py-2 text-center">Fase</th>
                        <th className="px-2 py-2 text-center">Temp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardTemperatureRows.map((item) => (
                        <tr key={item.id} className="border-b border-[#74b9f322] transition-colors hover:bg-[#0b2243]/50">
                          <td className="px-2 py-2 font-medium text-[#eaf4ff] max-w-[200px] truncate">{item.__title}</td>
                          <td className="px-2 py-2 text-[#aac6e4] max-w-[160px] truncate">{item.__organization}</td>
                          <td className="px-2 py-2 text-[#aac6e4]">{item.owner?.name || '-'}</td>
                          <td className="px-2 py-2 text-right font-semibold text-[#5eb0ff]">{formatCurrencyNoCents(item.__value)}</td>
                          <td className="px-2 py-2 text-center">
                            <span className="inline-block rounded-full border border-[#74b9f353] bg-[#0b2243]/75 px-2 py-0.5 text-[9px]">
                              {item.__stageLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold"
                              style={{
                                background: item.__temperatureBand === 0 ? 'rgba(59,130,246,0.2)' :
                                  item.__temperatureBand <= 25 ? 'rgba(251,191,36,0.2)' :
                                  item.__temperatureBand <= 50 ? 'rgba(249,115,22,0.2)' :
                                  item.__temperatureBand <= 75 ? 'rgba(239,68,68,0.2)' :
                                  'rgba(34,197,94,0.2)',
                                color: item.__temperatureBand === 0 ? '#93c5fd' :
                                  item.__temperatureBand <= 25 ? '#fcd34d' :
                                  item.__temperatureBand <= 50 ? '#fdba74' :
                                  item.__temperatureBand <= 75 ? '#fca5a5' :
                                  '#86efac'
                              }}
                            >
                              {item.__temperatureBand}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.95fr_0.95fr]">
            <div className="rounded-[18px] border border-[#74b9f353] bg-[#0b2243]/85 p-4">
              <h4 className="text-lg md:text-xl font-black text-[#dcecff]">Top editais por valor</h4>

              {dashboardTopEditais.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-[#74b9f353] p-8 text-center text-base md:text-lg xl:text-xl italic text-[#a9c6e3]">
                  Nenhum edital para os filtros selecionados.
                </div>
              ) : (
                <div className="relative mt-4 h-[300px]">
                  <div className="absolute inset-0 flex flex-col justify-between text-xs md:text-sm text-[#97b5d6]">
                    {topEditaisTicks.map((tick, idx) => (
                      <div key={`top-tick-${idx}`} className="relative border-t border-dashed border-[#79afd24a] pt-1">
                        {formatCurrencyAxisK(tick)}
                      </div>
                    ))}
                  </div>

                  <div className="relative z-10 ml-14 flex h-full items-end justify-between gap-4 pb-10">
                    {dashboardTopEditais.map((item) => {
                      const ratio = Math.max(0.02, item.__value / dashboardTopEditaisMaxValue);
                      return (
                        <div key={item.id} className="flex flex-1 flex-col items-center">
                          <div
                            className="w-12 rounded-t-2xl bg-gradient-to-t from-[#1d9ed5] to-[#2cd4f0] shadow-[0_20px_36px_-22px_rgba(0,0,0,0.9)]"
                            style={{ height: `${Math.max(12, Math.round(ratio * 220))}px` }}
                          />
                          <div className="mt-3 line-clamp-2 text-center text-xs md:text-sm font-medium text-[#a8c7e4]">
                            {item.__title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[18px] border border-[#74b9f353] bg-[#0b2243]/85 p-4">
              <h4 className="text-lg md:text-xl font-black text-[#dcecff]">Valor por fase</h4>
              <div className="mt-5 space-y-4">
                {dashboardStageValueRows.map((item) => {
                  const width = (item.value / dashboardStageValueMax) * 100;
                  const meta = DASHBOARD_FUNNEL_META.find((row) => row.id === item.id);
                  return (
                    <div key={item.id}>
                      <div className="mb-1 flex items-center justify-between text-sm md:text-base text-[#aac6e4]">
                        <span>{item.label}</span>
                        <span>{formatCurrencyAxisK(item.value)}</span>
                      </div>
                      <div className="h-5 rounded-full bg-[#143055]">
                        <div
                          className={[
                            'h-5 rounded-full bg-gradient-to-r transition-all duration-500',
                            meta?.gradient || 'from-[#4d8dff] to-[#3c7af1]'
                          ].join(' ')}
                          style={{ width: `${Math.max(item.value > 0 ? 6 : 0, width)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Valor Mensal por Projeto */}
        {monthlyProjectData.months.length > 0 && (
          <section
            className="rounded-[22px] border border-[#78c5ff50] p-5 text-[#d9edff] lg:p-6"
            style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl md:text-2xl font-black leading-tight text-[#dcecff]">
                  Valor Mensal por Projeto
                </h3>
                <p className="mt-1 text-sm md:text-base font-medium text-[#aac6e4]">
                  Valor mensal (recorrente) por cliente, calculado a partir das oportunidades do pipeline.
                </p>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#8dc8ff59] bg-[#2b5f925e]">
                <BarChart3 className="h-6 w-6 text-[#8fd1ff]" />
              </span>
            </div>

            <div className="h-[320px]">
              <Bar
                data={{
                  labels: monthlyProjectData.months.map((m) => {
                    const [y, mo] = m.split('-');
                    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                    return `${months[parseInt(mo, 10) - 1]}/${y}`;
                  }),
                  datasets: monthlyProjectData.datasets
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: 'rgba(195, 216, 240, 0.92)',
                        usePointStyle: true,
                        boxWidth: 10,
                        padding: 12,
                        font: { size: 11, weight: '600' }
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(5, 16, 34, 0.94)',
                      titleColor: '#e8f4ff',
                      bodyColor: '#d3e6fb',
                      borderColor: 'rgba(125, 176, 234, 0.35)',
                      borderWidth: 1,
                      callbacks: {
                        label: (ctx) => {
                          const value = Number(ctx.raw) || 0;
                          return ` ${ctx.dataset.label}: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                      }
                    }
                  },
                  scales: {
                    x: {
                      stacked: true,
                      grid: { color: 'rgba(125, 162, 206, 0.25)' },
                      ticks: { color: 'rgba(195, 216, 240, 0.92)', font: { size: 11, weight: '600' } }
                    },
                    y: {
                      stacked: true,
                      grid: { color: 'rgba(125, 162, 206, 0.25)' },
                      ticks: {
                        color: 'rgba(195, 216, 240, 0.92)',
                        font: { size: 11, weight: '600' },
                        callback: (value) => {
                          if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
                          if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
                          return `R$${value}`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </section>
        )}

        <section
          className="rounded-[22px] border border-[#78c5ff50] p-4 text-[#d9edff] lg:p-6"
          style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
        >
          <h3 className="text-lg font-black leading-tight text-[#dcecff]">Editais e valores</h3>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-2">
            {listRows.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-[#74b9f353] bg-[#0b2243]/80 px-3 py-2.5 lg:flex-row lg:items-start"
              >
                <div className="min-w-0">
                  <div className="line-clamp-1 text-sm font-bold text-[#e6f2ff]">{item.__title}</div>
                  <div className="line-clamp-1 text-xs text-[#adc8e4]">{item.referenceCode || item.__title}</div>
                  <div className="line-clamp-1 text-xs text-[#9eb9d6]">{item.__organization}</div>
                </div>

                <div className="text-right">
                  <div className="text-base font-black text-[#e6f2ff]">{formatCurrencyNoCents(item.__value)}</div>
                  <span
                    className={[
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold',
                      dashboardOutcomeBadgeClass(item.__columnId)
                    ].join(' ')}
                  >
                    {item.__temperatureBand}% • {item.__stageLabel}
                  </span>
                </div>
              </div>
            ))}

            {listRows.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#74b9f353] p-8 text-center text-sm italic text-[#a9c6e3]">
                Nenhum edital encontrado para os filtros atuais.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-[22px] border border-[#78c5ff50] p-5 text-[#d9edff]"
            style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
          >
            <h3 className="flex items-center gap-2 text-lg font-black leading-tight text-[#dcecff]">
              <AlertTriangle className="h-5 w-5 text-[#4cc8ff]" />
              Prazos Críticos
            </h3>
            <p className="mt-1 text-sm text-[#aac6e4]">Licitações com abertura nos próximos 7 dias.</p>

            {dashboardCriticalDeadlines.length === 0 ? (
              <div className="my-10 text-center text-sm italic text-[#a7c4e2]">
                Nenhum prazo crítico para os próximos 7 dias.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {dashboardCriticalDeadlines.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#74b9f353] bg-[#0b2243]/75 px-3 py-2">
                    <div className="line-clamp-1 text-sm font-semibold text-[#e6f2ff]">{item.title}</div>
                    <div className="text-xs text-[#a7c4e2]">
                      {item.organization} • abertura {formatDateFlexible(item.proposalDueDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/b2g-atividades')}
              className="mt-6 w-full rounded-xl border border-[#7abfff66] bg-[#091c37] py-3 text-sm md:text-base font-medium text-[#dbeeff] transition-colors hover:bg-[#12315b]"
            >
              Ver agenda completa
            </button>
          </div>

          <div
            className="rounded-[22px] border border-[#78c5ff50] p-5 text-[#d9edff]"
            style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black leading-tight text-[#dcecff]">Resultados Recentes</h3>
                <p className="mt-1 text-sm text-[#aac6e4]">Últimas decisões e homologações.</p>
              </div>
              <History className="h-6 w-6 text-[#9cb9d8]" />
            </div>

            {primaryResult ? (
              <div className="mt-5 rounded-xl border border-[#74b9f353] bg-[#0b2243]/82 p-3">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#a62a613f]">
                    <Gavel className="h-5 w-5 text-[#ff7da3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-bold text-[#e6f2ff]">
                      {primaryResult.__organization}
                    </div>
                    <div className="line-clamp-1 text-xs text-[#afcae4]">
                      {primaryResult.__title}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-[#e6f2ff]">{formatCurrencyNoCents(primaryResult.__value)}</div>
                    <span
                      className={[
                        'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold',
                        dashboardOutcomeBadgeClass(primaryResult.__columnId)
                      ].join(' ')}
                    >
                      {primaryResult.__stageLabel}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-10 text-center text-sm italic text-[#a7c4e2]">
                Sem resultados recentes para o período filtrado.
              </div>
            )}
          </div>
        </section>

        <section
          className="rounded-[22px] border border-[#78c5ff50] p-5 text-[#d9edff]"
          style={{ background: 'linear-gradient(140deg, rgba(14,47,87,0.93), rgba(8,29,58,0.96))' }}
        >
          <h3 className="flex items-center gap-2 text-lg font-black leading-tight text-[#dcecff]">
            <Workflow className="h-5 w-5 text-[#4cc8ff]" />
            SLA do Fluxo Pré-vendas
          </h3>
          <p className="mt-1 text-sm text-[#aac6e4]">
            Monitoramento das atividades Comercial x Pré-vendas para evitar estouro de prazo.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[#74b9f353] bg-[#0b2243] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#9fb9d7]">Abertas</div>
              <div className="mt-1 text-xl font-black text-[#e3f0ff]">{dashboardSlaStats.open}</div>
            </div>
            <div className="rounded-xl border border-[#f0a2ad8e] bg-[#b7bec85e] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#e54465]">Atrasadas</div>
              <div className="mt-1 text-xl font-black text-[#dc1f45]">{dashboardSlaStats.overdue}</div>
            </div>
            <div className="rounded-xl border border-[#f0df858e] bg-[#bec6cb65] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#cc6700]">Vence 24h</div>
              <div className="mt-1 text-xl font-black text-[#bf5f00]">{dashboardSlaStats.due24h}</div>
            </div>
            <div className="rounded-xl border border-[#8ed0ef8e] bg-[#b7c4d267] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#2089ca]">Vence 48h</div>
              <div className="mt-1 text-xl font-black text-[#1178b8]">{dashboardSlaStats.due48h}</div>
            </div>
            <div className="rounded-xl border border-[#b8a2ef8e] bg-[#b8bfd868] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase text-[#7138f2]">Em revisão</div>
              <div className="mt-1 text-xl font-black text-[#6428ef]">{dashboardSlaStats.inReview}</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#74b9f353] bg-[#0b2243]/72 p-4">
            <div className="text-sm font-semibold text-[#dcecff]">Demandas críticas e próximas do vencimento</div>
            <p className="mt-2 text-sm text-[#a9c6e3]">
              {dashboardCriticalActivity
                ? `${dashboardCriticalActivity.subject || 'Atividade sem título'} • vence em ${formatDateFlexible(dashboardCriticalActivity.dueDate)}`
                : 'Nenhuma atividade com SLA crítico no momento.'}
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/b2g-atividades')}
              className="inline-flex items-center gap-3 rounded-xl border border-[#7abfff66] bg-[#091c37] px-6 py-3 text-sm md:text-base font-medium text-[#dbeeff] transition-colors hover:bg-[#12315b]"
            >
              Abrir fluxo
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
        </section>

        <PresentationControls
          active={dashboardPresentationMode}
          current={dashboardPresentationProgress.current}
          total={dashboardPresentationProgress.total}
          canPrevious={dashboardPresentationProgress.current > 1}
          canNext={dashboardPresentationProgress.current < dashboardPresentationProgress.total}
          onPrevious={() => scrollDashboardPresentation(-1)}
          onNext={() => scrollDashboardPresentation(1)}
          onExit={handleDashboardFullscreen}
        />
      </div>
    );
  };

  const renderB2GStrategicDashboardV2 = () => {
    const palette = ['#ef3b36', '#f08a3a', '#efe58a', '#9ccc4b', '#45c96f', '#21bfe0', '#2784d6', '#3867d6', '#7048d1', '#8a43cf'];
    const selectedPhaseTone = dashboardPhaseFilter !== 'ALL'
      ? (DASHBOARD_STAGE_TONES[dashboardPhaseFilter] || '#ff7a00')
      : null;
    const activeDashboardTone = selectedPhaseTone || (
      dashboardForecastScore >= 70 ? '#22c55e' : dashboardForecastScore >= 45 ? '#f6b40b' : '#ff7a00'
    );
    const valueMetricBase = Math.max(
      Number(dashboardTotals.pipelineValue || 0),
      Number(dashboardTotals.monthlyValue || 0),
      Number(dashboardTotals.wonValue || 0),
      Number(dashboardTotals.projectedValue || 0),
      1
    );
    const stageLevels = [
      { value: 0, label: 'Frio', color: palette[0] },
      { value: 25, label: 'Amarelo Claro', color: palette[2] },
      { value: 50, label: 'Verde / Qualificado', color: palette[4] },
      { value: 75, label: 'Ciano / Quente', color: palette[5] },
      { value: 100, label: dashboardPhaseFilter === 'GANHO' ? 'Ganho' : 'Fechado', color: dashboardPhaseFilter === 'GANHO' ? '#22c55e' : palette[9] }
    ];
    const monthTotals = monthlyProjectData.months.map((_, monthIndex) => (
      monthlyProjectData.datasets.reduce((sum, dataset) => sum + Number(dataset.data?.[monthIndex] || 0), 0)
    ));
    const monthLabels = monthlyProjectData.months.map((month) => {
      const [year, monthNumber] = month.split('-').map(Number);
      return new Date(year, monthNumber - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
    });
    const deadlineAlerts = dashboardCriticalDeadlines.slice(0, 3).map((item, index) => ({
      id: item.id || `deadline-${index}`,
      title: item.title || item.name || 'Edital com prazo crítico',
      detail: `${item.organization || item.agency || 'Orgão não informado'} • prazo ${formatDateFlexible(item.proposalDueDate)}`,
      tone: index === 0 ? 'red' : 'yellow'
    }));
    const openingAlerts = opportunityOpeningAlerts.slice(0, 4).map((item) => ({
      id: item.opportunityId || item.id,
      title: item.title || item.projectName || 'Oportunidade com abertura próxima',
      detail: `${item.company?.name || 'Órgão não informado'} • abertura ${formatDateFlexible(item.openingDate)}`,
      tone: item.alertType === 'TODAY' ? 'red' : item.alertType === 'TOMORROW' ? 'yellow' : 'blue'
    }));
    const activityAlert = dashboardCriticalActivity ? [{
      id: dashboardCriticalActivity.id || 'critical-activity',
      title: dashboardCriticalActivity.subject || 'Atividade com SLA crítico',
      detail: `Vencimento ${formatDateFlexible(dashboardCriticalActivity.dueDate)}`,
      tone: 'blue'
    }] : [];
    const stageChartRows = dashboardStageValueRows.filter((row) => Number(row.value) > 0).slice(0, 8);
    const b2gOpportunityCharts = (() => {
      const rows = dashboardTemperatureRows;
      const byModality = new Map();
      const byOrganization = new Map();
      const byStage = new Map();
      const deadlineBuckets = [
        { label: 'Vencidos', min: Number.NEGATIVE_INFINITY, max: -1, count: 0, value: 0, color: '#f43f5e' },
        { label: '0-7d', min: 0, max: 7, count: 0, value: 0, color: '#f59e0b' },
        { label: '8-15d', min: 8, max: 15, count: 0, value: 0, color: '#ff7a00' },
        { label: '16-30d', min: 16, max: 30, count: 0, value: 0, color: '#22c55e' },
        { label: '+30d', min: 31, max: Number.POSITIVE_INFINITY, count: 0, value: 0, color: '#818cf8' }
      ];

      rows.forEach((item) => {
        const modality = item.modality || item.type || item.noticeType || 'Não informado';
        const organization = item.__organization || 'Órgão não informado';
        const stage = item.__stageLabel || 'Análise';
        const weightedValue = item.__value * (item.__probability / 100);

        const modalityRow = byModality.get(modality) || { label: modality, count: 0, value: 0, weightedValue: 0 };
        modalityRow.count += 1;
        modalityRow.value += item.__value;
        modalityRow.weightedValue += weightedValue;
        byModality.set(modality, modalityRow);

        const organizationRow = byOrganization.get(organization) || { label: organization, count: 0, value: 0, weightedValue: 0 };
        organizationRow.count += 1;
        organizationRow.value += item.__value;
        organizationRow.weightedValue += weightedValue;
        byOrganization.set(organization, organizationRow);

        const stageRow = byStage.get(stage) || { label: stage, count: 0, value: 0, weightedValue: 0 };
        stageRow.count += 1;
        stageRow.value += item.__value;
        stageRow.weightedValue += weightedValue;
        byStage.set(stage, stageRow);

        const dueTimestamp = toTimestamp(item.proposalDueDate || item.openingDate || item.dueDate);
        if (dueTimestamp > 0) {
          const daysToDue = Math.ceil((dueTimestamp - Date.now()) / (24 * 60 * 60 * 1000));
          const bucket = deadlineBuckets.find((entry) => daysToDue >= entry.min && daysToDue <= entry.max);
          if (bucket) {
            bucket.count += 1;
            bucket.value += item.__value;
          }
        }
      });

      const modalityRows = Array.from(byModality.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
      const organizationRows = Array.from(byOrganization.values())
        .sort((a, b) => b.weightedValue - a.weightedValue)
        .slice(0, 6);
      const stageRows = Array.from(byStage.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
      const criticalRows = rows
        .filter((item) => !['GANHO', 'PERDIDO', 'NO_GO'].includes(item.__columnId))
        .slice()
        .sort((a, b) => {
          const aDue = toTimestamp(a.proposalDueDate || a.openingDate || a.dueDate) || Number.MAX_SAFE_INTEGER;
          const bDue = toTimestamp(b.proposalDueDate || b.openingDate || b.dueDate) || Number.MAX_SAFE_INTEGER;
          return aDue - bDue || b.__value - a.__value;
        })
        .slice(0, 5);

      return { modalityRows, organizationRows, stageRows, deadlineBuckets, criticalRows };
    })();

    return (
      <div
        ref={dashboardPresentationRef}
        className={dashboardPresentationMode ? 'h-screen overflow-y-auto overflow-x-hidden bg-[#0b1322] p-2 pb-24' : ''}
      >
        <PipelineDashboardModel
          title="Dashboard Estratégico B2G"
          subtitle="Performance comercial e pipeline de governo"
          controls={(
            <>
              <button type="button" onClick={() => navigate('/b2g-analise')}><Plus className="h-4 w-4" /> Nova Licitação</button>
              <select value={dashboardPeriod} onChange={(event) => setDashboardPeriod(event.target.value)} aria-label="Período">
                {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={dashboardOwnerFilter} onChange={(event) => setDashboardOwnerFilter(event.target.value)} aria-label="Vendedor">
                <option value="ALL">Todos os vendedores</option>
                {[...new Map(opportunities.filter(o => o.owner?.id).map(o => [o.owner.id, o.owner])).values()].map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.name}</option>
                ))}
              </select>
              <select value={dashboardPhaseFilter} onChange={(event) => setDashboardPhaseFilter(event.target.value)} aria-label="Fase">
                {dashboardPhaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={dashboardTemperatureFilter} onChange={(event) => setDashboardTemperatureFilter(event.target.value)} aria-label="Temperatura">
                {DASHBOARD_TEMPERATURE_FILTERS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <button type="button" onClick={() => setShowOpportunityAlertsModal(true)} title="Alertas de abertura" aria-label="Abrir alertas de abertura">
                <AlertTriangle className="h-4 w-4" />
                {opportunityOpeningAlerts.length > 0 ? opportunityOpeningAlerts.length : ''}
              </button>
              <button type="button" onClick={() => { loadNotices({ preserveSelection: true }); loadSupportData(); }} title="Atualizar dados" aria-label="Atualizar dados"><RefreshCcw className="h-4 w-4" /></button>
              <button type="button" onClick={handleDashboardFullscreen} title="Apresentação" aria-label="Abrir apresentação"><Maximize2 className="h-4 w-4" /></button>
            </>
          )}
          metrics={[
            { label: 'Valor Total Filtrado', value: formatCompactCurrency(dashboardTotals.pipelineValue), percent: (dashboardTotals.pipelineValue / valueMetricBase) * 100, color: activeDashboardTone },
            { label: 'Valor Mensal', value: formatCompactCurrency(dashboardTotals.monthlyValue), percent: (dashboardTotals.monthlyValue / valueMetricBase) * 100, color: '#18c8df' },
            { label: 'Valor Ganho', value: formatCompactCurrency(dashboardTotals.wonValue), percent: (dashboardTotals.wonValue / valueMetricBase) * 100, color: '#22c55e' },
            { label: 'Taxa de Vitória', value: `${dashboardTotals.winRate.toFixed(1)}%`, percent: dashboardTotals.winRate, color: '#ff7a00', secondaryColor: '#f6b40b' }
          ]}
          funnel={(
            <B2GFunnelStrategic
              funnelRows={dashboardFunnelRows}
              activeStage={dashboardPhaseFilter}
              selectedTemperature={dashboardTemperatureFilter}
            />
          )}
          funnelTitle="Funil de Licitações B2G"
          funnelSubtitle="Editais e oportunidades por fase"
          temperature={dashboardForecastScore}
          temperatureColor={activeDashboardTone}
          temperatureLevels={stageLevels}
          performanceChart={{
            title: 'Performance do Pipeline',
            subtitle: 'Valores por situação comercial',
            labels: dashboardProjectionBars.map((row) => row.label),
            values: dashboardProjectionBars.map((row) => Number(row.value || 0)),
            colors: ['#ff7a00', '#f6b40b', '#22c55e', '#18c8df'],
            targetPercent: 85
          }}
          trendChart={{
            title: 'Tendência Mensal',
            subtitle: 'Valor mensal e projeção ponderada',
            labels: monthLabels,
            datasets: [
              { label: 'Pipeline', data: monthTotals, color: '#ff7a00', fill: true, fillColor: 'rgba(255, 122, 0, 0.20)' },
              { label: 'Projeção', data: monthTotals.map((value) => value * (dashboardForecastScore / 100)), color: '#22c55e', fill: false }
            ]
          }}
          table={{
            title: 'Performance de Editais',
            subtitle: 'Maiores oportunidades filtradas',
            columns: [
              { label: 'Órgão' },
              { label: 'Edital' },
              { label: 'Valor', align: 'right' },
              { label: 'Prob.', align: 'right' }
            ],
            rows: dashboardTopEditais.slice(0, 5).map((item, index) => ({
              id: item.id || `edital-${index}`,
              cells: [item.__organization, item.__title, formatCurrencyNoCents(item.__value), `${item.__probability}%`]
            }))
          }}
          alerts={{
            title: 'Alertas do Pipeline',
            subtitle: 'Prazos e atividades prioritárias',
            items: [...openingAlerts, ...deadlineAlerts, ...activityAlert].slice(0, 4)
          }}
          teamChart={{
            title: 'Performance por Etapa',
            subtitle: 'Valor acumulado no funil B2G',
            labels: stageChartRows.map((row) => row.label),
            datasets: [{ label: 'Valor', data: stageChartRows.map((row) => Number(row.value || 0)), colors: ['#ff7a00', '#f6b40b', '#22c55e', '#18c8df', '#1f7fe5', '#ef4444'] }]
          }}
          presentationControls={(
            <PresentationControls
              active={dashboardPresentationMode}
              current={dashboardPresentationProgress.current}
              total={dashboardPresentationProgress.total}
              canPrevious={dashboardPresentationProgress.current > 1}
              canNext={dashboardPresentationProgress.current < dashboardPresentationProgress.total}
              onPrevious={() => scrollDashboardPresentation(-1)}
              onNext={() => scrollDashboardPresentation(1)}
              onExit={handleDashboardFullscreen}
            />
          )}
        />

        {(opportunityOpeningAlertsLoading || opportunityOpeningAlerts.length > 0) && (
          <section className="mt-5 px-2">
            <div className="dashboard-card border border-[#f6b40b66] bg-[#10213f]/92 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-[#f4f7fb]">
                    <AlertTriangle className="h-5 w-5 text-[#f6b40b]" />
                    Alertas de abertura
                  </h3>
                  <p className="mt-1 text-sm text-[#9fb1c8]">
                    Oportunidades B2G com abertura próxima.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOpportunityAlertsModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#f6b40b77] bg-[#2a210b] px-4 py-2 text-sm font-bold text-[#ffe9a8] transition hover:bg-[#3b2f10]"
                >
                  Ver todos
                  {opportunityOpeningAlerts.length > 0 ? (
                    <span className="rounded-full bg-[#f6b40b] px-2 py-0.5 text-xs text-[#07101f]">
                      {opportunityOpeningAlerts.length}
                    </span>
                  ) : null}
                </button>
              </div>

              {opportunityOpeningAlertsLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#2b3f5f] bg-[#081326] px-4 py-3 text-sm text-[#9fb1c8]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando alertas...
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-3">
                  {opportunityOpeningAlerts.slice(0, 3).map((alert) => (
                    <button
                      type="button"
                      key={alert.opportunityId || alert.id}
                      onClick={() => navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${alert.opportunityId || alert.id}&mode=view`)}
                      className="rounded-xl border border-[#f6b40b55] bg-[#07101f]/75 p-4 text-left transition hover:border-[#f6b40b] hover:bg-[#111d34]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="block truncate text-sm font-black text-[#f4f7fb]">
                            {alert.title || alert.projectName || 'Oportunidade sem título'}
                          </strong>
                          <p className="mt-1 truncate text-xs font-semibold text-[#9fb1c8]">
                            {alert.company?.name || 'Órgão não informado'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#f6b40b22] px-2 py-1 text-xs font-black text-[#f6b40b]">
                          {alert.alertLabel || 'Abertura'}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-[#dbe7f5]">
                        {formatDateFlexible(alert.openingDate)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-5 grid gap-4 px-2 pb-6 xl:grid-cols-2">
          <DashboardAdvancedChart
            title="Valor por Modalidade"
            subtitle="Ranking das modalidades com maior pipeline filtrado"
            icon={<Gavel className="h-4 w-4" />}
            type="bar"
            colorTheme="cool"
            data={{
              labels: b2gOpportunityCharts.modalityRows.map((row) => row.label),
              datasets: [
                {
                  label: 'Valor estimado',
                  data: b2gOpportunityCharts.modalityRows.map((row) => row.value),
                  backgroundColor: 'rgba(255, 122, 0, 0.78)',
                  borderRadius: 8
                },
                {
                  label: 'Valor ponderado',
                  data: b2gOpportunityCharts.modalityRows.map((row) => row.weightedValue),
                  backgroundColor: 'rgba(34, 197, 94, 0.76)',
                  borderRadius: 8
                }
              ]
            }}
            isEmpty={b2gOpportunityCharts.modalityRows.length === 0}
          />

          <DashboardAdvancedChart
            title="Órgãos com Maior Forecast"
            subtitle="Valor ponderado por probabilidade de vitória"
            icon={<Landmark className="h-4 w-4" />}
            type="bar"
            colorTheme="blue"
            data={{
              labels: b2gOpportunityCharts.organizationRows.map((row) => row.label),
              datasets: [
                {
                  label: 'Forecast',
                  data: b2gOpportunityCharts.organizationRows.map((row) => row.weightedValue),
                  backgroundColor: 'rgba(246, 180, 11, 0.76)',
                  borderRadius: 8
                }
              ]
            }}
            isEmpty={b2gOpportunityCharts.organizationRows.length === 0}
          />
        </section>

        <section className="grid gap-4 px-2 pb-8 xl:grid-cols-[1fr_1fr_1.1fr]">
          <DashboardAdvancedChart
            title="Valor por Fase"
            subtitle="Pipeline nominal agrupado pela fase B2G"
            icon={<BarChart3 className="h-4 w-4" />}
            type="doughnut"
            colorTheme="multi"
            data={{
              labels: b2gOpportunityCharts.stageRows.map((row) => row.label),
              datasets: [
                {
                  data: b2gOpportunityCharts.stageRows.map((row) => row.value),
                  backgroundColor: ['#ff7a00', '#f6b40b', '#22c55e', '#18c8df', '#1f7fe5', '#ef4444', '#34d399', '#fb923c'],
                  borderColor: '#050914',
                  borderWidth: 2
                }
              ]
            }}
            isEmpty={b2gOpportunityCharts.stageRows.length === 0}
          />

          <DashboardAdvancedChart
            title="Risco de Prazo"
            subtitle="Editais por janela até abertura ou entrega"
            icon={<Clock3 className="h-4 w-4" />}
            type="bar"
            colorTheme="warning"
            data={{
              labels: b2gOpportunityCharts.deadlineBuckets.map((row) => row.label),
              datasets: [
                {
                  label: 'Editais',
                  data: b2gOpportunityCharts.deadlineBuckets.map((row) => row.count),
                  backgroundColor: b2gOpportunityCharts.deadlineBuckets.map((row) => row.color),
                  borderRadius: 8
                }
              ]
            }}
            isEmpty={!b2gOpportunityCharts.deadlineBuckets.some((row) => row.count > 0)}
          />

          <div className="dashboard-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Prioridade B2G</h3>
                <p className="mt-1 text-xs text-slate-500">Prazos mais próximos com maior impacto comercial</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-slate-400" />
            </div>
            <div className="space-y-2">
              {b2gOpportunityCharts.criticalRows.length > 0 ? b2gOpportunityCharts.criticalRows.map((item, index) => (
                <div key={item.id || `critical-b2g-${index}`} className="rounded-lg border border-slate-500/20 bg-slate-500/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-100">{item.__title}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.__organization} • prazo {formatDateFlexible(item.proposalDueDate || item.openingDate || item.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-cyan-200">{formatCurrencyNoCents(item.__value)}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{item.__probability}%</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="grid min-h-[120px] place-items-center rounded-lg border border-dashed border-slate-500/25 text-sm text-slate-500">
                  Nenhuma prioridade crítica no filtro atual.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  };

  // Função para buscar editais com filtros TI
  const handleBuscarComFiltrosTI = async (filtros) => {
    try {
      setLoading(true);
      
      const payload = {
        categorias: filtros.categoriasSelecionadas,
        termoLivre: filtros.termoLivre,
        uf: advancedFilters.stateCode,
        pagina: 1,
        tamanhoPagina: 50
      };

      const response = await fetch(buildApiUrl('/api/filtros-ti/buscar'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Integrar resultados com o sistema existente
          const editaisFiltrados = result.data.editais || [];
          setNotices(editaisFiltrados);
          
          setFeedback({
            type: 'success',
            message: `Encontrados ${editaisFiltrados.length} editais com filtros TI aplicados`
          });
        }
      } else {
        throw new Error('Erro na busca com filtros TI');
      }
    } catch (error) {
      console.error('Erro ao buscar com filtros TI:', error);
      setFeedback({
        type: 'error',
        message: 'Erro ao aplicar filtros TI. Usando busca tradicional.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback.message && (
        <div
          className={[
            'crm-card px-4 py-3 text-sm border',
            feedback.type === 'error'
              ? 'border-red-500/30 text-red-700 dark:text-red-200'
              : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-200'
          ].join(' ')}
        >
          {feedback.message}
        </div>
      )}

      {loading || supportLoading ? (
        <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Carregando módulo B2G...
        </div>
      ) : activeTab === 'dashboard' ? (
        <div className="space-y-4">
          {renderB2GStrategicDashboardV2()}
        </div>
      ) : activeTab === 'leads' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnimatedStats
              title="Leads filtrados"
              value={filteredLeads.length}
              subtitle="Base atual"
              icon={Users}
              color="blue"
            />
            <AnimatedStats
              title="Prospects"
              value={filteredLeads.filter((item) => item?.status === 'PROSPECT').length}
              subtitle="Em qualificação"
              icon={Target}
              color="purple"
            />
            <AnimatedStats
              title="Hot leads"
              value={filteredLeads.filter((item) => Number(item?.leadScore || 0) >= 80).length}
              subtitle="Score 80+"
              icon={AlertTriangle}
              color="orange"
            />
            <AnimatedStats
              title="Cobertura UF"
              value={leadRegionalCoverage}
              subtitle="Estados com lead"
              icon={Building2}
              color="green"
            />
          </div>

          {renderAdvancedFilters({ title: 'Filtros de Leads B2G', showModality: false })}

          <div className="crm-card p-4">
            <label className="text-xs font-semibold text-[var(--crm-muted)]">Buscar lead</label>
            <input
              className="crm-input mt-1"
              placeholder="Empresa, segmento, cidade ou status"
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLeads.map((item) => (
              <div key={item.id} className="crm-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-[var(--crm-ink)] truncate">{item.name}</div>
                    <div className="text-xs text-[var(--crm-muted)]">{item.segment || 'Segmento não informado'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[color:var(--crm-border)] px-2 py-1 text-[11px] font-semibold text-[var(--crm-muted)]">
                      {COMPANY_STATUS_LABELS[item.status] || item.status || '-'}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLead(item)}
                        disabled={deletingLeadId === item.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/35 text-red-600 transition-all hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Excluir lead"
                      >
                        {deletingLeadId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-[var(--crm-muted)]">
                  <div>Cidade: {[item.city, item.state].filter(Boolean).join(' - ') || '-'}</div>
                  <div>Lead score: {Number(item.leadScore || 0)}</div>
                  <div>Status: {COMPANY_STATUS_LABELS[item.status] || item.status || '-'}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openLeadAnalysis(item)}
                    className="crm-btn crm-btn-secondary h-10 px-4"
                  >
                    <Eye className="h-4 w-4" />
                    Analisar
                  </button>
                  <span className="inline-flex h-10 items-center rounded-xl border border-[color:var(--crm-border)] px-3 text-xs font-semibold text-[var(--crm-muted)]">
                    {inferLeadDecision(item) === 'NO_GO'
                      ? 'NO GO'
                      : inferLeadDecision(item) === 'GO'
                        ? 'GO'
                        : 'Em análise'}
                  </span>
                </div>
              </div>
            ))}

            {filteredLeads.length === 0 && (
              <div className="md:col-span-2 xl:col-span-3 crm-panel p-8 text-center text-[var(--crm-muted)]">
                Nenhum lead encontrado para os filtros aplicados.
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'oportunidades' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnimatedStats
              title="Oportunidades"
              value={filteredOpportunities.length}
              subtitle="Pipeline filtrado"
              icon={Target}
              color="blue"
            />
            <AnimatedStats
              title="Em aberto"
              value={openOpportunitiesCount}
              subtitle="Sem ganho/perda"
              icon={Workflow}
              color="purple"
            />
            <AnimatedStats
              title="Alta probabilidade"
              value={highProbabilityOpportunities}
              subtitle="Probabilidade 70%+"
              icon={TrendingUp}
              color="green"
            />
            <AnimatedStats
              title="Ganhas"
              value={
                filteredOpportunities.filter(
                  (item) => resolveKanbanColumnId(item?.b2gStage || item?.stage) === 'GANHO'
                ).length
              }
              subtitle="Conversão efetiva"
              icon={CheckCircle2}
              color="orange"
            />
          </div>

          <div className="crm-panel p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/b2g-atividades')}
                  className="crm-btn crm-btn-secondary h-10 px-4"
                >
                  <Workflow className="h-4 w-4" />
                  Atividades
                </button>

                <div className="inline-flex items-center gap-1 rounded-2xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.45)] p-1">
                  <button
                    type="button"
                    onClick={() => setOpportunitiesViewMode('list')}
                    className={[
                      'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all',
                      opportunitiesViewMode === 'list'
                        ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.22)] text-[var(--crm-ink)]'
                        : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
                    ].join(' ')}
                  >
                    <List className="h-4 w-4" />
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpportunitiesViewMode('kanban')}
                    className={[
                      'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all',
                      opportunitiesViewMode === 'kanban'
                        ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.22)] text-[var(--crm-ink)]'
                        : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
                    ].join(' ')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Kanban
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowOpportunityAlertsModal(true)}
                className="crm-btn crm-btn-secondary h-10 px-4"
              >
                <AlertTriangle className="h-4 w-4" />
                Alertas
                {opportunityOpeningAlerts.length > 0 && (
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[11px] font-black text-white">
                    {opportunityOpeningAlerts.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleNewOpportunity}
                className="crm-btn crm-btn-primary h-10 px-4"
              >
                <Plus className="h-4 w-4" />
                Nova Oportunidade
              </button>
            </div>
          </div>

          {(opportunityOpeningAlertsLoading || opportunityOpeningAlerts.length > 0) && (
            <div className="crm-panel p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-black text-[var(--crm-ink)]">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                    Alertas de abertura
                  </h3>
                  <p className="text-xs text-[var(--crm-muted)]">Oportunidades em proposta com abertura nos próximos 5 dias.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOpportunityAlertsModal(true)}
                  className="crm-btn crm-btn-secondary h-9 px-3 text-xs"
                >
                  Ver todos
                </button>
              </div>

              {opportunityOpeningAlertsLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--crm-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando alertas...
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {opportunityOpeningAlerts.slice(0, 3).map((alert) => (
                    <button
                      key={alert.opportunityId}
                      type="button"
                      onClick={() => navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(alert.opportunityId)}&mode=view`)}
                      className="rounded-2xl border border-orange-400/30 bg-orange-500/10 p-3 text-left transition-all hover:border-orange-300/60 hover:bg-orange-500/15"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-[var(--crm-ink)]">{alert.title || 'Oportunidade B2G'}</div>
                          <div className="mt-1 truncate text-xs text-[var(--crm-muted)]">{alert.company?.name || 'Órgão não informado'}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-1 text-[11px] font-black text-orange-200">
                          {alert.daysUntilOpening === 0 ? 'Hoje' : `${alert.daysUntilOpening}d`}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-[var(--crm-muted)]">
                        Abertura: <span className="font-semibold text-[var(--crm-ink)]">{formatDateFlexible(alert.openingDate)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="crm-panel p-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--crm-muted)]" />
                <input
                  className="crm-input pl-10"
                  placeholder="Buscar por cliente, código da oportunidade ou escopo..."
                  value={opportunitySearch}
                  onChange={(e) => setOpportunitySearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowOpportunityFilters((prev) => !prev)}
                className="crm-btn crm-btn-secondary h-11 px-4"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
              </button>
              <button
                type="button"
                onClick={() => setOpportunitySortMode((prev) => (prev === 'probability' ? 'value' : 'probability'))}
                className="crm-btn crm-btn-secondary h-11 px-4"
              >
                <ArrowUpDown className="h-4 w-4" />
                Ordenar: {opportunitySortMode === 'probability' ? 'Probabilidade' : 'Valor'}
              </button>
            </div>
          </div>

          {showOpportunityFilters && renderAdvancedFilters({ title: 'Filtros de Oportunidades B2G', showModality: true })}

          {opportunitiesViewMode === 'kanban' ? (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {opportunityKanbanColumns.map((column) => {
                  const isDragOver = dragOverOpportunityColumn === column.id && !!draggedOpportunityId;
                  const isOutcomeColumn = KANBAN_FINAL_COLUMNS.has(column.id);
                  const nextColumnId = getNextKanbanColumnId(column.id);

                  // Cor por etapa
                  const stageColorMap = {
                    ANALISE: '#60a5fa', PROPOSTA_ENVIADA: '#fbbf24', HABILITACAO: '#34d399',
                    RECURSO: '#f87171', SUSPENSO: '#94a3b8', HOMOLOGADO: '#a78bfa',
                    CONCLUIDO: '#10b981', GANHO: '#10b981', NO_GO: '#f59e0b', PERDIDO: '#ef4444'
                  };
                  const colColor = stageColorMap[column.id] || '#94a3b8';
                  const colTotal = column.items.reduce((s, i) => s + (i.value || 0), 0);

                  return (
                    <div
                      key={column.id}
                      className={`min-w-[300px] max-w-[300px] rounded-2xl border bg-[var(--crm-surface)] p-4 transition-all duration-200 ${
                        isDragOver ? 'ring-2 ring-blue-400/60 shadow-lg' : 'border-[var(--crm-border)]'
                      }`}
                      onDragOver={(event) => handleKanbanDragOver(event, column.id)}
                      onDragEnter={(event) => handleKanbanDragOver(event, column.id)}
                      onDragLeave={handleKanbanDragLeave}
                      onDrop={(event) => handleKanbanDrop(event, column.id)}
                    >
                      {/* Header */}
                      <div className="mb-4 pb-3 border-b-2" style={{ borderColor: colColor }}>
                        <h3 className="text-sm font-bold mb-1.5" style={{ color: colColor }}>
                          {column.label}
                        </h3>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--crm-muted)]">
                            {column.items.length} oportunidade{column.items.length !== 1 ? 's' : ''}
                          </span>
                          <span className="font-bold text-[var(--crm-ink)]">
                            {formatCurrency(colTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Cards */}
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-0.5">
                        {column.items.length === 0 ? (
                          <div className={`flex flex-col items-center justify-center py-10 text-[var(--crm-muted)] rounded-2xl border border-dashed border-[var(--crm-border)] transition-all ${isDragOver ? 'bg-blue-500/5' : ''}`}>
                            <Target className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-xs">{isDragOver ? 'Solte aqui' : 'Nenhuma oportunidade nesta etapa'}</p>
                          </div>
                        ) : (
                          column.items.map((item) => {
                            const itemId = normalizeEntityId(item.id);
                            const isDragging = draggedOpportunityId === itemId;
                            const isMovingItem = movingOpportunityId === itemId;
                            const canDrag = !movingOpportunityId || isMovingItem;

                            return (
                              <div
                                key={item.id}
                                draggable={canDrag}
                                onDragStart={(event) => handleKanbanDragStart(event, item)}
                                onDragEnd={handleKanbanDragEnd}
                                onClick={() => openOpportunityDetails(item)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter') openOpportunityDetails(item); }}
                                className={`group relative rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-400/40 ${
                                  isDragging ? 'opacity-50 rotate-1 scale-95' : ''
                                } ${canDrag ? 'cursor-move' : 'cursor-pointer'}`}
                              >
                                  <div className="mb-2 flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 flex-1 items-start gap-1.5">
                                      <span className="mt-0.5 shrink-0 text-xs text-[var(--crm-muted)]">⋮⋮</span>
                                      <div className="min-w-0 w-full">
                                        {/* 1º — Nome do cliente/órgão */}
                                        {item.company?.name && (
                                          <p className="line-clamp-2 text-sm font-bold leading-snug text-[var(--crm-ink)]">
                                            {item.company.name}
                                          </p>
                                        )}
                                        {/* 2º — Nome do projeto */}
                                        <p className={`line-clamp-1 leading-snug ${item.company?.name ? 'mt-0.5 text-xs text-[var(--crm-muted)]' : 'text-sm font-bold text-[var(--crm-ink)]'}`}>
                                          {item.projectName || item.title || 'Oportunidade sem título'}
                                        </p>
                                        {/* Número */}
                                        {item.number && (
                                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--crm-accent)]">
                                            {item.number}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleEditOpportunity(item);
                                      }}
                                      className="shrink-0 rounded-lg p-1 text-[var(--crm-muted)] opacity-0 transition-all hover:bg-[var(--crm-bg)] hover:text-[var(--crm-accent)] group-hover:opacity-100"
                                      title="Editar"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  <p className="mb-3 text-base font-extrabold text-emerald-400">
                                    {formatCurrency(item.value)}
                                  </p>

                                  {column.id === 'RECURSO' && renderB2GResourceSummary(item)}

                                  {isOutcomeColumn && renderStageDecisionSummary(item, { compact: true })}

                                  <div className="mb-3 space-y-1.5 text-xs text-[var(--crm-muted)]">
                                    {item.projectClientType && (
                                      <div className="flex items-center gap-1.5">
                                        <BarChart3 className="h-3 w-3 shrink-0" />
                                        <span>{PROJECT_CLIENT_TYPE_LABELS[item.projectClientType] || item.projectClientType}</span>
                                      </div>
                                    )}
                                    {item.company?.name && (
                                      <div className="flex items-center gap-1.5">
                                        <Building2 className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{item.company.name}</span>
                                      </div>
                                    )}
                                    {item.owner?.name && (
                                      <div className="flex items-center gap-1.5">
                                        <User className="h-3 w-3 shrink-0" />
                                        <span>{item.owner.name}</span>
                                      </div>
                                    )}
                                    {item.probability > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <Percent className="h-3 w-3 shrink-0" />
                                        <span>{item.probability}% de chance</span>
                                      </div>
                                    )}
                                    {item.expectedCloseDate && (
                                      <div className="flex items-center gap-1.5">
                                        <CalendarClock className="h-3 w-3 shrink-0" />
                                        <span>{new Date(item.expectedCloseDate).toLocaleDateString('pt-BR')}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--crm-border)]">
                                    <div
                                      className="h-1.5 rounded-full bg-emerald-500 transition-all"
                                      style={{ width: `${Math.min(100, item.probability || 0)}%` }}
                                    />
                                  </div>

                                  {!isOutcomeColumn && (
                                    <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--crm-border)] pt-3">
                                      {nextColumnId && (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            moveOpportunityToKanbanColumn(item, nextColumnId);
                                          }}
                                          disabled={isMovingItem}
                                          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                          Avançar <ArrowRight className="h-3 w-3" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          moveOpportunityToKanbanColumn(item, 'GANHO');
                                        }}
                                        disabled={isMovingItem}
                                        className="flex items-center justify-center rounded-xl bg-emerald-600 p-1.5 text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                                        title="Marcar como Ganho"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          moveOpportunityToKanbanColumn(item, 'NO_GO');
                                        }}
                                        disabled={isMovingItem}
                                        className="flex items-center justify-center rounded-xl bg-amber-600 p-1.5 text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
                                        title="Registrar NO GO"
                                      >
                                        <ThumbsDown className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          moveOpportunityToKanbanColumn(item, 'PERDIDO');
                                        }}
                                        disabled={isMovingItem}
                                        className="flex items-center justify-center rounded-xl bg-red-600 p-1.5 text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
                                        title="Marcar como Perdido"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleDeleteOpportunity(item);
                                          }}
                                          disabled={deletingOpportunityId === item.id}
                                          className="flex items-center justify-center rounded-xl border border-red-500/30 p-1.5 text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-70"
                                          title="Excluir"
                                        >
                                          {deletingOpportunityId === item.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {stageDistribution.map((item) => (
                  <div key={item.stage} className="crm-card p-4">
                    <div className="text-sm font-semibold text-[var(--crm-ink)]">
                      {OPPORTUNITY_STAGE_LABELS[item.stage] || item.stage}
                    </div>
                    <div className="mt-2 text-xs text-[var(--crm-muted)]">Quantidade: {item.count}</div>
                    <div className="text-xs text-[var(--crm-muted)]">Valor: {formatCurrency(item.value)}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedFilteredOpportunities.map((item) => (
                  <div
                    key={item.id}
                    className="crm-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft-xl cursor-pointer"
                    onClick={() => openOpportunityDetails(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openOpportunityDetails(item);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {item.number && (
                      <div className="mb-2 inline-flex rounded-full border border-[rgb(var(--crm-accent-rgb)_/_0.35)] bg-[rgb(var(--crm-accent-rgb)_/_0.1)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--crm-accent)]">
                        {item.number}
                      </div>
                    )}
                    <div className="text-base font-bold text-[var(--crm-ink)] line-clamp-2">{item.title}</div>
                    <div className="mt-1 text-xs text-[var(--crm-muted)]">
                      {item.company?.name || 'Empresa não informada'}
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[var(--crm-muted)]">
                      <div>Estágio: {OPPORTUNITY_STAGE_LABELS[item.stage] || item.stage || '-'}</div>
                      <div>Valor: {formatCurrency(item.value)}</div>
                      <div>Probabilidade: {Number(item.probability || 0)}%</div>
                      <div>Responsável: {item.owner?.name || '-'}</div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditOpportunity(item);
                        }}
                        className="crm-btn crm-btn-secondary h-9 px-3"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteOpportunity(item);
                          }}
                          disabled={deletingOpportunityId === item.id}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-500/35 px-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingOpportunityId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {sortedFilteredOpportunities.length === 0 && (
                  <div className="md:col-span-2 xl:col-span-3 crm-panel p-8 text-center text-[var(--crm-muted)]">
                    Nenhuma oportunidade encontrada para os filtros.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : activeTab === 'analise' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/b2g-resumos')}
              className="crm-btn crm-btn-secondary h-10 px-4"
            >
              Ver Resumos Salvos
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="crm-panel border border-dashed border-[color:var(--crm-border)] p-5">
              <input
                ref={analysisFileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleSelectAnalysisFile}
              />

              <div className="text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">
                Modo de análise
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAnalysisMode('EDITAL')}
                  className={[
                    'h-11 rounded-xl border text-sm font-semibold transition-all',
                    analysisMode === 'EDITAL'
                      ? 'border-[rgb(var(--crm-accent-rgb)_/_0.7)] bg-[rgb(var(--crm-accent-rgb)_/_0.22)] text-[var(--crm-ink)]'
                      : 'border-[color:var(--crm-border)] text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
                  ].join(' ')}
                >
                  Edital
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisMode('TR')}
                  className={[
                    'h-11 rounded-xl border text-sm font-semibold transition-all',
                    analysisMode === 'TR'
                      ? 'border-[rgb(var(--crm-accent-rgb)_/_0.7)] bg-[rgb(var(--crm-accent-rgb)_/_0.22)] text-[var(--crm-ink)]'
                      : 'border-[color:var(--crm-border)] text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
                  ].join(' ')}
                >
                  Análise de TR
                </button>
              </div>

              <div className="mt-6 inline-flex h-20 w-20 items-center justify-center rounded-full border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)]">
                <FileUp className="h-9 w-9 text-[rgb(var(--crm-accent-rgb))]" />
              </div>

              <div className="mt-5 text-3xl font-black leading-tight text-[var(--crm-ink)]">
                Enviar Novo {analysisMode === 'TR' ? 'TR' : 'Edital'}
              </div>
              <p className="mt-2 text-sm text-[var(--crm-muted)]">
                PDF até 20MB. A IA vai gerar resumo executivo e riscos automaticamente.
              </p>

              <button
                type="button"
                onClick={handlePickAnalysisFile}
                className="crm-btn crm-btn-primary mt-5 w-full"
              >
                Selecionar {analysisMode === 'TR' ? 'TR' : 'Edital'} em PDF
              </button>

              <div className="mt-3 rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2 text-xs text-[var(--crm-muted)]">
                {analysisFile
                  ? `Arquivo: ${analysisFile.name} (${(analysisFile.size / (1024 * 1024)).toFixed(2)} MB)`
                  : 'Nenhum PDF selecionado.'}
              </div>

              <button
                type="button"
                onClick={handleAnalyzeSelectedFile}
                disabled={!analysisFile || analyzing}
                className="crm-btn crm-btn-primary mt-3 w-full disabled:opacity-60"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                {analyzing ? 'Analisando...' : analysisMode === 'TR' ? 'Analisar TR' : 'Analisar Edital'}
              </button>

              <button
                type="button"
                onClick={handleSaveCurrentAnalysis}
                disabled={!selectedNotice?.aiAnalysis || savingAnalysis}
                className="crm-btn crm-btn-secondary mt-3 w-full disabled:opacity-60"
              >
                {savingAnalysis ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                {savingAnalysis ? 'Salvando...' : 'Salvar análise'}
              </button>
            </div>

            <div className="crm-card p-5">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/14">
                <BadgeCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div className="mt-4 text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">
                Total analisados
              </div>
              <div className="mt-1 text-4xl font-black text-[var(--crm-ink)]">
                {analyzedNotices.length}
              </div>
            </div>

            <div className="crm-card p-5">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/14">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-300" />
              </div>
              <div className="mt-4 text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">
                Não conformes (TR)
              </div>
              <div className="mt-1 text-4xl font-black text-[var(--crm-ink)]">
                {nonConformTRCount}
              </div>
            </div>

            <div className="crm-card p-5">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/35 bg-cyan-500/14">
                <CalendarClock className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
              </div>
              <div className="mt-4 text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">
                Economia de tempo
              </div>
              <div className="mt-1 text-4xl font-black text-[var(--crm-ink)]">
                ~{analysisTimeSavedHours}h
              </div>
            </div>
          </div>

          {renderAdvancedFilters({ title: 'Filtros para Análise de Editais', showModality: true })}

          {!selectedNotice ? (
            <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
              Selecione um resumo salvo ou envie um novo arquivo para iniciar a análise.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="crm-panel p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--crm-muted)]">
                      <span className="rounded-full border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.56)] px-2 py-1">
                        Persistido
                      </span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-[var(--crm-ink)] line-clamp-2">
                      Resumo Salvo: {selectedNotice.title}
                    </div>
                    <div className="mt-1 text-sm text-[var(--crm-muted)]">
                      Processado em{' '}
                      {formatDateTime(
                        selectedNotice?.aiAnalysis?.generatedAt || selectedNotice.updatedAt || selectedNotice.createdAt
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/b2g-resumos')}
                      className="crm-btn crm-btn-secondary h-10 px-4"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSummary(selectedNotice)}
                      className="crm-btn crm-btn-secondary h-10 px-4"
                    >
                      <Download className="h-4 w-4" />
                      Baixar Resumo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConvertNoticeToOpportunity(selectedNotice)}
                      disabled={convertingNoticeId === selectedNotice.id}
                      className="crm-btn crm-btn-primary h-10 px-4 disabled:opacity-60"
                    >
                      {convertingNoticeId === selectedNotice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Converter em Oportunidade
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAnalysis(selectedNotice)}
                        disabled={deletingNoticeId === selectedNotice.id}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/35 px-4 text-sm font-semibold text-red-600 transition-all hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingNoticeId === selectedNotice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Excluir análise
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-5">
                <div className="xl:col-span-2 crm-card p-0">
                  <div className="border-b border-[color:var(--crm-border)] px-5 py-4">
                    <div className="flex items-center gap-2 text-xl font-black text-[var(--crm-ink)]">
                      <FileCheck2 className="h-5 w-5 text-[rgb(var(--crm-accent-rgb))]" />
                      Documento Original
                    </div>
                  </div>
                  <div className="space-y-4 px-5 py-4">
                    <p className="text-sm leading-relaxed text-[var(--crm-muted)]">
                      Este resumo foi recuperado do sistema. Caso o arquivo original tenha sido salvo, você pode abri-lo abaixo.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenOriginalDocument(selectedNotice)}
                      className="crm-btn crm-btn-secondary h-10 px-4"
                    >
                      Abrir Documento
                    </button>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] px-3 py-2 text-xs text-[var(--crm-muted)]">
                      {selectedNotice.sourceUrl || 'Sem link de documento oficial cadastrado.'}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-3 space-y-3">
                  <div className="crm-panel p-2">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                      {ANALYSIS_DETAIL_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAnalysisDetailTab(tab.id)}
                          className={[
                            'h-10 rounded-xl border text-xs font-black uppercase tracking-[0.06em] transition-all',
                            analysisDetailTab === tab.id
                              ? 'border-[rgb(var(--crm-accent-rgb)_/_0.65)] bg-[rgb(var(--crm-accent-rgb)_/_0.22)] text-[var(--crm-ink)]'
                              : 'border-transparent text-[var(--crm-muted)] hover:border-[color:var(--crm-border)] hover:text-[var(--crm-ink)]'
                          ].join(' ')}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="crm-card min-h-[420px] p-5">
                    {analysisDetailTab === 'GERAL' && (
                      <div className="space-y-4">
                        <div className="text-2xl font-black text-[var(--crm-ink)]">Identificação do certame</div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Data da sessão</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {formatDateFlexible(selectedNoticeAnalysis?.general?.openingDate)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Órgão licitante</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)] line-clamp-2">
                              {selectedNoticeAnalysis?.general?.agency || 'Não identificado'}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Modalidade</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {selectedNoticeAnalysis?.general?.modality || 'Não identificado'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Portal / Plataforma</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)] line-clamp-2">
                              {selectedNoticeAnalysis?.general?.portal || 'Não identificado'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Hora da sessão</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {selectedNoticeAnalysis?.general?.openingTime || 'Não identificado'}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-[color:var(--crm-border)] pt-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Objeto extraído</div>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--crm-muted)] whitespace-pre-wrap">
                            {selectedNoticeAnalysis?.general?.objectSummary || 'Objeto não identificado.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {analysisDetailTab === 'PRAZOS' && (
                      <div className="space-y-4">
                        <div className="text-2xl font-black text-[var(--crm-ink)]">Prazos e marcos</div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Abertura</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {formatDateFlexible(selectedNoticeAnalysis?.deadlines?.openingDate)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Publicação</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {formatDateFlexible(selectedNoticeAnalysis?.deadlines?.publicationDate)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Impugnação</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {formatDateFlexible(selectedNoticeAnalysis?.deadlines?.impugnationDeadline)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Esclarecimentos</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {formatDateFlexible(selectedNoticeAnalysis?.deadlines?.clarificationDeadline)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Prazo de proposta</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {formatDateFlexible(selectedNoticeAnalysis?.deadlines?.proposalDeadline)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Vigência contratual</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {selectedNoticeAnalysis?.deadlines?.contractTerm || '-'}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Dias restantes</div>
                            <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                              {(() => {
                                const days = daysUntilFlexible(selectedNoticeAnalysis?.deadlines?.proposalDeadline);
                                return days === null ? '-' : days;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4 text-sm text-[var(--crm-muted)]">
                          Última execução da IA: {formatDateTime(selectedNoticeAnalysis?.generatedAt)}
                        </div>
                      </div>
                    )}

                    {analysisDetailTab === 'EXIGENCIAS' && (
                      <div className="space-y-3">
                        <div className="text-2xl font-black text-[var(--crm-ink)]">Exigências e checklist</div>
                        {(selectedNoticeAnalysis?.requirementGroups?.length || 0) === 0 &&
                        (selectedNoticeAnalysis?.checklistDocumentacao?.length || 0) === 0 ? (
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4 text-sm text-[var(--crm-muted)]">
                            A IA não retornou checklist. Cadastre itens na aba Documentação para enriquecer o resumo.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {(selectedNoticeAnalysis?.requirementGroups || []).map((group) => (
                              <div key={group.id} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.56)] p-4">
                                <div className="text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">{group.label}</div>
                                <ul className="mt-3 space-y-2 text-sm text-[var(--crm-muted)]">
                                  {group.items.map((item, index) => (
                                    <li
                                      key={`${group.id}-${index}`}
                                      className="rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] px-3 py-2"
                                    >
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}

                            {(selectedNoticeAnalysis?.checklistDocumentacao || []).length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">Checklist operacional</div>
                                {(selectedNoticeAnalysis.checklistDocumentacao || []).map((item, index) => (
                                  <div key={`${item?.item || 'item'}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm font-semibold text-[var(--crm-ink)]">
                                        {item?.item || 'Item sem descrição'}
                                      </div>
                                      <span
                                        className={[
                                          'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                          checklistStatusClassName(item?.status)
                                        ].join(' ')}
                                      >
                                        {checklistStatusLabel(item?.status)}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-sm text-[var(--crm-muted)]">{item?.details || 'Sem observações.'}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {analysisDetailTab === 'ITENS_TR' && (
                      selectedNoticeAnalysis?.isTrAnalysis ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-xl font-black text-[var(--crm-ink)]">Caderno técnico do TR</div>
                            {(selectedNoticeAnalysis?.technicalNotebook || []).length === 0 ? (
                              <div className="text-sm text-[var(--crm-muted)]">Sem itens técnicos extraídos para o TR.</div>
                            ) : (
                              <div className="space-y-2 text-sm text-[var(--crm-muted)]">
                                {(selectedNoticeAnalysis.technicalNotebook || []).map((item, index) => (
                                  <div key={`${item.termRequirement}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="font-semibold text-[var(--crm-ink)]">{item.termRequirement}</div>
                                      <span
                                        className={[
                                          'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                          item.meetsRequirement === 'ATENDE'
                                            ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'
                                            : 'border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-200'
                                        ].join(' ')}
                                      >
                                        {item.meetsRequirement === 'ATENDE' ? 'Atende' : 'Não atende'}
                                      </span>
                                    </div>
                                    {item.datasheetEvidence && (
                                      <div className="mt-2 text-xs text-[var(--crm-muted)]">Evidência: {item.datasheetEvidence}</div>
                                    )}
                                    {item.rationale && (
                                      <div className="mt-1 text-xs text-[var(--crm-muted)]">Justificativa: {item.rationale}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="text-xl font-black text-[var(--crm-ink)]">Modelos/equipamentos aderentes</div>
                            {(selectedNoticeAnalysis?.compliantEquipment || []).length === 0 ? (
                              <div className="text-sm text-[var(--crm-muted)]">Sem modelos aderentes retornados na análise.</div>
                            ) : (
                              <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                                {(selectedNoticeAnalysis.compliantEquipment || []).map((item, index) => (
                                  <li
                                    key={`${item.model}-${index}`}
                                    className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2"
                                  >
                                    <div className="font-semibold text-[var(--crm-ink)]">{item.model}</div>
                                    <div className="text-xs text-[var(--crm-muted)]">{item.manufacturer}</div>
                                    <div className="mt-1 text-xs text-[var(--crm-muted)]">{item.rationale}</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-xl font-black text-[var(--crm-ink)]">Itens extraídos do edital</div>
                            {(selectedNoticeAnalysis?.items || []).length === 0 ? (
                              <div className="text-sm text-[var(--crm-muted)]">Sem itens técnicos extraídos.</div>
                            ) : (
                              <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                                {(selectedNoticeAnalysis.items || []).map((item, index) => (
                                  <li key={`${item.name}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                                    <div className="font-semibold text-[var(--crm-ink)]">{item.name}</div>
                                    <div className="mt-1 text-xs text-[var(--crm-muted)]">Quantidade: {item.quantity}</div>
                                    <div className="mt-0.5 text-xs text-[var(--crm-muted)]">Especificações: {item.specs}</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="text-xl font-black text-[var(--crm-ink)]">Pontos-chave e oportunidades</div>
                            {(selectedNoticeAnalysis?.keyPoints || []).length === 0 && (selectedNoticeAnalysis?.opportunities || []).length === 0 ? (
                              <div className="text-sm text-[var(--crm-muted)]">Sem pontos adicionais extraídos pela IA.</div>
                            ) : (
                              <div className="space-y-3">
                                {(selectedNoticeAnalysis?.keyPoints || []).length > 0 && (
                                  <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                                    {(selectedNoticeAnalysis.keyPoints || []).map((item, index) => (
                                      <li key={`key-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {(selectedNoticeAnalysis?.opportunities || []).length > 0 && (
                                  <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                                    {(selectedNoticeAnalysis.opportunities || []).map((item, index) => (
                                      <li key={`opp-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}

                    {analysisDetailTab === 'DOCUMENTACAO' && (
                      <div className="space-y-3">
                        <div className="text-2xl font-black text-[var(--crm-ink)]">Documentação e certificações</div>
                        {(selectedNoticeAnalysis?.documentationChecklist || []).length === 0 ? (
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4 text-sm text-[var(--crm-muted)]">
                            Não foi possível identificar documentos obrigatórios automaticamente. Revise o edital completo e complemente o checklist.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(selectedNoticeAnalysis.documentationChecklist || []).map((item, index) => (
                              <div key={`${item?.item || 'documento'}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-sm font-semibold text-[var(--crm-ink)]">{item?.item || 'Documento sem descrição'}</div>
                                  <span
                                    className={[
                                      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                      checklistStatusClassName(item?.status)
                                    ].join(' ')}
                                  >
                                    {checklistStatusLabel(item?.status)}
                                  </span>
                                </div>
                                <div className="mt-1 text-sm text-[var(--crm-muted)]">{item?.details || 'Sem observações.'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {analysisDetailTab === 'RISCOS_IA' && (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Recomendação</div>
                            <div className="mt-1 text-lg font-black text-[var(--crm-ink)]">
                              {selectedNoticeAnalysis?.recommendation || 'GO_COM_RESSALVAS'}
                            </div>
                          </div>
                          <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Score de aderência</div>
                            <div className={['mt-1 text-lg font-black', scoreColor(Number(selectedNoticeAnalysis?.scoreAderencia || 0))].join(' ')}>
                              {Number(selectedNoticeAnalysis?.scoreAderencia || 0)} / 100
                            </div>
                          </div>
                        </div>

                        {selectedNoticeAnalysis?.isTrAnalysis && (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Requisitos avaliados</div>
                              <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                                {Number(selectedNoticeAnalysis?.complianceOverview?.totalRequirements || 0)}
                              </div>
                            </div>
                            <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Requisitos atendidos</div>
                              <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                                {Number(selectedNoticeAnalysis?.complianceOverview?.metRequirements || 0)}
                              </div>
                            </div>
                            <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Conformidade total</div>
                              <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                                {selectedNoticeAnalysis?.complianceOverview?.fullCompliance ? 'Sim' : 'Não'}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Riscos</div>
                            {(selectedNoticeAnalysis?.risks || []).length === 0 ? (
                              <div className="text-sm text-[var(--crm-muted)]">Sem riscos identificados.</div>
                            ) : (
                              <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                                {(selectedNoticeAnalysis.risks || []).map((item, index) => (
                                  <li key={`${item}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Próximas ações</div>
                            {(selectedNoticeAnalysis?.nextActions || []).length === 0 ? (
                              <div className="text-sm text-[var(--crm-muted)]">Sem ações recomendadas.</div>
                            ) : (
                              <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                                {(selectedNoticeAnalysis.nextActions || []).map((item, index) => (
                                  <li key={`${item}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="crm-panel p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-black text-[var(--crm-ink)]">Resumos recentes</div>
              <div className="text-xs text-[var(--crm-muted)]">{filteredNotices.length} documento(s)</div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredNotices.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedNoticeId(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedNoticeId(item.id);
                    }
                  }}
                  className={[
                    'crm-card text-left p-4 transition-all cursor-pointer',
                    selectedNoticeId === item.id ? 'ring-2 ring-[rgb(var(--crm-accent-rgb)_/_0.5)]' : ''
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[rgb(var(--crm-surface-rgb)_/_0.6)] px-2 py-1 text-xs font-semibold text-[var(--crm-muted)] border border-[color:var(--crm-border)]">
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                      <span className={['rounded-full border px-2 py-1 text-xs font-semibold', STATUS_STYLES[getNoticeDisplayStatus(item)] || 'border-[color:var(--crm-border)]'].join(' ')}>
                        {labelFrom(STATUS_OPTIONS, getNoticeDisplayStatus(item), item.status)}
                      </span>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        title="Excluir análise"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteAnalysis(item);
                        }}
                        disabled={deletingNoticeId === item.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/35 text-red-600 transition-all hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingNoticeId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 text-base font-bold text-[var(--crm-ink)] line-clamp-2">
                    {item.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-[var(--crm-muted)]">
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">
                      {item.organization}
                      {getNoticeStateCode(item) ? `/${getNoticeStateCode(item)}` : ''}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-[var(--crm-muted)]">
                    Prazo: {formatDate(item.proposalDueDate)} • Valor: {formatCurrency(item.estimatedValue)}
                  </div>
                </div>
              ))}

              {filteredNotices.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3 crm-panel p-8 text-center text-[var(--crm-muted)]">
                  Nenhum edital corresponde aos filtros aplicados.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'resumos' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnimatedStats
              title="Resumos gerados"
              value={summaries.length}
              subtitle="Editais com resumo"
              icon={FileText}
              color="blue"
            />
            <AnimatedStats
              title="Cobertura"
              value={summaryCoverage}
              subtitle="% dos editais filtrados"
              icon={BarChart3}
              color="purple"
            />
            <AnimatedStats
              title="Com análise AI"
              value={summaries.filter((item) => !!item?.aiAnalysis).length}
              subtitle="Parecer completo"
              icon={Brain}
              color="green"
            />
            <AnimatedStats
              title="Sem resumo"
              value={Math.max(filteredNotices.length - summaries.length, 0)}
              subtitle="Pendentes de geração"
              icon={AlertTriangle}
              color="orange"
            />
          </div>

          {renderAdvancedFilters({ title: 'Filtros para Resumos de Edital', showModality: true })}

          {savedSummariesLoading ? (
            <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Carregando resumos salvos...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSavedSummaryCards.map((card) => (
                <div key={card.id} className="crm-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[2rem] font-black text-[var(--crm-ink)] leading-tight line-clamp-2">
                        {card.notice.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--crm-muted)]">
                        <CalendarClock className="h-4 w-4" />
                        {formatDateTime(card.record?.processedAt || card.notice.updatedAt || card.notice.createdAt)}
                      </div>
                    </div>
                    <span className="rounded-full border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.56)] px-3 py-1 text-xs font-semibold text-[var(--crm-muted)]">
                      {TYPE_LABELS[card.notice.type] || card.notice.type}
                    </span>
                  </div>

                  <div className="mt-6 text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">
                    Órgão
                  </div>
                  <div className="mt-1 text-3xl font-bold leading-tight text-[var(--crm-ink)] line-clamp-2">
                    {card.notice.organization}
                  </div>

                  <div className="mt-5 text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">
                    Objeto
                  </div>
                  <p className="mt-1 text-base leading-relaxed text-[var(--crm-muted)] line-clamp-3">
                    {card.analysisView?.general?.objectSummary || card.notice.summary}
                  </p>

                  <div className="mt-5 flex items-center gap-4 text-sm text-[var(--crm-muted)]">
                    <div className="inline-flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      {card.itemsCount} item{card.itemsCount === 1 ? '' : 's'}
                    </div>
                    <div>{card.risksCount} risco{card.risksCount === 1 ? '' : 's'}</div>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <button
                      type="button"
                      className="crm-btn crm-btn-primary h-11 flex-1"
                      onClick={() => openSavedSummaryDetails(card.id)}
                    >
                      <Eye className="h-4 w-4" />
                      Ver Resumo
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        title="Excluir resumo salvo"
                        onClick={() => handleDeleteSavedSummary(card)}
                        disabled={deletingSavedSummaryId === card.id}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/35 text-red-600 transition-all hover:bg-red-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingSavedSummaryId === card.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!savedSummariesLoading && filteredSavedSummaryCards.length === 0 && (
            <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
              Ainda não há resumos salvos para os filtros aplicados.
            </div>
          )}
        </div>
      ) : activeTab === 'atas' ? (
        <><div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 flex-1">
              <AnimatedStats
                title="Atas RP"
                value={atasStats.total}
                subtitle="Total filtrado"
                icon={Landmark}
                color="blue"
              />
              <AnimatedStats
                title="Ativas"
                value={atasStats.active}
                subtitle="Não encerradas"
                icon={CheckCircle2}
                color="green"
              />
              <AnimatedStats
                title="Em análise"
                value={atasStats.inProgress}
                subtitle="Status em andamento"
                icon={Brain}
                color="purple"
              />
              <AnimatedStats
                title="Enviadas"
                value={atasStats.sent}
                subtitle="Fase final"
                icon={BadgeCheck}
                color="orange"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setForm({ ...INITIAL_FORM, type: 'ATA_REGISTRO_PRECOS' });
                setFeedback({ type: '', message: '' });
                setShowAtaModal(true);
              }}
              className="crm-btn crm-btn-primary h-10 px-4 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Adicionar ATA
            </button>
          </div>

          {renderAdvancedFilters({ title: 'Filtros para Atas de Registro de Preços', showModality: true })}

          {atas.map((item) => (
            <div key={item.id} className="crm-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-[var(--crm-ink)]">{item.title}</div>
                  <div className="mt-1 text-xs text-[var(--crm-muted)]">
                    {item.referenceCode || 'Sem referência'}
                    {' • '}
                    {item.organization}
                    {getNoticeStateCode(item) ? `/${getNoticeStateCode(item)}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary h-9 px-3 text-xs"
                  onClick={() => {
                    openNoticeAnalysis(item.id);
                  }}
                >
                  Abrir ata
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
                <div className="rounded-xl border border-[color:var(--crm-border)] p-2">
                  <div className="text-xs text-[var(--crm-muted)]">Situação</div>
                  <div className="font-semibold text-[var(--crm-ink)]">
                    {labelFrom(STATUS_OPTIONS, getNoticeDisplayStatus(item), item.status)}
                  </div>
                </div>
                <div className="rounded-xl border border-[color:var(--crm-border)] p-2">
                  <div className="text-xs text-[var(--crm-muted)]">Prazo</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{formatDate(item.proposalDueDate)}</div>
                </div>
                <div className="rounded-xl border border-[color:var(--crm-border)] p-2">
                  <div className="text-xs text-[var(--crm-muted)]">Valor estimado</div>
                  <div className="font-semibold text-[var(--crm-ink)]">{formatCurrency(item.estimatedValue)}</div>
                </div>
              </div>
            </div>
          ))}

          {atas.length === 0 && (
            <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
              Nenhuma Ata de Registro de Preços cadastrada.
            </div>
          )}
        </div>

        <Modal
          isOpen={showAtaModal}
          onClose={() => {
            setForm(INITIAL_FORM);
            setFeedback({ type: '', message: '' });
            setShowAtaModal(false);
          }}
          title="Adicionar Ata de Registro de Preços"
        >
          <form onSubmit={handleCreateNotice} className="space-y-4">
            {feedback.type && (
              <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                feedback.type === 'error'
                  ? 'bg-red-500/14 text-red-600 dark:text-red-400'
                  : 'bg-emerald-500/14 text-emerald-600 dark:text-emerald-400'
              }`}>
                {feedback.message}
              </div>
            )}

            <input type="hidden" name="type" value="ATA_REGISTRO_PRECOS" />

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">Título *</label>
                <input
                  className="crm-input mt-1"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex.: Ata de Registro de Preços - Material Hospitalar"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">Número da Ata</label>
                <input
                  className="crm-input mt-1"
                  value={form.referenceCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, referenceCode: e.target.value }))}
                  placeholder="Ex.: Ata 001/2026"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">Órgão *</label>
                <input
                  className="crm-input mt-1"
                  value={form.organization}
                  onChange={(e) => setForm((prev) => ({ ...prev, organization: e.target.value }))}
                  placeholder="Ex.: Secretaria Municipal de Saúde"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">UF</label>
                <select
                  className="crm-input mt-1"
                  value={form.stateCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, stateCode: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">Modalidade</label>
                <input
                  className="crm-input mt-1"
                  value={form.modality}
                  onChange={(e) => setForm((prev) => ({ ...prev, modality: e.target.value }))}
                  placeholder="Ex.: Pregão Eletrônico"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">Valor estimado</label>
                <input
                  className="crm-input mt-1"
                  type="number"
                  step="0.01"
                  value={form.estimatedValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimatedValue: e.target.value }))}
                  placeholder="Ex.: 150000.00"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">Data de abertura</label>
                <input
                  className="crm-input mt-1"
                  type="date"
                  value={form.openingDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, openingDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--crm-muted)]">Data de vigência</label>
                <input
                  className="crm-input mt-1"
                  type="date"
                  value={form.proposalDueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, proposalDueDate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--crm-muted)]">Objeto</label>
              <textarea
                className="crm-input mt-1 min-h-[80px]"
                value={form.objectDescription}
                onChange={(e) => setForm((prev) => ({ ...prev, objectDescription: e.target.value }))}
                placeholder="Descrição do objeto da ata..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--crm-muted)]">Link do PNCP / ComprasNet</label>
              <input
                className="crm-input mt-1"
                value={form.sourceUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--crm-muted)]">Tags (separadas por vírgula)</label>
              <input
                className="crm-input mt-1"
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="Ex.: saúde, emergencial, federal"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setForm(INITIAL_FORM);
                  setFeedback({ type: '', message: '' });
                  setShowAtaModal(false);
                }}
                className="crm-btn crm-btn-secondary h-10 px-4"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="crm-btn crm-btn-primary h-10 px-4"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Cadastrar ATA'}
              </button>
            </div>
          </form>
        </Modal>
        </>
      ) : activeTab === 'atividades' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnimatedStats
              title="Atividades"
              value={activitiesStats.total}
              subtitle="Total filtrado"
              icon={Workflow}
              color="blue"
            />
            <AnimatedStats
              title="Em aberto"
              value={activitiesStats.open}
              subtitle="Pendentes ou em andamento"
              icon={CalendarClock}
              color="purple"
            />
            <AnimatedStats
              title="Vencendo em 7 dias"
              value={activitiesStats.dueSoon}
              subtitle="Prioridade operacional"
              icon={AlertTriangle}
              color="orange"
            />
            <AnimatedStats
              title="Atrasadas"
              value={activitiesStats.overdue}
              subtitle="Necessita ação imediata"
              icon={History}
              color="red"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.72)] p-1">
              <button
                type="button"
                onClick={() => setActivitiesViewMode('kanban')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                  activitiesViewMode === 'kanban'
                    ? 'bg-[var(--crm-accent)] text-white'
                    : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setActivitiesViewMode('list')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                  activitiesViewMode === 'list'
                    ? 'bg-[var(--crm-accent)] text-white'
                    : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
                }`}
              >
                <List className="h-4 w-4" />
                Lista
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/atividades?openForm=1&sourceArea=B2G&targetArea=PRE_VENDAS&type=SOLICITACAO_ORCAMENTO')}
              className="crm-btn crm-btn-primary h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              Nova Atividade
            </button>
          </div>

          {renderAdvancedFilters({ title: 'Filtros de Atividades', showModality: false })}

          {activitiesViewMode === 'kanban' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
              {ACTIVITY_KANBAN_STATUS.map((status) => {
                const rows = activitiesByStatus[status] || [];
                return (
                  <div key={status} className="crm-card p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--crm-ink)]">
                          {ACTIVITY_STATUS_LABELS[status] || status}
                        </h3>
                        <p className="text-sm text-[var(--crm-muted)]">Atividades B2G</p>
                      </div>
                      <span className="rounded-full bg-[rgb(var(--crm-surface-2-rgb)_/_0.82)] px-3 py-1 text-sm font-bold text-[var(--crm-ink)]">
                        {rows.length}
                      </span>
                    </div>

                    {rows.length > 0 ? (
                      <div className="space-y-3">
                        {rows.map((item) => (
                          <div key={item.id} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.7)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-[var(--crm-ink)]">{item.subject || 'Atividade sem título'}</div>
                                <div className="mt-1 line-clamp-2 text-xs text-[var(--crm-muted)]">{item.description || ACTIVITY_TYPE_LABELS[item.type] || '-'}</div>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-[var(--crm-muted)]">
                                <CalendarClock className="h-3.5 w-3.5" />
                                {formatDate(item.dueDate || item.createdAt)}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-[color:var(--crm-border)] px-2 py-1 text-[11px] font-semibold text-[var(--crm-muted)]">
                                {ACTIVITY_TYPE_LABELS[item.type] || item.type || '-'}
                              </span>
                              <span className="rounded-full border border-[color:var(--crm-border)] px-2 py-1 text-[11px] font-semibold text-[var(--crm-muted)]">
                                Prioridade: {item.priority || '-'}
                              </span>
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-[var(--crm-muted)]">
                              <div>Empresa: <span className="text-[var(--crm-ink)]">{item?.company?.name || '-'}</span></div>
                              <div>Oportunidade: <span className="text-[var(--crm-ink)]">{item?.opportunity?.title || '-'}</span></div>
                              <div>Vencimento: <span className="text-[var(--crm-ink)]">{formatDate(item.dueDate)}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] px-3 py-8 text-center text-sm text-[var(--crm-muted)]">
                        Nenhuma atividade nesta coluna.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities
                .slice()
                .sort((a, b) => toTimestamp(b.createdAt || b.dueDate) - toTimestamp(a.createdAt || a.dueDate))
                .map((item) => (
                  <div key={item.id} className="crm-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-bold text-[var(--crm-ink)]">{item.subject || 'Atividade sem título'}</div>
                      <div className="text-xs text-[var(--crm-muted)] flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDateTime(item.createdAt)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[color:var(--crm-border)] px-2 py-1 text-[11px] font-semibold text-[var(--crm-muted)]">
                        {ACTIVITY_TYPE_LABELS[item.type] || item.type || '-'}
                      </span>
                      <span className="rounded-full border border-[color:var(--crm-border)] px-2 py-1 text-[11px] font-semibold text-[var(--crm-muted)]">
                        {ACTIVITY_STATUS_LABELS[item.status] || item.status || '-'}
                      </span>
                      <span className="rounded-full border border-[color:var(--crm-border)] px-2 py-1 text-[11px] font-semibold text-[var(--crm-muted)]">
                        Prioridade: {item.priority || '-'}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-[var(--crm-muted)]">
                      Empresa: {item?.company?.name || '-'}
                      {' • '}
                      Oportunidade: {item?.opportunity?.title || '-'}
                      {' • '}
                      Vencimento: {formatDate(item.dueDate)}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {filteredActivities.length === 0 && (
            <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
              Nenhuma atividade encontrada para os filtros aplicados.
            </div>
          )}
        </div>
      ) : activeTab === 'documentacao' ? (
        <div className="space-y-4">
          <Modal
            isOpen={repositoryModalOpen}
            onClose={handleCloseRepositoryModal}
            title="Novo documento B2G"
          >
            <form onSubmit={handleUploadRepositoryDocument} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-[var(--crm-muted)]">Arquivo (PDF, DOC, DOCX) *</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleSelectRepositoryFile}
                    className="crm-input mt-1"
                  />
                  {repositoryUploadFile && (
                    <div className="mt-1 text-xs text-[var(--crm-muted)]">
                      {repositoryUploadFile.name} • {formatFileSize(repositoryUploadFile.size)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--crm-muted)]">Nome do documento *</label>
                  <input
                    className="crm-input mt-1"
                    value={repositoryForm.name}
                    onChange={(e) => setRepositoryForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex.: Certidão Negativa Federal"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--crm-muted)]">Categoria</label>
                  <select
                    className="crm-input mt-1"
                    value={repositoryForm.category}
                    onChange={(e) => setRepositoryForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {B2G_REPOSITORY_CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--crm-muted)]">Data de validade</label>
                  <input
                    type="date"
                    className="crm-input mt-1"
                    value={repositoryForm.expirationDate}
                    onChange={(e) => setRepositoryForm((prev) => ({ ...prev, expirationDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary"
                  onClick={handleCloseRepositoryModal}
                  disabled={uploadingRepositoryDocument}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="crm-btn crm-btn-primary"
                  disabled={uploadingRepositoryDocument}
                >
                  {uploadingRepositoryDocument ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4" />
                      Salvar documento
                    </>
                  )}
                </button>
              </div>
            </form>
          </Modal>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleExportRepositoryKit}
              className="crm-btn crm-btn-secondary h-10 px-4"
            >
              <Download className="h-4 w-4" />
              Exportar Kit
            </button>
            <button
              type="button"
              onClick={handleOpenRepositoryModal}
              className="crm-btn crm-btn-primary h-10 px-4"
            >
              <Plus className="h-4 w-4" />
              Novo Documento
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <AnimatedStats
              title="Documentos válidos"
              value={documentationStats.valid}
              subtitle="Em conformidade"
              icon={CheckCircle2}
              color="green"
            />
            <AnimatedStats
              title="Próximos ao vencimento"
              value={documentationStats.expiring}
              subtitle={`Até ${B2G_REPOSITORY_EXPIRING_THRESHOLD_DAYS} dias`}
              icon={Clock3}
              color="orange"
            />
            <AnimatedStats
              title="Documentos expirados"
              value={documentationStats.expired}
              subtitle="Necessitam renovação"
              icon={AlertTriangle}
              color="red"
            />
          </div>

          <div className="crm-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={repositoryFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleSelectRepositoryFile}
                className="hidden"
              />
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={handlePickRepositoryFile}
              >
                <FileUp className="h-4 w-4" />
                Escolher arquivo
              </button>
              <div className="text-sm text-[var(--crm-muted)]">
                {repositoryUploadFile ? repositoryUploadFile.name : 'Nenhum arquivo selecionado'}
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-primary ml-auto"
                onClick={handleOpenRepositoryModal}
              >
                <ArrowUpRight className="h-4 w-4" />
                Abrir cadastro completo
              </button>
            </div>
            <div className="mt-2 text-xs text-[var(--crm-muted)]">
              Após selecionar o arquivo, informe categoria e data de validade no cadastro completo.
            </div>
          </div>

          <div className="crm-card p-4">
            <label className="text-xs font-semibold text-[var(--crm-muted)]">Buscar documento</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--crm-muted)]" />
              <input
                className="crm-input pl-10"
                placeholder="Nome, categoria ou arquivo..."
                value={repositorySearch}
                onChange={(e) => setRepositorySearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {repositoryDocumentsLoading ? (
              <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Carregando repositório documental...
              </div>
            ) : filteredRepositoryDocuments.length === 0 ? (
              <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
                Nenhum documento encontrado no repositório B2G.
              </div>
            ) : (
              filteredRepositoryDocuments.map((item) => {
                const validity = getRepositoryDocumentValidity(item?.expirationDate);
                const remainingDays = validity.remainingDays;
                const progressWidth =
                  remainingDays === null
                    ? 100
                    : remainingDays < 0
                      ? 100
                      : Math.max(6, Math.min(100, Math.round((remainingDays / 365) * 100)));
                const progressClass =
                  validity.status === 'EXPIRED'
                    ? 'bg-rose-500'
                    : validity.status === 'EXPIRING'
                      ? 'bg-amber-500'
                      : 'bg-sky-500';

                return (
                  <div key={item.id} className="crm-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-bold text-[var(--crm-ink)]">{item.name}</div>
                          <span className="rounded-full border border-[color:var(--crm-border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--crm-muted)]">
                            {item.category || 'Geral'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--crm-muted)] flex flex-wrap items-center gap-2">
                          <span>{item.originalName}</span>
                          <span>•</span>
                          <span>{formatFileSize(item.size)}</span>
                          <span>•</span>
                          <span>
                            Validade:{' '}
                            {item.expirationDate ? formatDateFlexible(item.expirationDate) : 'Sem vencimento'}
                          </span>
                          {remainingDays !== null && (
                            <>
                              <span>•</span>
                              <span>{remainingDays >= 0 ? `${remainingDays} dia(s)` : `${Math.abs(remainingDays)} dia(s) vencido`}</span>
                            </>
                          )}
                        </div>
                        <div className="mt-2 h-1.5 w-full max-w-[380px] rounded-full bg-[rgb(var(--crm-surface-rgb)_/_0.7)]">
                          <div className={['h-1.5 rounded-full', progressClass].join(' ')} style={{ width: `${progressWidth}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary h-9 px-3"
                          onClick={() => handleViewRepositoryDocument(item)}
                          disabled={viewingRepositoryDocumentId === item.id}
                        >
                          {viewingRepositoryDocumentId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          Visualizar
                        </button>
                        <button
                          type="button"
                          className="crm-btn crm-btn-secondary h-9 px-3"
                          onClick={() => handleDownloadRepositoryDocument(item)}
                          disabled={downloadingRepositoryDocumentId === item.id}
                        >
                          {downloadingRepositoryDocumentId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Download
                        </button>
                        <span className={['rounded-full border px-3 py-1 text-xs font-semibold', validity.className].join(' ')}>
                          {validity.label}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            className="crm-btn crm-btn-secondary h-9 px-3 text-red-700 dark:text-red-300"
                            onClick={() => handleDeleteRepositoryDocument(item)}
                            disabled={deletingRepositoryDocumentId === item.id}
                            title="Excluir documento"
                          >
                            {deletingRepositoryDocumentId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'relatorios' ? (
        <div className="space-y-4">
          {renderAdvancedFilters({ title: 'Filtros para Relatórios Estratégicos', showModality: true })}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="crm-card p-4">
              <div className="text-xs text-[var(--crm-muted)]">Pipeline total</div>
              <div className="mt-1 text-xl font-bold text-[var(--crm-ink)]">{formatCurrency(opportunityStats.totalValue)}</div>
            </div>
            <div className="crm-card p-4">
              <div className="text-xs text-[var(--crm-muted)]">Receita ganha</div>
              <div className="mt-1 text-xl font-bold text-[var(--crm-ink)]">{formatCurrency(opportunityStats.wonValue)}</div>
            </div>
            <div className="crm-card p-4">
              <div className="text-xs text-[var(--crm-muted)]">Taxa GO/NoGO (AI)</div>
              <div className="mt-1 text-xl font-bold text-[var(--crm-ink)]">
                {stats.total > 0 ? Math.round((stats.analysisDone / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="crm-card p-4">
              <div className="text-xs text-[var(--crm-muted)]">Conformidade documental</div>
              <div className="mt-1 text-xl font-bold text-[var(--crm-ink)]">{documentationStats.completionRate}%</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="crm-card p-4">
              <div className="text-sm font-semibold text-[var(--crm-ink)]">Top órgãos por volume de editais</div>
              <div className="mt-3 space-y-2">
                {strategicByOrganization.map((row) => (
                  <div key={row.name} className="rounded-xl border border-[color:var(--crm-border)] px-3 py-2">
                    <div className="text-sm font-semibold text-[var(--crm-ink)]">{row.name}</div>
                    <div className="text-xs text-[var(--crm-muted)]">
                      {row.count} edital(is) • {formatCurrency(row.value)} estimado
                    </div>
                  </div>
                ))}
                {strategicByOrganization.length === 0 && (
                  <div className="text-sm text-[var(--crm-muted)]">Sem dados suficientes.</div>
                )}
              </div>
            </div>

            <div className="crm-card p-4">
              <div className="text-sm font-semibold text-[var(--crm-ink)]">Distribuição de oportunidades por estágio</div>
              <div className="mt-3 space-y-2">
                {stageDistribution.map((row) => (
                  <div key={row.stage} className="rounded-xl border border-[color:var(--crm-border)] px-3 py-2">
                    <div className="text-sm font-semibold text-[var(--crm-ink)]">
                      {OPPORTUNITY_STAGE_LABELS[row.stage] || row.stage}
                    </div>
                    <div className="text-xs text-[var(--crm-muted)]">
                      {row.count} oportunidade(s) • {formatCurrency(row.value)}
                    </div>
                  </div>
                ))}
                {stageDistribution.length === 0 && (
                  <div className="text-sm text-[var(--crm-muted)]">Sem oportunidades para análise.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'historico' ? (
        <div className="space-y-4">
          {renderAdvancedFilters({
            title: 'Filtros para Histórico de Oportunidades (NO GO / PERDIDAS / GANHAS)',
            showModality: true
          })}

          <div className="flex items-center gap-2 px-1">
            <History className="h-6 w-6 text-[rgb(var(--crm-accent-rgb))]" />
            <div className="text-4xl font-black text-[var(--crm-ink)]">
              Histórico de Oportunidades
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnimatedStats
              title="Total no histórico"
              value={historicalOutcomeOpportunities.length}
              subtitle="NO GO, perdidas e ganhas"
              icon={History}
              color="blue"
            />
            <AnimatedStats
              title="NO GO"
              value={historicalNoGoCount}
              subtitle="Encerradas por inviabilidade"
              icon={AlertTriangle}
              color="orange"
            />
            <AnimatedStats
              title="Perdidas"
              value={historicalLostCount}
              subtitle="Status perdido"
              icon={Target}
              color="purple"
            />
            <AnimatedStats
              title="Ganhas"
              value={historicalWonCount}
              subtitle="Status ganho"
              icon={BadgeCheck}
              color="green"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {historicalOutcomeOpportunities.map((item) => {
              const outcomeId = resolveKanbanColumnId(item?.b2gStage || item?.stage);
              const outcome = HISTORICAL_OUTCOME_META[outcomeId] || HISTORICAL_OUTCOME_META.PERDIDO;
              return (
                <div key={item.id} className="crm-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-lg font-black leading-tight text-[var(--crm-ink)] line-clamp-2">
                        {item.title || 'Oportunidade sem título'}
                      </div>
                      <div className="mt-1 text-xs text-[var(--crm-muted)]">
                        Atualizado em {formatDateTime(item.actualCloseDate || item.updatedAt || item.createdAt)}
                      </div>
                    </div>
                    <span
                      className={[
                        'rounded-full border px-2.5 py-1 text-xs font-semibold',
                        outcome.className
                      ].join(' ')}
                    >
                      {outcome.label}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="text-[var(--crm-muted)]">
                      <span className="font-semibold text-[var(--crm-ink)]">Órgão/Conta:</span>{' '}
                      {item.company?.name || '-'}
                    </div>
                    <div className="text-[var(--crm-muted)]">
                      <span className="font-semibold text-[var(--crm-ink)]">Valor:</span>{' '}
                      {formatCurrency(item.value)}
                    </div>
                    <div className="text-[var(--crm-muted)]">
                      <span className="font-semibold text-[var(--crm-ink)]">Probabilidade:</span>{' '}
                      {Number(item.probability || 0)}%
                    </div>
                  </div>

                  {item.description && (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--crm-muted)] line-clamp-3">
                      {item.description}
                    </p>
                  )}

                  {renderStageDecisionSummary(item)}

                  <div className="mt-4 border-t border-[color:var(--crm-border)] pt-4 flex justify-end">
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary h-10 px-4"
                      onClick={() => openOpportunityDetails(item)}
                    >
                      <Eye className="h-4 w-4" />
                      Ver Oportunidade
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {historicalOutcomeOpportunities.length === 0 && (
            <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
              Nenhuma oportunidade NO GO, perdida ou ganha encontrada para os filtros aplicados.
            </div>
          )}
        </div>
      ) : (
        <div className="crm-panel p-8 text-center text-[var(--crm-muted)]">
          Seção em construção.
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedLeadAnalysis)}
        onClose={closeLeadAnalysis}
        title="Análise do Lead B2G"
        size="large"
      >
        {selectedLeadAnalysis && (
          <div className="space-y-5">
            <div className="crm-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--crm-muted)]">Lead B2G</div>
                  <h3 className="mt-1 text-xl font-bold text-[var(--crm-ink)]">{selectedLeadAnalysis.name}</h3>
                  <div className="mt-2 text-sm text-[var(--crm-muted)]">{selectedLeadAnalysis.segment || 'Segmento não informado'}</div>
                </div>
                <span className="rounded-full border border-[color:var(--crm-border)] px-3 py-1 text-xs font-semibold text-[var(--crm-muted)]">
                  {COMPANY_STATUS_LABELS[selectedLeadAnalysis.status] || selectedLeadAnalysis.status || '-'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-[var(--crm-muted)] md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.08em]">Localização</div>
                  <div className="mt-1 font-semibold text-[var(--crm-ink)]">
                    {[selectedLeadAnalysis.city, selectedLeadAnalysis.state].filter(Boolean).join(' - ') || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.08em]">Lead score</div>
                  <div className="mt-1 font-semibold text-[var(--crm-ink)]">{Number(selectedLeadAnalysis.leadScore || 0)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.08em]">Origem</div>
                  <div className="mt-1 font-semibold text-[var(--crm-ink)]">Busca de Editais</div>
                </div>
              </div>

              {selectedLeadAnalysis.address && (
                <div className="mt-4 rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.5)] p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--crm-muted)]">Dados do edital</div>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--crm-ink)]">
                    {selectedLeadAnalysis.address}
                  </pre>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--crm-ink)]">Decisão</label>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[
                  { id: 'ANALISE', label: 'Em Análise', icon: Tag },
                  { id: 'GO', label: 'GO', icon: ThumbsUp },
                  { id: 'NO_GO', label: 'NO GO', icon: ThumbsDown }
                ].map((option) => {
                  const Icon = option.icon;
                  const active = leadAnalysisDecision === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLeadAnalysisDecision(option.id)}
                      className={[
                        'min-h-24 rounded-2xl border px-4 py-3 text-center transition-all',
                        active
                          ? 'border-blue-500 bg-blue-500/12 text-blue-600 ring-2 ring-blue-500/40 dark:text-blue-300'
                          : 'border-[color:var(--crm-border)] text-[var(--crm-muted)] hover:border-blue-500/60 hover:text-blue-500'
                      ].join(' ')}
                    >
                      <Icon className="mx-auto h-6 w-6" />
                      <div className="mt-2 text-sm font-bold">{option.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-[var(--crm-ink)]">Observações da análise</label>
              <textarea
                className="crm-input mt-2 min-h-28"
                value={leadAnalysisNotes}
                onChange={(event) => setLeadAnalysisNotes(event.target.value)}
                placeholder="Justificativa da decisão, próximos passos, riscos, documentos necessários..."
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLeadAnalysis}
                disabled={savingLeadAnalysis}
                className="crm-btn crm-btn-secondary h-11 px-5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveLeadAnalysis}
                disabled={savingLeadAnalysis}
                className={`crm-btn h-11 px-5 ${leadAnalysisDecision === 'GO' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : leadAnalysisDecision === 'NO_GO' ? 'bg-red-600 hover:bg-red-500 text-white' : 'crm-btn-primary'}`}
              >
                {savingLeadAnalysis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {leadAnalysisDecision === 'GO' ? '✅ GO — Criar Oportunidade' : leadAnalysisDecision === 'NO_GO' ? '❌ Registrar NO GO' : 'Salvar decisão'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(
          savedSummaryModalOpen &&
            selectedSavedSummaryCard &&
            selectedSavedSummaryNotice &&
            selectedSavedSummaryAnalysis
        )}
        onClose={closeSavedSummaryDetails}
        title={
          selectedSavedSummaryNotice?.title
            ? `Revisão de Edital: ${selectedSavedSummaryNotice.title}`
            : 'Revisão de Edital'
        }
        size="large"
      >
        {selectedSavedSummaryCard && selectedSavedSummaryNotice && selectedSavedSummaryAnalysis && (
          <div className="space-y-4">
            <div className="crm-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--crm-muted)]">Resumo persistido</div>
                  <div className="text-sm text-[var(--crm-muted)]">
                    Processado em {formatDateTime(
                      selectedSavedSummaryCard.record?.processedAt ||
                        selectedSavedSummaryNotice.updatedAt ||
                        selectedSavedSummaryNotice.createdAt
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary h-10 px-4"
                    onClick={() => handleDownloadSummary(selectedSavedSummaryNotice)}
                  >
                    <Download className="h-4 w-4" />
                    Baixar Resumo
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary h-10 px-4"
                    onClick={() => handleSaveSavedSummary(selectedSavedSummaryCard)}
                    disabled={savingSavedSummaryId === selectedSavedSummaryCard.id}
                  >
                    {savingSavedSummaryId === selectedSavedSummaryCard.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="h-4 w-4" />
                    )}
                    Salvar Resumo
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary h-10 px-4"
                    onClick={() => handleConvertSavedSummaryToOpportunity(selectedSavedSummaryCard)}
                    disabled={convertingSavedSummaryId === selectedSavedSummaryCard.id}
                  >
                    {convertingSavedSummaryId === selectedSavedSummaryCard.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Converter em Oportunidade
                  </button>
                  <button
                    type="button"
                    className="crm-btn crm-btn-secondary h-10 px-4"
                    onClick={closeSavedSummaryDetails}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                </div>
              </div>
            </div>

            <div className="crm-card p-0">
              <div className="border-b border-[color:var(--crm-border)] px-5 py-4">
                <div className="flex items-center gap-2 text-xl font-black text-[var(--crm-ink)]">
                  <FileCheck2 className="h-5 w-5 text-[rgb(var(--crm-accent-rgb))]" />
                  Documento Original
                </div>
              </div>
              <div className="space-y-4 px-5 py-4">
                <p className="text-sm leading-relaxed text-[var(--crm-muted)]">
                  Abra o documento original salvo junto da análise para auditoria e conferência técnica.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenOriginalDocument(selectedSavedSummaryNotice)}
                  className="crm-btn crm-btn-secondary h-10 px-4"
                >
                  Abrir Documento
                </button>
                <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] px-3 py-2 text-xs text-[var(--crm-muted)]">
                  {selectedSavedSummaryNotice.sourceUrl || 'Documento original salvo no histórico interno.'}
                </div>
              </div>
            </div>

            <div className="crm-panel p-2">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                {ANALYSIS_DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAnalysisDetailTab(tab.id)}
                    className={[
                      'h-10 rounded-xl border text-xs font-black uppercase tracking-[0.06em] transition-all',
                      analysisDetailTab === tab.id
                        ? 'border-[rgb(var(--crm-accent-rgb)_/_0.65)] bg-[rgb(var(--crm-accent-rgb)_/_0.22)] text-[var(--crm-ink)]'
                        : 'border-transparent text-[var(--crm-muted)] hover:border-[color:var(--crm-border)] hover:text-[var(--crm-ink)]'
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="crm-card min-h-[420px] p-5">
              {analysisDetailTab === 'GERAL' && (
                <div className="space-y-4">
                  <div className="text-2xl font-black text-[var(--crm-ink)]">Identificação do certame</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Data da sessão</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {formatDateFlexible(selectedSavedSummaryAnalysis.general?.openingDate)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Órgão licitante</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)] line-clamp-2">
                        {selectedSavedSummaryAnalysis.general?.agency || 'Não identificado'}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Modalidade</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {selectedSavedSummaryAnalysis.general?.modality || 'Não identificado'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Portal / Plataforma</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)] line-clamp-2">
                        {selectedSavedSummaryAnalysis.general?.portal || 'Não identificado'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Hora da sessão</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {selectedSavedSummaryAnalysis.general?.openingTime || 'Não identificado'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[color:var(--crm-border)] pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Objeto extraído</div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--crm-muted)] whitespace-pre-wrap">
                      {selectedSavedSummaryAnalysis.general?.objectSummary || 'Objeto não identificado.'}
                    </p>
                  </div>
                </div>
              )}

              {analysisDetailTab === 'PRAZOS' && (
                <div className="space-y-4">
                  <div className="text-2xl font-black text-[var(--crm-ink)]">Prazos e marcos</div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Abertura</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {formatDateFlexible(selectedSavedSummaryAnalysis.deadlines?.openingDate)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Publicação</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {formatDateFlexible(selectedSavedSummaryAnalysis.deadlines?.publicationDate)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Impugnação</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {formatDateFlexible(selectedSavedSummaryAnalysis.deadlines?.impugnationDeadline)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Esclarecimentos</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {formatDateFlexible(selectedSavedSummaryAnalysis.deadlines?.clarificationDeadline)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Prazo de proposta</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {formatDateFlexible(selectedSavedSummaryAnalysis.deadlines?.proposalDeadline)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Vigência contratual</div>
                      <div className="mt-1 text-lg font-bold text-[var(--crm-ink)]">
                        {selectedSavedSummaryAnalysis.deadlines?.contractTerm || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {analysisDetailTab === 'EXIGENCIAS' && (
                <div className="space-y-3">
                  <div className="text-2xl font-black text-[var(--crm-ink)]">Exigências e checklist</div>
                  {(selectedSavedSummaryAnalysis.requirementGroups?.length || 0) === 0 &&
                  (selectedSavedSummaryAnalysis.checklistDocumentacao?.length || 0) === 0 ? (
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4 text-sm text-[var(--crm-muted)]">
                      A IA não retornou checklist para este resumo.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(selectedSavedSummaryAnalysis.requirementGroups || []).map((group) => (
                        <div key={group.id} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.56)] p-4">
                          <div className="text-xs font-black uppercase tracking-[0.08em] text-[var(--crm-muted)]">{group.label}</div>
                          <ul className="mt-3 space-y-2 text-sm text-[var(--crm-muted)]">
                            {group.items.map((item, index) => (
                              <li
                                key={`${group.id}-${index}`}
                                className="rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] px-3 py-2"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {analysisDetailTab === 'ITENS_TR' && (
                selectedSavedSummaryAnalysis.isTrAnalysis ? (
                  <div className="space-y-2">
                    <div className="text-xl font-black text-[var(--crm-ink)]">Caderno técnico do TR</div>
                    {(selectedSavedSummaryAnalysis.technicalNotebook || []).length === 0 ? (
                      <div className="text-sm text-[var(--crm-muted)]">Sem itens técnicos extraídos para o TR.</div>
                    ) : (
                      <div className="space-y-2 text-sm text-[var(--crm-muted)]">
                        {(selectedSavedSummaryAnalysis.technicalNotebook || []).map((item, index) => (
                          <div key={`${item.termRequirement}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-[var(--crm-ink)]">{item.termRequirement}</div>
                              <span
                                className={[
                                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                  item.meetsRequirement === 'ATENDE'
                                    ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'
                                    : 'border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-200'
                                ].join(' ')}
                              >
                                {item.meetsRequirement === 'ATENDE' ? 'Atende' : 'Não atende'}
                              </span>
                            </div>
                            {item.datasheetEvidence && (
                              <div className="mt-2 text-xs text-[var(--crm-muted)]">Evidência: {item.datasheetEvidence}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xl font-black text-[var(--crm-ink)]">Itens extraídos do edital</div>
                    {(selectedSavedSummaryAnalysis.items || []).length === 0 ? (
                      <div className="text-sm text-[var(--crm-muted)]">Sem itens técnicos extraídos.</div>
                    ) : (
                      <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                        {(selectedSavedSummaryAnalysis.items || []).map((item, index) => (
                          <li key={`${item.name}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                            <div className="font-semibold text-[var(--crm-ink)]">{item.name}</div>
                            <div className="mt-1 text-xs text-[var(--crm-muted)]">Quantidade: {item.quantity}</div>
                            <div className="mt-0.5 text-xs text-[var(--crm-muted)]">Especificações: {item.specs}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              )}

              {analysisDetailTab === 'DOCUMENTACAO' && (
                <div className="space-y-3">
                  <div className="text-2xl font-black text-[var(--crm-ink)]">Documentação e certificações</div>
                  {(selectedSavedSummaryAnalysis.documentationChecklist || []).length === 0 ? (
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4 text-sm text-[var(--crm-muted)]">
                      Este resumo salvo não retornou documentos obrigatórios na extração.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedSavedSummaryAnalysis.documentationChecklist || []).map((item, index) => (
                        <div key={`${item?.item || 'documento'}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-[var(--crm-ink)]">{item?.item || 'Documento sem descrição'}</div>
                            <span
                              className={[
                                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                checklistStatusClassName(item?.status)
                              ].join(' ')}
                            >
                              {checklistStatusLabel(item?.status)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-[var(--crm-muted)]">{item?.details || 'Sem observações.'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {analysisDetailTab === 'RISCOS_IA' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Recomendação</div>
                      <div className="mt-1 text-lg font-black text-[var(--crm-ink)]">
                        {selectedSavedSummaryAnalysis.recommendation || 'GO_COM_RESSALVAS'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.62)] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Score de aderência</div>
                      <div className={['mt-1 text-lg font-black', scoreColor(Number(selectedSavedSummaryAnalysis.scoreAderencia || 0))].join(' ')}>
                        {Number(selectedSavedSummaryAnalysis.scoreAderencia || 0)} / 100
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Riscos</div>
                      {(selectedSavedSummaryAnalysis.risks || []).length === 0 ? (
                        <div className="text-sm text-[var(--crm-muted)]">Sem riscos identificados.</div>
                      ) : (
                        <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                          {(selectedSavedSummaryAnalysis.risks || []).map((item, index) => (
                            <li key={`${item}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Próximas ações</div>
                      {(selectedSavedSummaryAnalysis.nextActions || []).length === 0 ? (
                        <div className="text-sm text-[var(--crm-muted)]">Sem ações recomendadas.</div>
                      ) : (
                        <ul className="space-y-2 text-sm text-[var(--crm-muted)]">
                          {(selectedSavedSummaryAnalysis.nextActions || []).map((item, index) => (
                            <li key={`${item}-${index}`} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.58)] px-3 py-2">
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <B2GOpportunityDetailModal
        isOpen={Boolean(selectedOpportunityId && selectedOpportunity)}
        onClose={closeOpportunityDetails}
        opportunity={selectedOpportunity}
        onEdit={handleEditOpportunity}
        onDecision={(updated) => {
          setOpportunities(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
        }}
        isAdmin={isAdmin}
      />

      <CloseOpportunityModal
        isOpen={Boolean(pendingOpportunityOutcome)}
        onClose={() => setPendingOpportunityOutcome(null)}
        onConfirm={handleConfirmOpportunityOutcome}
        type={pendingOpportunityOutcome?.targetColumnId || 'GANHO'}
        clientType="B2G"
        opportunity={pendingOpportunityOutcome?.opportunity || null}
        opportunityTitle={
          pendingOpportunityOutcome?.opportunity
            ? `${pendingOpportunityOutcome.opportunity.company?.name || 'Órgão'} - ${pendingOpportunityOutcome.opportunity.projectName || pendingOpportunityOutcome.opportunity.title || 'Oportunidade'}`
            : ''
        }
      />

      {/* Modal de Edição/Criação de Oportunidade B2G - novo componente com 6 abas */}
      <B2GOpportunityEditModal
        isOpen={showOpportunityEditModal}
        onClose={() => { 
          console.log('[B2GEditais] Modal de edição fechando, aba atual:', activeTab, 'URL:', location.pathname);
          setShowOpportunityEditModal(false); 
          setEditingOpportunity(null); 
        }}
        opportunity={editingOpportunity}
        leads={leads}
        mode={opportunityModalMode}
        onSaved={(data, mode) => {
          console.log('[B2GEditais] Oportunidade salva, mode:', mode, 'id:', data?.id);
          if (mode === 'create') {
            setOpportunities(prev => [data, ...prev]);
            setFeedback({ type: 'success', message: 'Oportunidade criada com sucesso!' });
          } else {
            setOpportunities(prev => prev.map(o => o.id === data.id ? { ...o, ...data } : o));
            setFeedback({ type: 'success', message: 'Oportunidade atualizada com sucesso!' });
          }
        }}
      />

      {/* Modal de Alertas de Abertura de Edital */}
      <B2GOpportunityAlerts
        isOpen={showOpportunityAlertsModal}
        onClose={() => setShowOpportunityAlertsModal(false)}
      />
    </div>
  );
}
