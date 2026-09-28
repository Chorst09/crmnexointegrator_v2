import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import PageHeader from '../components/PageHeader';
import ProjectCard from '../components/ProjectCard';
import { FolderKanban, Plus, Rocket, AlertTriangle, TrendingUp, Search, Filter, Grid, List, Calendar, DollarSign, Users, X, ChevronDown } from 'lucide-react';

const kpiStyles = {
  blue: {
    card: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700',
    iconBg: 'bg-blue-200 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  green: {
    card: 'from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700',
    iconBg: 'bg-green-200 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400'
  },
  red: {
    card: 'from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700',
    iconBg: 'bg-red-200 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400'
  },
  purple: {
    card: 'from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700',
    iconBg: 'bg-purple-200 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400'
  },
  orange: {
    card: 'from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700',
    iconBg: 'bg-orange-200 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400'
  }
};

const statusMetrics = {
  PLANEJADO: { color: 'slate', icon: '📋', label: 'Planejado' },
  EM_ANDAMENTO: { color: 'blue', icon: '🚀', label: 'Em Execução' },
  PAUSADO: { color: 'yellow', icon: '⏸️', label: 'Pausado' },
  CONCLUIDO: { color: 'green', icon: '✅', label: 'Concluído' },
  CANCELADO: { color: 'red', icon: '❌', label: 'Cancelado' }
};

const typeEmoji = { B2B: '🏢', B2G: '🏛️' };

