import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Edit, Eye, FileText, Plus, Search, Settings, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import CommercialProposalPresentationView from '@/components/commercial-proposal/CommercialProposalPresentationView';
import { buildApiUrl } from '../config/api';
import {
  COMMERCIAL_PROPOSALS_STORAGE_KEY,
  createOrUpdateCommercialProposalFromOpportunity,
  getCommercialProposalNumber,
  readCommercialProposalDrafts
} from '../lib/commercial-proposal-drafts';

const STORAGE_LIST_KEY = COMMERCIAL_PROPOSALS_STORAGE_KEY;

const readSavedProposals = () => {
  return readCommercialProposalDrafts();
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

export default function Propostas() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lastOpportunityImportKey = useRef(null);
  const [savedProposals, setSavedProposals] = useState(() => readSavedProposals());
  const [mode, setMode] = useState('list');
  const [editorProposalId, setEditorProposalId] = useState(null);
  const [editorMode, setEditorMode] = useState('latest');
  const [editorSession, setEditorSession] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const refreshSavedProposals = useCallback(() => {
    setSavedProposals(readSavedProposals());
  }, []);

  const openNewProposal = useCallback(() => {
    setEditorProposalId(null);
    setEditorMode('blank');
    setEditorSession(session => session + 1);
    setMode('editor');
  }, []);

  const openSavedProposal = useCallback((proposalId) => {
    setEditorProposalId(proposalId);
    setEditorMode('latest');
    setEditorSession(session => session + 1);
    setMode('editor');
  }, []);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  }, []);

  const openOpportunityProposal = useCallback((opportunity) => {
    const entry = createOrUpdateCommercialProposalFromOpportunity(opportunity, {
      clientType: searchParams.get('clientType') || 'B2B'
    });
    if (!entry?.id) return;
    setSavedProposals(readSavedProposals());
    openSavedProposal(entry.id);
  }, [openSavedProposal, searchParams]);

  useEffect(() => {
    const proposalId = searchParams.get('proposalId');
    if (!proposalId) return;

    const requestKey = `proposal:${proposalId}`;
    if (lastOpportunityImportKey.current === requestKey) return;
    lastOpportunityImportKey.current = requestKey;

    const exists = readSavedProposals().some(proposal => proposal.id === proposalId);
    if (!exists) return;

    setSavedProposals(readSavedProposals());
    openSavedProposal(proposalId);
    navigate('/propostas', { replace: true });
  }, [navigate, openSavedProposal, searchParams]);

  useEffect(() => {
    if (searchParams.get('proposalId')) return;
    const opportunityId = searchParams.get('opportunityId');
    if (!opportunityId) return;

    const clientType = searchParams.get('clientType') || 'B2B';
    const requestKey = `${opportunityId}:${clientType}`;
    if (lastOpportunityImportKey.current === requestKey) return;
    lastOpportunityImportKey.current = requestKey;

    const loadOpportunity = async () => {
      try {
        const response = await fetch(
          buildApiUrl(`/opportunities/${encodeURIComponent(opportunityId)}?clientType=${encodeURIComponent(clientType)}`),
          { headers: getAuthHeaders() }
        );

        if (!response.ok) {
          throw new Error('Nao foi possivel carregar a oportunidade para proposta.');
        }

        const opportunity = await response.json();
        if (!opportunity?.id) return;
        openOpportunityProposal(opportunity);
        navigate('/propostas', { replace: true });
      } catch (error) {
        console.error('Erro ao abrir proposta da oportunidade:', error);
        alert(error instanceof Error ? error.message : 'Erro ao abrir proposta da oportunidade.');
      }
    };

    loadOpportunity();
  }, [getAuthHeaders, navigate, openOpportunityProposal, searchParams]);

  const deleteSavedProposal = useCallback((proposalId) => {
    if (!window.confirm('Deseja realmente excluir esta proposta salva?')) return;
    const next = readSavedProposals().filter(proposal => proposal.id !== proposalId);
    window.localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(next));
    setSavedProposals(next);
  }, []);

  const filteredProposals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return savedProposals;

    return savedProposals.filter(proposal => {
      const cover = proposal?.draft?.cover || {};
      return [
        proposal.title,
        cover.clientName,
        cover.date,
        cover.product,
        getCommercialProposalNumber(proposal)
      ].some(value => String(value || '').toLowerCase().includes(term));
    });
  }, [savedProposals, searchTerm]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Propostas e Cotações"
        subtitle="Gerencie propostas comerciais e cotações para seus clientes"
        icon={FileText}
        gradient="blue"
        breadcrumbs={['Vendas & CRM', 'Propostas']}
        actions={[
          {
            label: 'Gerenciar Templates',
            icon: Settings,
            onClick: () => { window.location.href = '/templates-propostas'; },
            variant: 'secondary'
          },
          mode === 'editor'
            ? {
                label: 'Voltar para propostas',
                icon: Eye,
                onClick: () => {
                  refreshSavedProposals();
                  setMode('list');
                },
                variant: 'secondary'
              }
            : {
                label: 'Nova Proposta',
                icon: Plus,
                onClick: openNewProposal,
                variant: 'primary'
              }
        ]}
      />

      {mode === 'list' ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="crm-panel p-6">
              <p className="text-sm font-semibold text-[var(--crm-muted)]">Propostas salvas</p>
              <p className="mt-3 text-4xl font-bold text-[var(--crm-ink)]">{savedProposals.length}</p>
            </div>
            <div className="crm-panel p-6">
              <p className="text-sm font-semibold text-[var(--crm-muted)]">Ultimo salvamento</p>
              <p className="mt-3 text-lg font-bold text-[var(--crm-ink)]">
                {formatDateTime(savedProposals[0]?.savedAt)}
              </p>
            </div>
            <div className="crm-panel p-6">
              <p className="text-sm font-semibold text-[var(--crm-muted)]">Modulo</p>
              <p className="mt-3 text-lg font-bold text-[var(--crm-ink)]">Proposta Comercial PPTX</p>
            </div>
          </div>

          <div className="crm-panel overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-[color:var(--crm-border)] p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--crm-ink)]">Lista de Propostas</h2>
                  <p className="text-sm text-[var(--crm-muted)]">Propostas salvas pelo editor comercial.</p>
                </div>
              </div>

              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--crm-muted)]" />
                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Buscar por cliente, data ou produto..."
                  className="crm-input pl-10"
                />
              </div>
            </div>

            {filteredProposals.length === 0 ? (
              <div className="p-16 text-center">
                <FileText className="mx-auto mb-4 h-16 w-16 text-[var(--crm-muted)] opacity-40" />
                <p className="text-lg font-semibold text-[var(--crm-ink)]">
                  {savedProposals.length === 0 ? 'Nenhuma proposta salva ainda' : 'Nenhuma proposta encontrada'}
                </p>
                <p className="mt-1 text-sm text-[var(--crm-muted)]">
                  Clique em Nova Proposta para abrir o editor comercial.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[color:var(--crm-border)]">
                  <thead className="bg-black/5 dark:bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Número</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Produto</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Salvo em</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--crm-border)]">
                    {filteredProposals.map(proposal => {
                      const cover = proposal?.draft?.cover || {};
                      const proposalNumber = getCommercialProposalNumber(proposal) || '-';
                      return (
                        <tr key={proposal.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                          <td className="px-6 py-4 text-sm font-semibold text-[var(--crm-ink)]">{proposalNumber}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[var(--crm-ink)]">{cover.clientName || proposal.title || 'Proposta sem nome'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[var(--crm-muted)]">{cover.date || '-'}</td>
                          <td className="px-6 py-4 text-sm text-[var(--crm-muted)]">
                            {String(cover.product || '-').split('\n').filter(Boolean).join(' / ')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-[var(--crm-muted)]">
                              <Calendar className="h-4 w-4" />
                              {formatDateTime(proposal.savedAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openSavedProposal(proposal.id)}
                                className="crm-btn crm-btn-secondary px-3 py-2 text-sm"
                              >
                                <Edit className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => deleteSavedProposal(proposal.id)}
                                className="crm-btn crm-btn-secondary px-3 py-2 text-sm text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-slate-900 px-6 py-8 text-slate-100">
          <CommercialProposalPresentationView
            key={editorSession}
            initialProposalId={editorProposalId}
            initialMode={editorMode}
            onSaved={refreshSavedProposals}
            onNewProposal={() => {
              setEditorProposalId(null);
              setEditorMode('blank');
            }}
          />
        </div>
      )}
    </div>
  );
}
