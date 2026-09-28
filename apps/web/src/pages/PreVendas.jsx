import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Beaker,
  BadgeDollarSign,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Calculator,
  FileText,
  DollarSign,
  Network,
  Package,
  Radar,
  CalendarCheck2,
  SendHorizontal,
  RefreshCcw,
  X,
  CheckSquare,
  Maximize2,
  Mail,
  MapPin,
  Tags,
  Globe2
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

import { buildApiUrl, getAuthHeaders } from '../config/api';
import DashboardKPICard from '../components/DashboardKPICard';
import Modal from '../components/Modal';
import PresentationControls from '../components/PresentationControls';
import {
  addFlowMetadataToDescription,
  getAreaLabel,
  hydrateActivityFlow
} from '../utils/activityFlow';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const STATUS_META = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/40' },
  IN_PROGRESS: { label: 'Em andamento', cls: 'bg-sky-500/20 text-sky-200 border-sky-500/40' },
  COMPLETED: { label: 'Concluida', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-500/20 text-red-200 border-red-500/40' }
};

const PRIORITY_META = {
  LOW: { label: 'Baixa', cls: 'text-green-400' },
  MEDIUM: { label: 'Media', cls: 'text-yellow-400' },
  HIGH: { label: 'Alta', cls: 'text-red-400' },
  URGENT: { label: 'Urgente', cls: 'text-red-300' }
};

const toPriorityLabel = (priority) => {
  if (priority === 'HIGH' || priority === 'ALTA') return 'Alta';
  if (priority === 'LOW' || priority === 'BAIXA') return 'Baixa';
  if (priority === 'URGENT' || priority === 'URGENTE') return 'Urgente';
  return 'Média';
};

const getCurrentUserName = () => {
  try {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : {};
    return user?.name || 'Usuário';
  } catch {
    return 'Usuário';
  }
};

const CHART_TICK_COLOR = '#94a3b8';
const CHART_GRID_COLOR = 'rgba(148, 163, 184, 0.16)';

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: CHART_TICK_COLOR,
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8
      }
    }
  },
  scales: {
    x: {
      ticks: { color: CHART_TICK_COLOR },
      grid: { color: CHART_GRID_COLOR }
    },
    y: {
      ticks: {
        color: CHART_TICK_COLOR,
        precision: 0
      },
      grid: { color: CHART_GRID_COLOR }
    }
  }
};

const DOUGHNUT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: CHART_TICK_COLOR,
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8
      }
    }
  }
};

const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const partnerTone = {
  distributor: {
    Icon: Network,
    label: 'Distribuidor',
    ring: '#18c8df',
    topBar: 'from-orange-400/55 via-cyan-300/50 to-emerald-400/35',
    glow: 'from-cyan-500/22 via-teal-500/12 to-emerald-500/12',
    hover: 'hover:border-cyan-300/60 hover:shadow-cyan-500/20',
    iconBox: 'border-cyan-300/35 bg-cyan-400/12 text-cyan-100',
    title: 'group-hover:text-cyan-100',
    chip: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
  },
  supplier: {
    Icon: Package,
    label: 'Fornecedor',
    ring: '#18c8df',
    topBar: 'from-orange-400/55 via-cyan-300/50 to-emerald-400/35',
    glow: 'from-cyan-500/22 via-emerald-500/12 to-yellow-500/12',
    hover: 'hover:border-cyan-300/60 hover:shadow-cyan-500/20',
    iconBox: 'border-cyan-300/35 bg-cyan-400/12 text-cyan-100',
    title: 'group-hover:text-cyan-100',
    chip: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100'
  }
};

const normalizeTextList = (...values) => {
  const source = values.find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return String(value || '').trim();
  });
  if (!source) return '';
  if (Array.isArray(source)) return source.filter(Boolean).join(', ');
  return String(source).split(/[;,]/).map((item) => item.trim()).filter(Boolean).join(', ');
};

