import { useState, useEffect } from 'react';
import ModernTable from '../components/ModernTable';
import AnimatedStats from '../components/AnimatedStats';
import Modal from '../components/Modal';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

const normalizeRole = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PRE-VENDAS' || raw === 'PREVENDAS') return 'PRE_SALES';
  return raw || 'SELLER';
};

const roleLabels = {
  SELLER: 'Vendedor',
  PRE_SALES: 'Pré-Vendas',
  DIRECTOR: 'Diretor',
  MANAGER: 'Gerente',
  ADMIN: 'Administrador'
};

const resolveSellerType = (item = {}) => (Boolean(item.accessB2G) ? 'governo' : 'privado');

const accessBySellerType = (type) => ({
  accessB2B: type !== 'governo',
  accessB2G: type === 'governo'
});

export default function VendedoresFixed() {
  const userRaw = localStorage.getItem('user');
  const currentUser = userRaw ? JSON.parse(userRaw) : null;
  const currentRole = currentUser?.role || null;
  const canManageUsers = currentRole === 'ADMIN' || currentRole === 'MASTER';

  const [activeTab, setActiveTab] = useState('vendedores');
  const [sellers, setSellers] = useState([]);
  const [salesTargets, setSalesTargets] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('Iniciando carregamento de dados...');
      setLoading(true);
      setError(null);
      
      // Carregar equipe comercial e Pré-Vendas
      console.log('Carregando equipe comercial e Pré-Vendas...');
      const [sellersResponse, preSalesResponse] = await Promise.all([
        fetch(`${API_ENDPOINTS.users}?role=SELLER`, { headers: getAuthHeaders() }),
        fetch(`${API_ENDPOINTS.users}?role=PRE_SALES`, { headers: getAuthHeaders() })
      ]);

      if (!sellersResponse.ok) {
        throw new Error(`Erro ao carregar vendedores: ${sellersResponse.status}`);
      }
      if (!preSalesResponse.ok) {
        throw new Error(`Erro ao carregar Pré-Vendas: ${preSalesResponse.status}`);
      }

      const [sellersData, preSalesData] = await Promise.all([
        sellersResponse.json(),
        preSalesResponse.json()
      ]);
      const teamData = [
        ...(Array.isArray(sellersData) ? sellersData : []),
        ...(Array.isArray(preSalesData) ? preSalesData : [])
      ];
      console.log('Equipe carregada:', teamData);
      setSellers(teamData);

      // Carregar metas de vendas (opcional)
      try {
        const targetsResponse = await fetch(API_ENDPOINTS.salesTargets, {
          headers: getAuthHeaders()
        });
        if (targetsResponse.ok) {
          const targetsData = await targetsResponse.json();
          setSalesTargets(targetsData || []);
        }
      } catch { /* ignora se não disponível */ }

      // Carregar regiões (opcional)
      try {
        const regionsResponse = await fetch(API_ENDPOINTS.regions, {
          headers: getAuthHeaders()
        });
        if (regionsResponse.ok) {
          const regionsData = await regionsResponse.json();
          setRegions(regionsData || []);
        }
      } catch { /* ignora se não disponível */ }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError(error.message);
    } finally {
      setLoading(false);
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

  const handleSaveSeller = async (e) => {
    e.preventDefault();
    try {
      const url = API_ENDPOINTS.users;
      const method = editingItem ? 'PUT' : 'POST';
      const role = normalizeRole(formData.role || 'SELLER');
      const { sellerType: _sellerType, ...formPayload } = formData;
      const basePayload = editingItem ? { ...formPayload, id: editingItem.id } : formPayload;
      const sellerTypeAccess = accessBySellerType(formData.sellerType || resolveSellerType(formData));
      const roleAccess = role === 'PRE_SALES'
        ? { accessB2B: false, accessB2G: false, accessPreSales: true }
        : { ...sellerTypeAccess, accessPreSales: false };
      const data = {
        ...basePayload,
        role,
        ...roleAccess
      };

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
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error || 'Erro ao salvar vendedor'}`);
      }
    } catch (error) {
      console.error('Erro ao salvar vendedor:', error);
      alert('Erro ao salvar vendedor');
    }
  };

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    try {
      const url = API_ENDPOINTS.salesTargets;
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
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error || 'Erro ao salvar meta'}`);
      }
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      alert('Erro ao salvar meta');
    }
  };

  const handleEdit = (item, type) => {
    setEditingItem(item);
    setModalType(type);
    if (type === 'seller') {
      const role = normalizeRole(item.role);
      const sellerType = resolveSellerType(item);
      setFormData({
        name: item.name,
        email: item.email,
        role,
        regionId: item.region?.id || '',
        quota: item.quota,
        sellerType,
        ...accessBySellerType(sellerType),
        accessPreSales: role === 'PRE_SALES'
      });
    } else if (type === 'target') {
      setFormData({
        sellerId: item.sellerId,
        targetValue: item.targetValue,
        targetDeals: item.targetDeals,
        startDate: item.startDate?.split('T')[0],
        endDate: item.endDate?.split('T')[0],
        description: item.description,
        bonusPercentage: item.bonusPercentage,
        type: getTargetType(item.startDate, item.endDate)
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (id, type) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
      const url = type === 'seller' ? API_ENDPOINTS.users : API_ENDPOINTS.salesTargets;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        await loadData();
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error || 'Erro ao excluir'}`);
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir');
    }
  };

  const getTargetType = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    if (diffMonths <= 1) return 'MENSAL';
    if (diffMonths >= 11 && diffMonths <= 13) return 'ANUAL';
    return 'PERSONALIZADO';
  };

  const generateTargetDates = (type) => {
    const now = new Date();
    let startDate, endDate;

    if (type === 'MENSAL') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === 'ANUAL') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
    }

    return {
      startDate: startDate?.toISOString().split('T')[0],
      endDate: endDate?.toISOString().split('T')[0]
    };
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
          {roleLabels[normalizeRole(item.role)] || item.role}
        </span>
      )
    },
    {
      key: 'regionName',
      label: 'Região',
      render: (item) => item.region?.name || 'Não definida'
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (item) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          resolveSellerType(item) === 'governo'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {resolveSellerType(item) === 'governo' ? 'Governo' : 'Privado'}
        </span>
      )
    },
    {
      key: 'quota',
      label: 'Cota',
      render: (item) => formatCurrency(item.quota)
    },
    {
      key: 'opportunities',
      label: 'Oportunidades',
      render: (item) => item._count?.opportunities || 0
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
        canManageUsers ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(item, 'seller')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Editar
            </button>
            <button
              onClick={() => handleDelete(item.id, 'seller')}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Excluir
            </button>
          </div>
        ) : (
          <span className="text-sm text-gray-400 dark:text-slate-200">-</span>
        )
      )
    }
  ];

  const targetsColumns = [
    {
      key: 'sellerName',
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
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Editar
          </button>
          <button
            onClick={() => handleDelete(item.id, 'target')}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Excluir
          </button>
        </div>
      )
    }
  ];

  // Calcular estatísticas
  const sellerUsers = sellers.filter((user) => normalizeRole(user.role) === 'SELLER');
  const preSalesUsers = sellers.filter((user) => normalizeRole(user.role) === 'PRE_SALES');
  const totalSellers = sellerUsers.length;
  const activeSellers = sellerUsers.filter(s => s._count?.opportunities > 0).length;
  const totalTargetValue = salesTargets.reduce((sum, target) => sum + target.targetValue, 0);
  const totalRealized = salesTargets.reduce((sum, target) => sum + (target.realized || 0), 0);
  const averageProgress = salesTargets.length > 0 
    ? salesTargets.reduce((sum, target) => sum + (target.progress || 0), 0) / salesTargets.length 
    : 0;

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Vendedores</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Gestão de Vendedores</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Erro:</strong> {error}
          <button 
            onClick={loadData}
            className="ml-4 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestão de Vendedores</h1>
          <p className="text-gray-600 dark:text-slate-200">Cadastro de vendedores e gestão de metas</p>
        </div>
        <div className="flex gap-2">
          {canManageUsers && (
            <>
              <button
                onClick={() => {
                  setModalType('seller');
                  setEditingItem(null);
                  setFormData({
                    role: 'SELLER',
                    sellerType: 'privado',
                    ...accessBySellerType('privado'),
                    accessPreSales: false
                  });
                  setShowModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Novo Vendedor
              </button>
              <button
                onClick={() => {
                  setModalType('seller');
                  setEditingItem(null);
                  setFormData({
                    role: 'PRE_SALES',
                    sellerType: 'privado',
                    accessB2B: false,
                    accessB2G: false,
                    accessPreSales: true
                  });
                  setShowModal(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Novo Pré-Vendas
              </button>
            </>
          )}
          <button
            onClick={() => {
              setModalType('target');
              setEditingItem(null);
              setFormData({ type: 'MENSAL', ...generateTargetDates('MENSAL') });
              setShowModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Nova Meta
          </button>
        </div>
      </div>

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
          title="Pré-Vendas"
          value={preSalesUsers.length}
          subtitle="cadastrados"
          icon="🧩"
          color="purple"
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
                {sellerUsers.length} vendedores · {preSalesUsers.length} Pré-Vendas
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
      <Modal
        isOpen={showModal}
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
                    placeholder="Nome completo do vendedor"
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
                    placeholder="email@empresa.com"
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
                      placeholder="Senha inicial"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Função
                  </label>
                  <select
                    value={formData.role || 'SELLER'}
                    onChange={(e) => {
                      const role = normalizeRole(e.target.value);
                      setFormData({
                        ...formData,
                        role,
                        ...(role === 'PRE_SALES'
                          ? { accessB2B: false, accessB2G: false, accessPreSales: true }
                          : { ...accessBySellerType(formData.sellerType || 'privado'), accessPreSales: false })
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="SELLER">Vendedor</option>
                    <option value="PRE_SALES">Pré-Vendas</option>
                    <option value="DIRECTOR">Diretor</option>
                    <option value="MANAGER">Gerente</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Região
                  </label>
                  <select
                    value={formData.regionId || ''}
                    onChange={(e) => setFormData({...formData, regionId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione uma região</option>
                    {regions.map(region => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {normalizeRole(formData.role) !== 'PRE_SALES' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Tipo
                  </label>
                  <select
                    value={formData.sellerType || resolveSellerType(formData)}
                    onChange={(e) => {
                      const sellerType = e.target.value;
                      setFormData({
                        ...formData,
                        sellerType,
                        ...accessBySellerType(sellerType)
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="privado">Privado</option>
                    <option value="governo">Governo</option>
                  </select>
                </div>
                )}
                
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
                    placeholder="50000.00"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                    Tipo de Meta *
                  </label>
                  <select
                    required
                    value={formData.type || 'MENSAL'}
                    onChange={(e) => {
                      const newType = e.target.value;
                      const dates = generateTargetDates(newType);
                      setFormData({
                        ...formData, 
                        type: newType,
                        ...dates
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="MENSAL">Meta Mensal</option>
                    <option value="ANUAL">Meta Anual</option>
                    <option value="PERSONALIZADO">Período Personalizado</option>
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
                      placeholder="50000.00"
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
                      placeholder="10"
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
                    placeholder="5.0"
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
    </div>
  );
}
