import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Flame, Plus, Sparkles, Users, Mail, Phone, MapPin, Globe, FileText, Target, Calendar, Paperclip, User, FileSignature, Download, Trash2, Upload, Rocket, Clock, ClipboardList } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import Modal from '../components/Modal';
import { API_ENDPOINTS, buildApiUrl, getAuthHeaders } from '../config/api';

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
    LEAD: 'bg-slate-500/10 text-slate-700 dark:text-slate-200',
    PROSPECT: 'bg-sky-500/10 text-sky-800 dark:text-sky-200',
    ACTIVE: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
    INACTIVE: 'bg-amber-500/10 text-amber-900 dark:text-amber-200',
    CHURNED: 'bg-red-500/10 text-red-800 dark:text-red-200'
  }[status] || 'bg-slate-500/10 text-slate-700 dark:text-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${cls}`}>
      {STATUS_LABELS[status] || status || '-'}
    </span>
  );
};

const SizePill = ({ size }) => (
  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold bg-black/5 dark:bg-white/5 text-[var(--crm-ink)]">
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
          : 'bg-slate-500/[0.12] text-slate-800 dark:text-slate-200';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${cls}`}>
      <Sparkles className="h-3.5 w-3.5 opacity-80" />
      {s}
    </span>
  );
};

export default function Empresas({ clientType = 'B2B' }) {
  const navigate = useNavigate();
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
  const [docFiles, setDocFiles] = useState([]);
  const [docUploading, setDocUploading] = useState(false);
  const [viewDocFiles, setViewDocFiles] = useState([]);
  const [viewDocUploading, setViewDocUploading] = useState(false);
  const [companyKickoffs, setCompanyKickoffs] = useState([]);
  const [companyKickoffsLoading, setCompanyKickoffsLoading] = useState(false);
  const [companyKickoffsError, setCompanyKickoffsError] = useState('');
  const [formData, setFormData] = useState(() => initialFormData(pageClientType));

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

  const getUploadHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

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

  const uploadCompanyDocuments = async (companyId, files, setUploading) => {
    if (!companyId || !files || files.length === 0) return;

    try {
      if (setUploading) setUploading(true);

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(buildApiUrl(`/companies/${companyId}/documents`), {
          method: 'POST',
          headers: getUploadHeaders(),
          body: formData
        });

        if (!response.ok) {
          console.error('Erro no upload de documento:', await response.text());
        }
      }
    } catch (error) {
      console.error('Erro ao enviar documentos:', error);
    } finally {
      if (setUploading) setUploading(false);
    }
  };

  const handleFormDocSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setDocFiles((prev) => [...prev, ...files]);
    event.target.value = '';
  };

  const handleViewDocSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setViewDocFiles((prev) => [...prev, ...files]);
    event.target.value = '';
  };

  const removeFormDocFile = (index) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeViewDocFile = (index) => {
    setViewDocFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const downloadCompanyDocument = async (documentId, filename) => {
    try {
      const response = await fetch(buildApiUrl(`/companies/document/${documentId}/download`), {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Erro no download do documento:', error);
    }
  };

  const deleteCompanyDocument = async (documentId) => {
    if (!window.confirm('Tem certeza que deseja excluir este documento?')) return;

    try {
      const response = await fetch(buildApiUrl(`/companies/document/${documentId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        await fetchCompanyDetails(viewingCompany?.id);
      }
    } catch (error) {
      console.error('Erro ao deletar documento:', error);
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
    setFormData(buildPrefilledFormData(pageClientType, searchParams));
    setDocFiles([]);
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
      contacts,
      purchasesContact: {
        name: comprasContact?.name || '',
        email: comprasContact?.email || '',
        phone: comprasContact?.phone || '',
        position: comprasContact?.position || defaultSecondaryPosition
      }
    });
    setDocFiles([]);
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingCompany(null);
    setSaving(false);
    setDocFiles([]);
    setDocUploading(false);
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
          alert(errorData.error || 'Erro ao atualizar empresa');
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
          alert(errorData.error || 'Erro ao criar empresa');
        }
      }
      if (success) {
        const companyId = savedCompany?.id || editingCompany?.id;
        if (companyId && docFiles.length > 0) {
          await uploadCompanyDocuments(companyId, docFiles, setDocUploading);
          setDocFiles([]);
        }

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
      alert('Erro ao salvar empresa');
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
    setViewDocFiles([]);
    setViewDocUploading(false);
    setCompanyKickoffs([]);
    setCompanyKickoffsLoading(false);
    setCompanyKickoffsError('');
  };

  const openContractFromCompany = (contractId) => {
    if (!contractId) return;
    closeViewModal();
    navigate(`/contratos?contractId=${contractId}`);
  };

  const openOpportunityFromCompany = (opportunityId) => {
    if (!opportunityId) return;
    closeViewModal();
    navigate(`/oportunidades?opportunityId=${opportunityId}`);
  };

  const openActivityFromCompany = (activityId) => {
    if (!activityId) return;
    closeViewModal();
    navigate(`/atividades?activityId=${activityId}`);
  };

  const openKickoffFromCompany = (meetingId) => {
    const companyId = viewingCompany?.id;
    closeViewModal();

    if (meetingId) {
      navigate(`/kickoff?meetingId=${encodeURIComponent(meetingId)}`);
      return;
    }

    navigate(companyId ? `/kickoff?companyId=${encodeURIComponent(companyId)}` : '/kickoff');
  };

  const handleViewDocUpload = async () => {
    if (!viewingCompany?.id || viewDocFiles.length === 0) return;
    await uploadCompanyDocuments(viewingCompany.id, viewDocFiles, setViewDocUploading);
    setViewDocFiles([]);
    await fetchCompanyDetails(viewingCompany.id);
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
      message: errorData.error || 'Erro ao excluir empresa'
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
            <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
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

          <div className="crm-panel-muted p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-extrabold text-[var(--crm-ink)]">Documentação</div>
                <div className="text-xs text-[var(--crm-muted)]">
                  Anexe documentos {isGovernmentMode ? 'do órgão' : 'da empresa'} (PDF, DOC, XLS, imagens).
                </div>
              </div>
              {docFiles.length > 0 && (
                <span className="text-xs text-[var(--crm-muted)]">{docFiles.length} arquivo(s)</span>
              )}
            </div>

            <input
              type="file"
              multiple
              onChange={handleFormDocSelect}
              className="block w-full text-sm text-[var(--crm-ink)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-black/10 file:text-[var(--crm-ink)] hover:file:bg-black/20"
            />

            {docFiles.length > 0 && (
              <div className="space-y-2">
                {docFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-4 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--crm-border)]"
                  >
                    <div className="text-sm text-[var(--crm-ink)] truncate">{file.name}</div>
                    <button
                      type="button"
                      onClick={() => removeFormDocFile(index)}
                      className="crm-btn crm-btn-ghost px-3 py-1 text-xs"
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <div className="text-xs text-[var(--crm-muted)]">
                  Os arquivos serão enviados após salvar a empresa.
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button type="button" onClick={closeModal} className="crm-btn crm-btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving || docUploading} className="crm-btn crm-btn-primary">
              {saving || docUploading ? 'Salvando...' : editingCompany ? 'Atualizar' : 'Criar'}
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
                              <a href={`mailto:${contact.email}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                                {contact.email}
                              </a>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm text-[var(--crm-ink)]">
                              <Phone className="w-3.5 h-3.5 text-[var(--crm-muted)]" />
                              <a href={`tel:${contact.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">
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
                        {opp.description && (
                          <p className="text-xs text-[var(--crm-muted)] mt-2">{opp.description}</p>
                        )}
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
                            contract.status === 'CANCELLED' ? 'bg-gray-500/10 text-gray-700 dark:text-gray-200' :
                            contract.status === 'RENEWED' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' :
                            'bg-slate-500/10 text-slate-700 dark:text-slate-200'
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
                          {contract.startDate && (
                            <div>
                              <div className="text-xs text-[var(--crm-muted)]">Início</div>
                              <div className="text-sm font-semibold text-[var(--crm-ink)]">
                                {new Date(contract.startDate).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          )}
                          {contract.endDate && (
                            <div>
                              <div className="text-xs text-[var(--crm-muted)]">Término</div>
                              <div className="text-sm font-semibold text-[var(--crm-ink)]">
                                {new Date(contract.endDate).toLocaleDateString('pt-BR')}
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

                        {contract.description && (
                          <div className="mt-3 pt-3 border-t border-[color:var(--crm-border)]">
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
                  ) : (
                    <div className="text-center py-12">
                      <FileSignature className="w-12 h-12 text-[var(--crm-muted)] mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-[var(--crm-muted)]">Nenhum contrato cadastrado</p>
                    </div>
                  )}
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
                        className: 'bg-slate-500/10 text-slate-700 dark:text-slate-200'
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
                            <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--crm-border)] p-3">
                              <div className="text-lg font-extrabold text-[var(--crm-ink)]">{meeting._count?.participants ?? 0}</div>
                              <div className="text-[11px] text-[var(--crm-muted)]">Participantes</div>
                            </div>
                            <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--crm-border)] p-3">
                              <div className="text-lg font-extrabold text-[var(--crm-ink)]">{meeting._count?.agendaItems ?? 0}</div>
                              <div className="text-[11px] text-[var(--crm-muted)]">Agenda</div>
                            </div>
                            <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--crm-border)] p-3">
                              <div className="text-lg font-extrabold text-[var(--crm-ink)]">{meeting._count?.checklistItems ?? 0}</div>
                              <div className="text-[11px] text-[var(--crm-muted)]">Checklist</div>
                            </div>
                            <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--crm-border)] p-3">
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
                <div className="space-y-6">
                  <div className="crm-panel-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-[var(--crm-ink)]">Documentação {isGovernmentMode ? 'do órgão' : 'da empresa'}</div>
                        <div className="text-xs text-[var(--crm-muted)]">
                          Envie contratos sociais, certificados, propostas e anexos relacionados.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleViewDocUpload}
                        disabled={viewDocUploading || viewDocFiles.length === 0}
                        className="crm-btn crm-btn-primary px-4 py-2 disabled:opacity-60"
                      >
                        {viewDocUploading ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>

                    <input
                      type="file"
                      multiple
                      onChange={handleViewDocSelect}
                      className="block w-full text-sm text-[var(--crm-ink)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-black/10 file:text-[var(--crm-ink)] hover:file:bg-black/20"
                    />

                    {viewDocFiles.length > 0 && (
                      <div className="space-y-2">
                        {viewDocFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between gap-4 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[color:var(--crm-border)]"
                          >
                            <div className="text-sm text-[var(--crm-ink)] truncate">{file.name}</div>
                            <button
                              type="button"
                              onClick={() => removeViewDocFile(index)}
                              className="crm-btn crm-btn-ghost px-3 py-1 text-xs"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {companyDetails?.documents && companyDetails.documents.length > 0 ? (
                      companyDetails.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-[color:var(--crm-border)]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--crm-ink)] truncate">
                                {doc.originalName}
                              </div>
                              <div className="text-xs text-[var(--crm-muted)]">
                                {(doc.size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => downloadCompanyDocument(doc.id, doc.originalName)}
                              className="crm-btn crm-btn-ghost px-3 py-2"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCompanyDocument(doc.id)}
                              className="crm-btn crm-btn-danger px-3 py-2"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <Paperclip className="w-12 h-12 text-[var(--crm-muted)] mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-[var(--crm-muted)]">Nenhum documento cadastrado</p>
                      </div>
                    )}
                  </div>
                </div>
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
