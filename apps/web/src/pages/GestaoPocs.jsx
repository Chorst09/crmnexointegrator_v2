import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Beaker,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Edit3,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const EMPTY_FORM = {
  relatedOpportunityId: '',
  relatedOpportunityNumber: '',
  relatedOpportunityTitle: '',
  title: '',
  client: '',
  solution: '',
  environment: '',
  objective: '',
  scope: '',
  successCriteria: '',
  commercialOwner: '',
  technicalOwner: '',
  startDate: '',
  dueDate: '',
  priority: 'MEDIUM',
  status: 'PLANEJAMENTO',
  progress: 0,
  nextStep: '',
  risks: '',
  resultSummary: '',
  decisionReason: '',
  notes: ''
};

const STATUS_OPTIONS = [
  { value: 'PLANEJAMENTO', label: 'Planejamento' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'VALIDACAO', label: 'Validação' },
  { value: 'BLOQUEADA', label: 'Bloqueada' },
  { value: 'APROVADA', label: 'Aprovada' },
  { value: 'DESCARTADA', label: 'Descartada' }
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' }
];

const statusLabel = (value) => STATUS_OPTIONS.find((item) => item.value === value)?.label || 'Planejamento';
const priorityLabel = (value) => PRIORITY_OPTIONS.find((item) => item.value === value)?.label || 'Média';

const inputClass = 'crm-input w-full rounded-[8px] px-4 py-3 text-[15px] outline-none transition';
const selectClass = `${inputClass} appearance-none pr-10`;
const labelClass = 'mb-2 block text-[15px] font-medium text-[var(--crm-ink)]';
const REQUIRED_FIELDS = [
  ['title', 'Título da POC'],
  ['client', 'Cliente'],
  ['solution', 'Solução / Produto'],
  ['objective', 'Objetivo'],
  ['successCriteria', 'Critérios de sucesso'],
  ['commercialOwner', 'Responsável comercial'],
  ['technicalOwner', 'Responsável técnico']
];

const toDateInput = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getFollowUps = (poc) => Array.isArray(poc?.followUps) ? poc.followUps : [];

const normalizeOpportunity = (item) => ({
  id: item.id || item.numeroOportunidade || item.numero || '',
  number: item.numeroOportunidade || item.numero || '',
  title: item.titulo || item.title || '',
  client: item.cliente || item.client || '',
  solution: item.produto || item.solution || item.solucao || ''
});

const normalizeClient = (item, fallbackType = 'B2B') => ({
  id: item.id || item.document || item.name || '',
  name: item.name || item.razaoSocial || item.cliente || '',
  document: item.document || item.cnpj || '',
  type: String(item.clientType || fallbackType || 'B2B').toUpperCase() === 'B2G' ? 'B2G' : 'B2B'
});

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="crm-card flex min-h-[118px] items-center justify-between rounded-[8px] px-6 py-5">
    <div>
      <p className="text-[15px] text-[var(--crm-muted)]">{label}</p>
      <p className="mt-2 text-[34px] font-semibold leading-none text-[var(--crm-ink)]">{value}</p>
    </div>
    <Icon className={`h-8 w-8 ${color}`} strokeWidth={2.4} />
  </div>
);

const SelectShell = ({ children }) => (
  <div className="relative">
    {children}
    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--crm-muted)]" />
  </div>
);

const Field = ({ label, required, children, className = '' }) => (
  <label className={className}>
    <span className={labelClass}>{label}{required ? ' *' : ''}</span>
    {children}
  </label>
);

