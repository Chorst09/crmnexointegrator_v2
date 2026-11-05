import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Flame, Plus, Sparkles, Users, Mail, Phone, MapPin, Globe, FileText, Target, Calendar, Paperclip, User, FileSignature, Download, Trash2, Upload, Rocket, Clock, ClipboardList, Bell } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import SellerProfile from '../components/SellerProfile';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import Modal from '../components/Modal';
import CompanyDocuments from '../components/CompanyDocuments';
import { API_ENDPOINTS, buildApiUrl, getAuthHeaders } from '../config/api';
import { isMaster, normalizeRole } from '../utils/permissions';
import { resolveCompanyAccountManager, accountManagerOptions } from '../utils/company-account-manager.mjs';
import { getOpportunitySummary } from '../utils/opportunity-summary.mjs';

const normalizeClientType = (value, fallback = 'B2B') => {
  const raw = String(value || '').trim().toUpperCase();
  return raw === 'B2G' ? 'B2G' : raw === 'B2B' ? 'B2B' : fallback;
};

const sectorLabel = (clientType) => (normalizeClientType(clientType) === 'B2G' ? 'Governo' : 'Privado');

const initialFormData = (clientType = 'B2B') => ({
  name: '',
  document: '',
  clientType: normalizeClientType(clientType),
  segment: '',
  size: 'SMALL',
  website: '',
  address: '',
  city: '',
  state: '',
  status: 'LEAD',
  accountManagerName: '',
  accountManagerId: null,
  contacts: [{ name: '', email: '', phone: '', position: '', isPrimary: true }],
  purchasesContact: { name: '', email: '', phone: '', position: 'Compras' }
});

const buildPrefilledFormData = (clientType, params) => {
  const data = initialFormData(clientType);
  const name = params.get('name') || '';
  const email = params.get('email') || '';
  const phone = params.get('phone') || '';
  const contact = params.get('contact') || '';

  return {
    ...data,
    name,
    contacts: [{
      ...data.contacts[0],
      name: contact,
      email,
      phone
    }]
  };
};

const SIZE_LABELS = {
  MICRO: 'Micro',
  SMALL: 'Pequena',
  MEDIUM: 'Media',
  LARGE: 'Grande',
  ENTERPRISE: 'Enterprise'
};

const STATUS_LABELS = {
  LEAD: 'Lead',
  PROSPECT: 'Prospect',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  CHURNED: 'Perdido'
};

const KICKOFF_PHASE_LABELS = {
  ENTENDIMENTO_OPORTUNIDADE: 'Entendimento da Oportunidade',
  APRESENTACAO_PROPOSTA: 'Apresentação de Propostas',
  FECHAMENTO_PROJETO: 'Fechamento de Projeto',
  ALINHAMENTO_INTERNO: 'Alinhamento Interno',
  ALINHAMENTO_EXTERNO: 'Alinhamento Externo (Kickoff)'
};

const KICKOFF_STATUS = {
  AGENDADA: {
    label: 'Agendada',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-200'
  },
  REALIZADA: {
    label: 'Realizada',
    className: 'bg-green-500/10 text-green-700 dark:text-green-200'
  },
  CANCELADA: {
    label: 'Cancelada',
    className: 'bg-red-500/10 text-red-700 dark:text-red-200'
  },
  REAGENDADA: {
    label: 'Reagendada',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-200'
  }
};

const formatKickoffDate = (date, startTime, endTime) => {
  if (!date) return 'Sem data definida';
  const day = new Date(date).toLocaleDateString('pt-BR');
  const time = [startTime, endTime].filter(Boolean).join(' - ');
  return time ? `${day} • ${time}` : day;
};

const StatusPill = ({ status }) => {
  const cls = {
    LEAD: "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]",
    PROSPECT: 'bg-sky-500/10 text-sky-800 dark:text-sky-200',
    ACTIVE: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
    INACTIVE: 'bg-amber-500/10 text-amber-900 dark:text-amber-200',
    CHURNED: 'bg-red-500/10 text-red-800 dark:text-red-200'
  }[status] || "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${cls}`}>
      {STATUS_LABELS[status] || status || '-'}
    </span>
  );
};

const SizePill = ({ size }) => (
  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] text-[var(--crm-ink)]">
    {SIZE_LABELS[size] || size || '-'}
  </span>
);

const ScorePill = ({ score }) => {
  const s = typeof score === 'number' ? score : null;
  if (s === null) return <span className="text-xs text-[var(--crm-muted)]">-</span>;

  const cls =
    s >= 80
      ? 'bg-red-500/[0.12] text-red-800 dark:text-red-200'
      : s >= 60
        ? 'bg-amber-500/[0.12] text-amber-900 dark:text-amber-200'
        : s >= 40
          ? 'bg-sky-500/[0.12] text-sky-900 dark:text-sky-200'
          : "bg-[rgb(var(--crm-surface-rgb)_/_0.12)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${cls}`}>
      <Sparkles className="h-3.5 w-3.5 opacity-80" />
      {s}
    </span>
  );
};