const PartnerRegistryCard = ({ item, type = 'distributor' }) => {
  const tone = partnerTone[type] || partnerTone.distributor;
  const Icon = tone.Icon;
  const isActive = item.ativo !== false && item.status !== 'INATIVO';
  const name = item.nome || item.name || tone.label;
  const location = [item.cidade || item.city, item.estado || item.uf].filter(Boolean).join(' / ');
  const contact = item.email || item.telefone || item.phone || item.contato || item.contatoPrincipal || '';
  const category = normalizeTextList(
    item.categoria,
    item.segmento,
    item.tipo,
    item.categorias,
    item.categoriasText,
    item.produtosServicos,
    item.produtosServicosText,
    item.produtosPrincipais,
    item.produtosPrincipaisText,
    item.marcas,
    item.marcasText
  );
  const portal = item.site || item.portalUrl || item.ecommerceUrl || item.portalPartnerUrl || '';
  const completion = isActive ? 158 : 84;

  return (
    <div className={`crm-gradient-glass group min-h-[230px] rounded-lg p-5 ${tone.hover}`}>
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tone.topBar}`} />
      <div className={`absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br ${tone.glow} blur-3xl transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(255,255,255,0.08),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.07),transparent_42%)]" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <svg className="absolute h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="27" stroke="rgba(51,65,85,0.82)" strokeWidth="7" fill="none" />
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  stroke={tone.ring}
                  strokeWidth="7"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${completion} 170`}
                  className="drop-shadow-[0_0_14px_rgba(255,122,0,0.28)] transition-all duration-500"
                />
              </svg>
              <div className={`crm-gradient-icon relative flex h-10 w-10 items-center justify-center rounded-lg ${tone.iconBox}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${type === 'supplier' ? 'text-cyan-200/80' : 'text-teal-200/80'}`}>
                {tone.label}
              </p>
              <h4 className={`mt-1 truncate text-lg font-bold text-white transition-colors ${tone.title}`}>{name}</h4>
            </div>
          </div>

          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isActive
              ? 'border-emerald-400/35 bg-emerald-400/14 text-emerald-200'
              : 'border-slate-500/35 bg-slate-500/14 text-slate-300'
          }`}>
            {isActive ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        <div className="mt-5 grid gap-2.5 text-xs text-slate-300">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate">{location || 'Localização não informada'}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate">{contact || 'Contato não informado'}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Tags className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate">{category || 'Categoria não informada'}</span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className={`max-w-[68%] truncate rounded-full border px-3 py-1.5 text-[11px] font-semibold ${tone.chip}`}>
            {category || 'Base homologada'}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Globe2 className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[92px] truncate">{portal ? 'Portal ativo' : 'Sem portal'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default function PreVendas() {
  const navigate = useNavigate();
  const presentationRef = useRef(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationProgress, setPresentationProgress] = useState({ current: 1, total: 1 });
  const [activeMenu, setActiveMenu] = useState('solicitacoes');

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [registroLoading, setRegistroLoading] = useState(false);
  const [registroOportunidades, setRegistroOportunidades] = useState([]);
  const [cadastrosLoading, setCadastrosLoading] = useState(false);
  const [distribuidores, setDistribuidores] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [pocs, setPocs] = useState([]);
  const [pocsLoading, setPocsLoading] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityStatusFilter, setActivityStatusFilter] = useState('all');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    type: 'TASK',
    subject: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
    targetArea: 'COMERCIAL',
    companyId: '',
    opportunityId: ''
  });

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'MEDIUM',
    leadId: '',
    tiposPrecificacao: [],
    observacoes: '',
    prazoEsperado: '',
    orcamentoEstimado: ''
  });

  useEffect(() => {
    loadSolicitacoes();
    loadPreSalesActivities();
    loadRegistroOportunidades();
    loadPrevendasCadastros();
    loadPocs();
  }, []);

  const loadSolicitacoes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(buildApiUrl('/pre-vendas?limit=200'), {
        headers: getAuthHeaders()
      });

      const apiRows = Array.isArray(response?.data?.solicitacoes)
        ? response.data.solicitacoes
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : Array.isArray(response?.data)
            ? response.data
            : [];

      const mapped = apiRows.map((row) => ({
        id: row.id,
        numero: row.numero,
        titulo: row.titulo,
        descricao: row.descricao,
        status: row.status,
        prioridade: row.prioridade,
        solicitadoPor: row?.solicitante?.name || 'Usuário',
        dataCreated: row.createdAt,
        leadId: row?.lead?.name || '',
        tiposPrecificacao: Array.isArray(row.tiposPrecificacao) ? row.tiposPrecificacao : [],
        valorSugerido: row.valorSugerido || 0,
        custoTotal: row.custoTotal || 0,
        margemLucro: row.margemLucro || 0
      }));

      setSolicitacoes(mapped);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      setSolicitacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPreSalesActivities = async () => {
    try {
      setActivitiesLoading(true);
      const response = await axios.get(buildApiUrl('/activities-simple'), {
        headers: getAuthHeaders()
      });

      const hydrated = Array.isArray(response.data) ? response.data.map(hydrateActivityFlow) : [];
      const relatedToPreSales = hydrated
        .filter((activity) => activity?.flow?.targetArea === 'PRE_VENDAS' || activity?.flow?.sourceArea === 'PRE_VENDAS')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivities(relatedToPreSales);
    } catch (error) {
      console.error('Erro ao carregar atividades do Pré-Vendas:', error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const loadRegistroOportunidades = async () => {
    try {
      setRegistroLoading(true);
      const response = await axios.get(buildApiUrl('/prevendas-cadastros/oportunidades'), {
        headers: getAuthHeaders()
      });

      const payload = response?.data;
      const rows = Array.isArray(payload?.oportunidades)
        ? payload.oportunidades
        : Array.isArray(payload)
          ? payload
          : [];

      setRegistroOportunidades(rows);
    } catch (error) {
      console.error('Erro ao carregar registro de oportunidades:', error);
      setRegistroOportunidades([]);
    } finally {
      setRegistroLoading(false);
    }
  };

  const handleDeleteSolicitacao = async (solicitacaoId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta solicitação?')) {
      return;
    }

    try {
      console.log('🗑️ Tentando excluir solicitação:', solicitacaoId);
      const url = buildApiUrl(`/pre-vendas/${solicitacaoId}`);
      console.log('📍 URL da requisição:', url);
      
      const response = await axios.delete(url, {
        headers: getAuthHeaders()
      });

      console.log('✅ Resposta da API:', response.data);

      if (response.data.success) {
        setSolicitacoes((prev) => prev.filter((item) => item.id !== solicitacaoId));
        alert('✅ Solicitação excluída com sucesso!');
      } else {
        alert('⚠️ A API retornou sucesso=false. Verifique os logs.');
      }
    } catch (error) {
      console.error('❌ Erro ao excluir solicitação:', error);
      console.error('📊 Status:', error.response?.status);
      console.error('📄 Dados:', error.response?.data);
      console.error('🔗 URL:', error.config?.url);
      
      const errorMsg = error.response?.data?.message || error.message;
      
      if (error.response?.status === 403) {
        alert(`🚫 Sem Permissão\n\n${errorMsg}\n\nApenas o solicitante ou administradores podem excluir esta solicitação.`);
      } else if (error.response?.status === 400) {
        alert(`⚠️ Ação Não Permitida\n\n${errorMsg}\n\nNão é possível excluir solicitações finalizadas.`);
      } else if (error.response?.status === 404) {
        alert(`❓ Não Encontrado\n\n${errorMsg}\n\nA solicitação foi removida da lista.`);
        // Remove da lista local mesmo assim
        setSolicitacoes((prev) => prev.filter((item) => item.id !== solicitacaoId));
      } else {
        alert(`❌ Erro ao Excluir\n\nStatus: ${error.response?.status || 'desconhecido'}\nMensagem: ${errorMsg}\n\nVerifique o console para mais detalhes.`);
      }
    }
  };


  const loadPrevendasCadastros = async () => {
    try {
      setCadastrosLoading(true);
      const response = await axios.get(buildApiUrl('/prevendas-cadastros'), {
        headers: getAuthHeaders()
      });
      const payload = response?.data || {};
      setDistribuidores(Array.isArray(payload.distribuidores) ? payload.distribuidores : []);
      setFornecedores(Array.isArray(payload.fornecedores) ? payload.fornecedores : []);
    } catch (error) {
      console.error('Erro ao carregar cadastros de pré-vendas:', error);
      setDistribuidores([]);
      setFornecedores([]);
    } finally {
      setCadastrosLoading(false);
    }
  };

  const loadPocs = async () => {
    try {
      setPocsLoading(true);
      const response = await axios.get(buildApiUrl('/pre-sales-pocs'), {
        headers: getAuthHeaders()
      });
      const rows = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data?.pocs)
          ? response.data.pocs
          : [];
      setPocs(rows);
    } catch (error) {
      console.error('Erro ao carregar POCs:', error);
      setPocs([]);
    } finally {
      setPocsLoading(false);
    }
  };

  const resetSolicitacaoForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      prioridade: 'MEDIUM',
      leadId: '',
      tiposPrecificacao: [],
      observacoes: '',
      prazoEsperado: '',
      orcamentoEstimado: ''
    });
    setCurrentStep(1);
  };

  const resetActivityForm = () => {
    setActivityForm({
      type: 'TASK',
      subject: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      targetArea: 'COMERCIAL',
      companyId: '',
      opportunityId: ''
    });
  };

  const handleSolicitacaoSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!Array.isArray(formData.tiposPrecificacao) || formData.tiposPrecificacao.length === 0) {
        return;
      }

      await axios.post(
        buildApiUrl('/pre-vendas'),
        {
          titulo: formData.titulo,
          descricao: formData.descricao,
          prioridade: formData.prioridade,
          tiposPrecificacao: formData.tiposPrecificacao,
          observacoes: formData.observacoes || ''
        },
        { headers: getAuthHeaders() }
      );

      await loadSolicitacoes();
      setShowModal(false);
      resetSolicitacaoForm();
    } catch (error) {
      console.error('Erro ao criar solicitação:', error?.response?.data || error);
    }
  };

  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingActivity(true);

      await axios.post(
        buildApiUrl('/activities-simple'),
        {
          type: activityForm.type,
          subject: activityForm.subject,
          priority: activityForm.priority,
          dueDate: activityForm.dueDate || null,
          companyId: activityForm.companyId || '',
          opportunityId: activityForm.opportunityId || '',
          description: addFlowMetadataToDescription(activityForm.description, {
            sourceArea: 'PRE_VENDAS',
            targetArea: activityForm.targetArea,
            createdFrom: 'PRE_VENDAS',
            createdByName: getCurrentUserName()
          })
        },
        { headers: getAuthHeaders() }
      );

      setShowActivityModal(false);
      resetActivityForm();
      loadPreSalesActivities();
    } catch (error) {
      console.error('Erro ao criar atividade no Pré-Vendas:', error);
    } finally {
      setSavingActivity(false);
    }
  };

  const updateActivityStatus = async (id, status) => {
    try {
      await axios.put(
        buildApiUrl('/activities-simple'),
        { id, status },
        { headers: getAuthHeaders() }
      );
      loadPreSalesActivities();
    } catch (error) {
      console.error('Erro ao atualizar atividade:', error);
    }
  };

  const handleTipoPrecificacao = (tipo) => {
    setFormData((prev) => ({
      ...prev,
      tiposPrecificacao: prev.tiposPrecificacao.includes(tipo)
        ? prev.tiposPrecificacao.filter((item) => item !== tipo)
        : [...prev.tiposPrecificacao, tipo]
    }));
  };

  const getSolicitacaoStatusColor = (status) => {
    const colors = {
      NOVA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      EM_PRECIFICACAO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      AGUARDANDO_APROVACAO: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      FINALIZADA: 'bg-green-500/20 text-green-400 border-green-500/30',
      CANCELADA: 'bg-red-500/20 text-red-400 border-red-500/30',
      REJEITADA: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || colors.NOVA;
  };

  const getSolicitacaoStatusLabel = (status) => {
    const labels = {
      NOVA: 'Nova',
      EM_PRECIFICACAO: 'Em Precificação',
      AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
      FINALIZADA: 'Finalizada',
      CANCELADA: 'Cancelada',
      REJEITADA: 'Rejeitada'
    };
    return labels[status] || status;
  };

  const getPrioridadeColor = (prioridade) => {
    const colors = {
      BAIXA: 'text-green-400',
      LOW: 'text-green-400',
      MEDIA: 'text-yellow-400',
      MEDIUM: 'text-yellow-400',
      ALTA: 'text-red-400',
      HIGH: 'text-red-400',
      URGENT: 'text-red-300'
    };
    return colors[prioridade] || colors.MEDIUM;
  };

  const solicitacaoStats = [
    {
      title: 'Novas Solicitações',
      value: solicitacoes.filter((item) => item.status === 'NOVA').length,
      subtitle: 'Demandas recentes',
      icon: Plus,
      colorTheme: 'orange'
    },
    {
      title: 'Em Precificação',
      value: solicitacoes.filter((item) => item.status === 'EM_PRECIFICACAO').length,
      subtitle: 'Em andamento',
      icon: Clock,
      colorTheme: 'cyan'
    },
    {
      title: 'Aguardando Aprovação',
      value: solicitacoes.filter((item) => item.status === 'AGUARDANDO_APROVACAO').length,
      subtitle: 'Pendentes de retorno',
      icon: AlertCircle,
      colorTheme: 'yellow'
    },
    {
      title: 'Finalizadas',
      value: solicitacoes.filter((item) => item.status === 'FINALIZADA').length,
      subtitle: 'No mês atual',
      icon: CheckCircle,
      colorTheme: 'green'
    }
  ];

  const activityStats = useMemo(() => {
    const received = activities.filter((item) => item?.flow?.targetArea === 'PRE_VENDAS').length;
    const sent = activities.filter((item) => item?.flow?.sourceArea === 'PRE_VENDAS' && item?.flow?.targetArea !== 'PRE_VENDAS').length;
    const pending = activities.filter((item) => item.status === 'PENDING').length;
    const completed = activities.filter((item) => item.status === 'COMPLETED').length;
    return { received, sent, pending, completed };
  }, [activities]);

  const registroStats = useMemo(() => {
    const total = registroOportunidades.length;
    const abertas = registroOportunidades.filter((item) =>
      ['ABERTA', 'EM_ANALISE', 'EM_COTACAO', 'PRECIFICADA'].includes(String(item?.status || '').toUpperCase())
    ).length;
    const ganhas = registroOportunidades.filter((item) => String(item?.status || '').toUpperCase() === 'GANHA').length;
    const valorPotencial = registroOportunidades.reduce((acc, item) => acc + Number(item?.valorEstimado || 0), 0);
    const b2g = registroOportunidades.filter((item) => String(item?.origem || '').toUpperCase() === 'B2G').length;
    return { total, abertas, ganhas, valorPotencial, b2g };
  }, [registroOportunidades]);

  const registroExpiring = useMemo(() => {
    const now = new Date();
    const days = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
    const buckets = { expired: [], within7: [], within15: [], within30: [] };
    registroOportunidades.forEach((item) => {
      if (!item.dataValidade) return;
      const val = new Date(item.dataValidade);
      if (!Number.isFinite(val.getTime())) return;
      if (val < now) { buckets.expired.push(item); return; }
      if (val <= days(7)) { buckets.within7.push(item); return; }
      if (val <= days(15)) { buckets.within15.push(item); return; }
      if (val <= days(30)) { buckets.within30.push(item); return; }
    });
    return buckets;
  }, [registroOportunidades]);

  const pocStats = useMemo(() => {
    const finalStatuses = new Set(['APROVADA', 'DESCARTADA']);
    const inProgressStatuses = new Set(['PLANEJAMENTO', 'EM_ANDAMENTO', 'VALIDACAO']);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const andamento = pocs.filter((item) => inProgressStatuses.has(String(item.status || '').toUpperCase())).length;
    const bloqueadas = pocs.filter((item) => String(item.status || '').toUpperCase() === 'BLOQUEADA').length;
    const aprovadas = pocs.filter((item) => String(item.status || '').toUpperCase() === 'APROVADA').length;
    const atrasadas = pocs.filter((item) => {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (!dueDate || Number.isNaN(dueDate.getTime())) return false;
      return dueDate < today && !finalStatuses.has(String(item.status || '').toUpperCase());
    }).length;

    return { total: pocs.length, andamento, bloqueadas, aprovadas, atrasadas };
  }, [pocs]);

  const recentPocs = useMemo(() => (
    [...pocs]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .slice(0, 5)
  ), [pocs]);

  const orcamentoStats = useMemo(() => {
    const emOrcamento = solicitacoes.filter((item) => ['NOVA', 'EM_PRECIFICACAO', 'AGUARDANDO_APROVACAO'].includes(item.status)).length;
    const comValor = solicitacoes.filter((item) => Number(item.valorSugerido || item.custoTotal || 0) > 0).length;
    const valorTotal = solicitacoes.reduce((sum, item) => sum + Number(item.valorSugerido || item.custoTotal || 0), 0);
    return { total: solicitacoes.length, emOrcamento, comValor, valorTotal };
  }, [solicitacoes]);

  const recentOrcamentos = useMemo(() => (
    [...solicitacoes]
      .sort((a, b) => new Date(b.dataCreated || 0).getTime() - new Date(a.dataCreated || 0).getTime())
      .slice(0, 6)
  ), [solicitacoes]);

  const cadastrosStats = useMemo(() => {
    const ativosDistribuidores = distribuidores.filter((item) => item.ativo !== false && item.status !== 'INATIVO').length;
    const ativosFornecedores = fornecedores.filter((item) => item.ativo !== false && item.status !== 'INATIVO').length;
    return {
      distribuidores: distribuidores.length,
      fornecedores: fornecedores.length,
      ativosDistribuidores,
      ativosFornecedores
    };
  }, [distribuidores, fornecedores]);

  const registroStatusChartData = useMemo(() => {
    const statusOrder = ['ABERTA', 'EM_ANALISE', 'EM_COTACAO', 'PRECIFICADA', 'DEVOLVIDA', 'GANHA', 'PERDIDA'];
    const statusLabels = {
      ABERTA: 'Aberta',
      EM_ANALISE: 'Em análise',
      EM_COTACAO: 'Em cotação',
      PRECIFICADA: 'Precificada',
      DEVOLVIDA: 'Devolvida',
      GANHA: 'Ganha',
      PERDIDA: 'Perdida'
    };
    const counts = statusOrder.map((status) =>
      registroOportunidades.filter((item) => String(item?.status || '').toUpperCase() === status).length
    );

    return {
      labels: statusOrder.map((status) => statusLabels[status]),
      datasets: [
        {
          label: 'Oportunidades',
          data: counts,
          backgroundColor: [
            '#ff7a00',
            '#f6b40b',
            '#f6b40b',
            '#1f7fe5',
            '#18c8df',
            '#34d399',
            '#fb7185'
          ],
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    };
  }, [registroOportunidades]);

  const registroOrigemChartData = useMemo(() => {
    const origemOrder = ['B2B', 'B2G', 'COMERCIAL', 'PRE_VENDAS', 'OUTROS'];
    const labels = {
      B2B: 'B2B',
      B2G: 'B2G',
      COMERCIAL: 'Comercial',
      PRE_VENDAS: 'Pré-vendas',
      OUTROS: 'Outros'
    };

    const counts = origemOrder.map((origem) => {
      if (origem === 'OUTROS') {
        return registroOportunidades.filter((item) => {
          const normalized = String(item?.origem || '').toUpperCase();
          return !['B2B', 'B2G', 'COMERCIAL', 'PRE_VENDAS'].includes(normalized);
        }).length;
      }
      return registroOportunidades.filter((item) => String(item?.origem || '').toUpperCase() === origem).length;
    });

    return {
      labels: origemOrder.map((origem) => labels[origem]),
      datasets: [
        {
          data: counts,
          backgroundColor: ['#ff7a00', '#22c55e', '#f6b40b', '#1f7fe5', '#64748b'],
          borderColor: ['#ff7a00', '#22c55e', '#f6b40b', '#1f7fe5', '#64748b'],
          borderWidth: 1
        }
      ]
    };
  }, [registroOportunidades]);

  const registroModalidadeChartData = useMemo(() => {
    const labels = ['Venda', 'Locação', 'Serviços', 'Projeto', 'Outros'];
    const modalities = ['VENDA', 'LOCACAO', 'SERVICOS', 'PROJETO', 'OUTROS'];

    const sums = modalities.map((modality) => {
      if (modality === 'OUTROS') {
        return registroOportunidades
          .filter((item) => {
            const normalized = String(item?.modalidade || '').toUpperCase();
            return !['VENDA', 'LOCACAO', 'SERVICOS', 'PROJETO'].includes(normalized);
          })
          .reduce((acc, item) => acc + Number(item?.valorEstimado || 0), 0);
      }
      return registroOportunidades
        .filter((item) => String(item?.modalidade || '').toUpperCase() === modality)
        .reduce((acc, item) => acc + Number(item?.valorEstimado || 0), 0);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Valor estimado (R$)',
          data: sums,
          backgroundColor: '#18c8df',
          borderColor: '#18c8df',
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    };
  }, [registroOportunidades]);

  const registroEvolucaoChartData = useMemo(() => {
    const buckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: `${monthsShort[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`
      };
    });

    const grouped = new Map(buckets.map((item) => [item.key, { total: 0, value: 0 }]));
    registroOportunidades.forEach((item) => {
      const createdAt = item?.createdAt ? new Date(item.createdAt) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      const bucket = grouped.get(key);
      if (!bucket) return;
      bucket.total += 1;
      bucket.value += Number(item?.valorEstimado || 0);
    });

    return {
      labels: buckets.map((item) => item.label),
      datasets: [
        {
          label: 'Qtd. registros',
          data: buckets.map((item) => grouped.get(item.key)?.total || 0),
          borderColor: '#ff7a00',
          backgroundColor: 'rgba(255, 122, 0, 0.22)',
          fill: true,
          tension: 0.35,
          pointRadius: 3
        },
        {
          label: 'Valor estimado (R$ mil)',
          data: buckets.map((item) => Math.round((grouped.get(item.key)?.value || 0) / 1000)),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.18)',
          fill: true,
          tension: 0.35,
          pointRadius: 3
        }
      ]
    };
  }, [registroOportunidades]);

  const filteredSolicitacoes = solicitacoes.filter((solicitacao) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = String(solicitacao.titulo || '').toLowerCase().includes(term)
      || String(solicitacao.numero || '').toLowerCase().includes(term)
      || String(solicitacao.descricao || '').toLowerCase().includes(term);
    const matchesFilter = filterStatus === 'all' || solicitacao.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (activityStatusFilter !== 'all' && activity.status !== activityStatusFilter) return false;
      if (!activitySearch.trim()) return true;

      const text = [
        activity.subject,
        activity.description,
        activity.company?.name,
        activity.opportunity?.title,
        getAreaLabel(activity?.flow?.sourceArea),
        getAreaLabel(activity?.flow?.targetArea)
      ].filter(Boolean).join(' ').toLowerCase();

      return text.includes(activitySearch.toLowerCase());
    });
  }, [activities, activitySearch, activityStatusFilter]);

  const handlePresentation = async () => {
    if (typeof document === 'undefined') return;

    try {
      if (document.fullscreenElement === presentationRef.current) {
        await document.exitFullscreen();
      } else {
        presentationRef.current?.scrollTo({ top: 0, behavior: 'auto' });
        await presentationRef.current?.requestFullscreen();
      }
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const syncPresentationMode = () => {
      setPresentationMode(document.fullscreenElement === presentationRef.current);
    };

    document.addEventListener('fullscreenchange', syncPresentationMode);
    syncPresentationMode();

    return () => document.removeEventListener('fullscreenchange', syncPresentationMode);
  }, []);

  const getPresentationSteps = () => {
    const container = presentationRef.current;
    if (!container) return [];

    return Array.from(container.children).filter(
      (child) =>
        child instanceof HTMLElement &&
        child.dataset.presentationControls !== 'true' &&
        child.offsetHeight > 40
    );
  };

  const resolveCurrentStepIndex = (steps, container) => {
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

  const updatePresentationProgress = () => {
    const container = presentationRef.current;
    if (!container) return;

    const steps = getPresentationSteps();
    if (steps.length === 0) {
      setPresentationProgress({ current: 1, total: 1 });
      return;
    }

    const currentIndex = resolveCurrentStepIndex(steps, container);
    const next = { current: currentIndex + 1, total: steps.length };

    setPresentationProgress((prev) => (
      prev.current === next.current && prev.total === next.total ? prev : next
    ));
  };

  const scrollPresentationStep = (direction) => {
    const container = presentationRef.current;
    if (!container) return;

    const steps = getPresentationSteps();

    if (steps.length === 0) {
      container.scrollBy({ top: direction * container.clientHeight * 0.85, behavior: 'smooth' });
      return;
    }

    const currentIndex = resolveCurrentStepIndex(steps, container);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = Math.min(Math.max(baseIndex + direction, 0), steps.length - 1);

    const target = steps[nextIndex];
    if (!target) return;

    const top = Math.max(target.offsetTop - 12, 0);
    container.scrollTo({ top, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!presentationMode) return undefined;

    const container = presentationRef.current;
    if (!container) return undefined;

    const sync = () => updatePresentationProgress();
    const raf = requestAnimationFrame(sync);

    container.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [presentationMode]);

  useEffect(() => {
    if (!presentationMode) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        scrollPresentationStep(1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        scrollPresentationStep(-1);
      } else if (event.key === 'Escape') {
        handlePresentation();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [presentationMode]);

  const headerActions = activeMenu === 'solicitacoes'
    ? [
      {
        label: 'Apresentação',
        onClick: handlePresentation,
        icon: Maximize2,
        variant: 'secondary'
      },
      {
        label: 'Nova Solicitação',
        onClick: () => setShowModal(true),
        icon: Plus,
        variant: 'primary'
      }
    ]
    : [
      {
        label: 'Apresentação',
        onClick: handlePresentation,
        icon: Maximize2,
        variant: 'secondary'
      },
      {
        label: 'Nova Atividade',
        onClick: () => setShowActivityModal(true),
        icon: Plus,
        variant: 'primary'
      }
    ];

  const preSalesQuickFilters = [
    {
      key: 'solicitacoes',
      label: 'Solicitações',
      description: 'Controle de pedidos de Precificação/Rateio',
      icon: FileText,
      active: activeMenu === 'solicitacoes',
      onClick: () => setActiveMenu('solicitacoes')
    },
    {
      key: 'atividades',
      label: 'Atividades',
      description: 'Recebidas do Comercial e enviadas pelo Pré-Vendas',
      icon: CalendarCheck2,
      active: activeMenu === 'atividades',
      onClick: () => setActiveMenu('atividades')
    },
    {
      key: 'orcamentos',
      label: 'Orçamentos',
      description: 'Cotações registradas no fluxo',
      icon: BadgeDollarSign,
      active: activeMenu === 'orcamentos',
      onClick: () => setActiveMenu('orcamentos')
    },
    {
      key: 'distribuidores',
      label: 'Distribuidores',
      description: 'Base homologada de distribuidores',
      icon: Network,
      active: activeMenu === 'distribuidores',
      onClick: () => setActiveMenu('distribuidores')
    },
    {
      key: 'fornecedores',
      label: 'Fornecedores',
      description: 'Base homologada de fornecedores',
      icon: Package,
      active: activeMenu === 'fornecedores',
      onClick: () => setActiveMenu('fornecedores')
    },
    {
      key: 'registro-oportunidades',
      label: 'Registro de Oportunidades',
      description: 'Registro técnico do Pré-Vendas',
      icon: Radar,
      active: activeMenu === 'registro-oportunidades',
      onClick: () => setActiveMenu('registro-oportunidades')
    },
    {
      key: 'gestao-pocs',
      label: 'Gestão de POCs',
      description: 'Planejamento e validação técnica',
      icon: Beaker,
      active: activeMenu === 'gestao-pocs',
      onClick: () => setActiveMenu('gestao-pocs')
    }
  ];

  return (
    <div className="space-y-6">
      <div
        ref={presentationRef}
        className={[
          'p-6 space-y-4',
          presentationMode ? 'h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[#041a38] pb-28' : ''
        ].join(' ')}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {preSalesQuickFilters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={filter.onClick}
                className={`min-h-[86px] rounded-xl border px-4 py-3 text-left transition-colors ${
                  filter.active
                    ? 'border-orange-400/70 bg-orange-500/16 text-white shadow-[0_0_0_1px_rgba(255,122,0,0.18),0_18px_44px_rgba(255,122,0,0.10)]'
                    : 'border-gray-600/50 bg-gray-800/40 text-gray-300 hover:border-cyan-400/45 hover:bg-gray-700/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${filter.active ? 'text-orange-200' : 'text-cyan-200'}`} />
                  <span className="text-sm font-semibold">{filter.label}</span>
                </div>
                <p className="mt-1 text-xs leading-snug text-gray-300">{filter.description}</p>
              </button>
            );
          })}
        </div>

        {activeMenu === 'solicitacoes' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {solicitacaoStats.map((stat) => (
                <DashboardKPICard key={stat.title} {...stat} size="compact" />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardKPICard title="Registro de Oportunidades" value={registroStats.total} subtitle="Base técnica do Pré-Vendas" icon={Package} colorTheme="orange" size="compact" />
              <DashboardKPICard title="Em Aberto" value={registroStats.abertas} subtitle="Aguardando execução/comercial" icon={Clock} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="Ganhas" value={registroStats.ganhas} subtitle="Oportunidades convertidas" icon={CheckCircle} colorTheme="green" size="compact" />
              <DashboardKPICard title="Valor Potencial" value={`R$ ${registroStats.valorPotencial.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} subtitle={`${registroStats.b2g} item(ns) origem B2G`} icon={DollarSign} colorTheme="yellow" size="compact" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardKPICard title="POCs Totais" value={pocStats.total} subtitle="Provas de conceito registradas" icon={Beaker} colorTheme="orange" size="compact" />
              <DashboardKPICard title="POCs em Andamento" value={pocStats.andamento} subtitle="Planejamento, execução ou validação" icon={RefreshCcw} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="POCs Bloqueadas" value={pocStats.bloqueadas} subtitle={`${pocStats.atrasadas} atrasada(s)`} icon={AlertCircle} colorTheme="yellow" size="compact" />
              <DashboardKPICard title="POCs Aprovadas" value={pocStats.aprovadas} subtitle="Validadas com decisão registrada" icon={CheckCircle} colorTheme="green" size="compact" />
            </div>

            <div className="crm-card rounded-lg p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Gestão de POCs</h3>
                  <p className="text-sm text-slate-300">Acompanhamento das provas de conceito vinculadas ao fluxo de Pré-Vendas.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadPocs}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/30"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Atualizar POCs
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/gestao-pocs')}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/30"
                  >
                    <Beaker className="w-3.5 h-3.5" />
                    Abrir POCs
                  </button>
                </div>
              </div>
              {pocsLoading ? (
                <p className="mt-4 text-sm text-slate-400">Carregando POCs...</p>
              ) : recentPocs.length > 0 ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {recentPocs.map((poc) => (
                    <button
                      key={poc.id}
                      type="button"
                      onClick={() => navigate('/gestao-pocs')}
                      className="rounded-lg border border-slate-600/40 bg-slate-800/45 p-4 text-left transition-colors hover:bg-slate-700/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{poc.title}</p>
                          <p className="mt-1 truncate text-xs text-slate-300">{poc.client} · {poc.solution}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200">
                          {String(poc.status || 'PLANEJAMENTO').replaceAll('_', ' ')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Nenhuma POC registrada ainda.</p>
              )}
            </div>

            {(registroExpiring.within7.length > 0 || registroExpiring.within15.length > 0 || registroExpiring.within30.length > 0 || registroExpiring.expired.length > 0) && (
              <div
                onClick={() => navigate('/prevendas-registro-oportunidades')}
                className="crm-card rounded-lg p-4 border-l-4 border-l-rose-500 cursor-pointer hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-rose-200">Alertas de Vencimento</p>
                    {registroExpiring.within7.length > 0 && (
                      <p className="text-xs text-rose-300 mt-1">
                        {registroExpiring.within7.length} oportunidade(es) vence(m) em até 7 dias.
                      </p>
                    )}
                    {registroExpiring.within15.length > 0 && (
                      <p className="text-xs text-amber-300 mt-0.5">
                        {registroExpiring.within15.length} oportunidade(es) vence(m) em até 15 dias.
                      </p>
                    )}
                    {registroExpiring.within30.length > 0 && (
                      <p className="text-xs text-yellow-300 mt-0.5">
                        {registroExpiring.within30.length} oportunidade(es) vence(m) em até 30 dias.
                      </p>
                    )}
                    {registroExpiring.expired.length > 0 && (
                      <p className="text-xs text-rose-300 mt-0.5">
                        {registroExpiring.expired.length} oportunidade(es) vencida(s). Renove ou arquive.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="crm-card rounded-lg p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Dashboard do Registro de Oportunidades</h3>
                  <p className="text-sm text-slate-300">
                    Monitoramento por status, origem, modalidade e evolução mensal do Pré-Vendas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadRegistroOportunidades}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/30"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Atualizar Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/prevendas-registro-oportunidades')}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/30"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Abrir Registro
                  </button>
                </div>
              </div>
            </div>

            {registroLoading ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                  <p className="text-slate-300 mt-2">Carregando dados do registro de oportunidades...</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="crm-card rounded-lg p-5">
                  <h3 className="text-base font-semibold text-white mb-1">Status das Oportunidades</h3>
                  <p className="text-xs text-slate-400 mb-4">Visão de volume por etapa operacional.</p>
                  <div className="h-72">
                    <Bar
                      data={registroStatusChartData}
                      options={{
                        ...CHART_OPTIONS,
                        plugins: {
                          ...CHART_OPTIONS.plugins,
                          legend: { display: false }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="crm-card rounded-lg p-5">
                  <h3 className="text-base font-semibold text-white mb-1">Origem das Demandas</h3>
                  <p className="text-xs text-slate-400 mb-4">Distribuição entre B2B, B2G e demais origens.</p>
                  <div className="h-72">
                    <Doughnut data={registroOrigemChartData} options={DOUGHNUT_OPTIONS} />
                  </div>
                </div>

                <div className="crm-card rounded-lg p-5">
                  <h3 className="text-base font-semibold text-white mb-1">Valor por Modalidade</h3>
                  <p className="text-xs text-slate-400 mb-4">Concentração de valor estimado por tipo de projeto.</p>
                  <div className="h-72">
                    <Bar
                      data={registroModalidadeChartData}
                      options={{
                        ...CHART_OPTIONS,
                        plugins: {
                          ...CHART_OPTIONS.plugins,
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                const rawValue = typeof context.parsed === 'object'
                                  ? context.parsed.y
                                  : context.parsed;
                                const numeric = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0;
                                return ` ${numeric.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="crm-card rounded-lg p-5">
                  <h3 className="text-base font-semibold text-white mb-1">Evolução Mensal</h3>
                  <p className="text-xs text-slate-400 mb-4">Quantidade e valor (em R$ mil) dos últimos 6 meses.</p>
                  <div className="h-72">
                    <Line data={registroEvolucaoChartData} options={CHART_OPTIONS} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="crm-card rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setFilterStatus('EM_PRECIFICACAO')}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Solicitações Pendentes</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-200">Ver solicitações em precificação</p>
                  </div>
                </div>
              </div>
              <div className="crm-card rounded-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Visão Kanban</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-200">Fluxo de trabalho de precificação</p>
                  </div>
                </div>
              </div>
              <div className="crm-card rounded-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Relatórios</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-200">Análise de performance</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="crm-card rounded-lg p-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar solicitações..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="all">Todos os Status</option>
                  <option value="NOVA">Novas</option>
                  <option value="EM_PRECIFICACAO">Em Precificação</option>
                  <option value="AGUARDANDO_APROVACAO">Aguardando Aprovação</option>
                  <option value="FINALIZADA">Finalizadas</option>
                  <option value="REJEITADA">Rejeitadas</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Solicitações Recentes</h3>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                  <p className="text-slate-300 mt-2">Carregando...</p>
                </div>
              ) : filteredSolicitacoes.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-300">Nenhuma solicitação encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSolicitacoes.map((solicitacao) => (
                    <div
                      key={solicitacao.id}
                      className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-4 hover:bg-gray-700/50 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-mono text-blue-400">{solicitacao.numero}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSolicitacaoStatusColor(solicitacao.status)}`}>
                              {getSolicitacaoStatusLabel(solicitacao.status)}
                            </span>
                            <span className={`text-xs font-medium ${getPrioridadeColor(solicitacao.prioridade)}`}>
                              {toPriorityLabel(solicitacao.prioridade)}
                            </span>
                          </div>
                          <h4 className="text-white font-medium mb-1">{solicitacao.titulo}</h4>
                          <p className="text-slate-300 text-sm mb-2">{solicitacao.descricao}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span>Solicitado por {solicitacao.solicitadoPor}</span>
                            <span>•</span>
                            <span>{solicitacao.dataCreated ? new Date(solicitacao.dataCreated).toLocaleDateString('pt-BR') : '-'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              setSelectedSolicitacao(solicitacao);
                              setShowViewModal(true);
                            }}
                            className="p-2 text-slate-300 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSolicitacao(solicitacao);
                              setShowModal(true);
                            }}
                            className="p-2 text-slate-300 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSolicitacao(solicitacao.id)}
                            className="p-2 text-slate-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeMenu === 'orcamentos' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardKPICard title="Solicitações" value={orcamentoStats.total} subtitle="Base para orçamento" icon={FileText} colorTheme="orange" size="compact" />
              <DashboardKPICard title="Em Orçamento" value={orcamentoStats.emOrcamento} subtitle="Aguardando cotação/precificação" icon={Clock} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="Com Valor" value={orcamentoStats.comValor} subtitle="Cotações com valor registrado" icon={BadgeDollarSign} colorTheme="green" size="compact" />
              <DashboardKPICard title="Valor Orçado" value={`R$ ${orcamentoStats.valorTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} subtitle="Somatório estimado" icon={DollarSign} colorTheme="yellow" size="compact" />
            </div>

            <div className="crm-card rounded-lg p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Fila de Orçamentos</h3>
                  <p className="text-sm text-slate-400">Solicitações e cotações acompanhadas no fluxo de Pré-Vendas.</p>
                </div>
                <button
                  type="button"
                  onClick={loadSolicitacoes}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/30"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Atualizar
                </button>
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm text-slate-400">Carregando orçamentos...</p>
              ) : recentOrcamentos.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Nenhum orçamento registrado ainda.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {recentOrcamentos.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-700/50 bg-slate-900/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{item.titulo || item.numero || 'Orçamento sem título'}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.descricao || 'Sem descrição registrada.'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${getSolicitacaoStatusColor(item.status)}`}>
                          {getSolicitacaoStatusLabel(item.status)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>{item.solicitadoPor || 'Usuário'}</span>
                        <span>{item.dataCreated ? new Date(item.dataCreated).toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="text-amber-200">R$ {Number(item.valorSugerido || item.custoTotal || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeMenu === 'distribuidores' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardKPICard title="Distribuidores" value={cadastrosStats.distribuidores} subtitle="Cadastrados" icon={Network} colorTheme="orange" size="compact" />
              <DashboardKPICard title="Ativos" value={cadastrosStats.ativosDistribuidores} subtitle="Disponíveis para cotação" icon={CheckCircle} colorTheme="green" size="compact" />
              <DashboardKPICard title="Fornecedores" value={cadastrosStats.fornecedores} subtitle="Base complementar" icon={Package} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="Oportunidades" value={registroStats.total} subtitle="Vinculadas ao Pré-Vendas" icon={Radar} colorTheme="yellow" size="compact" />
            </div>

            <div className="crm-card rounded-lg p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">Distribuidores Homologados</h3>
                  <p className="text-sm text-slate-400">Consulta rápida da base para cotações.</p>
                </div>
                <button type="button" onClick={loadPrevendasCadastros} className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/30 transition-colors">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Atualizar
                </button>
              </div>
              {cadastrosLoading ? (
                <p className="py-8 text-center text-sm text-slate-400">Carregando distribuidores...</p>
              ) : distribuidores.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Nenhum distribuidor cadastrado.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {distribuidores.slice(0, 9).map((item) => (
                    <PartnerRegistryCard key={item.id || item.nome} item={item} type="distributor" />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeMenu === 'fornecedores' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardKPICard title="Fornecedores" value={cadastrosStats.fornecedores} subtitle="Cadastrados" icon={Package} colorTheme="orange" size="compact" />
              <DashboardKPICard title="Ativos" value={cadastrosStats.ativosFornecedores} subtitle="Disponíveis" icon={CheckCircle} colorTheme="green" size="compact" />
              <DashboardKPICard title="Distribuidores" value={cadastrosStats.distribuidores} subtitle="Base parceira" icon={Network} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="Em Aberto" value={registroStats.abertas} subtitle="Demandas técnicas" icon={Clock} colorTheme="yellow" size="compact" />
            </div>

            <div className="crm-card rounded-lg p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">Fornecedores Homologados</h3>
                  <p className="text-sm text-slate-400">Consulta rápida da base técnica e comercial.</p>
                </div>
                <button type="button" onClick={loadPrevendasCadastros} className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/30 transition-colors">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Atualizar
                </button>
              </div>
              {cadastrosLoading ? (
                <p className="py-8 text-center text-sm text-slate-400">Carregando fornecedores...</p>
              ) : fornecedores.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Nenhum fornecedor cadastrado.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {fornecedores.slice(0, 9).map((item) => (
                    <PartnerRegistryCard key={item.id || item.nome} item={item} type="supplier" />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeMenu === 'registro-oportunidades' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardKPICard title="Registro de Oportunidades" value={registroStats.total} subtitle="Base técnica do Pré-Vendas" icon={Radar} colorTheme="orange" size="compact" />
              <DashboardKPICard title="Em Aberto" value={registroStats.abertas} subtitle="Aguardando execução/comercial" icon={Clock} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="Ganhas" value={registroStats.ganhas} subtitle="Oportunidades convertidas" icon={CheckCircle} colorTheme="green" size="compact" />
              <DashboardKPICard title="Valor Potencial" value={`R$ ${registroStats.valorPotencial.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} subtitle={`${registroStats.b2g} item(ns) origem B2G`} icon={DollarSign} colorTheme="yellow" size="compact" />
            </div>

            {registroLoading ? (
              <div className="crm-card rounded-lg p-8 text-center text-sm text-slate-400">Carregando registro de oportunidades...</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="crm-card rounded-lg p-5">
                  <h3 className="text-base font-semibold text-white mb-1">Status das Oportunidades</h3>
                  <p className="text-xs text-slate-400 mb-4">Visão de volume por etapa operacional.</p>
                  <div className="h-72">
                    <Bar data={registroStatusChartData} options={{ ...CHART_OPTIONS, plugins: { ...CHART_OPTIONS.plugins, legend: { display: false } } }} />
                  </div>
                </div>
                <div className="crm-card rounded-lg p-5">
                  <h3 className="text-base font-semibold text-white mb-1">Origem das Demandas</h3>
                  <p className="text-xs text-slate-400 mb-4">Distribuição entre B2B, B2G e demais origens.</p>
                  <div className="h-72">
                    <Doughnut data={registroOrigemChartData} options={DOUGHNUT_OPTIONS} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeMenu === 'gestao-pocs' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardKPICard title="POCs Totais" value={pocStats.total} subtitle="Provas de conceito registradas" icon={Beaker} colorTheme="orange" size="compact" />
              <DashboardKPICard title="POCs em Andamento" value={pocStats.andamento} subtitle="Planejamento, execução ou validação" icon={RefreshCcw} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="POCs Bloqueadas" value={pocStats.bloqueadas} subtitle={`${pocStats.atrasadas} atrasada(s)`} icon={AlertCircle} colorTheme="yellow" size="compact" />
              <DashboardKPICard title="POCs Aprovadas" value={pocStats.aprovadas} subtitle="Validadas com decisão registrada" icon={CheckCircle} colorTheme="green" size="compact" />
            </div>

            <div className="crm-card rounded-lg p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">Gestão de POCs</h3>
                  <p className="text-sm text-slate-400">Acompanhamento das provas de conceito vinculadas ao fluxo de Pré-Vendas.</p>
                </div>
                <button type="button" onClick={loadPocs} className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/20 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/30">
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Atualizar
                </button>
              </div>
              {pocsLoading ? (
                <p className="py-8 text-center text-sm text-slate-400">Carregando POCs...</p>
              ) : recentPocs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Nenhuma POC registrada ainda.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {recentPocs.map((poc) => (
                    <div key={poc.id} className="rounded-lg border border-slate-700/50 bg-slate-900/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{poc.title}</p>
                          <p className="mt-1 truncate text-xs text-slate-400">{poc.client} · {poc.solution}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200">
                          {String(poc.status || 'PLANEJAMENTO').replaceAll('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeMenu === 'atividades' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DashboardKPICard title="Recebidas do Comercial" value={activityStats.received} subtitle="Destino Pré-Vendas" icon={CalendarCheck2} colorTheme="orange" size="compact" />
              <DashboardKPICard title="Enviadas pelo Pré-Vendas" value={activityStats.sent} subtitle="Encaminhamentos internos" icon={SendHorizontal} colorTheme="cyan" size="compact" />
              <DashboardKPICard title="Pendentes" value={activityStats.pending} subtitle="Aguardando ação" icon={Clock} colorTheme="yellow" size="compact" />
              <DashboardKPICard title="Concluídas" value={activityStats.completed} subtitle="Execução finalizada" icon={CheckCircle} colorTheme="green" size="compact" />
            </div>

            <div className="crm-card rounded-lg p-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar atividades por assunto, empresa ou área..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div className="flex gap-3">
                  <select
                    value={activityStatusFilter}
                    onChange={(e) => setActivityStatusFilter(e.target.value)}
                    className="px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="PENDING">Pendentes</option>
                    <option value="IN_PROGRESS">Em andamento</option>
                    <option value="COMPLETED">Concluídas</option>
                    <option value="CANCELLED">Canceladas</option>
                  </select>
                  <button
                    type="button"
                    onClick={loadPreSalesActivities}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Atualizar
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Atividades do Fluxo Pré-Vendas</h3>
              </div>

              {activitiesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                  <p className="text-slate-300 mt-2">Carregando atividades...</p>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarCheck2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-300">Nenhuma atividade no fluxo Pré-Vendas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((activity) => {
                    const statusMeta = STATUS_META[activity.status] || STATUS_META.PENDING;
                    const priorityMeta = PRIORITY_META[activity.priority] || PRIORITY_META.MEDIUM;
                    return (
                      <div
                        key={activity.id}
                        className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-4 hover:bg-gray-700/50 transition-all duration-200"
                      >
                        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusMeta.cls}`}>
                                {statusMeta.label}
                              </span>
                              <span className={`text-xs font-medium ${priorityMeta.cls}`}>{priorityMeta.label}</span>
                              <span className="text-xs px-2 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                                {getAreaLabel(activity?.flow?.sourceArea)} → {getAreaLabel(activity?.flow?.targetArea)}
                              </span>
                            </div>
                            <h4 className="text-white font-medium mb-1">{activity.subject}</h4>
                            <p className="text-slate-300 text-sm">{activity.description || 'Sem descrição'}</p>
                            <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-3">
                              <span>Empresa: {activity.company?.name || '-'}</span>
                              <span>Responsável: {activity.assignedTo?.name || '-'}</span>
                              <span>
                                Vencimento:{' '}
                                {activity.dueDate ? new Date(activity.dueDate).toLocaleString('pt-BR') : '-'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {activity.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => updateActivityStatus(activity.id, 'IN_PROGRESS')}
                                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs inline-flex items-center gap-1"
                              >
                                <RefreshCcw className="w-3 h-3" />
                                Iniciar
                              </button>
                            )}
                            {activity.status === 'IN_PROGRESS' && (
                              <button
                                type="button"
                                onClick={() => updateActivityStatus(activity.id, 'COMPLETED')}
                                className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs inline-flex items-center gap-1"
                              >
                                <CheckSquare className="w-3 h-3" />
                                Concluir
                              </button>
                            )}
                            {activity.status !== 'COMPLETED' && activity.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => updateActivityStatus(activity.id, 'CANCELLED')}
                                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs inline-flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <PresentationControls
          active={presentationMode}
          current={presentationProgress.current}
          total={presentationProgress.total}
          canPrevious={presentationProgress.current > 1}
          canNext={presentationProgress.current < presentationProgress.total}
          onPrevious={() => scrollPresentationStep(-1)}
          onNext={() => scrollPresentationStep(1)}
          onExit={handlePresentation}
        />
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetSolicitacaoForm();
        }}
        title="Nova Solicitação de Precificação"
        subtitle="Preencha os dados para solicitar uma precificação ao time técnico"
      >
        <form onSubmit={handleSolicitacaoSubmit} className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título da Solicitação *</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Ex: Solução de Automação Industrial - Cliente ABC"
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição Detalhada *</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descreva os requisitos, escopo, produtos/serviços envolvidos..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prioridade</label>
                  <select
                    value={formData.prioridade}
                    onChange={(e) => setFormData((prev) => ({ ...prev, prioridade: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Lead/Oportunidade (Opcional)</label>
                  <input
                    type="text"
                    value={formData.leadId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, leadId: e.target.value }))}
                    placeholder="ID do Lead ou Oportunidade"
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Tipos de Precificação Necessários *</label>
                <div className="space-y-3">
                  {[
                    { id: 'VENDA', label: 'Venda (Sales)', desc: 'Precificação baseada em custos, impostos e margem de lucro' },
                    { id: 'LOCACAO', label: 'Locação (MaaS/Rental)', desc: 'Cálculo de mensalidade baseado em depreciação e ROI' },
                    { id: 'SERVICOS', label: 'Serviços (Service/SaaS)', desc: 'Precificação por hora/homem e custos de projeto' }
                  ].map((tipo) => (
                    <label key={tipo.id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.tiposPrecificacao.includes(tipo.id)}
                        onChange={() => handleTipoPrecificacao(tipo.id)}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"
                      />
                      <div>
                        <div className="text-white font-medium">{tipo.label}</div>
                        <div className="text-gray-400 text-sm">{tipo.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  <h4 className="text-blue-400 font-medium">Informações Adicionais</h4>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Observações e Requisitos Especiais</label>
                <textarea
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prazo Esperado</label>
                  <input
                    type="date"
                    value={formData.prazoEsperado || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, prazoEsperado: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Orçamento Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.orcamentoEstimado || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, orcamentoEstimado: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6 border-t border-gray-600/30">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg"
              >
                Voltar
              </button>
            ) : <div />}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetSolicitacaoForm();
                }}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg"
              >
                Cancelar
              </button>
              {currentStep === 1 && formData.tiposPrecificacao.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                >
                  Próximo
                </button>
              ) : currentStep === 1 && formData.tiposPrecificacao.length === 0 ? (
                <button
                  type="button"
                  disabled
                  className="px-6 py-3 bg-gray-500/40 text-gray-300 font-medium rounded-lg cursor-not-allowed"
                >
                  Selecione um tipo de precificação
                </button>
              ) : (
                <button type="submit" className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg">
                  Criar Solicitação
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showActivityModal}
        onClose={() => {
          setShowActivityModal(false);
          resetActivityForm();
        }}
        title="Nova Atividade do Pré-Vendas"
        subtitle="Crie atividades para o Comercial, SDR, Diretoria Comercial e Gerente de Contas"
      >
        <form onSubmit={handleActivitySubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, type: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
              >
                <option value="TASK">Tarefa</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="CALL">Ligação</option>
                <option value="MEETING">Reunião</option>
                <option value="EMAIL">E-mail</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Prioridade</label>
              <select
                value={activityForm.priority}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Assunto *</label>
              <input
                required
                type="text"
                value={activityForm.subject}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
              <textarea
                rows={3}
                value={activityForm.description}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Destino</label>
              <select
                value={activityForm.targetArea}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, targetArea: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
              >
                <option value="COMERCIAL">Comercial</option>
                <option value="GERENTE_CONTAS">Gerente de Contas</option>
                <option value="SDR">SDR</option>
                <option value="DIRETORIA_COMERCIAL">Diretoria Comercial</option>
                <option value="PRE_VENDAS">Pré-Vendas</option>
              </select>
              {activityForm.targetArea === 'PRE_VENDAS' && (
                <p className="mt-1 text-xs text-blue-300">
                  Este envio será criado como solicitação no módulo Pre-Vendas &gt; Solicitações.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Vencimento</label>
              <input
                type="datetime-local"
                value={activityForm.dueDate}
                onChange={(e) => setActivityForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowActivityModal(false);
                resetActivityForm();
              }}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingActivity}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg inline-flex items-center gap-2"
            >
              <SendHorizontal className="w-4 h-4" />
              {savingActivity ? 'Enviando...' : 'Criar Atividade'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedSolicitacao?.titulo || 'Detalhes da Solicitação'}
        subtitle={`${selectedSolicitacao?.numero} - ${getSolicitacaoStatusLabel(selectedSolicitacao?.status)}`}
      >
        {selectedSolicitacao && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getSolicitacaoStatusColor(selectedSolicitacao.status)}`}>
                  {getSolicitacaoStatusLabel(selectedSolicitacao.status)}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Prioridade</label>
                <span className={`font-medium ${getPrioridadeColor(selectedSolicitacao.prioridade)}`}>
                  {toPriorityLabel(selectedSolicitacao.prioridade)}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
              <p className="text-white">{selectedSolicitacao.descricao}</p>
            </div>
            {selectedSolicitacao.valorSugerido > 0 && (
              <div className="bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Resultado da Precificação</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-blue-400">
                      R$ {selectedSolicitacao.valorSugerido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-gray-400 text-sm">Preço Sugerido</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      R$ {selectedSolicitacao.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-gray-400 text-sm">Custo Total</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-green-400">
                      {selectedSolicitacao.margemLucro.toFixed(1)}%
                    </div>
                    <div className="text-gray-400 text-sm">Margem</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
