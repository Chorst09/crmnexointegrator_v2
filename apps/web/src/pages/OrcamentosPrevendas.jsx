import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Receipt, RefreshCcw, Search, DollarSign, ClipboardList, Building2,
  Eye, ArrowRight, Plus, Trash2, X, Upload, AlertCircle, CheckCircle,
  Calculator, FileText, Loader2, Pencil, BarChart3, ArrowLeft, ShieldCheck
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import AuditCostAccessModal from '../components/AuditCostAccessModal';
import { openPreSalesBudgetPdf } from '../utils/preSalesBudgetPrint';
import { logCostAccessAudit } from '../utils/auditLogger';

// ─── helpers ────────────────────────────────────────────────────────────────

const toCurrency = (v) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const getCurrentUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
};

const STATUS_LABEL = {
  NOVA: 'Solicitada',
  EM_PRECIFICACAO: 'Em Precificação',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  ENVIADA: 'Enviada',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  FINALIZADA: 'Finalizada',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada'
};

const STATUS_BADGE = {
  NOVA: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  EM_PRECIFICACAO: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  AGUARDANDO_APROVACAO: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  ENVIADA: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  APROVADO: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  REPROVADO: 'bg-red-500/20 text-red-300 border-red-500/40',
  FINALIZADA: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  REJEITADA: 'bg-red-500/20 text-red-300 border-red-500/40',
  CANCELADA: 'bg-slate-500/20 text-slate-300 border-slate-500/40'
};

const PRIORITY_LABEL = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' };

const nextItemRow = () => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  descricao: '',
  quantidade: 1,
  custoUnitario: '',
  icmsCompra: ''
});

const BUDGET_NUMBER_RE = /^ORC-(\d{4})-(\d{4})$/;

const getRequestDetails = (request) => (
  request?.calculoDetalhes && typeof request.calculoDetalhes === 'object'
    ? request.calculoDetalhes
    : {}
);

const collectBudgetNumbers = (source) => {
  const requests = Array.isArray(source) ? source : [source];
  return requests.flatMap((request) => {
    const details = getRequestDetails(request);
    const cotacoes = Array.isArray(details.cotacoes) ? details.cotacoes : [];
    return [
      request?.numero,
      ...cotacoes.map((cotacao) => cotacao?.numeroOrcamento)
    ].filter(Boolean);
  });
};

