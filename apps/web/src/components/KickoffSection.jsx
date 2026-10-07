/**
 * KickoffSection — exibida dentro do modal de detalhes de uma Oportunidade.
 * Carrega as reuniões de kickoff vinculadas e permite criar uma nova a partir
 * dos modelos "Kickoff Interno" e "Kickoff Externo".
 */
import { useState, useEffect, useCallback } from 'react';
import { buildApiUrl } from '../config/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

const PHASE_LABELS = {
  ENTENDIMENTO_OPORTUNIDADE: 'Entendimento',
  APRESENTACAO_PROPOSTA: 'Proposta',
  FECHAMENTO_PROJETO: 'Fechamento',
  ALINHAMENTO_INTERNO: 'Kickoff Interno',
  ALINHAMENTO_EXTERNO: 'Kickoff Externo'
};

const STATUS_STYLES = {
  AGENDADA:   'border-blue-500/40 bg-blue-500/10 text-blue-300',
  REALIZADA:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  CANCELADA:  'border-red-500/40 bg-red-500/10 text-red-300',
  REAGENDADA: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
};

const STATUS_LABELS = {
  AGENDADA: 'Agendada', REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada', REAGENDADA: 'Reagendada'
};

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';

// ── component ─────────────────────────────────────────────────────────────────

