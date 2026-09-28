import { useState, useEffect } from 'react';
import { 
  Target, 
  Users, 
  TrendingUp, 
  Award,
  Zap,
  BarChart3,
  Settings,
  RefreshCw,
  Shuffle
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import GradientCard from '../components/GradientCard';

export default function LeadManagement() {
  const [leadStats, setLeadStats] = useState({});
  const [companies, setCompanies] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scoring');
  const [selectedStrategy, setSelectedStrategy] = useState('LOAD_BALANCE');

  useEffect(() => {
    fetchLeadStats();
    fetchCompanies();
    fetchSellers();
  }, []);

  const fetchLeadStats = async () => {
    try {
      const response = await fetch('/api/leadScoring?action=stats');
      const data = await response.json();
      setLeadStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/leadScoring?action=range&minScore=0&maxScore=100');
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const response = await fetch('/api/leadDistribution?action=sellers');
      const data = await response.json();
      setSellers(data);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
    }
  };

  const recalculateAllScores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leadScoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate-all' })
      });
      
      const result = await response.json();
      alert(result.message);
      
      // Recarregar dados
      await fetchLeadStats();
      await fetchCompanies();
    } catch (error) {
      console.error('Erro ao recalcular scores:', error);
      alert('Erro ao recalcular scores');
    } finally {
      setLoading(false);
    }
  };

  const redistributeUnattended = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leadDistribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'redistribute-unattended',
          daysThreshold: 3
        })
      });
      
      const result = await response.json();
      alert(result.message);
      
      // Recarregar dados
      await fetchSellers();
    } catch (error) {
      console.error('Erro ao redistribuir leads:', error);
      alert('Erro ao redistribuir leads');
    } finally {
      setLoading(false);
    }
  };

  const createOpportunityForLead = async (companyId) => {
    try {
      const response = await fetch('/api/leadDistribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create-opportunity',
          companyId,
          strategy: selectedStrategy
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Lead distribuído com sucesso para ${result.assignedSeller?.name}`);
        await fetchSellers();
      } else {
        alert(result.error || 'Erro ao distribuir lead');
      }
    } catch (error) {
      console.error('Erro ao distribuir lead:', error);
      alert('Erro ao distribuir lead');
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Gestão de Leads"
        subtitle="Sistema inteligente de pontuação e distribuição de leads"
        icon={Target}
        gradient="blue"
        breadcrumbs={['CRM', 'Gestão de Leads']}
        actions={[
          {
            label: 'Recalcular Scores',
            onClick: recalculateAllScores,
            icon: RefreshCw,
            variant: 'primary'
          },
          {
            label: 'Redistribuir Leads',
            onClick: redistributeUnattended,
            icon: Shuffle,
            variant: 'secondary'
          }
        ]}
      />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('scoring')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scoring'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Lead Scoring</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('distribution')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'distribution'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Distribuição</span>
            </div>
          </button>
        </nav>
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

          {/* Lista de Empresas por Score */}
          <GradientCard gradient="blue" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Empresas por Lead Score</h2>
                <p className="text-gray-600 mt-1">Ordenadas por pontuação (maior para menor)</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            
            <div className="space-y-3">
              {companies
                .sort((a, b) => b.leadScore - a.leadScore)
                .slice(0, 20)
                .map(company => (
                <div 
                  key={company.id}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {company.name}
                      </h3>
                      
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: getScoreColor(company.leadScore) }}
                      >
                        {company.leadScore} - {getScoreLabel(company.leadScore)}
                      </span>
                      
                      <span className="text-sm text-gray-500">
                        {company.segment || 'Sem segmento'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {company.opportunities?.length || 0} oportunidades
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {company.contacts?.length || 0} contatos
                      </span>
                    </div>
                  </div>
                  
                  {company.status === 'LEAD' && (
                    <button
                      onClick={() => createOpportunityForLead(company.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Distribuir Lead
                    </button>
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
                <h2 className="text-2xl font-bold text-gray-900">Estratégia de Distribuição</h2>
                <p className="text-gray-600 mt-1">Configure como os leads são distribuídos para os vendedores</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Settings className="w-6 h-6 text-green-600" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm font-semibold text-gray-700">Estratégia Padrão:</label>
                <select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-[250px]"
                >
                  <option value="ROUND_ROBIN">🔄 Round Robin</option>
                  <option value="LOAD_BALANCE">⚖️ Balanceamento de Carga</option>
                  <option value="REGION_BASED">🌍 Baseado em Região</option>
                  <option value="SCORE_BASED">⭐ Baseado em Score</option>
                </select>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <strong className="text-blue-800">Round Robin:</strong>
                  <p className="mt-1">Distribuição sequencial entre vendedores</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <strong className="text-green-800">Balanceamento de Carga:</strong>
                  <p className="mt-1">Atribui ao vendedor com menos oportunidades</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <strong className="text-purple-800">Baseado em Região:</strong>
                  <p className="mt-1">Considera a localização geográfica</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <strong className="text-orange-800">Baseado em Score:</strong>
                  <p className="mt-1">Leads de alto score para vendedores experientes</p>
                </div>
              </div>
            </div>
          </GradientCard>

          {/* Status dos Vendedores */}
          <GradientCard gradient="purple" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Status dos Vendedores</h2>
                <p className="text-gray-600 mt-1">Carga de trabalho e performance atual</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            
            <div className="space-y-4">
              {sellers.map(seller => (
                <div 
                  key={seller.id}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {seller.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {seller.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
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
                        <div className="text-xs text-gray-500">
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
                        <div className="text-xs text-gray-500">
                          Pipeline
                        </div>
                      </div>
                    </div>
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