const generateNextBudgetNumber = (sources = []) => {
  const year = new Date().getFullYear();
  const maxSequence = collectBudgetNumbers(sources).reduce((max, number) => {
    const match = String(number || '').trim().toUpperCase().match(BUDGET_NUMBER_RE);
    if (!match || Number(match[2]) !== year) return max;
    const sequence = parseInt(match[1], 10);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `ORC-${String(maxSequence + 1).padStart(4, '0')}-${year}`;
};

const fallbackBudgetNumber = (sources = []) => generateNextBudgetNumber(sources);

const getProposalDetails = (request) => {
  const details = getRequestDetails(request);
  return details.dadosProposta && typeof details.dadosProposta === 'object'
    ? details.dadosProposta
    : {};
};

const getFirstCotacao = (request) => {
  const details = getRequestDetails(request);
  const cotacoes = Array.isArray(details.cotacoes) ? details.cotacoes : [];
  return cotacoes[0] || null;
};

const parseItemIcmsCompra = (item) => {
  if (!item?.observacoes) return '';
  try {
    const parsed = JSON.parse(item.observacoes);
    return parsed?.icmsCompra ?? '';
  } catch {
    return '';
  }
};

const normalizeModalidadeKey = (modalidade) => {
  const normalized = String(modalidade || '').trim().toUpperCase();
  if (normalized === 'LOCAÇÃO') return 'LOCACAO';
  if (normalized === 'SERVIÇOS' || normalized === 'SERVICOS') return 'SERVICO';
  return normalized || 'VENDA';
};

const normalizeTipoPrecificacaoKey = (modalidade) => (
  normalizeModalidadeKey(modalidade) === 'SERVICO' ? 'SERVICOS' : normalizeModalidadeKey(modalidade)
);

const mapFormItem = (item) => ({
  id: item.id || nextItemRow().id,
  descricao: item.descricao || item.product?.name || '',
  quantidade: item.quantidade || 1,
  custoUnitario: item.custoUnitario ?? '',
  icmsCompra: item.icmsCompra ?? parseItemIcmsCompra(item)
});

const formFromRequest = (request, currentUser = {}) => {
  const proposalDetails = getProposalDetails(request);
  const firstCotacao = getFirstCotacao(request);
  const cotacaoItems = Array.isArray(firstCotacao?.itens) ? firstCotacao.itens.map(mapFormItem) : [];
  const requestItems = Array.isArray(request?.items) ? request.items.map(mapFormItem) : [];
  const nomeCliente = proposalDetails.clienteOrgao || request?.nomeCliente || request?.lead?.name || '';

  return {
    numeroOrcamento: firstCotacao?.numeroOrcamento || request?.numero || fallbackBudgetNumber(),
    cotacaoId: firstCotacao?.id || '',
    titulo: request?.titulo || '',
    descricao: request?.descricao || '',
    nomeCliente,
    cnpjDocumento: proposalDetails.cnpjDocumento || '',
    contatoCliente: proposalDetails.contatoCliente || nomeCliente,
    emailCliente: proposalDetails.emailCliente || '',
    gerenteConta: proposalDetails.gerenteConta || request?.solicitante?.name || currentUser.name || '',
    emailGerente: proposalDetails.emailGerente || request?.solicitante?.email || currentUser.email || '',
    telefoneGerente: proposalDetails.telefoneGerente || currentUser.phone || '',
    premissasProposta: proposalDetails.premissasProposta || '',
    modalidade: normalizeModalidadeKey(firstCotacao?.modalidade || request?.modalidade || 'VENDA'),
    distribuidorId: firstCotacao?.distribuidorId || '',
    distribuidor: firstCotacao?.distribuidor || '',
    fornecedorId: firstCotacao?.fornecedorId || '',
    fornecedor: firstCotacao?.fornecedor || '',
    observacoesCotacao: firstCotacao?.observacoesCotacao || '',
    solicitanteId: request?.solicitanteId || request?.solicitante?.id || currentUser.id || '',
    encaminhadoParaId: request?.assignedToId || '',
    opportunityId: request?.opportunityId || request?.opportunity?.id || '',
    opportunitySearch: request?.opportunity ? formatOpportunityLabel(request.opportunity) : (request?.opportunityId || ''),
    clientId: request?.leadId || request?.lead?.id || '',
    prioridade: request?.prioridade || 'MEDIUM',
    prazo: proposalDetails.prazo || request?.prazo || '',
    itens: cotacaoItems.length > 0 ? cotacaoItems : (requestItems.length > 0 ? requestItems : [nextItemRow()])
  };
};

const buildEmptyForm = (currentUser = {}, existingRequests = []) => ({
  numeroOrcamento: fallbackBudgetNumber(existingRequests),
  cotacaoId: '',
  titulo: '',
  descricao: '',
  nomeCliente: '',
  cnpjDocumento: '',
  contatoCliente: '',
  emailCliente: '',
  gerenteConta: currentUser.name || '',
  emailGerente: currentUser.email || '',
  telefoneGerente: currentUser.phone || '',
  premissasProposta: '',
  modalidade: 'VENDA',
  distribuidorId: '',
  distribuidor: '',
  fornecedorId: '',
  fornecedor: '',
  observacoesCotacao: '',
  solicitanteId: currentUser.id || '',
  encaminhadoParaId: '',
  opportunityId: '',
  opportunitySearch: '',
  clientId: '',
  prioridade: 'MEDIUM',
  prazo: '',
  itens: [nextItemRow()]
});

const normalizeCotacoesFromRequest = (solicitacao) => {
  const details = getRequestDetails(solicitacao);
  return Array.isArray(details.cotacoes) ? details.cotacoes : [];
};

const normalizeItemsFromRequest = (solicitacao) => (
  Array.isArray(solicitacao?.items)
    ? solicitacao.items.map((item) => ({
        descricao: item.descricao || item.product?.name || '',
        quantidade: Number(item.quantidade) || 1,
        custoUnitario: Number(item.custoUnitario ?? item.product?.price) || 0
      })).filter((item) => item.descricao)
    : []
);

const buildPrecificacaoPayload = (solicitacao) => {
  const todosCustos = normalizeCotacoesFromRequest(solicitacao);
  const modalidade = normalizeModalidadeKey(solicitacao?.modalidade || todosCustos[0]?.modalidade || 'VENDA');
  const cotacoesDaModalidade = todosCustos.filter((cotacao) => (
    normalizeModalidadeKey(cotacao?.modalidade || modalidade) === modalidade
  ));
  const custosParaCalculo = cotacoesDaModalidade.length > 0 ? cotacoesDaModalidade : [];
  const itens = [];

  custosParaCalculo.forEach((cotacao) => {
    if (!Array.isArray(cotacao.itens)) return;
    cotacao.itens.forEach((item) => {
      itens.push({
        descricao: item.descricao || '',
        quantidade: Number(item.quantidade) || 1,
        custoUnitario: Number(item.custoUnitario) || 0,
        modalidade: cotacao.modalidade || modalidade,
        distribuidorId: cotacao.distribuidorId || '',
        distribuidor: cotacao.distribuidor || cotacao.fornecedor || '',
        fornecedorId: cotacao.fornecedorId || '',
        fornecedor: cotacao.fornecedor || '',
        numeroOrcamento: cotacao.numeroOrcamento || solicitacao?.numero || '',
        observacoes: cotacao.observacoesCotacao || cotacao.observacoes || ''
      });
    });
  });

  if (itens.length === 0) {
    normalizeItemsFromRequest(solicitacao).forEach((item) => {
      itens.push({
        ...item,
        modalidade,
        distribuidor: 'Solicitação',
        fornecedorId: '',
        fornecedor: '',
        numeroOrcamento: solicitacao?.numero || '',
        observacoes: ''
      });
    });
  }

  const cotacaoPrincipal = custosParaCalculo[0] || {};
  const proposalDetails = getProposalDetails(solicitacao);
  const numeroOrcamento = cotacaoPrincipal?.numeroOrcamento || solicitacao?.numero || '';
  const nomeCliente = proposalDetails.clienteOrgao || solicitacao?.nomeCliente || solicitacao?.lead?.name || solicitacao?.cliente?.nome || '';
  const gerenteNome = proposalDetails.gerenteConta || solicitacao?.solicitante?.name || '';
  const gerenteEmail = proposalDetails.emailGerente || solicitacao?.solicitante?.email || '';

  return {
    itens: itens.length > 0 ? itens : [{ descricao: '', quantidade: 1, custoUnitario: 0 }],
    subtotal: itens.reduce((sum, item) => sum + (item.quantidade * item.custoUnitario), 0),
    modalidade,
    numeroOrcamento,
    distribuidorId: cotacaoPrincipal?.distribuidorId || '',
    distribuidor: cotacaoPrincipal?.distribuidor || '',
    fornecedorId: cotacaoPrincipal?.fornecedorId || '',
    fornecedor: cotacaoPrincipal?.fornecedor || '',
    solicitacaoId: solicitacao?.id || '',
    titulo: solicitacao?.titulo || '',
    descricao: solicitacao?.descricao || '',
    nomeCliente,
    oportunidadeId: solicitacao?.opportunityId || solicitacao?.opportunity?.id || '',
    oportunidadeTitulo: solicitacao?.opportunity?.title || '',
    cliente: {
      nome: nomeCliente,
      documento: proposalDetails.cnpjDocumento || '',
      contato: proposalDetails.contatoCliente || solicitacao?.contatoCliente || nomeCliente,
      telefone: proposalDetails.telefoneCliente || solicitacao?.telefoneCliente || '',
      email: proposalDetails.emailCliente || solicitacao?.emailCliente || ''
    },
    gerente: {
      nome: gerenteNome,
      email: gerenteEmail,
      telefone: proposalDetails.telefoneGerente || ''
    },
    premissas: proposalDetails.premissasProposta || solicitacao?.observacoes || solicitacao?.descricao || '',
    dadosProposta: proposalDetails,
    todosCustos: custosParaCalculo
  };
};

const openPrecificacaoFromRequest = (solicitacao, destination = '/precificacao') => {
  if (!solicitacao) return;
  const cotacaoKey = `cotacao_precificar_${Date.now()}`;
  localStorage.setItem(cotacaoKey, JSON.stringify(buildPrecificacaoPayload(solicitacao)));
  window.location.href = `${destination}?cotacaoKey=${encodeURIComponent(cotacaoKey)}`;
};

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getPrimaryContact = (company) => (
  Array.isArray(company?.contacts)
    ? company.contacts.find((contact) => contact?.isPrimary) || company.contacts[0] || {}
    : {}
);

const formatCompanyLabel = (company) => company?.name || company?.nome || '';

const formatCompanySubtitle = (company) => {
  const contact = getPrimaryContact(company);
  return [
    company?.document,
    company?.clientType,
    contact?.name,
    contact?.email
  ].filter(Boolean).join(' • ');
};

const formatOpportunityLabel = (opportunity) => {
  if (!opportunity) return '';
  const number = opportunity.number || opportunity.numeroOportunidade || opportunity.id;
  return [number, opportunity.title || opportunity.titulo].filter(Boolean).join(' - ');
};

const formatOpportunitySubtitle = (opportunity) => {
  const company = opportunity?.company || {};
  return [
    company?.name,
    opportunity?.stage || opportunity?.b2gStage,
    opportunity?.value ? toCurrency(opportunity.value) : ''
  ].filter(Boolean).join(' • ');
};

const findRegistryPartnerByName = (items = [], name = '') => {
  const normalizedName = normalizeSearchText(name);
  if (!normalizedName) return null;
  return items.find((item) => normalizeSearchText(item?.nome) === normalizedName) || null;
};

const inferCompanyClientType = (name = '', opportunity = null) => {
  const opportunityType = String(opportunity?.clientType || opportunity?.company?.clientType || '').toUpperCase();
  if (opportunityType === 'B2G' || opportunityType === 'B2B') return opportunityType;

  const normalizedName = normalizeSearchText(name);
  return /(prefeitura|municipio|municipal|governo|estado|estadual|federal|secretaria|tribunal|ministerio|detran|camara|assembleia|autarquia|fundacao|universidade|orgao|licitacao)/i
    .test(normalizedName)
    ? 'B2G'
    : 'B2B';
};

function SearchableCreatableField({
  label,
  value,
  options = [],
  onInputChange,
  onSelect,
  onCreate,
  onError,
  getOptionLabel,
  getOptionSubtitle,
  placeholder = '',
  emptyMessage = 'Nenhum cadastro encontrado.',
  createPrefix = 'Cadastrar',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const term = normalizeSearchText(value);

  const filteredOptions = useMemo(() => (
    options
      .filter((option) => {
        if (!term) return true;
        const labelText = getOptionLabel(option);
        const subtitleText = getOptionSubtitle?.(option) || '';
        const idText = option?.id || option?.number || option?.numero || option?.numeroOportunidade || '';
        return normalizeSearchText([labelText, subtitleText, idText].join(' ')).includes(term);
      })
      .slice(0, 8)
  ), [options, term, getOptionLabel, getOptionSubtitle]);

  const hasExactMatch = useMemo(() => (
    Boolean(term) && options.some((option) => (
      normalizeSearchText(getOptionLabel(option)) === term
    ))
  ), [options, term, getOptionLabel]);

  const canCreate = Boolean(onCreate && value.trim() && !hasExactMatch);

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    try {
      setCreating(true);
      const created = await onCreate(value.trim());
      if (created) {
        onSelect(created);
        setIsOpen(false);
      }
    } catch (error) {
      onError?.(error.message || 'Erro ao cadastrar.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" onBlur={() => setTimeout(() => setIsOpen(false), 120)}>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={value}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onInputChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 py-2.5 pl-10 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:opacity-60"
        />
        {value && !disabled && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInputChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
            aria-label={`Limpar ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full z-[1010] mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-600/60 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.id || getOptionLabel(option)}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sky-500/15"
              >
                <div className="truncate text-sm font-semibold text-white">{getOptionLabel(option)}</div>
                {getOptionSubtitle?.(option) && (
                  <div className="mt-0.5 truncate text-xs text-slate-400">{getOptionSubtitle(option)}</div>
                )}
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700/70 px-3 py-4 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          )}

          {canCreate && (
            <button
              type="button"
              disabled={creating}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createPrefix} "{value.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── sub-component: NovoOrcamentoModal ──────────────────────────────────────

function NovoOrcamentoModal({ isOpen, onClose, onCreated, editingRequest = null, existingRequests = [] }) {
  const currentUser = getCurrentUser();
  const [form, setForm] = useState(() => buildEmptyForm(currentUser, existingRequests));
  const [users, setUsers] = useState([]);
  const [registry, setRegistry] = useState({ distribuidores: [], fornecedores: [] });
  const [companies, setCompanies] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const isEditing = Boolean(editingRequest?.id);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/users'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch { /* silently ignore */ }
  }, []);

  const loadRegistry = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/prevendas-cadastros'), { headers: getAuthHeaders() });
      if (!res.ok) return;
      const payload = await res.json();
      setRegistry({
        distribuidores: Array.isArray(payload?.distribuidores) ? payload.distribuidores : [],
        fornecedores: Array.isArray(payload?.fornecedores) ? payload.fornecedores : []
      });
    } catch {
      setRegistry({ distribuidores: [], fornecedores: [] });
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/companies'), { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch {
      setCompanies([]);
    }
  }, []);

  const loadOpportunities = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/opportunities'), { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setOpportunities(Array.isArray(data) ? data : []);
    } catch {
      setOpportunities([]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setForm(isEditing ? formFromRequest(editingRequest, currentUser) : buildEmptyForm(currentUser, existingRequests));
      setFeedback('');
      loadUsers();
      loadRegistry();
      loadCompanies();
      loadOpportunities();
    }
  }, [isOpen, isEditing, editingRequest?.id, existingRequests.length, loadCompanies, loadOpportunities, loadRegistry, loadUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const selectDistributor = (selected) => {
    setForm((p) => ({
      ...p,
      distribuidorId: selected?.id || '',
      distribuidor: selected?.nome || ''
    }));
  };

  const selectSupplier = (selected) => {
    setForm((p) => ({
      ...p,
      fornecedorId: selected?.id || '',
      fornecedor: selected?.nome || ''
    }));
  };

  const selectCompany = (company) => {
    const contact = getPrimaryContact(company);
    setForm((p) => ({
      ...p,
      clientId: company?.id || '',
      nomeCliente: formatCompanyLabel(company),
      cnpjDocumento: company?.document || p.cnpjDocumento,
      contatoCliente: contact?.name || p.contatoCliente,
      emailCliente: contact?.email || p.emailCliente
    }));
  };

  const selectOpportunity = (opportunity) => {
    const company = opportunity?.company || companies.find((item) => item.id === opportunity?.companyId) || {};
    const contact = getPrimaryContact(company);
    setForm((p) => ({
      ...p,
      opportunityId: opportunity?.id || '',
      opportunitySearch: formatOpportunityLabel(opportunity),
      titulo: p.titulo || opportunity?.title || opportunity?.titulo || '',
      clientId: company?.id || p.clientId,
      nomeCliente: company?.name || p.nomeCliente,
      cnpjDocumento: company?.document || p.cnpjDocumento,
      contatoCliente: contact?.name || p.contatoCliente,
      emailCliente: contact?.email || p.emailCliente,
      modalidade: normalizeModalidadeKey(opportunity?.modalidade || p.modalidade || 'VENDA')
    }));
  };

  const createRegistryEntry = async (entity, name) => {
    const res = await fetch(buildApiUrl(`/prevendas-cadastros/${entity}`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nome: name, razaoSocial: name, status: 'ATIVO' })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || 'Erro ao cadastrar.');
    }
    const created = await res.json();
    setRegistry((prev) => ({
      ...prev,
      [entity]: [created, ...(prev[entity] || []).filter((item) => item.id !== created.id)]
    }));
    return created;
  };

  const createCompany = async (name) => {
    const selectedOpportunity = opportunities.find((item) => item.id === form.opportunityId);
    const contactPayload = form.contatoCliente.trim() || form.emailCliente.trim()
      ? [{
        name: form.contatoCliente.trim() || name,
        email: form.emailCliente.trim() || undefined,
        phone: undefined,
        isPrimary: true
      }]
      : undefined;
    const res = await fetch(buildApiUrl('/companies'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        document: form.cnpjDocumento.trim() || undefined,
        clientType: inferCompanyClientType(name, selectedOpportunity),
        status: 'PROSPECT',
        autoDistribute: false,
        contacts: contactPayload
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || data?.message || 'Erro ao cadastrar cliente/órgão.');
    }
    const created = await res.json();
    setCompanies((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
    return created;
  };

  const resolveOpportunityIdForSubmit = () => {
    const typed = form.opportunitySearch.trim();
    const selected = opportunities.find((item) => (
      item.id === form.opportunityId ||
      item.id === typed ||
      normalizeSearchText(item.number || item.numeroOportunidade) === normalizeSearchText(typed) ||
      normalizeSearchText(item.title || item.titulo) === normalizeSearchText(typed) ||
      normalizeSearchText(formatOpportunityLabel(item)) === normalizeSearchText(typed)
    ));
    return form.opportunityId || selected?.id || typed;
  };

  const addItem = () => setForm((p) => ({ ...p, itens: [...p.itens, nextItemRow()] }));

  const removeItem = (id) =>
    setForm((p) => ({
      ...p,
      itens: p.itens.length > 1 ? p.itens.filter((i) => i.id !== id) : p.itens
    }));

  const updateItem = (id, key, value) =>
    setForm((p) => ({
      ...p,
      itens: p.itens.map((i) => (i.id === id ? { ...i, [key]: value } : i))
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) { setFeedback('Título é obrigatório.'); return; }
    try {
      setSaving(true);
      setFeedback('');
      const cleanItems = form.itens
        .filter((i) => i.descricao.trim())
        .map((i) => ({
          descricao: i.descricao.trim(),
          quantidade: Number(i.quantidade) || 1,
          custoUnitario: Number(i.custoUnitario) || 0,
          icmsCompra: i.icmsCompra === '' ? null : Number(i.icmsCompra) || 0,
          precoSugerido: 0,
          margemLucro: 0
        }));
      const previousDetails = isEditing ? getRequestDetails(editingRequest) : {};
      const previousCotacoes = Array.isArray(previousDetails.cotacoes) ? previousDetails.cotacoes : [];
      const shouldCreateInitialQuote = Boolean(
        form.distribuidor.trim() ||
        form.fornecedor.trim() ||
        form.distribuidorId ||
        form.fornecedorId ||
        cleanItems.length > 0
      );
      const matchedDistributor = form.distribuidorId
        ? null
        : findRegistryPartnerByName(registry.distribuidores, form.distribuidor);
      const matchedSupplier = form.fornecedorId
        ? null
        : findRegistryPartnerByName(registry.fornecedores, form.fornecedor);
      const nowIso = new Date().toISOString();
      const initialQuote = shouldCreateInitialQuote
        ? {
          id: form.cotacaoId || `COT-${Date.now()}`,
          modalidade: form.modalidade,
          distribuidorId: form.distribuidorId || matchedDistributor?.id || '',
          distribuidor: form.distribuidor.trim() || matchedDistributor?.nome || '',
          fornecedorId: form.fornecedorId || matchedSupplier?.id || '',
          fornecedor: form.fornecedor.trim() || matchedSupplier?.nome || '',
          numeroOrcamento: form.numeroOrcamento || fallbackBudgetNumber(existingRequests),
          itens: cleanItems,
          subtotal: cleanItems.reduce((sum, item) => sum + (item.quantidade * item.custoUnitario), 0),
          observacoesCotacao: form.observacoesCotacao.trim(),
          createdAt: previousCotacoes.find((item) => item.id === form.cotacaoId)?.createdAt || nowIso,
          updatedAt: nowIso,
          createdByName: currentUser.name || ''
        }
        : null;
      const nextCotacoes = initialQuote
        ? [
          initialQuote,
          ...previousCotacoes.filter((item) => (
            item.id !== initialQuote.id &&
            String(item.numeroOrcamento || '').toUpperCase() !== String(initialQuote.numeroOrcamento || '').toUpperCase()
          ))
        ]
        : previousCotacoes;
      const dadosProposta = {
        clienteOrgao: form.nomeCliente.trim(),
        cnpjDocumento: form.cnpjDocumento.trim(),
        contatoCliente: form.contatoCliente.trim(),
        emailCliente: form.emailCliente.trim(),
        gerenteConta: form.gerenteConta.trim(),
        emailGerente: form.emailGerente.trim(),
        telefoneGerente: form.telefoneGerente.trim(),
        premissasProposta: form.premissasProposta.trim(),
        prazo: form.prazo || '',
        distribuidorId: form.distribuidorId || matchedDistributor?.id || '',
        distribuidor: form.distribuidor.trim() || matchedDistributor?.nome || '',
        fornecedorId: form.fornecedorId || matchedSupplier?.id || '',
        fornecedor: form.fornecedor.trim() || matchedSupplier?.nome || ''
      };
      const descriptionText = form.descricao.trim() || form.premissasProposta.trim() || form.titulo.trim();
      const payload = {
        numero: form.numeroOrcamento || undefined,
        titulo: form.titulo.trim(),
        descricao: descriptionText,
        nomeCliente: form.nomeCliente.trim() || null,
        modalidade: form.modalidade || null,
        prioridade: form.prioridade,
        tiposPrecificacao: [normalizeTipoPrecificacaoKey(form.modalidade)],
        leadId: form.clientId.trim() || null,
        opportunityId: resolveOpportunityIdForSubmit() || null,
        assignedToId: form.encaminhadoParaId || null,
        prazo: form.prazo || null,
        calculoDetalhes: {
          ...previousDetails,
          dadosProposta,
          cotacoes: nextCotacoes
        },
        items: cleanItems
      };
      const res = await fetch(buildApiUrl(isEditing ? `/pre-vendas/${encodeURIComponent(editingRequest.id)}` : '/pre-vendas'), {
        method: isEditing ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || d?.error || `Erro ao ${isEditing ? 'atualizar' : 'criar'} orçamento`);
      }
      const created = await res.json();
      onCreated?.(created);
      onClose();
    } catch (err) {
      setFeedback(err.message || `Erro ao ${isEditing ? 'atualizar' : 'criar'} orçamento`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-600/50 bg-[#0a1628] shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
          <div>
            <h2 className="text-xl font-bold text-white">
              {isEditing ? 'Editar orçamento de Pré-vendas' : 'Criar orçamento de Pré-vendas'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {isEditing
                ? 'Atualize dados comerciais, custos e premissas antes da precificação.'
                : 'Registre o orçamento completo para cotação, precificação, PDF e devolução ao comercial.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-4">
            <label className="block text-sm font-medium text-sky-100 mb-1.5">Nº Orçamento</label>
            <input
              type="text"
              value={form.numeroOrcamento}
              readOnly
              className="w-full rounded-lg border border-sky-400/40 bg-slate-950/70 px-4 py-2.5 font-mono text-white focus:outline-none"
            />
            <p className="mt-2 text-xs text-sky-200/80">Número gerado automaticamente no padrão da fila de orçamentos.</p>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Título</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setField('titulo', e.target.value)}
              placeholder="Ex: Simulação de preços para lote de switches"
              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descrição</label>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setField('descricao', e.target.value)}
              placeholder="Contexto técnico e comercial do orçamento"
              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
            />
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-900/25 p-4">
            <h3 className="text-lg font-semibold text-white">Custos do orçamento</h3>
            <p className="mt-1 text-sm text-slate-400">Dados do distribuidor/fornecedor e itens que serão enviados para a calculadora.</p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchableCreatableField
                label="Distribuidor"
                value={form.distribuidor}
                options={registry.distribuidores}
                placeholder="Buscar distribuidor cadastrado"
                emptyMessage="Nenhum distribuidor encontrado."
                createPrefix="Cadastrar distribuidor"
                getOptionLabel={(item) => item.nome || ''}
                getOptionSubtitle={(item) => [item.cnpj, item.cidade, item.estado].filter(Boolean).join(' • ')}
                onInputChange={(value) => setForm((p) => ({ ...p, distribuidor: value, distribuidorId: '' }))}
                onSelect={selectDistributor}
                onCreate={(name) => createRegistryEntry('distribuidores', name)}
                onError={setFeedback}
              />
              <SearchableCreatableField
                label="Fornecedor"
                value={form.fornecedor}
                options={registry.fornecedores}
                placeholder="Buscar fornecedor cadastrado"
                emptyMessage="Nenhum fornecedor encontrado."
                createPrefix="Cadastrar fornecedor"
                getOptionLabel={(item) => item.nome || ''}
                getOptionSubtitle={(item) => [item.cnpj, item.cidade, item.estado].filter(Boolean).join(' • ')}
                onInputChange={(value) => setForm((p) => ({ ...p, fornecedor: value, fornecedorId: '' }))}
                onSelect={selectSupplier}
                onCreate={(name) => createRegistryEntry('fornecedores', name)}
                onError={setFeedback}
              />
            </div>
          </div>

          {/* Nome do Cliente e Modalidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SearchableCreatableField
                label="Cliente / Órgão"
                value={form.nomeCliente}
                options={companies}
                placeholder="Buscar cliente ou órgão cadastrado"
                emptyMessage="Nenhum cliente ou órgão encontrado."
                createPrefix="Cadastrar cliente/órgão"
                getOptionLabel={formatCompanyLabel}
                getOptionSubtitle={formatCompanySubtitle}
                onInputChange={(value) => setForm((p) => ({ ...p, nomeCliente: value, clientId: '' }))}
                onSelect={selectCompany}
                onCreate={createCompany}
                onError={setFeedback}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Modalidade</label>
              <select
                value={form.modalidade}
                onChange={(e) => setField('modalidade', e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="VENDA">Venda</option>
                <option value="LOCACAO">Locação</option>
                <option value="SERVICO">Serviço</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">CNPJ / Documento</label>
              <input
                type="text"
                value={form.cnpjDocumento}
                onChange={(e) => setField('cnpjDocumento', e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contato do Cliente</label>
              <input
                type="text"
                value={form.contatoCliente}
                onChange={(e) => setField('contatoCliente', e.target.value)}
                placeholder="Nome do contato"
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email do Cliente</label>
              <input
                type="email"
                value={form.emailCliente}
                onChange={(e) => setField('emailCliente', e.target.value)}
                placeholder="email@cliente.com.br"
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
          </div>

          {/* Quem está solicitando / Para quem está encaminhando */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Quem está solicitando</label>
              <select
                value={form.solicitanteId}
                onChange={(e) => setField('solicitanteId', e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="">Selecionar usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'ADMIN' ? 'Admin' : u.role === 'MASTER' ? 'Master' : u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Para quem está encaminhando</label>
              <select
                value={form.encaminhadoParaId}
                onChange={(e) => setField('encaminhadoParaId', e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="">Selecionar usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'ADMIN' ? 'Admin' : u.role === 'MASTER' ? 'Master' : u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Oportunidade / Prioridade / Prazo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableCreatableField
              label="Oportunidade ID"
              value={form.opportunitySearch}
              options={opportunities}
              placeholder="Buscar oportunidade existente"
              emptyMessage="Nenhuma oportunidade encontrada."
              getOptionLabel={formatOpportunityLabel}
              getOptionSubtitle={formatOpportunitySubtitle}
              onInputChange={(value) => setForm((p) => ({ ...p, opportunitySearch: value, opportunityId: '' }))}
              onSelect={selectOpportunity}
              onError={setFeedback}
            />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Prioridade</label>
              <select
                value={form.prioridade}
                onChange={(e) => setField('prioridade', e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Prazo</label>
            <input
              type="date"
              value={form.prazo}
              onChange={(e) => setField('prazo', e.target.value)}
              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Gerente de Conta</label>
              <input
                type="text"
                value={form.gerenteConta}
                onChange={(e) => setField('gerenteConta', e.target.value)}
                placeholder="Nome do gerente"
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email do Gerente</label>
              <input
                type="email"
                value={form.emailGerente}
                onChange={(e) => setField('emailGerente', e.target.value)}
                placeholder="gerente@empresa.com.br"
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefone do Gerente</label>
              <input
                type="text"
                value={form.telefoneGerente}
                onChange={(e) => setField('telefoneGerente', e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Premissas da Proposta</label>
            <textarea
              rows={4}
              value={form.premissasProposta}
              onChange={(e) => setField('premissasProposta', e.target.value)}
              placeholder="Escopo, validade da proposta, SLA, condições comerciais, exclusões e demais premissas."
              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
            />
          </div>

          {/* Itens do orçamento */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Itens do orçamento</label>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800/60"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </button>
            </div>

            <div className="space-y-2">
              {form.itens.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 py-2">
                  <div className="col-span-12 md:col-span-5">
                    <input
                      type="text"
                      value={item.descricao}
                      onChange={(e) => updateItem(item.id, 'descricao', e.target.value)}
                      placeholder="Descrição do item"
                      className="w-full rounded-md border border-slate-600/40 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantidade}
                      onChange={(e) => updateItem(item.id, 'quantidade', e.target.value)}
                      className="w-full rounded-md border border-slate-600/40 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.custoUnitario}
                      onChange={(e) => updateItem(item.id, 'custoUnitario', e.target.value)}
                      placeholder="Custo Unit."
                      className="w-full rounded-md border border-slate-600/40 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.icmsCompra}
                      onChange={(e) => updateItem(item.id, 'icmsCompra', e.target.value)}
                      placeholder="ICMS Compra %"
                      className="w-full rounded-md border border-slate-600/40 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={form.itens.length === 1}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* column labels */}
            <div className="grid grid-cols-12 gap-2 mt-1 px-3">
              <span className="col-span-12 md:col-span-5 text-[11px] text-slate-500">Descrição</span>
              <span className="col-span-3 md:col-span-2 text-[11px] text-slate-500">Qtde</span>
              <span className="col-span-4 md:col-span-2 text-[11px] text-slate-500">Custo Unit.</span>
              <span className="col-span-4 md:col-span-2 text-[11px] text-slate-500">ICMS Compra</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Observações do orçamento</label>
            <input
              type="text"
              value={form.observacoesCotacao}
              onChange={(e) => setField('observacoesCotacao', e.target.value)}
              placeholder="Condições comerciais, prazo, impostos inclusos..."
              className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          {feedback && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {feedback}
            </p>
          )}

          {/* footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600/50 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-800/50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isEditing ? 'Salvar alterações' : 'Criar orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── sub-component: CustosModal (Orçamentos de Distribuidores) ──────────────

function CustosModal({ isOpen, onClose, solicitacao, onSaved, onPrecificar, allRequests = [] }) {
  const [form, setForm] = useState({
    modalidade: 'VENDA',
    distribuidorId: '',
    distribuidor: '',
    fornecedorId: '',
    fornecedor: '',
    numeroOrcamento: fallbackBudgetNumber(),
    descricaoItem: '',
    quantidade: 1,
    custoUnitario: 0,
    observacoes: ''
  });
  const [custos, setCustos] = useState([]);
  const [registry, setRegistry] = useState({ distribuidores: [], fornecedores: [] });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [budgetPickerOpen, setBudgetPickerOpen] = useState(false);
  const [budgetSearchTerm, setBudgetSearchTerm] = useState('');

  const loadRegistry = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/prevendas-cadastros'), { headers: getAuthHeaders() });
      if (!res.ok) return;
      const payload = await res.json();
      setRegistry({
        distribuidores: Array.isArray(payload?.distribuidores) ? payload.distribuidores : [],
        fornecedores: Array.isArray(payload?.fornecedores) ? payload.fornecedores : []
      });
    } catch {
      setRegistry({ distribuidores: [], fornecedores: [] });
    }
  }, []);

  useEffect(() => {
    if (isOpen && solicitacao) {
      const details = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
        ? solicitacao.calculoDetalhes : {};
      setCustos(Array.isArray(details.cotacoes) ? details.cotacoes : []);
      setForm((p) => ({ ...p, numeroOrcamento: solicitacao.numero || fallbackBudgetNumber(allRequests) }));
      setFeedback('');
      loadRegistry();
    }
  }, [isOpen, solicitacao, loadRegistry, allRequests.length]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const readyBudgetOptions = useMemo(() => {
    const map = new Map();
    custos.forEach((cotacao) => {
      const number = String(cotacao?.numeroOrcamento || '').trim();
      if (!number) return;
      const items = Array.isArray(cotacao?.itens) ? cotacao.itens : [];
      const total = Number(cotacao?.subtotal) || items.reduce((sum, item) => (
        sum + ((Number(item?.quantidade) || 0) * (Number(item?.custoUnitario) || 0))
      ), 0);
      const current = map.get(number) || {
        numeroOrcamento: number,
        modalidade: cotacao?.modalidade || 'VENDA',
        distribuidorId: cotacao?.distribuidorId || '',
        distribuidor: cotacao?.distribuidor || '',
        fornecedorId: cotacao?.fornecedorId || '',
        fornecedor: cotacao?.fornecedor || '',
        itemCount: 0,
        total: 0,
        lastItem: null,
        updatedAt: cotacao?.createdAt || ''
      };
      current.itemCount += Math.max(1, items.length);
      current.total += total;
      current.lastItem = items[0] || current.lastItem;
      current.updatedAt = cotacao?.createdAt || current.updatedAt;
      map.set(number, current);
    });

    const term = budgetSearchTerm.trim().toLowerCase();
    return Array.from(map.values())
      .filter((item) => {
        if (!term) return true;
        return [
          item.numeroOrcamento,
          item.distribuidor,
          item.fornecedor,
          item.lastItem?.descricao
        ].filter(Boolean).join(' ').toLowerCase().includes(term);
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [custos, budgetSearchTerm]);

  const selectReadyBudget = (budget) => {
    setForm((p) => ({
      ...p,
      modalidade: budget.modalidade || p.modalidade,
      distribuidorId: budget.distribuidorId || '',
      distribuidor: budget.distribuidor || '',
      fornecedorId: budget.fornecedorId || '',
      fornecedor: budget.fornecedor || '',
      numeroOrcamento: budget.numeroOrcamento || p.numeroOrcamento,
      descricaoItem: budget.lastItem?.descricao || '',
      quantidade: budget.lastItem?.quantidade || 1,
      custoUnitario: budget.lastItem?.custoUnitario || 0
    }));
    setBudgetPickerOpen(false);
    setFeedback('');
  };

  const startNewBudget = () => {
    const nextNumber = solicitacao?.numero || fallbackBudgetNumber(allRequests);
    setForm((p) => ({
      ...p,
      distribuidorId: '',
      distribuidor: '',
      fornecedorId: '',
      fornecedor: '',
      numeroOrcamento: nextNumber,
      descricaoItem: '',
      quantidade: 1,
      custoUnitario: 0,
      observacoes: ''
    }));
    setBudgetPickerOpen(false);
    setFeedback(`Novo orçamento iniciado com o número ${nextNumber}.`);
  };

  const handleDistributorChange = (distribuidorId) => {
    const selected = registry.distribuidores.find((item) => item.id === distribuidorId);
    setForm((p) => ({
      ...p,
      distribuidorId,
      distribuidor: selected?.nome || ''
    }));
  };

  const handleSupplierChange = (fornecedorId) => {
    const selected = registry.fornecedores.find((item) => item.id === fornecedorId);
    setForm((p) => ({
      ...p,
      fornecedorId,
      fornecedor: selected?.nome || ''
    }));
  };

  const handleAdd = async () => {
    if (!form.distribuidor.trim() && !form.fornecedor.trim()) { setFeedback('Selecione o distribuidor ou fornecedor.'); return; }
    if (!form.descricaoItem.trim()) { setFeedback('Informe a descrição do item.'); return; }
    try {
      setSaving(true);
      setFeedback('');
      const details = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
        ? solicitacao.calculoDetalhes : {};
      const prevCotacoes = Array.isArray(details.cotacoes) ? details.cotacoes : [];
      const newEntry = {
        id: `COT-${Date.now()}`,
        modalidade: form.modalidade,
        distribuidorId: form.distribuidorId || '',
        distribuidor: form.distribuidor.trim(),
        fornecedorId: form.fornecedorId || '',
        fornecedor: form.fornecedor.trim(),
        numeroOrcamento: form.numeroOrcamento.trim() || solicitacao.numero || fallbackBudgetNumber(),
        itens: [{ descricao: form.descricaoItem.trim(), quantidade: Number(form.quantidade) || 1, custoUnitario: Number(form.custoUnitario) || 0 }],
        subtotal: (Number(form.quantidade) || 1) * (Number(form.custoUnitario) || 0),
        observacoesCotacao: form.observacoes.trim(),
        createdAt: new Date().toISOString()
      };
      const nextDetails = { ...details, cotacoes: [newEntry, ...prevCotacoes] };
      const res = await fetch(buildApiUrl(`/pre-vendas/${encodeURIComponent(solicitacao.id)}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ calculoDetalhes: nextDetails })
      });
      if (!res.ok) throw new Error('Erro ao salvar custo');
      setCustos([newEntry, ...prevCotacoes]);
      setForm((p) => ({
        ...p,
        distribuidorId: '',
        distribuidor: '',
        fornecedorId: '',
        fornecedor: '',
        descricaoItem: '',
        quantidade: 1,
        custoUnitario: 0,
        observacoes: '',
        numeroOrcamento: solicitacao.numero || fallbackBudgetNumber(allRequests)
      }));
      onSaved?.();
    } catch (err) {
      setFeedback(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handlePrecificar = () => {
    const details = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
      ? solicitacao.calculoDetalhes
      : {};
    const payload = {
      ...solicitacao,
      calculoDetalhes: { ...details, cotacoes: custos },
      modalidade: solicitacao?.modalidade || form.modalidade || 'VENDA'
    };
    if (onPrecificar) {
      onPrecificar(payload);
    } else {
      openPrecificacaoFromRequest(payload);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-slate-600/50 bg-[#0a1628] shadow-2xl">
        <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
          <div>
            <h2 className="text-xl font-bold text-white">Custos (Orçamentos de Distribuidores)</h2>
            {solicitacao && (
              <p className="mt-1 text-sm text-slate-400">{solicitacao.numero} — {solicitacao.titulo}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="ml-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* form row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Modalidade</label>
              <select value={form.modalidade} onChange={(e) => setField('modalidade', e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50">
                <option value="VENDA">Venda</option>
                <option value="LOCACAO">Locação</option>
                <option value="SERVICOS">Serviços</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Distribuidor</label>
              <select value={form.distribuidorId} onChange={(e) => handleDistributorChange(e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50">
                <option value="">Selecione um distribuidor</option>
                {registry.distribuidores.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Fornecedor</label>
              <select value={form.fornecedorId} onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50">
                <option value="">Selecione um fornecedor</option>
                {registry.fornecedores.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nº Orçamento</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.numeroOrcamento}
                  onFocus={() => setBudgetPickerOpen(true)}
                  onClick={() => setBudgetPickerOpen(true)}
                  onChange={(e) => setField('numeroOrcamento', e.target.value)}
                  placeholder={solicitacao?.numero || fallbackBudgetNumber()}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                />
                {budgetPickerOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-xl border border-slate-600/60 bg-[#111d31] p-3 shadow-2xl">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setBudgetSearchTerm('')}
                        className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25"
                      >
                        Buscar pronto
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={startNewBudget}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
                      >
                        Orçar novo
                      </button>
                    </div>
                    <div className="mt-3">
                      <input
                        type="text"
                        value={budgetSearchTerm}
                        onChange={(e) => setBudgetSearchTerm(e.target.value)}
                        placeholder="Buscar número, distribuidor ou item"
                        className="w-full rounded-lg border border-slate-600/50 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                      />
                    </div>
                    <div className="mt-2 max-h-48 overflow-y-auto">
                      {readyBudgetOptions.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-700/70 px-3 py-4 text-center text-xs text-slate-400">
                          Nenhum orçamento pronto lançado nesta solicitação.
                        </div>
                      ) : (
                        readyBudgetOptions.map((budget) => (
                          <button
                            key={budget.numeroOrcamento}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectReadyBudget(budget)}
                            className="mb-2 w-full rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-left hover:border-sky-500/50 hover:bg-sky-500/10"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-mono text-xs font-semibold text-sky-300">{budget.numeroOrcamento}</div>
                                <div className="truncate text-xs text-slate-300">{budget.distribuidor || budget.fornecedor || 'Sem fornecedor'}</div>
                              </div>
                              <div className="shrink-0 text-right text-xs text-slate-400">
                                <div>{budget.itemCount} item(ns)</div>
                                <div>{toCurrency(budget.total)}</div>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setBudgetPickerOpen(false)}
                      className="mt-1 w-full rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800/60 hover:text-white"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Item / Descrição</label>
              <input type="text" value={form.descricaoItem} onChange={(e) => setField('descricaoItem', e.target.value)}
                placeholder="Switch 48 portas, servidor..."
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Qtde</label>
              <input type="number" min="1" value={form.quantidade} onChange={(e) => setField('quantidade', e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Custo Unit. R$</label>
              <input type="number" min="0" step="0.01" value={form.custoUnitario} onChange={(e) => setField('custoUnitario', e.target.value)}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
            </div>
          </div>

          {/* observações + add button */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Observações</label>
              <input type="text" value={form.observacoes} onChange={(e) => setField('observacoes', e.target.value)}
                placeholder="Condições comerciais, prazo, impostos inclusos..."
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50" />
            </div>
            <button type="button" onClick={handleAdd} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60 shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar e Aplicar
            </button>
          </div>

          {feedback && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{feedback}</p>
          )}

          {/* custos table */}
          <div className="rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="grid grid-cols-8 gap-2 bg-slate-900/60 px-4 py-2.5 text-xs font-medium text-slate-400">
              <span>Modalidade</span><span>Distribuidor</span><span>Fornecedor</span><span>Orçamento</span>
              <span className="col-span-2">Item</span><span>Qtde</span><span>Custo Unit.</span>
            </div>
            {custos.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Sem custos adicionados para esta proposta.
              </div>
            ) : (
              custos.map((c) =>
                (c.itens || []).map((it, idx) => (
                  <div key={`${c.id}-${idx}`} className="grid grid-cols-8 gap-2 border-t border-slate-700/40 px-4 py-2.5 text-sm text-slate-200">
                    <span>{c.modalidade}</span>
                    <span className="truncate">{c.distribuidor || '-'}</span>
                    <span className="truncate">{c.fornecedor || '-'}</span>
                    <span className="truncate text-sky-400 font-mono">{c.numeroOrcamento}</span>
                    <span className="col-span-2 truncate">{it.descricao}</span>
                    <span>{it.quantidade}</span>
                    <span>{toCurrency(it.custoUnitario)}</span>
                  </div>
                ))
              )
            )}
          </div>

          {/* Ir para Precificação */}
          <div className="flex justify-end pt-2 border-t border-slate-700/50">
            <button type="button" onClick={handlePrecificar}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
              <Calculator className="h-4 w-4" /> Ir para Precificação
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function OrcamentosPrevendas() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPreVendasDashboard = Boolean(location.state?.fromPreVendasDashboard);
  const returnToPreVendasDashboard = () => navigate(location.state?.returnTo || '/pre-vendas');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [costosItem, setCostosItem] = useState(null); // solicitacao to open CustosModal for
  const [pendingPrecificacaoChoice, setPendingPrecificacaoChoice] = useState(null);

  const requestPrecificacaoChoice = (solicitacao) => {
    setPendingPrecificacaoChoice(solicitacao);
  };

  const currentUser = getCurrentUser();
  const [showAuditModal, setShowAuditModal] = useState(false);

  useEffect(() => {
    logCostAccessAudit({
      action: 'CONSULTA_CUSTOS_MARGENS',
      resource: 'ORCAMENTO_PREVENDAS',
      resourceId: 'PAINEL_ORCAMENTOS_PREVENDAS',
      details: {
        secao: 'Acompanhamento de Orçamentos e Custos de Distribuidores',
        motivo: 'Consulta operacional corporativa a custos unitários e cotações de distribuidores'
      }
    });
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(buildApiUrl('/pre-vendas?limit=500'), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Falha ao carregar orçamentos');
      const payload = await res.json();
      const rows = Array.isArray(payload?.solicitacoes)
        ? payload.solicitacoes
        : Array.isArray(payload?.data) ? payload.data
        : Array.isArray(payload) ? payload : [];
      setRequests(rows);
    } catch (err) {
      console.error(err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // ── derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = requests.length;
    let uploads = 0;
    requests.forEach((r) => {
      const d = r?.calculoDetalhes && typeof r.calculoDetalhes === 'object' ? r.calculoDetalhes : {};
      uploads += Array.isArray(d.uploadsCotacao) ? d.uploadsCotacao.length : 0;
    });
    return [
      { title: 'Orçamentos', value: total, subtitle: 'Total na fila', icon: ClipboardList, color: 'blue' },
      { title: 'Uploads', value: uploads, subtitle: 'Arquivos anexados', icon: Upload, color: 'purple' },
      { title: 'Pendentes IA', value: 0, subtitle: 'Aguardando análise', icon: AlertCircle, color: 'amber' },
      { title: 'Falhas IA', value: 0, subtitle: 'Erros de processamento', icon: AlertCircle, color: 'red' }
    ];
  }, [requests]);

  // ── filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = requests;
    if (onlyMine) rows = rows.filter((r) => r?.solicitanteId === currentUser?.id || r?.solicitante?.id === currentUser?.id);
    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.titulo, r.numero, r?.lead?.name, r?.opportunity?.title, r?.solicitante?.name]
        .filter(Boolean).join(' ').toLowerCase().includes(term)
    );
  }, [requests, onlyMine, searchTerm, currentUser]);

  // ── upload count helper ────────────────────────────────────────────────────
  const uploadCount = (r) => {
    const d = r?.calculoDetalhes && typeof r.calculoDetalhes === 'object' ? r.calculoDetalhes : {};
    return Array.isArray(d.uploadsCotacao) ? d.uploadsCotacao.length : 0;
  };

  const cotacaoCount = (r) => {
    const d = r?.calculoDetalhes && typeof r.calculoDetalhes === 'object' ? r.calculoDetalhes : {};
    return Array.isArray(d.cotacoes) ? d.cotacoes.length : 0;
  };

  const handleViewPdf = (item) => {
    openPreSalesBudgetPdf(item);
  };

  const handleReturnToCommercial = async (item) => {
    if (!item?.id) return;
    try {
      const res = await fetch(buildApiUrl(`/pre-vendas/${encodeURIComponent(item.id)}/devolver-comercial`), {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Erro ao devolver orçamento ao Comercial');
      loadRequests();
      alert(data?.message || 'Orçamento devolvido ao Comercial com sucesso.');
    } catch (error) {
      alert(error?.message || 'Erro ao devolver orçamento ao Comercial.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulo de Orçamentos"
        subtitle="Upload e acompanhamento de orçamentos de distribuidores com geração automática por IA."
        icon={Receipt}
        gradient="blue"
        breadcrumbs={['Home', 'Pré-Vendas', 'Orçamentos']}
        actions={[
          ...(fromPreVendasDashboard ? [{
            label: 'Voltar ao Dashboard',
            onClick: returnToPreVendasDashboard,
            icon: ArrowLeft,
            variant: 'secondary'
          }] : []),
          {
            label: 'Auditoria de Custos',
            onClick: () => setShowAuditModal(true),
            icon: ShieldCheck,
            variant: 'secondary'
          },
          {
            label: 'Atualizar',
            onClick: loadRequests,
            icon: RefreshCcw,
            variant: 'secondary'
          },
          {
            label: 'Novo orçamento',
            onClick: () => setShowNovoModal(true),
            icon: Plus,
            variant: 'primary'
          }
        ]}
      />

      {/* stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <AnimatedStats key={s.title} {...s} />
        ))}
      </div>

      {/* filters row */}
      <div className="crm-card rounded-xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
            />
            Somente minhas atividades
          </label>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, cliente ou oportunidade"
              className="w-full sm:w-80 rounded-lg border border-slate-600/50 bg-slate-900/40 py-2 pl-10 pr-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
        </div>
      </div>

      {/* queue table */}
      <div className="crm-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-white">Fila de Orçamentos</h3>
          <p className="mt-0.5 text-sm text-slate-400">
            Use o botão "Abrir atividade" para fazer upload e gerar orçamento com IA na solicitação.
          </p>
        </div>

        {/* table header */}
        <div className="grid grid-cols-12 gap-2 bg-slate-900/40 px-5 py-2.5 text-xs font-medium text-slate-400 border-b border-slate-700/40">
          <span className="col-span-3">Atividade</span>
          <span className="col-span-2">Cliente / Modalidade</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-1 text-center">Uploads</span>
          <span className="col-span-1 text-center">Pendentes</span>
          <span className="col-span-3 text-right">Ações</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-500" />
            <p className="mt-3 text-sm text-slate-400">Carregando orçamentos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">Nenhum orçamento encontrado.</p>
            <button
              type="button"
              onClick={() => setShowNovoModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            >
              <Plus className="h-4 w-4" /> Novo orçamento
            </button>
          </div>
        ) : (
          <div>
            {filtered.map((item) => {
              const statusKey = String(item.status || 'NOVA').toUpperCase();
              const badgeClass = STATUS_BADGE[statusKey] || STATUS_BADGE.NOVA;
              const statusText = STATUS_LABEL[statusKey] || statusKey;
              const uploads = uploadCount(item);
              const cotacoes = cotacaoCount(item);
              const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-';

              const modalidadeLabel = {
                VENDA: 'Venda',
                LOCACAO: 'Locação',
                SERVICO: 'Serviço'
              }[item.modalidade] || '-';

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center border-b border-slate-700/30 px-5 py-3.5 hover:bg-slate-800/20 transition-colors"
                >
                  {/* Atividade */}
                  <div className="col-span-3 min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.titulo}</p>
                    <p className="text-xs text-slate-400">
                      {item.numero && <span className="font-mono text-sky-400 mr-2">{item.numero}</span>}
                      • {createdAt}
                    </p>
                  </div>

                  {/* Cliente / Modalidade */}
                  <div className="col-span-2 min-w-0">
                    <p className="truncate text-sm text-slate-200">{item.nomeCliente || '-'}</p>
                    <p className="text-xs text-slate-400">{modalidadeLabel}</p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass}`}>
                      {statusText}
                    </span>
                  </div>

                  {/* Uploads */}
                  <div className="col-span-1 text-center text-sm text-slate-300">{uploads}</div>

                  {/* Pendentes */}
                  <div className="col-span-1 text-center text-sm text-slate-300">0</div>

                  {/* Ações */}
                  <div className="col-span-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewPdf(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/25 whitespace-nowrap"
                      title="Visualizar orçamento em PDF"
                    >
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReturnToCommercial(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/25 whitespace-nowrap"
                      title="Devolver orçamento ao Comercial"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Devolver
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/25 whitespace-nowrap"
                      title="Editar orçamento"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostosItem(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700/60 whitespace-nowrap"
                    >
                      Abrir atividade
                    </button>
                    <button
                      type="button"
                      onClick={() => requestPrecificacaoChoice(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-200 hover:bg-sky-500/25 whitespace-nowrap"
                    >
                      <Calculator className="h-3.5 w-3.5" /> Ir para Precificação
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Excluir esta solicitação?')) return;
                        try {
                          await fetch(buildApiUrl(`/pre-vendas/${encodeURIComponent(item.id)}`), {
                            method: 'DELETE', headers: getAuthHeaders()
                          });
                          loadRequests();
                        } catch { /* ignore */ }
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/20"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* modals */}
      <NovoOrcamentoModal
        isOpen={showNovoModal || Boolean(editingItem)}
        onClose={() => {
          setShowNovoModal(false);
          setEditingItem(null);
        }}
        onCreated={() => { loadRequests(); }}
        editingRequest={editingItem}
        existingRequests={requests}
      />

      <CustosModal
        isOpen={Boolean(costosItem)}
        onClose={() => setCostosItem(null)}
        solicitacao={costosItem}
        onSaved={() => loadRequests()}
        onPrecificar={requestPrecificacaoChoice}
        allRequests={requests}
      />

      {/* escolha de destino da precificação */}
      {pendingPrecificacaoChoice && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-600/50 bg-[#0a1628] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Ir para Precificação</h3>
            <p className="text-sm text-slate-400 mb-5">Escolha o módulo para continuar:</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  const sol = pendingPrecificacaoChoice;
                  setPendingPrecificacaoChoice(null);
                  openPrecificacaoFromRequest(sol, '/calculadoras');
                }}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-600/50 bg-slate-800/40 p-4 text-left text-white transition-colors hover:border-sky-500/50 hover:bg-sky-500/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Calculadoras</p>
                  <p className="text-xs text-slate-400">Venda, locação e serviços</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  const sol = pendingPrecificacaoChoice;
                  setPendingPrecificacaoChoice(null);
                  openPrecificacaoFromRequest(sol, '/precificacao');
                }}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-600/50 bg-slate-800/40 p-4 text-left text-white transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Precificação/Rateio</p>
                  <p className="text-xs text-slate-400">DRE, simulador, analytics e rateio</p>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingPrecificacaoChoice(null)}
              className="mt-4 w-full rounded-lg border border-slate-700/50 px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Auditoria Corporativa de Acesso a Custos e Margens */}
      <AuditCostAccessModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />
    </div>
  );
}