export default function GestaoPocs() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPreVendasDashboard = Boolean(location.state?.fromPreVendasDashboard);
  const returnToPreVendasDashboard = () => navigate(location.state?.returnTo || '/pre-vendas');

  const [pocs, setPocs] = useState([]);
  const [stats, setStats] = useState({ total: 0, andamento: 0, bloqueadas: 0, aprovadas: 0, atrasadas: 0 });
  const [opportunities, setOpportunities] = useState([]);
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPoc, setEditingPoc] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedPocId, setExpandedPocId] = useState(null);
  const [followUpForms, setFollowUpForms] = useState({});
  const [followUpSaving, setFollowUpSaving] = useState({});

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    const query = params.toString();
    return buildApiUrl(`/pre-sales-pocs${query ? `?${query}` : ''}`);
  }, [priorityFilter, searchTerm, statusFilter]);

  const loadPocs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl, { headers: getAuthHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Erro ao carregar POCs');
      setPocs(Array.isArray(payload.data) ? payload.data : []);
      setStats(payload.stats || { total: 0, andamento: 0, bloqueadas: 0, aprovadas: 0, atrasadas: 0 });
    } catch (err) {
      setError(err.message || 'Erro ao carregar POCs');
    } finally {
      setLoading(false);
    }
  };

  const loadOpportunities = async () => {
    try {
      const response = await fetch(buildApiUrl('/prevendas-cadastros/oportunidades'), { headers: getAuthHeaders() });
      const payload = await response.json().catch(() => ({}));
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload.oportunidades)
            ? payload.oportunidades
            : [];
      setOpportunities(list.map(normalizeOpportunity).filter((item) => item.id || item.number || item.title));
    } catch {
      setOpportunities([]);
    }
  };

  const loadClients = async () => {
    try {
      const [b2bResponse, b2gResponse] = await Promise.all([
        fetch(buildApiUrl('/companies?clientType=B2B'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/companies?clientType=B2G'), { headers: getAuthHeaders() })
      ]);

      const [b2bPayload, b2gPayload] = await Promise.all([
        b2bResponse.json().catch(() => []),
        b2gResponse.json().catch(() => [])
      ]);

      const b2bList = Array.isArray(b2bPayload) ? b2bPayload : Array.isArray(b2bPayload.data) ? b2bPayload.data : [];
      const b2gList = Array.isArray(b2gPayload) ? b2gPayload : Array.isArray(b2gPayload.data) ? b2gPayload.data : [];
      const byId = new Map();

      [...b2bList.map((item) => normalizeClient(item, 'B2B')), ...b2gList.map((item) => normalizeClient(item, 'B2G'))]
        .filter((item) => item.id && item.name)
        .forEach((item) => {
          if (!byId.has(item.id)) byId.set(item.id, item);
        });

      setClients(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    } catch {
      setClients([]);
    }
  };

  useEffect(() => {
    loadPocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  useEffect(() => {
    loadOpportunities();
    loadClients();
  }, []);

  const openNewModal = () => {
    setError('');
    setFormError('');
    setEditingPoc(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (poc) => {
    setError('');
    setFormError('');
    setEditingPoc(poc);
    setForm({
      ...EMPTY_FORM,
      ...poc,
      startDate: toDateInput(poc.startDate),
      dueDate: toDateInput(poc.dueDate),
      progress: Number(poc.progress || 0)
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingPoc(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const updateForm = (field, value) => {
    setFormError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateFollowUpForm = (pocId, field, value) => {
    setError('');
    setFollowUpForms((current) => ({
      ...current,
      [pocId]: {
        note: '',
        nextStep: '',
        ...current[pocId],
        [field]: value
      }
    }));
  };

  const handleClientChange = (value) => {
    const client = clients.find((item) => item.id === value);
    updateForm('client', client?.name || value);
  };

  const handleOpportunityChange = (value) => {
    if (!value) {
      setForm((current) => ({
        ...current,
        relatedOpportunityId: '',
        relatedOpportunityNumber: '',
        relatedOpportunityTitle: ''
      }));
      return;
    }

    const opportunity = opportunities.find((item) => item.id === value || item.number === value);
    setForm((current) => ({
      ...current,
      relatedOpportunityId: opportunity?.id || value,
      relatedOpportunityNumber: opportunity?.number || '',
      relatedOpportunityTitle: opportunity?.title || '',
      title: current.title || opportunity?.title || '',
      client: current.client || opportunity?.client || '',
      solution: current.solution || opportunity?.solution || ''
    }));
  };

  const savePoc = async (event) => {
    event.preventDefault();
    const missing = REQUIRED_FIELDS
      .filter(([field]) => !String(form[field] || '').trim())
      .map(([, label]) => label);

    if (missing.length) {
      setFormError(`${missing.join(', ')} são obrigatórios.`);
      return;
    }

    setSaving(true);
    setError('');
    setFormError('');
    try {
      const endpoint = editingPoc ? `/pre-sales-pocs/${editingPoc.id}` : '/pre-sales-pocs';
      const response = await fetch(buildApiUrl(endpoint), {
        method: editingPoc ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(form)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Erro ao salvar POC');
      setModalOpen(false);
      setEditingPoc(null);
      setForm(EMPTY_FORM);
      await loadPocs();
    } catch (err) {
      setError(err.message || 'Erro ao salvar POC');
      setFormError(err.message || 'Erro ao salvar POC');
    } finally {
      setSaving(false);
    }
  };

  const actionPoc = async (poc, action) => {
    const actionLabel = action === 'approve' ? 'aprovar' : 'descartar';
    if (!window.confirm(`Deseja ${actionLabel} esta POC?`)) return;
    try {
      const response = await fetch(buildApiUrl(`/pre-sales-pocs/${poc.id}/${action}`), {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `Erro ao ${actionLabel} POC`);
      await loadPocs();
    } catch (err) {
      setError(err.message || `Erro ao ${actionLabel} POC`);
    }
  };

  const deletePoc = async (poc) => {
    if (!window.confirm('Deseja excluir esta POC?')) return;
    try {
      const response = await fetch(buildApiUrl(`/pre-sales-pocs/${poc.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Erro ao excluir POC');
      await loadPocs();
    } catch (err) {
      setError(err.message || 'Erro ao excluir POC');
    }
  };

  const saveFollowUp = async (poc) => {
    const current = followUpForms[poc.id] || {};
    const note = String(current.note || '').trim();
    if (!note) {
      setError('Informe o acompanhamento antes de salvar.');
      setExpandedPocId(poc.id);
      return;
    }

    setFollowUpSaving((state) => ({ ...state, [poc.id]: true }));
    setError('');

    try {
      const response = await fetch(buildApiUrl(`/pre-sales-pocs/${poc.id}/follow-ups`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          note,
          nextStep: current.nextStep || '',
          status: poc.status,
          progress: poc.progress
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Erro ao salvar acompanhamento');
      setFollowUpForms((state) => ({ ...state, [poc.id]: { note: '', nextStep: '' } }));
      setExpandedPocId(poc.id);
      await loadPocs();
    } catch (err) {
      setError(err.message || 'Erro ao salvar acompanhamento');
    } finally {
      setFollowUpSaving((state) => ({ ...state, [poc.id]: false }));
    }
  };

  const deleteFollowUp = async (poc, followUp) => {
    if (!window.confirm('Deseja excluir este acompanhamento?')) return;

    try {
      const response = await fetch(buildApiUrl(`/pre-sales-pocs/${poc.id}/follow-ups/${followUp.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Erro ao excluir acompanhamento');
      setExpandedPocId(poc.id);
      await loadPocs();
    } catch (err) {
      setError(err.message || 'Erro ao excluir acompanhamento');
    }
  };

  return (
    <div className="gestao-pocs-module min-h-screen bg-transparent px-6 py-8 text-[var(--crm-ink)]">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-4">
            <Beaker className="h-10 w-10 text-[var(--crm-accent)]" strokeWidth={2.2} />
            <h1 className="text-[34px] font-semibold leading-tight text-[var(--crm-ink)]">Gestão de POCs</h1>
          </div>
          <p className="mt-2 text-[18px] text-[var(--crm-muted)]">Planeje, execute e valide provas de conceito com critérios objetivos e decisão registrada.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {fromPreVendasDashboard && (
            <button
              type="button"
              onClick={returnToPreVendasDashboard}
              className="crm-btn crm-btn-secondary inline-flex h-[58px] items-center justify-center gap-3 rounded-[8px] px-6 text-[16px] font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar ao Dashboard
            </button>
          )}
          <button
            type="button"
            onClick={openNewModal}
            className="crm-btn crm-btn-primary inline-flex h-[58px] items-center justify-center gap-4 rounded-[8px] px-8 text-[17px] font-medium"
          >
            <Plus className="h-5 w-5" />
            Nova POC
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={Beaker} color="text-sky-400" />
        <StatCard label="Em andamento" value={stats.andamento} icon={CalendarClock} color="text-blue-400" />
        <StatCard label="Bloqueadas" value={stats.bloqueadas} icon={AlertTriangle} color="text-amber-400" />
        <StatCard label="Aprovadas" value={stats.aprovadas} icon={CheckCircle2} color="text-emerald-400" />
        <StatCard label="Atrasadas" value={stats.atrasadas} icon={XCircle} color="text-rose-400" />
      </div>

      <section className="crm-panel rounded-[8px] p-6">
        <h2 className="mb-7 text-[28px] font-semibold text-[var(--crm-ink)]">Portfólio de POCs</h2>

        <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_300px_250px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--crm-muted)]" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`${inputClass} pl-12`}
              placeholder="Buscar por POC, cliente, solução ou responsável..."
            />
          </div>
          <SelectShell>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}>
              <option value="all">Todos os status</option>
              {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </SelectShell>
          <SelectShell>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className={selectClass}>
              <option value="all">Todas prioridades</option>
              {PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </SelectShell>
        </div>

        {error && <div className="mb-4 rounded-[8px] border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        <div className="overflow-x-auto rounded-[8px] border border-[var(--crm-border)]">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.78)] text-[15px] text-[var(--crm-muted)]">
              <tr>
                <th className="px-5 py-5 font-medium">POC / Cliente</th>
                <th className="px-5 py-5 font-medium">Responsáveis</th>
                <th className="px-5 py-5 font-medium">Prazo</th>
                <th className="px-5 py-5 font-medium">Progresso</th>
                <th className="px-5 py-5 font-medium">Status</th>
                <th className="px-5 py-5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.68)]">
              {loading ? (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Carregando POCs...</td></tr>
              ) : pocs.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-10 text-center text-slate-400">Nenhuma POC registrada.</td></tr>
              ) : pocs.map((poc) => {
                const followUps = getFollowUps(poc);
                const isExpanded = expandedPocId === poc.id;
                const followUpForm = followUpForms[poc.id] || { note: '', nextStep: '' };

                return (
                  <Fragment key={poc.id}>
                    <tr className="align-middle">
                      <td className="max-w-[430px] px-5 py-6">
                        <p className="font-semibold text-[var(--crm-ink)]">{poc.title}</p>
                        <p className="mt-1 text-sm text-[var(--crm-muted)]">{poc.client}</p>
                        <p className="text-sm text-[var(--crm-muted)]">{poc.solution}</p>
                        <button
                          type="button"
                          onClick={() => setExpandedPocId(isExpanded ? null : poc.id)}
                          className="mt-3 inline-flex items-center gap-2 rounded-[8px] border border-[var(--crm-border)] px-3 py-1 text-xs font-medium text-[var(--crm-accent)] hover:border-[rgb(var(--crm-accent-rgb)_/_0.52)]"
                        >
                          <MessageSquare className="h-4 w-4" />
                          {followUps.length} acompanhamento{followUps.length === 1 ? '' : 's'}
                        </button>
                        {poc.relatedOpportunityNumber && <p className="mt-2 text-sm font-medium text-[var(--crm-accent)]">{poc.relatedOpportunityNumber}</p>}
                      </td>
                      <td className="px-5 py-6 text-sm text-[var(--crm-ink)]">
                        <p>{poc.technicalOwner}</p>
                        <p className="text-[var(--crm-muted)]">Comercial:</p>
                        <p>{poc.commercialOwner}</p>
                      </td>
                      <td className="px-5 py-6">
                        <p className="text-sm text-[var(--crm-ink)]">{formatDate(poc.dueDate)}</p>
                        <span className="mt-2 inline-flex rounded-full border border-[var(--crm-border)] px-3 py-1 text-xs font-medium text-[var(--crm-ink)]">{priorityLabel(poc.priority)}</span>
                      </td>
                      <td className="px-5 py-6">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)]">
                            <div className="h-full rounded-full bg-[var(--crm-accent)]" style={{ width: `${Number(poc.progress || 0)}%` }} />
                          </div>
                          <span className="text-sm text-[var(--crm-ink)]">{Number(poc.progress || 0)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-6">
                        <span className="inline-flex rounded-full border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.76)] px-4 py-1 text-sm text-[var(--crm-ink)]">{statusLabel(poc.status)}</span>
                      </td>
                      <td className="px-5 py-6">
                        <div className="flex flex-wrap items-center justify-end gap-4">
                          <button type="button" onClick={() => setExpandedPocId(isExpanded ? null : poc.id)} className="text-sm font-medium text-[var(--crm-accent)] hover:opacity-80">
                            {isExpanded ? 'Ocultar' : 'Acompanhar'}
                          </button>
                          <button type="button" onClick={() => actionPoc(poc, 'approve')} className="text-sm font-medium text-emerald-400 hover:text-emerald-300">Aprovar</button>
                          <button type="button" onClick={() => actionPoc(poc, 'discard')} className="text-sm font-medium text-rose-400 hover:text-rose-300">Descartar</button>
                          <button type="button" onClick={() => openEditModal(poc)} className="text-[var(--crm-ink)] hover:text-[var(--crm-accent)]" aria-label="Editar POC">
                            <Edit3 className="h-5 w-5" />
                          </button>
                          <button type="button" onClick={() => deletePoc(poc)} className="text-rose-400 hover:text-rose-300" aria-label="Excluir POC">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="6" className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.68)] px-5 py-6">
                          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
                            <div>
                              <div className="mb-4 flex items-center justify-between gap-4">
                                <h3 className="text-lg font-semibold text-[var(--crm-ink)]">Acompanhamentos</h3>
                                <span className="text-sm text-[var(--crm-muted)]">{followUps.length} registro{followUps.length === 1 ? '' : 's'}</span>
                              </div>
                              {followUps.length === 0 ? (
                                <p className="rounded-[8px] border border-dashed border-[var(--crm-border)] px-4 py-6 text-sm text-[var(--crm-muted)]">Nenhum acompanhamento registrado para esta POC.</p>
                              ) : (
                                <div className="grid gap-3">
                                  {followUps.map((item) => (
                                    <div key={item.id} className="crm-card rounded-[8px] p-4">
                                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-medium text-[var(--crm-ink)]">{item.createdByName || 'Usuário'}</p>
                                          <p className="text-xs text-[var(--crm-muted)]">{formatDateTime(item.createdAt)}</p>
                                        </div>
                                        <button type="button" onClick={() => deleteFollowUp(poc, item)} className="text-xs font-medium text-rose-300 hover:text-rose-200">Excluir</button>
                                      </div>
                                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--crm-ink)]">{item.note}</p>
                                      {item.nextStep && <p className="mt-3 text-sm text-[var(--crm-accent)]"><span className="font-medium">Próximo passo:</span> {item.nextStep}</p>}
                                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--crm-muted)]">
                                        {item.status && <span className="rounded-full border border-[var(--crm-border)] px-3 py-1">{statusLabel(item.status)}</span>}
                                        {item.progress !== null && item.progress !== undefined && <span className="rounded-full border border-[var(--crm-border)] px-3 py-1">{Number(item.progress)}%</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="crm-card rounded-[8px] p-4">
                              <h4 className="mb-4 text-base font-semibold text-[var(--crm-ink)]">Novo acompanhamento</h4>
                              <textarea
                                value={followUpForm.note}
                                onChange={(event) => updateFollowUpForm(poc.id, 'note', event.target.value)}
                                className={`${inputClass} min-h-[132px]`}
                                placeholder="Descreva contato, validação realizada, pendência ou decisão técnica..."
                              />
                              <textarea
                                value={followUpForm.nextStep}
                                onChange={(event) => updateFollowUpForm(poc.id, 'nextStep', event.target.value)}
                                className={`${inputClass} mt-3 min-h-[86px]`}
                                placeholder="Próximo passo..."
                              />
                              <button
                                type="button"
                                onClick={() => saveFollowUp(poc)}
                                disabled={Boolean(followUpSaving[poc.id])}
                                className="crm-btn crm-btn-primary mt-4 inline-flex h-11 items-center justify-center gap-3 rounded-[8px] px-5 text-sm font-medium disabled:cursor-wait disabled:opacity-70"
                              >
                                <Send className="h-4 w-4" />
                                {followUpSaving[poc.id] ? 'Salvando...' : 'Salvar acompanhamento'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-y-0 left-0 right-0 z-50 overflow-y-auto bg-black/70 p-4 lg:left-[312px]">
          <form onSubmit={savePoc} className="crm-panel mx-auto my-2 w-full max-w-[1320px] rounded-[8px] p-6 shadow-2xl sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-6">
              <div>
                <h2 className="text-[26px] font-semibold text-[var(--crm-ink)]">{editingPoc ? 'Editar POC' : 'Nova POC'}</h2>
                <p className="mt-2 text-[17px] text-[var(--crm-muted)]">Registre escopo, critérios mensuráveis, responsáveis, prazo e resultado esperado.</p>
              </div>
              <button type="button" onClick={closeModal} className="text-[var(--crm-muted)] hover:text-[var(--crm-ink)]" aria-label="Fechar">
                <X className="h-7 w-7" />
              </button>
            </div>

            {formError && (
              <div className="mb-6 rounded-[8px] border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {formError}
              </div>
            )}

            <div className="grid gap-7">
              <Field label="Registro de Oportunidade relacionado">
                <SelectShell>
                  <select value={form.relatedOpportunityId || ''} onChange={(event) => handleOpportunityChange(event.target.value)} className={selectClass}>
                    <option value="">Sem vínculo com RO</option>
                    {opportunities.map((item) => (
                      <option key={`${item.id}-${item.number}`} value={item.id || item.number}>
                        {item.number ? `${item.number} - ` : ''}{item.title || item.client}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              </Field>

              <div className="grid gap-7 lg:grid-cols-2">
                <Field label="Título da POC" required>
                  <input required value={form.title} onChange={(event) => updateForm('title', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Cliente" required>
                  <SelectShell>
                    <select required value={clients.find((item) => item.name === form.client)?.id || form.client} onChange={(event) => handleClientChange(event.target.value)} className={selectClass}>
                      <option value="">Selecione um cliente cadastrado</option>
                      {form.client && !clients.some((item) => item.name === form.client) && (
                        <option value={form.client}>{form.client}</option>
                      )}
                      {clients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}{item.document ? ` - ${item.document}` : ''} ({item.type})
                        </option>
                      ))}
                    </select>
                  </SelectShell>
                </Field>
                <Field label="Solução / Produto" required>
                  <input required value={form.solution} onChange={(event) => updateForm('solution', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Ambiente">
                  <input value={form.environment || ''} onChange={(event) => updateForm('environment', event.target.value)} className={inputClass} placeholder="Cloud, laboratório, cliente..." />
                </Field>
              </div>

              <Field label="Objetivo" required>
                <textarea required value={form.objective} onChange={(event) => updateForm('objective', event.target.value)} className={`${inputClass} min-h-[112px]`} />
              </Field>
              <Field label="Escopo">
                <textarea value={form.scope || ''} onChange={(event) => updateForm('scope', event.target.value)} className={`${inputClass} min-h-[112px]`} />
              </Field>
              <Field label="Critérios de sucesso" required>
                <textarea required value={form.successCriteria} onChange={(event) => updateForm('successCriteria', event.target.value)} className={`${inputClass} min-h-[112px]`} placeholder="Defina critérios objetivos e mensuráveis." />
              </Field>

              <div className="grid gap-7 lg:grid-cols-2">
                <Field label="Responsável comercial" required>
                  <input required value={form.commercialOwner} onChange={(event) => updateForm('commercialOwner', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Responsável técnico" required>
                  <input required value={form.technicalOwner} onChange={(event) => updateForm('technicalOwner', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Data de início">
                  <input type="date" value={form.startDate || ''} onChange={(event) => updateForm('startDate', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Prazo de conclusão">
                  <input type="date" value={form.dueDate || ''} onChange={(event) => updateForm('dueDate', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Prioridade">
                  <SelectShell>
                    <select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)} className={selectClass}>
                      {PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </SelectShell>
                </Field>
                <Field label="Status">
                  <SelectShell>
                    <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className={selectClass}>
                      {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </SelectShell>
                </Field>
              </div>

              <Field label={`Progresso (${Number(form.progress || 0)}%)`}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Number(form.progress || 0)}
                  onChange={(event) => updateForm('progress', Number(event.target.value))}
                  className="w-full accent-sky-500"
                />
              </Field>

              <div className="grid gap-7 lg:grid-cols-2">
                <Field label="Próximo passo">
                  <textarea value={form.nextStep || ''} onChange={(event) => updateForm('nextStep', event.target.value)} className={`${inputClass} min-h-[112px]`} />
                </Field>
                <Field label="Riscos e bloqueios">
                  <textarea value={form.risks || ''} onChange={(event) => updateForm('risks', event.target.value)} className={`${inputClass} min-h-[112px]`} />
                </Field>
                <Field label="Resumo do resultado">
                  <textarea value={form.resultSummary || ''} onChange={(event) => updateForm('resultSummary', event.target.value)} className={`${inputClass} min-h-[112px]`} />
                </Field>
                <Field label="Motivo da decisão">
                  <textarea value={form.decisionReason || ''} onChange={(event) => updateForm('decisionReason', event.target.value)} className={`${inputClass} min-h-[112px]`} />
                </Field>
              </div>

              <Field label="Observações">
                <textarea value={form.notes || ''} onChange={(event) => updateForm('notes', event.target.value)} className={`${inputClass} min-h-[120px]`} />
              </Field>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="crm-btn crm-btn-secondary rounded-[8px] px-7 py-3 text-[16px]">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="crm-btn crm-btn-primary rounded-[8px] px-7 py-3 text-[16px] font-medium disabled:cursor-wait disabled:opacity-70">
                {saving ? 'Salvando...' : 'Salvar POC'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
