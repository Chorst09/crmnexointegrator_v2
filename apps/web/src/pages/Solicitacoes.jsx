import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  RefreshCcw,
  UserCheck,
  ClipboardList,
  Send,
  LayoutGrid,
  List,
  Search,
  FolderOpen,
  Plus,
  ArrowRight,
  Trash2,
  Undo2,
  Save,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import { addFlowMetadataToDescription, getAreaLabel, hydrateActivityFlow } from '../utils/activityFlow';
import { openPreSalesBudgetPdf } from '../utils/preSalesBudgetPrint';

const REQUEST_STATUS_FROM_ACTIVITY = {
  PENDING: 'NOVA',
  IN_PROGRESS: 'EM_PRECIFICACAO',
  COMPLETED: 'FINALIZADA',
  CANCELLED: 'CANCELADA'
};

const ACTIVITY_STATUS_FROM_REQUEST = {
  NOVA: 'PENDING',
  EM_PRECIFICACAO: 'IN_PROGRESS',
  AGUARDANDO_APROVACAO: 'IN_PROGRESS',
  ENVIADA: 'IN_PROGRESS',
  APROVADO: 'COMPLETED',
  REPROVADO: 'CANCELLED',
  FINALIZADA: 'COMPLETED',
  REJEITADA: 'CANCELLED',
  CANCELADA: 'CANCELLED'
};

const STAGE_OPTIONS = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'COTACAO', label: 'Cotação' },
  { value: 'PRECIFICACAO', label: 'Precificação' },
  { value: 'REVISAO', label: 'Revisão' },
  { value: 'ENVIADA', label: 'Enviada' },
  { value: 'APROVADO', label: 'Aprovado' },
  { value: 'REPROVADO', label: 'Reprovado' },
  { value: 'DEVOLVIDA', label: 'Devolvida' }
];

const STAGE_META = {
  ENTRADA: {
    title: 'Entrada',
    subtitle: 'Solicitada • Fila Pré-vendas',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
  },
  COTACAO: {
    title: 'Cotação',
    subtitle: 'Em Cotação • Custos Recebidos',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  PRECIFICACAO: {
    title: 'Precificação',
    subtitle: 'Em Precificação',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  },
  REVISAO: {
    title: 'Revisão',
    subtitle: 'Pronta para Revisão',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
  },
  ENVIADA: {
    title: 'Enviada',
    subtitle: 'Enviada para decisão',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
  },
  APROVADO: {
    title: 'Aprovado',
    subtitle: 'Decisão aprovada',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  REPROVADO: {
    title: 'Reprovado',
    subtitle: 'Decisão reprovada',
    badge: 'bg-red-500/20 text-red-300 border-red-500/40'
  },
  DEVOLVIDA: {
    title: 'Devolvida',
    subtitle: 'Retornada para Comercial/B2B/B2G',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  }
};

const KANBAN_COLUMNS = ['ENTRADA', 'COTACAO', 'PRECIFICACAO', 'REVISAO', 'ENVIADA', 'APROVADO', 'REPROVADO'];
const STATUS_BY_STAGE = {
  ENTRADA: 'NOVA',
  COTACAO: 'EM_PRECIFICACAO',
  PRECIFICACAO: 'EM_PRECIFICACAO',
  REVISAO: 'AGUARDANDO_APROVACAO',
  ENVIADA: 'ENVIADA',
  APROVADO: 'APROVADO',
  REPROVADO: 'REPROVADO'
};
const FLOW_ACTIVITY_ID_RE = /\[FLOW_ACTIVITY_ID:([^\]]+)\]/;
const FLOW_STAGE_RE = /\[FLOW_STAGE:([A-Z_]+)\]/g;

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getCurrentUserName = () => getCurrentUser()?.name || 'Usuário Pré-Vendas';
const getCurrentUserId = () => getCurrentUser()?.id || null;

const unwrapApiEntity = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data;
  return payload;
};

const getPreSalesRows = (payload) => {
  if (Array.isArray(payload?.solicitacoes)) return payload.solicitacoes;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractLinkedActivityId = (observacoes) => String(observacoes || '').match(FLOW_ACTIVITY_ID_RE)?.[1] || null;

const normalizeAreaToken = (value, fallback = 'COMERCIAL') => {
  const token = String(value || '').trim().toUpperCase();
  if (!token) return fallback;
  if (token.includes('B2G')) return 'B2G';
  if (token.includes('B2B')) return 'B2B';
  if (token.includes('PRE')) return 'PRE_VENDAS';
  if (token.includes('COMERCIAL')) return 'COMERCIAL';
  return token.replace(/[\s-]+/g, '_');
};

const extractLastTaggedArea = (raw, label) => {
  const regex = new RegExp(`${label}:\\s*([^\\n\\r]+)`, 'gi');
  const matches = [...String(raw || '').matchAll(regex)];
  const last = matches[matches.length - 1]?.[1];
  return String(last || '').trim();
};

const parseRequestFlow = (observacoes) => {
  const raw = String(observacoes || '');
  const source = normalizeAreaToken(extractLastTaggedArea(raw, 'Origem'), 'COMERCIAL');
  const target = normalizeAreaToken(extractLastTaggedArea(raw, 'Destino'), 'PRE_VENDAS');
  return { sourceArea: source, targetArea: target };
};

const stripStageMarkers = (value) => String(value || '').replace(FLOW_STAGE_RE, '').replace(/\n{3,}/g, '\n\n').trim();

const extractStage = (value) => {
  const raw = String(value || '');
  const match = [...raw.matchAll(FLOW_STAGE_RE)].pop();
  const stage = String(match?.[1] || '').trim().toUpperCase();
  return stage || null;
};

const withStageMarker = (base, stage) => {
  const clean = stripStageMarkers(base);
  const safeStage = String(stage || '').trim().toUpperCase();
  if (!safeStage) return clean;
  return clean ? `${clean}\n\n[FLOW_STAGE:${safeStage}]` : `[FLOW_STAGE:${safeStage}]`;
};

const appendInternalNote = (base, message) => {
  const cleanBase = String(base || '').trim();
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) return cleanBase;

  const stamp = new Date().toLocaleString('pt-BR');
  const line = `[${stamp}] ${getCurrentUserName()}: ${cleanMessage}`;
  return cleanBase ? `${cleanBase}\n\n${line}` : line;
};

const isClosedStatus = (status) => ['FINALIZADA', 'REJEITADA', 'CANCELADA'].includes(String(status || '').toUpperCase());
const isDecisionStatus = (status) => ['APROVADO', 'REPROVADO'].includes(String(status || '').toUpperCase());

const defaultStageFromStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'NOVA') return 'ENTRADA';
  if (normalized === 'EM_PRECIFICACAO') return 'PRECIFICACAO';
  if (normalized === 'AGUARDANDO_APROVACAO') return 'REVISAO';
  if (normalized === 'ENVIADA') return 'ENVIADA';
  if (normalized === 'APROVADO') return 'APROVADO';
  if (normalized === 'REPROVADO') return 'REPROVADO';
  if (isClosedStatus(normalized)) return 'DEVOLVIDA';
  return 'ENTRADA';
};

const resolveStage = (status, explicitStage) => {
  const normalized = String(explicitStage || '').trim().toUpperCase();
  if (normalized && STAGE_META[normalized]) return normalized;
  return defaultStageFromStatus(status);
};

const statusFromStage = (stage, fallbackStatus = 'EM_PRECIFICACAO') => (
  STATUS_BY_STAGE[String(stage || '').toUpperCase()] || fallbackStatus
);

const toPriorityLabel = (priority) => {
  const p = String(priority || '').toUpperCase();
  if (p === 'LOW' || p === 'BAIXA') return 'Baixa';
  if (p === 'HIGH' || p === 'ALTA') return 'Alta';
  if (p === 'URGENT' || p === 'URGENTE') return 'Urgente';
  return 'Média';
};

const getPriorityClass = (priority) => {
  const p = String(priority || '').toUpperCase();
  if (p === 'LOW' || p === 'BAIXA') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30';
  if (p === 'HIGH' || p === 'ALTA') return 'bg-red-500/20 text-red-200 border-red-500/30';
  if (p === 'URGENT' || p === 'URGENTE') return 'bg-red-600/25 text-red-100 border-red-600/40';
  return 'bg-blue-500/20 text-blue-200 border-blue-500/30';
};

