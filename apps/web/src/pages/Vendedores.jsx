import { useState, useEffect } from 'react';
import ModernTable from '../components/ModernTable';
import AnimatedStats from '../components/AnimatedStats';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { Users, Plus } from 'lucide-react';

export default function Vendedores() {
  const [activeTab, setActiveTab] = useState('vendedores');
  const [sellers, setSellers] = useState([]);
  const [salesTargets, setSalesTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar vendedores
      const sellersResponse = await fetch(`${API_ENDPOINTS.users}?role=SELLER`, {
        headers: getAuthHeaders()
      });
      const sellersData = await sellersResponse.json();
      setSellers(Array.isArray(sellersData) ? sellersData : []);

      // Carregar metas de vendas
      const targetsResponse = await fetch(API_ENDPOINTS.salesTargets, {
        headers: getAuthHeaders()
      });
      const targetsData = await targetsResponse.json();
      setSalesTargets(Array.isArray(targetsData) ? targetsData : []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeller = async (e) => {
    e.preventDefault();
    try {
      const url = editingItem 
        ? API_ENDPOINTS.users
        : API_ENDPOINTS.users;
      
      const method = editingItem ? 'PUT' : 'POST';
      const data = editingItem ? { ...formData, id: editingItem.id } : formData;

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });

      if (response.ok) {
        await loadData();
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
      }
    } catch (error) {
      console.error('Erro ao salvar vendedor:', error);
    }
  };

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    try {
      const url = editingItem 
        ? API_ENDPOINTS.salesTargets
        : API_ENDPOINTS.salesTargets;
      
      const method = editingItem ? 'PUT' : 'POST';
      const data = editingItem ? { ...formData, id: editingItem.id } : formData;

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });

      if (response.ok) {
        await loadData();
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
      }
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
    }
  };

  const handleEdit = (item, type) => {
    setEditingItem(item);
    setModalType(type);
    if (type === 'seller') {
      setFormData({
        name: item.name,
        email: item.email,
        role: item.role,
        region: item.region,
        quota: item.quota,
        commissionSalePercentage: item.commissionSalePercentage ?? '',
        commissionProject12: item.commissionProject12 ?? '',
        commissionProject24: item.commissionProject24 ?? '',
        commissionProject36: item.commissionProject36 ?? '',
        commissionProject48: item.commissionProject48 ?? '',
        commissionProject60: item.commissionProject60 ?? ''
      });
    } else if (type === 'target') {
      setFormData({
        sellerId: item.sellerId,
        targetValue: item.targetValue,
        targetDeals: item.targetDeals,
        startDate: item.startDate?.split('T')[0],
        endDate: item.endDate?.split('T')[0],
        description: item.description,
        bonusPercentage: item.bonusPercentage
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (id, type) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
      const url = type === 'seller' 
        ? API_ENDPOINTS.users
        : API_ENDPOINTS.salesTargets;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status) => {
    const colors = {
      'ACHIEVED': 'text-green-600 bg-green-100',
      'ON_TRACK': 'text-blue-600 bg-blue-100',
      'AT_RISK': 'text-yellow-600 bg-yellow-100',
      'BEHIND': 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100 dark:text-slate-200 dark:bg-slate-700/50';
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

  const sellersColumns = [
    {
      key: 'name',
      label: 'Nome',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
          <div className="text-sm text-gray-500 dark:text-slate-200">{item.email}</div>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Função',
      render: (item) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
          {item.role}
        </span>
      )
    },
    {
      key: 'region',
      label: 'Região',
      render: (item) => item.region || 'Não definida'
    },
    {
      key: 'quota',
      label: 'Cota',
      render: (item) => formatCurrency(item.quota)
    },
    {
      key: 'commissionSalePercentage',
      label: 'Comissão',
      render: (item) => {
        const parts = [];
        if (item.commissionSalePercentage != null) parts.push(`Venda: ${item.commissionSalePercentage}%`);
        if (item.commissionProject12 != null) parts.push(`12m: ${item.commissionProject12}%`);
        if (item.commissionProject24 != null) parts.push(`24m: ${item.commissionProject24}%`);
        if (item.commissionProject36 != null) parts.push(`36m: ${item.commissionProject36}%`);
        if (item.commissionProject48 != null) parts.push(`48m: ${item.commissionProject48}%`);
        if (item.commissionProject60 != null) parts.push(`60m: ${item.commissionProject60}%`);
        return parts.length > 0 ? (
          <div className="text-xs leading-relaxed text-gray-600 dark:text-slate-300">
            {parts.map((p, i) => <div key={i}>{p}</div>)}
          </div>
        ) : (
          <span className="text-xs text-gray-400">Não configurada</span>
        );
      }
    },
    {
      key: '_count.opportunities',
      label: 'Oportunidades',
      render: (item) => item._count?.opportunities || 0
    },
    {
      key: '_count.activities',
      label: 'Atividades',
      render: (item) => item._count?.activities || 0
    },
    {
      key: 'createdAt',
      label: 'Cadastrado em',
      render: (item) => formatDate(item.createdAt)
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (item) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(item, 'seller')}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Editar
          </button>
          <button
            onClick={() => handleDelete(item.id, 'seller')}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Excluir
          </button>
        </div>
      )
    }
  ];

  const targetsColumns = [
    {
      key: 'seller.name',
      label: 'Vendedor',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.seller?.name}</div>
          <div className="text-sm text-gray-500 dark:text-slate-200">{item.seller?.region?.name}</div>
        </div>
      )
    },
    {
      key: 'targetValue',
      label: 'Meta Valor',
      render: (item) => formatCurrency(item.targetValue)
    },
    {
      key: 'targetDeals',
      label: 'Meta Negócios',
      render: (item) => item.targetDeals || 0
    },
    {
      key: 'period',
      label: 'Período',
      render: (item) => (
        <div className="text-sm">
          <div>{formatDate(item.startDate)}</div>
          <div className="text-gray-500 dark:text-slate-200">até {formatDate(item.endDate)}</div>
        </div>
      )
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
          <div className="flex-1 bg-gray-200 dark:bg-white/10 rounded-full h-2 mr-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(item.progress || 0, 100)}%` }}
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
      key: 'actions',
      label: 'Ações',
      render: (item) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(item, 'target')}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Editar
          </button>
          <button
            onClick={() => handleDelete(item.id, 'target')}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Excluir
          </button>
        </div>
      )
    }
  ];

  // Calcular estatísticas
  const totalSellers = Array.isArray(sellers) ? sellers.length : 0;
  const activeSellers = Array.isArray(sellers) ? sellers.filter(s => s._count?.opportunities > 0).length : 0;
  const totalTargetValue = Array.isArray(salesTargets) ? salesTargets.reduce((sum, target) => sum + target.targetValue, 0) : 0;
  const totalRealized = Array.isArray(salesTargets) ? salesTargets.reduce((sum, target) => sum + (target.realized || 0), 0) : 0;
  const averageProgress = Array.isArray(salesTargets) && salesTargets.length > 0 
    ? salesTargets.reduce((sum, target) => sum + (target.progress || 0), 0) / salesTargets.length 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendedores"
        subtitle="Cadastro de vendedores e gestão de metas"
        icon={Users}
        gradient="blue"
        breadcrumbs={['Home', 'Vendedores']}
        actions={[
          {
            label: 'Novo Vendedor',
            onClick: () => {
              setModalType('seller');
              setEditingItem(null);
              setFormData({});
              setShowModal(true);
            },
            icon: Plus,
            variant: 'primary'
          },
          {
            label: 'Nova Meta',
            onClick: () => {
              setModalType('target');
              setEditingItem(null);
              setFormData({});
              setShowModal(true);
            },
            icon: Plus,
            variant: 'secondary'
          }
        ]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Total Vendedores"
          value={totalSellers}
          subtitle={`${activeSellers} ativos`}
          icon="👥"
          color="blue"
        />
        <AnimatedStats
          title="Meta Total"
          value={formatCurrency(totalTargetValue)}
          icon="🎯"
          color="green"
        />
        <AnimatedStats
          title="Realizado"
          value={formatCurrency(totalRealized)}
          subtitle={`${formatPercent(averageProgress)} da meta`}
          icon="💰"
          color="yellow"
        />
        <AnimatedStats
          title="Performance Média"
          value={formatPercent(averageProgress)}
          icon="📈"
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-blue-500/20">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'vendedores', label: 'Vendedores', icon: '👥' },
            { id: 'metas', label: 'Metas', icon: '🎯' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-200 dark:hover:text-slate-100 dark:hover:border-blue-400/50 dark:border-blue-500/30'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="crm-card rounded-lg">
        {activeTab === 'vendedores' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Vendedores Cadastrados</h2>
              <div className="text-sm text-gray-500 dark:text-slate-200">
                {sellers.length} vendedores
              </div>
            </div>
            <ModernTable
              data={sellers}
              columns={sellersColumns}
              emptyMessage="Nenhum vendedor cadastrado"
            />
          </div>
        )}

        {activeTab === 'metas' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Metas de Vendas</h2>
              <div className="text-sm text-gray-500 dark:text-slate-200">
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
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          title={modalType === 'seller' 
            ? (editingItem ? 'Editar Vendedor' : 'Novo Vendedor')
            : (editingItem ? 'Editar Meta' : 'Nova Meta')
          }
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
            setFormData({});
          }}
        >
          <div className="p-6">
            {modalType === 'seller' ? (
              <form onSubmit={handleSaveSeller} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {!editingItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                      Senha *
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.password || ''}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Função
                  </label>
                  <select
                    value={formData.role || 'SELLER'}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="SELLER">Vendedor</option>
                    <option value="DIRECTOR">Diretor</option>
                    <option value="MANAGER">Gerente</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Região
                  </label>
                  <input
                    type="text"
                    value={formData.region || ''}
                    onChange={(e) => setFormData({...formData, region: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: São Paulo, Rio de Janeiro"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Cota Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quota || ''}
                    onChange={(e) => setFormData({...formData, quota: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="border-t border-gray-200 dark:border-blue-500/20 pt-4">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-slate-100 mb-3">Comissões</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                        Venda Pontual (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.commissionSalePercentage ?? ''}
                        onChange={(e) => setFormData({...formData, commissionSalePercentage: e.target.value === '' ? null : parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ex: 3.0"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-2">
                      Projetos Mensais (% por duração)
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { key: 'commissionProject12', label: '12 meses' },
                        { key: 'commissionProject24', label: '24 meses' },
                        { key: 'commissionProject36', label: '36 meses' },
                        { key: 'commissionProject48', label: '48 meses' },
                        { key: 'commissionProject60', label: '60 meses' }
                      ].map((field) => (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-300 mb-1">
                            {field.label}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={formData[field.key] ?? ''}
                            onChange={(e) => setFormData({...formData, [field.key]: e.target.value === '' ? null : parseFloat(e.target.value)})}
                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder="%"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:text-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-600/70"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingItem ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveTarget} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Vendedor *
                  </label>
                  <select
                    required
                    value={formData.sellerId || ''}
                    onChange={(e) => setFormData({...formData, sellerId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione um vendedor</option>
                    {sellers.map(seller => (
                      <option key={seller.id} value={seller.id}>
                        {seller.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                      Meta Valor (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.targetValue || ''}
                      onChange={(e) => setFormData({...formData, targetValue: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                      Meta Negócios
                    </label>
                    <input
                      type="number"
                      value={formData.targetDeals || ''}
                      onChange={(e) => setFormData({...formData, targetDeals: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                      Data Início *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                      Data Fim *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.endDate || ''}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Descrição da meta..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Bônus (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.bonusPercentage || ''}
                    onChange={(e) => setFormData({...formData, bonusPercentage: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: 5.0"
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:text-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-600/70"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {editingItem ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