export default function KickoffSection({ opportunityId, onNavigate, kickoffRoute = '/kickoff' }) {
  const [meetings, setMeetings] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [newForm, setNewForm] = useState({
    title: '',
    phase: 'ALINHAMENTO_INTERNO',
    scheduledDate: '',
    startTime: '',
    platform: 'MEET',
    meetingLink: '',
    templateId: ''
  });

  // Carrega reuniões já existentes para esta oportunidade
  const loadMeetings = useCallback(async () => {
    if (!opportunityId) return;
    setLoading(true);
    try {
      const res = await fetch(
        buildApiUrl(`/kickoff/meetings?opportunityId=${encodeURIComponent(opportunityId)}&limit=50`),
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
      }
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  // Carrega templates disponíveis
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/kickoff/templates'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      }
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
    loadTemplates();
  }, [loadMeetings, loadTemplates]);

  // Filtra templates pela fase selecionada
  const filteredTemplates = templates.filter(t => !newForm.phase || t.phase === newForm.phase);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newForm.title.trim() || !newForm.scheduledDate) {
      setFeedback('Título e data são obrigatórios.');
      return;
    }
    setCreating(true);
    setFeedback('');
    try {
      const payload = {
        title: newForm.title.trim(),
        phase: newForm.phase,
        scheduledDate: newForm.scheduledDate,
        startTime: newForm.startTime || undefined,
        platform: newForm.platform,
        meetingLink: newForm.meetingLink || undefined,
        templateId: newForm.templateId || undefined,
        opportunityId
      };
      const res = await fetch(buildApiUrl('/kickoff/meetings'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao criar reunião');
      }
      const created = await res.json();
      setMeetings(prev => [created, ...prev]);
      setShowNewForm(false);
      setNewForm({ title: '', phase: 'ALINHAMENTO_INTERNO', scheduledDate: '', startTime: '', platform: 'MEET', meetingLink: '', templateId: '' });
      setFeedback('');
    } catch (err) {
      setFeedback(err.message || 'Erro ao criar reunião.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (meetingId) => {
    if (!confirm('Deseja realmente excluir esta reunião?')) return;
    
    setDeleting(meetingId);
    try {
      const res = await fetch(buildApiUrl(`/kickoff/meetings/${meetingId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao excluir reunião');
      }
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
    } catch (err) {
      alert(err.message || 'Erro ao excluir reunião.');
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (meeting) => {
    setEditingMeeting({
      id: meeting.id,
      title: meeting.title || '',
      phase: meeting.phase || 'ALINHAMENTO_INTERNO',
      scheduledDate: meeting.scheduledDate ? meeting.scheduledDate.split('T')[0] : '',
      startTime: meeting.startTime || '',
      platform: meeting.platform || 'MEET',
      meetingLink: meeting.meetingLink || '',
      notes: meeting.notes || ''
    });
  };

  const handleUpdateMeeting = async (e) => {
    e.preventDefault();
    if (!editingMeeting.title.trim() || !editingMeeting.scheduledDate) {
      alert('Título e data são obrigatórios.');
      return;
    }
    
    try {
      const payload = {
        title: editingMeeting.title.trim(),
        phase: editingMeeting.phase,
        scheduledDate: editingMeeting.scheduledDate,
        startTime: editingMeeting.startTime || undefined,
        platform: editingMeeting.platform,
        meetingLink: editingMeeting.meetingLink || undefined,
        notes: editingMeeting.notes || undefined
      };
      const res = await fetch(buildApiUrl(`/kickoff/meetings/${editingMeeting.id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao atualizar reunião');
      }
      const updated = await res.json();
      setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
      setEditingMeeting(null);
    } catch (err) {
      alert(err.message || 'Erro ao atualizar reunião.');
    }
  };

  const inputCls = 'w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-[var(--crm-muted)] mb-1';

  return (
    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--crm-ink)]">Reuniões de Kickoff</h3>
          <p className="mt-0.5 text-sm text-[var(--crm-muted)]">
            Agendar e acompanhar kickoffs vinculados a esta oportunidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowNewForm(v => !v); setFeedback(''); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            {showNewForm ? '✕ Cancelar' : '+ Nova Reunião'}
          </button>
        </div>
      </div>

      {/* Formulário de criação */}
      {showNewForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Título da Reunião *</label>
              <input
                className={inputCls}
                required
                value={newForm.title}
                onChange={e => setNewForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Kickoff Interno — Projeto X"
              />
            </div>

            <div>
              <label className={labelCls}>Fase *</label>
              <select
                className={inputCls}
                value={newForm.phase}
                onChange={e => setNewForm(p => ({ ...p, phase: e.target.value, templateId: '' }))}
              >
                {Object.entries(PHASE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Modelo (opcional)</label>
              <select
                className={inputCls}
                value={newForm.templateId}
                onChange={e => setNewForm(p => ({ ...p, templateId: e.target.value }))}
              >
                <option value="">Sem modelo / padrão da fase</option>
                {filteredTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {newForm.phase === 'ALINHAMENTO_INTERNO' && (
                <p className="mt-1 text-[11px] text-slate-400">📋 Use o Modelo de Kickoff Interno para alinhar escopo, riscos e responsabilidades com o time.</p>
              )}
              {newForm.phase === 'ALINHAMENTO_EXTERNO' && (
                <p className="mt-1 text-[11px] text-slate-400">🚀 Use o Modelo de Kickoff Externo para alinhar com o cliente, cronograma e governança.</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Data *</label>
              <input
                type="date"
                className={inputCls}
                required
                value={newForm.scheduledDate}
                onChange={e => setNewForm(p => ({ ...p, scheduledDate: e.target.value }))}
              />
            </div>

            <div>
              <label className={labelCls}>Horário</label>
              <input
                type="time"
                className={inputCls}
                value={newForm.startTime}
                onChange={e => setNewForm(p => ({ ...p, startTime: e.target.value }))}
              />
            </div>

            <div>
              <label className={labelCls}>Plataforma</label>
              <select
                className={inputCls}
                value={newForm.platform}
                onChange={e => setNewForm(p => ({ ...p, platform: e.target.value }))}
              >
                {['MEET', 'TEAMS', 'ZOOM', 'PRESENCIAL', 'TELEFONE', 'OUTRO'].map(pl => (
                  <option key={pl} value={pl}>{pl === 'MEET' ? 'Google Meet' : pl === 'TEAMS' ? 'Microsoft Teams' : pl.charAt(0) + pl.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Link da Reunião</label>
              <input
                className={inputCls}
                value={newForm.meetingLink}
                onChange={e => setNewForm(p => ({ ...p, meetingLink: e.target.value }))}
                placeholder="https://meet.google.com/..."
              />
            </div>
          </div>

          {feedback && <p className="text-sm text-rose-400">{feedback}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNewForm(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
              Cancelar
            </button>
            <button type="submit" disabled={creating} className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white transition-colors">
              {creating ? 'Criando...' : 'Criar Reunião'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de reuniões existentes */}
      {loading ? (
        <p className="text-sm text-[var(--crm-muted)] py-2">Carregando reuniões...</p>
      ) : meetings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] p-5 text-center text-sm text-[var(--crm-muted)]">
          Nenhuma reunião de kickoff registrada para esta oportunidade.
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => {
            const isEditing = editingMeeting && editingMeeting.id === m.id;
            
            return (
              <div key={m.id} className="space-y-2">
                {isEditing ? (
                  /* Formulário de Edição */
                  <form onSubmit={handleUpdateMeeting} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-yellow-300">Editando Reunião</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Título *</label>
                        <input
                          className={inputCls}
                          required
                          value={editingMeeting.title}
                          onChange={e => setEditingMeeting(p => ({ ...p, title: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Fase</label>
                        <select
                          className={inputCls}
                          value={editingMeeting.phase}
                          onChange={e => setEditingMeeting(p => ({ ...p, phase: e.target.value }))}
                        >
                          {Object.entries(PHASE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={labelCls}>Data *</label>
                        <input
                          type="date"
                          className={inputCls}
                          required
                          value={editingMeeting.scheduledDate}
                          onChange={e => setEditingMeeting(p => ({ ...p, scheduledDate: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Horário</label>
                        <input
                          type="time"
                          className={inputCls}
                          value={editingMeeting.startTime}
                          onChange={e => setEditingMeeting(p => ({ ...p, startTime: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Plataforma</label>
                        <select
                          className={inputCls}
                          value={editingMeeting.platform}
                          onChange={e => setEditingMeeting(p => ({ ...p, platform: e.target.value }))}
                        >
                          {['MEET', 'TEAMS', 'ZOOM', 'PRESENCIAL', 'TELEFONE', 'OUTRO'].map(pl => (
                            <option key={pl} value={pl}>{pl === 'MEET' ? 'Google Meet' : pl === 'TEAMS' ? 'Microsoft Teams' : pl.charAt(0) + pl.slice(1).toLowerCase()}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className={labelCls}>Link da Reunião</label>
                        <input
                          className={inputCls}
                          value={editingMeeting.meetingLink}
                          onChange={e => setEditingMeeting(p => ({ ...p, meetingLink: e.target.value }))}
                          placeholder="https://meet.google.com/..."
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className={labelCls}>Observações</label>
                        <textarea
                          className={inputCls}
                          rows={3}
                          value={editingMeeting.notes}
                          onChange={e => setEditingMeeting(p => ({ ...p, notes: e.target.value }))}
                          placeholder="Observações sobre a reunião..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingMeeting(null)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
                        Cancelar
                      </button>
                      <button type="submit" className="rounded-lg bg-yellow-600 hover:bg-yellow-500 px-4 py-2 text-sm font-semibold text-white transition-colors">
                        Salvar Alterações
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.7)] px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-[var(--crm-ink)] truncate">{m.title}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[m.status] || ''}`}>
                            {STATUS_LABELS[m.status] || m.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--crm-muted)]">
                          <span>{PHASE_LABELS[m.phase] || m.phase}</span>
                          <span>•</span>
                          <span>{fmtDate(m.scheduledDate)}{m.startTime ? ` às ${m.startTime}` : ''}</span>
                          {m.owner?.name && <><span>•</span><span>{m.owner.name}</span></>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          const meetingId = m.id;
                          console.log('🚀 Iniciando navegação para reunião:', meetingId);
                          
                          onNavigate?.();

                          // Navega pela rota do módulo de origem para respeitar as permissões do vendedor.
                          window.location.href = `${kickoffRoute}?meetingId=${encodeURIComponent(meetingId)}`;
                        }}
                        className="shrink-0 rounded-lg border border-cyan-600 bg-cyan-600/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-600/20 transition-colors"
                      >
                        Abrir reunião →
                      </button>
                    </div>

                    {/* Botões de ação rápida */}
                    <div className="flex items-center gap-2 px-4 pb-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(m)}
                        className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/20 transition-colors"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        disabled={deleting === m.id}
                        className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      >
                        {deleting === m.id ? 'Excluindo...' : '🗑️ Excluir'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