const getStatusLabel = (status) => {
  const key = String(status || '').toUpperCase();
  const labels = {
    NOVA: 'Nova',
    EM_PRECIFICACAO: 'Em Precificação',
    AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
    ENVIADA: 'Enviada',
    APROVADO: 'Aprovado',
    REPROVADO: 'Reprovado',
    FINALIZADA: 'Finalizada',
    REJEITADA: 'Rejeitada',
    CANCELADA: 'Cancelada'
  };
  return labels[key] || key;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const mapRequestRow = (row) => {
  const explicitStage = extractStage(row.observacoes);
  return {
    id: row.id,
    sourceType: 'REQUEST',
    linkedActivityId: extractLinkedActivityId(row.observacoes),
    numero: row.numero,
    titulo: row.titulo,
    descricao: stripStageMarkers(row.descricao),
    nomeCliente: row.nomeCliente || row.lead?.name || '',
    status: row.status,
    prioridade: row.prioridade,
    solicitante: row.solicitante || null,
    assignedTo: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dueDate: null,
    tiposPrecificacao: Array.isArray(row.tiposPrecificacao) ? row.tiposPrecificacao : [],
    observacoes: row.observacoes || '',
    calculoDetalhes: row.calculoDetalhes && typeof row.calculoDetalhes === 'object' ? row.calculoDetalhes : {},
    items: Array.isArray(row.items) ? row.items : [],
    valorSugerido: row.valorSugerido || 0,
    custoTotal: row.custoTotal || 0,
    margemLucro: row.margemLucro || 0,
    company: row.lead ? { id: row.lead.id, name: row.lead.name } : null,
    opportunity: row.opportunity || null,
    stage: resolveStage(row.status, explicitStage),
    flow: parseRequestFlow(row?.observacoes)
  };
};

const mapActivityRow = (activity) => {
  const explicitStage = extractStage(activity.description);
  const stage = resolveStage(REQUEST_STATUS_FROM_ACTIVITY[activity.status] || 'NOVA', explicitStage);
  const status = explicitStage ? statusFromStage(stage, REQUEST_STATUS_FROM_ACTIVITY[activity.status] || 'NOVA') : REQUEST_STATUS_FROM_ACTIVITY[activity.status] || 'NOVA';

  return {
    id: `activity:${activity.id}`,
    rawActivityId: activity.id,
    sourceType: 'ACTIVITY',
    numero: `ATV-${String(activity.id || '').slice(0, 8).toUpperCase()}`,
    titulo: activity.subject || 'Solicitação recebida via atividade',
    descricao: stripStageMarkers(activity.description) || 'Sem descrição',
    status,
    prioridade: activity.priority || 'MEDIUM',
    solicitante: {
      id: null,
      name: activity?.flow?.createdByName || activity?.assignedTo?.name || 'Comercial'
    },
    assignedTo: activity.assignedTo || null,
    createdAt: activity.createdAt,
    dueDate: activity.dueDate || null,
    tiposPrecificacao: ['SERVICOS'],
    observacoes: '',
    calculoDetalhes: {},
    valorSugerido: 0,
    custoTotal: 0,
    margemLucro: 0,
    company: activity.company ? { id: activity.company.id, name: activity.company.name } : null,
    opportunity: activity.opportunity ? { id: activity.opportunity.id, title: activity.opportunity.title } : null,
    stage,
    flow: activity.flow || { sourceArea: 'COMERCIAL', targetArea: 'PRE_VENDAS' }
  };
};

const stageLabel = (stage) => STAGE_META[stage]?.title || stage;
const COTACAO_TABS = ['ITENS', 'HISTORICO', 'COTACOES', 'PRECIFICACAO', 'PROPOSTAS', 'ACOES'];
const toCurrency = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const BUDGET_NUMBER_RE = /^ORC-(\d{4})-(\d{4})$/;

const getRequestDetails = (item) => (
  item?.calculoDetalhes && typeof item.calculoDetalhes === 'object'
    ? item.calculoDetalhes
    : {}
);

const collectBudgetNumbers = (source) => {
  const requests = Array.isArray(source) ? source : [source];
  return requests.flatMap((request) => {
    const details = getRequestDetails(request);
    const cotacoes = Array.isArray(details.cotacoes) ? details.cotacoes : [];
    return [
      request?.numero,
      ...cotacoes.map((cotacao) => cotacao?.numeroOrcamento)
    ].filter(Boolean);
  });
};

const generateNextBudgetNumber = (sources = []) => {
  const year = new Date().getFullYear();
  const maxSequence = collectBudgetNumbers(sources).reduce((max, number) => {
    const match = String(number || '').trim().toUpperCase().match(BUDGET_NUMBER_RE);
    if (!match || Number(match[2]) !== year) return max;
    const sequence = parseInt(match[1], 10);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `ORC-${String(maxSequence + 1).padStart(4, '0')}-${year}`;
};

const resolveBudgetNumber = (item, sources = []) => {
  const ownNumber = String(item?.numero || '').trim().toUpperCase();
  return BUDGET_NUMBER_RE.test(ownNumber) ? ownNumber : generateNextBudgetNumber(sources);
};

const nextQuoteItem = () => ({
  id: `q-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  descricao: '',
  quantidade: 1,
  custoUnitario: ''
});

const inferModalidade = (item) => {
  const first = String(item?.tiposPrecificacao?.[0] || 'VENDA').toUpperCase();
  if (first.includes('LOC')) return 'LOCACAO';
  if (first.includes('SERV')) return 'SERVICOS';
  return 'VENDA';
};

const buildInitialCotacaoForm = (item, sources = []) => {
  const proposalDetails = readProposalDetails(item);
  const currentUser = getCurrentUser();
  const clienteOrgao = proposalDetails.clienteOrgao || item?.nomeCliente || item?.company?.name || '';
  const requestItems = Array.isArray(item?.items)
    ? item.items
        .filter((entry) => String(entry?.descricao || entry?.product?.name || '').trim())
        .map((entry) => ({
          id: nextQuoteItem().id,
          descricao: entry.descricao || entry?.product?.name || '',
          quantidade: entry.quantidade || 1,
          custoUnitario: entry.custoUnitario ?? ''
        }))
    : [];

  return {
    modalidade: inferModalidade(item),
    distribuidorId: proposalDetails.distribuidorId || '',
    distribuidor: proposalDetails.distribuidor || '',
    fornecedorId: proposalDetails.fornecedorId || '',
    fornecedor: proposalDetails.fornecedor || '',
    numeroOrcamento: resolveBudgetNumber(item, sources),
    clienteOrgao,
    cnpjDocumento: proposalDetails.cnpjDocumento || '',
    contatoCliente: proposalDetails.contatoCliente || clienteOrgao,
    emailCliente: proposalDetails.emailCliente || '',
    telefoneCliente: proposalDetails.telefoneCliente || '',
    gerenteConta: proposalDetails.gerenteConta || item?.solicitante?.name || currentUser?.name || '',
    emailGerente: proposalDetails.emailGerente || item?.solicitante?.email || currentUser?.email || '',
    telefoneGerente: proposalDetails.telefoneGerente || currentUser?.phone || '',
    premissasProposta: proposalDetails.premissasProposta || item?.descricao || '',
    itens: requestItems.length > 0 ? requestItems : [nextQuoteItem()],
    arquivo: null,
    arquivoNome: '',
    observacoesCotacao: '',
    observacoesUpload: ''
  };
};

const readCotacaoDetails = (item) => {
  const details = getRequestDetails(item);

  return {
    cotacoes: Array.isArray(details.cotacoes) ? details.cotacoes : [],
    uploads: Array.isArray(details.uploadsCotacao) ? details.uploadsCotacao : []
  };
};

const readProposalDetails = (item) => {
  const details = getRequestDetails(item);
  return details.dadosProposta && typeof details.dadosProposta === 'object'
    ? details.dadosProposta
    : {};
};

const pickCotacaoPartner = (row = {}, fallback = {}) => {
  const items = Array.isArray(row?.itens) ? row.itens : [];
  const firstItemWithDistributor = items.find((item) => item?.distribuidor || item?.distribuidorId) || {};
  const firstItemWithSupplier = items.find((item) => item?.fornecedor || item?.fornecedorId) || {};

  return {
    distribuidorId: row?.distribuidorId || firstItemWithDistributor?.distribuidorId || fallback?.distribuidorId || '',
    distribuidor: row?.distribuidor || firstItemWithDistributor?.distribuidor || fallback?.distribuidor || '',
    fornecedorId: row?.fornecedorId || firstItemWithSupplier?.fornecedorId || fallback?.fornecedorId || '',
    fornecedor: row?.fornecedor || firstItemWithSupplier?.fornecedor || fallback?.fornecedor || ''
  };
};

const buildCotacaoPricingPayload = (context, cotacao, allCotacoes = []) => {
  const proposalDetails = readProposalDetails(context);
  const partner = pickCotacaoPartner(cotacao, proposalDetails);
  const modalidade = String(cotacao?.modalidade || inferModalidade(context) || 'VENDA').toUpperCase();
  const itens = Array.isArray(cotacao?.itens) && cotacao.itens.length > 0
    ? cotacao.itens
    : [nextQuoteItem()];
  const nomeCliente = proposalDetails.clienteOrgao || context?.nomeCliente || context?.company?.name || '';
  const custos = Array.isArray(allCotacoes) && allCotacoes.length > 0 ? allCotacoes : [cotacao].filter(Boolean);

  return {
    itens,
    subtotal: Number(cotacao?.subtotal || 0),
    modalidade,
    numeroOrcamento: cotacao?.numeroOrcamento || context?.numero || '',
    distribuidorId: partner.distribuidorId,
    distribuidor: partner.distribuidor,
    fornecedorId: partner.fornecedorId,
    fornecedor: partner.fornecedor,
    solicitacaoId: context?.id || '',
    titulo: context?.titulo || '',
    descricao: context?.descricao || '',
    nomeCliente,
    oportunidadeId: context?.opportunity?.id || '',
    oportunidadeTitulo: context?.opportunity?.title || '',
    cliente: {
      nome: nomeCliente,
      documento: proposalDetails.cnpjDocumento || '',
      contato: proposalDetails.contatoCliente || nomeCliente,
      telefone: proposalDetails.telefoneCliente || '',
      email: proposalDetails.emailCliente || ''
    },
    gerente: {
      nome: proposalDetails.gerenteConta || context?.solicitante?.name || '',
      email: proposalDetails.emailGerente || context?.solicitante?.email || '',
      telefone: proposalDetails.telefoneGerente || ''
    },
    premissas: proposalDetails.premissasProposta || context?.observacoes || context?.descricao || '',
    dadosProposta: proposalDetails,
    todosCustos: custos
  };
};

export default function Solicitacoes() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [budgetRequests, setBudgetRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showViewModal, setShowViewModal] = useState(false);
  const [showRespostaModal, setShowRespostaModal] = useState(false);
  const [showCotacaoModal, setShowCotacaoModal] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
  const [cotacaoContext, setCotacaoContext] = useState(null);
  const [cotacaoTab, setCotacaoTab] = useState('COTACOES');
  const [cotacaoForm, setCotacaoForm] = useState(buildInitialCotacaoForm(null));
  const [cotacaoSaving, setCotacaoSaving] = useState(false);
  const [cotacaoFeedback, setCotacaoFeedback] = useState('');
  const [statusTransition, setStatusTransition] = useState({ nextStatus: '', motivo: '' });
  const [devolucaoComercial, setDevolucaoComercial] = useState({
    numeroProposta: '',
    versao: '1',
    validade: '',
    cenario: 'PADRAO',
    observacoes: ''
  });
  const [cotacaoParaPrecificar, setCotacaoParaPrecificar] = useState(null);
  const [cotacaoPickerOpen, setCotacaoPickerOpen] = useState(false);
  const [cotacaoSearchTerm, setCotacaoSearchTerm] = useState('');

  const [queueView, setQueueView] = useState('PRE_VENDAS');
  const [viewMode, setViewMode] = useState('KANBAN');
  const [onlyMine, setOnlyMine] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedItemId, setDraggedItemId] = useState('');
  const [dragOverStage, setDragOverStage] = useState('');

  const [respostaData, setRespostaData] = useState({
    mensagem: '',
    nextStatus: 'AGUARDANDO_APROVACAO',
    nextStage: 'REVISAO',
    valorSugerido: '',
    custoTotal: '',
    margemLucro: ''
  });

  const loadSolicitacoes = async () => {
    try {
      setLoading(true);

      const [requestsRes, activitiesRes] = await Promise.all([
        fetch(buildApiUrl('/pre-vendas?limit=200'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/activities-simple'), { headers: getAuthHeaders() })
      ]);

      const requestPayload = requestsRes.ok ? await requestsRes.json() : null;
      const requestRows = getPreSalesRows(requestPayload);

      const mappedRequests = requestRows.map(mapRequestRow);
      setBudgetRequests(mappedRequests);
      const linkedActivityIds = new Set(mappedRequests.map((item) => item.linkedActivityId).filter(Boolean));

      const activityPayload = activitiesRes.ok ? await activitiesRes.json() : [];
      const hydratedActivities = Array.isArray(activityPayload)
        ? activityPayload.map(hydrateActivityFlow)
        : [];

      const mappedActivities = hydratedActivities
        .filter((activity) => activity?.flow?.targetArea === 'PRE_VENDAS' || activity?.flow?.sourceArea === 'PRE_VENDAS')
        .filter((activity) => {
          const inboundPreSales = activity?.flow?.targetArea === 'PRE_VENDAS';
          if (inboundPreSales && linkedActivityIds.has(activity.id)) return false;
          return true;
        })
        .map(mapActivityRow);

      const merged = [...mappedRequests, ...mappedActivities].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      setSolicitacoes(merged);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      setSolicitacoes([]);
      setBudgetRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSolicitacoes();
  }, []);

  const updateRequest = async (id, payload) => {
    const response = await fetch(buildApiUrl(`/pre-vendas/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'Falha ao atualizar solicitação');
    }

    const data = await response.json().catch(() => null);
    return unwrapApiEntity(data);
  };

  const updateActivity = async (id, payload) => {
    const response = await fetch(buildApiUrl('/activities-simple'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, ...payload })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'Falha ao atualizar atividade');
    }

    return response.json().catch(() => null);
  };

  const buildActivityDescription = (item, message, nextStage, flowOverride) => {
    const base = appendInternalNote(item.descricao, message);
    const withStage = withStageMarker(base, nextStage);
    const stage = String(nextStage || '').toUpperCase();
    const attachPreSalesReference = item?.sourceType === 'REQUEST' && (
      flowOverride?.sourceArea === 'PRE_VENDAS' ||
      ['DEVOLVIDA', 'ENVIADA', 'APROVADO', 'REPROVADO'].includes(stage)
    );

    return addFlowMetadataToDescription(withStage, {
      sourceArea: flowOverride?.sourceArea || item?.flow?.sourceArea || 'COMERCIAL',
      targetArea: flowOverride?.targetArea || item?.flow?.targetArea || 'PRE_VENDAS',
      createdFrom: item?.flow?.createdFrom || 'ATIVIDADES',
      createdByName: item?.flow?.createdByName || getCurrentUserName(),
      ...(attachPreSalesReference ? {
        returnedFromPreSales: true,
        preSalesRequestId: item.id,
        preSalesNumber: item.numero,
        preSalesReturnedAt: new Date().toISOString()
      } : {})
    });
  };

  const updateItem = async (item, { nextStatus, nextStage, message, pricingPayload, flowOverride } = {}) => {
    if (!item) return;
    const shouldReturnToOrigin = nextStage === 'DEVOLVIDA' || ['FINALIZADA', 'REJEITADA', 'CANCELADA'].includes(nextStatus);
    const effectiveFlowOverride = flowOverride || (
      shouldReturnToOrigin
        ? {
          sourceArea: 'PRE_VENDAS',
          targetArea: item?.flow?.sourceArea || 'COMERCIAL'
        }
        : undefined
    );

    if (item.sourceType === 'ACTIVITY') {
      const activityStatus = ACTIVITY_STATUS_FROM_REQUEST[nextStatus] || 'IN_PROGRESS';
      const payload = {
        status: activityStatus,
        description: buildActivityDescription(item, message, nextStage, effectiveFlowOverride)
      };
      await updateActivity(item.rawActivityId, payload);
      return;
    }

    const nextObservacoes = withStageMarker(appendInternalNote(item.observacoes, message), nextStage);
    const payload = {
      status: nextStatus,
      observacoes: nextObservacoes,
      ...(pricingPayload || {})
    };
    await updateRequest(item.id, payload);

    if (item.linkedActivityId) {
      const activityStatus = ACTIVITY_STATUS_FROM_REQUEST[nextStatus] || 'IN_PROGRESS';
      await updateActivity(item.linkedActivityId, {
        status: activityStatus,
        description: buildActivityDescription(item, message, nextStage, effectiveFlowOverride)
      });
    }
  };

  const handleAssumir = async (item) => {
    try {
      setSaving(true);
      await updateItem(item, {
        nextStatus: 'EM_PRECIFICACAO',
        nextStage: 'COTACAO',
        message: 'Demanda assumida pelo Pré-Vendas.'
      });
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao assumir solicitação:', error);
      alert(error.message || 'Erro ao assumir solicitação');
    } finally {
      setSaving(false);
    }
  };

  const handleAvancarEtapa = async (item) => {
    const stage = resolveStage(item.status, item.stage);

    if (stage === 'ENTRADA') {
      await handleAssumir(item);
      return;
    }

    if (stage === 'COTACAO') {
      try {
        setSaving(true);
        await updateItem(item, {
          nextStatus: 'EM_PRECIFICACAO',
          nextStage: 'PRECIFICACAO',
          message: 'Custos e cotações recebidos. Avançado para precificação.'
        });
        await loadSolicitacoes();
      } catch (error) {
        console.error('Erro ao avançar etapa:', error);
        alert(error.message || 'Erro ao avançar etapa');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (stage === 'PRECIFICACAO') {
      setSelectedSolicitacao(item);
      setRespostaData({
        mensagem: '',
        nextStatus: 'AGUARDANDO_APROVACAO',
        nextStage: 'REVISAO',
        valorSugerido: item.valorSugerido ? String(item.valorSugerido) : '',
        custoTotal: item.custoTotal ? String(item.custoTotal) : '',
        margemLucro: item.margemLucro ? String(item.margemLucro) : ''
      });
      setShowRespostaModal(true);
      return;
    }

    if (stage === 'REVISAO') {
      setSelectedSolicitacao(item);
      setRespostaData({
        mensagem: '',
        nextStatus: 'ENVIADA',
        nextStage: 'ENVIADA',
        valorSugerido: item.valorSugerido ? String(item.valorSugerido) : '',
        custoTotal: item.custoTotal ? String(item.custoTotal) : '',
        margemLucro: item.margemLucro ? String(item.margemLucro) : ''
      });
      setShowRespostaModal(true);
    }
  };

  const handleCancelar = async (item) => {
    const nextStatus = item.sourceType === 'ACTIVITY' ? 'CANCELADA' : 'REJEITADA';

    try {
      setSaving(true);
      await updateItem(item, {
        nextStatus,
        nextStage: 'DEVOLVIDA',
        message: 'Demanda cancelada/rejeitada no fluxo de Pré-Vendas.'
      });
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao cancelar/rejeitar:', error);
      alert(error.message || 'Erro ao cancelar/rejeitar');
    } finally {
      setSaving(false);
    }
  };

  const handleDecisao = async (item, approved) => {
    const nextStatus = approved ? 'APROVADO' : 'REPROVADO';
    const nextStage = approved ? 'APROVADO' : 'REPROVADO';

    try {
      setSaving(true);
      await updateItem(item, {
        nextStatus,
        nextStage,
        message: approved
          ? 'Solicitação aprovada após envio.'
          : 'Solicitação reprovada após envio.'
      });
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao aplicar decisão:', error);
      alert(error.message || 'Erro ao aplicar decisão');
    } finally {
      setSaving(false);
    }
  };

  const openResponderModal = (item) => {
    const stage = resolveStage(item.status, item.stage);

    let nextStatus = 'AGUARDANDO_APROVACAO';
    let nextStage = 'REVISAO';

    if (stage === 'ENTRADA') {
      nextStatus = 'EM_PRECIFICACAO';
      nextStage = 'COTACAO';
    } else if (stage === 'COTACAO') {
      nextStatus = 'EM_PRECIFICACAO';
      nextStage = 'PRECIFICACAO';
    } else if (stage === 'REVISAO') {
      nextStatus = 'ENVIADA';
      nextStage = 'ENVIADA';
    } else if (stage === 'ENVIADA') {
      nextStatus = 'APROVADO';
      nextStage = 'APROVADO';
    }

    setSelectedSolicitacao(item);
    setRespostaData({
      mensagem: '',
      nextStatus,
      nextStage,
      valorSugerido: item.valorSugerido ? String(item.valorSugerido) : '',
      custoTotal: item.custoTotal ? String(item.custoTotal) : '',
      margemLucro: item.margemLucro ? String(item.margemLucro) : ''
    });
    setShowRespostaModal(true);
  };

  const submitResposta = async () => {
    if (!selectedSolicitacao) return;

    try {
      setSaving(true);

      const pricingPayload = selectedSolicitacao.sourceType === 'ACTIVITY'
        ? undefined
        : {
          ...(toNumberOrNull(respostaData.valorSugerido) !== null ? { valorSugerido: toNumberOrNull(respostaData.valorSugerido) } : {}),
          ...(toNumberOrNull(respostaData.custoTotal) !== null ? { custoTotal: toNumberOrNull(respostaData.custoTotal) } : {}),
          ...(toNumberOrNull(respostaData.margemLucro) !== null ? { margemLucro: toNumberOrNull(respostaData.margemLucro) } : {})
        };

      // Incluir referência da proposta na mensagem se selecionada
      const mensagemFinal = respostaData.propostaNome
        ? `${respostaData.mensagem || ''}\n\nProposta anexada: ${respostaData.propostaNome}`.trim()
        : respostaData.mensagem;

      const shouldReturnToCommercial =
        selectedSolicitacao.sourceType === 'ACTIVITY'
        && respostaData.nextStatus === 'FINALIZADA';

      const flowOverride = shouldReturnToCommercial
        ? {
          sourceArea: 'PRE_VENDAS',
          targetArea: selectedSolicitacao?.flow?.sourceArea || 'COMERCIAL'
        }
        : undefined;

      await updateItem(selectedSolicitacao, {
        nextStatus: respostaData.nextStatus,
        nextStage: respostaData.nextStage,
        message: mensagemFinal,
        pricingPayload,
        flowOverride
      });

      setShowRespostaModal(false);
      setSelectedSolicitacao(null);
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao responder solicitação:', error);
      alert(error.message || 'Erro ao enviar resposta');
    } finally {
      setSaving(false);
    }
  };

  const updateRespostaStatus = (nextStatus) => {
    setRespostaData((prev) => ({
      ...prev,
      nextStatus,
      nextStage: defaultStageFromStatus(nextStatus)
    }));
  };

  const handleStageDrop = async (targetStage) => {
    const nextStage = String(targetStage || '').toUpperCase();
    const item = activeItems.find((entry) => entry.id === draggedItemId);
    setDraggedItemId('');
    setDragOverStage('');

    if (!item || !STATUS_BY_STAGE[nextStage]) return;

    const currentStage = resolveStage(item.status, item.stage);
    if (currentStage === nextStage) return;

    const nextStatus = statusFromStage(nextStage, item.status);

    try {
      setSaving(true);
      await updateItem(item, {
        nextStatus,
        nextStage,
        message: `Card movido de ${stageLabel(currentStage)} para ${stageLabel(nextStage)}.`
      });
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao mover card:', error);
      alert(error.message || 'Erro ao mover card');
    } finally {
      setSaving(false);
    }
  };

  const createRequestFromActivity = async (item) => {
    if (!item || item.sourceType !== 'ACTIVITY') return item;
    const existing = solicitacoes.find(
      (entry) => entry.sourceType === 'REQUEST' && entry.linkedActivityId && entry.linkedActivityId === item.rawActivityId
    );
    if (existing) return existing;

    const payload = {
      titulo: item.titulo || 'Solicitação do Comercial',
      descricao: item.descricao || 'Solicitação gerada para cotação.',
      prioridade: item.prioridade || 'MEDIUM',
      tiposPrecificacao: Array.isArray(item.tiposPrecificacao) && item.tiposPrecificacao.length > 0
        ? item.tiposPrecificacao
        : ['VENDA'],
      leadId: item?.company?.id || null,
      opportunityId: item?.opportunity?.id || null,
      observacoes: [
        `[FLOW_ACTIVITY_ID:${item.rawActivityId}]`,
        `Origem: ${item?.flow?.sourceArea || 'COMERCIAL'}`,
        'Destino: PRE_VENDAS',
        'Solicitação gerada automaticamente ao abrir cotação.'
      ].join('\n')
    };

    const response = await fetch(buildApiUrl('/pre-vendas'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'Falha ao gerar solicitação para cotação');
    }

    const createdPayload = await response.json().catch(() => null);
    const created = unwrapApiEntity(createdPayload);
    if (!created?.id) {
      throw new Error('A solicitação não foi criada corretamente para o fluxo de cotação');
    }

    const createdMapped = mapRequestRow({
      ...created,
      lead: created?.lead || item.company || null,
      opportunity: created?.opportunity || item.opportunity || null,
      solicitante: created?.solicitante || item.solicitante || null
    });

    return {
      ...createdMapped,
      flow: {
        sourceArea: item?.flow?.sourceArea || createdMapped?.flow?.sourceArea || 'COMERCIAL',
        targetArea: 'PRE_VENDAS'
      },
      linkedActivityId: item.rawActivityId
    };
  };

  const openCotacaoModal = async (item) => {
    try {
      setCotacaoFeedback('');
      setCotacaoSaving(true);

      let effectiveItem = item;
      if (item?.sourceType === 'ACTIVITY') {
        effectiveItem = await createRequestFromActivity(item);
      }

      const { cotacoes } = readCotacaoDetails(effectiveItem);
      const lastQuote = cotacoes[0];
      const details = effectiveItem?.calculoDetalhes && typeof effectiveItem.calculoDetalhes === 'object'
        ? effectiveItem.calculoDetalhes
        : {};
      const lastReturn = Array.isArray(details.devolucoesComercial) ? details.devolucoesComercial[0] : null;
      const propostasPrecificadas = Array.isArray(details.propostasPrecificadas)
        ? details.propostasPrecificadas
        : details.propostaPrecificada ? [details.propostaPrecificada] : [];
      const lastPricedProposal = propostasPrecificadas[0] || null;
      const effectiveStage = resolveStage(effectiveItem.status, effectiveItem.stage);

      setCotacaoContext(effectiveItem);
      setCotacaoTab(effectiveStage === 'REVISAO' ? 'PROPOSTAS' : 'COTACOES');
      setCotacaoForm({
        ...buildInitialCotacaoForm(effectiveItem, budgetRequests),
        distribuidorId: lastQuote?.distribuidorId || details?.dadosProposta?.distribuidorId || '',
        distribuidor: lastQuote?.distribuidor || details?.dadosProposta?.distribuidor || '',
        fornecedorId: lastQuote?.fornecedorId || details?.dadosProposta?.fornecedorId || '',
        fornecedor: lastQuote?.fornecedor || details?.dadosProposta?.fornecedor || '',
        modalidade: lastQuote?.modalidade || inferModalidade(effectiveItem)
      });
      setStatusTransition({ nextStatus: '', motivo: '' });
      setDevolucaoComercial({
        numeroProposta: lastReturn?.numeroProposta || lastPricedProposal?.number || '',
        versao: String(lastReturn?.versao || '1'),
        validade: lastReturn?.validade || '',
        cenario: lastReturn?.cenario || 'PADRAO',
        observacoes: ''
      });
      setShowCotacaoModal(true);
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao abrir cotação:', error);
      alert(error.message || 'Não foi possível abrir o fluxo de cotação');
    } finally {
      setCotacaoSaving(false);
    }
  };

  const addCotacaoItem = () => {
    setCotacaoForm((prev) => ({
      ...prev,
      itens: [...prev.itens, nextQuoteItem()]
    }));
  };

  const removeCotacaoItem = (itemId) => {
    setCotacaoForm((prev) => {
      const nextItems = prev.itens.filter((entry) => entry.id !== itemId);
      return {
        ...prev,
        itens: nextItems.length > 0 ? nextItems : [nextQuoteItem()]
      };
    });
  };

  const updateCotacaoItem = (itemId, key, value) => {
    setCotacaoForm((prev) => ({
      ...prev,
      itens: prev.itens.map((entry) => (entry.id === itemId ? { ...entry, [key]: value } : entry))
    }));
  };

  const saveCotacao = async ({ sendToPricing = false } = {}) => {
    if (!cotacaoContext) return;

    const distribuidor = String(cotacaoForm.distribuidor || '').trim();
    const fornecedor = String(cotacaoForm.fornecedor || '').trim();
    if (!distribuidor && !fornecedor) {
      alert('Informe o distribuidor ou fornecedor antes de salvar a cotação.');
      return;
    }

    const itensValidos = cotacaoForm.itens
      .map((entry) => ({
        descricao: String(entry.descricao || '').trim(),
        quantidade: Number(entry.quantidade || 0),
        custoUnitario: Number(entry.custoUnitario || 0)
      }))
      .filter((entry) => entry.descricao);

    if (itensValidos.length === 0) {
      alert('Adicione pelo menos 1 item na cotação.');
      return;
    }

    try {
      setCotacaoSaving(true);
      setCotacaoFeedback('');

      let target = cotacaoContext;
      if (target.sourceType === 'ACTIVITY') {
        target = await createRequestFromActivity(target);
      }

      const currentDetails = target?.calculoDetalhes && typeof target.calculoDetalhes === 'object'
        ? target.calculoDetalhes
        : {};
      const currentCotacoes = Array.isArray(currentDetails.cotacoes) ? currentDetails.cotacoes : [];
      const currentUploads = Array.isArray(currentDetails.uploadsCotacao) ? currentDetails.uploadsCotacao : [];
      const dadosProposta = {
        ...(currentDetails.dadosProposta && typeof currentDetails.dadosProposta === 'object' ? currentDetails.dadosProposta : {}),
        clienteOrgao: String(cotacaoForm.clienteOrgao || '').trim(),
        cnpjDocumento: String(cotacaoForm.cnpjDocumento || '').trim(),
        contatoCliente: String(cotacaoForm.contatoCliente || '').trim(),
        emailCliente: String(cotacaoForm.emailCliente || '').trim(),
        telefoneCliente: String(cotacaoForm.telefoneCliente || '').trim(),
        gerenteConta: String(cotacaoForm.gerenteConta || '').trim(),
        emailGerente: String(cotacaoForm.emailGerente || '').trim(),
        telefoneGerente: String(cotacaoForm.telefoneGerente || '').trim(),
        premissasProposta: String(cotacaoForm.premissasProposta || '').trim(),
        distribuidorId: cotacaoForm.distribuidorId || '',
        distribuidor,
        fornecedorId: cotacaoForm.fornecedorId || '',
        fornecedor
      };

      const subtotal = itensValidos.reduce((acc, entry) => acc + (entry.quantidade * entry.custoUnitario), 0);
      const quoteId = `COT-${Date.now()}`;

      const novoRegistro = {
        id: quoteId,
        modalidade: cotacaoForm.modalidade,
        distribuidorId: cotacaoForm.distribuidorId || '',
        distribuidor,
        fornecedorId: cotacaoForm.fornecedorId || '',
        fornecedor,
        numeroOrcamento: cotacaoForm.numeroOrcamento || resolveBudgetNumber(target, budgetRequests),
        itens: itensValidos,
        subtotal,
        observacoesCotacao: String(cotacaoForm.observacoesCotacao || '').trim(),
        observacoesUpload: String(cotacaoForm.observacoesUpload || '').trim(),
        arquivoNome: cotacaoForm.arquivoNome || '',
        createdAt: new Date().toISOString(),
        createdByName: getCurrentUserName()
      };

      const novoUpload = cotacaoForm.arquivoNome
        ? {
          id: `UP-${Date.now()}`,
          fileName: cotacaoForm.arquivoNome,
          observacoes: String(cotacaoForm.observacoesUpload || '').trim(),
          createdAt: new Date().toISOString(),
          createdByName: getCurrentUserName()
        }
        : null;

      const nextDetails = {
        ...currentDetails,
        dadosProposta,
        cotacoes: [novoRegistro, ...currentCotacoes],
        uploadsCotacao: novoUpload ? [novoUpload, ...currentUploads] : currentUploads
      };

      const nextStage = sendToPricing ? 'PRECIFICACAO' : 'COTACAO';
      const nextObservacoes = withStageMarker(
        appendInternalNote(
          target.observacoes,
          sendToPricing
            ? `Cotação ${novoRegistro.numeroOrcamento} enviada para precificação.`
            : `Cotação ${novoRegistro.numeroOrcamento} registrada.`
        ),
        nextStage
      );

      await updateRequest(target.id, {
        calculoDetalhes: nextDetails,
        nomeCliente: dadosProposta.clienteOrgao || target.nomeCliente || null,
        modalidade: cotacaoForm.modalidade || target.modalidade || null,
        status: 'EM_PRECIFICACAO',
        observacoes: nextObservacoes
      });

      if (target.linkedActivityId) {
        await updateActivity(target.linkedActivityId, {
          status: 'IN_PROGRESS',
          description: buildActivityDescription(
            target,
            sendToPricing
              ? `Cotação ${novoRegistro.numeroOrcamento} enviada para precificação.`
              : `Cotação ${novoRegistro.numeroOrcamento} registrada.`,
            nextStage
          )
        });
      }

      const nextContext = {
        ...target,
        status: 'EM_PRECIFICACAO',
        stage: nextStage,
        nomeCliente: dadosProposta.clienteOrgao || target.nomeCliente || '',
        modalidade: cotacaoForm.modalidade || target.modalidade || '',
        observacoes: nextObservacoes,
        calculoDetalhes: nextDetails
      };

      setCotacaoContext(nextContext);
      setCotacaoForm(buildInitialCotacaoForm(nextContext, budgetRequests));
      setCotacaoFeedback(sendToPricing ? 'Cotação salva. Abrindo calculadora...' : 'Cotação salva com sucesso.');

      if (sendToPricing) {
        const modalidade = String(cotacaoForm.modalidade || 'VENDA').toUpperCase();
        const tipoCalc = modalidade === 'LOCACAO' || modalidade === 'LOCAÇÃO' ? 'LOCACAO'
          : modalidade === 'SERVICOS' || modalidade === 'SERVIÇOS' ? 'SERVICO'
            : 'VENDA';
        const cotacaoKey = `cotacao_precificar_${Date.now()}`;
        localStorage.setItem(cotacaoKey, JSON.stringify(
          buildCotacaoPricingPayload(nextContext, novoRegistro, nextDetails.cotacoes)
        ));
        window.open(`/calculadoras?tipo=${tipoCalc}&cotacaoKey=${encodeURIComponent(cotacaoKey)}`, '_blank');
        setCotacaoParaPrecificar(novoRegistro);
        setCotacaoTab('PRECIFICACAO');
      }

      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
      alert(error.message || 'Erro ao salvar cotação');
    } finally {
      setCotacaoSaving(false);
    }
  };

  const applyStatusTransition = async () => {
    if (!cotacaoContext?.id || !statusTransition.nextStatus) {
      alert('Selecione um novo status para aplicar a transição.');
      return;
    }

    try {
      setCotacaoSaving(true);
      setCotacaoFeedback('');

      const nextStage = defaultStageFromStatus(statusTransition.nextStatus);
      const note = statusTransition.motivo
        ? `Status alterado para ${getStatusLabel(statusTransition.nextStatus)}. Motivo: ${statusTransition.motivo}`
        : `Status alterado para ${getStatusLabel(statusTransition.nextStatus)}.`;

      const nextObservacoes = withStageMarker(appendInternalNote(cotacaoContext.observacoes, note), nextStage);
      const flow = parseRequestFlow(nextObservacoes);

      await updateRequest(cotacaoContext.id, {
        status: statusTransition.nextStatus,
        observacoes: nextObservacoes
      });

      if (cotacaoContext.linkedActivityId) {
        await updateActivity(cotacaoContext.linkedActivityId, {
          status: ACTIVITY_STATUS_FROM_REQUEST[statusTransition.nextStatus] || 'IN_PROGRESS',
          description: buildActivityDescription(cotacaoContext, note, nextStage)
        });
      }

      setCotacaoContext((prev) => ({
        ...prev,
        status: statusTransition.nextStatus,
        stage: nextStage,
        observacoes: nextObservacoes,
        flow
      }));
      setCotacaoFeedback('Status atualizado com sucesso.');
      setStatusTransition({ nextStatus: '', motivo: '' });
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao aplicar transição de status:', error);
      alert(error.message || 'Erro ao aplicar transição de status');
    } finally {
      setCotacaoSaving(false);
    }
  };

  const devolverAoComercial = async () => {
    if (!cotacaoContext?.id) return;
    if (!devolucaoComercial.numeroProposta.trim()) {
      alert('Informe o número da proposta para devolver ao Comercial.');
      return;
    }

    try {
      setCotacaoSaving(true);
      setCotacaoFeedback('');

      const details = cotacaoContext?.calculoDetalhes && typeof cotacaoContext.calculoDetalhes === 'object'
        ? cotacaoContext.calculoDetalhes
        : {};
      const devolucoes = Array.isArray(details.devolucoesComercial) ? details.devolucoesComercial : [];
      const registroDevolucao = {
        id: `DEV-${Date.now()}`,
        numeroProposta: devolucaoComercial.numeroProposta.trim(),
        versao: Number(devolucaoComercial.versao || 1),
        validade: devolucaoComercial.validade || null,
        cenario: devolucaoComercial.cenario || 'PADRAO',
        observacoes: String(devolucaoComercial.observacoes || '').trim(),
        createdAt: new Date().toISOString(),
        createdByName: getCurrentUserName()
      };

      const nextDetails = {
        ...details,
        devolucoesComercial: [registroDevolucao, ...devolucoes]
      };

      const returnNote = [
        `Devolvido ao Comercial.`,
        `Proposta: ${registroDevolucao.numeroProposta} (v${registroDevolucao.versao})`,
        registroDevolucao.validade ? `Validade: ${registroDevolucao.validade}` : null,
        `Cenário: ${registroDevolucao.cenario}`,
        registroDevolucao.observacoes ? `Obs: ${registroDevolucao.observacoes}` : null
      ]
        .filter(Boolean)
        .join(' ');

      const returnTargetArea = cotacaoContext?.flow?.sourceArea || 'COMERCIAL';
      const nextObservacoes = withStageMarker(
        `${appendInternalNote(cotacaoContext.observacoes, returnNote)}\nOrigem: PRE_VENDAS\nDestino: ${returnTargetArea}`,
        'DEVOLVIDA'
      );

      await updateRequest(cotacaoContext.id, {
        status: 'FINALIZADA',
        observacoes: nextObservacoes,
        calculoDetalhes: nextDetails
      });

      if (cotacaoContext.linkedActivityId) {
        await updateActivity(cotacaoContext.linkedActivityId, {
          status: 'COMPLETED',
          description: buildActivityDescription(
            cotacaoContext,
            returnNote,
            'DEVOLVIDA',
            {
              sourceArea: 'PRE_VENDAS',
              targetArea: returnTargetArea
            }
          )
        });
      }

      setCotacaoContext((prev) => ({
        ...prev,
        status: 'FINALIZADA',
        stage: 'DEVOLVIDA',
        observacoes: nextObservacoes,
        calculoDetalhes: nextDetails,
        flow: {
          sourceArea: 'PRE_VENDAS',
          targetArea: returnTargetArea
        }
      }));
      setCotacaoFeedback('');
      setCotacaoTab('ACOES');
      setShowCotacaoModal(false);
      setCotacaoContext(null);
      setCotacaoParaPrecificar(null);
      setDevolucaoComercial({
        numeroProposta: '',
        versao: '1',
        validade: '',
        cenario: 'PADRAO',
        observacoes: ''
      });
      await loadSolicitacoes();
    } catch (error) {
      console.error('Erro ao devolver ao Comercial:', error);
      alert(error.message || 'Erro ao devolver ao Comercial');
    } finally {
      setCotacaoSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase();

    return solicitacoes.filter((item) => {
      const isPreSalesQueue = item.sourceType === 'REQUEST' || item?.flow?.targetArea === 'PRE_VENDAS';
      const isCommercialQueue = item?.flow?.sourceArea === 'PRE_VENDAS' && item?.flow?.targetArea !== 'PRE_VENDAS';

      if (queueView === 'PRE_VENDAS' && !isPreSalesQueue) return false;
      if (queueView === 'COMERCIAL' && !isCommercialQueue) return false;

      if (onlyMine) {
        if (item.sourceType === 'ACTIVITY') {
          if (item?.assignedTo?.id !== currentUserId) return false;
        } else if (item?.solicitante?.id && item.solicitante.id !== currentUserId) {
          return false;
        }
      }

      if (!term) return true;

      const haystack = [
        item.numero,
        item.titulo,
        item.descricao,
        item.company?.name,
        item.opportunity?.title,
        item.solicitante?.name,
        getAreaLabel(item?.flow?.sourceArea),
        getAreaLabel(item?.flow?.targetArea)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [solicitacoes, queueView, onlyMine, currentUserId, searchTerm]);

  const activeItems = useMemo(
    () => filteredItems.filter((item) => !isClosedStatus(item.status)),
    [filteredItems]
  );

  const devolvidasCount = useMemo(
    () => filteredItems.filter((item) => isClosedStatus(item.status)).length,
    [filteredItems]
  );

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return activeItems.filter((item) => {
      const due = normalizeDate(item.dueDate);
      if (!due) return false;
      return due.getTime() < now;
    }).length;
  }, [activeItems]);

  const inExecutionCount = useMemo(
    () => activeItems.filter((item) => resolveStage(item.status, item.stage) !== 'ENTRADA').length,
    [activeItems]
  );

  const kanbanByStage = useMemo(() => {
    const grouped = KANBAN_COLUMNS.reduce((acc, stage) => {
      acc[stage] = [];
      return acc;
    }, {});

    activeItems.forEach((item) => {
      const stage = resolveStage(item.status, item.stage);
      const targetStage = grouped[stage] ? stage : 'ENTRADA';
      grouped[targetStage].push(item);
    });

    KANBAN_COLUMNS.forEach((stage) => {
      grouped[stage] = (grouped[stage] || []).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    });

    return grouped;
  }, [activeItems]);

  const stats = useMemo(() => ([
    {
      title: 'Total na fila',
      value: activeItems.length,
      subtitle: queueView === 'PRE_VENDAS' ? 'Fila Pré-vendas' : 'Fila Comercial',
      icon: ClipboardList,
      color: 'blue'
    },
    {
      title: 'Em execução',
      value: inExecutionCount,
      subtitle: 'Em cotação / precificação / revisão',
      icon: Clock,
      color: 'purple'
    },
    {
      title: 'Atrasadas',
      value: overdueCount,
      subtitle: 'Com prazo vencido',
      icon: AlertCircle,
      color: 'red'
    },
    {
      title: 'Devolvidas',
      value: devolvidasCount,
      subtitle: 'Finalizadas, rejeitadas ou canceladas',
      icon: CheckCircle,
      color: 'green'
    }
  ]), [activeItems.length, inExecutionCount, overdueCount, devolvidasCount, queueView]);

  const cotacaoRecords = useMemo(() => readCotacaoDetails(cotacaoContext).cotacoes, [cotacaoContext]);
  const cotacaoUploads = useMemo(() => readCotacaoDetails(cotacaoContext).uploads, [cotacaoContext]);
  const cotacaoResumo = useMemo(() => {
    const totalCotado = cotacaoRecords.reduce((acc, row) => acc + Number(row?.subtotal || 0), 0);
    return {
      totalCotado,
      quantidadeCotacoes: cotacaoRecords.length,
      quantidadeUploads: cotacaoUploads.length
    };
  }, [cotacaoRecords, cotacaoUploads]);

  const cotacaoOptions = useMemo(() => {
    const term = cotacaoSearchTerm.trim().toLowerCase();
    const proposalDetails = readProposalDetails(cotacaoContext);
    const quoteOptions = cotacaoRecords.map((row) => {
      const partner = pickCotacaoPartner(row, proposalDetails);
      return {
        source: 'QUOTE',
        id: row?.id || row?.numeroOrcamento,
        numeroOrcamento: row?.numeroOrcamento || '',
        distribuidorId: partner.distribuidorId,
        distribuidor: partner.distribuidor,
        fornecedorId: partner.fornecedorId,
        fornecedor: partner.fornecedor,
        modalidade: row?.modalidade || '',
        itens: Array.isArray(row?.itens) ? row.itens : [],
        subtotal: Number(row?.subtotal) || 0,
        arquivoNome: row?.arquivoNome || '',
        observacoesCotacao: row?.observacoesCotacao || '',
        observacoesUpload: row?.observacoesUpload || '',
        createdAt: row?.createdAt || '',
        label: 'Cotação registrada'
      };
    });

    const requestOptions = budgetRequests.map((request) => {
      const { cotacoes } = readCotacaoDetails(request);
      const requestProposalDetails = readProposalDetails(request);
      const firstQuote = cotacoes[0] || null;
      const partner = pickCotacaoPartner(firstQuote || {}, requestProposalDetails);
      const requestItems = Array.isArray(request?.items)
        ? request.items.map((item) => ({
          id: item.id || nextQuoteItem().id,
          descricao: item.descricao || item.product?.name || '',
          quantidade: item.quantidade || 1,
          custoUnitario: item.custoUnitario ?? item.product?.price ?? ''
        })).filter((item) => item.descricao)
        : [];
      const quoteItems = Array.isArray(firstQuote?.itens) ? firstQuote.itens : [];
      const itens = quoteItems.length > 0 ? quoteItems : requestItems;
      const subtotal = Number(firstQuote?.subtotal)
        || itens.reduce((sum, item) => sum + ((Number(item?.quantidade) || 0) * (Number(item?.custoUnitario) || 0)), 0)
        || Number(request?.custoTotal)
        || Number(request?.valorSugerido)
        || 0;

      return {
        source: 'REQUEST',
        id: request?.id,
        numeroOrcamento: firstQuote?.numeroOrcamento || request?.numero || '',
        distribuidorId: partner.distribuidorId,
        distribuidor: partner.distribuidor,
        fornecedorId: partner.fornecedorId,
        fornecedor: partner.fornecedor,
        modalidade: firstQuote?.modalidade || inferModalidade(request),
        itens,
        subtotal,
        arquivoNome: firstQuote?.arquivoNome || '',
        observacoesCotacao: firstQuote?.observacoesCotacao || request?.descricao || '',
        observacoesUpload: firstQuote?.observacoesUpload || '',
        createdAt: firstQuote?.createdAt || request?.updatedAt || request?.createdAt || '',
        label: 'Orçamento da fila',
        requestTitle: request?.titulo || ''
      };
    });

    const seen = new Set();
    return [...quoteOptions, ...requestOptions]
      .filter((row) => {
        const key = `${row.source}:${row.id || row.numeroOrcamento}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((row) => {
        if (!term) return true;
        return [
          row?.numeroOrcamento,
          row?.distribuidor,
          row?.fornecedor,
          row?.requestTitle,
          ...(Array.isArray(row?.itens) ? row.itens.map((item) => item?.descricao) : [])
        ].filter(Boolean).join(' ').toLowerCase().includes(term);
      })
      .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
  }, [budgetRequests, cotacaoRecords, cotacaoSearchTerm]);

  const openExistingCotacao = (row) => {
    const itens = Array.isArray(row?.itens) && row.itens.length > 0
      ? row.itens.map((item) => ({
        id: item.id || nextQuoteItem().id,
        descricao: item.descricao || '',
        quantidade: item.quantidade || 1,
        custoUnitario: item.custoUnitario ?? ''
      }))
      : [nextQuoteItem()];

    setCotacaoForm((prev) => ({
      ...prev,
      modalidade: row?.modalidade || prev.modalidade,
      distribuidorId: row?.distribuidorId || '',
      distribuidor: row?.distribuidor || '',
      fornecedorId: row?.fornecedorId || '',
      fornecedor: row?.fornecedor || '',
      numeroOrcamento: row?.numeroOrcamento || prev.numeroOrcamento,
      itens,
      arquivo: null,
      arquivoNome: row?.arquivoNome || '',
      observacoesCotacao: row?.observacoesCotacao || '',
      observacoesUpload: row?.observacoesUpload || ''
    }));
    setCotacaoParaPrecificar(row);
    setCotacaoPickerOpen(false);
    setCotacaoFeedback(`${row?.label || 'Cotação'} ${row?.numeroOrcamento || ''} carregada para edição/precificação.`);
  };

  const startNewCotacao = () => {
    const nextNumber = resolveBudgetNumber(cotacaoContext, budgetRequests);
    setCotacaoForm((prev) => ({
      ...buildInitialCotacaoForm(cotacaoContext, budgetRequests),
      modalidade: prev.modalidade || inferModalidade(cotacaoContext),
      numeroOrcamento: nextNumber
    }));
    setCotacaoParaPrecificar(null);
    setCotacaoPickerOpen(false);
    setCotacaoFeedback(`Novo orçamento iniciado com o número ${nextNumber}.`);
  };

  const renderCardActions = (item) => {
    const stage = resolveStage(item.status, item.stage);

    if (isClosedStatus(item.status) || isDecisionStatus(item.status)) {
      return (
        <button
          type="button"
          onClick={() => {
            setSelectedSolicitacao(item);
            setShowViewModal(true);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-600/50 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/30"
        >
          <Eye className="h-3.5 w-3.5" /> Detalhes
        </button>
      );
    }

    if (stage === 'ENTRADA') {
      return (
        <button
          type="button"
          disabled={saving}
          onClick={() => handleAssumir(item)}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
        >
          <UserCheck className="h-3.5 w-3.5" /> Assumir
        </button>
      );
    }

    if (stage === 'COTACAO') {
      return (
        <button
          type="button"
          disabled={saving}
          onClick={() => handleAvancarEtapa(item)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/30 disabled:opacity-60"
        >
          <ArrowRight className="h-3.5 w-3.5" /> Custos OK
        </button>
      );
    }

    if (stage === 'PRECIFICACAO') {
      return (
        <button
          type="button"
          disabled={saving}
          onClick={() => handleAvancarEtapa(item)}
          className="inline-flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-500/20 px-3 py-2 text-xs text-purple-200 hover:bg-purple-500/30 disabled:opacity-60"
        >
          <ArrowRight className="h-3.5 w-3.5" /> Revisão
        </button>
      );
    }

    if (stage === 'REVISAO') {
      return (
        <>
          <button
            type="button"
            disabled={saving}
            onClick={() => openCotacaoModal(item)}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/20 px-3 py-2 text-xs text-sky-200 hover:bg-sky-500/30 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" /> Revisar/Devolver
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleDecisao(item, true)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
          >
            <CheckCircle className="h-3.5 w-3.5" /> Aprovar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleDecisao(item, false)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-xs text-red-200 hover:bg-red-500/30 disabled:opacity-60"
          >
            <AlertCircle className="h-3.5 w-3.5" /> Reprovar
          </button>
        </>
      );
    }

    if (stage === 'ENVIADA') {
      return (
        <>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleDecisao(item, true)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
          >
            <CheckCircle className="h-3.5 w-3.5" /> Aprovar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleDecisao(item, false)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-xs text-red-200 hover:bg-red-500/30 disabled:opacity-60"
          >
            <AlertCircle className="h-3.5 w-3.5" /> Reprovar
          </button>
        </>
      );
    }

    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => openResponderModal(item)}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
      >
        <Undo2 className="h-3.5 w-3.5" /> Devolver
      </button>
    );
  };

  const renderDemandCard = (item) => {
    const stage = resolveStage(item.status, item.stage);
    const due = normalizeDate(item.dueDate);

    return (
      <div
        key={item.id}
        draggable={!saving}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', item.id);
          setDraggedItemId(item.id);
        }}
        onDragEnd={() => {
          setDraggedItemId('');
          setDragOverStage('');
        }}
        className={`cursor-grab rounded-xl border border-slate-600/40 bg-[#102540] p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] active:cursor-grabbing ${
          draggedItemId === item.id ? 'opacity-50 ring-2 ring-sky-400/50' : ''
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{item.titulo}</p>
            <p className="truncate text-xs text-slate-400">{item.numero}</p>
          </div>
          <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getPriorityClass(item.prioridade)}`}>
            {toPriorityLabel(item.prioridade)}
          </span>
        </div>

        <p className="mb-3 line-clamp-2 text-xs text-slate-300">{item.descricao || 'Sem descrição'}</p>

        <div className="space-y-1 text-xs text-slate-400">
          <div className="truncate">
            Cliente: <span className="text-slate-200">{item.company?.name || '-'}</span>
          </div>
          <div className="truncate">
            Origem: <span className="text-slate-200">{getAreaLabel(item?.flow?.sourceArea)}</span>
          </div>
          <div>
            {due
              ? `Prazo: ${due.toLocaleDateString('pt-BR')}`
              : `Criada em ${item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '-'}`}
          </div>
          <div>
            Etapa: <span className="text-slate-200">{stageLabel(stage)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {renderCardActions(item)}

          {!isClosedStatus(item.status) && !isDecisionStatus(item.status) && (
            <button
              type="button"
              onClick={() => openCotacaoModal(item)}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/30"
            >
              <FolderOpen className="h-3.5 w-3.5" /> Abrir Cotação
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSelectedSolicitacao(item);
              setShowViewModal(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600/50 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/30"
          >
            <Eye className="h-3.5 w-3.5" /> Detalhes
          </button>

          {!isClosedStatus(item.status) && !isDecisionStatus(item.status) && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleCancelar(item)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/20 disabled:opacity-60"
              title="Cancelar / Rejeitar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Atividades Pré-vendas"
        subtitle="Gestão entre Comercial e Pré-vendas para solicitação, cotação, precificação e devolução da proposta."
        icon={ClipboardList}
        gradient="blue"
        breadcrumbs={['Home', 'Pré-Vendas', 'Solicitações']}
        actions={[
          {
            label: 'Módulo de Orçamentos',
            onClick: () => navigate('/pre-vendas'),
            icon: FolderOpen,
            variant: 'secondary'
          },
          {
            label: 'Atualizar',
            onClick: loadSolicitacoes,
            icon: RefreshCcw,
            variant: 'secondary'
          },
          {
            label: 'Nova Solicitação',
            onClick: () => navigate('/pre-vendas'),
            icon: Plus,
            variant: 'primary'
          }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <AnimatedStats key={stat.title} {...stat} />
        ))}
      </div>

      <div className="crm-card rounded-xl p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQueueView('PRE_VENDAS')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                queueView === 'PRE_VENDAS'
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-600/50 bg-slate-900/40 text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Fila Pré-vendas
            </button>
            <button
              type="button"
              onClick={() => setQueueView('COMERCIAL')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                queueView === 'COMERCIAL'
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-600/50 bg-slate-900/40 text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Fila Comercial
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="h-4 w-4 rounded border-slate-500 bg-slate-900"
              />
              Somente minhas demandas
            </label>

            <div className="inline-flex rounded-lg border border-slate-600/50 bg-slate-900/40 p-1">
              <button
                type="button"
                onClick={() => setViewMode('KANBAN')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
                  viewMode === 'KANBAN'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutGrid className="h-4 w-4" /> Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${
                  viewMode === 'LIST'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <List className="h-4 w-4" /> Lista
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="crm-card rounded-xl p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título, cliente ou oportunidade"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="crm-card rounded-xl py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">Carregando fluxo...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="crm-card rounded-xl py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">Nenhuma demanda encontrada para os filtros atuais.</p>
        </div>
      ) : viewMode === 'KANBAN' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 2xl:grid-cols-7">
          {KANBAN_COLUMNS.map((column) => {
            const meta = STAGE_META[column];
            const rows = kanbanByStage[column] || [];

            return (
              <div
                key={column}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOverStage !== column) setDragOverStage(column);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setDragOverStage('');
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleStageDrop(column);
                }}
                className={`crm-card rounded-xl p-4 transition ${
                  dragOverStage === column ? 'border-sky-400/70 bg-sky-500/10 ring-2 ring-sky-400/30' : ''
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{meta.title}</h3>
                    <p className="text-sm text-slate-400">{meta.subtitle}</p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">
                    {rows.length}
                  </span>
                </div>

                {rows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-600/40 px-3 py-8 text-center text-sm text-slate-500">
                    Sem demandas nessa etapa.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rows.map((item) => renderDemandCard(item))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="crm-card rounded-xl p-4 space-y-3">
          {filteredItems.map((item) => {
            const stage = resolveStage(item.status, item.stage);
            const meta = STAGE_META[stage] || STAGE_META.ENTRADA;

            return (
              <div key={item.id} className="rounded-xl border border-slate-600/40 bg-[#102540] p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-sky-400">{item.numero}</span>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${meta.badge}`}>
                        {meta.title}
                      </span>
                      <span className="rounded-full border border-slate-500/40 px-2 py-1 text-[11px] text-slate-300">
                        {getStatusLabel(item.status)}
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${getPriorityClass(item.prioridade)}`}>
                        {toPriorityLabel(item.prioridade)}
                      </span>
                    </div>
                    <h4 className="truncate text-base font-semibold text-white">{item.titulo}</h4>
                    <p className="line-clamp-2 text-sm text-slate-300">{item.descricao}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Cliente: {item.company?.name || '-'} • Origem: {getAreaLabel(item?.flow?.sourceArea)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderCardActions(item)}
                    {!isClosedStatus(item.status) && !isDecisionStatus(item.status) && (
                      <button
                        type="button"
                        onClick={() => openCotacaoModal(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/30"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Abrir Cotação
                      </button>
                    )}
                    {!isClosedStatus(item.status) && !isDecisionStatus(item.status) && (
                      <button
                        type="button"
                        onClick={() => openResponderModal(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/30"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Responder
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSolicitacao(item);
                        setShowViewModal(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-600/50 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/30"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showCotacaoModal}
        onClose={() => setShowCotacaoModal(false)}
        title={cotacaoContext?.titulo || 'Registrar cotação'}
        size="full"
      >
        {cotacaoContext && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowCotacaoModal(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800/50"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar para fila
              </button>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">
                  {getStatusLabel(cotacaoContext.status)}
                </span>
                <span className={`rounded-full border px-3 py-1 text-sm ${getPriorityClass(cotacaoContext.prioridade)}`}>
                  {toPriorityLabel(cotacaoContext.prioridade)}
                </span>
                <button
                  type="button"
                  onClick={loadSolicitacoes}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800/50"
                >
                  <RefreshCcw className="h-4 w-4" /> Atualizar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6 xl:col-span-2">
                <h3 className="text-3xl font-semibold text-white">Resumo da solicitação</h3>
                <p className="mt-1 text-base text-slate-300">{cotacaoContext.descricao || 'Sem descrição detalhada.'}</p>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                  <div>
                    <p className="text-slate-400">Oportunidade</p>
                    <p className="text-white">{cotacaoContext.opportunity?.title || cotacaoContext.opportunity?.id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Cliente</p>
                    <p className="text-white">{cotacaoContext.company?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Solicitante</p>
                    <p className="text-white">{cotacaoContext.solicitante?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Responsável Pré-vendas</p>
                    <p className="text-white">{getCurrentUserName()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Prazo</p>
                    <p className="text-white">
                      {cotacaoContext.dueDate ? new Date(cotacaoContext.dueDate).toLocaleDateString('pt-BR') : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Criada em</p>
                    <p className="text-white">
                      {cotacaoContext.createdAt ? new Date(cotacaoContext.createdAt).toLocaleString('pt-BR') : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                <h3 className="text-3xl font-semibold text-white">Ações rápidas</h3>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => saveCotacao({ sendToPricing: true })}
                    disabled={cotacaoSaving}
                    className="w-full rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-4 py-2.5 text-left text-base text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-60"
                  >
                    <ArrowRight className="mr-2 inline h-4 w-4" />
                    Precificar
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await handleCancelar(cotacaoContext);
                      setShowCotacaoModal(false);
                    }}
                    disabled={saving || cotacaoSaving}
                    className="w-full rounded-lg bg-red-500 px-4 py-2.5 text-left text-base font-medium text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    <Trash2 className="mr-2 inline h-4 w-4" />
                    Excluir atividade
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCotacaoModal(false)}
                    className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-4 py-2.5 text-left text-base text-slate-100 hover:bg-slate-800/50"
                  >
                    Voltar à fila
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCotacaoTab('PRECIFICACAO');
                      setCotacaoFeedback('');
                    }}
                    className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-left text-base text-sky-100 hover:bg-sky-500/20"
                  >
                    Abrir Precificação
                  </button>
                </div>

                <div className="mt-6 rounded-lg border border-slate-600/40 bg-slate-900/30 p-4 text-sm text-slate-300">
                  <p>Total cotado: <strong className="text-white">R$ {cotacaoResumo.totalCotado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                  <p className="mt-1">Cotações: <strong className="text-white">{cotacaoResumo.quantidadeCotacoes}</strong></p>
                  <p className="mt-1">Uploads: <strong className="text-white">{cotacaoResumo.quantidadeUploads}</strong></p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-3">
              <div className="flex flex-wrap gap-2">
                {COTACAO_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCotacaoTab(tab)}
                    className={`rounded-lg px-4 py-2 text-sm ${
                      cotacaoTab === tab
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-300 hover:bg-slate-900/40'
                    }`}
                  >
                    {tab === 'COTACOES' ? 'Cotações' : tab === 'ITENS' ? 'Itens' : tab === 'HISTORICO' ? 'Histórico' : tab === 'PRECIFICACAO' ? 'Precificação' : tab === 'PROPOSTAS' ? 'Propostas' : 'Ações'}
                  </button>
                ))}
              </div>
            </div>

            {cotacaoTab === 'COTACOES' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                  <h4 className="text-2xl font-semibold text-white">Registrar cotação</h4>
                  <p className="mt-1 text-slate-300">
                    Informe os dados da cotação, faça upload do arquivo e prepare para envio à precificação.
                  </p>

	                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
	                    <div>
	                      <label className="mb-1 block text-sm text-slate-300">Modalidade</label>
                      <select
                        value={cotacaoForm.modalidade}
                        onChange={(e) => setCotacaoForm((prev) => ({ ...prev, modalidade: e.target.value }))}
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white"
                      >
                        <option value="VENDA">Venda</option>
                        <option value="LOCACAO">Locação</option>
                        <option value="SERVICOS">Serviços</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Distribuidor</label>
                      <input
                        type="text"
                        value={cotacaoForm.distribuidor}
                        onChange={(e) => setCotacaoForm((prev) => ({ ...prev, distribuidor: e.target.value }))}
                        placeholder="Nome do distribuidor"
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Fornecedor</label>
                      <input
                        type="text"
                        value={cotacaoForm.fornecedor}
                        onChange={(e) => setCotacaoForm((prev) => ({ ...prev, fornecedor: e.target.value }))}
                        placeholder="Nome do fornecedor"
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Nº Orçamento</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cotacaoForm.numeroOrcamento}
                          onFocus={() => setCotacaoPickerOpen(true)}
                          onClick={() => setCotacaoPickerOpen(true)}
                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, numeroOrcamento: e.target.value }))}
                          placeholder="Clique para buscar ou orçar novo"
                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
                        />
                        {cotacaoPickerOpen && (
                          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-xl border border-slate-600/60 bg-[#111d31] p-3 shadow-2xl">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => setCotacaoSearchTerm('')}
                                className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
                              >
                                Abrir cotação existente
                              </button>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={startNewCotacao}
                                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
                              >
                                Orçar novo
                              </button>
                            </div>
                            <input
                              type="text"
                              value={cotacaoSearchTerm}
                              onChange={(e) => setCotacaoSearchTerm(e.target.value)}
                              placeholder="Buscar por número, distribuidor ou item"
                              className="mt-3 w-full rounded-lg border border-slate-600/50 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                            />
                            <div className="mt-2 max-h-52 overflow-y-auto">
                              {cotacaoOptions.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-700/70 px-3 py-4 text-center text-xs text-slate-400">
                                  Nenhuma cotação ou orçamento encontrado.
                                </div>
                              ) : (
                                cotacaoOptions.map((row) => {
                                  const itemCount = Array.isArray(row?.itens) ? row.itens.length : 0;
                                  return (
                                    <button
                                      key={row.id || row.numeroOrcamento}
                                      type="button"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => openExistingCotacao(row)}
                                      className="mb-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-left hover:border-sky-500/50 hover:bg-sky-500/10"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate font-mono text-xs font-semibold text-sky-300">{row.numeroOrcamento || '-'}</div>
                                          <div className="truncate text-xs text-slate-300">
                                            {row.distribuidor || row.fornecedor || row.requestTitle || 'Distribuidor/fornecedor não informado'}
                                          </div>
                                          {row.distribuidor && row.fornecedor && (
                                            <div className="truncate text-[11px] text-slate-400">{row.fornecedor}</div>
                                          )}
                                          <div className="truncate text-[11px] font-semibold text-slate-500">{row.label}</div>
                                        </div>
                                        <div className="shrink-0 text-right text-xs text-slate-400">
                                          <div>{itemCount} item(ns)</div>
                                          <div>{toCurrency(row.subtotal)}</div>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => setCotacaoPickerOpen(false)}
                              className="mt-1 w-full rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800/60 hover:text-white"
                            >
                              Fechar
                            </button>
                          </div>
                        )}
                      </div>
	                    </div>
	                  </div>

	                  <div className="mt-5 rounded-xl border border-slate-700/60 bg-slate-950/25 p-4">
	                    <h5 className="text-base font-semibold text-white">Dados da proposta</h5>
	                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">Cliente / Órgão</label>
	                        <input
	                          type="text"
	                          value={cotacaoForm.clienteOrgao}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, clienteOrgao: e.target.value }))}
	                          placeholder="Nome do cliente ou órgão"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">CNPJ / Documento</label>
	                        <input
	                          type="text"
	                          value={cotacaoForm.cnpjDocumento}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, cnpjDocumento: e.target.value }))}
	                          placeholder="00.000.000/0000-00"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">Contato do Cliente</label>
	                        <input
	                          type="text"
	                          value={cotacaoForm.contatoCliente}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, contatoCliente: e.target.value }))}
	                          placeholder="Nome do contato"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">Email do Cliente</label>
	                        <input
	                          type="email"
	                          value={cotacaoForm.emailCliente}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, emailCliente: e.target.value }))}
	                          placeholder="email@cliente.com.br"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">Telefone do Cliente</label>
	                        <input
	                          type="text"
	                          value={cotacaoForm.telefoneCliente}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, telefoneCliente: e.target.value }))}
	                          placeholder="(00) 00000-0000"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">Gerente de Conta</label>
	                        <input
	                          type="text"
	                          value={cotacaoForm.gerenteConta}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, gerenteConta: e.target.value }))}
	                          placeholder="Nome do gerente"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">Email do Gerente</label>
	                        <input
	                          type="email"
	                          value={cotacaoForm.emailGerente}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, emailGerente: e.target.value }))}
	                          placeholder="gerente@empresa.com.br"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div>
	                        <label className="mb-1 block text-sm text-slate-300">Telefone do Gerente</label>
	                        <input
	                          type="text"
	                          value={cotacaoForm.telefoneGerente}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, telefoneGerente: e.target.value }))}
	                          placeholder="(00) 00000-0000"
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                      <div className="md:col-span-2">
	                        <label className="mb-1 block text-sm text-slate-300">Premissas da Proposta</label>
	                        <textarea
	                          rows={3}
	                          value={cotacaoForm.premissasProposta}
	                          onChange={(e) => setCotacaoForm((prev) => ({ ...prev, premissasProposta: e.target.value }))}
	                          placeholder="Escopo, validade, SLA, condições comerciais, exclusões e demais premissas."
	                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
	                        />
	                      </div>
	                    </div>
	                  </div>

	                  <div className="mt-5">
	                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm text-slate-300">Itens da cotação</label>
                      <button
                        type="button"
                        onClick={addCotacaoItem}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800/50"
                      >
                        <Plus className="h-4 w-4" /> Adicionar item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {cotacaoForm.itens.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-slate-600/40 p-3">
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
                            <div className="lg:col-span-3">
                              <label className="mb-1 block text-xs text-slate-400">Item / Descrição</label>
                              <input
                                type="text"
                                value={entry.descricao}
                                onChange={(e) => updateCotacaoItem(entry.id, 'descricao', e.target.value)}
                                placeholder="Descrição do item"
                                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-400">Qtde</label>
                              <input
                                type="number"
                                min="1"
                                value={entry.quantidade}
                                onChange={(e) => updateCotacaoItem(entry.id, 'quantidade', e.target.value)}
                                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-400">Custo Unit. R$</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={entry.custoUnitario}
                                onChange={(e) => updateCotacaoItem(entry.id, 'custoUnitario', e.target.value)}
                                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white"
                              />
                            </div>
                            <div className="flex items-end justify-end">
                              <button
                                type="button"
                                onClick={() => removeCotacaoItem(entry.id)}
                                className="inline-flex h-10 items-center gap-1 rounded-lg border border-red-500/40 px-3 text-sm text-red-300 hover:bg-red-500/20"
                              >
                                <Trash2 className="h-4 w-4" /> Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Arquivo da cotação</label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setCotacaoForm((prev) => ({
                            ...prev,
                            arquivo: file,
                            arquivoNome: file?.name || ''
                          }));
                        }}
                        className="block w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-300">Observações do upload</label>
                      <input
                        type="text"
                        value={cotacaoForm.observacoesUpload}
                        onChange={(e) => setCotacaoForm((prev) => ({ ...prev, observacoesUpload: e.target.value }))}
                        placeholder="Ex: orçamento recebido por e-mail do distribuidor"
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-slate-300">Observações da cotação</label>
                    <textarea
                      rows={3}
                      value={cotacaoForm.observacoesCotacao}
                      onChange={(e) => setCotacaoForm((prev) => ({ ...prev, observacoesCotacao: e.target.value }))}
                      placeholder="Condições comerciais da cotação"
                      className="w-full rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-white placeholder-slate-400"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={cotacaoSaving}
                      onClick={() => saveCotacao({ sendToPricing: false })}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" /> Salvar cotação
                    </button>
                    <button
                      type="button"
                      disabled={cotacaoSaving}
                      onClick={() => saveCotacao({ sendToPricing: true })}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800/50 disabled:opacity-60"
                    >
                      <ArrowRight className="h-4 w-4" /> Precificar
                    </button>
                  </div>

                  {cotacaoFeedback && (
                    <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                      {cotacaoFeedback}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                  <h4 className="text-2xl font-semibold text-white">Cotações registradas</h4>
                  <p className="mt-1 text-slate-300">Custos recebidos para a precificação.</p>

                  {cotacaoRecords.length === 0 ? (
                    <p className="mt-4 text-slate-400">Nenhuma cotação registrada.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {cotacaoRecords.map((row) => {
                        const modalidade = String(row.modalidade || 'VENDA').toUpperCase();
                        const isLocacao = modalidade === 'LOCACAO' || modalidade === 'LOCAÇÃO';
                        const isServicos = modalidade === 'SERVICOS' || modalidade === 'SERVIÇOS';
                        const tipoLabel = isLocacao ? 'Locação' : isServicos ? 'Serviços' : 'Venda';
                        const tipoColor = isLocacao
                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-200'
                          : isServicos
                            ? 'border-purple-500/40 bg-purple-500/10 text-purple-200'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';

                        return (
                          <div key={row.id} className="rounded-xl border border-slate-600/40 bg-slate-900/40 p-4">
                            {/* Header */}
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-white font-semibold">{row.numeroOrcamento}</p>
                                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tipoColor}`}>
                                    {tipoLabel}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-400 mt-0.5">
                                  {row.distribuidor || row.fornecedor || 'Distribuidor/fornecedor não informado'} •{' '}
                                  {row.fornecedor && row.distribuidor ? `${row.fornecedor} • ` : ''}
                                  {row.createdAt ? new Date(row.createdAt).toLocaleString('pt-BR') : '-'}
                                </p>
                              </div>
                              <p className="text-lg font-bold text-emerald-400">
                                R$ {Number(row.subtotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>

                            {/* Itens */}
                            {Array.isArray(row.itens) && row.itens.length > 0 && (
                              <div className="mb-3 space-y-1">
                                {row.itens.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                                    <span className="truncate flex-1 mr-2">{item.descricao || `Item ${idx + 1}`}</span>
                                    <span className="shrink-0">
                                      {item.quantidade}x R$ {Number(item.custoUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Botão Abrir e Precificar */}
                            <button
                              type="button"
                              onClick={() => {
                                // Salvar dados da cotação no localStorage para a calculadora
                                const cotacaoKey = `cotacao_precificar_${Date.now()}`;
                                localStorage.setItem(cotacaoKey, JSON.stringify(
                                  buildCotacaoPricingPayload(cotacaoContext, row, cotacaoRecords)
                                ));

                                // Montar URL com tipo e chave
                                const tipoMap = {
                                  LOCACAO: 'LOCACAO', LOCAÇÃO: 'LOCACAO',
                                  SERVICOS: 'SERVICOS', SERVIÇOS: 'SERVICOS'
                                };
                                const tipo = tipoMap[modalidade] || 'VENDA';
                                const url = `/calculadoras?tipo=${tipo}&cotacaoKey=${cotacaoKey}`;

                                // Fechar modal e navegar
                                setShowCotacaoModal(false);
                                window.location.href = url;
                              }}
                              className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
                            >
                              <ArrowRight className="h-4 w-4" /> Abrir e Precificar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                  <h4 className="text-2xl font-semibold text-white">Uploads da cotação</h4>
                  {cotacaoUploads.length === 0 ? (
                    <p className="mt-2 text-slate-400">Nenhum orçamento enviado ainda.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {cotacaoUploads.map((row) => (
                        <div key={row.id} className="rounded-lg border border-slate-600/40 p-3">
                          <p className="text-white">{row.fileName || 'Arquivo sem nome'}</p>
                          <p className="text-sm text-slate-300">{row.observacoes || '-'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {cotacaoTab === 'ITENS' && (
              <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                <h4 className="text-2xl font-semibold text-white">Itens da solicitação</h4>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p>Tipos de precificação: {(cotacaoContext.tiposPrecificacao || []).join(', ') || '-'}</p>
                  <p>Cliente: {cotacaoContext.company?.name || '-'}</p>
                  <p>Oportunidade: {cotacaoContext.opportunity?.title || '-'}</p>
                </div>
              </div>
            )}

            {cotacaoTab === 'HISTORICO' && (
              <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                <h4 className="text-2xl font-semibold text-white">Histórico</h4>
                <div className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-600/40 bg-slate-900/30 p-4 text-sm text-slate-200">
                  {stripStageMarkers(cotacaoContext.observacoes) || 'Sem histórico registrado.'}
                </div>
              </div>
            )}

            {cotacaoTab === 'PRECIFICACAO' && (() => {
              // Usar cotação selecionada ou a última registrada
              const cotacaoBase = cotacaoParaPrecificar || cotacaoRecords[0];
              const modalidade = String(cotacaoBase?.modalidade || cotacaoForm.modalidade || 'VENDA').toUpperCase();
              const isLocacao = modalidade === 'LOCACAO' || modalidade === 'LOCAÇÃO';
              const isServicos = modalidade === 'SERVICOS' || modalidade === 'SERVIÇOS';
              const tipoCalc = isLocacao ? 'Locação' : isServicos ? 'Serviços' : 'Venda';
              const custoBase = cotacaoBase?.subtotal || 0;

              return (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-5">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h4 className="text-xl font-semibold text-white">Precificação — {tipoCalc}</h4>
                        <p className="mt-1 text-sm text-slate-400">
                          Modalidade: <strong className="text-white">{tipoCalc}</strong> •
                          {cotacaoBase && <> Cotação: <strong className="text-white">{cotacaoBase.numeroOrcamento}</strong> •</>}
                          Custo base: <strong className="text-emerald-400">R$ {custoBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-indigo-500/40 bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200">
                          {tipoCalc}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setCotacaoParaPrecificar(null); setCotacaoTab('COTACOES'); }}
                          className="text-xs text-slate-400 hover:text-white underline"
                        >
                          ← Voltar às cotações
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Itens da cotação selecionada */}
                  {cotacaoBase && Array.isArray(cotacaoBase.itens) && cotacaoBase.itens.length > 0 && (
                    <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-5">
                      <h5 className="text-sm font-semibold text-slate-300 mb-3">Itens da cotação</h5>
                      <div className="space-y-2">
                        {cotacaoBase.itens.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-white">{item.descricao || `Item ${idx + 1}`}</span>
                            <span className="text-slate-300">
                              {item.quantidade}x R$ {Number(item.custoUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              {' = '}
                              <strong className="text-emerald-400">
                                R$ {(item.quantidade * item.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-slate-600/40 pt-2 flex justify-between font-semibold">
                          <span className="text-slate-300">Subtotal</span>
                          <span className="text-emerald-400">R$ {custoBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Formulário de precificação */}
                  <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                    <h5 className="text-base font-semibold text-white mb-4">Calcular preço de {tipoCalc}</h5>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="block text-sm text-slate-300 mb-1.5">Custo Total (R$)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          value={respostaData.custoTotal || (custoBase > 0 ? custoBase.toFixed(2) : '')}
                          onChange={(e) => setRespostaData(p => ({ ...p, custoTotal: e.target.value }))}
                          placeholder={custoBase > 0 ? custoBase.toFixed(2) : '0,00'}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-300 mb-1.5">Margem de Lucro (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          value={respostaData.margemLucro}
                          onChange={(e) => {
                            const margem = parseFloat(e.target.value) || 0;
                            const custo = parseFloat(respostaData.custoTotal) || custoBase;
                            const valorSugerido = custo > 0 && margem > 0
                              ? (custo / (1 - margem / 100)).toFixed(2)
                              : respostaData.valorSugerido;
                            setRespostaData(p => ({ ...p, margemLucro: e.target.value, valorSugerido }));
                          }}
                          placeholder="Ex: 30"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-300 mb-1.5">
                          {isLocacao ? 'Valor Mensal (R$)' : 'Valor Sugerido (R$)'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200 font-semibold focus:outline-none focus:border-emerald-400"
                          value={respostaData.valorSugerido}
                          onChange={(e) => {
                            const valor = parseFloat(e.target.value) || 0;
                            const custo = parseFloat(respostaData.custoTotal) || custoBase;
                            const margem = custo > 0 && valor > 0
                              ? ((1 - custo / valor) * 100).toFixed(1)
                              : respostaData.margemLucro;
                            setRespostaData(p => ({ ...p, valorSugerido: e.target.value, margemLucro: margem }));
                          }}
                          placeholder="Calculado automaticamente"
                        />
                      </div>

                      {isLocacao && (
                        <>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1.5">Prazo (meses)</label>
                            <input
                              type="number"
                              min={1}
                              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                              value={respostaData.prazoMeses || 12}
                              onChange={(e) => setRespostaData(p => ({ ...p, prazoMeses: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-slate-300 mb-1.5">Valor Total Contrato (R$)</label>
                            <input
                              type="number"
                              readOnly
                              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/30 px-3 py-2.5 text-sm text-slate-300 cursor-not-allowed"
                              value={((parseFloat(respostaData.valorSugerido) || 0) * (parseInt(respostaData.prazoMeses) || 12)).toFixed(2)}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Resumo */}
                    {(respostaData.valorSugerido || respostaData.custoTotal) && (
                      <div className="mt-4 rounded-lg border border-slate-600/30 bg-slate-900/40 p-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Resumo da precificação</p>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-slate-200">R$ {(parseFloat(respostaData.custoTotal) || custoBase).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-slate-400">Custo Total</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-400">R$ {(parseFloat(respostaData.valorSugerido) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-slate-400">{isLocacao ? 'Valor Mensal' : 'Preço Sugerido'}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-blue-300">{parseFloat(respostaData.margemLucro) || 0}%</p>
                            <p className="text-xs text-slate-400">Margem</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!cotacaoBase) {
                            window.open('/calculadoras', '_blank');
                            return;
                          }
                          const tipoCalc = isLocacao ? 'LOCACAO' : isServicos ? 'SERVICO' : 'VENDA';
                          const cotacaoKey = `cotacao_precificar_${Date.now()}`;
                          localStorage.setItem(cotacaoKey, JSON.stringify(
                            buildCotacaoPricingPayload(cotacaoContext, cotacaoBase, cotacaoRecords)
                          ));
                          window.open(`/calculadoras?tipo=${tipoCalc}&cotacaoKey=${encodeURIComponent(cotacaoKey)}`, '_blank');
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800/50 transition-colors"
                      >
                        <ArrowRight className="h-4 w-4" /> Abrir Calculadora Completa
                      </button>
                    </div>
                  </div>

                  {/* Propostas salvas da calculadora */}
                  {(() => {
                    let propostas = [];
                    try {
                      const stored = localStorage.getItem('crm-calculadoras-proposals-v1') || localStorage.getItem('crm-calculadoras-proposals');
                      if (stored) propostas = JSON.parse(stored);
                    } catch {}
                    if (!Array.isArray(propostas) || propostas.length === 0) return null;
                    return (
                      <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-5">
                        <h5 className="text-base font-semibold text-white mb-3">Propostas salvas na calculadora</h5>
                        <p className="text-xs text-slate-400 mb-3">Selecione a proposta para anexar ao responder a solicitação.</p>
                        <div className="space-y-2">
                          {propostas.slice(0, 5).map((p) => (
                            <label key={p.id || p.number} className="flex items-center gap-3 cursor-pointer rounded-lg border border-slate-600/40 p-3 hover:border-indigo-500/40 transition-colors">
                              <input
                                type="radio"
                                name="propostaSelecionada"
                                value={p.id || p.number}
                                checked={respostaData.propostaSelecionada === (p.id || p.number)}
                                onChange={() => setRespostaData(prev => ({
                                  ...prev,
                                  propostaSelecionada: p.id || p.number,
                                  propostaNome: p.number || p.id,
                                  valorSugerido: String(p.snapshot?.calculationResults?.finalPrice || p.totalValue || prev.valorSugerido || ''),
                                  custoTotal: String(p.snapshot?.calculationResults?.totalCost || prev.custoTotal || '')
                                }))}
                                className="accent-indigo-500"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white">{p.number || p.id}</p>
                                <p className="text-xs text-slate-400">
                                  {p.clientCompany || 'Sem cliente'} •{' '}
                                  {p.snapshot?.calculationResults?.finalPrice
                                    ? `R$ ${Number(p.snapshot.calculationResults.finalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : '-'}
                                </p>
                              </div>
                              {respostaData.propostaSelecionada === (p.id || p.number) && (
                                <span className="text-xs text-indigo-300 font-semibold">✓ Selecionada</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Botão Responder Solicitação */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                    <h5 className="text-base font-semibold text-white mb-1">Precificação concluída?</h5>
                    <p className="text-sm text-slate-400 mb-4">Após definir o valor, envie para revisão antes da devolução ao Comercial.</p>
                    <button
                      type="button"
                      disabled={!respostaData.valorSugerido || saving}
                      onClick={() => {
                        setShowCotacaoModal(false);
                        setSelectedSolicitacao(cotacaoContext);
                        setRespostaData(p => ({
                          ...p,
                          nextStatus: 'AGUARDANDO_APROVACAO',
                          nextStage: 'REVISAO'
                        }));
                        setShowRespostaModal(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                      <Send className="h-4 w-4" /> Enviar para Revisão
                    </button>
                  </div>
                </div>
              );
            })()}

            {cotacaoTab === 'PROPOSTAS' && (() => {
              const details = cotacaoContext?.calculoDetalhes && typeof cotacaoContext.calculoDetalhes === 'object'
                ? cotacaoContext.calculoDetalhes
                : {};
              const propostas = Array.isArray(details.propostasPrecificadas)
                ? details.propostasPrecificadas
                : details.propostaPrecificada ? [details.propostaPrecificada] : [];

              return (
                <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-2xl font-semibold text-white">Propostas em Revisão</h4>
                      <p className="mt-2 text-sm text-slate-300">Precificações prontas para abrir o PDF e devolver ao Comercial.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPreSalesBudgetPdf(cotacaoContext)}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
                    >
                      <FileText className="h-4 w-4" /> PDF do Orçamento
                    </button>
                  </div>

                  {propostas.length === 0 ? (
                    <div className="mt-5 rounded-lg border border-dashed border-slate-600/50 p-6 text-center text-sm text-slate-400">
                      Nenhuma proposta precificada enviada para revisão.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {propostas.map((proposta) => (
                        <div key={proposta.id || proposta.number} className="rounded-xl border border-slate-600/40 bg-slate-950/35 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-lg font-bold text-cyan-200">{proposta.number || 'Proposta sem número'}</p>
                              <p className="mt-1 text-sm text-slate-300">{proposta.client?.companyName || cotacaoContext?.nomeCliente || '-'}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {proposta.calculatorLabel || proposta.calculatorType || 'Precificação'} • enviada para revisão
                              </p>
                            </div>
                            <div className="grid min-w-[260px] grid-cols-2 gap-3 text-right">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">Preço final</p>
                                <p className="text-base font-bold text-white">{toCurrency(proposta.result?.finalPrice)}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">Mensal</p>
                                <p className="text-base font-bold text-white">{toCurrency(proposta.result?.monthlyPrice)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openPreSalesBudgetPdf(cotacaoContext)}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
                            >
                              <FileText className="h-3.5 w-3.5" /> Abrir PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDevolucaoComercial((prev) => ({
                                  ...prev,
                                  numeroProposta: proposta.number || prev.numeroProposta,
                                  observacoes: prev.observacoes || `Proposta ${proposta.number || ''} revisada e pronta para envio ao Comercial.`
                                }));
                                setCotacaoTab('ACOES');
                              }}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600/80 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                            >
                              <Send className="h-3.5 w-3.5" /> Devolver
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {cotacaoTab === 'ACOES' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                  <h4 className="text-xl font-semibold text-white mb-1">Transição de status</h4>
                  <p className="text-sm text-slate-400 mb-5">Altere manualmente o status quando necessário.</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-1.5">Novo status</label>
                      <select
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        value={statusTransition.nextStatus}
                        onChange={(e) => setStatusTransition((prev) => ({ ...prev, nextStatus: e.target.value }))}
                      >
                        <option value="">Selecione um status</option>
                        <option value="NOVA">Nova</option>
                        <option value="EM_PRECIFICACAO">Em Precificação</option>
                        <option value="AGUARDANDO_APROVACAO">Aguardando Aprovação</option>
                        <option value="FINALIZADA">Finalizada</option>
                        <option value="REJEITADA">Rejeitada</option>
                        <option value="CANCELADA">Cancelada</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-300 mb-1.5">Motivo</label>
                      <textarea
                        rows={4}
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                        placeholder="Descreva o motivo da transição..."
                        value={statusTransition.motivo}
                        onChange={(e) => setStatusTransition((prev) => ({ ...prev, motivo: e.target.value }))}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!statusTransition.nextStatus || cotacaoSaving}
                      onClick={applyStatusTransition}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-500/40 bg-slate-700/50 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-600/60 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" /> Aplicar status
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-600/40 bg-[#102540] p-6">
                  <h4 className="text-xl font-semibold text-white mb-1">Devolver ao Comercial</h4>
                  <p className="text-sm text-slate-400 mb-5">Disponível somente após concluir a precificação e enviar para revisão.</p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-300 mb-1.5">Número da proposta</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="Ex: PROP-001"
                          value={devolucaoComercial.numeroProposta}
                          onChange={(e) => setDevolucaoComercial((prev) => ({ ...prev, numeroProposta: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-300 mb-1.5">Versão</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="1"
                          value={devolucaoComercial.versao}
                          onChange={(e) => setDevolucaoComercial((prev) => ({ ...prev, versao: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-300 mb-1.5">Validade</label>
                        <input
                          type="date"
                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          value={devolucaoComercial.validade}
                          onChange={(e) => setDevolucaoComercial((prev) => ({ ...prev, validade: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-300 mb-1.5">Cenário associado</label>
                        <select
                          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          value={devolucaoComercial.cenario}
                          onChange={(e) => setDevolucaoComercial((prev) => ({ ...prev, cenario: e.target.value }))}
                        >
                          <option value="PADRAO">Selecionar cenário</option>
                          <option value="BASE">Base</option>
                          <option value="OTIMISTA">Otimista</option>
                          <option value="CONSERVADOR">Conservador</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-300 mb-1.5">Observações</label>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                        placeholder="Informações adicionais para o comercial..."
                        value={devolucaoComercial.observacoes}
                        onChange={(e) => setDevolucaoComercial((prev) => ({ ...prev, observacoes: e.target.value }))}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={cotacaoSaving}
                      onClick={devolverAoComercial}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600/80 border border-blue-500/40 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      <Send className="h-4 w-4" /> Devolver ao Comercial
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedSolicitacao?.titulo || 'Detalhes da Solicitação'}
        subtitle={selectedSolicitacao ? `${selectedSolicitacao.numero} • ${getStatusLabel(selectedSolicitacao.status)}` : ''}
      >
        {selectedSolicitacao && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 mb-1">Solicitante</p>
                <p className="text-white">{selectedSolicitacao.solicitante?.name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Cliente</p>
                <p className="text-white">{selectedSolicitacao.company?.name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Origem</p>
                <p className="text-white">{getAreaLabel(selectedSolicitacao?.flow?.sourceArea)}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Etapa</p>
                <p className="text-white">{stageLabel(resolveStage(selectedSolicitacao.status, selectedSolicitacao.stage))}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Status</p>
                <p className="text-white">{getStatusLabel(selectedSolicitacao.status)}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Data</p>
                <p className="text-white">{selectedSolicitacao.createdAt ? new Date(selectedSolicitacao.createdAt).toLocaleString('pt-BR') : '-'}</p>
              </div>
            </div>

            <div>
              <p className="text-gray-400 mb-1 text-sm">Descrição</p>
              <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4 text-sm text-slate-200 whitespace-pre-wrap">
                {selectedSolicitacao.descricao || 'Sem descrição'}
              </div>
            </div>

            {selectedSolicitacao.observacoes ? (
              <div>
                <p className="text-gray-400 mb-1 text-sm">Observações</p>
                <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4 text-sm text-slate-200 whitespace-pre-wrap">
                  {stripStageMarkers(selectedSolicitacao.observacoes)}
                </div>
              </div>
            ) : null}

            {(selectedSolicitacao.valorSugerido > 0 || selectedSolicitacao.custoTotal > 0 || selectedSolicitacao.margemLucro > 0) && (
              <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
                <p className="text-sm text-gray-400 mb-3">Precificação</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-300">
                      R$ {Number(selectedSolicitacao.valorSugerido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">Preço Sugerido</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-200">
                      R$ {Number(selectedSolicitacao.custoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400">Custo Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-300">{Number(selectedSolicitacao.margemLucro || 0).toFixed(1)}%</p>
                    <p className="text-xs text-gray-400">Margem</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showRespostaModal}
        onClose={() => setShowRespostaModal(false)}
        title="Responder Solicitação"
        subtitle={selectedSolicitacao ? `${selectedSolicitacao.numero} • ${selectedSolicitacao.titulo}` : ''}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Resposta do Pré-Vendas *</label>
            <textarea
              rows={4}
              value={respostaData.mensagem}
              onChange={(e) => setRespostaData((prev) => ({ ...prev, mensagem: e.target.value }))}
              placeholder="Descreva o retorno técnico/comercial para a solicitação"
              className="w-full rounded-lg border border-gray-600/60 bg-gray-900/60 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Próximo status</label>
              <select
                value={respostaData.nextStatus}
                onChange={(e) => updateRespostaStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-600/60 bg-gray-900/60 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="EM_PRECIFICACAO">Em Precificação</option>
                <option value="AGUARDANDO_APROVACAO">Aguardando Aprovação</option>
                <option value="ENVIADA">Enviada</option>
                <option value="APROVADO">Aprovado</option>
                <option value="REPROVADO">Reprovado</option>
                <option value="FINALIZADA">Finalizada</option>
                <option value="REJEITADA">Rejeitada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Próxima etapa</label>
              <select
                value={respostaData.nextStage}
                onChange={(e) => setRespostaData((prev) => ({ ...prev, nextStage: e.target.value }))}
                className="w-full rounded-lg border border-gray-600/60 bg-gray-900/60 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedSolicitacao?.sourceType !== 'ACTIVITY' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor sugerido (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={respostaData.valorSugerido}
                  onChange={(e) => setRespostaData((prev) => ({ ...prev, valorSugerido: e.target.value }))}
                  className="w-full rounded-lg border border-gray-600/60 bg-gray-900/60 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Custo total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={respostaData.custoTotal}
                  onChange={(e) => setRespostaData((prev) => ({ ...prev, custoTotal: e.target.value }))}
                  className="w-full rounded-lg border border-gray-600/60 bg-gray-900/60 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Margem (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={respostaData.margemLucro}
                  onChange={(e) => setRespostaData((prev) => ({ ...prev, margemLucro: e.target.value }))}
                  className="w-full rounded-lg border border-gray-600/60 bg-gray-900/60 px-3 py-2 text-white"
                />
              </div>
            </div>
          )}

          {/* Proposta selecionada para anexar */}
          {respostaData.propostaSelecionada && (
            <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-200">
                    📎 Proposta anexada: <strong>{respostaData.propostaNome}</strong>
                  </p>
                  <p className="text-xs text-indigo-300 mt-0.5">
                    A proposta será referenciada na resposta ao Comercial.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRespostaData(p => ({ ...p, propostaSelecionada: null, propostaNome: null }))}
                  className="text-xs text-indigo-400 hover:text-white underline"
                >
                  Remover
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowRespostaModal(false)}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submitResposta}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {saving ? 'Enviando...' : 'Enviar resposta'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