export default function Empresas({ clientType = 'B2B' }) {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}'); }
    catch { return {}; }
  });
  const canAssignAccountManager = isMaster(currentUser) || normalizeRole(currentUser.actualRole || currentUser.role) === 'ADMIN';
  const [searchParams] = useSearchParams();
  const pageClientType = normalizeClientType(clientType);
  const isGovernmentMode = pageClientType === 'B2G';
  const entityLabel = isGovernmentMode ? 'Órgão' : 'Empresa';
  const entityLabelPlural = isGovernmentMode ? 'Órgãos' : 'Empresas';
  const entityLabelLower = isGovernmentMode ? 'órgão' : 'empresa';
  const contactTitle = isGovernmentMode ? 'Contato do órgão' : 'Contato principal';
  const secondaryContactTitle = isGovernmentMode ? 'Contato administrativo' : 'Contato de Compras';
  const defaultSecondaryPosition = isGovernmentMode ? 'Administrativo' : 'Compras';
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [activeTab, setActiveTab] = useState('cadastro');
  const [companyDetails, setCompanyDetails] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [companyKickoffs, setCompanyKickoffs] = useState([]);
  const [companyKickoffsLoading, setCompanyKickoffsLoading] = useState(false);
  const [companyKickoffsError, setCompanyKickoffsError] = useState('');
  const [formData, setFormData] = useState(() => initialFormData(pageClientType));
  const [users, setUsers] = useState([]);
  const managerOptions = accountManagerOptions(users, currentUser, {
    id: formData.accountManagerId, name: formData.accountManagerName
  });

  useEffect(() => {
    if (!showForm || !editingCompany) return;
    setFormData(previous => {
      if (previous.accountManagerId || !previous.accountManagerName) return previous;
      const manager = resolveCompanyAccountManager({
        accountManagerName: previous.accountManagerName
      }, users);
      return manager.id ? { ...previous, accountManagerId: manager.id } : previous;
    });
  }, [users, showForm, editingCompany]);

  useEffect(() => {
    // Carregar lista de usuários para o dropdown de Gerente da Conta
    fetch(buildApiUrl('/users'), { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setUsers(list);
      })
      .catch(() => setUsers([]));
  }, []);

  const empresasArray = Array.isArray(empresas) ? empresas : [];

  const loadEmpresas = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_ENDPOINTS.companies}?clientType=${pageClientType}`, { headers: getAuthHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmpresas();
  }, [pageClientType]);

  useEffect(() => {
    if (searchParams.get('openForm') !== '1') return;
    openCreate();
  }, [searchParams, pageClientType]);

  const fetchCompanyDetails = async (companyId) => {
    if (!companyId) return;
    try {
      const url = `${API_ENDPOINTS.companies}?id=${companyId}`;
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        const normalized = Array.isArray(data) ? data[0] || null : data;
        setCompanyDetails(normalized);
      } else {
        const error = await response.text();
        console.error('Erro na resposta:', error);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes da empresa:', error);
    }
  };

  const fetchCompanyKickoffs = async (companyId) => {
    if (!companyId) return;

    try {
      setCompanyKickoffsLoading(true);
      setCompanyKickoffsError('');
      const params = new URLSearchParams({ companyId, limit: '100' });
      const response = await fetch(buildApiUrl(`/kickoff/meetings?${params.toString()}`), {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar histórico de Kickoff');
      }

      const data = await response.json();
      setCompanyKickoffs(Array.isArray(data?.meetings) ? data.meetings : []);
    } catch (error) {
      console.error('Erro ao carregar kickoff da empresa:', error);
      setCompanyKickoffs([]);
      setCompanyKickoffsError(error?.message || 'Erro ao carregar histórico de Kickoff');
    } finally {
      setCompanyKickoffsLoading(false);
    }
  };

  const filteredEmpresas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return empresasArray.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (!term) return true;
      const hay = [
        e.name,
        e.document,
        e.segment,
        sectorLabel(e.clientType),
        e.website,
        e.city,
        e.state
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [empresasArray, searchTerm, statusFilter]);

  const kpis = useMemo(() => {
    const total = empresasArray.length;
    const leads = empresasArray.filter((e) => e.status === 'LEAD').length;
    const active = empresasArray.filter((e) => e.status === 'ACTIVE').length;
    const hot = empresasArray.filter((e) => (e.leadScore ?? 0) >= 80).length;
    const warm = empresasArray.filter((e) => (e.leadScore ?? 0) >= 60 && (e.leadScore ?? 0) < 80).length;
    return { total, leads, active, hot, warm };
  }, [empresasArray]);

  const openCreate = () => {
    setEditingCompany(null);
    setFormData({
      ...buildPrefilledFormData(pageClientType, searchParams),
      accountManagerId: currentUser.id || currentUser.userId || null,
      accountManagerName: currentUser.name || ''
    });
    setShowForm(true);
  };

  const openEdit = (company) => {
    const contacts = Array.isArray(company?.contacts) && company.contacts.length > 0
      ? [...company.contacts]
      : [{ name: '', email: '', phone: '', position: '', isPrimary: true }];
    const primaryIndex = contacts.findIndex((contact) => contact.isPrimary);
    if (primaryIndex > 0) {
      const [primaryContact] = contacts.splice(primaryIndex, 1);
      contacts.unshift(primaryContact);
    }
    const comprasContact = contacts.find(
      (contact) => !contact.isPrimary && (contact.position || '').toLowerCase().includes('compras')
    );

    const manager = resolveCompanyAccountManager(company, users);
    setEditingCompany(company);
    setFormData({
      name: company?.name || '',
      document: company?.document || '',
      clientType: normalizeClientType(company?.clientType, pageClientType),
      segment: company?.segment || '',
      size: company?.size || 'SMALL',
      website: company?.website || '',
      address: company?.address || '',
      city: company?.city || '',
      state: company?.state || '',
      status: company?.status || 'LEAD',
      accountManagerName: manager.name,
      accountManagerId: manager.id,
      contacts,
      purchasesContact: {
        name: comprasContact?.name || '',
        email: comprasContact?.email || '',
        phone: comprasContact?.phone || '',
        position: comprasContact?.position || defaultSecondaryPosition
      }
    });
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingCompany(null);
    setSaving(false);
    setFormData(initialFormData(pageClientType));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      let savedCompany = null;
      let success = false;
      const { purchasesContact, ...baseData } = formData;
      const contactsPayload = (() => {
        const currentContacts = Array.isArray(baseData.contacts) ? baseData.contacts.map((c) => ({ ...c })) : [];
        const primaryInput = baseData.contacts?.[0] || {};
        const primaryIndex = currentContacts.findIndex((contact) => contact.isPrimary);
        const primarySourceIndex = primaryIndex >= 0 ? primaryIndex : (currentContacts.length > 0 ? 0 : -1);
        const primaryContact = {
          ...(primarySourceIndex >= 0 ? currentContacts[primarySourceIndex] : {}),
          ...primaryInput,
          isPrimary: true
        };
        const remainingContacts = currentContacts.filter((_, index) => index !== primarySourceIndex && !currentContacts[index]?.isPrimary);

        const comprasData = purchasesContact || {};
        const hasCompras = [comprasData.name, comprasData.email, comprasData.phone]
          .some((value) => value && String(value).trim().length > 0);
        const comprasIndex = remainingContacts.findIndex((contact) =>
          (contact.position || '').toLowerCase().includes('compras')
        );

        if (hasCompras) {
          const comprasContact = {
            ...(comprasIndex >= 0 ? remainingContacts[comprasIndex] : {}),
            name: comprasData.name || '',
            email: comprasData.email || '',
            phone: comprasData.phone || '',
            position: comprasData.position || 'Compras',
            isPrimary: false
          };
          if (comprasIndex >= 0) {
            remainingContacts[comprasIndex] = comprasContact;
          } else {
            remainingContacts.push(comprasContact);
          }
        } else if (comprasIndex >= 0) {
          remainingContacts.splice(comprasIndex, 1);
        }

        return [primaryContact, ...remainingContacts];
      })();
      const payload = {
        ...baseData,
        clientType: normalizeClientType(baseData.clientType, pageClientType),
        contacts: contactsPayload
      };
      if (editingCompany?.accountManagerName && !editingCompany.accountManagerId && !payload.accountManagerId && payload.accountManagerName) {
        delete payload.accountManagerId;
      }
      if (editingCompany?.id) {
        const response = await fetch(API_ENDPOINTS.companies, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...payload, id: editingCompany.id })
        });
        success = response.ok;
        if (success) {
          savedCompany = await response.json();
        } else {
          const errorData = await response.json().catch(() => ({}));
          alert(errorData.mensagem || errorData.error || errorData.message || 'Erro ao atualizar empresa');
        }
      } else {
        const response = await fetch(API_ENDPOINTS.companies, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        success = response.ok;
        if (success) {
          savedCompany = await response.json();
        } else {
          const errorData = await response.json().catch(() => ({}));
          alert(errorData.mensagem || errorData.error || errorData.message || 'Erro ao criar empresa');
        }
      }
      if (success) {
        const companyId = savedCompany?.id || editingCompany?.id;

        closeModal();
        loadEmpresas();
        const returnTo = searchParams.get('returnTo');
        if (returnTo && companyId && !editingCompany?.id) {
          const separator = returnTo.includes('?') ? '&' : '?';
          navigate(`${returnTo}${separator}companyId=${encodeURIComponent(companyId)}`, { replace: true });
        }
      }
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      alert(error.message || 'Erro ao salvar empresa');
    } finally {
      setSaving(false);
    }
  };

  const openView = async (company) => {
    setViewingCompany(company);
    setActiveTab('cadastro');
    setCompanyKickoffs([]);
    setCompanyKickoffsError('');
    setShowViewModal(true);
    
    await Promise.all([
      fetchCompanyDetails(company.id),
      fetchCompanyKickoffs(company.id)
    ]);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setViewingCompany(null);
    setCompanyDetails(null);
    setActiveTab('cadastro');
    setCompanyKickoffs([]);
    setCompanyKickoffsLoading(false);
    setCompanyKickoffsError('');
  };

  const openContractFromCompany = (contractId) => {
    if (!contractId) return;
    closeViewModal();
    navigate(`/contratos?contractId=${contractId}`);
  };

  const openOpportunityFromCompany = (opportunityId, attachmentType = '') => {
    if (!opportunityId) return;
    closeViewModal();
    const params = new URLSearchParams({ opportunityId, clientType: normalizeClientType(viewingCompany?.clientType, pageClientType) });
    if (attachmentType) params.set('attachmentType', attachmentType);
    navigate(`/oportunidades?${params.toString()}`);
  };

  const openActivityFromCompany = (activityId) => {
    if (!activityId) return;
    closeViewModal();
    navigate(`/atividades?activityId=${activityId}`);
  };

  const openKickoffFromCompany = (meetingId) => {
    const companyId = viewingCompany?.id;
    const kickoffRoute = normalizeClientType(viewingCompany?.clientType, pageClientType) === 'B2G'
      ? '/b2g-kickoff'
      : '/b2b-kickoff';
    closeViewModal();

    if (meetingId) {
      navigate(`${kickoffRoute}?meetingId=${encodeURIComponent(meetingId)}`);
      return;
    }

    navigate(companyId ? `${kickoffRoute}?companyId=${encodeURIComponent(companyId)}` : kickoffRoute);
  };


  const deleteCompanyById = async (companyId) => {
    const response = await fetch(`${API_ENDPOINTS.companies}/${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      return { ok: true };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      ok: false,
      message: errorData.mensagem || errorData.error || errorData.message || 'Erro ao excluir empresa'
    };
  };

  const handleDelete = async (company) => {
    if (!window.confirm(`Tem certeza que deseja excluir ${isGovernmentMode ? 'o órgão' : 'a empresa'} "${company.name}"?`)) {
      return;
    }

    try {
      const result = await deleteCompanyById(company.id);

      if (result.ok) {
        if (viewingCompany?.id === company.id) {
          closeViewModal();
        }
        await loadEmpresas();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Erro ao excluir empresa:', error);
      alert('Erro ao excluir empresa');
    }
  };

  const handleBulkDelete = async (selectedCompanies) => {
    if (!Array.isArray(selectedCompanies) || selectedCompanies.length === 0) {
      return false;
    }

    const total = selectedCompanies.length;
    const confirmation = window.confirm(
      `Tem certeza que deseja excluir ${total} empresa${total > 1 ? 's' : ''} selecionada${total > 1 ? 's' : ''}?`
    );
    if (!confirmation) {
      return false;
    }

    const results = [];
    for (const company of selectedCompanies) {
      try {
        const result = await deleteCompanyById(company.id);
        results.push({ company, ...result });
      } catch (error) {
        results.push({ company, ok: false, message: 'Erro ao excluir empresa' });
      }
    }

    const failed = results.filter((item) => !item.ok);
    const removedCount = total - failed.length;

    if (viewingCompany?.id && selectedCompanies.some((company) => company.id === viewingCompany.id)) {
      closeViewModal();
    }

    await loadEmpresas();

    if (failed.length > 0) {
      const preview = failed
        .slice(0, 3)
        .map((item) => item.company?.name || item.company?.id)
        .join(', ');
      const suffix = failed.length > 3 ? '...' : '';
      alert(
        `Exclusão concluída com falhas.\nRemovidas: ${removedCount}\nFalhas: ${failed.length}` +
        (preview ? `\nEmpresas com erro: ${preview}${suffix}` : '')
      );
      return false;
    }

    return true;
  };

  const columns = useMemo(() => ([
    {
      key: 'name',
      label: entityLabel,
      render: (item) => (
        <div className="min-w-[220px]">
          <div className="text-sm font-extrabold text-[var(--crm-ink)]">{item.name}</div>
          <div className="mt-0.5 text-xs text-[var(--crm-muted)] truncate">
            {[sectorLabel(item.clientType), item.segment, item.website].filter(Boolean).join(' • ') || 'Sem informacoes extras'}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusPill status={item.status} />
    },
    {
      key: 'size',
      label: 'Porte',
      render: (item) => <SizePill size={item.size} />
    },
    {
      key: 'accountManagerName',
      label: 'Gerente da Conta',
      render: (item) => (
        <span className="text-sm text-[var(--crm-ink)]">
          {item.accountManagerName || <span className="text-[var(--crm-muted)] italic text-xs">Não atribuído</span>}
        </span>
      )
    },
    {
      key: 'leadScore',
      label: 'Score',
      render: (item) => <ScorePill score={item.leadScore} />
    },
    {
      key: '_count',
      label: 'Oportunidades',
      render: (item) => (
        <span className="text-sm font-extrabold text-[var(--crm-ink)]">{item._count?.opportunities ?? 0}</span>
      )
    },
    {
      key: 'city',
      label: 'Local',
      render: (item) => (
        <span className="text-sm text-[var(--crm-ink)]">
          {[item.city, item.state].filter(Boolean).join(', ') || '-'}
        </span>
      )
    },
    {
      key: 'createdAt',
      label: 'Criada em',
      render: (item) => (
        <span className="text-sm text-[var(--crm-ink)]">
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '-'}
        </span>
      )
    }
  ]), [entityLabel]);

  return (
    <div>
      <PageHeader
        title={entityLabelPlural}
        subtitle={isGovernmentMode ? 'Cadastro de órgãos governamentais separado das empresas privadas' : 'Gerencie empresas privadas, clientes e prospects'}
        icon={Building2}
        gradient="blue"
        breadcrumbs={isGovernmentMode ? ['Home', 'B2G Governo', 'Órgãos'] : ['Home', 'Empresas']}
        actions={[
          {
            label: isGovernmentMode ? 'Novo Órgão' : 'Nova Empresa',
            onClick: openCreate,
            icon: Plus,
            variant: 'primary'
          }
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <AnimatedStats title="Total" value={kpis.total} subtitle={`${entityLabelPlural} cadastrados`} icon={Building2} color="blue" />
        <AnimatedStats title="Leads" value={kpis.leads} subtitle="Novas oportunidades" icon={Users} color="purple" />
        <AnimatedStats title="Ativos" value={kpis.active} subtitle="Clientes em andamento" icon={Users} color="green" />
        <AnimatedStats title="Hot" value={kpis.hot} subtitle="Score 80+" icon={Flame} color="red" />
        <AnimatedStats title="Warm" value={kpis.warm} subtitle="Score 60-79" icon={Sparkles} color="yellow" />
      </div>

      <ModernTable
        title={`Lista de ${entityLabelPlural}`}
        data={filteredEmpresas}
        columns={columns}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'LEAD', label: 'Lead' },
              { value: 'PROSPECT', label: 'Prospect' },
              { value: 'ACTIVE', label: 'Ativo' },
              { value: 'INACTIVE', label: 'Inativo' },
              { value: 'CHURNED', label: 'Perdido' }
            ]
          }
        ]}
        loading={loading}
        onView={openView}
        onEdit={openEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        bulkDeleteLabel="Excluir selecionados"
        emptyState={
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-[var(--crm-muted)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-2">Nenhum {entityLabelLower} encontrado</h3>
            <p className="text-[var(--crm-muted)] max-w-sm mx-auto">
              Tente ajustar a busca ou crie um novo cadastro.
            </p>
          </div>
        }
      />

      <Modal
        isOpen={showForm}
        onClose={closeModal}
        title={editingCompany ? `Editar ${entityLabel}` : `Novo ${entityLabel}`}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Nome {isGovernmentMode ? 'do Órgão' : 'da Empresa'} *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="crm-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">{isGovernmentMode ? 'CNPJ / Código do órgão' : 'CNPJ/CPF'}</label>
              <input
                type="text"
                value={formData.document}
                onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                className="crm-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Setor</label>
              <select
                value={formData.clientType}
                onChange={(e) => setFormData({ ...formData, clientType: normalizeClientType(e.target.value, pageClientType) })}
                className="crm-input"
                disabled
              >
                <option value="B2B">Privado</option>
                <option value="B2G">Governo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">{isGovernmentMode ? 'Esfera / Área' : 'Segmento'}</label>
              <input
                type="text"
                value={formData.segment}
                onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                className="crm-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Porte</label>
              <select
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="crm-input"
              >
                <option value="MICRO">Micro</option>
                <option value="SMALL">Pequena</option>
                <option value="MEDIUM">Media</option>
                <option value="LARGE">Grande</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="crm-input"
              >
                <option value="LEAD">Lead</option>
                <option value="PROSPECT">Prospect</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="CHURNED">Perdido</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="crm-input"
              />
            </div>
          </div>

          <div className="crm-panel-muted p-4">
            <div className="text-sm font-extrabold text-[var(--crm-ink)] flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--crm-accent)]" />
              Gerente de Contas
              <span className="text-xs font-normal text-[var(--crm-muted)]">(define o responsável — impede outro vendedor de cadastrar o mesmo cliente)</span>
            </div>
            <div className="mt-3">
              <select
                value={formData.accountManagerId || ''}
                disabled={!canAssignAccountManager}
                onChange={(e) => {
                  const selected = managerOptions.find(u => u.id === e.target.value);
                  setFormData({
                    ...formData,
                    accountManagerId: e.target.value || null,
                    accountManagerName: selected ? selected.name : ''
                  });
                }}
                className="crm-input"
              >
                <option value="">{formData.accountManagerName && !formData.accountManagerId ? `${formData.accountManagerName} (cadastro anterior)` : '— Selecionar responsável —'}</option>
                {managerOptions.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'MASTER' ? 'MASTER' : u.role === 'ADMIN' ? 'ADMIN' : u.role === 'SELLER' ? 'SELLER' : u.role || 'USER'})
                  </option>
                ))}
              </select>
              <SellerProfile seller={users.find(user => user.id === formData.accountManagerId) || (formData.accountManagerId === (currentUser.id || currentUser.userId) ? currentUser : null) || (formData.accountManagerName ? {
                name: formData.accountManagerName,
                email: editingCompany?.accountManagerEmail,
                phone: editingCompany?.accountManagerPhone,
                role: editingCompany?.accountManagerPosition
              } : null)} />
              {!canAssignAccountManager && (
                <p className="mt-2 text-xs text-[var(--crm-muted)]">Novas empresas ficam sob sua responsabilidade. Admin e Master podem alterar o responsável.</p>
              )}
            </div>
          </div>

          <div className="crm-panel-muted p-4">
            <div className="text-sm font-extrabold text-[var(--crm-ink)]">{contactTitle}</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nome do contato"
                value={formData.contacts[0]?.name || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contacts: [{ ...formData.contacts[0], name: e.target.value, isPrimary: true }]
                  })
                }
                className="crm-input"
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.contacts[0]?.email || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contacts: [{ ...formData.contacts[0], email: e.target.value, isPrimary: true }]
                  })
                }
                className="crm-input"
              />
              <input
                type="tel"
                placeholder="Telefone"
                value={formData.contacts[0]?.phone || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contacts: [{ ...formData.contacts[0], phone: e.target.value, isPrimary: true }]
                  })
                }
                className="crm-input"
              />
              <input
                type="text"
                placeholder="Cargo"
                value={formData.contacts[0]?.position || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contacts: [{ ...formData.contacts[0], position: e.target.value, isPrimary: true }]
                  })
                }
                className="crm-input"
              />
            </div>
          </div>

          <div className="crm-panel-muted p-4">
            <div className="text-sm font-extrabold text-[var(--crm-ink)]">{secondaryContactTitle}</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder={isGovernmentMode ? 'Nome do contato administrativo' : 'Nome do contato de compras'}
                value={formData.purchasesContact?.name || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purchasesContact: { ...(formData.purchasesContact || {}), name: e.target.value }
                  })
                }
                className="crm-input"
              />
              <input
                type="email"
                placeholder={isGovernmentMode ? 'Email do contato administrativo' : 'Email do contato de compras'}
                value={formData.purchasesContact?.email || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purchasesContact: { ...(formData.purchasesContact || {}), email: e.target.value }
                  })
                }
                className="crm-input"
              />
              <input
                type="tel"
                placeholder={isGovernmentMode ? 'Telefone do contato administrativo' : 'Telefone do contato de compras'}
                value={formData.purchasesContact?.phone || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purchasesContact: { ...(formData.purchasesContact || {}), phone: e.target.value }
                  })
                }
                className="crm-input"
              />
              <input
                type="text"
                placeholder="Cargo"
                value={formData.purchasesContact?.position || defaultSecondaryPosition}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purchasesContact: { ...(formData.purchasesContact || {}), position: e.target.value }
                  })
                }
                className="crm-input"
              />
            </div>
          </div>

          {editingCompany?.id && <div className="crm-panel-muted p-4 space-y-3">
            <p className="text-sm text-[var(--crm-muted)]">Contratos e documentos são anexados diretamente nas oportunidades desta empresa.</p>
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => { const company = editingCompany; closeModal(); openView(company); setActiveTab('oportunidades'); }}>Ver oportunidades da empresa</button>
          </div>}

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button type="button" onClick={closeModal} className="crm-btn crm-btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary">
              {saving ? 'Salvando...' : editingCompany ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Visualização com Abas */}
      <Modal
        isOpen={showViewModal}
        onClose={closeViewModal}
        title={viewingCompany?.name || `Detalhes ${isGovernmentMode ? 'do Órgão' : 'da Empresa'}`}
        size="large"
      >
        {viewingCompany && (
          <div className="space-y-6">
            {/* Header com Status */}
            <div className="flex items-center justify-between pb-4 border-b border-[color:var(--crm-border)]">
              <div className="flex items-center gap-3">
                <StatusPill status={viewingCompany.status} />
                <SizePill size={viewingCompany.size} />
                {viewingCompany.leadScore && <ScorePill score={viewingCompany.leadScore} />}
              </div>
            </div>

            {/* Abas */}
            <div className="border-b border-[color:var(--crm-border)]">
              <nav className="flex gap-1 overflow-x-auto">
                {[
                  { id: 'cadastro', label: 'Cadastro', icon: Building2 },
                  { id: 'contatos', label: 'Contatos', icon: User },
                  { id: 'oportunidades', label: 'Oportunidades', icon: Target },
                  { id: 'contratos', label: 'Contratos', icon: FileSignature },
                  { id: 'atividades', label: 'Atividades', icon: Calendar },
                  { id: 'kickoff', label: 'Kickoff', icon: Rocket },
                  { id: 'documentos', label: 'Documentos', icon: Paperclip }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap
                        border-b-2 -mb-px
                        ${activeTab === tab.id
                          ? 'border-[var(--crm-accent)] text-[var(--crm-accent)]'
                          : 'border-transparent text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Conteúdo das Abas */}
            <div className="min-h-[400px]">
              {/* Aba Cadastro */}
              {activeTab === 'cadastro' && (
                <div className="space-y-6">
                  <div className="crm-panel-muted p-6">
                    <h4 className="text-sm font-bold text-[var(--crm-ink)] mb-4">Informações Básicas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-[var(--crm-muted)] uppercase mb-1">Setor</div>
                        <div className="text-sm text-[var(--crm-ink)] font-medium">{sectorLabel(viewingCompany.clientType)}</div>
                      </div>
                      {viewingCompany.document && (
                        <div>
                          <div className="text-xs font-semibold text-[var(--crm-muted)] uppercase mb-1">{isGovernmentMode ? 'CNPJ / Código do órgão' : 'CNPJ/CPF'}</div>
                          <div className="text-sm text-[var(--crm-ink)] font-medium">{viewingCompany.document}</div>
                        </div>
                      )}
                      {viewingCompany.segment && (
                        <div>
                          <div className="text-xs font-semibold text-[var(--crm-muted)] uppercase mb-1">{isGovernmentMode ? 'Esfera / Área' : 'Segmento'}</div>
                          <div className="text-sm text-[var(--crm-ink)] font-medium">{viewingCompany.segment}</div>
                        </div>
                      )}
                      {viewingCompany.accountManagerName && (
                        <div>
                          <div className="text-xs font-semibold text-[var(--crm-muted)] uppercase mb-1 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Gerente de Contas
                          </div>
                          <div className="text-sm text-[var(--crm-ink)] font-medium">{viewingCompany.accountManagerName}</div>
                          {viewingCompany.accountManagerPosition && (
                            <div className="text-xs text-[var(--crm-muted)] mt-0.5">{viewingCompany.accountManagerPosition}</div>
                          )}
                          {viewingCompany.accountManagerEmail && (
                            <div className="text-xs text-[var(--crm-muted)] mt-0.5">{viewingCompany.accountManagerEmail}</div>
                          )}
                          {viewingCompany.accountManagerPhone && (
                            <div className="text-xs text-[var(--crm-muted)] mt-0.5">{viewingCompany.accountManagerPhone}</div>
                          )}
                        </div>
                      )}
                      {viewingCompany.website && (
                        <div className="md:col-span-2">
                          <div className="text-xs font-semibold text-[var(--crm-muted)] uppercase mb-1 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Website
                          </div>
                          <a 
                            href={viewingCompany.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            {viewingCompany.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {(viewingCompany.address || viewingCompany.city || viewingCompany.state) && (
                    <div>
                      <h4 className="text-sm font-bold text-[var(--crm-ink)] mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Localização
                      </h4>
                      <div className="crm-panel-muted p-4">
                        {viewingCompany.address && (
                          <div className="text-sm text-[var(--crm-ink)] mb-1">{viewingCompany.address}</div>
                        )}
                        {(viewingCompany.city || viewingCompany.state) && (
                          <div className="text-sm text-[var(--crm-muted)]">
                            {[viewingCompany.city, viewingCompany.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-[var(--crm-ink)] mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Estatísticas
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="crm-panel-muted p-4 text-center">
                        <div className="text-2xl font-bold text-[var(--crm-ink)]">
                          {viewingCompany._count?.opportunities ?? 0}
                        </div>
                        <div className="text-xs text-[var(--crm-muted)] mt-1">Oportunidades</div>
                      </div>
                      <div className="crm-panel-muted p-4 text-center">
                        <div className="text-2xl font-bold text-[var(--crm-ink)]">
                          {viewingCompany.createdAt 
                            ? new Date(viewingCompany.createdAt).toLocaleDateString('pt-BR')
                            : '-'
                          }
                        </div>
                        <div className="text-xs text-[var(--crm-muted)] mt-1">Data de Cadastro</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Aba Contatos */}
              {activeTab === 'contatos' && (
                <div className="space-y-4">
                  {viewingCompany.contacts && viewingCompany.contacts.length > 0 ? (
                    viewingCompany.contacts.map((contact, index) => (
                      <div key={index} className="crm-panel-muted p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-bold text-[var(--crm-ink)]">{contact.name || 'Sem nome'}</div>
                            {contact.position && (
                              <div className="text-xs text-[var(--crm-muted)] mt-0.5">{contact.position}</div>
                            )}
                          </div>
                          {contact.isPrimary && (
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-200">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5 mt-3">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm text-[var(--crm-ink)]">
                              <Mail className="w-3.5 h-3.5 text-[var(--crm-muted)]" />
                              <a href={`mailto:${contact.email}`} className="hover:text-blue-600 dark:hover:text-blue-700 dark:hover:text-blue-400">
                                {contact.email}
                              </a>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm text-[var(--crm-ink)]">
                              <Phone className="w-3.5 h-3.5 text-[var(--crm-muted)]" />
                              <a href={`tel:${contact.phone}`} className="hover:text-blue-600 dark:hover:text-blue-700 dark:hover:text-blue-400">
                                {contact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <User className="w-12 h-12 text-[var(--crm-muted)] mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-[var(--crm-muted)]">Nenhum contato cadastrado</p>
                    </div>
                  )}
                </div>
              )}

              {/* Aba Oportunidades */}
              {activeTab === 'oportunidades' && (
                <div className="space-y-4">
                  {companyDetails?.opportunities && companyDetails.opportunities.length > 0 ? (
                    companyDetails.opportunities.map((opp) => (
                      <div
                        key={opp.id}
                        className="crm-panel-muted p-4 cursor-pointer hover:shadow-soft-xl transition-shadow"
                        role="button"
                        tabIndex={0}
                        onClick={() => openOpportunityFromCompany(opp.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openOpportunityFromCompany(opp.id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-bold text-[var(--crm-ink)]">{opp.title}</div>
                            <div className="text-xs text-[var(--crm-muted)] mt-0.5">
                              {opp.value ? `R$ ${opp.value.toLocaleString('pt-BR')}` : 'Valor não definido'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openOpportunityFromCompany(opp.id);
                              }}
                              className="crm-btn crm-btn-ghost px-3 py-1 text-xs"
                            >
                              Abrir oportunidade
                            </button>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              opp.stage === 'WON' ? 'bg-green-500/10 text-green-700 dark:text-green-200' :
                              opp.stage === 'LOST' ? 'bg-red-500/10 text-red-700 dark:text-red-200' :
                              'bg-blue-500/10 text-blue-700 dark:text-blue-200'
                            }`}>
                              {opp.stage}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-[var(--crm-muted)] mt-2 break-words">{getOpportunitySummary(opp)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 text-[var(--crm-muted)] mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-[var(--crm-muted)]">Nenhuma oportunidade cadastrada</p>
                    </div>
                  )}
                </div>
              )}

              {/* Aba Contratos */}
              {activeTab === 'contratos' && (
                <div className="space-y-4">
                  <CompanyDocuments companyId={viewingCompany.id} documentType="CONTRACT" onOpenOpportunity={id => openOpportunityFromCompany(id, 'CONTRACT')} onManage={() => setActiveTab('oportunidades')} />
                  {companyDetails?.contracts?.length > 0 && <h4 className="text-sm font-bold text-[var(--crm-ink)]">Contratos cadastrados no módulo de contratos</h4>}
                  {companyDetails?.contracts && companyDetails.contracts.length > 0 ? (
                    companyDetails.contracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="crm-panel-muted p-4 cursor-pointer hover:shadow-soft-xl transition-shadow"
                        role="button"
                        tabIndex={0}
                        onClick={() => openContractFromCompany(contract.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openContractFromCompany(contract.id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="text-sm font-bold text-[var(--crm-ink)]">{contract.title || 'Contrato sem título'}</div>
                            <div className="text-xs text-[var(--crm-muted)] mt-0.5">
                              Número: {contract.number || 'N/A'}
                            </div>
                            <div className="text-xs text-[var(--crm-muted)] mt-1">{contract.sourceOpportunityLabel || contract.opportunity?.number || 'Oportunidade não vinculada no cadastro anterior.'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openContractFromCompany(contract.id);
                              }}
                              className="crm-btn crm-btn-ghost px-3 py-1 text-xs"
                            >
                              Abrir contrato
                            </button>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                            contract.status === 'ACTIVE' ? 'bg-green-500/10 text-green-700 dark:text-green-200' :
                            contract.status === 'RENEWAL_PENDING' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-200' :
                            contract.status === 'AWAITING_SIGNATURE' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-200' :
                            contract.status === 'EXPIRED' ? 'bg-red-500/10 text-red-700 dark:text-red-200' :
                            contract.status === 'CANCELLED' ? "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" :
                            contract.status === 'RENEWED' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' :
                            "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                          }`}>
                            {contract.status === 'ACTIVE' ? 'Ativo' :
                             contract.status === 'RENEWAL_PENDING' ? 'A Renovar' :
                             contract.status === 'AWAITING_SIGNATURE' ? 'Aguardando Assinatura' :
                             contract.status === 'EXPIRED' ? 'Expirado' :
                             contract.status === 'CANCELLED' ? 'Cancelado' :
                             contract.status === 'RENEWED' ? 'Renovado' :
                             contract.status === 'DRAFT' ? 'Rascunho' :
                             contract.status}
                          </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          {contract.value && (
                            <div>
                              <div className="text-xs text-[var(--crm-muted)]">Valor</div>
                              <div className="text-sm font-semibold text-[var(--crm-ink)]">
                                R$ {contract.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          <div className="col-span-2 flex flex-col gap-2 p-2 bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] rounded-lg border border-[color:var(--crm-border)]">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-xs font-semibold text-[var(--crm-ink)] mb-1 flex items-center gap-1">
                                  <Bell className="w-3 h-3" />
                                  Alerta de Vencimento
                                </div>
                                <div className="text-xs text-[var(--crm-muted)]">
                                  {!contract.endDate ? 'Complete o vencimento para ativar o alerta.' : !['ACTIVE', 'RENEWAL_PENDING'].includes(contract.status) ? 'Ative o contrato para agendar o aviso.' : contract.expirationAlert === false ? 'Desativado - não será enviado alerta.' : `Ativado - aviso ${contract.alertDays ?? 30} dias antes na agenda do gerente.`}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  const newValue = !contract.expirationAlert;
                                  try {
                                    const response = await fetch(buildApiUrl(`/contracts/${contract.id}`), {
                                      method: 'PUT',
                                      headers: getAuthHeaders(),
                                      body: JSON.stringify({ expirationAlert: newValue })
                                    });
                                    if (response.ok) {
                                      await fetchCompanyDetails(viewingCompany.id);
                                    } else {
                                      alert('Erro ao atualizar alerta');
                                    }
                                  } catch (error) {
                                    console.error('Erro:', error);
                                    alert('Erro ao atualizar alerta');
                                  }
                                }}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--crm-accent)] focus:ring-offset-2 ${
                                  contract.expirationAlert !== false ? 'bg-[var(--crm-accent)]' : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                                title={contract.expirationAlert !== false ? 'Clique para desativar alerta' : 'Clique para ativar alerta'}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    contract.expirationAlert !== false ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {contract.expirationAlert !== false && (
                              <div className="flex items-center gap-2 pt-1 border-t border-[color:var(--crm-border)]">
                                <span className="text-xs text-[var(--crm-muted)] flex-shrink-0">Avisar com</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  defaultValue={contract.alertDays ?? 30}
                                  onClick={(e) => e.stopPropagation()}
                                  onBlur={async (e) => {
                                    const days = parseInt(e.target.value, 10);
                                    if (!days || days < 1 || days > 365) {
                                      e.target.value = contract.alertDays ?? 30;
                                      return;
                                    }
                                    if (days === (contract.alertDays ?? 30)) return;
                                    try {
                                      const response = await fetch(buildApiUrl(`/contracts/${contract.id}`), {
                                        method: 'PUT',
                                        headers: getAuthHeaders(),
                                        body: JSON.stringify({ alertDays: days })
                                      });
                                      if (response.ok) {
                                        await fetchCompanyDetails(viewingCompany.id);
                                      }
                                    } catch (error) {
                                      console.error('Erro ao salvar dias:', error);
                                    }
                                  }}
                                  className="w-16 text-center text-xs font-semibold border border-[color:var(--crm-border)] rounded-md px-2 py-1 bg-[var(--crm-surface)] text-[var(--crm-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--crm-accent)]"
                                />
                                <span className="text-xs text-[var(--crm-muted)] flex-shrink-0">dias antes do vencimento</span>
                              </div>
                            )}
                          </div>
                          {contract.startDate && (
                            <div>
                              <div className="text-xs text-[var(--crm-muted)]">Início</div>
                              <div className="text-sm font-semibold text-[var(--crm-ink)]">
                                {new Date(contract.startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                              </div>
                            </div>
                          )}
                          {contract.endDate && (
                            <div>
                              <div className="text-xs text-[var(--crm-muted)]">Término</div>
                              <div className="text-sm font-semibold text-[var(--crm-ink)]">
                                {new Date(contract.endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                              </div>
                            </div>
                          )}
                          {contract.renewalDate && (
                            <div>
                              <div className="text-xs text-[var(--crm-muted)]">Renovação</div>
                              <div className="text-sm font-semibold text-[var(--crm-ink)]">
                                {new Date(contract.renewalDate).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          )}
                        </div>

                        {contract.summary && (
                          <div className="mt-3 pt-3 border-t border-[color:var(--crm-border)]">
                            <div className="text-xs font-semibold text-[var(--crm-muted)] mb-1">Resumo do Contrato</div>
                            <p className="text-sm text-[var(--crm-ink)] whitespace-pre-wrap">{contract.summary}</p>
                          </div>
                        )}

                        {contract.description && (
                          <div className="mt-3 pt-3 border-t border-[color:var(--crm-border)]">
                            <div className="text-xs font-semibold text-[var(--crm-muted)] mb-1">Descrição</div>
                            <p className="text-xs text-[var(--crm-muted)]">{contract.description}</p>
                          </div>
                        )}

                        {contract.terms && (
                          <div className="mt-2">
                            <div className="text-xs font-semibold text-[var(--crm-ink)] mb-1">Termos</div>
                            <p className="text-xs text-[var(--crm-muted)]">{contract.terms}</p>
                          </div>
                        )}

                        {contract.slaTerms && (
                          <div className="mt-2">
                            <div className="text-xs font-semibold text-[var(--crm-ink)] mb-1">SLA</div>
                            <p className="text-xs text-[var(--crm-muted)]">{contract.slaTerms}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : null}
                </div>
              )}

              {/* Aba Atividades */}
              {activeTab === 'atividades' && (
                <div className="space-y-4">
                  {companyDetails?.activities && companyDetails.activities.length > 0 ? (
                    companyDetails.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="crm-panel-muted p-4 cursor-pointer hover:shadow-soft-xl transition-shadow"
                        role="button"
                        tabIndex={0}
                        onClick={() => openActivityFromCompany(activity.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openActivityFromCompany(activity.id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-bold text-[var(--crm-ink)]">{activity.subject}</div>
                            <div className="text-xs text-[var(--crm-muted)] mt-0.5">
                              {activity.dueDate ? new Date(activity.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openActivityFromCompany(activity.id);
                              }}
                              className="crm-btn crm-btn-ghost px-3 py-1 text-xs"
                            >
                              Abrir atividade
                            </button>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              activity.status === 'COMPLETED' ? 'bg-green-500/10 text-green-700 dark:text-green-200' :
                              activity.status === 'CANCELLED' ? 'bg-red-500/10 text-red-700 dark:text-red-200' :
                              activity.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-200' :
                              'bg-yellow-500/10 text-yellow-700 dark:text-yellow-200'
                            }`}>
                              {activity.status === 'COMPLETED' ? 'Concluído' :
                               activity.status === 'CANCELLED' ? 'Cancelado' :
                               activity.status === 'IN_PROGRESS' ? 'Em Andamento' :
                               'Pendente'}
                            </span>
                          </div>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-[var(--crm-muted)] mt-2">{activity.description}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Calendar className="w-12 h-12 text-[var(--crm-muted)] mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-[var(--crm-muted)]">Nenhuma atividade cadastrada</p>
                    </div>
                  )}
                </div>
              )}

              {/* Aba Kickoff */}
              {activeTab === 'kickoff' && (
                <div className="space-y-4">
                  <div className="crm-panel-muted p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-[var(--crm-ink)]">
                          Histórico de Kickoff {isGovernmentMode ? 'do órgão' : 'da empresa'}
                        </div>
                        <div className="text-xs text-[var(--crm-muted)]">
                          Reuniões vinculadas a oportunidades e projetos deste cadastro.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openKickoffFromCompany()}
                        className="crm-btn crm-btn-secondary px-4 py-2 text-sm"
                      >
                        <Rocket className="w-4 h-4" />
                        Abrir módulo
                      </button>
                    </div>
                  </div>

                  {companyKickoffsLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--crm-accent)]"></div>
                    </div>
                  ) : companyKickoffsError ? (
                    <div className="text-center py-12">
                      <Rocket className="w-12 h-12 text-[var(--crm-muted)] mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-semibold text-[var(--crm-ink)]">Não foi possível carregar o Kickoff</p>
                      <p className="text-xs text-[var(--crm-muted)] mt-1">{companyKickoffsError}</p>
                    </div>
                  ) : companyKickoffs.length > 0 ? (
                    companyKickoffs.map((meeting) => {
                      const kickoffStatus = KICKOFF_STATUS[meeting.status] || {
                        label: meeting.status || 'Sem status',
                        className: "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                      };

                      return (
                        <div key={meeting.id} className="crm-panel-muted p-4">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-sm font-bold text-[var(--crm-ink)]">
                                  {meeting.title || meeting.number || 'Reunião de Kickoff'}
                                </span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${kickoffStatus.className}`}>
                                  {kickoffStatus.label}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs text-[var(--crm-muted)]">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{formatKickoffDate(meeting.scheduledDate, meeting.startTime, meeting.endTime)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ClipboardList className="w-3.5 h-3.5" />
                                  <span>{KICKOFF_PHASE_LABELS[meeting.phase] || meeting.phase || 'Fase não definida'}</span>
                                </div>
                                {meeting.opportunity && (
                                  <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" />
                                    <span className="truncate">
                                      {meeting.opportunity.number ? `${meeting.opportunity.number} • ` : ''}
                                      {meeting.opportunity.title || 'Oportunidade sem título'}
                                    </span>
                                  </div>
                                )}
                                {meeting.owner?.name && (
                                  <div className="flex items-center gap-2">
                                    <User className="w-3.5 h-3.5" />
                                    <span>{meeting.owner.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openKickoffFromCompany(meeting.id)}
                              className="crm-btn crm-btn-ghost px-3 py-2 text-xs self-start"
                            >
                              <Rocket className="w-4 h-4" />
                              Ver Kickoff
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                            <div className="rounded-xl bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] border border-[color:var(--crm-border)] p-3">
                              <div className="text-lg font-extrabold text-[var(--crm-ink)]">{meeting._count?.participants ?? 0}</div>
                              <div className="text-[11px] text-[var(--crm-muted)]">Participantes</div>
                            </div>
                            <div className="rounded-xl bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] border border-[color:var(--crm-border)] p-3">
                              <div className="text-lg font-extrabold text-[var(--crm-ink)]">{meeting._count?.agendaItems ?? 0}</div>
                              <div className="text-[11px] text-[var(--crm-muted)]">Agenda</div>
                            </div>
                            <div className="rounded-xl bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] border border-[color:var(--crm-border)] p-3">
                              <div className="text-lg font-extrabold text-[var(--crm-ink)]">{meeting._count?.checklistItems ?? 0}</div>
                              <div className="text-[11px] text-[var(--crm-muted)]">Checklist</div>
                            </div>
                            <div className="rounded-xl bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] border border-[color:var(--crm-border)] p-3">
                              <div className="text-lg font-extrabold text-[var(--crm-ink)]">{meeting._count?.actionItems ?? 0}</div>
                              <div className="text-[11px] text-[var(--crm-muted)]">Ações</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12">
                      <Rocket className="w-12 h-12 text-[var(--crm-muted)] mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-[var(--crm-muted)]">
                        Nenhum kickoff vinculado a {isGovernmentMode ? 'este órgão' : 'esta empresa'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Aba Documentos */}
              {activeTab === 'documentos' && (
                <CompanyDocuments companyId={viewingCompany.id} documentType="DOCUMENT" onOpenOpportunity={id => openOpportunityFromCompany(id, 'DOCUMENT')} onManage={() => setActiveTab('oportunidades')} />
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-[color:var(--crm-border)]">
              <button 
                onClick={() => {
                  closeViewModal();
                  openEdit(viewingCompany);
                }}
                className="crm-btn crm-btn-primary"
              >
                Editar {entityLabel}
              </button>
              <button onClick={closeViewModal} className="crm-btn crm-btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
