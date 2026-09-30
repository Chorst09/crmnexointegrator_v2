import { useState, useEffect, useMemo } from 'react';
import {
  Rocket,
  Plus,
  Search,
  Calendar,
  Clock,
  Video,
  MapPin,
  Users,
  ClipboardList,
  CheckCircle2,
  ListChecks,
  FileText,
  History,
  Edit,
  Trash2,
  X,
  Eye,
  LayoutGrid,
  List,
  Phone,
  CircleDot,
  MessageSquare,
  Link as LinkIcon,
  UserPlus,
  Download
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const PHASES = [
  { id: 'ENTENDIMENTO_OPORTUNIDADE', label: 'Entendimento da Oportunidade', short: 'Entendimento', icon: '🔍', color: 'blue', order: 1 },
  { id: 'APRESENTACAO_PROPOSTA', label: 'Apresentação de Propostas', short: 'Proposta', icon: '📋', color: 'purple', order: 2 },
  { id: 'FECHAMENTO_PROJETO', label: 'Fechamento de Projeto', short: 'Fechamento', icon: '✍️', color: 'green', order: 3 },
  { id: 'ALINHAMENTO_INTERNO', label: 'Alinhamento Interno', short: 'Alinh. Interno', icon: '🏢', color: 'orange', order: 4 },
  { id: 'ALINHAMENTO_EXTERNO', label: 'Alinhamento Externo (Kickoff)', short: 'Kickoff Externo', icon: '🚀', color: 'indigo', order: 5 }
];

const PHASE_MAP = PHASES.reduce((acc, phase) => { acc[phase.id] = phase; return acc; }, {});

const STATUS = {
  AGENDADA: { label: 'Agendada', color: 'bg-blue-100 text-blue-800' },
  REALIZADA: { label: 'Realizada', color: 'bg-green-100 text-green-800' },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  REAGENDADA: { label: 'Reagendada', color: 'bg-yellow-100 text-yellow-800' }
};

const PLATFORMS = {
  MEET: { label: 'Google Meet', icon: Video, color: 'bg-green-100 text-green-700' },
  TEAMS: { label: 'Microsoft Teams', icon: Video, color: 'bg-purple-100 text-purple-700' },
  ZOOM: { label: 'Zoom', icon: Video, color: 'bg-blue-100 text-blue-700' },
  PRESENCIAL: { label: 'Presencial', icon: MapPin, color: 'bg-orange-100 text-orange-700' },
  TELEFONE: { label: 'Telefone', icon: Phone, color: 'bg-gray-100 text-gray-700' },
  OUTRO: { label: 'Outro', icon: CircleDot, color: 'bg-gray-100 text-gray-700' }
};

const ACTION_STATUS = {
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  EM_ANDAMENTO: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' },
  CONCLUIDO: { label: 'Concluído', color: 'bg-green-100 text-green-800' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-100 text-red-800' }
};

const PARTICIPANT_STATUS = {
  CONVIDADO: { label: 'Convidado', color: 'bg-gray-100 text-gray-700' },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  RECUSADO: { label: 'Recusado', color: 'bg-red-100 text-red-700' },
  PRESENTE: { label: 'Presente', color: 'bg-green-100 text-green-700' }
};

const Kickoff = () => {
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');

  const [viewMode, setViewMode] = useState('pipeline');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [detailMeeting, setDetailMeeting] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (phaseFilter) params.set('phase', phaseFilter);
      if (searchTerm) params.set('search', searchTerm);
      params.set('limit', '100');

      const [meetingsRes, statsRes] = await Promise.all([
        fetch(buildApiUrl(`/kickoff/meetings?${params.toString()}`), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/kickoff/stats'), { headers: getAuthHeaders() })
      ]);

      if (meetingsRes.ok) {
        const data = await meetingsRes.json();
        setMeetings(data.meetings || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, phaseFilter, searchTerm]);

  const filteredMeetings = useMemo(() => meetings, [meetings]);

  const getStatusCount = (status) =>
    stats?.byStatus?.find((s) => s.status === status)?._count?.status || 0;

  const getPhaseMeetings = (phaseId) =>
    filteredMeetings.filter((m) => m.phase === phaseId);

  const openDetail = async (meeting) => {
    try {
      const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}`), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDetailMeeting(data);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }
  };

  const openEdit = (meeting) => {
    setEditingMeeting(meeting);
    setShowCreateModal(true);
  };

  const handleDelete = async (meeting) => {
    if (!window.confirm(`Excluir a reunião ${meeting.number}?`)) return;
    try {
      const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Erro ao excluir reunião:', error);
    }
  };

  if (loading && meetings.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gestão de Kickoff"
        subtitle="Gerencie o ciclo de reuniões estratégicas do projeto — do comercial à entrega"
        icon={Rocket}
        gradient="indigo"
        breadcrumbs={['CRM', 'Gestão', 'Kickoff']}
        actions={[
          {
            label: 'Nova Reunião',
            icon: Plus,
            onClick: () => {
              setEditingMeeting(null);
              setShowCreateModal(true);
            },
            variant: 'primary'
          }
        ]}
      />

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <AnimatedStats
          title="Total de Reuniões"
          value={stats?.total || 0}
          subtitle="Todos os status"
          icon={Rocket}
          color="indigo"
        />
        <AnimatedStats
          title="Agendadas"
          value={getStatusCount('AGENDADA')}
          subtitle="Aguardando realização"
          icon={Calendar}
          color="blue"
        />
        <AnimatedStats
          title="Realizadas"
          value={getStatusCount('REALIZADA')}
          subtitle="Concluídas com sucesso"
          icon={CheckCircle2}
          color="green"
        />
        <AnimatedStats
          title="Reagendadas"
          value={getStatusCount('REAGENDADA')}
          subtitle="Nova data definida"
          icon={Clock}
          color="yellow"
        />
        <AnimatedStats
          title="Canceladas"
          value={getStatusCount('CANCELADA')}
          subtitle="Não realizadas"
          icon={X}
          color="red"
        />
      </div>

      {/* Filtros */}
      <GradientCard gradient="gray" className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por reunião, cliente ou oportunidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>
          </div>
          <div className="sm:w-56">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
            >
              <option value="">Todos os Status</option>
              <option value="AGENDADA">Agendada</option>
              <option value="REALIZADA">Realizada</option>
              <option value="REAGENDADA">Reagendada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <div className="sm:w-64">
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
            >
              <option value="">Todas as Fases</option>
              {PHASES.map((phase) => (
                <option key={phase.id} value={phase.id}>{phase.label}</option>
              ))}
            </select>
          </div>
          <div className="flex rounded-xl border border-gray-300 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                viewMode === 'pipeline' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              Lista
            </button>
          </div>
        </div>
      </GradientCard>

      {/* Conteúdo */}
      {viewMode === 'pipeline' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {PHASES.map((phase) => {
            const phaseMeetings = getPhaseMeetings(phase.id);
            const colorMap = {
              blue: 'border-blue-200 bg-blue-50/50',
              purple: 'border-purple-200 bg-purple-50/50',
              green: 'border-green-200 bg-green-50/50',
              orange: 'border-orange-200 bg-orange-50/50',
              indigo: 'border-indigo-200 bg-indigo-50/50'
            };
            return (
              <div key={phase.id} className={`rounded-2xl border ${colorMap[phase.color]} p-4 min-h-[400px]`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{phase.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 leading-tight">{phase.label}</h3>
                      <p className="text-xs text-gray-500">{phaseMeetings.length} reuniões</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {phaseMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onView={() => openDetail(meeting)}
                      onEdit={() => openEdit(meeting)}
                    />
                  ))}
                  {phaseMeetings.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-xs text-gray-400">Nenhuma reunião nesta fase</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <GradientCard gradient="gray" className="shadow-lg">
          <div className="p-6">
            <ModernTable
              title="Reuniões de Kickoff"
              data={filteredMeetings}
              columns={[
                {
                  key: 'meeting',
                  label: 'Reunião',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center mr-3 text-base">
                        {PHASE_MAP[item.phase]?.icon || '📅'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.title}</div>
                        <div className="text-xs text-gray-500">{item.number}</div>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'company',
                  label: 'Cliente / Oportunidade',
                  render: (item) => (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.company?.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.opportunity?.title}
                        {item.opportunity?.value ? ` • R$ ${Number(item.opportunity.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'phase',
                  label: 'Fase',
                  render: (item) => (
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                      {PHASE_MAP[item.phase]?.short || item.phase}
                    </span>
                  )
                },
                {
                  key: 'schedule',
                  label: 'Agendamento',
                  render: (item) => (
                    <div>
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        {new Date(item.scheduledDate).toLocaleDateString('pt-BR')}
                      </div>
                      {(item.startTime || item.endTime) && (
                        <div className="flex items-center text-xs text-gray-500 mt-1 ml-6">
                          <Clock className="w-3 h-3 mr-1" />
                          {item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${STATUS[item.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS[item.status]?.label || item.status}
                    </span>
                  )
                },
                {
                  key: 'meta',
                  label: 'Detalhes',
                  render: (item) => (
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {item._count?.participants || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <ListChecks className="w-3.5 h-3.5 text-gray-400" />
                        {item._count?.checklistItems || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
                        {item._count?.actionItems || 0}
                      </span>
                    </div>
                  )
                }
              ]}
              onView={(item) => openDetail(item)}
              onEdit={(item) => openEdit(item)}
              onDelete={(item) => handleDelete(item)}
              emptyState={
                <div>
                  <Rocket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma reunião encontrada</h3>
                  <p className="text-gray-500">Crie a primeira reunião de kickoff do projeto</p>
                </div>
              }
            />
          </div>
        </GradientCard>
      )}

      {/* Modal Criação/Edição */}
      {showCreateModal && (
        <KickoffFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            setShowCreateModal(false);
            await fetchData();
          }}
          meeting={editingMeeting}
        />
      )}

      {/* Modal Detalhes */}
      {detailMeeting && (
        <KickoffDetailModal
          meeting={detailMeeting}
          onClose={() => setDetailMeeting(null)}
          onMeetingChange={setDetailMeeting}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
};

// ===== CARD DO PIPELINE =====
const MeetingCard = ({ meeting, onView, onEdit }) => {
  const phase = PHASE_MAP[meeting.phase];

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS[meeting.status]?.color}`}>
          {STATUS[meeting.status]?.label}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-gray-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
          title="Editar"
        >
          <Edit className="w-4 h-4" />
        </button>
      </div>

      <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{meeting.title}</h4>
      <p className="text-xs text-gray-500 mb-3 line-clamp-1">{meeting.company?.name}</p>

      <div className="space-y-1.5 text-xs text-gray-600">
        <div className="flex items-center">
          <Calendar className="w-3.5 h-3.5 text-gray-400 mr-2" />
          {new Date(meeting.scheduledDate).toLocaleDateString('pt-BR')}
          {meeting.startTime && <span className="ml-1 text-gray-400">• {meeting.startTime}</span>}
        </div>
        <div className="flex items-center">
          {PLATFORMS[meeting.platform]?.icon ? (() => {
            const Icon = PLATFORMS[meeting.platform].icon;
            return <Icon className="w-3.5 h-3.5 text-gray-400 mr-2" />;
          })() : <CircleDot className="w-3.5 h-3.5 text-gray-400 mr-2" />}
          {PLATFORMS[meeting.platform]?.label || meeting.platform}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <span className="flex items-center gap-1 text-gray-400">
            <Users className="w-3.5 h-3.5" /> {meeting._count?.participants || 0}
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <ListChecks className="w-3.5 h-3.5" /> {meeting._count?.actionItems || 0} ações
          </span>
          <span className="text-indigo-500">{phase?.icon}</span>
        </div>
      </div>
    </div>
  );
};

// ===== MODAL CRIAÇÃO/EDIÇÃO =====
const KickoffFormModal = ({ onClose, onSaved, meeting }) => {
  const [formData, setFormData] = useState({
    title: meeting?.title || '',
    description: meeting?.description || '',
    phase: meeting?.phase || 'ENTENDIMENTO_OPORTUNIDADE',
    platform: meeting?.platform || 'MEET',
    meetingLink: meeting?.meetingLink || '',
    scheduledDate: meeting?.scheduledDate ? meeting.scheduledDate.slice(0, 10) : '',
    startTime: meeting?.startTime || '09:00',
    endTime: meeting?.endTime || '10:00',
    opportunityId: meeting?.opportunityId || '',
    templateId: meeting?.templateId || ''
  });
  const [participants, setParticipants] = useState(
    meeting?.participants?.map((p) => ({ userId: p.userId, contactId: p.contactId, role: p.role, isRequired: p.isRequired })) || []
  );
  const [agendaItems, setAgendaItems] = useState(
    meeting?.agendaItems?.map((a) => ({ title: a.title, description: a.description, durationMinutes: a.durationMinutes })) || []
  );
  const [checklistItems, setChecklistItems] = useState(
    meeting?.checklistItems?.map((c) => c.title) || []
  );

  const [opportunities, setOpportunities] = useState([]);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [selectedInternal, setSelectedInternal] = useState(
    meeting?.participants?.filter((p) => p.userId).map((p) => p.userId) || []
  );
  const [selectedExternal, setSelectedExternal] = useState(
    meeting?.participants?.filter((p) => p.contactId).map((p) => p.contactId) || []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      const [oppRes, usersRes] = await Promise.all([
        fetch(buildApiUrl('/opportunities'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/auth/users'), { headers: getAuthHeaders() })
      ]);
      if (oppRes.ok) {
        const data = await oppRes.json();
        setOpportunities(Array.isArray(data) ? data : data.opportunities || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      if (!formData.phase) return;
      try {
        const res = await fetch(buildApiUrl(`/kickoff/templates?phase=${formData.phase}`), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      }
    };
    loadTemplates();
  }, [formData.phase]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!formData.opportunityId) {
        setPreview(null);
        setSelectedExternal([]);
        return;
      }
      try {
        const res = await fetch(buildApiUrl(`/kickoff/opportunities/${formData.opportunityId}/preview`), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setPreview(data);
        }
      } catch (error) {
        console.error('Erro ao carregar preview:', error);
      }
    };
    loadPreview();
  }, [formData.opportunityId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTemplateSelect = (templateId) => {
    setFormData((prev) => ({ ...prev, templateId }));
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      if (agendaItems.length === 0) {
        setAgendaItems((Array.isArray(template.agenda) ? template.agenda : []).map((a) => ({
          title: a.title || a,
          description: a.description,
          durationMinutes: a.durationMinutes
        })));
      }
      if (checklistItems.length === 0) {
        setChecklistItems((Array.isArray(template.checklist) ? template.checklist : []).map((c) => c.title || c));
      }
    }
  };

  const toggleInternal = (userId) => {
    setSelectedInternal((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleExternal = (contactId) => {
    setSelectedExternal((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const addAgendaItem = () => {
    setAgendaItems((prev) => [...prev, { title: '', description: '', durationMinutes: 15 }]);
  };

  const updateAgendaItem = (index, field, value) => {
    setAgendaItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeAgendaItem = (index) => {
    setAgendaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addChecklistItem = () => {
    setChecklistItems((prev) => [...prev, '']);
  };

  const updateChecklistItem = (index, value) => {
    setChecklistItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeChecklistItem = (index) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    const internalParticipants = selectedInternal.map((userId) => ({ userId, role: 'INTERNO' }));
    const externalParticipants = selectedExternal.map((contactId) => ({ contactId, role: 'EXTERNO' }));
    return {
      ...formData,
      participants: [...internalParticipants, ...externalParticipants],
      agendaItems: agendaItems.filter((a) => a.title).map((a) => ({
        title: a.title,
        description: a.description,
        durationMinutes: parseInt(a.durationMinutes) || 15
      })),
      checklistItems: checklistItems.filter((c) => c && c.trim()).map((c) => ({ title: c.trim() }))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.phase || !formData.scheduledDate || !formData.opportunityId) {
      alert('Preencha os campos obrigatórios: Título, Fase, Data e Oportunidade');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const url = meeting
        ? buildApiUrl(`/kickoff/meetings/${meeting.id}`)
        : buildApiUrl('/kickoff/meetings');
      const res = await fetch(url, {
        method: meeting ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await onSaved();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao salvar reunião');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar reunião');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">
            {meeting ? `Editar Reunião ${meeting.number}` : 'Nova Reunião de Kickoff'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="kickoff-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={inputClass}
                placeholder="Ex: Kickoff inicial do projeto ERP"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fase *</label>
              <select name="phase" value={formData.phase} onChange={handleChange} className={inputClass} required>
                {PHASES.map((phase) => (
                  <option key={phase.id} value={phase.id}>{phase.icon} {phase.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Oportunidade / Projeto *</label>
              <select name="opportunityId" value={formData.opportunityId} onChange={handleChange} className={inputClass} required>
                <option value="">Selecione a oportunidade</option>
                {opportunities.map((opp) => (
                  <option key={opp.id} value={opp.id}>
                    {opp.title}
                    {opp.company?.name ? ` — ${opp.company.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dados herdados do cliente */}
          {preview && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                  <Download className="w-4 h-4" /> Dados herdados da oportunidade
                </h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-indigo-400 font-medium">Razão Social</p>
                  <p className="text-indigo-900 font-semibold">{preview.company?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-400 font-medium">CNPJ</p>
                  <p className="text-indigo-900 font-semibold">{preview.company?.document || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-400 font-medium">Valor do Projeto</p>
                  <p className="text-indigo-900 font-semibold">
                    R$ {Number(preview.opportunity?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-400 font-medium">Segmento</p>
                  <p className="text-indigo-900 font-semibold">{preview.company?.segment || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Agendamento */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Agendamento
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input type="date" name="scheduledDate" value={formData.scheduledDate} onChange={handleChange} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Início</label>
                <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Fim</label>
                <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                <select name="platform" value={formData.platform} onChange={handleChange} className={inputClass}>
                  {Object.entries(PLATFORMS).map(([value, pf]) => (
                    <option key={value} value={value}>{pf.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {formData.platform !== 'PRESENCIAL' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5" /> Link da Reunião
                </label>
                <input
                  type="url"
                  name="meetingLink"
                  value={formData.meetingLink}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            )}
          </div>

          {/* Template de Pauta */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Template de Pauta
            </h4>
            <select value={formData.templateId} onChange={(e) => handleTemplateSelect(e.target.value)} className={inputClass}>
              <option value="">Padrão da fase</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Pauta Dinâmica */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-500" /> Pauta da Reunião
              </h4>
              <button type="button" onClick={addAgendaItem} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                + Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {agendaItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Título do item de pauta"
                  />
                  <input
                    type="number"
                    value={item.durationMinutes}
                    onChange={(e) => updateAgendaItem(index, 'durationMinutes', e.target.value)}
                    className={`${inputClass} w-24`}
                    placeholder="min"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => removeAgendaItem(index)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {agendaItems.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-lg">
                  Nenhum item de pauta
                </p>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-500" /> Checklist de Verificação
              </h4>
              <button type="button" onClick={addChecklistItem} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                + Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <CheckCircle2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateChecklistItem(index, e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Ex: Contrato assinado?"
                  />
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {checklistItems.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-lg">
                  Nenhum item de checklist
                </p>
              )}
            </div>
          </div>

          {/* Participantes */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" /> Participantes
            </h4>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Time Interno (usuários do CRM)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                {users.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1.5 rounded-md transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInternal.includes(user.id)}
                      onChange={() => toggleInternal(user.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-700">
                      {user.name?.charAt(0) || '?'}
                    </span>
                    <span className="text-gray-700">{user.name}</span>
                  </label>
                ))}
                {users.length === 0 && <p className="text-xs text-gray-400 col-span-2">Nenhum usuário disponível</p>}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Contatos do Cliente (externos)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                {(preview?.contacts || []).map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1.5 rounded-md transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedExternal.includes(contact.id)}
                      onChange={() => toggleExternal(contact.id)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-[10px] font-bold text-green-700">
                      {contact.name?.charAt(0) || '?'}
                    </span>
                    <span className="text-gray-700">
                      {contact.name}
                      <span className="block text-[10px] text-gray-400">{contact.position || contact.email}</span>
                    </span>
                  </label>
                ))}
                {(!preview || (preview.contacts || []).length === 0) && (
                  <p className="text-xs text-gray-400 col-span-2">
                    {formData.opportunityId ? 'Nenhum contato cadastrado para este cliente' : 'Selecione uma oportunidade para carregar os contatos'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações / Objetivo</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className={inputClass}
              placeholder="Contexto, objetivos e expectativas da reunião"
            />
          </div>
        </form>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="kickoff-form"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
            {meeting ? 'Salvar Alterações' : 'Criar Reunião'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== MODAL DETALHES =====
const KickoffDetailModal = ({ meeting, onClose, onMeetingChange, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [notes, setNotes] = useState(meeting.meetingNotes || '');
  const [actionForm, setActionForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeId: '' });
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showActionForm, setShowActionForm] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ userId: '', contactId: '', role: 'INTERNO' });
  const [showParticipantForm, setShowParticipantForm] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const res = await fetch(buildApiUrl('/auth/users'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    };
    loadUsers();

    const loadContacts = async () => {
      if (!meeting.opportunityId) return;
      try {
        const res = await fetch(buildApiUrl(`/kickoff/opportunities/${meeting.opportunityId}/preview`), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts || []);
        }
      } catch (error) {
        console.error('Erro ao carregar contatos:', error);
      }
    };
    loadContacts();
  }, [meeting.opportunityId]);

  const refresh = async () => {
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}`), { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      onMeetingChange(data);
      setNotes(data.meetingNotes || '');
    }
    onRefresh();
  };

  const changeStatus = async (status) => {
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/status`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      await refresh();
    }
  };

  const saveNotes = async () => {
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/notes`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ meetingNotes: notes })
    });
    if (res.ok) {
      await refresh();
    }
  };

  const toggleChecklist = async (item) => {
    const res = await fetch(buildApiUrl(`/kickoff/checklist/${item.id}`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isCompleted: !item.isCompleted })
    });
    if (res.ok) await refresh();
  };

  const addChecklist = async () => {
    const title = window.prompt('Novo item de checklist:');
    if (!title) return;
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/checklist`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title })
    });
    if (res.ok) await refresh();
  };

  const addActionItem = async (e) => {
    e.preventDefault();
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/action-items`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(actionForm)
    });
    if (res.ok) {
      setActionForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeId: '' });
      setShowActionForm(false);
      await refresh();
    }
  };

  const updateActionItem = async (item, data) => {
    const res = await fetch(buildApiUrl(`/kickoff/action-items/${item.id}`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (res.ok) await refresh();
  };

  const deleteActionItem = async (item) => {
    if (!window.confirm('Excluir este plano de ação?')) return;
    const res = await fetch(buildApiUrl(`/kickoff/action-items/${item.id}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) await refresh();
  };

  const addParticipant = async (e) => {
    e.preventDefault();
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/participants`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newParticipant)
    });
    if (res.ok) {
      setNewParticipant({ userId: '', contactId: '', role: 'INTERNO' });
      setShowParticipantForm(false);
      await refresh();
    }
  };

  const updateParticipantStatus = async (participant, status) => {
    const res = await fetch(buildApiUrl(`/kickoff/participants/${participant.id}`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) await refresh();
  };

  const removeParticipant = async (participant) => {
    const res = await fetch(buildApiUrl(`/kickoff/participants/${participant.id}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) await refresh();
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";
  const phase = PHASE_MAP[meeting.phase];
  const completedChecklist = meeting.checklistItems?.filter((c) => c.isCompleted).length || 0;
  const totalChecklist = meeting.checklistItems?.length || 0;
  const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: Eye },
    { id: 'agenda', label: 'Pauta', icon: ClipboardList },
    { id: 'checklist', label: 'Checklist', icon: ListChecks },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'minutes', label: 'Ata & Ações', icon: MessageSquare },
    { id: 'history', label: 'Histórico', icon: History }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">
                {phase?.icon || '📅'}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">{meeting.title}</h2>
                  <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${STATUS[meeting.status]?.color}`}>
                    {STATUS[meeting.status]?.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {meeting.number} • {meeting.company?.name}
                  {meeting.company?.document ? ` • CNPJ ${meeting.company.document}` : ''}
                </p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {new Date(meeting.scheduledDate).toLocaleDateString('pt-BR')}
                  </span>
                  {(meeting.startTime || meeting.endTime) && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {meeting.startTime}{meeting.endTime ? ` – ${meeting.endTime}` : ''}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    {PLATFORMS[meeting.platform]?.icon ? (() => {
                      const Icon = PLATFORMS[meeting.platform].icon;
                      return <Icon className="w-3.5 h-3.5 text-gray-400" />;
                    })() : <CircleDot className="w-3.5 h-3.5 text-gray-400" />}
                    {PLATFORMS[meeting.platform]?.label || meeting.platform}
                  </span>
                  {meeting.meetingLink && (
                    <a
                      href={meeting.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Entrar na reunião
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Ações de status */}
          <div className="flex flex-wrap gap-2 mt-4">
            {meeting.status !== 'REALIZADA' && (
              <button
                onClick={() => changeStatus('REALIZADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como Realizada
              </button>
            )}
            {meeting.status !== 'CANCELADA' && meeting.status !== 'REALIZADA' && (
              <button
                onClick={() => changeStatus('CANCELADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            )}
            {meeting.status !== 'REALIZADA' && meeting.status !== 'CANCELADA' && (
              <button
                onClick={() => changeStatus('REAGENDADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-lg hover:bg-yellow-200 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" /> Reagendar
              </button>
            )}
            {meeting.status !== 'AGENDADA' && meeting.status !== 'REALIZADA' && (
              <button
                onClick={() => changeStatus('AGENDADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" /> Reabrir
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex-shrink-0 px-6">
          <nav className="-mb-px flex space-x-2 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-all`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'checklist' && totalChecklist > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700">
                      {completedChecklist}/{totalChecklist}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Visão Geral */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-50 rounded-xl p-4">
                  <p className="text-xs text-indigo-400 font-medium mb-1">Oportunidade</p>
                  <p className="text-sm font-semibold text-indigo-900">{meeting.opportunity?.title}</p>
                  <p className="text-xs text-indigo-600 mt-1">
                    {meeting.opportunity?.number} • Valor R$ {Number(meeting.opportunity?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-400 font-medium mb-1">Cliente</p>
                  <p className="text-sm font-semibold text-green-900">{meeting.company?.name}</p>
                  <p className="text-xs text-green-600 mt-1">CNPJ: {meeting.company?.document || '—'}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xs text-purple-400 font-medium mb-1">Responsável</p>
                  <p className="text-sm font-semibold text-purple-900">{meeting.owner?.name}</p>
                  <p className="text-xs text-purple-600 mt-1">{meeting.owner?.email}</p>
                </div>
              </div>

              {meeting.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Objetivo</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{meeting.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Resumo</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border border-gray-200 rounded-xl p-3 text-center">
                    <Users className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{meeting.participants?.length || 0}</p>
                    <p className="text-xs text-gray-500">Participantes</p>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3 text-center">
                    <ClipboardList className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{meeting.agendaItems?.length || 0}</p>
                    <p className="text-xs text-gray-500">Itens de pauta</p>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3 text-center">
                    <ListChecks className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{completedChecklist}/{totalChecklist}</p>
                    <p className="text-xs text-gray-500">Checklist</p>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-3 text-center">
                    <MessageSquare className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">
                      {meeting.actionItems?.filter((a) => a.status !== 'CONCLUIDO' && a.status !== 'CANCELADO').length || 0}
                    </p>
                    <p className="text-xs text-gray-500">Ações abertas</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pauta */}
          {activeTab === 'agenda' && (
            <div className="space-y-3">
              {meeting.agendaItems?.map((item, index) => (
                <div key={item.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                  <span className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                    <Clock className="w-3.5 h-3.5" /> {item.durationMinutes} min
                  </span>
                </div>
              ))}
              {(!meeting.agendaItems || meeting.agendaItems.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum item de pauta definido</p>
              )}
            </div>
          )}

          {/* Checklist */}
          {activeTab === 'checklist' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${checklistProgress}%` }}></div>
                </div>
                <span className="text-sm font-semibold text-gray-700">{checklistProgress}%</span>
              </div>
              <div className="space-y-2">
                {meeting.checklistItems?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleChecklist(item)}>
                    <button className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.isCompleted ? 'bg-green-600 border-green-600' : 'border-gray-300 bg-white'
                    }`}>
                      {item.isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </button>
                    <span className={`text-sm flex-1 ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {item.title}
                    </span>
                    {item.completedBy && (
                      <span className="text-xs text-gray-400">por {item.completedBy.name}</span>
                    )}
                  </div>
                ))}
                {(!meeting.checklistItems || meeting.checklistItems.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhum item de checklist</p>
                )}
              </div>
              <button
                onClick={addChecklist}
                className="mt-4 w-full py-2.5 border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-medium rounded-xl hover:bg-indigo-50 transition-colors"
              >
                + Adicionar item de verificação
              </button>
            </div>
          )}

          {/* Participantes */}
          {activeTab === 'participants' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {meeting.participants?.map((participant) => {
                  const isInternal = participant.userId;
                  const name = isInternal ? participant.user?.name : participant.contact?.name;
                  const detail = isInternal ? participant.user?.email : `${participant.contact?.position || 'Contato'} • ${participant.contact?.email || participant.contact?.phone || ''}`;
                  return (
                    <div key={participant.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            isInternal ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500">{detail}</p>
                            <span className={`inline-flex mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${PARTICIPANT_STATUS[participant.status]?.color}`}>
                              {PARTICIPANT_STATUS[participant.status]?.label}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeParticipant(participant)} className="text-gray-300 hover:text-red-600 transition-colors" title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {['CONVIDADO', 'CONFIRMADO', 'RECUSADO', 'PRESENTE'].map((status) => (
                          <button
                            key={status}
                            onClick={() => updateParticipantStatus(participant, status)}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                              participant.status === status ? PARTICIPANT_STATUS[status].color : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {PARTICIPANT_STATUS[status].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {showParticipantForm ? (
                <form onSubmit={addParticipant} className="mt-4 bg-indigo-50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={newParticipant.userId}
                      onChange={(e) => setNewParticipant((prev) => ({ ...prev, userId: e.target.value, contactId: '', role: 'INTERNO' }))}
                      className={inputClass}
                    >
                      <option value="">Usuário interno...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                    <select
                      value={newParticipant.contactId}
                      onChange={(e) => setNewParticipant((prev) => ({ ...prev, contactId: e.target.value, userId: '', role: 'EXTERNO' }))}
                      className={inputClass}
                    >
                      <option value="">Contato do cliente...</option>
                      {(() => {
                        const existingContactIds = new Set(
                          (meeting.participants || []).map((p) => p.contactId).filter(Boolean)
                        );
                        return contacts
                          .filter((c) => !existingContactIds.has(c.id))
                          .map((c) => <option key={c.id} value={c.id}>{c.name} — {c.position}</option>);
                      })()}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                      Adicionar
                    </button>
                  </div>
                  <button type="button" onClick={() => setShowParticipantForm(false)} className="text-xs text-gray-500 hover:text-gray-700">
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowParticipantForm(true)}
                  className="mt-4 w-full py-2.5 border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-medium rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Adicionar participante
                </button>
              )}
            </div>
          )}

          {/* Ata & Ações */}
          {activeTab === 'minutes' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" /> Ata da Reunião
                </h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                  className={`${inputClass} font-mono text-sm leading-relaxed`}
                  placeholder="Registre aqui os pontos discutidos, decisões tomadas e observações da reunião..."
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={saveNotes}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Salvar Ata
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-500" /> Tarefas / Ações Pós-Reunião
                  </h4>
                  <button
                    onClick={() => setShowActionForm((prev) => !prev)}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    + Nova ação
                  </button>
                </div>

                {showActionForm && (
                  <form onSubmit={addActionItem} className="bg-indigo-50 rounded-xl p-4 space-y-3 mb-4">
                    <input
                      type="text"
                      value={actionForm.title}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, title: e.target.value }))}
                      className={inputClass}
                      placeholder="Título da ação *"
                      required
                    />
                    <textarea
                      value={actionForm.description}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, description: e.target.value }))}
                      className={inputClass}
                      rows={2}
                      placeholder="Descrição"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={actionForm.priority}
                        onChange={(e) => setActionForm((prev) => ({ ...prev, priority: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="LOW">Prioridade Baixa</option>
                        <option value="MEDIUM">Prioridade Média</option>
                        <option value="HIGH">Prioridade Alta</option>
                        <option value="URGENT">Urgente</option>
                      </select>
                      <input
                        type="date"
                        value={actionForm.dueDate}
                        onChange={(e) => setActionForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        className={inputClass}
                      />
                      <select
                        value={actionForm.assigneeId}
                        onChange={(e) => setActionForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Responsável...</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowActionForm(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                        Criar Ação (+ Tarefa)
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {meeting.actionItems?.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${ACTION_STATUS[item.status]?.color}`}>
                              {ACTION_STATUS[item.status]?.label}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                              item.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                              item.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                              item.priority === 'LOW' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {item.priority}
                            </span>
                            {item.taskId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700">
                                <CheckCircle2 className="w-3 h-3" /> Tarefa vinculada
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1.5">{item.title}</p>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            {item.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" /> {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {item.assignee && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" /> {item.assignee.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {item.status !== 'CONCLUIDO' && (
                            <button
                              onClick={() => updateActionItem(item, { status: 'CONCLUIDO' })}
                              className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                            >
                              Concluir
                            </button>
                          )}
                          {item.status === 'PENDENTE' && (
                            <button
                              onClick={() => updateActionItem(item, { status: 'EM_ANDAMENTO' })}
                              className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                            >
                              Iniciar
                            </button>
                          )}
                          <button
                            onClick={() => deleteActionItem(item)}
                            className="text-[10px] px-2 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!meeting.actionItems || meeting.actionItems.length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhuma ação pós-reunião definida</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Histórico */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {meeting.history?.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <History className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium text-gray-900">{event.title}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(event.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {event.description && <p className="text-xs text-gray-500 mt-1">{event.description}</p>}
                    {event.user && <p className="text-xs text-gray-400 mt-1">por {event.user.name}</p>}
                  </div>
                </div>
              ))}
              {(!meeting.history || meeting.history.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum evento no histórico</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper para obter contatos do cliente no modal de participantes (via preview quando necessário)
const previewContactsOf = (meeting) => {
  // Contatos já disponíveis através dos participantes externos + placeholder
  return [];
};

export default Kickoff;
