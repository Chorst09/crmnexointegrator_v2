import { useEffect, useState } from 'react';
import ModernTable from '../components/ModernTable';
import AnimatedStats from '../components/AnimatedStats';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { Target, Plus, Users } from 'lucide-react';

const getDefaultTargetForm = (sellers = []) => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  return {
    sellerId: sellers.length === 1 ? sellers[0].id : '',
    targetValue: '',
    targetDeals: '',
    startDate,
    endDate,
    description: '',
    bonusPercentage: ''
  };
};

const fetchArray = async (url) => {
  const response = await fetch(url, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error(`Erro ao carregar ${url}: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

export default function MetasPerformance() {
  const [activeTab, setActiveTab] = useState('metas');
  const [sellers, setSellers] = useState([]);
  const [salesTargets, setSalesTargets] = useState([]);
  const [teamCommissions, setTeamCommissions] = useState([]);
  const [advancedWorkflows, setAdvancedWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState(() => getDefaultTargetForm());
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError('');

      const [sellersResult, targetsResult, commissionsResult, workflowsResult] = await Promise.allSettled([
        fetchArray(`${API_ENDPOINTS.users}?role=SELLER`),
        fetchArray(API_ENDPOINTS.salesTargets),
        fetchArray(`${API_ENDPOINTS.teamCommissions}?type=by_seller`),
        fetchArray(API_ENDPOINTS.advancedWorkflows)
      ]);

      const nextSellers = sellersResult.status === 'fulfilled' ? sellersResult.value : [];
      const nextTargets = targetsResult.status === 'fulfilled' ? targetsResult.value : [];

      setSellers(nextSellers);
      setSalesTargets(nextTargets);
      setTeamCommissions(commissionsResult.status === 'fulfilled' ? commissionsResult.value : []);
      setAdvancedWorkflows(workflowsResult.status === 'fulfilled' ? workflowsResult.value : []);

      if (sellersResult.status === 'rejected' || targetsResult.status === 'rejected') {
        setLoadError('Nao foi possivel carregar os dados de metas neste momento.');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setLoadError('Nao foi possivel carregar os dados desta pagina.');
      setSellers([]);
      setSalesTargets([]);
      setTeamCommissions([]);
      setAdvancedWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const openTargetModal = () => {
    setModalType('meta');
    setFormError('');
    setFormData(getDefaultTargetForm(sellers));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setFormError('');
    setFormData(getDefaultTargetForm(sellers));
  };

  const handleSaveTarget = async (e) => {
    e.preventDefault();

    if (!formData.sellerId) {
      setFormError('Selecione um vendedor para vincular a meta.');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setFormError('Informe o periodo da meta.');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setFormError('A data final precisa ser maior ou igual a data inicial.');
      return;
    }

    try {
      setSaving(true);
      setFormError('');

      const response = await fetch(API_ENDPOINTS.salesTargets, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          sellerId: formData.sellerId,
          targetValue: Number(formData.targetValue || 0),
          targetDeals: Number(formData.targetDeals || 0),
          startDate: formData.startDate,
          endDate: formData.endDate,
          description: formData.description?.trim() || null,
          bonusPercentage: Number(formData.bonusPercentage || 0)
        })
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao salvar meta.';

        try {
          const errorData = await response.json();
          errorMessage = errorData?.error || errorMessage;
        } catch {
          // Mantem a mensagem padrao caso a API nao retorne JSON.
        }

        setFormError(errorMessage);
        return;
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      setFormError('Erro de conexao ao salvar a meta.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      ACHIEVED: 'text-green-600 bg-green-100',
      ON_TRACK: 'text-blue-600 bg-blue-100',
      AT_RISK: 'text-yellow-600 bg-yellow-100',
      BEHIND: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100 dark:text-slate-200 dark:bg-slate-700/50';
  };

  const getStatusText = (status) => {
    const texts = {
      ACHIEVED: 'Atingida',
      ON_TRACK: 'No Caminho',
      AT_RISK: 'Em Risco',
      BEHIND: 'Atrasada'
    };
    return texts[status] || status;
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

  const targetsColumns = [
    {
      key: 'seller.name',
      label: 'Vendedor',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.seller?.name || '-'}</div>
          <div className="text-sm text-gray-500 dark:text-slate-200">{item.seller?.region?.name || 'Sem regiao'}</div>
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
          <div className="mr-2 h-2 flex-1 rounded-full bg-gray-200 dark:bg-white/10">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
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
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}>
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
      key: 'seller.name',
      label: 'Vendedor',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.seller?.name || '-'}</div>
          <div className="text-sm text-gray-500 dark:text-slate-200">{item.seller?.region?.name || 'Sem regiao'}</div>
        </div>
      )
    },
    {
      key: 'opportunitiesWon',
      label: 'Projetos Ganhos',
      render: (item) => item.opportunitiesWon || 0
    },
    {
      key: 'totalCommissions',
      label: 'Comissao Acumulada',
      render: (item) => formatCurrency(item.totalCommissions)
    },
    {
      key: 'pendingCommissions',
      label: 'Pendente',
      render: (item) => formatCurrency(item.pendingCommissions)
    },
    {
      key: 'approvedCommissions',
      label: 'Aprovada',
      render: (item) => formatCurrency(item.approvedCommissions)
    },
    {
      key: 'paidCommissions',
      label: 'Paga',
      render: (item) => formatCurrency(item.paidCommissions)
    },
    {
      key: 'averageCommission',
      label: 'Ticket Medio',
      render: (item) => formatCurrency(item.averageCommission)
    }
  ];

  const workflowsColumns = [
    {
      key: 'name',
      label: 'Nome',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
          <div className="text-sm text-gray-500 dark:text-slate-200">{item.description}</div>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Tipo',
      render: (item) => (
        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
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
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
          item.priority === 'HIGH'
            ? 'bg-red-100 text-red-800'
            : item.priority === 'MEDIUM'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
        }`}>
          {item.priority}
        </span>
      )
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (item) => (
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
          item.isActive
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800 dark:bg-slate-700/50 dark:text-slate-100'
        }`}>
          {item.isActive ? 'Ativo' : 'Inativo'}
        </span>
      )
    },
    {
      key: '_count.executions',
      label: 'Execucoes',
      render: (item) => item._count?.executions || 0
    }
  ];

  const totalTargetValue = Array.isArray(salesTargets)
    ? salesTargets.reduce((sum, target) => sum + (target.targetValue || 0), 0)
    : 0;
  const totalRealized = Array.isArray(salesTargets)
    ? salesTargets.reduce((sum, target) => sum + (target.realized || 0), 0)
    : 0;
  const averageProgress = Array.isArray(salesTargets) && salesTargets.length > 0
    ? salesTargets.reduce((sum, target) => sum + (target.progress || 0), 0) / salesTargets.length
    : 0;
  const achievedTargets = Array.isArray(salesTargets)
    ? salesTargets.filter((target) => target.status === 'ACHIEVED').length
    : 0;

  const totalCommissions = Array.isArray(teamCommissions)
    ? teamCommissions.reduce((sum, region) => sum + (region.totalCommissions || 0), 0)
    : 0;
  const totalPaidCommissions = Array.isArray(teamCommissions)
    ? teamCommissions.reduce((sum, item) => sum + (item.paidCommissions || 0), 0)
    : 0;
  const totalPendingCommissions = Array.isArray(teamCommissions)
    ? teamCommissions.reduce((sum, item) => sum + (item.pendingCommissions || 0), 0)
    : 0;
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas & Performance"
        subtitle="Gestao avancada de metas, comissoes e automacoes"
        icon={Target}
        gradient="blue"
        breadcrumbs={['Home', 'Metas & Performance']}
        actions={[
          {
            label: 'Gerenciar Vendedores',
            onClick: () => {
              window.location.href = '/vendedores';
            },
            icon: Users,
            variant: 'secondary'
          },
          {
            label: 'Nova Meta',
            onClick: openTargetModal,
            icon: Plus,
            variant: 'primary'
          }
        ]}
      />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
          title="Comissões Ganhas"
          value={formatCurrency(totalCommissions)}
          subtitle={`${formatCurrency(totalPendingCommissions)} pendente`}
          icon="💵"
          color="purple"
        />
      </div>

      <div className="border-b border-gray-200 dark:border-blue-500/20">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'metas', label: 'Metas de Vendas', icon: '🎯' },
            { id: 'comissoes', label: 'Comissao por Vendedor', icon: '👥' },
            { id: 'workflows', label: 'Workflows Avancados', icon: '⚡' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-blue-500/30 dark:text-slate-200 dark:hover:border-blue-400/50 dark:hover:text-slate-100'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="crm-card rounded-lg">
        {activeTab === 'metas' && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
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

        {activeTab === 'comissoes' && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Comissao por Vendedor</h2>
              <div className="text-sm text-gray-500 dark:text-slate-200">
                Total ganho: {formatCurrency(totalCommissions)} | Pendentes: {formatCurrency(totalPendingCommissions)} | Pagas: {formatCurrency(totalPaidCommissions)}
              </div>
            </div>
            <ModernTable
              data={teamCommissions}
              columns={commissionsColumns}
              emptyMessage="Nenhuma comissao encontrada"
            />
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Workflows Avancados</h2>
              <button
                onClick={() => {
                  setModalType('workflow');
                  setFormError('');
                  setShowModal(true);
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
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

      <Modal
        isOpen={showModal}
        title={modalType === 'meta' ? 'Nova Meta de Vendas' : 'Novo Workflow'}
        onClose={closeModal}
      >
        {modalType === 'meta' ? (
          <form onSubmit={handleSaveTarget} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-100">
                Vendedor *
              </label>
              <select
                required
                value={formData.sellerId}
                onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um vendedor</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
              {sellers.length === 0 && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-300">
                  Nenhum vendedor disponivel para receber meta.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-100">
                  Meta Valor (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-100">
                  Meta Negocios
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.targetDeals}
                  onChange={(e) => setFormData({ ...formData, targetDeals: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-100">
                  Data Inicio *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-100">
                  Data Fim *
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-100">
                Descricao
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Descricao da meta..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-100">
                Bonus (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.bonusPercentage}
                onChange={(e) => setFormData({ ...formData, bonusPercentage: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 5.0"
              />
            </div>

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 dark:bg-slate-700/60 dark:text-slate-100 dark:hover:bg-slate-600/70"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || sellers.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-slate-200">
              Funcionalidade de criacao de workflows em desenvolvimento...
            </p>
            <div className="flex justify-end">
              <button
                onClick={closeModal}
                className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400 dark:bg-slate-700/60 dark:text-slate-100 dark:hover:bg-slate-600/70"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
