import { useState, useEffect } from 'react';
import ModernTable from '../components/ModernTable';
import AnimatedStats from '../components/AnimatedStats';
import Modal from '../components/Modal';

export default function MetasPerformance() {
  const [activeTab, setActiveTab] = useState('metas');
  const [salesTargets, setSalesTargets] = useState([]);
  const [teamCommissions, setTeamCommissions] = useState([]);
  const [advancedWorkflows, setAdvancedWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar metas de vendas
      const targetsResponse = await fetch('/api/sales-targets');
      const targetsData = await targetsResponse.json();
      setSalesTargets(targetsData);

      // Carregar comissões por equipe
      const commissionsResponse = await fetch('/api/team-commissions?type=by_region');
      const commissionsData = await commissionsResponse.json();
      setTeamCommissions(commissionsData);

      // Carregar workflows avançados
      const workflowsResponse = await fetch('/api/advanced-workflows');
      const workflowsData = await workflowsResponse.json();
      setAdvancedWorkflows(workflowsData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'ACHIEVED': 'text-green-600 bg-green-100',
      'ON_TRACK': 'text-blue-600 bg-blue-100',
      'AT_RISK': 'text-yellow-600 bg-yellow-100',
      'BEHIND': 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getStatusText = (status) => {
    const texts = {
      'ACHIEVED': 'Atingida',
      'ON_TRACK': 'No Caminho',
      'AT_RISK': 'Em Risco',
      'BEHIND': 'Atrasada'
    };
    return texts[status] || status;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const targetsColumns = [
    {
      key: 'seller.name',
      label: 'Vendedor',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.seller.name}</div>
          <div className="text-sm text-gray-500">{item.seller.region?.name}</div>
        </div>
      )
    },
    {
      key: 'targetValue',
      label: 'Meta',
      render: (item) => formatCurrency(item.targetValue)
    },
    {
      key: 'realized',
      label: 'Realizado',
      render: (item) => formatCurrency(item.realized)
    },
    {
      key: 'progress',
      label: 'Progresso',
      render: (item) => (
        <div className="flex items-center">
          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(item.progress, 100)}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium">{formatPercent(item.progress)}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
          {getStatusText(item.status)}
        </span>
      )
    },
    {
      key: 'remaining',
      label: 'Restante',
      render: (item) => formatCurrency(item.remaining)
    }
  ];

  const commissionsColumns = [
    {
      key: 'region.name',
      label: 'Região',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.region.name}</div>
          <div className="text-sm text-gray-500">{item.region.code}</div>
        </div>
      )
    },
    {
      key: 'sellersCount',
      label: 'Vendedores',
      render: (item) => item.sellersCount
    },
    {
      key: 'totalCommissions',
      label: 'Total Comissões',
      render: (item) => formatCurrency(item.totalCommissions)
    },
    {
      key: 'paidCommissions',
      label: 'Pagas',
      render: (item) => formatCurrency(item.paidCommissions)
    },
    {
      key: 'pendingCommissions',
      label: 'Pendentes',
      render: (item) => formatCurrency(item.pendingCommissions)
    },
    {
      key: 'averagePerSeller',
      label: 'Média/Vendedor',
      render: (item) => formatCurrency(item.averagePerSeller)
    }
  ];

  const workflowsColumns = [
    {
      key: 'name',
      label: 'Nome',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.name}</div>
          <div className="text-sm text-gray-500">{item.description}</div>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Tipo',
      render: (item) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
          {item.type}
        </span>
      )
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (item) => item.category
    },
    {
      key: 'priority',
      label: 'Prioridade',
      render: (item) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          item.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
          item.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
          'bg-green-100 text-green-800'
        }`}>
          {item.priority}
        </span>
      )
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (item) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {item.isActive ? 'Ativo' : 'Inativo'}
        </span>
      )
    },
    {
      key: '_count.executions',
      label: 'Execuções',
      render: (item) => item._count.executions
    }
  ];

  // Calcular estatísticas
  const totalTargetValue = salesTargets.reduce((sum, target) => sum + target.targetValue, 0);
  const totalRealized = salesTargets.reduce((sum, target) => sum + target.realized, 0);
  const averageProgress = salesTargets.length > 0 
    ? salesTargets.reduce((sum, target) => sum + target.progress, 0) / salesTargets.length 
    : 0;
  const achievedTargets = salesTargets.filter(target => target.status === 'ACHIEVED').length;

  const totalCommissions = teamCommissions.reduce((sum, region) => sum + region.totalCommissions, 0);
  const totalPaidCommissions = teamCommissions.reduce((sum, region) => sum + region.paidCommissions, 0);
  const activeWorkflows = advancedWorkflows.filter(w => w.isActive).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metas & Performance</h1>
          <p className="text-gray-600">Gestão avançada de metas, comissões e automações</p>
        </div>
        <button
          onClick={() => {
            setModalType('meta');
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Nova Meta
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Meta Total"
          value={formatCurrency(totalTargetValue)}
          icon="🎯"
          color="blue"
        />
        <AnimatedStats
          title="Realizado"
          value={formatCurrency(totalRealized)}
          subtitle={`${formatPercent(averageProgress)} da meta`}
          icon="💰"
          color="green"
        />
        <AnimatedStats
          title="Metas Atingidas"
          value={`${achievedTargets}/${salesTargets.length}`}
          subtitle={`${salesTargets.length > 0 ? ((achievedTargets / salesTargets.length) * 100).toFixed(1) : 0}% de sucesso`}
          icon="🏆"
          color="yellow"
        />
        <AnimatedStats
          title="Workflows Ativos"
          value={activeWorkflows}
          subtitle={`${advancedWorkflows.length} total`}
          icon="⚡"
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'metas', label: 'Metas de Vendas', icon: '🎯' },
            { id: 'comissoes', label: 'Comissões por Equipe', icon: '👥' },
            { id: 'workflows', label: 'Workflows Avançados', icon: '⚡' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'metas' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Metas de Vendas</h2>
              <div className="text-sm text-gray-500">
                {salesTargets.length} metas cadastradas
              </div>
            </div>
            <ModernTable
              data={salesTargets}
              columns={targetsColumns}
              emptyMessage="Nenhuma meta cadastrada"
            />
          </div>
        )}

        {activeTab === 'comissoes' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Comissões por Equipe</h2>
              <div className="text-sm text-gray-500">
                Total: {formatCurrency(totalCommissions)} | Pagas: {formatCurrency(totalPaidCommissions)}
              </div>
            </div>
            <ModernTable
              data={teamCommissions}
              columns={commissionsColumns}
              emptyMessage="Nenhuma comissão encontrada"
            />
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Workflows Avançados</h2>
              <button
                onClick={() => {
                  setModalType('workflow');
                  setShowModal(true);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Novo Workflow
              </button>
            </div>
            <ModernTable
              data={advancedWorkflows}
              columns={workflowsColumns}
              emptyMessage="Nenhum workflow cadastrado"
            />
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          title={modalType === 'meta' ? 'Nova Meta de Vendas' : 'Novo Workflow'}
          onClose={() => setShowModal(false)}
        >
          <div className="p-6">
            <p className="text-gray-600 mb-4">
              {modalType === 'meta' 
                ? 'Funcionalidade de criação de metas em desenvolvimento...'
                : 'Funcionalidade de criação de workflows em desenvolvimento...'
              }
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}