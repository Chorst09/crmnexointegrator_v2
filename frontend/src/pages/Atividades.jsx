import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  BadgeDollarSign,
  Calendar,
  Check,
  CheckSquare,
  Handshake,
  Mail,
  PhoneCall,
  Plus,
  RefreshCcw,
  X
} from 'lucide-react';

import { buildApiUrl, getAuthHeaders } from '../config/api';
import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import Modal from '../components/Modal';
import {
  ACTIVITY_AREA_OPTIONS,
  addFlowMetadataToDescription,
  getAreaLabel,
  hydrateActivityFlow
} from '../utils/activityFlow';

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
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-500/10 text-red-900 dark:text-red-200' }
};

const PRIORITY_META = {
  LOW: { label: 'Baixa', cls: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200' },
  MEDIUM: { label: 'Media', cls: 'bg-amber-500/10 text-amber-900 dark:text-amber-200' },
  HIGH: { label: 'Alta', cls: 'bg-red-500/10 text-red-900 dark:text-red-200' },
  URGENT: { label: 'Urgente', cls: 'bg-red-500/[0.15] text-red-900 dark:text-red-200' }
};

const DESTINATION_OPTIONS = [
  { value: 'PRE_VENDAS', label: 'Pré-Vendas' },
  { value: 'SDR', label: 'SDR' },
  { value: 'DIRETORIA_COMERCIAL', label: 'Diretoria Comercial' },
  { value: 'GERENTE_CONTAS', label: 'Gerente de Contas' },
  { value: 'COMERCIAL', label: 'Comercial' }
];

const BUDGET_REQUEST_TYPE = 'SOLICITACAO_ORCAMENTO';

const getActivityDisplayType = (activity) => {
  if (activity?.type === 'TASK' && activity?.flow?.targetArea === 'PRE_VENDAS') {
    return BUDGET_REQUEST_TYPE;
  }
  return activity?.type;
};

const isOverdue = (dueDate, status) => {
  if (!dueDate) return false;
  if (status === 'COMPLETED' || status === 'CANCELLED') return false;
  return new Date(dueDate) < new Date();
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

export default function Atividades() {
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const lastOpenedActivityId = useRef(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    type: 'CALL',
    subject: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
    companyId: '',
    opportunityId: '',
    assignedToId: '',
    sourceArea: 'COMERCIAL',
    targetArea: 'PRE_VENDAS'
  });

  const [empresas, setEmpresas] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [filtros, setFiltros] = useState({
    status: '',
    type: '',
    priority: '',
    targetArea: ''
  });

  const loadDependencies = async () => {
    try {
      const [empresasRes, oportunidadesRes, usuariosRes] = await Promise.all([
        axios.get(buildApiUrl('/companies'), { headers: getAuthHeaders() }),
        axios.get(buildApiUrl('/opportunities'), { headers: getAuthHeaders() }),
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
      const params = new URLSearchParams();
      if (filtros.status) params.append('status', filtros.status);
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

  const openActivityDetails = (activity) => {
    if (!activity) return;
    setSelectedActivity(activity);
    setShowDetailsModal(true);
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    loadAtividades();
  }, [filtros.status, filtros.type, filtros.priority]);

  const resetForm = () => {
    setFormData({
      type: 'CALL',
      subject: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      companyId: '',
      opportunityId: '',
      assignedToId: '',
      sourceArea: 'COMERCIAL',
      targetArea: 'PRE_VENDAS'
    });
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
      const targetAreaForPayload = isBudgetRequest ? 'PRE_VENDAS' : formData.targetArea;
      const payload = {
        ...formData,
        type: isBudgetRequest ? 'TASK' : formData.type,
        targetArea: targetAreaForPayload,
        description: addFlowMetadataToDescription(formData.description, {
          sourceArea: formData.sourceArea,
          targetArea: targetAreaForPayload,
          createdFrom: 'ATIVIDADES',
          createdByName: getCurrentUserName()
        })
      };

      const assignedToId = String(formData.assignedToId || '').trim();
      if (assignedToId) {
        payload.assignedToId = assignedToId;
      }

      await axios.post(
        buildApiUrl('/activities-simple'),
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
        buildApiUrl('/activities-simple'),
        { id, status },
        { headers: getAuthHeaders() }
      );
      loadAtividades();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
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

  const filteredAtividades = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const items = (Array.isArray(atividades) ? atividades : []).filter((activity) => {
      if (filtros.status && activity.status !== filtros.status) return false;
      if (filtros.type && getActivityDisplayType(activity) !== filtros.type) return false;
      if (filtros.priority && activity.priority !== filtros.priority) return false;
      if (filtros.targetArea && activity?.flow?.targetArea !== filtros.targetArea) return false;
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
    const pending = items.filter((a) => a.status === 'PENDING').length;
    const inProgress = items.filter((a) => a.status === 'IN_PROGRESS').length;
    const completed = items.filter((a) => a.status === 'COMPLETED').length;
    const overdue = items.filter((a) => isOverdue(a.dueDate, a.status)).length;
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
        const meta = STATUS_META[item.status] || { label: item.status || '-', cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-200' };
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
        const meta = PRIORITY_META[item.priority] || { label: item.priority || '-', cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-200' };
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
          {isOverdue(item.dueDate, item.status) && (
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
          <div className="mt-1 text-[11px] text-[var(--crm-muted)]">
            Origem: {getAreaLabel(item?.flow?.sourceArea)}
          </div>
        </div>
      )
    }
  ]), []);

  return (
    <div>
      <PageHeader
        title="Atividades"
        subtitle="Gerencie suas tarefas e compromissos"
        icon={Calendar}
        gradient="blue"
        breadcrumbs={['Home', 'Atividades']}
        actions={[
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

      <ModernTable
        title="Lista de Atividades"
        data={filteredAtividades}
        columns={columns}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          {
            label: 'Status',
            value: filtros.status,
            onChange: (value) => setFiltros((prev) => ({ ...prev, status: value })),
            options: [
              { value: 'PENDING', label: 'Pendente' },
              { value: 'IN_PROGRESS', label: 'Em andamento' },
              { value: 'COMPLETED', label: 'Concluida' },
              { value: 'CANCELLED', label: 'Cancelada' }
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
        ]}
        loading={loading}
        rowClassName={(item) => (isOverdue(item.dueDate, item.status) ? 'bg-red-500/5' : '')}
        renderActions={(item) => (
          <>
            {item.status === 'PENDING' && (
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
            {item.status === 'IN_PROGRESS' && (
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
            {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
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
          </>
        )}
        emptyState={(
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-[var(--crm-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-2">Nenhuma atividade encontrada</h3>
            <p className="text-[var(--crm-muted)] max-w-sm mx-auto">
              Ajuste os filtros ou crie uma nova atividade.
            </p>
          </div>
        )}
      />

      {showDetailsModal && selectedActivity && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={selectedActivity.subject || 'Detalhes da Atividade'}
        >
          <div className="space-y-6">
            <div className="crm-panel-muted p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${
                  STATUS_META[selectedActivity.status]?.cls || 'bg-slate-500/10 text-slate-700 dark:text-slate-200'
                }`}>
                  {STATUS_META[selectedActivity.status]?.label || selectedActivity.status}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${
                  PRIORITY_META[selectedActivity.priority]?.cls || 'bg-slate-500/10 text-slate-700 dark:text-slate-200'
                }`}>
                  {PRIORITY_META[selectedActivity.priority]?.label || selectedActivity.priority}
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold bg-slate-500/10 text-slate-700 dark:text-slate-200">
                  {TYPE_META[getActivityDisplayType(selectedActivity)]?.label || selectedActivity.type}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Empresa</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {selectedActivity.company?.name || 'Não informado'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Oportunidade</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {selectedActivity.opportunity?.title || 'Não informado'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Responsável</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {selectedActivity.assignedTo?.name || 'Não informado'}
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
                    {getAreaLabel(selectedActivity?.flow?.sourceArea) || 'Não informado'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--crm-muted)] uppercase mb-1">Destino</div>
                  <div className="text-[var(--crm-ink)] font-semibold">
                    {getAreaLabel(selectedActivity?.flow?.targetArea) || 'Não informado'}
                  </div>
                </div>
              </div>
            </div>

            {selectedActivity.description && (
              <div>
                <div className="text-sm font-bold text-[var(--crm-ink)] mb-2">Descricao</div>
                <div className="crm-panel-muted p-4 text-sm text-[var(--crm-ink)] whitespace-pre-wrap">
                  {selectedActivity.description}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {selectedActivity.status === 'PENDING' && (
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
              {selectedActivity.status === 'IN_PROGRESS' && (
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
              {selectedActivity.status !== 'COMPLETED' && selectedActivity.status !== 'CANCELLED' && (
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
                    targetArea: nextType === BUDGET_REQUEST_TYPE ? 'PRE_VENDAS' : p.targetArea
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
                  Este envio vira uma solicitação no módulo Pre-Vendas &gt; Solicitações.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Empresa</label>
              <select
                value={formData.companyId}
                onChange={(e) => setFormData((p) => ({ ...p, companyId: e.target.value }))}
                className="crm-input"
              >
                <option value="">Selecionar empresa</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>{empresa.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Oportunidade (opcional)</label>
              <select
                value={formData.opportunityId}
                onChange={(e) => setFormData((p) => ({ ...p, opportunityId: e.target.value }))}
                className="crm-input"
              >
                <option value="">Selecionar oportunidade</option>
                {oportunidades.map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
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
    </div>
  );
}
