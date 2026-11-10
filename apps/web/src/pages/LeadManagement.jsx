import LeadNextActionFields from '../components/LeadNextActionFields';
import LeadCalendarConnections from '../components/LeadCalendarConnections';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import { 
  Target, 
  Users, 
  TrendingUp, 
  Award,
  Zap,
  BarChart3,
  Settings,
  RefreshCw,
  Shuffle,
  Plus,
  Trash2,
  CheckCircle2,
  ThumbsDown,
  Calendar,
  Search,
  Pencil,
  X
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import GradientCard from '../components/GradientCard';
import Modal from '../components/Modal';
import { normalizeClientType } from '../utils/businessModel';

const PROJECT_CLIENT_TYPE_OPTIONS = [
  { value: 'NEW_CLIENT', label: 'Cliente Novo' },
  { value: 'BASE_CLIENT', label: 'Cliente da Base' },
  { value: 'RENEWAL', label: 'Renovação' }
];

const LEAD_ORIGIN_OPTIONS = [
  'Indicação de cliente', 'Indicação de parceiro', 'Indicação de colaborador',
  'Marketing digital', 'Google Ads', 'Meta Ads (Facebook/Instagram)', 'LinkedIn Ads',
  'Outras mídias pagas', 'Busca orgânica (Google/SEO)', 'Site / formulário de contato',
  'Landing page', 'Blog / conteúdo', 'E-mail marketing', 'WhatsApp', 'Telefone receptivo',
  'Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok', 'Outras redes sociais',
  'Prospecção por telefone', 'Prospecção por e-mail', 'Prospecção por redes sociais',
  'Visita comercial', 'Feira / congresso', 'Evento / networking', 'Webinar',
  'Parceiro / representante comercial', 'Marketplace / diretório de empresas',
  'Campanha offline (rádio, TV, impresso)', 'Relacionamento com cliente da base',
  'Reativação de contato', 'Importação de base', 'Outro'
];

const COMPANY_SIZE_OPTIONS = [
  { value: '', label: 'Selecione' },
  { value: 'MICRO', label: 'Micro' },
  { value: 'SMALL', label: 'Pequena' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'ENTERPRISE', label: 'Enterprise' }
];

const toDateInputValue = (value = new Date()) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateBR = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const MANUAL_LEAD_INITIAL_STATE = {
  name: '',
  document: '',
  leadOrigin: '',
  leadOriginDetail: '',
  leadEntryDate: toDateInputValue(),
  segment: '',
  size: '',
  website: '',
  address: '',
  city: '',
  state: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  prospectionNotes: '',
  leadNextAction: '',
  leadNextActionAt: '',
  leadReminderMinutes: 15,
  accountManagerId: '',
  autoDistribute: false
};

const LEAD_DECISION_INITIAL_STATE = {
  projectName: '',
  projectClientType: 'NEW_CLIENT',
  sellerId: '',
  noGoReason: '',
  leadNextAction: '',
  leadNextActionAt: '',
  leadReminderMinutes: 15,
  accountManagerId: ''
};

export default function LeadManagement() {
  const [leadStats, setLeadStats] = useState({});
  const [companies, setCompanies] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingScores, setProcessingScores] = useState(false);
  const [processingDistribution, setProcessingDistribution] = useState(false);
  const [activeTab, setActiveTab] = useState('scoring');
  const [selectedStrategy, setSelectedStrategy] = useState('LOAD_BALANCE');
  const [selectedSellerByCompany, setSelectedSellerByCompany] = useState({});
  const [projectNameByCompany, setProjectNameByCompany] = useState({});
  const [projectClientTypeByCompany, setProjectClientTypeByCompany] = useState({});
  const [showManualLeadModal, setShowManualLeadModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [savingManualLead, setSavingManualLead] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState(MANUAL_LEAD_INITIAL_STATE);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadDecisionForm, setLeadDecisionForm] = useState(LEAD_DECISION_INITIAL_STATE);
  const [processingLeadDecision, setProcessingLeadDecision] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedClientType = normalizeClientType(searchParams.get('clientType'));
  const leadClientType = requestedClientType || 'B2B';
  const compactB2B = leadClientType === 'B2B';
  const scopedClientTypeQuery = `clientType=${encodeURIComponent(leadClientType)}`;
  const normalizeSearch = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filteredCompanies = companies.filter((company) => {
    if (!compactB2B || !searchTerm) return true;
    const term = normalizeSearch(searchTerm);
    const documentDigits = searchTerm.replace(/\D/g, '');
    return [company.name, company.document, company.segment, company.city, company.state]
      .some((value) => normalizeSearch(value).includes(term))
      || (documentDigits.length > 0 && /^[\d\s./-]+$/.test(searchTerm)
        && String(company.document ?? '').replace(/\D/g, '').includes(documentDigits));
  });

  useEffect(() => {
    fetchLeadStats();
    fetchCompanies();
    fetchSellers();
  }, [leadClientType]);

  const fetchLeadStats = async () => {
    try {
      const response = await fetch(buildApiUrl(`/leadScoring?action=stats&${scopedClientTypeQuery}`), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setLeadStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch(buildApiUrl(`/leadScoring?action=range&minScore=0&maxScore=100&${scopedClientTypeQuery}`), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const response = await fetch(buildApiUrl(`/leadDistribution?action=sellers&${scopedClientTypeQuery}`), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setSellers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
    }
  };

  const updateManualLeadField = (field, value) => {
    setManualLeadForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const openLeadEditor = (lead = null) => {
    setEditingLeadId(lead?.id || null);
    setSelectedLead(null);
    setManualLeadForm(lead ? {
      ...MANUAL_LEAD_INITIAL_STATE,
      ...Object.fromEntries(['name', 'document', 'segment', 'size', 'website', 'address', 'city', 'state',
        'leadOrigin', 'leadOriginDetail', 'prospectionNotes', 'leadNextAction', 'accountManagerId'].map((key) => [key, lead[key] || ''])),
      leadEntryDate: toDateInputValue(lead.leadEntryDate || lead.createdAt),
      leadNextActionAt: lead.leadNextActionAt
        ? `${toDateInputValue(lead.leadNextActionAt)}T${String(new Date(lead.leadNextActionAt).getHours()).padStart(2, '0')}:${String(new Date(lead.leadNextActionAt).getMinutes()).padStart(2, '0')}` : '',
      leadReminderMinutes: lead.leadReminderMinutes ?? 15,
    } : { ...MANUAL_LEAD_INITIAL_STATE, leadEntryDate: toDateInputValue() });
    setShowManualLeadModal(true);
  };

  const nextActionPayload = (form) => {
    const action = form.leadNextAction.trim();
    if (Boolean(action) !== Boolean(form.leadNextActionAt)) throw new Error('Informe a próxima ação e a data/horário, ou limpe ambos.');
    if (action && !form.accountManagerId) throw new Error('Selecione o gerente de contas responsável pela próxima ação.');
    return {
      leadNextAction: action || null,
      leadNextActionAt: form.leadNextActionAt ? new Date(form.leadNextActionAt).toISOString() : null,
      leadReminderMinutes: Number(form.leadReminderMinutes),
      ...(form.accountManagerId ? { accountManagerId: form.accountManagerId } : {})
    };
  };

  const saveNextAction = async (event) => {
    event.preventDefault();
    if (processingLeadDecision) return;
    try {
      const payload = nextActionPayload(leadDecisionForm);
      setProcessingLeadDecision(true);
      const response = await fetch(buildApiUrl(`/companies/${encodeURIComponent(selectedLead.id)}?${scopedClientTypeQuery}`), {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ ...payload, clientType: leadClientType })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao salvar próxima ação.');
      setSelectedLead((prev) => ({ ...prev, ...result }));
      await fetchCompanies();
      alert('Próxima ação salva. A sincronização depende da agenda conectada pelo responsável.');
    } catch (error) { alert(error.message); }
    finally { setProcessingLeadDecision(false); }
  };

  const createManualLead = async (event) => {
    event.preventDefault();

    const leadName = manualLeadForm.name.trim();
    if (!leadName) {
      alert('❌ Informe o nome da empresa');
      return;
    }

    const contacts = [];
    if (manualLeadForm.contactName.trim()) {
      contacts.push({
        name: manualLeadForm.contactName.trim(),
        email: manualLeadForm.contactEmail.trim() || null,
        phone: manualLeadForm.contactPhone.trim() || null,
        isPrimary: true
      });
    }

    try {
      const followUp = nextActionPayload(manualLeadForm);
      setSavingManualLead(true);
      const response = await fetch(buildApiUrl(`/companies${editingLeadId ? `/${encodeURIComponent(editingLeadId)}` : ''}?${scopedClientTypeQuery}`), {
        method: editingLeadId ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...followUp,
          name: leadName,
          document: manualLeadForm.document.trim() || null,
          segment: manualLeadForm.segment.trim() || null,
          size: manualLeadForm.size || null,
          website: manualLeadForm.website.trim() || null,
          address: manualLeadForm.address.trim() || null,
          city: manualLeadForm.city.trim() || null,
          state: manualLeadForm.state.trim().toUpperCase() || null,
          leadEntryDate: manualLeadForm.leadEntryDate || null,
          leadOrigin: manualLeadForm.leadOrigin,
          leadOriginDetail: manualLeadForm.leadOriginDetail.trim() || null,
          prospectionNotes: manualLeadForm.prospectionNotes.trim() || null,
          clientType: leadClientType,
          ...(!editingLeadId ? { status: 'LEAD', autoDistribute: manualLeadForm.autoDistribute, contacts } : {})
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(`❌ ${result.error || 'Erro ao salvar lead'}`);
        return;
      }

      const autoDistributionMessage = result?.autoDistribution?.assignedSeller?.name
        ? `\n\nLead distribuído automaticamente para ${result.autoDistribution.assignedSeller.name}.`
        : '';
      alert(editingLeadId ? '✅ Lead atualizado com sucesso.' : `✅ Lead cadastrado com sucesso.${autoDistributionMessage}`);

      setShowManualLeadModal(false);
      setEditingLeadId(null);
      setManualLeadForm(MANUAL_LEAD_INITIAL_STATE);
      await Promise.all([fetchLeadStats(), fetchCompanies(), fetchSellers()]);
    } catch (error) {
      console.error('Erro ao cadastrar lead manual:', error);
      alert(`❌ ${error.message || 'Erro de conexão ao cadastrar lead'}`);
    } finally {
      setSavingManualLead(false);
    }
  };

  const openLeadDecision = (company) => {
    if (!company?.id || company.status !== 'LEAD') return;
    setSelectedLead(company);
    setLeadDecisionForm({
      projectName: projectNameByCompany[company.id] || `Projeto ${company.name}`,
      projectClientType: projectClientTypeByCompany[company.id] || 'NEW_CLIENT',
      sellerId: selectedSellerByCompany[company.id] || '',
      noGoReason: '',
      leadNextAction: company.leadNextAction || '',
      leadNextActionAt: company.leadNextActionAt ? `${toDateInputValue(company.leadNextActionAt)}T${String(new Date(company.leadNextActionAt).getHours()).padStart(2, '0')}:${String(new Date(company.leadNextActionAt).getMinutes()).padStart(2, '0')}` : '',
      leadReminderMinutes: company.leadReminderMinutes ?? 15,
      accountManagerId: company.accountManagerId || ''
    });
  };

  const closeLeadDecision = (force = false) => {
    if (processingLeadDecision && !force) return;
    setSelectedLead(null);
    setLeadDecisionForm(LEAD_DECISION_INITIAL_STATE);
  };

  const updateLeadDecisionField = (field, value) => {
    setLeadDecisionForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const recalculateAllScores = async () => {
    if (!confirm('Tem certeza que deseja recalcular todos os lead scores? Esta operação pode demorar alguns minutos.')) {
      return;
    }

    try {
      setProcessingScores(true);
      const response = await fetch(buildApiUrl(`/leadScoring?${scopedClientTypeQuery}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'recalculate-all', clientType: leadClientType })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ ${result.message}\n\nResumo:\n• ${result.summary.successful} empresas atualizadas\n• ${result.summary.failed} falhas\n• Total processado: ${result.summary.total}`);
        
        // Recarregar dados
        await fetchLeadStats();
        await fetchCompanies();
      } else {
        alert(`❌ Erro: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao recalcular scores:', error);
      alert('❌ Erro de conexão ao recalcular scores');
    } finally {
      setProcessingScores(false);
    }
  };

  const redistributeUnattended = async () => {
    if (!confirm('Tem certeza que deseja redistribuir leads não atendidos há mais de 3 dias?')) {
      return;
    }

    try {
      setProcessingDistribution(true);
      const response = await fetch(buildApiUrl(`/leadDistribution?${scopedClientTypeQuery}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          action: 'redistribute-unattended',
          daysThreshold: 3
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ ${result.message}\n\nResumo:\n• ${result.summary.successful} leads redistribuídos\n• ${result.summary.failed} falhas\n• Total processado: ${result.summary.total}`);
        
        // Recarregar dados
        await fetchSellers();
        await fetchCompanies();
      } else {
        alert(`❌ Erro: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao redistribuir leads:', error);
      alert('❌ Erro de conexão ao redistribuir leads');
    } finally {
      setProcessingDistribution(false);
    }
  };

  const createOpportunityForLead = async (companyId, sellerId = null, options = {}) => {
    try {
      const company = companies.find((item) => item.id === companyId);
      const projectName = (options.projectName || projectNameByCompany[companyId] || `Projeto ${company?.name || ''}`).trim();
      const projectClientType = options.projectClientType || projectClientTypeByCompany[companyId] || 'NEW_CLIENT';

      const response = await fetch(buildApiUrl(`/leadDistribution?${scopedClientTypeQuery}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          action: 'create-opportunity',
          companyId,
          strategy: selectedStrategy,
          ...(sellerId ? { sellerId } : {}),
          projectName,
          projectClientType
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(
          `✅ ${result.message || 'Lead distribuído com sucesso!'}\n\n• Vendedor: ${result.assignedSeller?.name}\n• Modo: ${
            sellerId ? 'Manual' : `Automático (${selectedStrategy})`
          }\n• Etapa atual: ${result.opportunity?.stage || 'LEAD'}\n• Conversão: ${
            result.convertedToOpportunity ? 'Convertido em oportunidade' : 'Aguardando avaliação do vendedor'
          }\n• Status da empresa: ${result.companyStatus || 'LEAD'}`
        );
        await fetchSellers();
        await fetchCompanies();
        return result;
      } else {
        alert(`❌ ${result.error || 'Erro ao distribuir lead'}`);
        return null;
      }
    } catch (error) {
      console.error('Erro ao distribuir lead:', error);
      alert('❌ Erro de conexão ao distribuir lead');
      return null;
    }
  };

  const convertSelectedLeadToOpportunity = async () => {
    if (!selectedLead?.id || processingLeadDecision) return;

    try {
      setProcessingLeadDecision(true);
      setCompanyProjectName(selectedLead.id, leadDecisionForm.projectName);
      setCompanyProjectClientType(selectedLead.id, leadDecisionForm.projectClientType);
      setCompanySeller(selectedLead.id, leadDecisionForm.sellerId);

      const result = await createOpportunityForLead(
        selectedLead.id,
        leadDecisionForm.sellerId || null,
        {
          projectName: leadDecisionForm.projectName,
          projectClientType: leadDecisionForm.projectClientType
        }
      );

      if (result) {
        closeLeadDecision(true);
      }
    } finally {
      setProcessingLeadDecision(false);
    }
  };

  const markSelectedLeadNoGo = async () => {
    if (!selectedLead?.id || processingLeadDecision) return;
    const reason = leadDecisionForm.noGoReason.trim();
    if (!reason) {
      alert('Informe o motivo do No Go.');
      return;
    }

    try {
      setProcessingLeadDecision(true);
      const response = await fetch(buildApiUrl(`/leadDistribution?${scopedClientTypeQuery}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'no-go',
          companyId: selectedLead.id,
          reason,
          clientType: leadClientType
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(`❌ ${result.error || 'Erro ao registrar No Go'}`);
        return;
      }

      alert(`✅ ${result.message || 'Lead marcado como No Go.'}`);
      closeLeadDecision(true);
      await Promise.all([fetchLeadStats(), fetchCompanies(), fetchSellers()]);
    } catch (error) {
      console.error('Erro ao registrar No Go:', error);
      alert('❌ Erro de conexão ao registrar No Go');
    } finally {
      setProcessingLeadDecision(false);
    }
  };

  const setCompanySeller = (companyId, sellerId) => {
    setSelectedSellerByCompany((prev) => ({
      ...prev,
      [companyId]: sellerId
    }));
  };

  const setCompanyProjectName = (companyId, projectName) => {
    setProjectNameByCompany((prev) => ({
      ...prev,
      [companyId]: projectName
    }));
  };

  const setCompanyProjectClientType = (companyId, projectClientType) => {
    setProjectClientTypeByCompany((prev) => ({
      ...prev,
      [companyId]: projectClientType
    }));
  };

  const deleteLead = async (company) => {
    if (!company?.id) return;
    if (!confirm(`Tem certeza que deseja excluir o lead "${company.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/companies/${encodeURIComponent(company.id)}?${scopedClientTypeQuery}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        alert('✅ Lead excluído com sucesso');
        await fetchLeadStats();
        await fetchCompanies();
        await fetchSellers();
      } else {
        alert(`❌ ${result.error || 'Erro ao excluir lead'}`);
      }
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
      alert('❌ Erro de conexão ao excluir lead');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#3b82f6';
    return '#6b7280';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Hot Lead';
    if (score >= 60) return 'Warm Lead';
    if (score >= 40) return 'Cold Lead';
    return 'Low Priority';
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center px-6">
        <div className="crm-panel px-5 py-4 flex items-center gap-3 motion-safe:animate-scale-in">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <div className="text-sm font-semibold text-[var(--crm-muted)]">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={compactB2B ? 'space-y-4' : 'space-y-8'}>
      {/* Loading Overlay */}
      <Modal
        isOpen={processingScores || processingDistribution}
        onClose={() => {}}
        title={processingScores ? 'Recalculando Lead Scores' : 'Redistribuindo Leads'}
        showCloseButton={false}
        closeOnOverlayClick={false}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <p className="text-sm text-[var(--crm-muted)]">
            {processingScores
              ? 'Analisando todas as empresas e recalculando pontuacoes...'
              : 'Identificando leads nao atendidos e redistribuindo...'}
          </p>
          <div className="mt-5 crm-panel-muted p-3">
            <div className="h-2 w-full rounded-full bg-black/10 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.1)] overflow-hidden">
              <div className="h-2 rounded-full bg-[rgb(var(--crm-accent-rgb)_/_0.85)] animate-pulse" style={{ width: '60%' }} />
            </div>
            <p className="mt-2 text-xs text-[var(--crm-muted)]">Esta operacao pode levar alguns minutos</p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showManualLeadModal}
        onClose={() => {
          if (savingManualLead) return;
          setShowManualLeadModal(false);
          setManualLeadForm(MANUAL_LEAD_INITIAL_STATE);
        }}
        title={editingLeadId ? 'Editar Lead' : 'Cadastro Manual de Lead'}
      >
        <form onSubmit={createManualLead} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Empresa *</label>
              <input
                type="text"
                required
                value={manualLeadForm.name}
                onChange={(e) => updateManualLeadField('name', e.target.value)}
                className="crm-input"
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <label htmlFor="lead-origin" className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Origem do lead *</label>
              <select id="lead-origin" required value={manualLeadForm.leadOrigin}
                onChange={(e) => updateManualLeadField('leadOrigin', e.target.value)} className="crm-input">
                <option value="">Selecione como o lead chegou</option>
                {LEAD_ORIGIN_OPTIONS.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lead-origin-detail" className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Detalhes da origem{manualLeadForm.leadOrigin === 'Outro' ? ' *' : ''}</label>
              <input id="lead-origin-detail" type="text" required={manualLeadForm.leadOrigin === 'Outro'}
                value={manualLeadForm.leadOriginDetail}
                onChange={(e) => updateManualLeadField('leadOriginDetail', e.target.value)}
                className="crm-input" placeholder="Quem indicou, campanha, evento ou outro meio" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">CNPJ</label>
              <input
                type="text"
                value={manualLeadForm.document}
                onChange={(e) => updateManualLeadField('document', e.target.value)}
                className="crm-input"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Data de Entrada do Lead</label>
              <input
                type="date"
                value={manualLeadForm.leadEntryDate}
                onChange={(e) => updateManualLeadField('leadEntryDate', e.target.value)}
                className="crm-input"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Segmento</label>
              <input
                type="text"
                value={manualLeadForm.segment}
                onChange={(e) => updateManualLeadField('segment', e.target.value)}
                className="crm-input"
                placeholder="Ex.: Tecnologia"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Porte</label>
              <select
                value={manualLeadForm.size}
                onChange={(e) => updateManualLeadField('size', e.target.value)}
                className="crm-input"
              >
                {COMPANY_SIZE_OPTIONS.map((option) => (
                  <option key={option.value || 'empty'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Website</label>
              <input
                type="text"
                value={manualLeadForm.website}
                onChange={(e) => updateManualLeadField('website', e.target.value)}
                className="crm-input"
                placeholder="https://empresa.com.br"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Endereço</label>
              <input
                type="text"
                value={manualLeadForm.address}
                onChange={(e) => updateManualLeadField('address', e.target.value)}
                className="crm-input"
                placeholder="Rua, número, bairro"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Cidade</label>
              <input
                type="text"
                value={manualLeadForm.city}
                onChange={(e) => updateManualLeadField('city', e.target.value)}
                className="crm-input"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">UF</label>
              <input
                type="text"
                value={manualLeadForm.state}
                onChange={(e) => updateManualLeadField('state', e.target.value)}
                className="crm-input"
                placeholder="SP"
                maxLength={2}
              />
            </div>
            {!editingLeadId && <div className="md:col-span-2 border-t border-[var(--crm-border)] pt-3">
              <p className="text-sm font-semibold text-[var(--crm-ink)] mb-2">Contato principal</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={manualLeadForm.contactName}
                  onChange={(e) => updateManualLeadField('contactName', e.target.value)}
                  className="crm-input"
                  placeholder="Nome do contato"
                />
                <input
                  type="email"
                  value={manualLeadForm.contactEmail}
                  onChange={(e) => updateManualLeadField('contactEmail', e.target.value)}
                  className="crm-input"
                  placeholder="E-mail"
                />
                <input
                  type="text"
                  value={manualLeadForm.contactPhone}
                  onChange={(e) => updateManualLeadField('contactPhone', e.target.value)}
                  className="crm-input"
                  placeholder="Telefone"
                />
              </div>
            </div>}
            {!editingLeadId && <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="manualLeadAutoDistribute"
                type="checkbox"
                checked={manualLeadForm.autoDistribute}
                onChange={(e) => updateManualLeadField('autoDistribute', e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="manualLeadAutoDistribute" className="text-sm text-[var(--crm-ink)]">
                Distribuir lead automaticamente após cadastrar
              </label>
            </div>}
          </div>
          {/* Histórico de Abordagem */}
          <fieldset className="crm-panel-muted space-y-2 p-4 md:col-span-2">
            <legend className="px-1 text-sm font-bold text-[var(--crm-ink)]">Histórico de Abordagem</legend>
            <p className="text-xs text-[var(--crm-muted)]">Registre como o lead foi abordado, contatos realizados e o andamento da prospecção.</p>
            <textarea
              className="crm-input min-h-[100px] resize-y"
              maxLength={5000}
              placeholder="Ex.: 10/11 — Ligação inicial, apresentei a empresa. Lead demonstrou interesse em soluções de conectividade. Próximo passo: enviar proposta por e-mail..."
              value={manualLeadForm.prospectionNotes}
              onChange={(e) => updateManualLeadField('prospectionNotes', e.target.value)}
              disabled={savingManualLead}
            />
            <p className="text-xs text-[var(--crm-muted)] text-right">{(manualLeadForm.prospectionNotes || '').length}/5000</p>
          </fieldset>
          <LeadNextActionFields value={manualLeadForm} onChange={updateManualLeadField} sellers={sellers} prefix="new-lead" disabled={savingManualLead} />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowManualLeadModal(false);
                setManualLeadForm(MANUAL_LEAD_INITIAL_STATE);
              }}
              className="crm-btn crm-btn-secondary"
              disabled={savingManualLead}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="crm-btn crm-btn-primary"
              disabled={savingManualLead}
            >
              {savingManualLead ? 'Salvando...' : editingLeadId ? 'Salvar alterações' : 'Cadastrar Lead'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedLead)}
        onClose={closeLeadDecision}
        title="Decisão do Lead"
      >
        {selectedLead && (
          <div className="space-y-5">
            <div className="crm-panel-muted p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[var(--crm-ink)]">{selectedLead.name}</h3>
                  <p className="mt-1 text-sm text-[var(--crm-muted)]">
                    {selectedLead.segment || 'Sem segmento'} • Score {selectedLead.leadScore || 0} • {getScoreLabel(selectedLead.leadScore || 0)}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  style={{ backgroundColor: getScoreColor(selectedLead.leadScore || 0) }}
                >
                  {selectedLead.status || 'LEAD'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[var(--crm-muted)] md:grid-cols-2">
                <div>Contatos: {selectedLead.contacts?.length || 0}</div>
                <div>Oportunidades: {selectedLead.opportunities?.length || 0}</div>
                <div>Origem do lead: {selectedLead.leadOrigin || 'Não informada'}</div>
                {selectedLead.leadOriginDetail && <div>Detalhes da origem: {selectedLead.leadOriginDetail}</div>}
                <div>Entrada do Lead: {formatDateBR(selectedLead.leadEntryDate || selectedLead.createdAt)}</div>
                <div>Cidade/UF: {[selectedLead.city, selectedLead.state].filter(Boolean).join('/') || '-'}</div>
                <div>CNPJ: {selectedLead.document || '-'}</div>
              </div>
            </div>

            <form onSubmit={saveNextAction} className="space-y-3">
              <LeadNextActionFields value={leadDecisionForm} onChange={updateLeadDecisionField} sellers={sellers} prefix="edit-lead" disabled={processingLeadDecision} />
              <button type="submit" className="crm-btn crm-btn-primary" disabled={processingLeadDecision}>
                {processingLeadDecision ? 'Salvando...' : 'Salvar próxima ação'}
              </button>
            </form>

            <button type="button" className="crm-btn crm-btn-secondary" disabled={processingLeadDecision}
              onClick={() => openLeadEditor(selectedLead)}>
              <Pencil className="h-4 w-4" /> Editar Lead
            </button>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="crm-card p-4 border border-emerald-500/25">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <h4 className="font-black text-[var(--crm-ink)]">Converter em oportunidade</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--crm-muted)]">Nome do projeto</label>
                    <input
                      type="text"
                      value={leadDecisionForm.projectName}
                      onChange={(e) => updateLeadDecisionField('projectName', e.target.value)}
                      className="crm-input"
                      placeholder="Nome do projeto/oportunidade"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--crm-muted)]">Tipo</label>
                    <select
                      value={leadDecisionForm.projectClientType}
                      onChange={(e) => updateLeadDecisionField('projectClientType', e.target.value)}
                      className="crm-input"
                    >
                      {PROJECT_CLIENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--crm-muted)]">Vendedor</label>
                    <select
                      value={leadDecisionForm.sellerId}
                      onChange={(e) => updateLeadDecisionField('sellerId', e.target.value)}
                      className="crm-input"
                    >
                      <option value="">Automático ({selectedStrategy})</option>
                      {sellers.map((seller) => (
                        <option key={seller.id} value={seller.id}>
                          {seller.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={convertSelectedLeadToOpportunity}
                    disabled={processingLeadDecision}
                    className="crm-btn crm-btn-primary w-full justify-center bg-emerald-600 hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {processingLeadDecision ? 'Convertendo...' : 'Converter em oportunidade'}
                  </button>
                </div>
              </div>

              <div className="crm-card p-4 border border-red-500/25">
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsDown className="h-5 w-5 text-red-500" />
                  <h4 className="font-black text-[var(--crm-ink)]">Registrar No Go</h4>
                </div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--crm-muted)]">Motivo</label>
                <textarea
                  value={leadDecisionForm.noGoReason}
                  onChange={(e) => updateLeadDecisionField('noGoReason', e.target.value)}
                  className="crm-input min-h-[156px] resize-y"
                  placeholder="Explique por que este lead nao deve avançar agora..."
                />
                <button
                  type="button"
                  onClick={markSelectedLeadNoGo}
                  disabled={processingLeadDecision}
                  className="crm-btn mt-3 w-full justify-center bg-red-600 text-white hover:bg-red-500"
                >
                  <ThumbsDown className="h-4 w-4" />
                  {processingLeadDecision ? 'Registrando...' : 'Registrar No Go'}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => closeLeadDecision()}
                className="crm-btn crm-btn-secondary"
                disabled={processingLeadDecision}
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showCalendarModal} onClose={() => setShowCalendarModal(false)} title="Minha agenda">
        {showCalendarModal && <LeadCalendarConnections />}
      </Modal>

      {/* Header */}
      <PageHeader
        compact={compactB2B}
        title="Lead"
        subtitle={compactB2B ? 'Pontuação e distribuição de leads.' : 'Sistema inteligente de pontuação e distribuição de leads'}
        icon={Target}
        gradient="blue"
        breadcrumbs={['CRM', 'Lead']}
        actions={[
          {
            label: 'Minha agenda',
            onClick: () => setShowCalendarModal(true),
            icon: Calendar,
            variant: 'secondary'
          },
          {
            label: 'Novo Lead',
            onClick: () => openLeadEditor(),
            icon: Plus,
            variant: 'secondary',
            disabled: processingScores || processingDistribution
          },
          {
            label: processingScores ? 'Recalculando...' : 'Recalcular Scores',
            onClick: recalculateAllScores,
            icon: RefreshCw,
            variant: 'primary',
            disabled: processingScores || processingDistribution
          },
          {
            label: processingDistribution ? 'Redistribuindo...' : 'Redistribuir Leads',
            onClick: redistributeUnattended,
            icon: Shuffle,
            variant: 'secondary',
            disabled: processingScores || processingDistribution
          }
        ]}
      />

      {compactB2B && (
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchTerm(searchInput.trim());
          }}
          className="crm-panel p-4"
        >
          <label htmlFor="lead-b2b-search" className="mb-2 block text-sm font-semibold text-[var(--crm-ink)]">Pesquisar leads</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="lead-b2b-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Empresa, CNPJ, segmento ou cidade"
              className="crm-input min-w-0 flex-1"
            />
            <button type="submit" className="crm-btn crm-btn-primary">
              <Search className="h-4 w-4" />
              Pesquisar
            </button>
            {(searchInput || searchTerm) && (
              <button type="button" className="crm-btn crm-btn-secondary" onClick={() => {
                setSearchInput('');
                setSearchTerm('');
              }}>
                <X className="h-4 w-4" />
                Limpar
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="mt-2 text-sm text-[var(--crm-muted)]" role="status">
              {filteredCompanies.filter((company) => company.status === 'LEAD').length} lead(s) encontrado(s) para “{searchTerm}”.
            </p>
          )}
        </form>
      )}

      <LeadCalendarConnections />

      {/* Tabs */}
      <div className={`crm-panel-muted flex flex-wrap gap-2 ${compactB2B ? 'rounded-xl p-1.5' : 'p-2'}`} >
        <button
          type="button"
          onClick={() => setActiveTab('scoring')}
          className={[
            `flex items-center gap-2 transition-all duration-200 ${compactB2B ? 'px-3 py-1.5 rounded-lg text-xs font-semibold' : 'px-4 py-2 rounded-2xl text-sm font-extrabold'}`,
            activeTab === 'scoring'
              ? (compactB2B ? 'bg-blue-600 border border-blue-600 text-white shadow-sm' : 'bg-[rgb(var(--crm-accent-rgb)_/_0.20)] border border-[rgb(var(--crm-accent-rgb)_/_0.35)] text-[var(--crm-ink)] shadow-soft-xl')
              : 'bg-[rgb(var(--crm-surface-rgb)_/_0.70)] border border-[color:var(--crm-border)] text-[var(--crm-ink)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.85)]'
          ].join(' ')}
        >
          <BarChart3 className="w-4 h-4" />
          Lead Scoring
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('distribution')}
          className={[
            `flex items-center gap-2 transition-all duration-200 ${compactB2B ? 'px-3 py-1.5 rounded-lg text-xs font-semibold' : 'px-4 py-2 rounded-2xl text-sm font-extrabold'}`,
            activeTab === 'distribution'
              ? (compactB2B ? 'bg-blue-600 border border-blue-600 text-white shadow-sm' : 'bg-[rgb(var(--crm-accent-rgb)_/_0.20)] border border-[rgb(var(--crm-accent-rgb)_/_0.35)] text-[var(--crm-ink)] shadow-soft-xl')
              : 'bg-[rgb(var(--crm-surface-rgb)_/_0.70)] border border-[color:var(--crm-border)] text-[var(--crm-ink)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.85)]'
          ].join(' ')}
        >
          <Users className="w-4 h-4" />
          Distribuicao
        </button>
      </div>

      {activeTab === 'scoring' && (
        <div className={compactB2B ? 'space-y-4' : 'space-y-8'}>
          {/* Estatísticas de Lead Scoring */}
          <div className={compactB2B ? 'grid grid-cols-2 xl:grid-cols-4 gap-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}>
            <AnimatedStats
              size={compactB2B ? 'dense' : 'default'}
              title="Hot Leads"
              value={leadStats.hotLeads || 0}
              subtitle="Score 80-100 pontos"
              icon={Target}
              color="red"
              trend={{ direction: 'up', value: '+12% esta semana' }}
            />
            
            <AnimatedStats
              size={compactB2B ? 'dense' : 'default'}
              title="Warm Leads"
              value={leadStats.warmLeads || 0}
              subtitle="Score 60-79 pontos"
              icon={TrendingUp}
              color="orange"
              trend={{ direction: 'up', value: '+8% esta semana' }}
            />
            
            <AnimatedStats
              size={compactB2B ? 'dense' : 'default'}
              title="Cold Leads"
              value={leadStats.coldLeads || 0}
              subtitle="Score 40-59 pontos"
              icon={Zap}
              color="blue"
              trend={{ direction: 'down', value: '-3% esta semana' }}
            />
            
            <AnimatedStats
              size={compactB2B ? 'dense' : 'default'}
              title="Low Priority"
              value={leadStats.lowPriority || 0}
              subtitle="Score 0-39 pontos"
              icon={Award}
              color="gray"
              trend={{ direction: 'down', value: '-15% esta semana' }}
            />
          </div>

          {/* Ações Rápidas */}
          <GradientCard gradient="indigo" className={compactB2B ? "!rounded-xl p-4" : "p-6"}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Ações Rápidas</h3>
                <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">Operações em lote para otimizar o processo</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-400/10">
                <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-200" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={recalculateAllScores}
                disabled={processingScores || processingDistribution}
                className="crm-card flex items-center justify-center gap-3 p-4 border-2 border-blue-200 dark:border-blue-400/40 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:border-blue-300/70 dark:hover:bg-blue-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 text-blue-600 dark:text-blue-200 ${processingScores ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    {processingScores ? 'Recalculando...' : 'Recalcular Todos os Scores'}
                  </div>
                  <div className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    Atualiza a pontuação de todas as empresas
                  </div>
                </div>
              </button>
              
              <button
                onClick={redistributeUnattended}
                disabled={processingScores || processingDistribution}
                className="crm-card flex items-center justify-center gap-3 p-4 border-2 border-green-200 dark:border-green-800 dark:border-emerald-400/40 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950 dark:hover:border-emerald-300/70 dark:hover:bg-emerald-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Shuffle className={`w-5 h-5 text-green-600 dark:text-emerald-200 ${processingDistribution ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    {processingDistribution ? 'Redistribuindo...' : 'Redistribuir Leads Ociosos'}
                  </div>
                  <div className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    Reatribui leads não atendidos há 3+ dias
                  </div>
                </div>
              </button>
            </div>
          </GradientCard>

          {/* Lista de Empresas por Score */}
          <GradientCard gradient="blue" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Leads por Lead Score</h2>
                <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">Clique em um lead para converter em oportunidade ou registrar No Go</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-400/10">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-200" />
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredCompanies.filter((company) => company.status === 'LEAD').length === 0 && (
                <div className="crm-card p-4 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  Nenhum lead em aberto para análise.
                </div>
              )}

              {[...filteredCompanies]
                .filter((company) => company.status === 'LEAD')
                .sort((a, b) => b.leadScore - a.leadScore)
                .slice(0, 20)
                .map(company => (
                <div 
                  key={company.id}
                  role={company.status === 'LEAD' ? 'button' : undefined}
                  tabIndex={company.status === 'LEAD' ? 0 : undefined}
                  onClick={() => openLeadDecision(company)}
                  onKeyDown={(event) => {
                    if (company.status === 'LEAD' && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      openLeadDecision(company);
                    }
                  }}
                  className={`crm-card flex items-center justify-between p-4 hover:shadow-md dark:hover:shadow-soft-xl transition-all duration-200 ${company.status === 'LEAD' ? 'cursor-pointer hover:border-[rgb(var(--crm-accent-rgb)_/_0.45)]' : ''}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        {company.name}
                      </h3>
                      
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]"
                        style={{ backgroundColor: getScoreColor(company.leadScore) }}
                      >
                        {company.leadScore} - {getScoreLabel(company.leadScore)}
                      </span>
                      
                      <span className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        {company.segment || 'Sem segmento'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {company.opportunities?.length || 0} oportunidades
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {company.contacts?.length || 0} contatos
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Entrada: {formatDateBR(company.leadEntryDate || company.createdAt)}
                      </span>
                      {company.leadNextAction && <span>
                        Próxima ação: {company.leadNextAction} • {new Date(company.leadNextActionAt).toLocaleString('pt-BR')}
                      </span>}
                      {company.status === 'LEAD' && (
                        <span className="font-bold text-[rgb(var(--crm-accent-rgb)_/_0.95)]">
                          Clique para converter ou No Go
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {company.status === 'LEAD' && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button type="button" className="crm-btn crm-btn-secondary"
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); openLeadEditor(company); }}>
                        <Pencil className="h-4 w-4" /> Editar Lead
                      </button>
                      <input
                        type="text"
                        value={projectNameByCompany[company.id] || `Projeto ${company.name}`}
                        onChange={(e) => setCompanyProjectName(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm min-w-[230px]"
                        placeholder="Nome do projeto"
                      />
                      <select
                        value={projectClientTypeByCompany[company.id] || 'NEW_CLIENT'}
                        onChange={(e) => setCompanyProjectClientType(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm min-w-[190px]"
                      >
                        {PROJECT_CLIENT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedSellerByCompany[company.id] || ''}
                        onChange={(e) => setCompanySeller(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm min-w-[220px]"
                      >
                        <option value="">Automático ({selectedStrategy})</option>
                        {sellers.map((seller) => (
                          <option key={seller.id} value={seller.id}>
                            {seller.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          createOpportunityForLead(company.id, selectedSellerByCompany[company.id] || null);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Converter
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLead(company);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium text-sm flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Lead
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GradientCard>
        </div>
      )}

      {activeTab === 'distribution' && (
        <div className={compactB2B ? 'space-y-4' : 'space-y-8'}>
          {/* Configuração de Estratégia */}
          <GradientCard gradient="green" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Estratégia de Distribuição</h2>
                <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">Configure como os leads são distribuídos para os vendedores</p>
              </div>
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-950 dark:bg-emerald-400/10">
                <Settings className="w-6 h-6 text-green-600 dark:text-emerald-200" />
              </div>
            </div>
            
            <div className="crm-card p-4">
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Estratégia Padrão:</label>
                <select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="px-3 py-2 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:focus:ring-emerald-400/60 dark:focus:border-emerald-400/60 min-w-[250px] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="ROUND_ROBIN">🔄 Round Robin</option>
                  <option value="LOAD_BALANCE">⚖️ Balanceamento de Carga</option>
                  <option value="REGION_BASED">🌍 Baseado em Região</option>
                  <option value="SCORE_BASED">⭐ Baseado em Score</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-400/30">
                  <strong className="text-blue-800 dark:text-blue-200">Round Robin:</strong>
                  <p className="mt-1">Distribuição sequencial entre vendedores</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950 dark:bg-emerald-500/10 rounded-lg border border-green-200 dark:border-green-800 dark:border-emerald-400/30">
                  <strong className="text-green-800 dark:text-green-300 dark:text-emerald-200">Balanceamento de Carga:</strong>
                  <p className="mt-1">Atribui ao vendedor com menos oportunidades</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-400/30">
                  <strong className="text-purple-800 dark:text-purple-200">Baseado em Região:</strong>
                  <p className="mt-1">Considera a localização geográfica</p>
                </div>
                <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-lg border border-orange-200 dark:border-orange-400/30">
                  <strong className="text-orange-800 dark:text-orange-200">Baseado em Score:</strong>
                  <p className="mt-1">Leads de alto score para vendedores experientes</p>
                </div>
              </div>
            </div>
          </GradientCard>

          {/* Status dos Vendedores */}
          <GradientCard gradient="purple" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Status dos Vendedores</h2>
                <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">Carga de trabalho e performance atual</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-400/10">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-200" />
              </div>
            </div>
            
            <div className="space-y-4">
              {sellers.map(seller => (
                <div 
                  key={seller.id}
                  className="crm-card flex items-center justify-between p-4 hover:shadow-md dark:hover:shadow-soft-xl transition-all duration-200"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {seller.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        {seller.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        <span>{seller.email}</span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Região: {seller.region || 'Não definida'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {seller.activeOpportunities || 0}
                        </div>
                        <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          Oportunidades
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          R$ {(seller.totalValue || 0).toLocaleString('pt-BR', { 
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0 
                          })}
                        </div>
                        <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          Pipeline
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GradientCard>

          {/* Leads Pendentes de Distribuição */}
          <GradientCard gradient="orange" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Leads Pendentes</h2>
                <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">Distribua ou exclua leads diretamente</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-400/10">
                <Target className="w-6 h-6 text-orange-600 dark:text-orange-200" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredCompanies.filter((company) => company.status === 'LEAD').length === 0 && (
                <div className="crm-card p-4 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  Nenhum lead pendente para distribuição.
                </div>
              )}

              {filteredCompanies
                .filter((company) => company.status === 'LEAD')
                .sort((a, b) => b.leadScore - a.leadScore)
                .slice(0, 20)
                .map((company) => (
                  <div
                    key={`distribution-${company.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openLeadDecision(company)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openLeadDecision(company);
                      }
                    }}
                    className="crm-card flex cursor-pointer items-center justify-between p-4 hover:shadow-md dark:hover:shadow-soft-xl transition-all duration-200 hover:border-[rgb(var(--crm-accent-rgb)_/_0.45)]"
                  >
                    <div>
                      <div className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{company.name}</div>
                      <div className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">
                        Score {company.leadScore} • {company.segment || 'Sem segmento'}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        <Calendar className="h-3.5 w-3.5" />
                        Entrada: {formatDateBR(company.leadEntryDate || company.createdAt)}
                      </div>
                      {company.leadNextAction && <div className="mt-1 text-sm text-[var(--crm-muted)]">
                        Próxima ação: {company.leadNextAction} • {new Date(company.leadNextActionAt).toLocaleString('pt-BR')}
                      </div>}
                      <div className="mt-1 text-xs font-bold text-[rgb(var(--crm-accent-rgb)_/_0.95)]">
                        Clique para converter ou registrar No Go
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <input
                        type="text"
                        value={projectNameByCompany[company.id] || `Projeto ${company.name}`}
                        onChange={(e) => setCompanyProjectName(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm min-w-[230px]"
                        placeholder="Nome do projeto"
                      />
                      <select
                        value={projectClientTypeByCompany[company.id] || 'NEW_CLIENT'}
                        onChange={(e) => setCompanyProjectClientType(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm min-w-[190px]"
                      >
                        {PROJECT_CLIENT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedSellerByCompany[company.id] || ''}
                        onChange={(e) => setCompanySeller(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm min-w-[220px]"
                      >
                        <option value="">Automático ({selectedStrategy})</option>
                        {sellers.map((seller) => (
                          <option key={seller.id} value={seller.id}>
                            {seller.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          createOpportunityForLead(company.id, selectedSellerByCompany[company.id] || null);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        Converter
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLead(company);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium text-sm flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Lead
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </GradientCard>
        </div>
      )}
    </div>
  );
}