export default function ProjetosV2() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid ou list
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'B2B', companyId: '', projectManagerId: '',
    budget: '', description: '', opportunityId: '',
    plannedStartDate: '', plannedEndDate: ''
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [projRes, dashRes] = await Promise.all([
        fetch(buildApiUrl('/projetos'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/projetos/dashboard'), { headers: getAuthHeaders() })
      ]);
      if (projRes.ok) { const d = await projRes.json(); setProjects(d.projects || d || []); }
      if (dashRes.ok) setDashboard(await dashRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openModal = async () => {
    setError('');
    setForm({ name: '', type: 'B2B', companyId: '', projectManagerId: '', budget: '', description: '', opportunityId: '', plannedStartDate: '', plannedEndDate: '' });
    setShowCreateModal(true);
    try {
      const [cRes, uRes, oRes] = await Promise.all([
        fetch(buildApiUrl('/companies'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/users'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/opportunities?stage=WON'), { headers: getAuthHeaders() })
      ]);
      if (cRes.ok) { const d = await cRes.json(); setCompanies(Array.isArray(d) ? d : d.companies || d.data || []); }
      if (uRes.ok) { const d = await uRes.json(); setUsers(Array.isArray(d) ? d : d.users || d.data || []); }
      if (oRes.ok) { const d = await oRes.json(); setOpportunities(Array.isArray(d) ? d : d.opportunities || []); }
    } catch (e) { console.error('Erro ao carregar dados:', e); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.companyId) { setError('Selecione o cliente'); return; }
    if (!form.projectManagerId) { setError('Selecione o gestor'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(buildApiUrl('/projetos'), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, budget: parseFloat(form.budget) || 0 })
      });
      if (res.ok) {
        const p = await res.json();
        setShowCreateModal(false);
        navigate(`/projetos/${p.id}`);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || `Erro ${res.status}`);
      }
    } catch (e) { setError('Erro de conexão'); }
    finally { setSaving(false); }
  };

  const filtered = useMemo(() => projects.filter(p => {
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase()) && !p.number?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterType && p.type !== filterType) return false;
    return true;
  }), [projects, search, filterStatus, filterType]);

  const statusCounts = useMemo(() => {
    const counts = {};
    Object.keys(statusMetrics).forEach(s => counts[s] = projects.filter(p => p.status === s).length);
    return counts;
  }, [projects]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Projetos"
        subtitle="Acompanhe o ciclo de vida completo — B2B e B2G"
        gradient="green"
        actions={[{ label: 'Novo Projeto', onClick: openModal, icon: Plus, variant: 'primary' }]}
      />

      {/* KPI Dashboard */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { icon: FolderKanban, label: 'Total', value: dashboard.total, color: 'blue', trend: '+2' },
            { icon: Rocket, label: 'Em Execução', value: dashboard.active, color: 'green', trend: '↑' },
            { icon: AlertTriangle, label: 'Com Atraso', value: dashboard.delayed, color: 'red', trend: dashboard.delayed > 0 ? '⚠️' : '✓' },
            { icon: TrendingUp, label: 'Margem Média', value: `${(dashboard.avgMargin||0).toFixed(1)}%`, color: 'purple', trend: '→' },
            { icon: DollarSign, label: 'Budget Total', value: `R$ ${(projects.reduce((s,p)=>s+(p.budget||0),0)/1000).toFixed(0)}K`, color: 'orange', trend: '💰' }
          ].map((kpi, i) => {
            const Icon = kpi.icon;
            const styles = kpiStyles[kpi.color] || kpiStyles.blue;
            return (
              <div key={i} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${styles.card} p-4 transition-all hover:shadow-lg`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{kpi.label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{kpi.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{kpi.trend}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${styles.iconBg}`}>
                    <Icon size={24} className={styles.iconColor} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters e View Mode */}
      <div className="crm-panel p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por nome ou número..." value={search} onChange={e => setSearch(e.target.value)} className="crm-input pl-9 w-full" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="crm-input w-auto">
            <option value="">Todos os status</option>
            {Object.entries(statusMetrics).map(([k, v]) => (
              <option key={k} value={k}>{v.label} ({statusCounts[k]})</option>
            ))}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="crm-input w-auto">
            <option value="">Todos os tipos</option>
            <option value="B2B">🏢 B2B</option>
            <option value="B2G">🏛️ B2G</option>
          </select>
          <div className="flex gap-1 border border-slate-300 dark:border-slate-600 rounded-lg p-1">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
              <Grid size={18} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Projetos Grid/List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Carregando projetos...</div>
      ) : filtered.length === 0 ? (
        <div className="crm-panel p-12 text-center space-y-4">
          <FolderKanban size={48} className="mx-auto opacity-30 text-slate-400" />
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum projeto encontrado</p>
            <p className="text-sm text-slate-500 mt-1">Clique em "Novo Projeto" para começar</p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projetos/${p.id}`)} />
          ))}
        </div>
      ) : (
        <div className="crm-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left p-3 font-semibold">Projeto</th>
                <th className="text-left p-3 font-semibold">Cliente</th>
                <th className="text-left p-3 font-semibold">Status</th>
                <th className="text-left p-3 font-semibold">Progresso</th>
                <th className="text-left p-3 font-semibold">Gestor</th>
                <th className="text-right p-3 font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate(`/projetos/${p.id}`)}>
                  <td className="p-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.number}</p>
                    </div>
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{p.company?.name || '-'}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800">
                      {statusMetrics[p.status]?.icon} {statusMetrics[p.status]?.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{width: `${p.progressPercent||0}%`}} />
                    </div>
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">{p.projectManager?.name || '-'}</td>
                  <td className="p-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${p.id}`); }} className="text-blue-600 hover:text-blue-700 font-medium">
                      Abrir →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo Projeto */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="crm-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><FolderKanban size={24} /> Novo Projeto</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-600 dark:text-red-400">{error}</div>}
              
              <input required type="text" placeholder="Nome do projeto" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="crm-input w-full" />
              
              <div className="grid grid-cols-2 gap-4">
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="crm-input">
                  <option value="B2B">🏢 B2B</option>
                  <option value="B2G">🏛️ B2G</option>
                </select>
                <input type="number" step="0.01" placeholder="Budget (R$)" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className="crm-input" />
              </div>

              <select required value={form.companyId} onChange={e => setForm({...form, companyId: e.target.value})} className="crm-input w-full">
                <option value="">Selecione o cliente...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select required value={form.projectManagerId} onChange={e => setForm({...form, projectManagerId: e.target.value})} className="crm-input w-full">
                <option value="">Selecione o gestor...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>

              {opportunities.length > 0 && (
                <select value={form.opportunityId} onChange={e => setForm({...form, opportunityId: e.target.value})} className="crm-input w-full">
                  <option value="">Sem vínculo de oportunidade</option>
                  {opportunities.map(o => <option key={o.id} value={o.id}>{o.number} — {o.title}</option>)}
                </select>
              )}

              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={form.plannedStartDate} onChange={e => setForm({...form, plannedStartDate: e.target.value})} className="crm-input" />
                <input type="date" value={form.plannedEndDate} onChange={e => setForm({...form, plannedEndDate: e.target.value})} className="crm-input" />
              </div>

              <textarea placeholder="Descrição/Escopo" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="crm-input w-full" rows={3} />

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="crm-btn crm-btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="crm-btn crm-btn-primary flex items-center gap-2">
                  {saving ? <>Criando...</> : <><Plus size={16} /> Criar Projeto</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
