import { useState, useEffect } from 'react';
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
import { buildApiUrl, getAuthHeaders } from '../config/api';

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
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalValue: 0,
    expiringSoon: 0
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    value: '',
    startDate: '',
    endDate: '',
    companyId: '',
    opportunityId: '',
    autoRenewal: false,
    renewalPeriod: '',
    renewalNotice: '',
    slaResponseTime: '',
    slaResolutionTime: '',
    slaAvailability: '',
    slaDescription: ''
  });
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  const fetchContracts = async () => {
    try {
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
        setContracts(data.contracts || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          total: statsData.totalContracts || 0,
          active: statsData.activeContracts || 0,
          totalValue: statsData.totalValue || 0,
          expiringSoon: contracts.filter(c => {
            const daysToExpire = Math.ceil((new Date(c.endDate) - new Date()) / (1000 * 60 * 60 * 24));
            return daysToExpire <= 30 && daysToExpire > 0;
          }).length
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
        setCompanies(data.companies || data);
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
        setOpportunities(data.opportunities || data);
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
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
        alert(error.error || 'Erro ao salvar contrato');
      }
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      alert('Erro de conexão');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      value: '',
      startDate: '',
      endDate: '',
      companyId: '',
      opportunityId: '',
      autoRenewal: false,
      renewalPeriod: '',
      renewalNotice: '',
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
      title: contract.title,
      description: contract.description || '',
      value: contract.value.toString(),
      startDate: contract.startDate.split('T')[0],
      endDate: contract.endDate.split('T')[0],
      companyId: contract.companyId,
      opportunityId: contract.opportunityId || '',
      autoRenewal: contract.autoRenewal,
      renewalPeriod: contract.renewalPeriod?.toString() || '',
      renewalNotice: contract.renewalNotice?.toString() || '',
      slaResponseTime: contract.slaResponseTime?.toString() || '',
      slaResolutionTime: contract.slaResolutionTime?.toString() || '',
      slaAvailability: contract.slaAvailability?.toString() || '',
      slaDescription: contract.slaDescription || ''
    });
    setShowModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-yellow-100 text-yellow-800',
      EXPIRED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const texts = {
      DRAFT: 'Rascunho',
      ACTIVE: 'Ativo',
      SUSPENDED: 'Suspenso',
      EXPIRED: 'Expirado',
      CANCELLED: 'Cancelado'
    };
    return texts[status] || status;
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (contract) => {
    setSelectedContract(contract);
    setShowDetailsModal(true);
  };

  const processRenewals = async () => {
    try {
      const response = await fetch(buildApiUrl('/contracts/process-renewals'), {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchContracts();
      }
    } catch (error) {
      console.error('Erro ao processar renovações:', error);
    }
  };

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
        breadcrumbs={['CRM', 'Contratos']}
        actions={[
          {
            label: 'Processar Renovações',
            icon: RefreshCw,
            onClick: processRenewals,
            variant: 'secondary'
          },
          {
            label: 'Novo Contrato',
            icon: Plus,
            onClick: () => setShowModal(true),
            variant: 'primary'
          }
        ]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Total de Contratos"
          value={stats.total}
          subtitle="Todos os contratos"
          icon={FileText}
          color="blue"
          trend={{ direction: 'up', value: '+12% este mês' }}
        />
        
        <AnimatedStats
          title="Contratos Ativos"
          value={stats.active}
          subtitle="Em vigência"
          icon={CheckCircle}
          color="green"
          trend={{ direction: 'up', value: '+5% este mês' }}
        />
        
        <AnimatedStats
          title="Valor Total"
          value={stats.totalValue}
          subtitle="Receita contratada"
          icon={DollarSign}
          color="purple"
          prefix="R$ "
          trend={{ direction: 'up', value: '+18% este mês' }}
        />
        
        <AnimatedStats
          title="Vencendo em 30 dias"
          value={stats.expiringSoon}
          subtitle="Requer atenção"
          icon={AlertCircle}
          color="orange"
          trend={{ direction: 'down', value: '-3% este mês' }}
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
              { value: 'DRAFT', label: 'Rascunho' },
              { value: 'ACTIVE', label: 'Ativo' },
              { value: 'SUSPENDED', label: 'Suspenso' },
              { value: 'EXPIRED', label: 'Expirado' },
              { value: 'CANCELLED', label: 'Cancelado' }
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
                  <div className="text-sm font-semibold text-gray-900">
                    {contract.title}
                  </div>
                  <div className="text-xs text-gray-500">
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
                <Building className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {contract.company?.name}
                  </div>
                  <div className="text-xs text-gray-500">
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
              const isExpiringSoon = daysToExpire <= 30 && daysToExpire > 0;
              
              return (
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <div>
                    <div className="text-sm text-gray-900">
                      {new Date(contract.startDate).toLocaleDateString('pt-BR')} - {new Date(contract.endDate).toLocaleDateString('pt-BR')}
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
                  <span className="text-xs text-gray-500">Manual</span>
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
            onClick: (contract) => console.log('Anexos', contract)
          },
          {
            label: 'Renovar',
            icon: RefreshCw,
            onClick: (contract) => console.log('Renovar', contract)
          }
        ]}
        emptyState={
          <div>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum contrato encontrado</h3>
            <p className="text-gray-500 mb-4 max-w-sm mx-auto">
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
      {showDetailsModal && selectedContract && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-xl bg-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Detalhes do Contrato</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Informações Básicas</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">Número:</span>
                      <span className="ml-2 font-medium">{selectedContract.number}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Título:</span>
                      <span className="ml-2 font-medium">{selectedContract.title}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Empresa:</span>
                      <span className="ml-2 font-medium">{selectedContract.company?.name}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Valor:</span>
                      <span className="ml-2 font-medium text-green-600">
                        R$ {selectedContract.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Período</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">Início:</span>
                      <span className="ml-2 font-medium">
                        {new Date(selectedContract.startDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Fim:</span>
                      <span className="ml-2 font-medium">
                        {new Date(selectedContract.endDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Status:</span>
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
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-blue-600" />
                      Acordo de Nível de Serviço (SLA)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      {selectedContract.slaResponseTime && (
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-blue-600 mr-2" />
                          <div>
                            <span className="text-sm text-gray-600">Resposta:</span>
                            <span className="ml-1 font-medium">{selectedContract.slaResponseTime}h</span>
                          </div>
                        </div>
                      )}
                      {selectedContract.slaResolutionTime && (
                        <div className="flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                          <div>
                            <span className="text-sm text-gray-600">Resolução:</span>
                            <span className="ml-1 font-medium">{selectedContract.slaResolutionTime}h</span>
                          </div>
                        </div>
                      )}
                      {selectedContract.slaAvailability && (
                        <div className="flex items-center">
                          <Zap className="w-4 h-4 text-yellow-600 mr-2" />
                          <div>
                            <span className="text-sm text-gray-600">Disponibilidade:</span>
                            <span className="ml-1 font-medium">{selectedContract.slaAvailability}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedContract.slaDescription && (
                      <div>
                        <span className="text-sm text-gray-600">Descrição:</span>
                        <p className="mt-1 text-sm text-gray-700 bg-white p-2 rounded border">
                          {selectedContract.slaDescription}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Renovação</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">Renovação Automática:</span>
                      <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedContract.autoRenewal ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedContract.autoRenewal ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    {selectedContract.autoRenewal && (
                      <>
                        <div>
                          <span className="text-sm text-gray-600">Período:</span>
                          <span className="ml-2 font-medium">{selectedContract.renewalPeriod} meses</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Aviso Prévio:</span>
                          <span className="ml-2 font-medium">{selectedContract.renewalNotice} dias</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <FileCheck className="w-4 h-4 mr-2 text-green-600" />
                    Anexos ({selectedContract.attachments?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {selectedContract.attachments?.length > 0 ? (
                      selectedContract.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                          <div className="flex items-center flex-1">
                            <FileText className="w-4 h-4 text-blue-600 mr-3" />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-900">{attachment.originalName}</span>
                              <div className="text-xs text-gray-500">
                                {(attachment.size / 1024 / 1024).toFixed(2)} MB • 
                                {new Date(attachment.createdAt).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => downloadFile(attachment.id, attachment.originalName)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteFile(attachment.id)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Nenhum anexo adicionado</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {selectedContract.description && (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-2">Descrição</h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedContract.description}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleEdit(selectedContract);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Editar Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Contrato */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedContract ? 'Editar Contrato' : 'Novo Contrato'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Título *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Início *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Fim *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Empresa *
                    </label>
                    <select
                      required
                      value={formData.companyId}
                      onChange={(e) => setFormData({...formData, companyId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Oportunidade
                    </label>
                    <select
                      value={formData.opportunityId}
                      onChange={(e) => setFormData({...formData, opportunityId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione uma oportunidade</option>
                      {opportunities.map((opportunity) => (
                        <option key={opportunity.id} value={opportunity.id}>
                          {opportunity.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="autoRenewal"
                      checked={formData.autoRenewal}
                      onChange={(e) => setFormData({...formData, autoRenewal: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoRenewal" className="ml-2 block text-sm text-gray-900">
                      Renovação Automática
                    </label>
                  </div>

                  {formData.autoRenewal && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Período de Renovação (meses)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.renewalPeriod}
                          onChange={(e) => setFormData({...formData, renewalPeriod: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Aviso Prévio (dias)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.renewalNotice}
                          onChange={(e) => setFormData({...formData, renewalNotice: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Seção SLA */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-blue-600" />
                      Acordo de Nível de Serviço (SLA)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tempo de Resposta (horas)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.slaResponseTime}
                          onChange={(e) => setFormData({...formData, slaResponseTime: e.target.value})}
                          placeholder="Ex: 2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tempo de Resolução (horas)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.slaResolutionTime}
                          onChange={(e) => setFormData({...formData, slaResolutionTime: e.target.value})}
                          placeholder="Ex: 24"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrição do SLA
                      </label>
                      <textarea
                        rows={3}
                        value={formData.slaDescription}
                        onChange={(e) => setFormData({...formData, slaDescription: e.target.value})}
                        placeholder="Descreva os termos e condições do SLA..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Seção Upload de Arquivos */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Upload className="w-5 h-5 mr-2 text-green-600" />
                      Anexar Documentos
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Selecionar Arquivos
                        </label>
                        <input
                          type="file"
                          multiple
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT (máx. 10MB)
                        </p>
                      </div>
                      
                      {selectedFiles.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Arquivos Selecionados:</h5>
                          <div className="space-y-2">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm text-gray-700">{file.name}</span>
                                  <span className="text-xs text-gray-500">
                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {selectedContract ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contratos;