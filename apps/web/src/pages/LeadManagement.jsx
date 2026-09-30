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

const COMPANY_SIZE_OPTIONS = [
  { value: '', label: 'Selecione' },
  { value: 'MICRO', label: 'Micro' },
  { value: 'SMALL', label: 'Pequena' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'ENTERPRISE', label: 'Enterprise' }
];

const MANUAL_LEAD_INITIAL_STATE = {
  name: '',
  document: '',
  segment: '',
  size: '',
  website: '',
  address: '',
  city: '',
  state: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  autoDistribute: false
};

const LEAD_DECISION_INITIAL_STATE = {
  projectName: '',
  projectClientType: 'NEW_CLIENT',
  sellerId: '',
  noGoReason: ''
};

export default function LeadManagement() {
  const [leadStats, setLeadStats] = useState({});
  const [companies, setCompanies] = useState([]);
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
  const [savingManualLead, setSavingManualLead] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState(MANUAL_LEAD_INITIAL_STATE);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadDecisionForm, setLeadDecisionForm] = useState(LEAD_DECISION_INITIAL_STATE);
  const [processingLeadDecision, setProcessingLeadDecision] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedClientType = normalizeClientType(searchParams.get('clientType'));
  const leadClientType = requestedClientType || 'B2B';
  const scopedClientTypeQuery = `clientType=${encodeURIComponent(leadClientType)}`;

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
      setSavingManualLead(true);
      const response = await fetch(buildApiUrl(`/companies?${scopedClientTypeQuery}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: leadName,
          document: manualLeadForm.document.trim() || null,
          segment: manualLeadForm.segment.trim() || null,
          size: manualLeadForm.size || null,
          website: manualLeadForm.website.trim() || null,
          address: manualLeadForm.address.trim() || null,
          city: manualLeadForm.city.trim() || null,
          state: manualLeadForm.state.trim().toUpperCase() || null,
          status: 'LEAD',
          clientType: leadClientType,
          autoDistribute: manualLeadForm.autoDistribute,
          contacts
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(`❌ ${result.error || 'Erro ao cadastrar lead manualmente'}`);
        return;
      }

      const autoDistributionMessage = result?.autoDistribution?.assignedSeller?.name
        ? `\n\nLead distribuído automaticamente para ${result.autoDistribution.assignedSeller.name}.`
        : '';
      alert(`✅ Lead cadastrado com sucesso.${autoDistributionMessage}`);

      setShowManualLeadModal(false);
      setManualLeadForm(MANUAL_LEAD_INITIAL_STATE);
      await Promise.all([fetchLeadStats(), fetchCompanies(), fetchSellers()]);
    } catch (error) {
      console.error('Erro ao cadastrar lead manual:', error);
      alert('❌ Erro de conexão ao cadastrar lead');
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
      noGoReason: ''
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
    <div className="space-y-8">
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
            <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
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
        title="Cadastro Manual de Lead"
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
            <div className="md:col-span-2 border-t border-[var(--crm-border)] pt-3">
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
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
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
            </div>
          </div>
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
              {savingManualLead ? 'Salvando...' : 'Cadastrar Lead'}
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
                  className="rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: getScoreColor(selectedLead.leadScore || 0) }}
                >
                  {selectedLead.status || 'LEAD'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[var(--crm-muted)] md:grid-cols-2">
                <div>Contatos: {selectedLead.contacts?.length || 0}</div>
                <div>Oportunidades: {selectedLead.opportunities?.length || 0}</div>
                <div>Cidade/UF: {[selectedLead.city, selectedLead.state].filter(Boolean).join('/') || '-'}</div>
                <div>CNPJ: {selectedLead.document || '-'}</div>
              </div>
            </div>

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

      {/* Header */}
      <PageHeader
        title="Lead"
        subtitle="Sistema inteligente de pontuação e distribuição de leads"
        icon={Target}
        gradient="blue"
        breadcrumbs={['CRM', 'Lead']}
        actions={[
          {
            label: 'Novo Lead',
            onClick: () => setShowManualLeadModal(true),
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

      {/* Tabs */}
      <div className="crm-panel-muted p-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('scoring')}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-extrabold transition-all duration-200',
            activeTab === 'scoring'
              ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.20)] border border-[rgb(var(--crm-accent-rgb)_/_0.35)] text-[var(--crm-ink)] shadow-soft-xl'
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
            'flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-extrabold transition-all duration-200',
            activeTab === 'distribution'
              ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.20)] border border-[rgb(var(--crm-accent-rgb)_/_0.35)] text-[var(--crm-ink)] shadow-soft-xl'
              : 'bg-[rgb(var(--crm-surface-rgb)_/_0.70)] border border-[color:var(--crm-border)] text-[var(--crm-ink)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.85)]'
          ].join(' ')}
        >
          <Users className="w-4 h-4" />
          Distribuicao
        </button>
      </div>

      {activeTab === 'scoring' && (
        <div className="space-y-8">
          {/* Estatísticas de Lead Scoring */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatedStats
              title="Hot Leads"
              value={leadStats.hotLeads || 0}
              subtitle="Score 80-100 pontos"
              icon={Target}
              color="red"
              trend={{ direction: 'up', value: '+12% esta semana' }}
            />
            
            <AnimatedStats
              title="Warm Leads"
              value={leadStats.warmLeads || 0}
              subtitle="Score 60-79 pontos"
              icon={TrendingUp}
              color="orange"
              trend={{ direction: 'up', value: '+8% esta semana' }}
            />
            
            <AnimatedStats
              title="Cold Leads"
              value={leadStats.coldLeads || 0}
              subtitle="Score 40-59 pontos"
              icon={Zap}
              color="blue"
              trend={{ direction: 'down', value: '-3% esta semana' }}
            />
            
            <AnimatedStats
              title="Low Priority"
              value={leadStats.lowPriority || 0}
              subtitle="Score 0-39 pontos"
              icon={Award}
              color="gray"
              trend={{ direction: 'down', value: '-15% esta semana' }}
            />
          </div>

          {/* Ações Rápidas */}
          <GradientCard gradient="indigo" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Ações Rápidas</h3>
                <p className="text-gray-600 dark:text-slate-200 text-sm">Operações em lote para otimizar o processo</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-400/10">
                <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-200" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={recalculateAllScores}
                disabled={processingScores || processingDistribution}
                className="crm-card flex items-center justify-center gap-3 p-4 border-2 border-blue-200 dark:border-blue-400/40 hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-300/70 dark:hover:bg-blue-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 text-blue-600 dark:text-blue-200 ${processingScores ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {processingScores ? 'Recalculando...' : 'Recalcular Todos os Scores'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-200">
                    Atualiza a pontuação de todas as empresas
                  </div>
                </div>
              </button>
              
              <button
                onClick={redistributeUnattended}
                disabled={processingScores || processingDistribution}
                className="crm-card flex items-center justify-center gap-3 p-4 border-2 border-green-200 dark:border-emerald-400/40 hover:border-green-400 hover:bg-green-50 dark:hover:border-emerald-300/70 dark:hover:bg-emerald-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Shuffle className={`w-5 h-5 text-green-600 dark:text-emerald-200 ${processingDistribution ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {processingDistribution ? 'Redistribuindo...' : 'Redistribuir Leads Ociosos'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-200">
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leads por Lead Score</h2>
                <p className="text-gray-600 dark:text-slate-200 mt-1">Clique em um lead para converter em oportunidade ou registrar No Go</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-400/10">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-200" />
              </div>
            </div>
            
            <div className="space-y-3">
              {companies.filter((company) => company.status === 'LEAD').length === 0 && (
                <div className="crm-card p-4 text-sm text-gray-600 dark:text-slate-200">
                  Nenhum lead em aberto para análise.
                </div>
              )}

              {[...companies]
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
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {company.name}
                      </h3>
                      
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: getScoreColor(company.leadScore) }}
                      >
                        {company.leadScore} - {getScoreLabel(company.leadScore)}
                      </span>
                      
                      <span className="text-sm text-gray-500 dark:text-slate-200">
                        {company.segment || 'Sem segmento'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-200">
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {company.opportunities?.length || 0} oportunidades
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {company.contacts?.length || 0} contatos
                      </span>
                      {company.status === 'LEAD' && (
                        <span className="font-bold text-[rgb(var(--crm-accent-rgb)_/_0.95)]">
                          Clique para converter ou No Go
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {company.status === 'LEAD' && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <input
                        type="text"
                        value={projectNameByCompany[company.id] || `Projeto ${company.name}`}
                        onChange={(e) => setCompanyProjectName(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-[#1c2f4a] text-gray-900 dark:text-slate-100 text-sm min-w-[230px]"
                        placeholder="Nome do projeto"
                      />
                      <select
                        value={projectClientTypeByCompany[company.id] || 'NEW_CLIENT'}
                        onChange={(e) => setCompanyProjectClientType(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-[#1c2f4a] text-gray-900 dark:text-slate-100 text-sm min-w-[190px]"
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
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-[#1c2f4a] text-gray-900 dark:text-slate-100 text-sm min-w-[220px]"
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
        <div className="space-y-8">
          {/* Configuração de Estratégia */}
          <GradientCard gradient="green" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Estratégia de Distribuição</h2>
                <p className="text-gray-600 dark:text-slate-200 mt-1">Configure como os leads são distribuídos para os vendedores</p>
              </div>
              <div className="p-3 rounded-xl bg-green-100 dark:bg-emerald-400/10">
                <Settings className="w-6 h-6 text-green-600 dark:text-emerald-200" />
              </div>
            </div>
            
            <div className="crm-card p-4">
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm font-semibold text-gray-700 dark:text-slate-100">Estratégia Padrão:</label>
                <select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:focus:ring-emerald-400/60 dark:focus:border-emerald-400/60 min-w-[250px] bg-white dark:bg-[#1c2f4a] text-gray-900 dark:text-slate-100"
                >
                  <option value="ROUND_ROBIN">🔄 Round Robin</option>
                  <option value="LOAD_BALANCE">⚖️ Balanceamento de Carga</option>
                  <option value="REGION_BASED">🌍 Baseado em Região</option>
                  <option value="SCORE_BASED">⭐ Baseado em Score</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-slate-200">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-400/30">
                  <strong className="text-blue-800 dark:text-blue-200">Round Robin:</strong>
                  <p className="mt-1">Distribuição sequencial entre vendedores</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-emerald-500/10 rounded-lg border border-green-200 dark:border-emerald-400/30">
                  <strong className="text-green-800 dark:text-emerald-200">Balanceamento de Carga:</strong>
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Status dos Vendedores</h2>
                <p className="text-gray-600 dark:text-slate-200 mt-1">Carga de trabalho e performance atual</p>
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
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {seller.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-200">
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
                        <div className="text-xs text-gray-500 dark:text-slate-200">
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
                        <div className="text-xs text-gray-500 dark:text-slate-200">
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leads Pendentes</h2>
                <p className="text-gray-600 dark:text-slate-200 mt-1">Distribua ou exclua leads diretamente</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-400/10">
                <Target className="w-6 h-6 text-orange-600 dark:text-orange-200" />
              </div>
            </div>

            <div className="space-y-3">
              {companies.filter((company) => company.status === 'LEAD').length === 0 && (
                <div className="crm-card p-4 text-sm text-gray-600 dark:text-slate-200">
                  Nenhum lead pendente para distribuição.
                </div>
              )}

              {companies
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
                      <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{company.name}</div>
                      <div className="text-sm text-gray-600 dark:text-slate-200 mt-1">
                        Score {company.leadScore} • {company.segment || 'Sem segmento'}
                      </div>
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
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-[#1c2f4a] text-gray-900 dark:text-slate-100 text-sm min-w-[230px]"
                        placeholder="Nome do projeto"
                      />
                      <select
                        value={projectClientTypeByCompany[company.id] || 'NEW_CLIENT'}
                        onChange={(e) => setCompanyProjectClientType(company.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-[#1c2f4a] text-gray-900 dark:text-slate-100 text-sm min-w-[190px]"
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
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-[#1c2f4a] text-gray-900 dark:text-slate-100 text-sm min-w-[220px]"
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
