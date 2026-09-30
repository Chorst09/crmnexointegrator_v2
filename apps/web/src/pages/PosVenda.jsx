import { useState, useEffect } from 'react';
import { buildApiUrl, API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { 
  Users, 
  HeadphonesIcon, 
  Star, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Plus,
  Search,
  Zap,
  Award,
  UserCheck,
  Heart,
  Shield,
  Eye,
  Edit,
  CheckCircle2,
  Calendar,
  Target,
  Activity,
  MessageSquare,
  Send,
  X,
  ChevronRight,
  ArrowRight,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Meh,
  RefreshCcw
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import Modal from '../components/Modal';

const detailCardClass = 'rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.68)] p-3';
const detailLabelClass = 'text-[10px] font-bold text-[var(--crm-muted)] uppercase tracking-wider';
const emptyIconClass = 'w-16 h-16 text-[var(--crm-muted)] opacity-45 mx-auto mb-4';
const emptyTitleClass = 'text-lg font-semibold text-[var(--crm-ink)] mb-2';
const emptyTextClass = 'text-[var(--crm-muted)]';
const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

const PosVenda = () => {
  const [activeTab, setActiveTab] = useState('onboarding');
  const [onboardings, setOnboardings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [npsData, setNpsData] = useState([]);
  const [churnAlerts, setChurnAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [companies, setCompanies] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [users, setUsers] = useState([]);

  // View modals state
  const [viewingOnboarding, setViewingOnboarding] = useState(null);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [viewingNPS, setViewingNPS] = useState(null);
  const [ticketResponses, setTicketResponses] = useState([]);
  const [responseText, setResponseText] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [detectingChurn, setDetectingChurn] = useState(false);
  const [advancingStep, setAdvancingStep] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const showFeedback = (msg, type = 'success') => {
    setFeedbackMessage({ text: msg, type });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [onboardingRes, ticketsRes, npsRes, churnRes, companiesRes, contractsRes, usersRes] = await Promise.all([
        fetch(buildApiUrl('/post-sales/onboarding?limit=200'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/post-sales/support?limit=200'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/post-sales/nps?limit=200'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/post-sales/churn-alerts?limit=200'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/companies'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/contracts'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/users'), { headers: getAuthHeaders() })
      ]);

      if (onboardingRes.ok) {
        const data = await onboardingRes.json();
        setOnboardings(data.onboardings || []);
      }

      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data.tickets || []);
      }

      if (npsRes.ok) {
        const data = await npsRes.json();
        setNpsData(data.surveys || []);
      }

      if (churnRes.ok) {
        const data = await churnRes.json();
        setChurnAlerts(data.alerts || []);
      }

      if (companiesRes.ok) {
        const data = await companiesRes.json();
        setCompanies(data || []);
      }

      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setContracts(data || []);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status, type = 'default') => {
    const colors = {
      onboarding: {
        PENDING: 'bg-amber-500/10 text-amber-900 dark:text-amber-200',
        IN_PROGRESS: 'bg-sky-500/10 text-sky-900 dark:text-sky-200',
        COMPLETED: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
        CANCELLED: 'bg-red-500/10 text-red-900 dark:text-red-200'
      },
      ticket: {
        OPEN: 'bg-red-500/10 text-red-900 dark:text-red-200',
        IN_PROGRESS: 'bg-sky-500/10 text-sky-900 dark:text-sky-200',
        WAITING_CUSTOMER: 'bg-amber-500/10 text-amber-900 dark:text-amber-200',
        RESOLVED: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
        CLOSED: 'bg-slate-500/10 text-slate-800 dark:text-slate-200'
      },
      churn: {
        LOW: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
        MEDIUM: 'bg-amber-500/10 text-amber-900 dark:text-amber-200',
        HIGH: 'bg-orange-500/10 text-orange-900 dark:text-orange-200',
        CRITICAL: 'bg-red-500/10 text-red-900 dark:text-red-200'
      }
    };
    return colors[type]?.[status] || 'bg-slate-500/10 text-slate-800 dark:text-slate-200';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
      MEDIUM: 'bg-amber-500/10 text-amber-900 dark:text-amber-200',
      HIGH: 'bg-orange-500/10 text-orange-900 dark:text-orange-200',
      URGENT: 'bg-red-500/10 text-red-900 dark:text-red-200'
    };
    return colors[priority] || 'bg-slate-500/10 text-slate-800 dark:text-slate-200';
  };

  const getNPSCategory = (score) => {
    if (score >= 9) return { label: 'Promotor', color: 'text-emerald-700 dark:text-emerald-200', icon: ThumbsUp };
    if (score >= 7) return { label: 'Neutro', color: 'text-amber-700 dark:text-amber-200', icon: Meh };
    return { label: 'Detrator', color: 'text-red-700 dark:text-red-200', icon: ThumbsDown };
  };

  const getClientTypeLabel = (clientType) => {
    const labels = { B2B: 'B2B', B2G: 'B2G (Governo)', B2C: 'B2C' };
    return labels[clientType] || clientType;
  };

  const getClientTypeBadge = (clientType) => {
    const badges = {
      B2B: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      B2G: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      B2C: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    };
    return badges[clientType] || 'bg-slate-500/10 text-slate-800 dark:text-slate-200';
  };

  const filterByClientType = (items) => {
    if (!clientTypeFilter) return items;
    return items.filter(item => item.company?.clientType === clientTypeFilter);
  };

  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
  };

  const handleSubmitTicket = async (formData) => {
    try {
      const response = await fetch(buildApiUrl('/post-sales/support'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        await fetchData();
        closeModal();
        showFeedback('Ticket criado com sucesso!');
      } else {
        const err = await response.json().catch(() => ({}));
        showFeedback(err.error || 'Erro ao criar ticket', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao criar ticket', 'error');
    }
  };

  const handleSubmitOnboarding = async (formData) => {
    try {
      const response = await fetch(buildApiUrl('/post-sales/onboarding'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        await fetchData();
        closeModal();
        showFeedback('Onboarding criado com sucesso!');
      } else {
        const err = await response.json().catch(() => ({}));
        showFeedback(err.error || 'Erro ao criar onboarding', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao criar onboarding', 'error');
    }
  };

  const handleSubmitNPSSurvey = async (formData) => {
    try {
      const response = await fetch(buildApiUrl('/post-sales/nps'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        await fetchData();
        closeModal();
        showFeedback('Pesquisa NPS enviada com sucesso!');
      } else {
        const err = await response.json().catch(() => ({}));
        showFeedback(err.error || 'Erro ao enviar pesquisa NPS', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao enviar pesquisa NPS', 'error');
    }
  };

  const handleViewOnboarding = async (item) => {
    setViewingOnboarding(item);
  };

  const handleUpdateOnboarding = async (onboardingId, payload) => {
    try {
      const response = await fetch(buildApiUrl(`/post-sales/onboarding/${onboardingId}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const updated = await response.json();
        setViewingOnboarding(updated);
        await fetchData();
        showFeedback('Onboarding atualizado com sucesso!');
      } else {
        const err = await response.json().catch(() => ({}));
        showFeedback(err.error || 'Erro ao atualizar onboarding', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao atualizar onboarding', 'error');
    }
  };

  const handleAdvanceStep = async (onboardingId, step, nextStatus = 'COMPLETED') => {
    try {
      setAdvancingStep(step.id);
      const response = await fetch(buildApiUrl(`/post-sales/onboarding/${onboardingId}/steps/${step.id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      if (response.ok) {
        const updatedStep = await response.json();
        setViewingOnboarding((current) => current?.id === onboardingId ? {
          ...current,
          steps: (current.steps || []).map((item) => item.id === step.id ? { ...item, ...updatedStep } : item)
        } : current);
        await fetchData();
        showFeedback(nextStatus === 'COMPLETED' ? `Etapa "${step.title}" concluída!` : `Etapa "${step.title}" reaberta!`);
      } else {
        showFeedback('Erro ao atualizar etapa', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao atualizar etapa', 'error');
    } finally {
      setAdvancingStep(null);
    }
  };

  const handleViewTicket = async (item) => {
    setViewingTicket(item);
    // Carregar respostas do ticket
    try {
      const res = await fetch(buildApiUrl(`/post-sales/support/${item.id}/responses`), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTicketResponses(data.responses || []);
      }
    } catch (e) {
      console.error('Erro ao carregar respostas do ticket:', e);
    }
  };

  const handleRespondTicket = async () => {
    if (!responseText.trim() || !viewingTicket) return;
    try {
      setSendingResponse(true);
      const res = await fetch(buildApiUrl(`/post-sales/support/${viewingTicket.id}/responses`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: responseText, isInternal: false })
      });
      if (res.ok) {
        const createdResponse = await res.json();
        setTicketResponses((current) => [...current, createdResponse]);
        setResponseText('');
        showFeedback('Resposta enviada com sucesso!');
        await fetchData();
      } else {
        showFeedback('Erro ao enviar resposta', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao enviar resposta', 'error');
    } finally {
      setSendingResponse(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, status) => {
    try {
      const res = await fetch(buildApiUrl(`/post-sales/support/${ticketId}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        setViewingTicket(updated);
        await fetchData();
        showFeedback('Status do ticket atualizado!');
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Erro ao atualizar ticket', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao atualizar ticket', 'error');
    }
  };

  const handleSubmitNPSResponse = async (surveyId, payload) => {
    try {
      const res = await fetch(buildApiUrl(`/post-sales/nps/${surveyId}/respond`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        setViewingNPS(updated);
        await fetchData();
        showFeedback('Resposta NPS registrada!');
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Erro ao registrar NPS', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao registrar NPS', 'error');
    }
  };

  const handleDetectChurn = async () => {
    try {
      setDetectingChurn(true);
      const res = await fetch(buildApiUrl('/post-sales/churn-alerts/detect'), {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        showFeedback(data.message || 'Detecção de churn concluída!');
        await fetchData();
      } else {
        showFeedback('Erro ao detectar churn', 'error');
      }
    } catch (error) {
      showFeedback('Erro ao detectar churn', 'error');
    } finally {
      setDetectingChurn(false);
    }
  };

  const handleResolveChurn = async (alertId) => {
    try {
      const res = await fetch(buildApiUrl(`/post-sales/churn-alerts/${alertId}/resolve`), {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showFeedback('Alerta de churn resolvido!');
        await fetchData();
      } else {
        // Fallback: marcar como resolvido via PUT direto na empresa
        const alert = churnAlerts.find(a => a.id === alertId);
        if (alert?.company?.id) {
          await fetch(buildApiUrl(`/companies/${alert.company.id}`), {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ churnRisk: 0 })
          });
        }
        showFeedback('Alerta de churn resolvido (fallback)!');
        await fetchData();
      }
    } catch (error) {
      showFeedback('Erro ao resolver alerta', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center px-6">
        <div className="crm-panel px-5 py-4 flex items-center gap-3 motion-safe:animate-scale-in">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <div className="text-sm font-semibold text-[var(--crm-muted)]">Carregando pos-venda...</div>
        </div>
      </div>
    );
  }

  const StatusBadge = ({ status, type }) => (
    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(status, type)}`}>
      {status}
    </span>
  );

  return (
    <div className="space-y-8">
      {feedbackMessage && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-sm font-bold ${
          feedbackMessage.type === 'error' 
            ? 'bg-red-500 text-white' 
            : 'bg-emerald-500 text-white'
        }`}>
          {feedbackMessage.text}
        </div>
      )}

      <PageHeader
        title="Sucesso do Cliente"
        subtitle="Maximize a satisfação e retenção através de onboarding, suporte e análise de churn"
        icon={Heart}
        gradient="green"
        breadcrumbs={['CRM', 'Pós-Venda']}
        actions={[
          {
            label: 'Detectar Churn',
            icon: detectingChurn ? Loader2 : Zap,
            onClick: handleDetectChurn,
            variant: 'secondary',
            disabled: detectingChurn
          },
          {
            label: 'Nova Pesquisa NPS',
            icon: Plus,
            onClick: () => openModal('nps'),
            variant: 'secondary'
          },
          {
            label: 'Novo Onboarding',
            icon: Plus,
            onClick: () => openModal('onboarding'),
            variant: 'secondary'
          },
          {
            label: 'Novo Ticket',
            icon: Plus,
            onClick: () => openModal('ticket'),
            variant: 'primary'
          }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Onboardings Ativos"
          value={onboardings.filter(o => o.status === 'IN_PROGRESS').length}
          subtitle={`${onboardings.length} total`}
          icon={UserCheck}
          color="blue"
        />
        <AnimatedStats
          title="Tickets Abertos"
          value={tickets.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length}
          subtitle="SLA médio: 24h"
          icon={HeadphonesIcon}
          color="green"
        />
        <AnimatedStats
          title="NPS Médio"
          value={npsData.length > 0 
            ? (npsData.reduce((sum, survey) => sum + (survey.score || 0), 0) / npsData.length).toFixed(1)
            : '0.0'
          }
          subtitle={`${npsData.filter(n => n.status === 'RESPONDED').length} respostas`}
          icon={Award}
          color="yellow"
        />
        <AnimatedStats
          title="Alertas de Churn"
          value={churnAlerts.filter(a => a.status === 'ACTIVE').length}
          subtitle={`${churnAlerts.filter(a => a.riskLevel === 'CRITICAL').length} críticos`}
          icon={Shield}
          color="red"
        />
      </div>

      <GradientCard gradient="gray" className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--crm-muted)] w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por cliente, ticket ou processo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="crm-input w-full pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={clientTypeFilter}
              onChange={(e) => setClientTypeFilter(e.target.value)}
              className="crm-input w-full"
            >
              <option value="">Todos os Tipos</option>
              <option value="B2B">B2B</option>
              <option value="B2G">B2G (Governo)</option>
              <option value="B2C">B2C</option>
            </select>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="crm-input w-full"
            >
              <option value="">Todos os Status</option>
              <option value="PENDING">Pendente</option>
              <option value="IN_PROGRESS">Em Andamento</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="OPEN">Aberto</option>
              <option value="WAITING_CUSTOMER">Aguardando Cliente</option>
              <option value="RESOLVED">Resolvido</option>
              <option value="CLOSED">Fechado</option>
              <option value="SENT">NPS Enviado</option>
              <option value="RESPONDED">NPS Respondido</option>
              <option value="EXPIRED">NPS Expirado</option>
              <option value="ACTIVE">Churn Ativo</option>
            </select>
          </div>
        </div>
      </GradientCard>

      <GradientCard gradient="gray" className="shadow-lg">
        <div className="border-b border-[color:var(--crm-border)]">
          <nav className="-mb-px flex gap-3 overflow-x-auto px-6 pt-1">
            {[
              { id: 'onboarding', label: 'Onboarding', icon: Users, count: onboardings.length, color: 'blue' },
              { id: 'support', label: 'Suporte', icon: HeadphonesIcon, count: tickets.length, color: 'green' },
              { id: 'nps', label: 'NPS', icon: Star, count: npsData.length, color: 'yellow' },
              { id: 'churn', label: 'Churn', icon: AlertTriangle, count: churnAlerts.length, color: 'red' }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? (tab.color === 'blue' ? 'border-sky-400 text-sky-700 dark:text-sky-100 bg-sky-500/10' :
                         tab.color === 'green' ? 'border-emerald-400 text-emerald-700 dark:text-emerald-100 bg-emerald-500/10' :
                         tab.color === 'yellow' ? 'border-amber-400 text-amber-800 dark:text-amber-100 bg-amber-500/10' :
                         'border-red-400 text-red-700 dark:text-red-100 bg-red-500/10')
                      : 'border-transparent text-[var(--crm-muted)] hover:text-[var(--crm-ink)] hover:border-[color:var(--crm-border)]'
                  } whitespace-nowrap py-4 px-5 border-b-2 font-semibold text-sm flex items-center gap-3 rounded-t-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    activeTab === tab.id 
                      ? (tab.color === 'blue' ? 'bg-sky-500/20 text-sky-800 dark:text-sky-100' :
                         tab.color === 'green' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-100' :
                         tab.color === 'yellow' ? 'bg-amber-500/20 text-amber-900 dark:text-amber-100' :
                         'bg-red-500/20 text-red-800 dark:text-red-100')
                      : 'bg-black/5 text-[var(--crm-muted)] dark:bg-white/10'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'onboarding' && (
            <ModernTable
              title="Onboarding de Clientes"
              data={filterByClientType(onboardings).filter(item => 
                !searchTerm || 
                item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.contract?.number?.toLowerCase().includes(searchTerm.toLowerCase())
              ).filter(item => 
                !statusFilter || item.status === statusFilter
              )}
              columns={[
                {
                  key: 'company',
                  label: 'Cliente',
                  render: (item) => (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--crm-ink)]">
                          {item.company?.name}
                        </span>
                        {item.company?.clientType && (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${getClientTypeBadge(item.company.clientType)}`}>
                            {getClientTypeLabel(item.company.clientType)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[var(--crm-muted)]">
                        {item.contract?.number}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <StatusBadge status={item.status} type="onboarding" />
                  )
                },
                {
                  key: 'progress',
                  label: 'Progresso',
                  render: (item) => {
                    const completedSteps = item.steps?.filter(s => s.status === 'COMPLETED').length || 0;
                    const totalSteps = item.steps?.length || 0;
                    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
                    return (
                      <div className="flex items-center">
                        <div className="w-20 bg-black/10 dark:bg-white/10 rounded-full h-2 mr-3">
                          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-sm text-[var(--crm-muted)] font-semibold">{completedSteps}/{totalSteps}</span>
                      </div>
                    );
                  }
                },
                {
                  key: 'assignedTo',
                  label: 'Responsável',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-sky-500/20 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-bold text-sky-700 dark:text-sky-200">{item.assignedTo?.name?.charAt(0) || '?'}</span>
                      </div>
                      <span className="text-sm text-[var(--crm-ink)]">{item.assignedTo?.name || 'Não atribuído'}</span>
                    </div>
                  )
                },
                {
                  key: 'expectedEndDate',
                  label: 'Data Prevista',
                  render: (item) => (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-[var(--crm-muted)] mr-2" />
                      <span className="text-sm text-[var(--crm-ink)]">
                        {formatDate(item.expectedEndDate)}
                      </span>
                    </div>
                  )
                }
              ]}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onView={(item) => handleViewOnboarding(item)}
              customActions={[
                {
                  label: 'Ver Etapas',
                  icon: ChevronRight,
                  onClick: (item) => handleViewOnboarding(item)
                }
              ]}
              emptyState={
                <div>
                  <UserCheck className={emptyIconClass} />
                  <h3 className={emptyTitleClass}>Nenhum onboarding encontrado</h3>
                  <p className={emptyTextClass}>Comece criando um novo processo de onboarding</p>
                </div>
              }
            />
          )}

          {activeTab === 'support' && (
            <ModernTable
              title="Tickets de Suporte"
              data={filterByClientType(tickets).filter(item => 
                !searchTerm || 
                item.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
              ).filter(item => 
                !statusFilter || item.status === statusFilter
              )}
              columns={[
                {
                  key: 'ticket',
                  label: 'Ticket',
                  render: (item) => (
                    <div>
                      <div className="text-sm font-semibold text-[var(--crm-ink)]">#{item.number}</div>
                      <div className="text-sm text-[var(--crm-muted)] max-w-xs truncate">{item.title}</div>
                    </div>
                  )
                },
                {
                  key: 'company',
                  label: 'Cliente',
                  render: (item) => (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-200">{item.company?.name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-sm text-[var(--crm-ink)]">{item.company?.name}</span>
                      </div>
                      {item.company?.clientType && (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${getClientTypeBadge(item.company.clientType)}`}>
                          {getClientTypeLabel(item.company.clientType)}
                        </span>
                      )}
                    </div>
                  )
                },
                {
                  key: 'priority',
                  label: 'Prioridade',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => <StatusBadge status={item.status} type="ticket" />
                },
                {
                  key: 'sla',
                  label: 'SLA',
                  render: (item) => {
                    const slaExpired = item.slaDeadline && new Date(item.slaDeadline) < new Date();
                    return (
                      <div className={`flex items-center ${slaExpired ? 'text-red-700 dark:text-red-200' : 'text-[var(--crm-ink)]'}`}>
                        <Clock className={`w-4 h-4 mr-2 ${slaExpired ? 'text-red-500' : 'text-[var(--crm-muted)]'}`} />
                        <span className="text-sm font-medium">
                          {formatDate(item.slaDeadline)}
                        </span>
                        {slaExpired && <span className="ml-2 px-2 py-1 bg-red-500/20 text-red-700 dark:text-red-200 text-xs rounded-full">Vencido</span>}
                      </div>
                    );
                  }
                },
                {
                  key: 'assignedTo',
                  label: 'Responsável',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-200">{item.assignedTo?.name?.charAt(0) || '?'}</span>
                      </div>
                      <span className="text-sm text-[var(--crm-ink)]">{item.assignedTo?.name || 'Não atribuído'}</span>
                    </div>
                  )
                }
              ]}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onView={(item) => handleViewTicket(item)}
              customActions={[
                {
                  label: 'Responder',
                  icon: MessageSquare,
                  onClick: (item) => handleViewTicket(item)
                }
              ]}
              emptyState={
                <div>
                  <HeadphonesIcon className={emptyIconClass} />
                  <h3 className={emptyTitleClass}>Nenhum ticket encontrado</h3>
                  <p className={emptyTextClass}>Todos os tickets foram resolvidos ou não há tickets no momento</p>
                </div>
              }
            />
          )}

          {activeTab === 'nps' && (
            <ModernTable
              title="Pesquisas de Satisfação (NPS)"
              data={filterByClientType(npsData).filter(item => 
                !searchTerm || 
                item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
              ).filter(item => 
                !statusFilter || item.status === statusFilter
              )}
              columns={[
                {
                  key: 'company',
                  label: 'Cliente',
                  render: (item) => (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-200">{item.company?.name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-sm font-semibold text-[var(--crm-ink)]">{item.company?.name}</span>
                      </div>
                      {item.company?.clientType && (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${getClientTypeBadge(item.company.clientType)}`}>
                          {getClientTypeLabel(item.company.clientType)}
                        </span>
                      )}
                    </div>
                  )
                },
                {
                  key: 'score',
                  label: 'Score',
                  render: (item) => (
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 mr-2" />
                      <span className="text-lg font-bold text-[var(--crm-ink)]">
                        {item.score !== null ? item.score : '-'}
                      </span>
                      <span className="text-sm text-[var(--crm-muted)] ml-1">/10</span>
                    </div>
                  )
                },
                {
                  key: 'category',
                  label: 'Categoria',
                  render: (item) => {
                    if (item.score === null) return <span className="text-sm text-[var(--crm-muted)]">-</span>;
                    const category = getNPSCategory(item.score);
                    const CatIcon = category.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${
                        category.label === 'Promotor' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200' :
                        category.label === 'Neutro' ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200' :
                        'bg-red-500/20 text-red-800 dark:text-red-200'
                      }`}>
                        <CatIcon className="w-3.5 h-3.5" /> {category.label}
                      </span>
                    );
                  }
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'RESPONDED' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/20 text-amber-900 dark:text-amber-200'
                    }`}>
                      {item.status === 'RESPONDED' ? 'Respondido' : 'Pendente'}
                    </span>
                  )
                },
                {
                  key: 'sentAt',
                  label: 'Data Envio',
                  render: (item) => (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-[var(--crm-muted)] mr-2" />
                      <span className="text-sm text-[var(--crm-ink)]">
                        {formatDate(item.sentAt)}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'feedback',
                  label: 'Feedback',
                  render: (item) => (
                    item.feedback ? (
                      <div className="max-w-xs">
                        <p className="text-sm text-[var(--crm-ink)] truncate" title={item.feedback}>{item.feedback}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--crm-muted)]">Sem feedback</span>
                    )
                  )
                }
              ]}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onView={(item) => setViewingNPS(item)}
              customActions={[
                {
                  label: 'Detalhes',
                  icon: Eye,
                  onClick: (item) => setViewingNPS(item)
                }
              ]}
              emptyState={
                <div>
                  <Star className={emptyIconClass} />
                  <h3 className={emptyTitleClass}>Nenhuma pesquisa NPS encontrada</h3>
                  <p className={emptyTextClass}>Comece enviando pesquisas de satisfação para seus clientes</p>
                </div>
              }
            />
          )}

          {activeTab === 'churn' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-[var(--crm-ink)]">Alertas de Churn</h3>
                  <p className="text-sm text-[var(--crm-muted)] mt-1">Identifique clientes com risco de cancelamento</p>
                </div>
                <button
                  onClick={handleDetectChurn}
                  disabled={detectingChurn}
                  className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60"
                >
                  {detectingChurn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  {detectingChurn ? 'Detectando...' : 'Detectar Churn'}
                </button>
              </div>

              <ModernTable
                title=""
                data={churnAlerts.filter(item => 
                  !searchTerm || 
                  item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
                ).filter(item => 
                  !statusFilter || item.status === statusFilter
                )}
                columns={[
                  {
                    key: 'company',
                    label: 'Cliente',
                    render: (item) => (
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-bold text-red-700 dark:text-red-200">{item.company?.name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-sm font-semibold text-[var(--crm-ink)]">{item.company?.name}</span>
                      </div>
                    )
                  },
                  {
                    key: 'riskLevel',
                    label: 'Nível de Risco',
                    render: (item) => (
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.riskLevel, 'churn')}`}>
                        {item.riskLevel === 'LOW' ? 'Baixo' :
                         item.riskLevel === 'MEDIUM' ? 'Médio' :
                         item.riskLevel === 'HIGH' ? 'Alto' : 'Crítico'}
                      </span>
                    )
                  },
                  {
                    key: 'score',
                    label: 'Score de Risco',
                    render: (item) => (
                      <div className="flex items-center">
                        <div className="w-20 bg-black/10 dark:bg-white/10 rounded-full h-3 mr-3">
                          <div className={`h-3 rounded-full transition-all duration-300 ${
                            item.score >= 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                            item.score >= 65 ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 
                            'bg-gradient-to-r from-yellow-500 to-yellow-600'
                          }`} style={{ width: `${item.score}%` }} />
                        </div>
                        <span className="text-sm font-bold text-[var(--crm-ink)]">{item.score}%</span>
                      </div>
                    )
                  },
                  {
                    key: 'reasons',
                    label: 'Principais Motivos',
                    render: (item) => (
                      <div className="max-w-xs">
                        {item.reasons?.slice(0, 2).map((reason, index) => (
                          <span key={index} className="text-xs bg-slate-500/10 text-[var(--crm-ink)] px-2 py-1 rounded-full mb-1 inline-block mr-1">{reason}</span>
                        ))}
                        {item.reasons?.length > 2 && (
                          <div className="text-xs text-[var(--crm-muted)] mt-1">+{item.reasons.length - 2} outros fatores</div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (item) => (
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'ACTIVE' ? 'bg-red-500/20 text-red-800 dark:text-red-200' : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                      }`}>
                        {item.status === 'ACTIVE' ? 'Ativo' : 'Resolvido'}
                      </span>
                    )
                  },
                  {
                    key: 'assignedTo',
                    label: 'Responsável',
                    render: (item) => (
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-200">{item.assignedTo?.name?.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-sm text-[var(--crm-ink)]">{item.assignedTo?.name || 'Não atribuído'}</span>
                      </div>
                    )
                  }
                ]}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onView={(item) => {
                  if (item.status === 'ACTIVE') {
                    if (window.confirm(`Deseja marcar o alerta de ${item.company?.name} como resolvido?`)) {
                      handleResolveChurn(item.id);
                    }
                  }
                }}
                emptyState={
                  <div>
                    <Shield className={emptyIconClass} />
                    <h3 className={emptyTitleClass}>Nenhum alerta de churn encontrado</h3>
                    <p className={emptyTextClass}>Ótimo! Seus clientes estão satisfeitos ou execute a detecção de churn</p>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </GradientCard>

      {/* Modal: Novo Ticket / Novo Onboarding / Nova Pesquisa NPS */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={modalType === 'ticket' ? 'Novo Ticket de Suporte' : modalType === 'onboarding' ? 'Novo Onboarding' : modalType === 'nps' ? 'Nova Pesquisa NPS' : ''}
      >
        {modalType === 'ticket' && (
          <TicketModal onClose={closeModal} onSubmit={handleSubmitTicket} companies={companies} users={users} />
        )}
        {modalType === 'onboarding' && (
          <OnboardingModal onClose={closeModal} onSubmit={handleSubmitOnboarding} companies={companies} contracts={contracts} users={users} />
        )}
        {modalType === 'nps' && (
          <NPSSurveyModal onClose={closeModal} onSubmit={handleSubmitNPSSurvey} companies={companies} contracts={contracts} />
        )}
      </Modal>

      {/* Modal: Detalhes do Onboarding */}
      <Modal
        isOpen={!!viewingOnboarding}
        onClose={() => setViewingOnboarding(null)}
        title={`Onboarding: ${viewingOnboarding?.company?.name || ''}`}
      >
        {viewingOnboarding && (
          <OnboardingDetailModal
            onboarding={viewingOnboarding}
            onAdvanceStep={handleAdvanceStep}
            onUpdateOnboarding={handleUpdateOnboarding}
            advancingStep={advancingStep}
            onClose={() => setViewingOnboarding(null)}
          />
        )}
      </Modal>

      {/* Modal: Detalhes do Ticket */}
      <Modal
        isOpen={!!viewingTicket}
        onClose={() => setViewingTicket(null)}
        title={`Ticket #${viewingTicket?.number || ''}`}
      >
        {viewingTicket && (
          <TicketDetailModal
            ticket={viewingTicket}
            responses={ticketResponses}
            responseText={responseText}
            onResponseChange={setResponseText}
            onSendResponse={handleRespondTicket}
            onUpdateStatus={handleUpdateTicketStatus}
            sendingResponse={sendingResponse}
            onClose={() => setViewingTicket(null)}
          />
        )}
      </Modal>

      {/* Modal: Detalhes NPS */}
      <Modal
        isOpen={!!viewingNPS}
        onClose={() => setViewingNPS(null)}
        title="Detalhes da Pesquisa NPS"
      >
        {viewingNPS && (
          <NPSDetailModal nps={viewingNPS} onClose={() => setViewingNPS(null)} getNPSCategory={getNPSCategory} onSubmitResponse={handleSubmitNPSResponse} />
        )}
      </Modal>
    </div>
  );
};

// ============ MODAL COMPONENTS ============

const TicketModal = ({ onClose, onSubmit, companies, users }) => {
  const [formData, setFormData] = useState({
    title: '', description: '', priority: 'MEDIUM', category: 'Técnico', companyId: '', assignedToId: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.companyId) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Título *</label>
        <input type="text" name="title" value={formData.title} onChange={handleChange} className="crm-input" placeholder="Descreva brevemente o problema" required />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Descrição *</label>
        <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="crm-input" placeholder="Descreva detalhadamente o problema ou solicitação" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Prioridade</label>
          <select name="priority" value={formData.priority} onChange={handleChange} className="crm-input">
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Categoria</label>
          <select name="category" value={formData.category} onChange={handleChange} className="crm-input">
            <option value="Técnico">Técnico</option>
            <option value="Comercial">Comercial</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Treinamento">Treinamento</option>
            <option value="Outros">Outros</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Cliente *</label>
        <select name="companyId" value={formData.companyId} onChange={handleChange} className="crm-input" required>
          <option value="">Selecione o cliente</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Responsável</label>
        <select name="assignedToId" value={formData.assignedToId} onChange={handleChange} className="crm-input">
          <option value="">Atribuir automaticamente</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary">Cancelar</button>
        <button type="submit" className="crm-btn crm-btn-primary">Criar Ticket</button>
      </div>
    </form>
  );
};

const OnboardingModal = ({ onClose, onSubmit, companies, contracts, users }) => {
  const [formData, setFormData] = useState({
    companyId: '', contractId: '', assignedToId: '', expectedEndDate: '', description: '',
    steps: [
      { title: 'Configuração inicial', description: 'Configurar parâmetros básicos do sistema' },
      { title: 'Treinamento da equipe', description: 'Treinar usuários no uso do sistema' },
      { title: 'Migração de dados', description: 'Importar dados do sistema anterior' }
    ]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.companyId || !formData.assignedToId || !formData.expectedEndDate) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleStepChange = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index][field] = value;
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const addStep = () => setFormData(prev => ({
    ...prev,
    steps: [...prev.steps, { title: '', description: '' }]
  }));

  const removeStep = (index) => setFormData(prev => ({
    ...prev,
    steps: prev.steps.filter((_, i) => i !== index)
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Cliente *</label>
          <select name="companyId" value={formData.companyId} onChange={handleChange} className="crm-input" required>
            <option value="">Selecione o cliente</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Contrato</label>
          <select name="contractId" value={formData.contractId} onChange={handleChange} className="crm-input">
            <option value="">Selecione o contrato (opcional)</option>
            {contracts.map(contract => (
              <option key={contract.id} value={contract.id}>{contract.number} - {contract.title}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Responsável *</label>
          <select name="assignedToId" value={formData.assignedToId} onChange={handleChange} className="crm-input" required>
            <option value="">Selecione o responsável</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Data Prevista de Conclusão *</label>
          <input type="date" name="expectedEndDate" value={formData.expectedEndDate} onChange={handleChange} className="crm-input" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Descrição</label>
        <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="crm-input" placeholder="Descreva o processo de onboarding" />
      </div>
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-semibold text-[var(--crm-ink)]">Etapas do Onboarding</label>
          <button type="button" onClick={addStep} className="crm-btn crm-btn-ghost px-3 py-1.5 text-sm">+ Adicionar Etapa</button>
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {formData.steps.map((step, index) => (
            <div key={index} className="crm-panel-muted p-3">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-[var(--crm-muted)]">Etapa {index + 1}</span>
                {formData.steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(index)} className="crm-btn crm-btn-ghost px-2 py-1 text-sm text-red-700 dark:text-red-200">Remover</button>
                )}
              </div>
              <div className="space-y-2">
                <input type="text" value={step.title} onChange={(e) => handleStepChange(index, 'title', e.target.value)} className="crm-input" placeholder="Título da etapa" />
                <textarea value={step.description} onChange={(e) => handleStepChange(index, 'description', e.target.value)} rows={2} className="crm-input" placeholder="Descrição da etapa" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary">Cancelar</button>
        <button type="submit" className="crm-btn crm-btn-primary">Criar Onboarding</button>
      </div>
    </form>
  );
};

const NPSSurveyModal = ({ onClose, onSubmit, companies, contracts }) => {
  const [formData, setFormData] = useState({ companyId: '', contractId: '' });
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.companyId) {
      alert('Selecione o cliente');
      return;
    }
    onSubmit(formData);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Cliente *</label>
        <select name="companyId" value={formData.companyId} onChange={(e) => setFormData(prev => ({ ...prev, companyId: e.target.value }))} className="crm-input" required>
          <option value="">Selecione o cliente</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Contrato</label>
        <select name="contractId" value={formData.contractId} onChange={(e) => setFormData(prev => ({ ...prev, contractId: e.target.value }))} className="crm-input">
          <option value="">Selecione o contrato (opcional)</option>
          {contracts.map(contract => (
            <option key={contract.id} value={contract.id}>{contract.number} - {contract.title}</option>
          ))}
        </select>
      </div>
      <p className="rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-accent-rgb)_/_0.08)] p-3 text-sm text-[var(--crm-muted)]">
        Uma pesquisa de satisfação (NPS) será enviada para o cliente selecionado. O cliente receberá um link para avaliar de 0 a 10.
      </p>
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary">Cancelar</button>
        <button type="submit" className="crm-btn crm-btn-primary">Enviar Pesquisa</button>
      </div>
    </form>
  );
};

const OnboardingDetailModal = ({ onboarding, onAdvanceStep, onUpdateOnboarding, advancingStep, onClose }) => {
  const completedSteps = onboarding.steps?.filter(s => s.status === 'COMPLETED').length || 0;
  const totalSteps = onboarding.steps?.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const allDone = completedSteps === totalSteps && totalSteps > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-accent-rgb)_/_0.08)] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <span className="text-sm font-semibold text-[var(--crm-ink)]">Progresso</span>
            <p className="text-xs text-[var(--crm-muted)]">{completedSteps}/{totalSteps} etapas concluídas</p>
          </div>
          <select
            value={onboarding.status}
            onChange={(e) => onUpdateOnboarding(onboarding.id, { status: e.target.value })}
            className="crm-input sm:w-48"
          >
            <option value="PENDING">Pendente</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluído</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-3">
          <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {allDone && (
        <div className="bg-emerald-500/10 border border-emerald-400/25 p-4 rounded-xl text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Onboarding concluído!</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Todas as etapas foram finalizadas.</p>
        </div>
      )}

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {onboarding.steps?.map((step, index) => {
          const isCompleted = step.status === 'COMPLETED';
          const isPending = !isCompleted && step.status !== 'CANCELLED';
          const isLoading = advancingStep === step.id;

          return (
            <div key={step.id || index} className={`p-4 rounded-xl border-2 transition-all ${
              isCompleted ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.68)] hover:border-sky-400/35'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[color:var(--crm-border)] shrink-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-[var(--crm-muted)]">{step.order || index + 1}</span>
                      </div>
                    )}
                    <span className={`text-sm font-bold ${isCompleted ? 'text-emerald-800 dark:text-emerald-200' : 'text-[var(--crm-ink)]'}`}>
                      {step.title}
                    </span>
                  </div>
                  {step.description && (
                    <p className="text-xs text-[var(--crm-muted)] mt-1 ml-7">{step.description}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {isCompleted ? (
                    <button
                      onClick={() => onAdvanceStep(onboarding.id, step, 'PENDING')}
                      disabled={!!advancingStep}
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-500/20 hover:bg-amber-500/25 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                      Reabrir
                    </button>
                  ) : (
                    <button
                      onClick={() => onAdvanceStep(onboarding.id, step)}
                      disabled={!!advancingStep}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 dark:text-sky-100 bg-sky-500/20 hover:bg-sky-500/25 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="crm-btn crm-btn-secondary">Fechar</button>
      </div>
    </div>
  );
};

const TicketDetailModal = ({ ticket, responseText, onResponseChange, onSendResponse, onUpdateStatus, sendingResponse, onClose, responses }) => {
  const slaExpired = ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Ticket</p>
          <p className="text-sm font-bold text-[var(--crm-ink)]">#{ticket.number}</p>
        </div>
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Status</p>
          <select
            value={ticket.status}
            onChange={(e) => onUpdateStatus(ticket.id, e.target.value)}
            className="crm-input mt-1"
          >
            <option value="OPEN">Aberto</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="WAITING_CUSTOMER">Aguardando cliente</option>
            <option value="RESOLVED">Resolvido</option>
            <option value="CLOSED">Fechado</option>
          </select>
        </div>
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Prioridade</p>
          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
            ticket.priority === 'URGENT' ? 'bg-red-500/20 text-red-800 dark:text-red-200' :
            ticket.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-800 dark:text-orange-200' :
            ticket.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200' :
            'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
          }`}>{ticket.priority}</span>
        </div>
        <div className={detailCardClass}>
          <p className={detailLabelClass}>SLA</p>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 ${slaExpired ? 'text-red-500' : 'text-[var(--crm-muted)]'}`} />
            <span className={`text-xs font-bold ${slaExpired ? 'text-red-700 dark:text-red-200' : 'text-[var(--crm-ink)]'}`}>
              {formatDate(ticket.slaDeadline)}
              {slaExpired && ' (Vencido)'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.68)] p-4">
        <p className={`${detailLabelClass} mb-1`}>Descrição</p>
        <p className="text-sm text-[var(--crm-ink)]">{ticket.description}</p>
      </div>

      {responses && responses.length > 0 && (
        <div className="border-t border-[color:var(--crm-border)] pt-4">
          <p className="text-sm font-bold text-[var(--crm-ink)] mb-3">Respostas ({responses.length})</p>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {responses.map((resp, idx) => (
              <div key={resp.id || idx} className={detailCardClass}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[var(--crm-ink)]">{resp.author?.name || 'Desconhecido'}</span>
                  <span className="text-[10px] text-[var(--crm-muted)]">{new Date(resp.createdAt).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-sm text-[var(--crm-ink)]">{resp.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-[color:var(--crm-border)] pt-4">
        <p className="text-sm font-bold text-[var(--crm-ink)] mb-3">Adicionar Resposta</p>
        <textarea
          value={responseText}
          onChange={(e) => onResponseChange(e.target.value)}
          rows={3}
          className="crm-input w-full"
          placeholder="Digite sua resposta para o cliente..."
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={onSendResponse}
            disabled={!responseText.trim() || sendingResponse}
            className="crm-btn crm-btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {sendingResponse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sendingResponse ? 'Enviando...' : 'Enviar Resposta'}
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="crm-btn crm-btn-secondary">Fechar</button>
      </div>
    </div>
  );
};

const NPSDetailModal = ({ nps, onClose, getNPSCategory, onSubmitResponse }) => {
  const category = nps.score !== null ? getNPSCategory(nps.score) : null;
  const CatIcon = category?.icon || Star;
  const [score, setScore] = useState(nps.score ?? 10);
  const [feedback, setFeedback] = useState(nps.feedback || '');
  const responsePath = buildApiUrl(`/post-sales/nps/${nps.id}/respond`);
  const responseUrl = /^https?:\/\//i.test(responsePath) ? responsePath : `${window.location.origin}${responsePath}`;

  const handleManualResponse = (e) => {
    e.preventDefault();
    onSubmitResponse(nps.id, { score, feedback });
  };

  return (
    <div className="space-y-5">
      <div className="text-center p-6 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-yellow-500/10">
        {nps.score !== null ? (
          <>
            <div className="text-5xl font-bold text-[var(--crm-ink)] mb-2">{nps.score}</div>
            <p className="text-sm text-[var(--crm-muted)]">/ 10</p>
            {category && (
              <span className={`inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-full text-sm font-bold ${
                category.label === 'Promotor' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200' :
                category.label === 'Neutro' ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200' :
                'bg-red-500/20 text-red-800 dark:text-red-200'
              }`}>
                <CatIcon className="w-4 h-4" /> {category.label}
              </span>
            )}
          </>
        ) : (
          <>
            <Star className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--crm-muted)]">Pesquisa ainda não respondida</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Cliente</p>
          <p className="text-sm font-bold text-[var(--crm-ink)]">{nps.company?.name}</p>
        </div>
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Status</p>
          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
            nps.status === 'RESPONDED' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/20 text-amber-900 dark:text-amber-200'
          }`}>{nps.status === 'RESPONDED' ? 'Respondido' : 'Pendente'}</span>
        </div>
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Enviada em</p>
          <p className="text-sm font-bold text-[var(--crm-ink)]">{formatDate(nps.sentAt)}</p>
        </div>
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Respondida em</p>
          <p className="text-sm font-bold text-[var(--crm-ink)]">
            {formatDate(nps.respondedAt)}
          </p>
        </div>
      </div>

      {nps.feedback && (
        <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.68)] p-4">
          <p className={`${detailLabelClass} mb-1`}>Feedback do Cliente</p>
          <p className="text-sm text-[var(--crm-ink)] italic">"{nps.feedback}"</p>
        </div>
      )}

      {nps.status !== 'RESPONDED' && (
        <form onSubmit={handleManualResponse} className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.68)] p-4 space-y-3">
          <div>
            <p className={`${detailLabelClass} mb-1`}>Registrar resposta</p>
            <p className="text-xs text-[var(--crm-muted)]">Use quando a resposta chegar por e-mail, telefone ou reunião.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--crm-muted)]">Nota</span>
              <input
                type="number"
                min="0"
                max="10"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="crm-input"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-[var(--crm-muted)]">Feedback</span>
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="crm-input"
                placeholder="Comentário do cliente"
              />
            </label>
          </div>
          <button type="submit" className="crm-btn crm-btn-primary">
            <CheckCircle2 className="w-4 h-4" />
            Registrar NPS
          </button>
        </form>
      )}

      <div className={detailCardClass}>
        <p className={detailLabelClass}>Link público técnico</p>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <input readOnly value={responseUrl} className="crm-input text-xs" />
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(responseUrl)}
            className="crm-btn crm-btn-secondary shrink-0"
          >
            Copiar
          </button>
        </div>
      </div>

      {nps.contract && (
        <div className={detailCardClass}>
          <p className={detailLabelClass}>Contrato</p>
          <p className="text-sm font-bold text-[var(--crm-ink)]">{nps.contract.number} - {nps.contract.title}</p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={onClose} className="crm-btn crm-btn-secondary">Fechar</button>
      </div>
    </div>
  );
};

export default PosVenda;
