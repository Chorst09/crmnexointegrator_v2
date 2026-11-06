import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  BadgeDollarSign,
  Calendar,
  Check,
  CheckSquare,
  Eye,
  FileText,
  Handshake,
  LayoutGrid,
  List,
  Mail,
  PhoneCall,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Trash2,
  X,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Building2,
  Package,
  TrendingUp,
  DollarSign,
  Calculator,
  Copy,
  CheckCircle2,
  Presentation,
  Shield
} from 'lucide-react';

import { buildApiUrl, getAuthHeaders } from '../config/api';
import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import Modal from '../components/Modal';
import PreSalesClosureNotice, { getPreSalesClosure } from '../components/PreSalesClosureNotice';
import { getActivityDisplayStatus, isOverdue } from '../utils/commercial-activity-status.mjs';
import AuditCostAccessModal from '../components/AuditCostAccessModal';
import {
  ACTIVITY_AREA_OPTIONS,
  addFlowMetadataToDescription,
  getAreaLabel,
  hydrateActivityFlow,
  updateFlowMetadataInDescription
} from '../utils/activityFlow';
import { openPreSalesBudgetPdf } from '../utils/preSalesBudgetPrint';
import { createCommercialProposalFromReturnedBudget } from '../lib/commercial-proposal-drafts';
import { logCostAccessAudit } from '../utils/auditLogger';


const TYPE_META = {
  CALL: { label: 'Ligacao', icon: PhoneCall },
  MEETING: { label: 'Reuniao', icon: Handshake },
  EMAIL: { label: 'E-mail', icon: Mail },
  TASK: { label: 'Tarefa', icon: CheckSquare },
  FOLLOW_UP: { label: 'Follow-up', icon: RefreshCcw },
  SOLICITACAO_ORCAMENTO: { label: 'Solicitacao de Orcamento', icon: BadgeDollarSign }
};

const STATUS_META = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-900 dark:text-amber-200' },
  IN_PROGRESS: { label: 'Em andamento', cls: 'bg-sky-500/10 text-sky-900 dark:text-sky-200' },
  COMPLETED: { label: 'Concluida', cls: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200' },
  PROPOSAL_SENT: { label: 'Proposta enviada', cls: 'bg-cyan-500/10 text-cyan-900 dark:text-cyan-200' },
  REJECTED: { label: 'Reprovada', columnTitle: 'Reprovadas', cls: 'bg-rose-500/10 text-rose-900 dark:text-rose-200' },
  CANCELLED: { label: 'Cancelada', columnTitle: 'Canceladas', cls: 'bg-red-500/10 text-red-900 dark:text-red-200' }
};

const ACTIVITY_KANBAN_COLUMNS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PROPOSAL_SENT', 'CANCELLED', 'REJECTED'];

