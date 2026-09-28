import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import PageHeader from '../components/PageHeader';
import {
  ArrowLeft, Settings, Calendar, Columns, Users, Clock, AlertTriangle,
  AlertCircle, FileText, DollarSign, CheckCircle, Plus, Pencil, Trash2,
  Upload, Download, X
} from 'lucide-react';

const statusColors = {
  PLANEJADO: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PAUSADO: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONCLUIDO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELADO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
};

const phaseStatusColors = {
  PENDING: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  SKIPPED: 'bg-gray-100 text-gray-500'
};

const taskStatusColors = {
  TODO: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-600',
  REVIEW: 'bg-purple-100 text-purple-600',
  DONE: 'bg-green-100 text-green-600',
  BLOCKED: 'bg-red-100 text-red-600'
};

const priorityColors = {
  LOW: 'text-green-600',
  MEDIUM: 'text-yellow-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600'
};

const healthColor = (score) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const tabs = [
  { id: 'overview', label: 'Visão Geral', icon: Settings },
  { id: 'gantt', label: 'Cronograma', icon: Calendar },
  { id: 'kanban', label: 'Kanban', icon: Columns },
  { id: 'team', label: 'Equipe & Horas', icon: Users },
  { id: 'risks', label: 'Riscos', icon: AlertTriangle },
  { id: 'issues', label: 'Pendências', icon: AlertCircle },
  { id: 'billing', label: 'Faturamento', icon: DollarSign },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'closure', label: 'Encerramento', icon: CheckCircle }
];

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [risks, setRisks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [billings, setBillings] = useState([]);
  const [acceptances, setAcceptances] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' });
  const [teamForm, setTeamForm] = useState({ userId: '', role: 'DEVELOPER', allocationPercent: 100, hourlyCost: 0 });
  const [riskForm, setRiskForm] = useState({ title: '', description: '', level: 'MEDIUM', mitigationPlan: '' });
  const [issueForm, setIssueForm] = useState({ title: '', description: '', priority: 'MEDIUM', assignedToId: '' });
  const [users, setUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchProject();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'kanban' || activeTab === 'gantt') fetchTasks();
    if (activeTab === 'team') fetchTeam();
    if (activeTab === 'risks') fetchRisks();
    if (activeTab === 'issues') fetchIssues();
    if (activeTab === 'billing') fetchBillings();
    if (activeTab === 'closure') fetchAcceptances();
  }, [activeTab]);

  const fetchProject = async () => {
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}`), { headers: getAuthHeaders() });
      if (res.ok) setProject(await res.json());
      else navigate('/projetos');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(buildApiUrl(`/projetos/${id}/tasks${params}`), { headers: getAuthHeaders() });
      if (res.ok) setTasks(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchTeam = async () => {
    try {
      const [teamRes, usersRes] = await Promise.all([
        fetch(buildApiUrl(`/projetos/${id}/team`), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/users'), { headers: getAuthHeaders() })
      ]);
      if (teamRes.ok) setTeam(await teamRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) { console.error(e); }
  };

  const fetchRisks = async () => {
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/risks`), { headers: getAuthHeaders() });
      if (res.ok) setRisks(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchIssues = async () => {
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/issues`), { headers: getAuthHeaders() });
      if (res.ok) setIssues(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchBillings = async () => {
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/billings`), { headers: getAuthHeaders() });
      if (res.ok) setBillings(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAcceptances = async () => {
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/acceptances`), { headers: getAuthHeaders() });
      if (res.ok) setAcceptances(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/tasks`), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm)
      });
      if (res.ok) {
        setShowTaskModal(false);
        setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' });
        fetchTasks();
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await fetch(buildApiUrl(`/projetos/${id}/tasks/${taskId}`), {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const handleCreateTeamMember = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/team`), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm)
      });
      if (res.ok) {
        setShowTeamModal(false);
        setTeamForm({ userId: '', role: 'DEVELOPER', allocationPercent: 100, hourlyCost: 0 });
        fetchTeam();
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateRisk = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/risks`), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(riskForm)
      });
      if (res.ok) {
        setShowRiskModal(false);
        setRiskForm({ title: '', description: '', level: 'MEDIUM', mitigationPlan: '' });
        fetchRisks();
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateIssue = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(buildApiUrl(`/projetos/${id}/issues`), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm)
      });
      if (res.ok) {
        setShowIssueModal(false);
        setIssueForm({ title: '', description: '', priority: 'MEDIUM', assignedToId: '' });
        fetchIssues();
      }
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'OTHER');
    try {
      await fetch(buildApiUrl(`/projetos/${id}/attachments`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      fetchProject();
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const handleUpdateProjectStatus = async (newStatus) => {
    try {
      await fetch(buildApiUrl(`/projetos/${id}`), {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchProject();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-12 text-center text-[var(--crm-muted)]">Carregando projeto...</div>;
  if (!project) return null;

  const tasksByStatus = {
    TODO: tasks.filter(t => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
    REVIEW: tasks.filter(t => t.status === 'REVIEW'),
    DONE: tasks.filter(t => t.status === 'DONE'),
    BLOCKED: tasks.filter(t => t.status === 'BLOCKED')
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/projetos')} className="p-1.5 rounded-lg hover:bg-[var(--crm-surface-alt)]">
              <ArrowLeft size={18} className="text-[var(--crm-muted)]" />
            </button>
            <span>{project.number} - {project.name}</span>
          </div>
        }
        subtitle={`${project.company?.name || ''} | ${project.type} | Gestor: ${project.projectManager?.name || ''}`}
        gradient="green"
        actions={
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusColors[project.status] || ''}`}>
              {project.status?.replace(/_/g, ' ')}
            </span>
            {project.status === 'PLANEJADO' && (
              <button onClick={() => handleUpdateProjectStatus('EM_ANDAMENTO')} className="crm-btn crm-btn-primary text-xs">
                Iniciar Projeto
              </button>
            )}
            {project.status === 'EM_ANDAMENTO' && (
              <button onClick={() => handleUpdateProjectStatus('CONCLUIDO')} className="crm-btn crm-btn-primary text-xs">
                Concluir
              </button>
            )}
          </div>
        }
      />

      <div className="crm-panel p-4">
        <div className="flex flex-wrap gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-[var(--crm-muted)] hover:bg-[var(--crm-surface-alt)]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="crm-panel p-6">
              <h3 className="font-bold text-[var(--crm-ink)] mb-4">Informações do Projeto</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-[var(--crm-muted)]">Número:</span> <span className="font-mono">{project.number}</span></div>
                <div><span className="text-[var(--crm-muted)]">Tipo:</span> <span className={`font-bold ${project.type === 'B2G' ? 'text-purple-600' : 'text-blue-600'}`}>{project.type}</span></div>
                <div><span className="text-[var(--crm-muted)]">Fase:</span> <span className={`px-2 py-0.5 rounded text-xs font-bold ${phaseStatusColors[project.phase] || ''}`}>{project.phase?.replace(/_/g, ' ')}</span></div>
                <div><span className="text-[var(--crm-muted)]">Budget:</span> <span className="font-bold">R$ {(project.budget || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div><span className="text-[var(--crm-muted)]">Início Previsto:</span> {project.plannedStartDate ? new Date(project.plannedStartDate).toLocaleDateString('pt-BR') : '-'}</div>
                <div><span className="text-[var(--crm-muted)]">Fim Previsto:</span> {project.plannedEndDate ? new Date(project.plannedEndDate).toLocaleDateString('pt-BR') : '-'}</div>
                {project.opportunity && (
                  <div className="col-span-2"><span className="text-[var(--crm-muted)]">Oportunidade:</span> {project.opportunity.number} - {project.opportunity.title}</div>
                )}
                {project.contract && (
                  <div className="col-span-2"><span className="text-[var(--crm-muted)]">Contrato:</span> {project.contract.number} - R$ {(project.contract.value || 0).toLocaleString('pt-BR')}</div>
                )}
              </div>
              {project.description && (
                <div className="mt-4">
                  <span className="text-[var(--crm-muted)] text-sm">Descrição:</span>
                  <p className="text-sm text-[var(--crm-ink)] mt-1">{project.description}</p>
                </div>
              )}
            </div>

            <div className="crm-panel p-6">
              <h3 className="font-bold text-[var(--crm-ink)] mb-4">Fases do Projeto</h3>
              <div className="space-y-3">
                {(project.phases || []).sort((a, b) => a.order - b.order).map(phase => (
                  <div key={phase.id} className="flex items-center gap-4 p-3 bg-[var(--crm-surface-alt)] rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-[var(--crm-ink)]">{phase.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${phaseStatusColors[phase.status] || ''}`}>
                          {phase.status?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-[var(--crm-muted)]">{phase.progressPercent || 0}%</span>
                      </div>
                    </div>
                    <div className="w-24 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${phase.progressPercent || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="crm-panel p-6">
              <h3 className="font-bold text-[var(--crm-ink)] mb-4">Health Score</h3>
              <div className="text-center">
                <div className={`text-5xl font-bold ${healthColor(project.healthScore)}`}>{project.healthScore}</div>
                <div className="text-sm text-[var(--crm-muted)] mt-1">de 100</div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 mt-3">
                  <div
                    className={`h-3 rounded-full ${project.healthScore >= 80 ? 'bg-green-500' : project.healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${project.healthScore}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="crm-panel p-6">
              <h3 className="font-bold text-[var(--crm-ink)] mb-4">Resumo</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--crm-muted)]">Progresso</span>
                  <span className="font-bold">{project.progressPercent || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--crm-muted)]">Tarefas</span>
                  <span className="font-bold">{project._count?.tasks || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--crm-muted)]">Marcos</span>
                  <span className="font-bold">{project._count?.milestones || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--crm-muted)]">Equipe</span>
                  <span className="font-bold">{project._count?.team || 0} membros</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--crm-muted)]">Horas Registradas</span>
                  <span className="font-bold">{project._count?.timelogs || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'kanban' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); fetchTasks(); }} className="crm-input w-auto text-sm">
              <option value="">Todos os status</option>
              <option value="TODO">A Fazer</option>
              <option value="IN_PROGRESS">Em Andamento</option>
              <option value="REVIEW">Em Revisão</option>
              <option value="DONE">Concluído</option>
              <option value="BLOCKED">Bloqueado</option>
            </select>
            <button onClick={() => { fetchTeam(); setShowTaskModal(true); }} className="crm-btn crm-btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Nova Tarefa
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(tasksByStatus).filter(([status]) => status !== 'BLOCKED').map(([status, statusTasks]) => (
              <div key={status} className="bg-[var(--crm-surface-alt)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-[var(--crm-ink)]">{status.replace(/_/g, ' ')}</h4>
                  <span className="text-xs bg-[var(--crm-surface)] px-2 py-0.5 rounded-full text-[var(--crm-muted)]">{statusTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {statusTasks.map(task => (
                    <div key={task.id} className="crm-panel p-3 text-sm">
                      <div className="font-medium text-[var(--crm-ink)]">{task.title}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs font-bold ${priorityColors[task.priority]}`}>{task.priority}</span>
                        <span className="text-xs text-[var(--crm-muted)]">{task.assignedTo?.name || 'Não atribuído'}</span>
                      </div>
                      {task.dueDate && (
                        <div className="text-xs text-[var(--crm-muted)] mt-1">Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</div>
                      )}
                      <div className="flex gap-1 mt-2">
                        {status !== 'TODO' && (
                          <button onClick={() => handleUpdateTaskStatus(task.id, 'TODO')} className="text-xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600">A Fazer</button>
                        )}
                        {status !== 'IN_PROGRESS' && status !== 'DONE' && (
                          <button onClick={() => handleUpdateTaskStatus(task.id, 'IN_PROGRESS')} className="text-xs px-2 py-0.5 rounded bg-blue-200 hover:bg-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-800/40">Iniciar</button>
                        )}
                        {status !== 'DONE' && (
                          <button onClick={() => handleUpdateTaskStatus(task.id, 'DONE')} className="text-xs px-2 py-0.5 rounded bg-green-200 hover:bg-green-300 dark:bg-green-900/30 dark:hover:bg-green-800/40">Concluir</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'gantt' && (
        <div className="crm-panel p-6">
          <h3 className="font-bold text-[var(--crm-ink)] mb-4">Cronograma do Projeto</h3>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-[var(--crm-muted)] text-center py-8">Nenhuma tarefa cadastrada</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  <div className="flex items-center text-xs text-[var(--crm-muted)] mb-2 border-b border-[var(--crm-border)] pb-2">
                    <div className="w-64">Tarefa</div>
                    <div className="flex-1">Linha do Tempo</div>
                  </div>
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-center py-2 border-b border-[var(--crm-border)]/50 hover:bg-[var(--crm-surface-alt)]">
                      <div className="w-64 text-sm text-[var(--crm-ink)] truncate">{task.title}</div>
                      <div className="flex-1 relative h-6">
                        <div
                          className={`absolute h-4 rounded ${
                            task.status === 'DONE' ? 'bg-green-400' :
                            task.status === 'IN_PROGRESS' ? 'bg-blue-400' :
                            task.status === 'BLOCKED' ? 'bg-red-400' : 'bg-gray-300'
                          }`}
                          style={{
                            left: task.dueDate ? `${Math.max(0, Math.min(90, ((new Date(task.dueDate) - new Date()) / (1000*60*60*24*30)) * 10 + 40))}%` : '10%',
                            width: '20%'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="crm-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[var(--crm-ink)]">Equipe do Projeto</h3>
              <button onClick={() => setShowTeamModal(true)} className="crm-btn crm-btn-primary text-sm flex items-center gap-1">
                <Plus size={14} /> Adicionar Membro
              </button>
            </div>
            {team.length === 0 ? (
              <p className="text-[var(--crm-muted)] text-center py-4">Nenhum membro na equipe</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--crm-border)]">
                      <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Membro</th>
                      <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Função</th>
                      <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Alocação</th>
                      <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Custo/Hora</th>
                      <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Status</th>
                      <th className="text-right p-2 font-semibold text-[var(--crm-ink)]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map(member => (
                      <tr key={member.id} className="border-b border-[var(--crm-border)]/50">
                        <td className="p-2">{member.user?.name}</td>
                        <td className="p-2 text-xs font-medium">{member.role?.replace(/_/g, ' ')}</td>
                        <td className="p-2">{member.allocationPercent}%</td>
                        <td className="p-2">R$ {(member.hourlyCost || 0).toFixed(2)}</td>
                        <td className="p-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${member.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {member.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <button className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'risks' && (
        <div className="crm-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[var(--crm-ink)]">Riscos do Projeto</h3>
            <button onClick={() => setShowRiskModal(true)} className="crm-btn crm-btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Novo Risco
            </button>
          </div>
          {risks.length === 0 ? (
            <p className="text-[var(--crm-muted)] text-center py-4">Nenhum risco identificado</p>
          ) : (
            <div className="space-y-3">
              {risks.map(risk => (
                <div key={risk.id} className="p-4 bg-[var(--crm-surface-alt)] rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-[var(--crm-ink)]">{risk.title}</div>
                      <div className="text-sm text-[var(--crm-muted)] mt-1">{risk.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        risk.level === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                        risk.level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        risk.level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{risk.level}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        risk.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                        risk.status === 'MITIGATING' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{risk.status?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  {risk.mitigationPlan && (
                    <div className="mt-2 text-xs text-[var(--crm-muted)]">
                      <span className="font-medium">Plano de Mitigação:</span> {risk.mitigationPlan}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="crm-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[var(--crm-ink)]">Pendências do Projeto</h3>
            <button onClick={() => setShowIssueModal(true)} className="crm-btn crm-btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Nova Pendência
            </button>
          </div>
          {issues.length === 0 ? (
            <p className="text-[var(--crm-muted)] text-center py-4">Nenhuma pendência</p>
          ) : (
            <div className="space-y-3">
              {issues.map(issue => (
                <div key={issue.id} className="p-4 bg-[var(--crm-surface-alt)] rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-[var(--crm-ink)]">{issue.title}</div>
                      <div className="text-sm text-[var(--crm-muted)] mt-1">{issue.description}</div>
                      <div className="text-xs text-[var(--crm-muted)] mt-2">
                        Reportado por: {issue.reportedBy?.name} | {new Date(issue.reportedDate).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        issue.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                        issue.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                        issue.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{issue.priority}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        issue.status === 'RESOLVED' || issue.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                        issue.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{issue.status?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="crm-panel p-6">
          <h3 className="font-bold text-[var(--crm-ink)] mb-4">Faturamento</h3>
          {billings.length === 0 ? (
            <p className="text-[var(--crm-muted)] text-center py-4">Nenhum registro de faturamento</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--crm-border)]">
                    <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">NF/OS</th>
                    <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Valor</th>
                    <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Impostos</th>
                    <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Total</th>
                    <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Vencimento</th>
                    <th className="text-left p-2 font-semibold text-[var(--crm-ink)]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billings.map(b => (
                    <tr key={b.id} className="border-b border-[var(--crm-border)]/50">
                      <td className="p-2 font-mono text-xs">{b.invoiceNumber || '-'}</td>
                      <td className="p-2">R$ {(b.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2">R$ {(b.tax || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 font-bold">R$ {(b.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2">{b.dueDate ? new Date(b.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="p-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          b.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          b.status === 'INVOICED' ? 'bg-blue-100 text-blue-700' :
                          b.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{b.status?.replace(/_/g, ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="crm-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[var(--crm-ink)]">Documentos</h3>
            <label className="crm-btn crm-btn-primary text-sm flex items-center gap-1 cursor-pointer">
              <Upload size={14} /> Upload
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
          {(!project.attachments || project.attachments.length === 0) ? (
            <p className="text-[var(--crm-muted)] text-center py-4">Nenhum documento</p>
          ) : (
            <div className="space-y-2">
              {project.attachments.map(att => (
                <div key={att.id} className="flex items-center justify-between p-3 bg-[var(--crm-surface-alt)] rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-[var(--crm-ink)]">{att.originalName}</div>
                    <div className="text-xs text-[var(--crm-muted)]">{att.category} | {(att.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <span className="text-xs text-[var(--crm-muted)]">{new Date(att.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'closure' && (
        <div className="crm-panel p-6">
          <h3 className="font-bold text-[var(--crm-ink)] mb-4">Processo de Encerramento</h3>
          {acceptances.length === 0 ? (
            <p className="text-[var(--crm-muted)] text-center py-4">Nenhum processo de aceite iniciado</p>
          ) : (
            <div className="space-y-3">
              {acceptances.map(acc => (
                <div key={acc.id} className="p-4 bg-[var(--crm-surface-alt)] rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--crm-ink)]">
                        {acc.type === 'PROVISIONAL' ? 'Termo de Recebimento Provisório' : 'Termo de Recebimento Definitivo'}
                      </div>
                      {acc.documentNumber && <div className="text-xs text-[var(--crm-muted)]">Doc: {acc.documentNumber}</div>}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      acc.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      acc.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{acc.status?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTaskModal(false)}>
          <div className="crm-panel w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--crm-border)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--crm-ink)]">Nova Tarefa</h3>
              <button onClick={() => setShowTaskModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateTask} className="p-4 space-y-3">
              <input type="text" required placeholder="Título da tarefa" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} className="crm-input w-full" />
              <textarea placeholder="Descrição" value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} className="crm-input w-full" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <select value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})} className="crm-input">
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
                <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} className="crm-input" />
              </div>
              <select value={taskForm.assignedToId} onChange={e => setTaskForm({...taskForm, assignedToId: e.target.value})} className="crm-input w-full">
                <option value="">Atribuir a...</option>
                {team.map(m => <option key={m.userId} value={m.userId}>{m.user?.name}</option>)}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTaskModal(false)} className="crm-btn crm-btn-secondary text-sm">Cancelar</button>
                <button type="submit" className="crm-btn crm-btn-primary text-sm">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTeamModal(false)}>
          <div className="crm-panel w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--crm-border)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--crm-ink)]">Adicionar Membro</h3>
              <button onClick={() => setShowTeamModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateTeamMember} className="p-4 space-y-3">
              <select required value={teamForm.userId} onChange={e => setTeamForm({...teamForm, userId: e.target.value})} className="crm-input w-full">
                <option value="">Selecione o usuário...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select value={teamForm.role} onChange={e => setTeamForm({...teamForm, role: e.target.value})} className="crm-input">
                  <option value="PROJECT_MANAGER">Gestor</option>
                  <option value="TECH_LEAD">Tech Lead</option>
                  <option value="DEVELOPER">Desenvolvedor</option>
                  <option value="ANALYST">Analista</option>
                  <option value="QA">QA</option>
                  <option value="ARCHITECT">Arquiteto</option>
                  <option value="CONSULTANT">Consultor</option>
                </select>
                <input type="number" placeholder="Alocação %" value={teamForm.allocationPercent} onChange={e => setTeamForm({...teamForm, allocationPercent: parseInt(e.target.value)})} className="crm-input" />
              </div>
              <input type="number" step="0.01" placeholder="Custo por hora (R$)" value={teamForm.hourlyCost} onChange={e => setTeamForm({...teamForm, hourlyCost: parseFloat(e.target.value)})} className="crm-input w-full" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTeamModal(false)} className="crm-btn crm-btn-secondary text-sm">Cancelar</button>
                <button type="submit" className="crm-btn crm-btn-primary text-sm">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRiskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRiskModal(false)}>
          <div className="crm-panel w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--crm-border)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--crm-ink)]">Novo Risco</h3>
              <button onClick={() => setShowRiskModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRisk} className="p-4 space-y-3">
              <input type="text" required placeholder="Título do risco" value={riskForm.title} onChange={e => setRiskForm({...riskForm, title: e.target.value})} className="crm-input w-full" />
              <textarea placeholder="Descrição" value={riskForm.description} onChange={e => setRiskForm({...riskForm, description: e.target.value})} className="crm-input w-full" rows={2} />
              <select value={riskForm.level} onChange={e => setRiskForm({...riskForm, level: e.target.value})} className="crm-input w-full">
                <option value="LOW">Baixo</option>
                <option value="MEDIUM">Médio</option>
                <option value="HIGH">Alto</option>
                <option value="CRITICAL">Crítico</option>
              </select>
              <textarea placeholder="Plano de mitigação" value={riskForm.mitigationPlan} onChange={e => setRiskForm({...riskForm, mitigationPlan: e.target.value})} className="crm-input w-full" rows={2} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRiskModal(false)} className="crm-btn crm-btn-secondary text-sm">Cancelar</button>
                <button type="submit" className="crm-btn crm-btn-primary text-sm">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowIssueModal(false)}>
          <div className="crm-panel w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--crm-border)] flex justify-between items-center">
              <h3 className="font-bold text-[var(--crm-ink)]">Nova Pendência</h3>
              <button onClick={() => setShowIssueModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateIssue} className="p-4 space-y-3">
              <input type="text" required placeholder="Título da pendência" value={issueForm.title} onChange={e => setIssueForm({...issueForm, title: e.target.value})} className="crm-input w-full" />
              <textarea placeholder="Descrição" value={issueForm.description} onChange={e => setIssueForm({...issueForm, description: e.target.value})} className="crm-input w-full" rows={2} />
              <select value={issueForm.priority} onChange={e => setIssueForm({...issueForm, priority: e.target.value})} className="crm-input w-full">
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
              <select value={issueForm.assignedToId} onChange={e => setIssueForm({...issueForm, assignedToId: e.target.value})} className="crm-input w-full">
                <option value="">Atribuir a...</option>
                {team.map(m => <option key={m.userId} value={m.userId}>{m.user?.name}</option>)}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowIssueModal(false)} className="crm-btn crm-btn-secondary text-sm">Cancelar</button>
                <button type="submit" className="crm-btn crm-btn-primary text-sm">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
