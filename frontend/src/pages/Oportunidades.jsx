import { useEffect, useState } from "react";
import { 
  Plus, 
  Target, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Building,
  User,
  Percent,
  ArrowRight,
  Check,
  X,
  Edit,
  Search,
  BarChart3,
  Filter
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import GradientCard from '../components/GradientCard';
import Modal from '../components/Modal';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const stages = ["LEAD", "QUALIFICATION", "DIAGNOSIS", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

const stageLabels = {
  LEAD: "Lead",
  QUALIFICATION: "Qualificação",
  DIAGNOSIS: "Diagnóstico",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganhou",
  LOST: "Perdeu"
};

const stageColors = {
  LEAD: "#94a3b8",
  QUALIFICATION: "#60a5fa",
  DIAGNOSIS: "#34d399",
  PROPOSAL: "#fbbf24",
  NEGOTIATION: "#f87171",
  WON: "#10b981",
  LOST: "#6b7280"
};

export default function Oportunidades() {
  const [opportunities, setOpportunities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    totalValue: 0,
    won: 0,
    wonValue: 0,
    conversionRate: 0,
    avgValue: 0
  });
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    value: '',
    probability: 50,
    stage: 'LEAD',
    source: 'MANUAL',
    expectedCloseDate: '',
    companyId: '',
    ownerId: ''
  });

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/opportunities'), {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [companiesRes, usersRes] = await Promise.all([
        fetch(buildApiUrl('/companies'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/users'), { headers: getAuthHeaders() })
      ]);
      
      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        setCompanies(companiesData);
      }
      
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.filter(user => user.role === 'SELLER' || user.role === 'ADMIN'));
      }
    } catch (error) {
      console.error('Erro ao carregar dependências:', error);
    }
  };

  const calculateStats = (data) => {
    const total = data.length;
    const totalValue = data.reduce((sum, opp) => sum + (opp.value || 0), 0);
    const won = data.filter(opp => opp.stage === 'WON').length;
    const wonValue = data.filter(opp => opp.stage === 'WON').reduce((sum, opp) => sum + (opp.value || 0), 0);
    const conversionRate = total > 0 ? (won / total) * 100 : 0;
    const avgValue = total > 0 ? totalValue / total : 0;

    setStats({
      total,
      totalValue,
      won,
      wonValue,
      conversionRate,
      avgValue
    });
  };

  useEffect(() => {
    fetchOpportunities();
    fetchDependencies();
  }, []);

  const moveOpportunity = async (id, stage) => {
    try {
      const response = await fetch(buildApiUrl(`/opportunities/${id}`), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, stage })
      });
      
      if (response.ok) {
        fetchOpportunities();
      }
    } catch (error) {
      console.error('Erro ao mover oportunidade:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = selectedOpportunity 
        ? buildApiUrl(`/opportunities/${selectedOpportunity.id}`)
        : buildApiUrl('/opportunities');
      
      const method = selectedOpportunity ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          id: selectedOpportunity?.id,
          value: parseFloat(formData.value) || 0,
          probability: parseInt(formData.probability) || 50
        })
      });

      if (response.ok) {
        fetchOpportunities();
        setShowModal(false);
        resetForm();
        alert(selectedOpportunity ? 'Oportunidade atualizada!' : 'Oportunidade criada!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar oportunidade');
      }
    } catch (error) {
      console.error('Erro ao salvar oportunidade:', error);
      alert('Erro de conexão');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      value: '',
      probability: 50,
      stage: 'LEAD',
      source: 'MANUAL',
      expectedCloseDate: '',
      companyId: '',
      ownerId: ''
    });
    setSelectedOpportunity(null);
  };

  const handleEdit = (opportunity) => {
    setSelectedOpportunity(opportunity);
    setFormData({
      title: opportunity.title,
      description: opportunity.description || '',
      value: opportunity.value?.toString() || '',
      probability: opportunity.probability || 50,
      stage: opportunity.stage,
      source: opportunity.source || 'MANUAL',
      expectedCloseDate: opportunity.expectedCloseDate ? opportunity.expectedCloseDate.split('T')[0] : '',
      companyId: opportunity.companyId,
      ownerId: opportunity.ownerId
    });
    setShowModal(true);
  };

  const handleViewDetails = (opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowDetailsModal(true);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const getNextStage = (currentStage) => {
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 3) { // Não avançar para WON ou LOST automaticamente
      return stages[currentIndex + 1];
    }
    return null;
  };

  // Calcular totais por etapa
  const stageTotals = stages.reduce((acc, stage) => {
    const stageItems = opportunities.filter(i => i.stage === stage);
    acc[stage] = {
      count: stageItems.length,
      value: stageItems.reduce((sum, item) => sum + (item.value || 0), 0)
    };
    return acc;
  }, {});

  // Filtrar oportunidades
  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         opp.owner?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = !stageFilter || opp.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

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
        title="Pipeline de Vendas"
        subtitle="Gerencie oportunidades e acompanhe o funil de vendas em tempo real"
        icon={Target}
        gradient="blue"
        breadcrumbs={['CRM', 'Oportunidades']}
        actions={[
          {
            label: 'Nova Oportunidade',
            icon: Plus,
            onClick: () => setShowModal(true),
            variant: 'primary'
          }
        ]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Total de Oportunidades"
          value={stats.total}
          subtitle="Todas as oportunidades"
          icon={Target}
          color="blue"
          trend={{ direction: 'up', value: '+12% este mês' }}
        />
        
        <AnimatedStats
          title="Valor Total"
          value={formatCurrency(stats.totalValue)}
          subtitle="Pipeline completo"
          icon={DollarSign}
          color="green"
          trend={{ direction: 'up', value: '+18% este mês' }}
        />
        
        <AnimatedStats
          title="Taxa de Conversão"
          value={`${stats.conversionRate.toFixed(1)}%`}
          subtitle={`${stats.won} oportunidades ganhas`}
          icon={TrendingUp}
          color="purple"
          trend={{ direction: 'up', value: '+2.3% este mês' }}
        />
        
        <AnimatedStats
          title="Ticket Médio"
          value={formatCurrency(stats.avgValue)}
          subtitle="Valor médio por oportunidade"
          icon={BarChart3}
          color="orange"
          trend={{ direction: 'up', value: '+8.5% este mês' }}
        />
      </div>

      {/* Filtros */}
      <GradientCard gradient="gray" className="p-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar oportunidades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas as etapas</option>
              {stages.map(stage => (
                <option key={stage} value={stage}>{stageLabels[stage]}</option>
              ))}
            </select>
          </div>
        </div>
      </GradientCard>



      {/* Pipeline Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <div key={stage} className="min-w-[320px] max-w-[320px]">
            <GradientCard gradient="gray" className="p-4 h-full">
              {/* Header da Coluna */}
              <div className="mb-4 pb-3 border-b-2" style={{ borderColor: stageColors[stage] }}>
                <h3 className="text-lg font-bold mb-2" style={{ color: stageColors[stage] }}>
                  {stageLabels[stage]}
                </h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    {stageTotals[stage].count} oportunidades
                  </span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(stageTotals[stage].value)}
                  </span>
                </div>
              </div>

              {/* Cards das Oportunidades */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredOpportunities
                  .filter(opp => opp.stage === stage)
                  .length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhuma oportunidade nesta etapa</p>
                    </div>
                  ) : (
                    filteredOpportunities
                      .filter(opp => opp.stage === stage)
                      .map(opp => (
                    <div
                      key={opp.id}
                      className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                      onClick={() => handleViewDetails(opp)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900 text-sm leading-tight flex-1 pr-2">
                          {opp.title}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(opp);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="text-lg font-bold text-green-600 mb-3">
                        {formatCurrency(opp.value)}
                      </div>

                      <div className="space-y-2 mb-3">
                        {opp.company && (
                          <div className="flex items-center text-xs text-gray-600">
                            <Building className="w-3 h-3 mr-2" />
                            {opp.company.name}
                          </div>
                        )}

                        {opp.owner && (
                          <div className="flex items-center text-xs text-gray-600">
                            <User className="w-3 h-3 mr-2" />
                            {opp.owner.name}
                          </div>
                        )}

                        {opp.probability && (
                          <div className="flex items-center text-xs text-gray-600">
                            <Percent className="w-3 h-3 mr-2" />
                            {opp.probability}% de chance
                          </div>
                        )}

                        {opp.expectedCloseDate && (
                          <div className="flex items-center text-xs text-gray-600">
                            <Calendar className="w-3 h-3 mr-2" />
                            {new Date(opp.expectedCloseDate).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex gap-2 pt-3 border-t border-gray-100">
                        {getNextStage(stage) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              moveOpportunity(opp.id, getNextStage(stage));
                            }}
                            className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                          >
                            Avançar <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        
                        {stage !== 'WON' && stage !== 'LOST' && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                moveOpportunity(opp.id, 'WON');
                              }}
                              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
                              title="Marcar como Ganha"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                moveOpportunity(opp.id, 'LOST');
                              }}
                              className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition-colors flex items-center justify-center"
                              title="Marcar como Perdida"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GradientCard>
          </div>
        ))}
      </div>

      {/* Modal de Formulário */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
          title={selectedOpportunity ? 'Editar Oportunidade' : 'Nova Oportunidade'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Implementação CRM Empresa ABC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Descreva os detalhes da oportunidade..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Probabilidade (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData({...formData, probability: parseInt(e.target.value) || 50})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Empresa *
                </label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({...formData, companyId: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsável *
                </label>
                <select
                  value={formData.ownerId}
                  onChange={(e) => setFormData({...formData, ownerId: e.target.value})}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um vendedor</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Etapa
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({...formData, stage: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {stages.filter(s => s !== 'WON' && s !== 'LOST').map(stage => (
                    <option key={stage} value={stage}>{stageLabels[stage]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origem
                </label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="WEBSITE">Website</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PHONE">Telefone</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="REFERRAL">Indicação</option>
                  <option value="CAMPAIGN">Campanha</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Prevista de Fechamento
              </label>
              <input
                type="date"
                value={formData.expectedCloseDate}
                onChange={(e) => setFormData({...formData, expectedCloseDate: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              <button 
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                {selectedOpportunity ? 'Atualizar' : 'Criar'} Oportunidade
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de Detalhes */}
      {showDetailsModal && selectedOpportunity && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedOpportunity(null);
          }}
          title={selectedOpportunity.title}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Valor da Oportunidade</h3>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedOpportunity.value)}
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Etapa Atual</h3>
                <span 
                  className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full text-white"
                  style={{ backgroundColor: stageColors[selectedOpportunity.stage] }}
                >
                  {stageLabels[selectedOpportunity.stage]}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Empresa</h3>
                <div className="flex items-center">
                  <Building className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{selectedOpportunity.company?.name}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Responsável</h3>
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{selectedOpportunity.owner?.name}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Probabilidade</h3>
                <div className="flex items-center">
                  <Percent className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{selectedOpportunity.probability}%</span>
                </div>
              </div>

              {selectedOpportunity.source && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Origem</h3>
                  <span className="text-gray-900">{selectedOpportunity.source}</span>
                </div>
              )}

              {selectedOpportunity.expectedCloseDate && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Data Prevista</h3>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">
                      {new Date(selectedOpportunity.expectedCloseDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}

              {selectedOpportunity.actualCloseDate && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Data de Fechamento</h3>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">
                      {new Date(selectedOpportunity.actualCloseDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {selectedOpportunity.description && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrição</h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedOpportunity.description}</p>
              </div>
            )}

            {selectedOpportunity.lossReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-red-800 mb-2">Motivo da Perda</h3>
                <p className="text-red-700">{selectedOpportunity.lossReason}</p>
              </div>
            )}

            {selectedOpportunity.activities && selectedOpportunity.activities.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Atividades Recentes</h3>
                <div className="space-y-3">
                  {selectedOpportunity.activities.slice(0, 5).map(activity => (
                    <div key={activity.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="font-medium text-gray-900">{activity.subject}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {activity.assignedTo?.name} - {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedOpportunity(null);
                }}
                className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
              
              <button
                onClick={() => {
                  handleEdit(selectedOpportunity);
                  setShowDetailsModal(false);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