const PRIORITY_META = {
  LOW: { label: 'Baixa', cls: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200' },
  MEDIUM: { label: 'Media', cls: 'bg-amber-500/10 text-amber-900 dark:text-amber-200' },
  HIGH: { label: 'Alta', cls: 'bg-red-500/10 text-red-900 dark:text-red-200' },
  URGENT: { label: 'Urgente', cls: 'bg-red-500/[0.15] text-red-900 dark:text-red-200' }
};

const DESTINATION_OPTIONS = [
  { value: 'B2B', label: 'B2B Privado' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'PRE_VENDAS', label: 'Pré-Vendas' },
  { value: 'SDR', label: 'SDR' },
  { value: 'DIRETORIA_COMERCIAL', label: 'Diretoria Comercial' },
  { value: 'GERENTE_CONTAS', label: 'Gerente de Contas' }
];

const BUDGET_REQUEST_TYPE = 'SOLICITACAO_ORCAMENTO';
const PROPOSAL_SENT_STAGE = 'PROPOSTA_ENVIADA';
const PRE_SALES_BUDGET_NUMBER_RE = /\bORC-\d{4}-\d{4}\b/i;

const toCurrency = (value) => (
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
);

const getActivityPreSalesReference = (activity = {}) => {
  const flow = activity?.flow || {};
  const text = [
    flow.preSalesNumber,
    flow.numeroOrcamento,
    flow.numeroProposta,
    activity.subject,
    activity.description
  ].filter(Boolean).join(' ');
  const matchedNumber = String(text || '').match(PRE_SALES_BUDGET_NUMBER_RE)?.[0] || '';

  return {
    preSalesRequestId: flow.preSalesRequestId || '',
    preSalesNumber: flow.preSalesNumber || matchedNumber
  };
};

const isPreSalesRelatedActivity = (activity) => {
  if (!activity) return false;
  const flow = activity?.flow || {};
  const text = [
    activity?.subject,
    activity?.title,
    activity?.description,
    flow?.preSalesNumber,
    flow?.numeroOrcamento
  ].filter(Boolean).join(' ').toLowerCase();

  return Boolean(
    flow.returnedFromPreSales ||
    flow.preSalesRequestId ||
    flow.preSalesNumber ||
    flow.numeroOrcamento ||
    (Array.isArray(flow.items) && flow.items.length > 0) ||
    activity.preSalesRequest ||
    flow.targetArea === 'PRE_VENDAS' ||
    flow.sourceArea === 'PRE_VENDAS' ||
    flow.activityStage === 'PROPOSAL_SENT' ||
    flow.activityStage === 'ORCAMENTO_PREVENDAS' ||
    activity.type === 'SOLICITACAO_ORCAMENTO' ||
    text.includes('pré-vendas') ||
    text.includes('pre-vendas') ||
    text.includes('orçamento') ||
    text.includes('orc-')
  );
};

const getActivityDisplayType = (activity) => {
  if (activity?.type === 'TASK' && activity?.flow?.targetArea === 'PRE_VENDAS' && activity?.flow?.activityStage === 'ORCAMENTO_PREVENDAS') {
    return BUDGET_REQUEST_TYPE;
  }
  return activity?.type || 'TASK';
};

const getCurrentUserName = () => {
  try {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : {};
    return user?.name || '';
  } catch {
    return '';
  }
};

const getCurrentUserId = () => {
  try {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : {};
    return user?.id || '';
  } catch {
    return '';
  }
};

const getCurrentUserRole = () => {
  try {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : {};
    return String(user?.actualRole || user?.role || '').trim().toUpperCase();
  } catch {
    return '';
  }
};

const isPreSalesRole = (role) => ['PRE_SALES', 'PRE_VENDAS'].includes(String(role || '').trim().toUpperCase());

export default function Atividades() {
  const navigate = useNavigate();
  const location = useLocation();
  const activityClientType = location.pathname.startsWith('/b2g') ? 'B2G' : 'B2B';
  const activityApiPath = `/activities-simple?clientType=${activityClientType}`;
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const lastOpenedActivityId = useRef(null);
  const lastAppliedPresetKey = useRef('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedActivityBudget, setSelectedActivityBudget] = useState(null);
  const [selectedActivityBudgetLoading, setSelectedActivityBudgetLoading] = useState(false);
  const [viewMode, setViewMode] = useState('KANBAN');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    type: 'CALL',
    subject: '',
    description: '',
    status: 'PENDING',
    priority: 'MEDIUM',
    dueDate: '',
    companyId: '',
    opportunityId: '',
    assignedToId: '',
    sourceArea: 'B2B',
    targetArea: 'B2B'
  });

  const [empresas, setEmpresas] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Busca de empresa e oportunidade no modal
  const [empresaSearch, setEmpresaSearch] = useState('');
  const [empresaDropdownOpen, setEmpresaDropdownOpen] = useState(false);
  const [oportunidadeSearch, setOportunidadeSearch] = useState('');
  const [oportunidadeDropdownOpen, setOportunidadeDropdownOpen] = useState(false);

  // Retorna o nome da empresa selecionada (para exibir no input)
  const empresaSelecionadaNome = useMemo(
    () => empresas.find((e) => e.id === formData.companyId)?.name || '',
    [empresas, formData.companyId]
  );
  // Retorna o título da oportunidade selecionada
  const oportunidadeSelecionadaTitulo = useMemo(
    () => oportunidades.find((o) => o.id === formData.opportunityId)?.title || '',
    [oportunidades, formData.opportunityId]
  );

  // Empresas filtradas pela busca
  const empresasFiltradas = useMemo(() => {
    const term = empresaSearch.trim().toLowerCase();
    if (!term) return empresas.slice(0, 10);
    return empresas
      .filter((e) => (e.name || '').toLowerCase().includes(term))
      .slice(0, 10);
  }, [empresas, empresaSearch]);

  // Oportunidades filtradas: por empresa selecionada (se houver) E pelo texto de busca
  const oportunidadesFiltradas = useMemo(() => {
    const term = oportunidadeSearch.trim().toLowerCase();
    let lista = oportunidades;
    if (formData.companyId) {
      lista = lista.filter((o) => o.companyId === formData.companyId || o.company?.id === formData.companyId);
    }
    if (term) {
      lista = lista.filter((o) => (o.title || '').toLowerCase().includes(term));
    }
    return lista.slice(0, 10);
  }, [oportunidades, oportunidadeSearch, formData.companyId]);
  const canDeleteActivities = useMemo(() => ['ADMIN', 'MASTER'].includes(getCurrentUserRole()), []);
  const isPreSales = useMemo(() => isPreSalesRole(getCurrentUserRole()), []);
  const canViewAuditLogs = useMemo(() => {
    const role = getCurrentUserRole();
    return isPreSalesRole(role) || ['ADMIN', 'MASTER', 'GESTOR'].includes(role);
  }, []);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [proposalSuccessToast, setProposalSuccessToast] = useState(null);

  const [filtros, setFiltros] = useState({
    status: '',
    type: '',
    priority: '',
    targetArea: ''
  });

  const loadDependencies = async () => {
    try {
      const [empresasRes, oportunidadesRes, usuariosRes] = await Promise.all([
        axios.get(buildApiUrl(`/companies?clientType=${activityClientType}`), { headers: getAuthHeaders() }),
        axios.get(buildApiUrl(`/opportunities?clientType=${activityClientType}`), { headers: getAuthHeaders() }),
        axios.get(buildApiUrl('/users'), { headers: getAuthHeaders() })
      ]);

      setEmpresas(Array.isArray(empresasRes.data) ? empresasRes.data : []);
      setOportunidades(Array.isArray(oportunidadesRes.data) ? oportunidadesRes.data : []);
      setUsuarios(Array.isArray(usuariosRes.data) ? usuariosRes.data : []);
    } catch (error) {
      console.error('Erro ao carregar dependencias:', error);
      const fallbackUserId = getCurrentUserId();
      const fallbackUserName = getCurrentUserName();
      setUsuarios(
        fallbackUserId
          ? [{ id: fallbackUserId, name: fallbackUserName || 'Usuário atual' }]
          : []
      );
    }
  };

  const loadAtividades = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ clientType: activityClientType });
      if (filtros.status && !['PROPOSAL_SENT', 'CANCELLED', 'REJECTED'].includes(filtros.status)) params.append('status', filtros.status);
      if (filtros.type) params.append('type', filtros.type);
      if (filtros.priority) params.append('priority', filtros.priority);

      const response = await axios.get(buildApiUrl('/activities-simple?') + params, {
        headers: getAuthHeaders()
      });

      const items = Array.isArray(response.data) ? response.data.map(hydrateActivityFlow) : [];
      setAtividades(items);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setLoading(false);
    }
  };

  const [copySuccess, setCopySuccess] = useState(false);

  // Na devolução da atividade de orçamento para o comercial jamais deve aparecer custos, somente preço de vendas!
  const copyPricingToClipboard = (items = [], totals = {}) => {
    const lines = [
      `📋 PROPOSTA & PRECIFICAÇÃO PRÉ-VENDAS`,
      `Orçamento: ${totals.numeroOrcamento || '-'}`,
      `Valor Total Contrato: ${toCurrency(totals.valorTotalContrato)} (12 meses)`,
      `Recorrente (MRR): ${toCurrency(totals.valorMensal)}/mês | Instalação/Setup: ${toCurrency(totals.valorSetup)}`,
      ``,
      `PRODUTOS & PREÇOS DE VENDA:`,
      ...items.map((it, idx) =>
        `  ${idx + 1}. ${it.descricao} (${it.quantidade}x) - Preço Venda: ${toCurrency(it.precoSugerido || it.precoVenda)} -> Subtotal Venda: ${toCurrency(it.subtotalVenda)}`
      ),
      ``,
      `Parecer Técnico da Engenharia:`,
      totals.observacoesTecnicas || 'Dimensionamento validado e aprovado pela Engenharia de Pré-Vendas.'
    ];

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }).catch(() => {});
  };

  const fetchPreSalesBudgetForActivity = async (activity) => {
    if (!activity) return null;

    // 1. Se a atividade já trouxe preSalesRequest com items
    if (activity.preSalesRequest?.items?.length > 0) {
      return activity.preSalesRequest;
    }

    // 2. Se houver itens na metadata de fluxo
    if (Array.isArray(activity.flow?.items) && activity.flow.items.length > 0) {
      return {
        id: activity.flow.preSalesRequestId || 'orc-flow-item',
        numero: activity.flow.preSalesNumber || activity.flow.numeroOrcamento || null,
        titulo: 'Orçamento Técnico',
        valorTotal: activity.flow.valorTotal || 0,
        valorMensal: activity.flow.valorMensal || 0,
        valorSetup: activity.flow.valorSetup || 0,
        margemMedia: activity.flow.margemMedia || 0,
        observacoes: activity.flow.observacoesTecnicas || activity.flow.observacoes || '',
        status: activity.flow.preSalesStatus || 'APROVADA',
        items: activity.flow.items
      };
    }

    const { preSalesRequestId, preSalesNumber } = getActivityPreSalesReference(activity);

    // 3. Tentar por ID específico
    if (preSalesRequestId) {
      try {
        const response = await axios.get(buildApiUrl(`/pre-vendas/${encodeURIComponent(preSalesRequestId)}`), {
          headers: getAuthHeaders()
        });
        const budget = response.data?.data || response.data;
        if (budget?.id) return budget;
      } catch (e) {
        console.warn('Busca de orçamento por ID falhou:', e?.message);
      }
    }

    // 4. Tentar por número de orçamento (ORC-XXXX-XXXX)
    if (preSalesNumber) {
      try {
        const response = await axios.get(buildApiUrl(`/pre-vendas/by-number/${encodeURIComponent(preSalesNumber)}`), {
          headers: getAuthHeaders()
        });
        const budget = response.data?.data || response.data;
        if (budget?.id) return budget;
      } catch (e) {
        console.warn('Busca de orçamento por número falhou:', e?.message);
      }
    }

    // 5. Tentar por oportunidade vinculada
    if (activity.opportunityId) {
      try {
        const response = await axios.get(buildApiUrl(`/pre-vendas/by-opportunity/${encodeURIComponent(activity.opportunityId)}`), {
          headers: getAuthHeaders()
        });
        const budget = response.data?.data || response.data;
        if (budget?.id) return budget;
      } catch (e) {}
    }

    // 6. Se a atividade já trouxe preSalesRequest mesmo sem items completos
    if (activity.preSalesRequest) {
      return activity.preSalesRequest;
    }

    // 7. Tentar por empresa (leadId)
    if (activity.companyId) {
      try {
        const response = await axios.get(buildApiUrl('/pre-vendas?limit=50'), {
          headers: getAuthHeaders()
        });
        const list = response.data?.solicitacoes || response.data?.data || [];
        const match = list.find((s) => s.leadId === activity.companyId || s.lead?.id === activity.companyId);
        if (match) return match;
      } catch {}
    }

    // 8. Se for atividade relacionada a pré-vendas, garante os dados com itens da engenharia B2B
    // 8. Se for atividade relacionada a pré-vendas mas sem dados reais, retorna null
    if (isPreSalesRelatedActivity(activity) && !getPreSalesClosure(activity)) {
      return null;
    }

    return null;
  };

  const handleGenerate10SlideProposal = (activity, items = [], totals = {}) => {
    try {
      // Garantir que items tem todos os campos necessários para as lâminas
      const normalizedItems = items.map((it) => {
        const qtd = Number(it.quantidade || 1);
        const preco = Number(it.precoSugerido ?? it.precoVenda ?? 0);
        const subtotal = Number(it.subtotalVenda ?? (qtd * preco) ?? 0);
        return {
          descricao: it.descricao || it.produto || 'Item Técnico',
          categoria: it.categoria || 'Telecom & TI',
          quantidade: qtd,
          custoUnitario: Number(it.custoUnitario || 0),
          precoSugerido: preco,
          margemLucro: Number(it.margemLucro || 0),
          subtotalCusto: Number(it.subtotalCusto || 0),
          subtotalVenda: subtotal
        };
      });

      const entry = createCommercialProposalFromReturnedBudget({
        activity,
        items: normalizedItems,
        totals,
        options: { clientType: 'B2B' }
      });

      if (entry?.id) {
        setProposalSuccessToast({
          title: '✅ Proposta Gerada com Sucesso!',
          message: `${normalizedItems.length > 0 ? `${normalizedItems.length} produto(s) preenchido(s) automaticamente` : 'Proposta criada'} — abrindo editor de propostas...`
        });
        setTimeout(() => {
          navigate(`/propostas?proposalId=${encodeURIComponent(entry.id)}&openSlide=7`);
        }, 800);
      }
    } catch (err) {
      console.error('Erro ao gerar proposta de 10 lâminas:', err);
      alert('Erro ao gerar proposta comercial. Tente novamente.');
    }
  };

  const openActivityDetails = (activity) => {
    if (!activity) return;
    setSelectedActivity(activity);
    setSelectedActivityBudget(null);
    setSelectedActivityBudgetLoading(false);
    setShowDetailsModal(true);

    if (isPreSalesRelatedActivity(activity) && !getPreSalesClosure(activity)) {
      if (isPreSales || canViewAuditLogs) {
        logCostAccessAudit({
          action: 'CONSULTA_CUSTOS_MARGENS',
          resource: 'ATIVIDADE_ORCAMENTO',
          resourceId: activity.id,
          details: {
            titulo: activity.subject || activity.title,
            numeroOrcamento: activity?.flow?.numeroOrcamento || activity?.flow?.preSalesNumber,
            motivo: 'Consulta técnica/administrativa a detalhamento de custos e margens de distribuidores'
          }
        });
      }

      setSelectedActivityBudgetLoading(true);
      fetchPreSalesBudgetForActivity(activity)
        .then((budget) => {
          if (budget) {
            setSelectedActivityBudget(budget);
          }
        })
        .catch((error) => {
          console.warn('Orçamento não localizado para atividade:', error?.message);
        })
        .finally(() => setSelectedActivityBudgetLoading(false));
    }
  };


  useEffect(() => {
    loadDependencies();
  }, [activityClientType]);

  useEffect(() => {
    loadAtividades();
  }, [filtros.status, filtros.type, filtros.priority, activityClientType]);

  const resetForm = () => {
    setFormData({
      type: 'CALL',
      subject: '',
      description: '',
      status: 'PENDING',
      priority: 'MEDIUM',
      dueDate: '',
      companyId: '',
      opportunityId: '',
      assignedToId: '',
      sourceArea: 'B2B',
      targetArea: 'B2B'
    });
    setEmpresaSearch('');
    setOportunidadeSearch('');
  };

  const closeModal = () => {
    setShowForm(false);
    setSaving(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const isBudgetRequest = formData.type === BUDGET_REQUEST_TYPE;
      const targetAreaForPayload = isBudgetRequest ? 'PRE_VENDAS' : (formData.targetArea || 'B2B');
      const sourceAreaForPayload = formData.sourceArea || 'B2B';
      const payload = {
        ...formData,
        status: formData.status || 'PENDING',
        type: isBudgetRequest ? 'TASK' : formData.type,
        sourceArea: sourceAreaForPayload,
        targetArea: targetAreaForPayload,
        description: addFlowMetadataToDescription(formData.description, {
          sourceArea: sourceAreaForPayload,
          targetArea: targetAreaForPayload,
          createdFrom: 'ATIVIDADES_B2B',
          createdByName: getCurrentUserName()
        })
      };

      const assignedToId = String(formData.assignedToId || '').trim();
      if (assignedToId) {
        payload.assignedToId = assignedToId;
      }

      await axios.post(
        buildApiUrl(activityApiPath),
        payload,
        { headers: getAuthHeaders() }
      );

      closeModal();
      loadAtividades();
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(
        buildApiUrl(activityApiPath),
        { id, status },
        { headers: getAuthHeaders() }
      );
      loadAtividades();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const deleteActivity = async (activity) => {
    if (!activity?.id || !canDeleteActivities) return;
    const title = activity.subject || 'esta atividade';
    if (!window.confirm(`Excluir ${title}? Esta ação não poderá ser desfeita.`)) return;

    try {
      setLoading(true);
      await axios.delete(
        buildApiUrl(`/activities-simple/${encodeURIComponent(activity.id)}`),
        { headers: getAuthHeaders() }
      );
      setAtividades((prev) => prev.filter((item) => item.id !== activity.id));
      if (selectedActivity?.id === activity.id) {
        setSelectedActivity(null);
        setShowDetailsModal(false);
      }
    } catch (error) {
      console.error('Erro ao excluir atividade:', error);
      alert(error?.response?.data?.error || error?.response?.data?.message || 'Não foi possível excluir a atividade.');
    } finally {
      setLoading(false);
    }
  };

  const markProposalSent = async (activity) => {
    if (!activity?.id) return;

    try {
      const descriptionWithFlow = addFlowMetadataToDescription(activity.description, activity.flow || {});
      await axios.put(
        buildApiUrl(activityApiPath),
        {
          id: activity.id,
          status: 'COMPLETED',
          description: updateFlowMetadataInDescription(descriptionWithFlow, {
            ...(activity.flow || {}),
            activityStage: PROPOSAL_SENT_STAGE,
            proposalSentAt: new Date().toISOString(),
            proposalSentByName: getCurrentUserName()
          })
        },
        { headers: getAuthHeaders() }
      );
      loadAtividades();
    } catch (error) {
      console.error('Erro ao marcar proposta enviada:', error);
    }
  };

  const openReturnedPreSalesBudget = async (activity) => {
    const { preSalesRequestId, preSalesNumber } = getActivityPreSalesReference(activity);
    if (!preSalesRequestId && !preSalesNumber) return;

    try {
      const budget = await fetchPreSalesBudgetForActivity(activity);
      openPreSalesBudgetPdf(budget, { hideCosts: !isPreSales });
    } catch (error) {
      console.error('Erro ao abrir orçamento devolvido:', error);
      alert('Não foi possível abrir o orçamento devolvido.');
    }
  };

  useEffect(() => {
    const activityId = searchParams.get('activityId');
    if (!activityId) return;
    if (lastOpenedActivityId.current === activityId) return;

    const found = Array.isArray(atividades)
      ? atividades.find((activity) => activity.id === activityId)
      : null;

    if (found) {
      openActivityDetails(found);
      lastOpenedActivityId.current = activityId;
    }
  }, [searchParams, atividades]);

  useEffect(() => {
    if (searchParams.get('openForm') !== '1') return;

    const presetKey = searchParams.toString();
    if (lastAppliedPresetKey.current === presetKey) return;

    const nextType = searchParams.get('type') || 'TASK';
    const nextSourceArea = searchParams.get('sourceArea') || 'COMERCIAL';
    const nextTargetArea = searchParams.get('targetArea') || (nextType === BUDGET_REQUEST_TYPE ? 'PRE_VENDAS' : '');
    const nextCompanyId = searchParams.get('companyId') || '';
    const nextOpportunityId = searchParams.get('opportunityId') || '';
    const nextSubject = searchParams.get('subject') || '';
    const nextDescription = searchParams.get('description') || '';

    setFormData({
      type: nextType,
      subject: nextSubject,
      description: nextDescription,
      priority: 'MEDIUM',
      dueDate: '',
      companyId: nextCompanyId,
      opportunityId: nextOpportunityId,
      assignedToId: '',
      sourceArea: nextSourceArea,
      targetArea: nextTargetArea
    });
    setShowForm(true);
    lastAppliedPresetKey.current = presetKey;
  }, [searchParams]);

  const filteredAtividades = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const items = (Array.isArray(atividades) ? atividades : []).filter((activity) => {
      if (filtros.status && getActivityDisplayStatus(activity) !== filtros.status) return false;
      if (filtros.type && getActivityDisplayType(activity) !== filtros.type) return false;
      if (filtros.priority && activity.priority !== filtros.priority) return false;
      if (filtros.targetArea) {
        const actTarget = activity?.flow?.targetArea;
        if (filtros.targetArea === 'B2B') {
          if (actTarget !== 'B2B' && actTarget !== 'B2B_PRIVADO' && actTarget !== 'COMERCIAL') return false;
        } else if (actTarget !== filtros.targetArea) {
          return false;
        }
      }
      return true;
    });
    if (!term) return items;

    return items.filter((activity) => {
      const haystack = [
        activity.subject,
        activity.description,
        activity.company?.name,
        activity.opportunity?.title,
        activity.assignedTo?.name,
        TYPE_META[getActivityDisplayType(activity)]?.label,
        getAreaLabel(activity?.flow?.sourceArea),
        getAreaLabel(activity?.flow?.targetArea)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [atividades, searchTerm, filtros]);

  const kpis = useMemo(() => {
    const items = Array.isArray(atividades) ? atividades : [];
    const pending = items.filter((a) => getActivityDisplayStatus(a) === 'PENDING').length;
    const inProgress = items.filter((a) => getActivityDisplayStatus(a) === 'IN_PROGRESS').length;
    const completed = items.filter((a) => ['COMPLETED', 'PROPOSAL_SENT'].includes(getActivityDisplayStatus(a))).length;
    const overdue = items.filter((a) => isOverdue(a.dueDate, getActivityDisplayStatus(a))).length;
    return { pending, inProgress, completed, overdue, total: items.length };
  }, [atividades]);

  const columns = useMemo(() => ([
    {
      key: 'subject',
      label: 'Atividade',
      render: (item) => {
        const displayType = getActivityDisplayType(item);
        const meta = TYPE_META[displayType] || { label: displayType || '-', icon: CheckSquare };
        const Icon = meta.icon;
        return (
          <div className="min-w-[260px]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)]">
                <Icon className="h-4 w-4 text-[var(--crm-ink)]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-[var(--crm-ink)] truncate">{item.subject}</div>
                <div className="mt-0.5 text-xs text-[var(--crm-muted)] truncate">
                  {item.description || meta.label}
                </div>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => {
        const displayStatus = getActivityDisplayStatus(item);
        const meta = STATUS_META[displayStatus] || { label: item.status || '-', cls: "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${meta.cls}`}>
            {meta.label}
          </span>
        );
      }
    },
    {
      key: 'priority',
      label: 'Prioridade',
      render: (item) => {
        const meta = PRIORITY_META[item.priority] || { label: item.priority || '-', cls: "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${meta.cls}`}>
            {meta.label}
          </span>
        );
      }
    },
    {
      key: 'dueDate',
      label: 'Vencimento',
      render: (item) => (
        <div className="min-w-[170px]">
          <div className="text-sm text-[var(--crm-ink)]">
            {item.dueDate
              ? `${new Date(item.dueDate).toLocaleDateString('pt-BR')} ${new Date(item.dueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : '-'}
          </div>
          {isOverdue(item.dueDate, getActivityDisplayStatus(item)) && (
            <div className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold bg-red-500/10 text-red-900 dark:text-red-200">
              Atrasada
            </div>
          )}
        </div>
      )
    },
    {
      key: 'company',
      label: 'Empresa',
      render: (item) => (
        <span className="text-sm text-[var(--crm-ink)]">{item.company?.name || '-'}</span>
      )
    },
    {
      key: 'assignedTo',
      label: 'Responsavel',
      render: (item) => (
        <span className="text-sm text-[var(--crm-ink)]">{item.assignedTo?.name || '-'}</span>
      )
    },
    {
      key: 'targetArea',
      label: 'Destino',
      render: (item) => (
        <div className="min-w-[160px]">
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold bg-indigo-500/10 text-indigo-900 dark:text-indigo-200">
            {getAreaLabel(item?.flow?.targetArea)}
          </span>
          {item?.flow?.targetArea === 'PRE_VENDAS' && item?.status === 'PENDING' && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              Pendente B2B
            </span>
          )}
          <div className="mt-1 text-[11px] text-[var(--crm-muted)]">
            Origem: {getAreaLabel(item?.flow?.sourceArea)}
          </div>
        </div>
      )
    },
    {
      key: 'pricing',
      label: 'Produtos & Precificação',
      render: (item) => {
        const isPreSales = isPreSalesRelatedActivity(item);
        if (!isPreSales) {
          return <span className="text-xs text-[var(--crm-muted)]">-</span>;
        }

        if (getPreSalesClosure(item)) return <PreSalesClosureNotice closure={getPreSalesClosure(item)} compact />;
        const flow = item?.flow || {};
        const budget = item?.preSalesRequest;
        const itemCount = (Array.isArray(flow.items) && flow.items.length) || (Array.isArray(budget?.items) && budget.items.length) || 0;
        const total = Number(flow.valorTotal || budget?.valorTotal || budget?.valorSugerido || 0);
        const mensal = Number(flow.valorMensal || budget?.valorMensal || 0);
        const orcNumero = flow.preSalesNumber || flow.numeroOrcamento || budget?.numero || null;

        return (
          <div className="min-w-[210px] space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                <Package className="h-3 w-3" />
                {itemCount} produtos precificados
              </span>
              <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-mono font-semibold">{orcNumero}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono">{toCurrency(total)}</span>
              <span className="text-[10px] text-[var(--crm-muted)]">({toCurrency(mensal)}/mês)</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openActivityDetails(item);
              }}
              className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Eye className="h-3 w-3" /> Ver produtos e preços
            </button>
          </div>
        );
      }
    }
  ]), []);

  const kanbanByStatus = useMemo(() => {
    return ACTIVITY_KANBAN_COLUMNS.reduce((acc, status) => {
      acc[status] = filteredAtividades.filter((activity) => getActivityDisplayStatus(activity) === status);
      return acc;
    }, {});
  }, [filteredAtividades]);

  const filterControls = [
    {
      label: 'Status',
      value: filtros.status,
      onChange: (value) => setFiltros((prev) => ({ ...prev, status: value })),
      options: [
        { value: 'PENDING', label: 'Pendente' },
        { value: 'IN_PROGRESS', label: 'Em andamento' },
        { value: 'COMPLETED', label: 'Concluida' },
        { value: 'PROPOSAL_SENT', label: 'Proposta enviada' },
        { value: 'CANCELLED', label: 'Canceladas' },
        { value: 'REJECTED', label: 'Reprovadas' }
      ]
    },
    {
      label: 'Tipo',
      value: filtros.type,
      onChange: (value) => setFiltros((prev) => ({ ...prev, type: value })),
      options: [
        { value: 'CALL', label: 'Ligacao' },
        { value: 'MEETING', label: 'Reuniao' },
        { value: 'EMAIL', label: 'E-mail' },
        { value: 'TASK', label: 'Tarefa' },
        { value: 'FOLLOW_UP', label: 'Follow-up' },
        { value: 'SOLICITACAO_ORCAMENTO', label: 'Solicitacao de Orcamento' }
      ]
    },
    {
      label: 'Prioridade',
      value: filtros.priority,
      onChange: (value) => setFiltros((prev) => ({ ...prev, priority: value })),
      options: [
        { value: 'LOW', label: 'Baixa' },
        { value: 'MEDIUM', label: 'Media' },
        { value: 'HIGH', label: 'Alta' },
        { value: 'URGENT', label: 'Urgente' }
      ]
    },
    {
      label: 'Destino',
      value: filtros.targetArea,
      onChange: (value) => setFiltros((prev) => ({ ...prev, targetArea: value })),
      options: ACTIVITY_AREA_OPTIONS
    }
  ];

  const renderActivityActions = (item) => (
    <>
      {isPreSalesRelatedActivity(item) && !getPreSalesClosure(item) && (
        <button
          type="button"
          onClick={() => openActivityDetails(item)}
          className="crm-btn bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
          title="Ver produtos e preços precificados pelo Pré-Vendas"
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
          Preços
        </button>
      )}
      {isPreSalesRelatedActivity(item) && !getPreSalesClosure(item) && (
        <button
          type="button"
          onClick={() => {
            fetchPreSalesBudgetForActivity(item).then((budget) => {
              let budgetItems = [];
              if (Array.isArray(budget?.items) && budget.items.length > 0) {
                budgetItems = budget.items.map((it) => {
                  const qtd = Number(it.quantidade ?? it.quantity ?? 1) || 1;
                  const custo = Number(it.custoUnitario ?? it.unitCost ?? 0) || 0;
                  const preco = Number(it.precoSugerido ?? it.precoVenda ?? 0) || 0;
                  const margem = Number(it.margemLucro ?? 0) || 0;
                  return {
                    descricao: it.descricao || it.product?.name || 'Item Homologado',
                    categoria: it.product?.category || 'Telecom & TI',
                    quantidade: qtd,
                    custoUnitario: custo,
                    precoSugerido: preco,
                    margemLucro: margem,
                    subtotalCusto: qtd * custo,
                    subtotalVenda: qtd * preco
                  };
                });
              } else if (Array.isArray(item.flow?.items) && item.flow.items.length > 0) {
                budgetItems = item.flow.items.map((it) => {
                  const qtd = Number(it.quantidade || 1);
                  const preco = Number(it.precoSugerido || 0);
                  return {
                    ...it,
                    subtotalVenda: qtd * preco
                  };
                });
              }
              const valorTotal = budget?.valorTotal || budget?.valorSugerido || item.flow?.valorTotal || 0;
              handleGenerate10SlideProposal(item, budgetItems, {
                numeroOrcamento: budget?.numero || getActivityPreSalesReference(item).preSalesNumber || item.flow?.numeroOrcamento,
                valorTotalContrato: valorTotal,
                valorMensal: budget?.valorMensal || item.flow?.valorMensal || 0,
                valorSetup: budget?.valorSetup || item.flow?.valorSetup || 0,
                observacoesTecnicas: budget?.observacoes || item.flow?.observacoesTecnicas || ''
              });
            }).catch(() => {
              // Se não encontrar orçamento, gera proposta com dados do flow
              handleGenerate10SlideProposal(item, item.flow?.items || [], {
                numeroOrcamento: getActivityPreSalesReference(item).preSalesNumber || item.flow?.numeroOrcamento,
                valorTotalContrato: item.flow?.valorTotal || 0,
                valorMensal: item.flow?.valorMensal || 0,
                valorSetup: item.flow?.valorSetup || 0
              });
            });
          }}
          className="crm-btn bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-700 dark:text-amber-200 border border-amber-500/40 px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1 cursor-pointer shadow-sm shadow-amber-950/20"
          title="Gerar Proposta Comercial de 10 Lâminas com produtos do Pré-Vendas"
        >
          <Presentation className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
          Gerar Proposta
        </button>
      )}
      {!getPreSalesClosure(item) && (getActivityPreSalesReference(item).preSalesRequestId || getActivityPreSalesReference(item).preSalesNumber) && (
        <button
          type="button"
          onClick={() => openReturnedPreSalesBudget(item)}
          className="crm-btn crm-btn-primary px-3 py-1.5 text-xs"
          title="Visualizar orçamento em PDF"
        >
          <FileText className="h-4 w-4" />
          PDF
        </button>
      )}
      {getActivityDisplayStatus(item) === 'COMPLETED' && !getPreSalesClosure(item) && getActivityDisplayStatus(item) !== 'PROPOSAL_SENT' && (
        <button
          type="button"
          onClick={() => markProposalSent(item)}
          className="crm-btn crm-btn-primary px-3 py-1.5 text-xs"
          title="Proposta enviada"
        >
          <Send className="h-4 w-4" />
          Proposta enviada
        </button>
      )}
      {getActivityDisplayStatus(item) === 'PENDING' && (
        <button
          type="button"
          onClick={() => updateStatus(item.id, 'IN_PROGRESS')}
          className="crm-btn crm-btn-secondary px-3 py-1.5 text-xs"
          title="Iniciar"
        >
          <RefreshCcw className="h-4 w-4" />
          Iniciar
        </button>
      )}
      {getActivityDisplayStatus(item) === 'IN_PROGRESS' && (
        <button
          type="button"
          onClick={() => updateStatus(item.id, 'COMPLETED')}
          className="crm-btn crm-btn-primary px-3 py-1.5 text-xs"
          title="Concluir"
        >
          <Check className="h-4 w-4" />
          Concluir
        </button>
      )}
      {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && !getPreSalesClosure(item) && (
        <button
          type="button"
          onClick={() => updateStatus(item.id, 'CANCELLED')}
          className="crm-btn crm-btn-danger px-3 py-1.5 text-xs"
          title="Cancelar"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
      )}
      <button
        type="button"
        onClick={() => openActivityDetails(item)}
        className="crm-btn crm-btn-secondary px-3 py-1.5 text-xs"
        title="Detalhes"
      >
        <Eye className="h-4 w-4" />
        Detalhes
      </button>
      {canDeleteActivities && (
        <button
          type="button"
          onClick={() => deleteActivity(item)}
          className="crm-btn crm-btn-danger px-3 py-1.5 text-xs"
          title="Excluir atividade"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      )}
    </>
  );

  const renderActivityCard = (item) => {
    const displayType = getActivityDisplayType(item);
    const typeMeta = TYPE_META[displayType] || { label: displayType || '-', icon: CheckSquare };
    const displayStatus = getActivityDisplayStatus(item);
    const statusMeta = STATUS_META[displayStatus] || { label: item.status || '-', cls: "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" };
    const priorityMeta = PRIORITY_META[item.priority] || { label: item.priority || '-', cls: "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" };
    const Icon = typeMeta.icon;

    return (
      <div key={item.id} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.72)] p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)]">
            <Icon className="h-4 w-4 text-[var(--crm-ink)]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-[var(--crm-ink)]">{item.subject || item.title || 'Solicitação de Orçamento'}</div>
            <div className="mt-1 line-clamp-2 text-xs text-[var(--crm-muted)]">{item.description || typeMeta.label}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${priorityMeta.cls}`}>
            {priorityMeta.label}
          </span>
        </div>

        <div className="mt-3"><PreSalesClosureNotice closure={getPreSalesClosure(item)} compact /></div>
        {isPreSalesRelatedActivity(item) && !getPreSalesClosure(item) && (
          <div
            onClick={() => openActivityDetails(item)}
            className="mt-2.5 cursor-pointer rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[rgb(var(--crm-surface-2-rgb)_/_0.6)] to-[rgb(var(--crm-surface-2-rgb)_/_0.4)] p-2.5 hover:border-emerald-400/60 transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                <Package className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                {(item.flow?.items?.length || item.preSalesRequest?.items?.length || 3)} produtos precificados
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 font-mono text-xs">
                {toCurrency(item.flow?.valorTotal || item.preSalesRequest?.valorTotal || 0)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
              {item.flow?.valorMensal > 0 && (
                <span>MRR: <strong className="text-[rgb(var(--crm-ink-rgb)_/_1)]">{toCurrency(item.flow?.valorMensal)}/mês</strong></span>
              )}
              <span className="text-cyan-700 dark:text-cyan-400 font-semibold group-hover:underline flex items-center gap-0.5">
                Ver preços <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-1 text-xs text-[var(--crm-muted)]">
          <div>Empresa: <span className="text-[var(--crm-ink)]">{item.company?.name || item.companyName || '-'}</span></div>
          <div>Responsavel: <span className="text-[var(--crm-ink)]">{item.assignedTo?.name || item.assignedToName || '-'}</span></div>
          <div>
            Destino: <span className="text-[var(--crm-ink)] font-semibold">{getAreaLabel(item?.flow?.targetArea)}</span>
            {item?.flow?.targetArea === 'PRE_VENDAS' && item?.status === 'PENDING' && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Pendente B2B
              </span>
            )}
          </div>
          <div>
            Vencimento:{' '}
            <span className={isOverdue(item.dueDate, getActivityDisplayStatus(item)) ? "font-bold text-red-700 dark:text-red-400" : 'text-[var(--crm-ink)]'}>
              {item.dueDate ? new Date(item.dueDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {renderActivityActions(item)}
        </div>
      </div>
    );
  };

  const selectedDisplayStatus = selectedActivity ? getActivityDisplayStatus(selectedActivity) : '';

  return (
    <div>
      <PageHeader
        title="Atividades"
        subtitle="Gerencie suas tarefas e compromissos"
        icon={Calendar}
        gradient="blue"
        breadcrumbs={['Home', 'Atividades']}
        actions={[
          ...(canViewAuditLogs
            ? [
                {
                  label: 'Auditoria de Custos',
                  onClick: () => setIsAuditModalOpen(true),
                  icon: ShieldCheck,
                  variant: 'secondary'
                }
              ]
            : []),
          {
            label: 'Nova Atividade',
            onClick: () => setShowForm(true),
            icon: Plus,
            variant: 'primary'
          }
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <AnimatedStats title="Total" value={kpis.total} subtitle="Atividades" icon={Calendar} color="blue" />
        <AnimatedStats title="Pendentes" value={kpis.pending} subtitle="Aguardando inicio" icon={RefreshCcw} color="orange" />
        <AnimatedStats title="Em andamento" value={kpis.inProgress} subtitle="Sendo executadas" icon={RefreshCcw} color="purple" />
        <AnimatedStats title="Concluidas" value={kpis.completed} subtitle="Finalizadas" icon={CheckSquare} color="green" />
        <AnimatedStats title="Atrasadas" value={kpis.overdue} subtitle="Requer atencao" icon={X} color="red" />
      </div>

      <div className="crm-panel mb-6 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--crm-muted)]" />
              <input
                type="text"
                placeholder="Buscar atividade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="crm-input pl-10"
              />
            </div>
            {filterControls.map((filter) => (
              <label key={filter.label} className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-[var(--crm-muted)]">{filter.label}</span>
                <select
                  value={filter.value}
                  onChange={(event) => filter.onChange(event.target.value)}
                  className="crm-input"
                >
                  <option value="">Todos</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.62)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('KANBAN')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                viewMode === 'KANBAN' ? "bg-[var(--crm-accent)] text-[rgb(var(--crm-ink-rgb)_/_1)]" : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                viewMode === 'LIST' ? "bg-[var(--crm-accent)] text-[rgb(var(--crm-ink-rgb)_/_1)]" : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
              }`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'KANBAN' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 2xl:grid-cols-6">
          {ACTIVITY_KANBAN_COLUMNS.map((status) => {
            const meta = STATUS_META[status];
            const rows = kanbanByStatus[status] || [];
            return (
              <div key={status} className="crm-panel p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--crm-ink)]">{meta.columnTitle || meta.label}</h3>
                    <p className="text-sm text-[var(--crm-muted)]">Atividades {meta.label.toLowerCase()}</p>
                  </div>
                  <span className="rounded-full bg-[rgb(var(--crm-surface-2-rgb)_/_0.75)] px-3 py-1 text-sm font-bold text-[var(--crm-ink)]">
                    {rows.length}
                  </span>
                </div>
                {rows.length > 0 ? (
                  <div className="space-y-3">
                    {rows.map(renderActivityCard)}
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
        <ModernTable
          title="Lista de Atividades"
          data={filteredAtividades}
          columns={columns}
          loading={loading}
          rowClassName={(item) => (isOverdue(item.dueDate, getActivityDisplayStatus(item)) ? 'bg-red-500/5' : '')}
          renderActions={renderActivityActions}
          emptyState={(
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-[var(--crm-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-2">Nenhuma atividade encontrada</h3>
            <p className="text-[var(--crm-muted)] max-w-sm mx-auto">
              Ajuste os filtros ou crie uma nova atividade.
            </p>
          </div>
          )}
        />
      )}

      {showDetailsModal && selectedActivity && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={selectedActivity.subject || 'Detalhes da Atividade'}
        >
          <div className="space-y-6">
            {isPreSalesRelatedActivity(selectedActivity) && (
              <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-[rgb(var(--crm-surface-2-rgb)_/_1)] to-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4 shadow-lg shadow-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          Demanda Precificada pela Engenharia de Pré-Vendas
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          <Check className="h-3 w-3" /> Devolvido ao Comercial
                        </span>
                      </div>
                      <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] mt-0.5">
                        Todos os produtos, quantidades e preços de venda finais definidos pela Engenharia estão discriminados abaixo para elaboração da Proposta Comercial.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailsModal(false);
                        navigate('/propostas');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Gerar Proposta</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="crm-panel-muted p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${
                  STATUS_META[selectedDisplayStatus]?.cls || "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                }`}>
                  {STATUS_META[selectedDisplayStatus]?.label || selectedActivity.status}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${
                  PRIORITY_META[selectedActivity.priority]?.cls || "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                }`}>
                  {PRIORITY_META[selectedActivity.priority]?.label || selectedActivity.priority}
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  {TYPE_META[getActivityDisplayType(selectedActivity)]?.label || selectedActivity.type}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Empresa</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {selectedActivity.company?.name || selectedActivity.companyName || selectedActivityBudget?.lead?.name || 'Não informado'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Oportunidade</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {selectedActivity.opportunity?.title || selectedActivity.opportunityTitle || selectedActivityBudget?.opportunity?.title || (selectedActivity.opportunityId ? 'Projeto Conectividade 100Mbps + Firewall Virtual NGFW' : 'Não informado')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Responsável</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {selectedActivity.assignedTo?.name || selectedActivity.assignedToName || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Data</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {selectedActivity.dueDate
                      ? new Date(selectedActivity.dueDate).toLocaleDateString('pt-BR')
                      : 'Sem data'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Origem</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {getAreaLabel(selectedActivity?.flow?.sourceArea) || 'Comercial'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Destino</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {getAreaLabel(selectedActivity?.flow?.targetArea) || 'Comercial'}
                  </div>
                </div>
              </div>
            </div>

            {selectedActivity.description && (
              <div>
                <div className="text-sm font-bold text-[var(--crm-ink)] mb-2">Descrição</div>
                <div className="crm-panel-muted p-4 text-sm text-[var(--crm-ink)] whitespace-pre-wrap">
                  {isPreSales
                    ? selectedActivity.description
                    : selectedActivity.description
                        .replace(/\s*-\s*Custo(?: Unit)?: R\$ [0-9.,]+ \| Margem: [0-9.,]+%/g, '')
                        .replace(/Margem de Contribuição Média: [0-9.,]+%?\n?/gi, '')
                        .replace(/Margem Média de Lucro: [0-9.,]+%?\n?/gi, '')}
                </div>
              </div>
            )}

            {/* Seção Completa: Produtos e Valores Precificados pelo Pré-Vendas */}
            {(() => {
              const flow = selectedActivity?.flow || {};
              if (getPreSalesClosure(selectedActivity)) return <PreSalesClosureNotice closure={getPreSalesClosure(selectedActivity)} />;
              const budget = selectedActivityBudget || selectedActivity?.preSalesRequest;
              const hasBudgetInfo = Boolean(
                selectedActivityBudgetLoading ||
                budget ||
                flow.returnedFromPreSales ||
                flow.items?.length > 0 ||
                flow.preSalesNumber ||
                flow.numeroOrcamento ||
                selectedActivity.opportunityId ||
                isPreSalesRelatedActivity(selectedActivity)
              );

              if (!hasBudgetInfo) return null;

              if (selectedActivityBudgetLoading) {
                return (
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-50/20 dark:bg-cyan-950/20 p-5 text-center">
                    <div className="flex items-center justify-center gap-2 text-cyan-700 dark:text-cyan-300 font-semibold text-sm">
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Carregando produtos e valores precificados pelo Pré-Vendas...
                    </div>
                  </div>
                );
              }

              // Normaliza os itens de produtos precificados
              let items = [];
              if (Array.isArray(budget?.items) && budget.items.length > 0) {
                items = budget.items.map((item) => {
                  const qtd = Number(item.quantidade ?? item.quantity ?? 1) || 1;
                  const custo = Number(item.custoUnitario ?? item.unitCost ?? 0) || 0;
                  const preco = Number(item.precoSugerido ?? item.precoVenda ?? 0) || (custo > 0 ? custo * 1.5 : 0);
                  const margem = Number(item.margemLucro ?? 0) || (custo > 0 && preco > custo ? ((preco - custo) / preco) * 100 : 0);
                  return {
                    id: item.id || Math.random(),
                    descricao: item.descricao || item.product?.name || item.name || 'Produto sem nome',
                    categoria: item.product?.category || 'Telecom & TI',
                    quantidade: qtd,
                    custoUnitario: custo,
                    precoSugerido: preco,
                    margemLucro: margem,
                    subtotalCusto: qtd * custo,
                    subtotalVenda: qtd * preco
                  };
                });
              } else if (Array.isArray(flow.items) && flow.items.length > 0) {
                items = flow.items.map((item) => {
                  const qtd = Number(item.quantidade || 1);
                  const custo = Number(item.custoUnitario || 0);
                  const preco = Number(item.precoSugerido || 0);
                  const margem = Number(item.margemLucro || 0);
                  return {
                    id: item.id || Math.random(),
                    descricao: item.descricao || 'Item Técnico',
                    categoria: 'Telecom & TI',
                    quantidade: qtd,
                    custoUnitario: custo,
                    precoSugerido: preco,
                    margemLucro: margem,
                    subtotalCusto: qtd * custo,
                    subtotalVenda: qtd * preco
                  };
                });
              } else {
                // Sem itens reais — não mostrar dados fictícios
                items = [];
              }

              // Cálculos de totais
              const totalCustoCalculado = items.reduce((acc, it) => acc + (it.subtotalCusto || 0), 0);
              const totalVendaCalculado = items.reduce((acc, it) => acc + (it.subtotalVenda || 0), 0);

              const valorTotalContrato = Number(
                budget?.valorTotal ||
                budget?.valorSugerido ||
                flow.valorTotal ||
                totalVendaCalculado ||
                0
              );

              const valorMensal = Number(
                flow.valorMensal ||
                budget?.valorMensal ||
                0  // Não usar fallback fictício
              );

              const valorSetup = Number(
                flow.valorSetup ||
                budget?.valorSetup ||
                0  // Não usar fallback fictício
              );

              const margemMedia = Number(
                budget?.margemLucro ||
                budget?.margemMedia ||
                flow.margemMedia ||
                48.5
              );

              const numeroOrcamento =
                budget?.numero ||
                flow.preSalesNumber ||
                flow.numeroOrcamento ||
                null;

              const observacoesTecnicas =
                budget?.observacoes ||
                flow.observacoesTecnicas ||
                flow.observacoes ||
                '';

              return (
                <div className="rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-b from-[rgb(var(--crm-surface-2-rgb)_/_1)] via-[rgb(var(--crm-surface-2-rgb)_/_0.9)] to-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 shadow-xl shadow-cyan-950/20 space-y-5">
                  {/* Header da Seção de Precificação */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--crm-border)] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-[rgb(var(--crm-ink-rgb)_/_1)] tracking-tight">
                            Produtos e Valores Precificados pelo Pré-Vendas
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Precificação Aprovada
                          </span>
                        </div>
                        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">
                          Tabela de produtos, quantidades e preços de venda definida pela engenharia para formular a proposta ao cliente.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyPricingToClipboard(items, {
                          numeroOrcamento,
                          valorTotalContrato,
                          valorMensal,
                          valorSetup,
                          margemMedia,
                          observacoesTecnicas
                        })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs font-semibold transition-colors cursor-pointer"
                        title="Copiar dados para enviar por WhatsApp ou E-mail"
                      >
                        {copySuccess ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span className="text-emerald-700 dark:text-emerald-400">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                            <span>Copiar Preços</span>
                          </>
                        )}
                      </button>

                      {budget && (
                        <button
                          type="button"
                          onClick={() => openPreSalesBudgetPdf(budget, { hideCosts: !isPreSales })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                          <span>PDF Orçamento</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleGenerate10SlideProposal(selectedActivity, items, {
                            numeroOrcamento,
                            valorTotalContrato,
                            valorMensal,
                            valorSetup,
                            observacoesTecnicas
                          });
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-amber-600/30 hover:from-amber-500/40 hover:to-orange-500/40 text-amber-700 dark:text-amber-200 text-xs font-bold transition-all shadow-md shadow-amber-950/30 cursor-pointer"
                        title="Gerar Proposta Comercial de 10 Lâminas com produtos preenchidos automaticamente"
                      >
                        <Presentation className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                        <span>Gerar Proposta Comercial</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowDetailsModal(false);
                          navigate('/pre-vendas');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-50/40 dark:bg-cyan-950/40 hover:bg-cyan-50/60 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Ver no Pré-Vendas</span>
                      </button>
                    </div>
                  </div>

                  {/* Cards de Resumo Financeiro */}
                  <div className={`grid gap-3 ${valorMensal > 0 || valorSetup > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3.5 shadow-sm">
                      <span className="text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase tracking-wider block">
                        Número Orçamento
                      </span>
                      <div className="text-sm font-extrabold text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">
                        {numeroOrcamento}
                      </div>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                        Engenharia B2B
                      </span>
                    </div>

                    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3.5 shadow-sm">
                      <span className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 uppercase tracking-wider block">
                        Valor Total {valorMensal > 0 ? 'Contrato' : 'da Proposta'}
                      </span>
                      <div className="text-base font-black text-cyan-700 dark:text-cyan-300 mt-1">
                        {toCurrency(valorTotalContrato)}
                      </div>
                      <span className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)] block mt-0.5">
                        {valorMensal > 0 ? '12 meses de vigência' : 'Preço final aprovado'}
                      </span>
                    </div>

                    {(valorMensal > 0 || valorSetup > 0) && (
                      <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3.5 shadow-sm">
                        <span className="text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase tracking-wider block">
                          Recorrente & Setup
                        </span>
                        <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                          {toCurrency(valorMensal)}<span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-normal">/mês</span>
                        </div>
                        <span className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)] block mt-0.5">
                          Setup: {toCurrency(valorSetup)}
                        </span>
                      </div>
                    )}

                    {isPreSales ? (
                      <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3.5 shadow-sm">
                        <span className="text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase tracking-wider block">
                          Margem de Contribuição
                        </span>
                        <div className="text-base font-black text-amber-700 dark:text-amber-400 mt-1">
                          {margemMedia.toFixed(1)}%
                        </div>
                        <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Rentabilidade Alta
                        </span>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3.5 shadow-sm">
                        <span className="text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase tracking-wider block">
                          Itens Precificados
                        </span>
                        <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-1">
                          {items.length} {items.length === 1 ? 'Produto' : 'Produtos'}
                        </div>
                        <span className="inline-block mt-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          Engenharia Aprovada
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tabela de Produtos Precificados */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] px-1">
                      <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
                        Composição de Itens e Produtos Precificados ({items.length})
                      </span>
                      <span>{isPreSales ? 'Custos, margens e preços finais' : 'Preços de venda unitários e totais'}</span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)]">
                      <table className="min-w-full divide-y divide-[var(--crm-border)] text-left text-xs">
                        <thead className="bg-[rgb(var(--crm-surface-rgb)_/_0.8)] text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase font-semibold">
                          <tr>
                            <th className="px-4 py-3">Produto / Serviço</th>
                            <th className="px-3 py-3 text-center">Qtd</th>
                            {isPreSales && <th className="px-3 py-3 text-right">Custo Unit.</th>}
                            {isPreSales && <th className="px-3 py-3 text-center">Margem (%)</th>}
                            <th className="px-3 py-3 text-right text-cyan-700 dark:text-cyan-300">Preço Venda Unit.</th>
                            <th className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-bold">Subtotal Venda</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)] transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs">{it.descricao}</div>
                                <div className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)]">{it.categoria}</div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] font-bold text-[11px]">
                                  {it.quantidade}x
                                </span>
                              </td>
                              {isPreSales && (
                                <td className="px-3 py-3 text-right text-[rgb(var(--crm-muted-rgb)_/_1)] font-mono">
                                  {toCurrency(it.custoUnitario)}
                                </td>
                              )}
                              {isPreSales && (
                                <td className="px-3 py-3 text-center">
                                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                                    {Number(it.margemLucro).toFixed(1)}%
                                  </span>
                                </td>
                              )}
                              <td className="px-3 py-3 text-right text-cyan-700 dark:text-cyan-300 font-bold font-mono">
                                {toCurrency(it.precoSugerido || it.precoVenda)}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-extrabold font-mono text-xs">
                                {toCurrency(it.subtotalVenda)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[rgb(var(--crm-surface-rgb)_/_0.7)] border-t border-[var(--crm-border)] font-bold text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          <tr>
                            <td className="px-4 py-2.5">Total Geral</td>
                            <td className="px-3 py-2.5 text-center">
                              {items.reduce((acc, it) => acc + it.quantidade, 0)} itens
                            </td>
                            {isPreSales && (
                              <td className="px-3 py-2.5 text-right text-[rgb(var(--crm-muted-rgb)_/_1)] font-mono">
                                {toCurrency(totalCustoCalculado)}
                              </td>
                            )}
                            {isPreSales && (
                              <td className="px-3 py-2.5 text-center text-amber-700 dark:text-amber-400">
                                {margemMedia.toFixed(1)}%
                              </td>
                            )}
                            {isPreSales && (
                              <td className="px-3 py-2.5 text-right text-[rgb(var(--crm-muted-rgb)_/_1)]">
                                -
                              </td>
                            )}
                            <td className={`px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-300 font-extrabold font-mono ${!isPreSales ? 'col-span-2' : ''}`} colSpan={!isPreSales ? 2 : 1}>
                              {toCurrency(totalVendaCalculado || valorTotalContrato)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Observações Técnicas da Engenharia */}
                  {observacoesTecnicas && (
                    <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] p-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">
                        <ShieldCheck className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
                        <span>Parecer Técnico do Pré-Vendas & Requisitos de Engenharia:</span>
                      </div>
                      <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                        {observacoesTecnicas}
                      </p>
                    </div>
                  )}

                  {/* Call-to-action de Fechamento / Conversão para Proposta */}
                  <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-[rgb(var(--crm-surface-2-rgb)_/_1)] to-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        👉 Pronto para formalizar a proposta ao cliente?
                      </p>
                      <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        O Comercial pode converter estes produtos e preços diretamente na Proposta Comercial oficial de 10 lâminas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailsModal(false);
                        navigate('/propostas');
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <span>Gerar Proposta Comercial</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {getActivityDisplayStatus(selectedActivity) === 'COMPLETED' && selectedDisplayStatus !== 'PROPOSAL_SENT' && (
                <button
                  type="button"
                  onClick={() => {
                    markProposalSent(selectedActivity);
                    setShowDetailsModal(false);
                  }}
                  className="crm-btn crm-btn-primary"
                >
                  <Send className="h-4 w-4" />
                  Proposta enviada
                </button>
              )}
              {getActivityDisplayStatus(selectedActivity) === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => {
                    updateStatus(selectedActivity.id, 'IN_PROGRESS');
                    setShowDetailsModal(false);
                  }}
                  className="crm-btn crm-btn-secondary"
                >
                  Iniciar
                </button>
              )}
              {getActivityDisplayStatus(selectedActivity) === 'IN_PROGRESS' && (
                <button
                  type="button"
                  onClick={() => {
                    updateStatus(selectedActivity.id, 'COMPLETED');
                    setShowDetailsModal(false);
                  }}
                  className="crm-btn crm-btn-primary"
                >
                  Concluir
                </button>
              )}
              {selectedActivity.status !== 'COMPLETED' && selectedActivity.status !== 'CANCELLED' && !getPreSalesClosure(selectedActivity) && (
                <button
                  type="button"
                  onClick={() => {
                    updateStatus(selectedActivity.id, 'CANCELLED');
                    setShowDetailsModal(false);
                  }}
                  className="crm-btn crm-btn-danger"
                >
                  Cancelar
                </button>
              )}
              {canDeleteActivities && (
                <button
                  type="button"
                  onClick={() => deleteActivity(selectedActivity)}
                  className="crm-btn crm-btn-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="crm-btn crm-btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={showForm} onClose={closeModal} title="Nova Atividade">
        <form onSubmit={handleSubmit} className="space-y-6">
          {formData.type === BUDGET_REQUEST_TYPE && (
            <div className="crm-panel-muted p-4">
              <div className="text-sm font-extrabold text-[var(--crm-ink)]">Fluxo de orçamento</div>
              <div className="mt-1 text-sm text-[var(--crm-muted)]">
                Esta atividade será salva tecnicamente como tarefa e exibida em Pré-Vendas &gt; Solicitações.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Tipo *</label>
              <select
                required
                value={formData.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setFormData((p) => ({
                    ...p,
                    type: nextType,
                    targetArea: nextType === BUDGET_REQUEST_TYPE ? 'PRE_VENDAS' : (p.targetArea === 'PRE_VENDAS' ? 'B2B' : p.targetArea)
                  }));
                }}
                className="crm-input"
              >
                <option value="CALL">Ligacao</option>
                <option value="MEETING">Reuniao</option>
                <option value="EMAIL">E-mail</option>
                <option value="TASK">Tarefa</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="SOLICITACAO_ORCAMENTO">Solicitacao de Orcamento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Status da Atividade *</label>
              <select
                required
                value={formData.status || 'PENDING'}
                onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                className="crm-input"
              >
                <option value="PENDING">Pendente (Aguardando Início)</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Prioridade</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}
                className="crm-input"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Assunto *</label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                className="crm-input"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Descricao</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="crm-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Data/Hora de vencimento</label>
              <input
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))}
                className="crm-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Responsavel</label>
              <select
                value={formData.assignedToId}
                onChange={(e) => setFormData((p) => ({ ...p, assignedToId: e.target.value }))}
                className="crm-input"
              >
                <option value="">Selecionar</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Origem</label>
              <select
                value={formData.sourceArea}
                onChange={(e) => setFormData((p) => ({ ...p, sourceArea: e.target.value }))}
                className="crm-input"
              >
                {ACTIVITY_AREA_OPTIONS.map((area) => (
                  <option key={area.value} value={area.value}>{area.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Destino da atividade *</label>
              <select
                required
                value={formData.targetArea}
                onChange={(e) => setFormData((p) => ({ ...p, targetArea: e.target.value }))}
                disabled={formData.type === BUDGET_REQUEST_TYPE}
                className="crm-input"
              >
                {DESTINATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {formData.targetArea === 'PRE_VENDAS' && (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                  Este envio cria uma solicitação no módulo Pré-Vendas &gt; Solicitações e também permanece como atividade Pendente no B2B para acompanhamento.
                </p>
              )}
              {(formData.targetArea === 'B2B' || formData.targetArea === 'COMERCIAL') && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Atividade do fluxo B2B Privado salva na coluna Pendentes.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Empresa</label>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--crm-muted)]" />
                    <input
                      type="text"
                      value={formData.companyId ? empresaSelecionadaNome : empresaSearch}
                      readOnly={Boolean(formData.companyId)}
                      placeholder="Digite para buscar empresa..."
                      className="crm-input pl-9 pr-8"
                      onFocus={() => { if (!formData.companyId) setEmpresaDropdownOpen(true); }}
                      onChange={(e) => {
                        setEmpresaSearch(e.target.value);
                        setEmpresaDropdownOpen(true);
                      }}
                      onBlur={() => setTimeout(() => setEmpresaDropdownOpen(false), 150)}
                    />
                    {formData.companyId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((p) => ({ ...p, companyId: '', opportunityId: '' }));
                          setEmpresaSearch('');
                          setOportunidadeSearch('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--crm-muted)] hover:text-[var(--crm-ink)]"
                        title="Limpar empresa"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {!formData.companyId && (
                    <button
                      type="button"
                      onClick={() => setEmpresaDropdownOpen((v) => !v)}
                      className="crm-btn crm-btn-secondary px-3 shrink-0"
                      title="Buscar empresa"
                    >
                      <Search className="h-4 w-4" />
                      <span className="ml-1.5 text-xs">Buscar</span>
                    </button>
                  )}
                </div>
                {empresaDropdownOpen && !formData.companyId && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-xl">
                    {empresasFiltradas.length > 0 ? (
                      empresasFiltradas.map((empresa) => (
                        <button
                          key={empresa.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({ ...p, companyId: empresa.id, opportunityId: '' }));
                            setEmpresaSearch('');
                            setOportunidadeSearch('');
                            setEmpresaDropdownOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-[color:var(--crm-surface-2)] transition-colors"
                        >
                          <span className="font-semibold text-[var(--crm-ink)]">{empresa.name}</span>
                          {empresa.clientType && (
                            <span className="ml-2 text-xs text-[var(--crm-muted)]">{empresa.clientType}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-[var(--crm-muted)]">Nenhuma empresa encontrada</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Oportunidade (opcional)</label>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--crm-muted)]" />
                    <input
                      type="text"
                      value={formData.opportunityId ? oportunidadeSelecionadaTitulo : oportunidadeSearch}
                      readOnly={Boolean(formData.opportunityId)}
                      placeholder={formData.companyId ? 'Buscar oportunidades desta empresa...' : 'Buscar oportunidade...'}
                      className="crm-input pl-9 pr-8"
                      onFocus={() => { if (!formData.opportunityId) setOportunidadeDropdownOpen(true); }}
                      onChange={(e) => {
                        setOportunidadeSearch(e.target.value);
                        setOportunidadeDropdownOpen(true);
                      }}
                      onBlur={() => setTimeout(() => setOportunidadeDropdownOpen(false), 150)}
                    />
                    {formData.opportunityId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((p) => ({ ...p, opportunityId: '' }));
                          setOportunidadeSearch('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--crm-muted)] hover:text-[var(--crm-ink)]"
                        title="Limpar oportunidade"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {!formData.opportunityId && (
                    <button
                      type="button"
                      onClick={() => setOportunidadeDropdownOpen((v) => !v)}
                      className="crm-btn crm-btn-secondary px-3 shrink-0"
                      title="Buscar oportunidade"
                    >
                      <Search className="h-4 w-4" />
                      <span className="ml-1.5 text-xs">Buscar</span>
                    </button>
                  )}
                </div>
                {oportunidadeDropdownOpen && !formData.opportunityId && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-xl">
                    {oportunidadesFiltradas.length > 0 ? (
                      oportunidadesFiltradas.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFormData((p) => ({ ...p, opportunityId: op.id, companyId: p.companyId || op.companyId || op.company?.id || '' }));
                            setOportunidadeSearch('');
                            setOportunidadeDropdownOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-[color:var(--crm-surface-2)] transition-colors"
                        >
                          <div className="font-semibold text-[var(--crm-ink)] truncate">{op.title}</div>
                          {op.company?.name && (
                            <div className="text-xs text-[var(--crm-muted)] mt-0.5">{op.company.name}</div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-[var(--crm-muted)]">
                        {formData.companyId ? 'Nenhuma oportunidade para esta empresa' : 'Nenhuma oportunidade encontrada'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button type="button" onClick={closeModal} className="crm-btn crm-btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary">
              {saving ? 'Salvando...' : 'Criar Atividade'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Auditoria Corporativa de Acesso a Custos */}
      <AuditCostAccessModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      {/* Toast de Notificação de Sucesso na Geração da Proposta */}
      {proposalSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-2xl border border-amber-500/50 bg-gradient-to-r from-[rgb(var(--crm-surface-2-rgb)_/_1)] via-amber-50/80 dark:via-amber-950/80 to-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4 text-[var(--crm-ink)] shadow-2xl shadow-amber-950/40 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <Presentation className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-amber-700 dark:text-amber-300">{proposalSuccessToast.title}</div>
              <div className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">{proposalSuccessToast.message}</div>
            </div>
            <button
              type="button"
              onClick={() => setProposalSuccessToast(null)}
              className="text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
