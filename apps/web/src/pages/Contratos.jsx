import LeadCalendarConnections from '../components/LeadCalendarConnections';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  FileText, 
  Calendar, 
  DollarSign, 
  Building, 
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText as Contract,
  Zap,
  Download,
  FileCheck,
  Clock,
  Shield,
  Trash2
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import Modal from '../components/Modal';
import { buildApiUrl, API_ENDPOINTS, getAuthHeaders } from '../config/api';

const formatContractDate = value => value ? new Date(String(value).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informado';

const Contratos = () => {
  const [contracts, setContracts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchParams] = useSearchParams();
  const lastOpenedContractId = useRef(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalValue: 0,
    expiringSoon: 0
  });
  const [formData, setFormData] = useState({
    number: '',
    title: '',
    description: '',
    summary: '',
    status: 'AWAITING_SIGNATURE',
    value: '',
    startDate: '',
    endDate: '',
    companyId: '',
    opportunityId: '',
    autoRenewal: false,
    renewalPeriod: '',
    renewalNotice: '',
    expirationAlert: true,
    slaResponseTime: '',
    slaResolutionTime: '',
    slaAvailability: '',
    slaDescription: ''
  });
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  const fetchContracts = async () => {
    try {
      let loadedContracts = [];
      const [contractsRes, statsRes] = await Promise.all([
        fetch(buildApiUrl('/contracts'), {
          headers: getAuthHeaders()
        }),
        fetch(buildApiUrl('/contracts/reports/summary'), {
          headers: getAuthHeaders()
        })
      ]);
      
      if (contractsRes.ok) {
        const data = await contractsRes.json();
        const contractsArray = Array.isArray(data) ? data : (Array.isArray(data?.contracts) ? data.contracts : []);
        loadedContracts = contractsArray;
        setContracts(contractsArray);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          total: statsData.totalContracts || 0,
          active: statsData.activeContracts || 0,
          totalValue: statsData.totalValue || 0,
          expiringSoon: statsData.expiringSoon || 0
        });
      }
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch(buildApiUrl('/companies'), {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        const companiesArray = data.companies || data;
        setCompanies(Array.isArray(companiesArray) ? companiesArray : []);
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const response = await fetch(buildApiUrl('/opportunities'), {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        const opportunitiesArray = data.opportunities || data;
        setOpportunities(Array.isArray(opportunitiesArray) ? opportunitiesArray : []);
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
    }
  };

  const openContractById = async (contractId) => {
    if (!contractId) return;
    try {
      const response = await fetch(buildApiUrl(`/contracts/${contractId}`), {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedContract(data);
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error('Erro ao abrir contrato:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchContracts(),
        fetchCompanies(),
        fetchOpportunities()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  useEffect(() => {
    const contractId = searchParams.get('contractId');
    if (!contractId) return;
    if (lastOpenedContractId.current === contractId) return;
    lastOpenedContractId.current = contractId;
    openContractById(contractId);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = selectedContract 
        ? buildApiUrl(`/contracts/${selectedContract.id}`)
        : buildApiUrl('/contracts');
      
      const method = selectedContract ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const contractData = await response.json();
        
        // Upload de arquivos se houver
        if (selectedFiles.length > 0) {
          await uploadFiles(contractData.id);
        }
        
        await fetchContracts();
        setShowModal(false);
        resetForm();
        alert('Contrato salvo com sucesso!');
      } else {
        const error = await response.json();
        const errorMessage = error.error || 'Erro ao salvar contrato';
        
        // Mensagem específica para conflito de número
        if (response.status === 409) {
          alert('Número de contrato já existe! Por favor, use um número diferente.');
        } else {
          alert(errorMessage);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      alert('Erro de conexão');
    }
  };

  const resetForm = () => {
    setFormData({
      number: '',
      title: '',
      description: '',
      summary: '',
      status: 'AWAITING_SIGNATURE',
      value: '',
      startDate: '',
      endDate: '',
      companyId: '',
      opportunityId: '',
      autoRenewal: false,
      renewalPeriod: '',
      renewalNotice: '',
    expirationAlert: true,
      slaResponseTime: '',
      slaResolutionTime: '',
      slaAvailability: '',
      slaDescription: ''
    });
    setSelectedContract(null);
    setSelectedFiles([]);
    setUploadProgress({});
  };

  const handleEdit = (contract) => {
    setSelectedContract(contract);
    setFormData({
      number: contract.number || '',
      title: contract.title,
      description: contract.description || '',
      summary: contract.summary || '',
      status: contract.status || 'AWAITING_SIGNATURE',
      value: contract.value.toString(),
      startDate: contract.startDate?.split('T')[0] || '',
      endDate: contract.endDate?.split('T')[0] || '',
      companyId: contract.companyId,
      opportunityId: contract.opportunityId || '',
      autoRenewal: Boolean(contract.autoRenewal),
      renewalPeriod: contract.renewalPeriod?.toString() || '',
      renewalNotice: contract.renewalNotice?.toString() || '',
      expirationAlert: contract.expirationAlert !== false,
      slaResponseTime: contract.slaResponseTime?.toString() || '',
      slaResolutionTime: contract.slaResolutionTime?.toString() || '',
      slaAvailability: contract.slaAvailability?.toString() || '',
      slaDescription: contract.slaDescription || ''
    });
    setShowModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]",
      AWAITING_SIGNATURE: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300",
      ACTIVE: "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300",
      RENEWAL_PENDING: "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300",
      EXPIRED: "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]",
      CANCELLED: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300",
      RENEWED: "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
    };
    return colors[status] || "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]";
  };

  const getStatusText = (status) => {
    const texts = {
      DRAFT: 'Rascunho',
      AWAITING_SIGNATURE: 'Aguardando Assinatura',
      ACTIVE: 'Ativo',
      RENEWAL_PENDING: 'A Renovar',
      EXPIRED: 'Expirado',
      CANCELLED: 'Cancelado',
      RENEWED: 'Renovado'
    };
    return texts[status] || status;
  };

  const companyFilterId = searchParams.get('companyId');

  const filteredContracts = Array.isArray(contracts) ? contracts.filter(contract => {
    const matchesSearch = (contract.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (contract.company?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (contract.number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || contract.status === statusFilter;
    const matchesCompany = !companyFilterId || contract.companyId === companyFilterId;
    return matchesSearch && matchesStatus && matchesCompany;
  }) : [];

  const handleViewDetails = (contract) => {
    openContractById(contract.id);
  };

  const processRenewals = () => fetchContracts();

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (contractId) => {
    if (selectedFiles.length === 0) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        setUploadProgress(prev => ({ ...prev, [i]: 0 }));
        
        const response = await fetch(buildApiUrl(`/contracts/${contractId}/upload`), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        if (response.ok) {
          setUploadProgress(prev => ({ ...prev, [i]: 100 }));
        } else {
          console.error('Erro no upload:', await response.text());
        }
      } catch (error) {
        console.error('Erro no upload:', error);
      }
    }
  };

  const downloadFile = async (attachmentId, filename) => {
    try {
      const response = await fetch(buildApiUrl(`/contracts/attachment/${attachmentId}/download`), {
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
      console.error('Erro no download:', error);
    }
  };

  const deleteFile = async (attachmentId) => {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;

    try {
      const response = await fetch(buildApiUrl(`/contracts/attachment/${attachmentId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        // Recarregar detalhes do contrato
        if (selectedContract) {
          const contractResponse = await fetch(buildApiUrl(`/contracts/${selectedContract.id}`), {
            headers: getAuthHeaders()
          });
          if (contractResponse.ok) {
            const updatedContract = await contractResponse.json();
            setSelectedContract(updatedContract);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Gestão de Contratos"
        subtitle="Gerencie contratos, renovações e documentos de forma inteligente"
        icon={Contract}
        gradient="blue"
        breadcrumbs={['Gestão', 'Contratos']}
        actions={[
          {
            label: 'Atualizar contratos',
            icon: RefreshCw,
            onClick: processRenewals,
            variant: 'secondary'
          },
          {
            label: 'Novo Contrato',
            icon: Plus,
            onClick: () => { resetForm(); setShowModal(true); },
            variant: 'primary'
          }
        ]}
      />

      <LeadCalendarConnections />
      <div className="crm-panel-muted p-4 text-sm text-[var(--crm-muted)]">Contratos ativos ou a renovar recebem aviso 30 dias antes do vencimento, às 9h (Brasília), na agenda conectada do gerente de contas da empresa. Cópias de oportunidades chegam como rascunho: complete as datas e ative o contrato.</div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Total de Contratos"
          value={stats.total}
          subtitle="Todos os contratos"
          icon={FileText}
          color="blue"
        />
        
        <AnimatedStats
          title="Contratos Ativos"
          value={stats.active}
          subtitle="Em vigência"
          icon={CheckCircle}
          color="green"
        />
        
        <AnimatedStats
          title="Valor Total"
          value={stats.totalValue}
          subtitle="Receita contratada"
          icon={DollarSign}
          color="purple"
          prefix="R$ "
        />
        
        <AnimatedStats
          title="Vencendo em 30 dias"
          value={stats.expiringSoon}
          subtitle="Requer atenção"
          icon={AlertCircle}
          color="orange"
        />
      </div>

      {/* Modern Table */}
      <ModernTable
        title="Lista de Contratos"
        data={filteredContracts}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'AWAITING_SIGNATURE', label: 'Aguardando Assinatura' },
              { value: 'ACTIVE', label: 'Ativo' },
              { value: 'RENEWAL_PENDING', label: 'A Renovar' },
              { value: 'CANCELLED', label: 'Cancelado' },
              { value: 'EXPIRED', label: 'Expirado' },
              { value: 'RENEWED', label: 'Renovado' },
              { value: 'DRAFT', label: 'Rascunho' }
            ]
          }
        ]}
        columns={[
          {
            key: 'contract',
            label: 'Contrato',
            render: (contract) => (
              <div className="flex items-center">
                <GradientCard gradient="blue" className="p-2 mr-3">
                  <FileText className="w-4 h-4 text-blue-600" />
                </GradientCard>
                <div>
                  <div className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    {contract.title}
                  </div>
                  <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    {contract.number}
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'company',
            label: 'Empresa',
            render: (contract) => (
              <div className="flex items-center">
                <Building className="w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)] mr-2" />
                <div>
                  <div className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    {contract.company?.name}
                  </div>
                  <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    {contract.company?.document}
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'value',
            label: 'Valor',
            render: (contract) => (
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 text-green-500 mr-2" />
                <div className="text-sm font-semibold text-green-600">
                  R$ {contract.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )
          },
          {
            key: 'period',
            label: 'Período',
            render: (contract) => {
              const daysToExpire = Math.ceil((new Date(contract.endDate) - new Date()) / (1000 * 60 * 60 * 24));
              const isExpiringSoon = ['ACTIVE', 'RENEWAL_PENDING'].includes(contract.status) && contract.endDate && daysToExpire <= 30 && daysToExpire >= 0;
              
              return (
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)] mr-2" />
                  <div>
                    <div className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      {formatContractDate(contract.startDate)} - {formatContractDate(contract.endDate)}
                    </div>
                    {isExpiringSoon && (
                      <div className="text-xs text-orange-600 font-medium flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Vence em {daysToExpire} dias
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          },
          {
            key: 'status',
            label: 'Status',
            render: (contract) => (
              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(contract.status)}`}>
                {getStatusText(contract.status)}
              </span>
            )
          },
          {
            key: 'renewal',
            label: 'Renovação',
            render: (contract) => (
              <div className="flex items-center">
                {contract.autoRenewal ? (
                  <div className="flex items-center text-green-600">
                    <Zap className="w-4 h-4 mr-1" />
                    <span className="text-xs font-medium">Automática</span>
                  </div>
                ) : (
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">Manual</span>
                )}
              </div>
            )
          }
        ]}
        onView={handleViewDetails}
        onEdit={handleEdit}
        customActions={[
          {
            label: 'Anexos',
            icon: Upload,
            onClick: (contract) => openContractById(contract.id)
          },
          {
            label: 'Renovar',
            icon: RefreshCw,
            onClick: (contract) => handleEdit(contract)
          }
        ]}
        emptyState={
          <div>
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Nenhum contrato encontrado</h3>
            <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] mb-4 max-w-sm mx-auto">
              {searchTerm || statusFilter 
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando seu primeiro contrato'
              }
            </p>
            {!searchTerm && !statusFilter && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                Criar Primeiro Contrato
              </button>
            )}
          </div>
        }
      />



      {/* Modal de Detalhes do Contrato */}
      <Modal
        isOpen={showDetailsModal && !!selectedContract}
        onClose={() => setShowDetailsModal(false)}
        title="Detalhes do Contrato"
      >
        {selectedContract && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <div className="crm-panel-muted p-4">
                  <h4 className="font-semibold text-[var(--crm-ink)] mb-3">Informações Básicas</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[var(--crm-muted)]">Número:</span>
                      <span className="ml-2 font-medium text-[var(--crm-ink)]">{selectedContract.number}</span>
                    </div>
                    <div>
                      <span className="text-[var(--crm-muted)]">Título:</span>
                      <span className="ml-2 font-medium text-[var(--crm-ink)]">{selectedContract.title}</span>
                    </div>
                    <div>
                      <span className="text-[var(--crm-muted)]">Status:</span>
                      <span className={`ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(selectedContract.status)}`}>
                        {getStatusText(selectedContract.status)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--crm-muted)]">Empresa:</span>
                      <span className="ml-2 font-medium text-[var(--crm-ink)]">{selectedContract.company?.name}</span>
                    </div>
                    <div>
                      <span className="text-[var(--crm-muted)]">Valor:</span>
                      <span className="ml-2 font-semibold text-emerald-700 dark:text-emerald-300">
                        R$ {selectedContract.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="crm-panel-muted p-4">
                  <h4 className="font-semibold text-[var(--crm-ink)] mb-3">Período e aviso de vencimento</h4>
                  <p className="mb-3 text-sm text-[var(--crm-muted)]">{selectedContract.expirationAlert !== false ? 'Alerta de vencimento: 30 dias antes, às 9h (Brasília).' : 'Alerta de vencimento desativado.'}</p>
                  {selectedContract.sourceDocumentId && <p className="mb-3 text-xs text-[var(--crm-muted)]">Cópia independente de: {selectedContract.sourceOpportunityLabel || 'oportunidade de origem'}. Excluir o anexo original não apaga esta cópia.</p>}
                  <button type="button" className="crm-btn crm-btn-secondary mb-3" onClick={() => { setShowDetailsModal(false); handleEdit(selectedContract); }}>Editar contrato e vencimento</button>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[var(--crm-muted)]">Início:</span>
                      <span className="ml-2 font-medium text-[var(--crm-ink)]">
                        {formatContractDate(selectedContract.startDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--crm-muted)]">Fim:</span>
                      <span className="ml-2 font-medium text-[var(--crm-ink)]">
                        {formatContractDate(selectedContract.endDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--crm-muted)]">Status:</span>
                      <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedContract.status)}`}>
                        {getStatusText(selectedContract.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SLA, Renovação e Anexos */}
              <div className="space-y-4">
                {/* Seção SLA */}
                {(selectedContract.slaResponseTime || selectedContract.slaResolutionTime || selectedContract.slaAvailability || selectedContract.slaDescription) && (
                  <div className="crm-panel-muted p-4 bg-blue-500/5 border border-blue-500/10">
                    <h4 className="font-semibold text-[var(--crm-ink)] mb-3 flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-300" />
                      Acordo de Nível de Serviço (SLA)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                      {selectedContract.slaResponseTime && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-300 mr-2" />
                          <div>
                            <span className="text-[var(--crm-muted)]">Resposta:</span>
                            <span className="ml-1 font-medium text-[var(--crm-ink)]">{selectedContract.slaResponseTime}h</span>
                          </div>
                        </div>
                      )}
                      {selectedContract.slaResolutionTime && (
                        <div className="flex items-center">
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-300 mr-2" />
                          <div>
                            <span className="text-[var(--crm-muted)]">Resolução:</span>
                            <span className="ml-1 font-medium text-[var(--crm-ink)]">{selectedContract.slaResolutionTime}h</span>
                          </div>
                        </div>
                      )}
                      {selectedContract.slaAvailability && (
                        <div className="flex items-center">
                          <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-300 mr-2" />
                          <div>
                            <span className="text-[var(--crm-muted)]">Disponibilidade:</span>
                            <span className="ml-1 font-medium text-[var(--crm-ink)]">{selectedContract.slaAvailability}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedContract.slaDescription && (
                      <div className="text-sm">
                        <span className="text-[var(--crm-muted)]">Descrição:</span>
                        <p className="mt-1 text-[var(--crm-ink)] bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] p-3 rounded-2xl border border-[color:var(--crm-border)]">
                          {selectedContract.slaDescription}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="crm-panel-muted p-4">
                  <h4 className="font-semibold text-[var(--crm-ink)] mb-3">Renovação</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[var(--crm-muted)]">Renovação Automática:</span>
                      <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedContract.autoRenewal
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : "bg-[rgb(var(--crm-surface-rgb)_/_0.1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)]"
                      }`}>
                        {selectedContract.autoRenewal ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    {selectedContract.autoRenewal && (
                      <>
                        <div>
                          <span className="text-[var(--crm-muted)]">Período:</span>
                          <span className="ml-2 font-medium text-[var(--crm-ink)]">{selectedContract.renewalPeriod} meses</span>
                        </div>
                        <div>
                          <span className="text-[var(--crm-muted)]">Aviso Prévio:</span>
                          <span className="ml-2 font-medium text-[var(--crm-ink)]">{selectedContract.renewalNotice} dias</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="crm-panel-muted p-4">
                  <h4 className="font-semibold text-[var(--crm-ink)] mb-3 flex items-center">
                    <FileCheck className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-300" />
                    Anexos ({selectedContract.attachments?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {selectedContract.attachments?.length > 0 ? (
                      selectedContract.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] rounded-2xl border border-[color:var(--crm-border)]">
                          <div className="flex items-center flex-1">
                            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-300 mr-3" />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-[var(--crm-ink)]">{attachment.originalName}</span>
                              <div className="text-xs text-[var(--crm-muted)]">
                                {(attachment.size / 1024 / 1024).toFixed(2)} MB • {new Date(attachment.createdAt).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => downloadFile(attachment.id, attachment.originalName)}
                              className="crm-btn crm-btn-ghost px-3 py-2"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteFile(attachment.id)}
                              className="crm-btn crm-btn-danger px-3 py-2"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-[var(--crm-muted)]">
                        <FileText className="w-8 h-8 text-[var(--crm-muted)] mx-auto mb-2" />
                        <p className="text-sm">Nenhum anexo adicionado</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {selectedContract.description && (
              <div>
                <h4 className="font-semibold text-[var(--crm-ink)] mb-2">Descrição</h4>
                <p className="text-[var(--crm-ink)] bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] p-4 rounded-2xl">
                  {selectedContract.description}
                </p>
              </div>
            )}

            {selectedContract.summary && (
              <div>
                <h4 className="font-semibold text-[var(--crm-ink)] mb-2">Resumo do Contrato</h4>
                <div className="text-[var(--crm-ink)] bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <p className="whitespace-pre-wrap">{selectedContract.summary}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[color:var(--crm-border)]">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="crm-btn crm-btn-secondary"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleEdit(selectedContract);
                }}
                className="crm-btn crm-btn-primary"
              >
                Editar Contrato
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Contrato */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={selectedContract ? 'Editar Contrato' : 'Novo Contrato'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Número do Contrato *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.number}
                      onChange={(e) => setFormData({...formData, number: e.target.value})}
                      className="crm-input"
                      placeholder="Ex: CTR-2026-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Título *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="crm-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Valor *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      className="crm-input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Status do Contrato *
                    </label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="crm-input"
                    >
                      <option value="AWAITING_SIGNATURE">Aguardando Assinatura</option>
                      <option value="ACTIVE">Ativo</option>
                      <option value="RENEWAL_PENDING">A Renovar</option>
                      <option value="CANCELLED">Cancelado</option>
                      <option value="EXPIRED">Expirado</option>
                      <option value="RENEWED">Renovado</option>
                      <option value="DRAFT">Rascunho</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                    Descrição
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="crm-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                    Resumo do Contrato
                  </label>
                  <textarea
                    rows={4}
                    value={formData.summary}
                    onChange={(e) => setFormData({...formData, summary: e.target.value})}
                    className="crm-input"
                    placeholder="Resumo de todos os itens fechados no contrato (produtos, serviços, quantidades, valores, etc.)"
                  />
                  <p className="text-xs text-[var(--crm-muted)] mt-1">
                    Este resumo será visível para a equipe comercial na aba Contratos da empresa
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Data de Início *
                    </label>
                    <input
                      type="date"
                      required={['ACTIVE', 'RENEWAL_PENDING'].includes(formData.status)}
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="crm-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Data de Fim *
                    </label>
                    <input
                      type="date"
                      required={['ACTIVE', 'RENEWAL_PENDING'].includes(formData.status)}
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="crm-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Empresa *
                    </label>
                    <select
                      required
                      value={formData.companyId}
                      disabled={Boolean(selectedContract?.sourceDocumentId)}
                      onChange={(e) => setFormData({...formData, companyId: e.target.value, opportunityId: ''})}
                      className="crm-input"
                    >
                      <option value="">Selecione uma empresa</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                      Oportunidade
                    </label>
                    <select
                      value={formData.opportunityId}
                      disabled={Boolean(selectedContract?.sourceDocumentId)}
                      onChange={(e) => setFormData({...formData, opportunityId: e.target.value})}
                      className="crm-input"
                    >
                      <option value="">Selecione uma oportunidade</option>
                      {opportunities.filter((opportunity) => opportunity.companyId === formData.companyId).map((opportunity) => (
                        <option key={opportunity.id} value={opportunity.id}>
                          {opportunity.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-[color:var(--crm-border)] pt-4">
                  <div className="mb-4 crm-panel-muted p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={formData.expirationAlert} onChange={event => setFormData({ ...formData, expirationAlert: event.target.checked })} />
                      Alertar vencimento com 30 dias de antecedência
                    </label>
                    <p className="text-xs text-[var(--crm-muted)]">Responsável: {companies.find(company => company.id === formData.companyId)?.accountManagerName || selectedContract?.company?.accountManagerName || 'defina o gerente de contas na empresa ou o responsável da oportunidade'}. O responsável deve conectar a própria agenda Google ou Microsoft. Renovações e mudanças no vencimento atualizam o aviso.</p>
                  </div>
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="autoRenewal"
                      checked={formData.autoRenewal}
                      onChange={(e) => setFormData({...formData, autoRenewal: e.target.checked})}
                      className="h-4 w-4 rounded border-[color:var(--crm-border)] text-[rgb(var(--crm-accent-rgb))]"
                    />
                    <label htmlFor="autoRenewal" className="ml-2 block text-sm text-[var(--crm-ink)]">
                      Renovação Automática
                    </label>
                  </div>

                  {formData.autoRenewal && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                          Período de Renovação (meses)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.renewalPeriod}
                          onChange={(e) => setFormData({...formData, renewalPeriod: e.target.value})}
                          className="crm-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                          Aviso Prévio (dias)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.renewalNotice}
                          onChange={(e) => setFormData({...formData, renewalNotice: e.target.value})}
                          className="crm-input"
                        />
                      </div>
                    </div>
                  )}

                  {/* Seção SLA */}
                  <div className="border-t border-[color:var(--crm-border)] pt-6">
                    <h4 className="text-lg font-semibold text-[var(--crm-ink)] mb-4 flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-blue-600" />
                      Acordo de Nível de Serviço (SLA)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                          Tempo de Resposta (horas)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.slaResponseTime}
                          onChange={(e) => setFormData({...formData, slaResponseTime: e.target.value})}
                          placeholder="Ex: 2"
                          className="crm-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                          Tempo de Resolução (horas)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.slaResolutionTime}
                          onChange={(e) => setFormData({...formData, slaResolutionTime: e.target.value})}
                          placeholder="Ex: 24"
                          className="crm-input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                          Disponibilidade (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.slaAvailability}
                          onChange={(e) => setFormData({...formData, slaAvailability: e.target.value})}
                          placeholder="Ex: 99.9"
                          className="crm-input"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[var(--crm-muted)] mb-1">
                        Descrição do SLA
                      </label>
                      <textarea
                        rows={3}
                        value={formData.slaDescription}
                        onChange={(e) => setFormData({...formData, slaDescription: e.target.value})}
                        placeholder="Descreva os termos e condições do SLA..."
                        className="crm-input"
                      />
                    </div>
                  </div>

                  {/* Seção Upload de Arquivos */}
                  <div className="border-t border-[color:var(--crm-border)] pt-6">
                    <h4 className="text-lg font-semibold text-[var(--crm-ink)] mb-4 flex items-center">
                      <Upload className="w-5 h-5 mr-2 text-green-600" />
                      Anexar Documentos
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-muted)] mb-2">
                          Selecionar Arquivos
                        </label>
                        <input
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                          className="crm-input"
                        />
                        <p className="text-xs text-[var(--crm-muted)] mt-1">
                          Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT (máx. 10MB)
                        </p>
                      </div>
                      
                      {selectedFiles.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-[var(--crm-ink)] mb-2">Arquivos Selecionados:</h5>
                          <div className="space-y-2">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-black/5 dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] rounded-2xl border border-[color:var(--crm-border)]">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-4 h-4 text-[var(--crm-muted)]" />
                                  <span className="text-sm text-[var(--crm-ink)]">{file.name}</span>
                                  <span className="text-xs text-[var(--crm-muted)]">
                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="crm-btn crm-btn-danger px-3 py-2"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[color:var(--crm-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="crm-btn crm-btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="crm-btn crm-btn-primary"
                  >
                    {selectedContract ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
      </Modal>
    </div>
  );
};

export default Contratos;
