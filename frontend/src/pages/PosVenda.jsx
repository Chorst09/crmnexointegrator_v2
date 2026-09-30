import { useState, useEffect } from 'react';
import { 
  Users, 
  HeadphonesIcon, 
  Star, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Plus,
  Search,
  Zap,
  Award,
  UserCheck,
  Heart,
  Shield,
  Eye,
  Edit,
  CheckCircle2,
  Calendar,
  Target,
  Activity
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const PosVenda = () => {
  const [activeTab, setActiveTab] = useState('onboarding');
  const [onboardings, setOnboardings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [npsData, setNpsData] = useState([]);
  const [churnAlerts, setChurnAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [companies, setCompanies] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [users, setUsers] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [onboardingRes, ticketsRes, npsRes, churnRes, companiesRes, contractsRes, usersRes] = await Promise.all([
        fetch(buildApiUrl('/post-sales/onboarding'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/post-sales/support'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/post-sales/nps'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/post-sales/churn-alerts'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/companies'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/contracts'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/auth/users'), { headers: getAuthHeaders() })
      ]);

      if (onboardingRes.ok) {
        const data = await onboardingRes.json();
        setOnboardings(data.onboardings || []);
      }

      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data.tickets || []);
      }

      if (npsRes.ok) {
        const data = await npsRes.json();
        setNpsData(data.surveys || []);
      }

      if (churnRes.ok) {
        const data = await churnRes.json();
        setChurnAlerts(data.alerts || []);
      }

      if (companiesRes.ok) {
        const data = await companiesRes.json();
        setCompanies(data || []);
      }

      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setContracts(data || []);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status, type = 'default') => {
    const colors = {
      onboarding: {
        PENDING: 'bg-yellow-100 text-yellow-800',
        IN_PROGRESS: 'bg-blue-100 text-blue-800',
        COMPLETED: 'bg-green-100 text-green-800',
        CANCELLED: 'bg-red-100 text-red-800'
      },
      ticket: {
        OPEN: 'bg-red-100 text-red-800',
        IN_PROGRESS: 'bg-blue-100 text-blue-800',
        WAITING_CUSTOMER: 'bg-yellow-100 text-yellow-800',
        RESOLVED: 'bg-green-100 text-green-800',
        CLOSED: 'bg-gray-100 text-gray-800'
      },
      churn: {
        LOW: 'bg-green-100 text-green-800',
        MEDIUM: 'bg-yellow-100 text-yellow-800',
        HIGH: 'bg-orange-100 text-orange-800',
        CRITICAL: 'bg-red-100 text-red-800'
      }
    };
    return colors[type]?.[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: 'bg-green-100 text-green-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-orange-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getNPSCategory = (score) => {
    if (score >= 9) return { label: 'Promotor', color: 'text-green-600' };
    if (score >= 7) return { label: 'Neutro', color: 'text-yellow-600' };
    return { label: 'Detrator', color: 'text-red-600' };
  };

  const openModal = (type) => {
    setModalType(type);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
  };

  const handleSubmitTicket = async (formData) => {
    try {
      const response = await fetch(buildApiUrl('/post-sales/support'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchData();
        closeModal();
        alert('Ticket criado com sucesso!');
      } else {
        alert('Erro ao criar ticket');
      }
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      alert('Erro ao criar ticket');
    }
  };

  const handleSubmitOnboarding = async (formData) => {
    try {
      const response = await fetch(buildApiUrl('/post-sales/onboarding'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchData();
        closeModal();
        alert('Onboarding criado com sucesso!');
      } else {
        alert('Erro ao criar onboarding');
      }
    } catch (error) {
      console.error('Erro ao criar onboarding:', error);
      alert('Erro ao criar onboarding');
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
        title="Sucesso do Cliente"
        subtitle="Maximize a satisfação e retenção através de onboarding, suporte e análise de churn"
        icon={Heart}
        gradient="green"
        breadcrumbs={['CRM', 'Pós-Venda']}
        actions={[
          {
            label: 'Detectar Churn',
            icon: Zap,
            onClick: () => {
              fetch(buildApiUrl('/post-sales/churn-alerts/detect'), {
                method: 'POST',
                headers: getAuthHeaders()
              }).then(() => fetchData());
            },
            variant: 'secondary'
          },
          {
            label: 'Novo Onboarding',
            icon: Plus,
            onClick: () => openModal('onboarding'),
            variant: 'secondary'
          },
          {
            label: 'Novo Ticket',
            icon: Plus,
            onClick: () => openModal('ticket'),
            variant: 'primary'
          }
        ]}
      />

      {/* Métricas Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Onboardings Ativos"
          value={onboardings.filter(o => o.status === 'IN_PROGRESS').length}
          subtitle={`${onboardings.length} total`}
          icon={UserCheck}
          color="blue"
          trend={{ direction: 'up', value: '+8% este mês' }}
        />
        
        <AnimatedStats
          title="Tickets Abertos"
          value={tickets.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length}
          subtitle="SLA médio: 24h"
          icon={HeadphonesIcon}
          color="green"
          trend={{ direction: 'down', value: '-12% este mês' }}
        />
        
        <AnimatedStats
          title="NPS Médio"
          value={npsData.length > 0 
            ? (npsData.reduce((sum, survey) => sum + (survey.score || 0), 0) / npsData.length).toFixed(1)
            : '0.0'
          }
          subtitle={`${npsData.filter(n => n.status === 'RESPONDED').length} respostas`}
          icon={Award}
          color="yellow"
          trend={{ direction: 'up', value: '+0.5 este mês' }}
        />
        
        <AnimatedStats
          title="Alertas de Churn"
          value={churnAlerts.filter(a => a.status === 'ACTIVE').length}
          subtitle={`${churnAlerts.filter(a => a.riskLevel === 'CRITICAL').length} críticos`}
          icon={Shield}
          color="red"
          trend={{ direction: 'down', value: '-15% este mês' }}
        />
      </div>

      {/* Filtros */}
      <GradientCard gradient="gray" className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por cliente, ticket ou processo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            >
              <option value="">Todos os Status</option>
              <option value="PENDING">Pendente</option>
              <option value="IN_PROGRESS">Em Andamento</option>
              <option value="COMPLETED">Concluído</option>
              <option value="OPEN">Aberto</option>
              <option value="RESOLVED">Resolvido</option>
            </select>
          </div>
        </div>
      </GradientCard>

      {/* Tabs */}
      <GradientCard gradient="gray" className="shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'onboarding', label: 'Onboarding', icon: Users, count: onboardings.length, color: 'blue' },
              { id: 'support', label: 'Suporte', icon: HeadphonesIcon, count: tickets.length, color: 'green' },
              { id: 'nps', label: 'NPS', icon: Star, count: npsData.length, color: 'yellow' },
              { id: 'churn', label: 'Churn', icon: AlertTriangle, count: churnAlerts.length, color: 'red' }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? (tab.color === 'blue' ? 'border-blue-500 text-blue-600 bg-blue-50' :
                         tab.color === 'green' ? 'border-green-500 text-green-600 bg-green-50' :
                         tab.color === 'yellow' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' :
                         'border-red-500 text-red-600 bg-red-50')
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-3 rounded-t-xl transition-all duration-200 hover:bg-gray-50`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    activeTab === tab.id 
                      ? (tab.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                         tab.color === 'green' ? 'bg-green-100 text-green-700' :
                         tab.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                         'bg-red-100 text-red-700')
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab Onboarding */}
          {activeTab === 'onboarding' && (
            <ModernTable
              title="Onboarding de Clientes"
              data={onboardings.filter(item => 
                !searchTerm || 
                item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.contract?.number?.toLowerCase().includes(searchTerm.toLowerCase())
              ).filter(item => 
                !statusFilter || item.status === statusFilter
              )}
              columns={[
                {
                  key: 'company',
                  label: 'Cliente',
                  render: (item) => (
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.company?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.contract?.number}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status, 'onboarding')}`}>
                      {item.status}
                    </span>
                  )
                },
                {
                  key: 'progress',
                  label: 'Progresso',
                  render: (item) => {
                    const completedSteps = item.steps?.filter(s => s.status === 'COMPLETED').length || 0;
                    const totalSteps = item.steps?.length || 0;
                    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
                    
                    return (
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 font-medium">
                          {completedSteps}/{totalSteps}
                        </span>
                      </div>
                    );
                  }
                },
                {
                  key: 'assignedTo',
                  label: 'Responsável',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-blue-600">
                          {item.assignedTo?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900">
                        {item.assignedTo?.name || 'Não atribuído'}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'expectedEndDate',
                  label: 'Data Prevista',
                  render: (item) => (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {item.expectedEndDate 
                          ? new Date(item.expectedEndDate).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </span>
                    </div>
                  )
                }
              ]}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onView={(item) => alert(`Ver detalhes do onboarding: ${item.company?.name}`)}
              onEdit={(item) => alert(`Editar onboarding: ${item.company?.name}`)}
              customActions={[
                {
                  label: 'Avançar Etapa',
                  icon: CheckCircle2,
                  onClick: (item) => alert(`Avançar etapa: ${item.company?.name}`)
                },
                {
                  label: 'Agendar Reunião',
                  icon: Calendar,
                  onClick: (item) => alert(`Agendar reunião: ${item.company?.name}`)
                }
              ]}
              emptyState={
                <div>
                  <UserCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum onboarding encontrado</h3>
                  <p className="text-gray-500">Comece criando um novo processo de onboarding</p>
                </div>
              }
            />
          )}

          {/* Tab Suporte */}
          {activeTab === 'support' && (
            <ModernTable
              title="Tickets de Suporte"
              data={tickets.filter(item => 
                !searchTerm || 
                item.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
              ).filter(item => 
                !statusFilter || item.status === statusFilter
              )}
              columns={[
                {
                  key: 'ticket',
                  label: 'Ticket',
                  render: (item) => (
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        #{item.number}
                      </div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {item.title}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'company',
                  label: 'Cliente',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-green-600">
                          {item.company?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900">
                        {item.company?.name}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'priority',
                  label: 'Prioridade',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status, 'ticket')}`}>
                      {item.status}
                    </span>
                  )
                },
                {
                  key: 'sla',
                  label: 'SLA',
                  render: (item) => {
                    const slaExpired = item.slaDeadline && new Date(item.slaDeadline) < new Date();
                    
                    return (
                      <div className={`flex items-center ${slaExpired ? 'text-red-600' : 'text-gray-900'}`}>
                        <Clock className={`w-4 h-4 mr-2 ${slaExpired ? 'text-red-500' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">
                          {item.slaDeadline 
                            ? new Date(item.slaDeadline).toLocaleDateString('pt-BR')
                            : '-'
                          }
                        </span>
                        {slaExpired && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            Vencido
                          </span>
                        )}
                      </div>
                    );
                  }
                },
                {
                  key: 'assignedTo',
                  label: 'Responsável',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-purple-600">
                          {item.assignedTo?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900">
                        {item.assignedTo?.name || 'Não atribuído'}
                      </span>
                    </div>
                  )
                }
              ]}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onView={(item) => alert(`Ver detalhes do ticket: ${item.number}`)}
              onEdit={(item) => alert(`Editar ticket: ${item.number}`)}
              customActions={[
                {
                  label: 'Responder',
                  icon: Activity,
                  onClick: (item) => alert(`Responder ticket: ${item.number}`)
                },
                {
                  label: 'Escalar',
                  icon: TrendingUp,
                  onClick: (item) => alert(`Escalar ticket: ${item.number}`)
                }
              ]}
              emptyState={
                <div>
                  <HeadphonesIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum ticket encontrado</h3>
                  <p className="text-gray-500">Todos os tickets foram resolvidos ou não há tickets no momento</p>
                </div>
              }
            />
          )}

          {/* Tab NPS */}
          {activeTab === 'nps' && (
            <ModernTable
              title="Pesquisas de Satisfação (NPS)"
              data={npsData.filter(item => 
                !searchTerm || 
                item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
              ).filter(item => 
                !statusFilter || item.status === statusFilter
              )}
              columns={[
                {
                  key: 'company',
                  label: 'Cliente',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-yellow-600">
                          {item.company?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {item.company?.name}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'score',
                  label: 'Score',
                  render: (item) => (
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 mr-2" />
                      <span className="text-lg font-bold text-gray-900">
                        {item.score !== null ? item.score : '-'}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">/10</span>
                    </div>
                  )
                },
                {
                  key: 'category',
                  label: 'Categoria',
                  render: (item) => {
                    const category = item.score !== null ? getNPSCategory(item.score) : null;
                    
                    return category ? (
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        category.label === 'Promotor' ? 'bg-green-100 text-green-800' :
                        category.label === 'Neutro' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {category.label}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    );
                  }
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'RESPONDED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status === 'RESPONDED' ? 'Respondido' : 'Pendente'}
                    </span>
                  )
                },
                {
                  key: 'sentAt',
                  label: 'Data Envio',
                  render: (item) => (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {new Date(item.sentAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )
                },
                {
                  key: 'feedback',
                  label: 'Feedback',
                  render: (item) => (
                    item.feedback ? (
                      <div className="max-w-xs">
                        <p className="text-sm text-gray-900 truncate" title={item.feedback}>
                          {item.feedback}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Sem feedback</span>
                    )
                  )
                }
              ]}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onView={(item) => alert(`Ver detalhes da pesquisa NPS: ${item.company?.name}`)}
              onEdit={(item) => alert(`Editar pesquisa NPS: ${item.company?.name}`)}
              customActions={[
                {
                  label: 'Reenviar Pesquisa',
                  icon: Target,
                  onClick: (item) => alert(`Reenviar pesquisa: ${item.company?.name}`)
                },
                {
                  label: 'Ver Histórico',
                  icon: Activity,
                  onClick: (item) => alert(`Ver histórico NPS: ${item.company?.name}`)
                }
              ]}
              emptyState={
                <div>
                  <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma pesquisa NPS encontrada</h3>
                  <p className="text-gray-500">Comece enviando pesquisas de satisfação para seus clientes</p>
                </div>
              }
            />
          )}

          {/* Tab Churn */}
          {activeTab === 'churn' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Alertas de Churn</h3>
                  <p className="text-sm text-gray-600 mt-1">Identifique clientes com risco de cancelamento</p>
                </div>
                <button
                  onClick={() => {
                    fetch(buildApiUrl('/post-sales/churn-alerts/detect'), {
                      method: 'POST',
                      headers: getAuthHeaders()
                    }).then(() => fetchData());
                  }}
                  className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Zap className="w-5 h-5" />
                  Detectar Churn
                </button>
              </div>

              <ModernTable
                title=""
                data={churnAlerts.filter(item => 
                  !searchTerm || 
                  item.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
                ).filter(item => 
                  !statusFilter || item.status === statusFilter
                )}
                columns={[
                  {
                    key: 'company',
                    label: 'Cliente',
                    render: (item) => (
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-red-600">
                            {item.company?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {item.company?.name}
                        </span>
                      </div>
                    )
                  },
                  {
                    key: 'riskLevel',
                    label: 'Nível de Risco',
                    render: (item) => (
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.riskLevel, 'churn')}`}>
                        {item.riskLevel === 'LOW' ? 'Baixo' :
                         item.riskLevel === 'MEDIUM' ? 'Médio' :
                         item.riskLevel === 'HIGH' ? 'Alto' : 'Crítico'}
                      </span>
                    )
                  },
                  {
                    key: 'score',
                    label: 'Score de Risco',
                    render: (item) => (
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-3 mr-3">
                          <div 
                            className={`h-3 rounded-full transition-all duration-300 ${
                              item.score >= 80 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                              item.score >= 65 ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 
                              'bg-gradient-to-r from-yellow-500 to-yellow-600'
                            }`}
                            style={{ width: `${item.score}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{item.score}%</span>
                      </div>
                    )
                  },
                  {
                    key: 'reasons',
                    label: 'Principais Motivos',
                    render: (item) => (
                      <div className="max-w-xs">
                        {item.reasons?.slice(0, 2).map((reason, index) => (
                          <div key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full mb-1 inline-block mr-1">
                            {reason}
                          </div>
                        ))}
                        {item.reasons?.length > 2 && (
                          <div className="text-xs text-gray-500 mt-1">
                            +{item.reasons.length - 2} outros fatores
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (item) => (
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        item.status === 'ACTIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {item.status === 'ACTIVE' ? 'Ativo' : 'Resolvido'}
                      </span>
                    )
                  },
                  {
                    key: 'assignedTo',
                    label: 'Responsável',
                    render: (item) => (
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-indigo-600">
                            {item.assignedTo?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-900">
                          {item.assignedTo?.name || 'Não atribuído'}
                        </span>
                      </div>
                    )
                  }
                ]}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onView={(item) => alert(`Ver detalhes do alerta de churn: ${item.company?.name}`)}
                onEdit={(item) => alert(`Editar alerta de churn: ${item.company?.name}`)}
                customActions={[
                  {
                    label: 'Criar Plano de Retenção',
                    icon: Shield,
                    onClick: (item) => alert(`Criar plano de retenção: ${item.company?.name}`)
                  },
                  {
                    label: 'Agendar Contato',
                    icon: Calendar,
                    onClick: (item) => alert(`Agendar contato: ${item.company?.name}`)
                  },
                  {
                    label: 'Marcar como Resolvido',
                    icon: CheckCircle2,
                    onClick: (item) => alert(`Marcar como resolvido: ${item.company?.name}`)
                  }
                ]}
                emptyState={
                  <div>
                    <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum alerta de churn encontrado</h3>
                    <p className="text-gray-500">Ótimo! Seus clientes estão satisfeitos ou execute a detecção de churn</p>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </GradientCard>
      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {modalType === 'ticket' && <TicketModal onClose={closeModal} onSubmit={handleSubmitTicket} companies={companies} users={users} />}
            {modalType === 'onboarding' && <OnboardingModal onClose={closeModal} onSubmit={handleSubmitOnboarding} companies={companies} contracts={contracts} users={users} />}
          </div>
        </div>
      )}
    </div>
  );
};

// Modal para criar novo ticket
const TicketModal = ({ onClose, onSubmit, companies, users }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    category: 'Técnico',
    companyId: '',
    assignedToId: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.companyId) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Novo Ticket de Suporte</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Descreva brevemente o problema"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrição *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Descreva detalhadamente o problema ou solicitação"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridade
            </label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Técnico">Técnico</option>
              <option value="Comercial">Comercial</option>
              <option value="Financeiro">Financeiro</option>
              <option value="Treinamento">Treinamento</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cliente *
          </label>
          <select
            name="companyId"
            value={formData.companyId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Selecione o cliente</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Responsável
          </label>
          <select
            name="assignedToId"
            value={formData.assignedToId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Atribuir automaticamente</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Criar Ticket
          </button>
        </div>
      </form>
    </div>
  );
};

// Modal para criar novo onboarding
const OnboardingModal = ({ onClose, onSubmit, companies, contracts, users }) => {
  const [formData, setFormData] = useState({
    companyId: '',
    contractId: '',
    assignedToId: '',
    expectedEndDate: '',
    description: '',
    steps: [
      { title: 'Configuração inicial', description: 'Configurar parâmetros básicos do sistema', order: 1 },
      { title: 'Treinamento da equipe', description: 'Treinar usuários no uso do sistema', order: 2 },
      { title: 'Migração de dados', description: 'Importar dados do sistema anterior', order: 3 }
    ]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.companyId || !formData.assignedToId || !formData.expectedEndDate) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...formData.steps];
    newSteps[index][field] = value;
    setFormData({
      ...formData,
      steps: newSteps
    });
  };

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        { title: '', description: '', order: formData.steps.length + 1 }
      ]
    });
  };

  const removeStep = (index) => {
    const newSteps = formData.steps.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      steps: newSteps.map((step, i) => ({ ...step, order: i + 1 }))
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Novo Onboarding</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <select
              name="companyId"
              value={formData.companyId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecione o cliente</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrato
            </label>
            <select
              name="contractId"
              value={formData.contractId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione o contrato (opcional)</option>
              {contracts.map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.number} - {contract.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsável *
            </label>
            <select
              name="assignedToId"
              value={formData.assignedToId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecione o responsável</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Prevista de Conclusão *
            </label>
            <input
              type="date"
              name="expectedEndDate"
              value={formData.expectedEndDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Descreva o processo de onboarding"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Etapas do Onboarding
            </label>
            <button
              type="button"
              onClick={addStep}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Adicionar Etapa
            </button>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {formData.steps.map((step, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-600">Etapa {step.order}</span>
                  {formData.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Título da etapa"
                  />
                  <textarea
                    value={step.description}
                    onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descrição da etapa"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Criar Onboarding
          </button>
        </div>
      </form>
    </div>
  );
};

export default PosVenda;