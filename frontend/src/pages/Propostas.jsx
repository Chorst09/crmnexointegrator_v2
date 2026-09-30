import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  Send, 
  Download,
  Calendar,
  DollarSign,
  Package,
  Building2,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const Propostas = () => {
  const [proposals, setProposals] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProposal, setEditingProposal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingProposal, setViewingProposal] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    opportunityId: '',
    templateId: '',
    validUntil: '',
    discount: 0,
    tax: 0,
    items: []
  });

  useEffect(() => {
    fetchProposals();
    fetchOpportunities();
    fetchProducts();
    fetchTemplates();
  }, []);

  const fetchProposals = async () => {
    try {
      const response = await fetch(buildApiUrl('/proposals'), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setProposals(data);
    } catch (error) {
      console.error('Erro ao carregar propostas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const response = await fetch(buildApiUrl('/opportunities'), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setOpportunities(data.filter(opp => opp.stage !== 'WON' && opp.stage !== 'LOST'));
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(buildApiUrl('/products'), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setProducts(data.filter(product => product.active));
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(buildApiUrl('/proposal-templates'), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setTemplates(data.filter(template => template.isActive));
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.opportunityId || formData.items.length === 0) {
      alert('Por favor, preencha todos os campos obrigatórios e adicione pelo menos um item');
      return;
    }

    // Calcular valor total
    const itemsWithTotal = formData.items.map(item => {
      const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      return { ...item, totalPrice: itemTotal };
    });

    const subtotal = itemsWithTotal.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalValue = subtotal * (1 - (formData.discount || 0) / 100) * (1 + (formData.tax || 0) / 100);

    try {
      const url = editingProposal 
        ? buildApiUrl(`/proposals/${editingProposal.id}`)
        : buildApiUrl('/proposals');
      const method = editingProposal ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        items: itemsWithTotal,
        totalValue
      };

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        fetchProposals();
        resetForm();
        alert(editingProposal ? 'Proposta atualizada com sucesso!' : 'Proposta criada com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar proposta');
      }
    } catch (error) {
      console.error('Erro ao salvar proposta:', error);
      alert('Erro ao salvar proposta');
    }
  };

  const resetForm = () => {
    // Buscar template padrão
    const defaultTemplate = templates.find(t => t.isDefault);
    setFormData({
      title: '',
      description: '',
      opportunityId: '',
      templateId: defaultTemplate ? defaultTemplate.id : '',
      validUntil: '',
      discount: 0,
      tax: 0,
      items: []
    });
    setEditingProposal(null);
    setShowForm(false);
  };

  const handleViewProposal = (proposal) => {
    setViewingProposal(proposal);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setViewingProposal(null);
    setShowViewModal(false);
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1, unitPrice: 0, discount: 0 }]
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSendProposal = async (proposalId) => {
    try {
      const response = await fetch(buildApiUrl(`/proposals/${proposalId}/send`), {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        fetchProposals();
        alert('Proposta enviada com sucesso!');
      } else {
        alert('Erro ao enviar proposta');
      }
    } catch (error) {
      console.error('Erro ao enviar proposta:', error);
      alert('Erro ao enviar proposta');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SENT: 'bg-blue-100 text-blue-800',
      VIEWED: 'bg-yellow-100 text-yellow-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      DRAFT: 'Rascunho',
      SENT: 'Enviada',
      VIEWED: 'Visualizada',
      ACCEPTED: 'Aceita',
      REJECTED: 'Rejeitada',
      EXPIRED: 'Expirada'
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status) => {
    const icons = {
      DRAFT: Edit,
      SENT: Send,
      VIEWED: Eye,
      ACCEPTED: CheckCircle2,
      REJECTED: XCircle,
      EXPIRED: AlertCircle
    };
    return icons[status] || Edit;
  };

  // Calcular estatísticas
  const stats = {
    total: proposals.length,
    draft: proposals.filter(p => p.status === 'DRAFT').length,
    sent: proposals.filter(p => p.status === 'SENT').length,
    accepted: proposals.filter(p => p.status === 'ACCEPTED').length,
    totalValue: proposals.reduce((sum, p) => sum + p.totalValue, 0)
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
        title="Propostas e Cotações"
        subtitle="Gerencie propostas comerciais e cotações para seus clientes"
        icon={FileText}
        gradient="blue"
        breadcrumbs={['Vendas & CRM', 'Propostas']}
        actions={[
          {
            label: 'Gerenciar Templates',
            icon: Settings,
            onClick: () => window.location.href = '/templates-propostas',
            variant: 'secondary'
          },
          {
            label: 'Nova Proposta',
            icon: Plus,
            onClick: () => setShowForm(true),
            variant: 'primary'
          }
        ]}
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <AnimatedStats
          title="Total de Propostas"
          value={stats.total}
          subtitle="Todas as propostas"
          icon={FileText}
          color="blue"
          trend={{ direction: 'up', value: '+12% este mês' }}
        />
        
        <AnimatedStats
          title="Rascunhos"
          value={stats.draft}
          subtitle="Aguardando envio"
          icon={Edit}
          color="gray"
        />
        
        <AnimatedStats
          title="Enviadas"
          value={stats.sent}
          subtitle="Aguardando resposta"
          icon={Send}
          color="yellow"
        />
        
        <AnimatedStats
          title="Aceitas"
          value={stats.accepted}
          subtitle="Taxa de conversão"
          icon={CheckCircle2}
          color="green"
          trend={{ direction: 'up', value: `${stats.total > 0 ? ((stats.accepted / stats.total) * 100).toFixed(1) : 0}%` }}
        />
        
        <AnimatedStats
          title="Valor Total"
          value={`R$ ${stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Em propostas"
          icon={DollarSign}
          color="green"
          trend={{ direction: 'up', value: '+25% este mês' }}
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
                placeholder="Buscar por título, empresa ou número..."
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
              <option value="DRAFT">Rascunho</option>
              <option value="SENT">Enviada</option>
              <option value="VIEWED">Visualizada</option>
              <option value="ACCEPTED">Aceita</option>
              <option value="REJECTED">Rejeitada</option>
              <option value="EXPIRED">Expirada</option>
            </select>
          </div>
        </div>
      </GradientCard>

      {/* Modal de Formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingProposal ? 'Editar Proposta' : 'Nova Proposta'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Proposta CRM Premium"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Oportunidade *
                  </label>
                  <select
                    value={formData.opportunityId}
                    onChange={(e) => setFormData(prev => ({ ...prev, opportunityId: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione uma oportunidade</option>
                    {opportunities.map(opp => (
                      <option key={opp.id} value={opp.id}>
                        {opp.title} - {opp.company.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template
                  </label>
                  <select
                    value={formData.templateId}
                    onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Template Padrão</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.isDefault ? '(Padrão)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Escolha um template para definir o layout da proposta
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descreva os detalhes da proposta..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Válida até
                  </label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desconto (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Taxa/Imposto (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.tax}
                    onChange={(e) => setFormData(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Itens da Proposta *</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </button>
                </div>

                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Produto
                      </label>
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const product = products.find(p => p.id === e.target.value);
                          updateItem(index, 'productId', e.target.value);
                          if (product) {
                            updateItem(index, 'unitPrice', product.price);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Selecione um produto</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preço Unit.
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Desc. (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.discount}
                        onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {formData.items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Nenhum item adicionado. Clique em "Adicionar Item" para começar.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {editingProposal ? 'Atualizar' : 'Criar'} Proposta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {showViewModal && viewingProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Cabeçalho Profissional da Proposta */}
            <div className="bg-white border-b border-gray-200">
              {/* Header Superior */}
              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-6">
                    {/* Logo da Empresa */}
                    <div className="flex-shrink-0">
                      {viewingProposal.opportunity.company.logo ? (
                        <img
                          src={viewingProposal.opportunity.company.logo}
                          alt={`Logo ${viewingProposal.opportunity.company.name}`}
                          className="h-16 w-auto max-w-[200px] object-contain bg-white rounded-lg shadow-sm border border-gray-200 p-2"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`h-16 w-32 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center ${viewingProposal.opportunity.company.logo ? 'hidden' : 'flex'}`}
                      >
                        <Building2 className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    
                    {/* Informações da Proposta */}
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        PROPOSTA COMERCIAL
                      </h1>
                      <h2 className="text-xl font-semibold text-blue-600 mb-2">
                        {viewingProposal.title}
                      </h2>
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm font-medium text-gray-600">
                          Nº {viewingProposal.number}
                        </span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm font-medium text-gray-600">
                          Versão {viewingProposal.version}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(viewingProposal.status)}`}>
                          {getStatusLabel(viewingProposal.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={closeViewModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Informações do Cliente e Data */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Cliente</h3>
                    <p className="text-lg font-semibold text-gray-900">{viewingProposal.opportunity.company.name}</p>
                    <p className="text-sm text-gray-600">{viewingProposal.opportunity.company.document}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Data da Proposta</h3>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(viewingProposal.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                    {viewingProposal.validUntil && (
                      <p className="text-sm text-gray-600">
                        Válida até: {new Date(viewingProposal.validUntil).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Responsável</h3>
                    <p className="text-lg font-semibold text-gray-900">{viewingProposal.opportunity.owner.name}</p>
                    <p className="text-sm text-gray-600">{viewingProposal.opportunity.owner.email}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informações da Oportunidade */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-blue-500" />
                  Informações do Cliente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Empresa</label>
                    <p className="text-gray-900 font-medium">{viewingProposal.opportunity.company.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Documento</label>
                    <p className="text-gray-900">{viewingProposal.opportunity.company.document}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Oportunidade</label>
                    <p className="text-gray-900">{viewingProposal.opportunity.title}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Responsável</label>
                    <p className="text-gray-900">{viewingProposal.opportunity.owner.name}</p>
                  </div>
                </div>
              </div>

              {/* Descrição */}
              {viewingProposal.description && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrição</h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{viewingProposal.description}</p>
                </div>
              )}

              {/* Itens da Proposta */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-green-500" />
                  Itens da Proposta
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Produto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantidade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Preço Unit.
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Desconto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewingProposal.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.product.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{item.quantity}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{item.discount}%</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              R$ {item.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumo Financeiro */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-500" />
                  Resumo Financeiro
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Subtotal:</span>
                      <span className="font-medium">
                        R$ {viewingProposal.items.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {viewingProposal.discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Desconto ({viewingProposal.discount}%):</span>
                        <span className="font-medium">
                          - R$ {(viewingProposal.items.reduce((sum, item) => sum + item.totalPrice, 0) * viewingProposal.discount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {viewingProposal.tax > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>Impostos ({viewingProposal.tax}%):</span>
                        <span className="font-medium">
                          + R$ {(viewingProposal.items.reduce((sum, item) => sum + item.totalPrice, 0) * (1 - viewingProposal.discount / 100) * viewingProposal.tax / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="md:text-right">
                    <div className="text-2xl font-bold text-green-600">
                      Total: R$ {viewingProposal.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    {viewingProposal.validUntil && (
                      <div className="text-sm text-gray-600 mt-2 flex items-center justify-end">
                        <Calendar className="w-4 h-4 mr-1" />
                        Válida até: {new Date(viewingProposal.validUntil).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  onClick={closeViewModal}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Fechar
                </button>
                
                {viewingProposal.status === 'DRAFT' && (
                  <button
                    onClick={() => {
                      handleSendProposal(viewingProposal.id);
                      closeViewModal();
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar Proposta
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setEditingProposal(viewingProposal);
                    setFormData({
                      title: viewingProposal.title,
                      description: viewingProposal.description || '',
                      opportunityId: viewingProposal.opportunityId,
                      templateId: viewingProposal.templateId || '',
                      validUntil: viewingProposal.validUntil ? viewingProposal.validUntil.split('T')[0] : '',
                      discount: viewingProposal.discount,
                      tax: viewingProposal.tax,
                      items: viewingProposal.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount
                      }))
                    });
                    closeViewModal();
                    setShowForm(true);
                  }}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
                
                <button
                  onClick={() => alert(`Download da proposta: ${viewingProposal.number}`)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Propostas */}
      <ModernTable
        title="Lista de Propostas"
        data={proposals.filter(proposal => 
          (!searchTerm || 
           proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           proposal.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
           proposal.opportunity.company.name.toLowerCase().includes(searchTerm.toLowerCase())
          ) &&
          (!statusFilter || proposal.status === statusFilter)
        )}
        columns={[
          {
            key: 'number',
            label: 'Número',
            render: (proposal) => (
              <div className="flex items-center">
                <FileText className="w-4 h-4 text-blue-500 mr-2" />
                <div>
                  <div className="font-medium text-gray-900">{proposal.number}</div>
                  <div className="text-sm text-gray-500">v{proposal.version}</div>
                </div>
              </div>
            )
          },
          {
            key: 'title',
            label: 'Título',
            render: (proposal) => (
              <div>
                <div className="font-medium text-gray-900">{proposal.title}</div>
                <div className="text-sm text-gray-500 max-w-xs truncate">
                  {proposal.description}
                </div>
              </div>
            )
          },
          {
            key: 'company',
            label: 'Cliente',
            render: (proposal) => (
              <div className="flex items-center">
                <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                <div>
                  <div className="font-medium text-gray-900">
                    {proposal.opportunity.company.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {proposal.opportunity.title}
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'value',
            label: 'Valor',
            render: (proposal) => (
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 text-green-500 mr-2" />
                <div>
                  <div className="font-bold text-green-600">
                    R$ {proposal.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  {proposal.discount > 0 && (
                    <div className="text-xs text-gray-500">
                      Desc: {proposal.discount}%
                    </div>
                  )}
                </div>
              </div>
            )
          },
          {
            key: 'status',
            label: 'Status',
            render: (proposal) => {
              const StatusIcon = getStatusIcon(proposal.status);
              return (
                <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(proposal.status)}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {getStatusLabel(proposal.status)}
                </span>
              );
            }
          },
          {
            key: 'validUntil',
            label: 'Válida até',
            render: (proposal) => (
              proposal.validUntil ? (
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">
                    {new Date(proposal.validUntil).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">-</span>
              )
            )
          },
          {
            key: 'owner',
            label: 'Responsável',
            render: (proposal) => (
              <div className="flex items-center">
                <User className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">
                  {proposal.opportunity.owner.name}
                </span>
              </div>
            )
          }
        ]}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onView={handleViewProposal}
        onEdit={(proposal) => {
          setEditingProposal(proposal);
          setFormData({
            title: proposal.title,
            description: proposal.description || '',
            opportunityId: proposal.opportunityId,
            templateId: proposal.templateId || '',
            validUntil: proposal.validUntil ? proposal.validUntil.split('T')[0] : '',
            discount: proposal.discount,
            tax: proposal.tax,
            items: proposal.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount
            }))
          });
          setShowForm(true);
        }}
        customActions={[
          {
            label: 'Enviar',
            icon: Send,
            onClick: (proposal) => {
              if (proposal.status === 'DRAFT') {
                handleSendProposal(proposal.id);
              } else {
                alert('Apenas propostas em rascunho podem ser enviadas');
              }
            },
            condition: (proposal) => proposal.status === 'DRAFT'
          },
          {
            label: 'Download',
            icon: Download,
            onClick: (proposal) => alert(`Download da proposta: ${proposal.number}`)
          }
        ]}
        emptyState={
          <div>
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma proposta encontrada</h3>
            <p className="text-gray-500">Comece criando sua primeira proposta comercial</p>
          </div>
        }
      />
    </div>
  );
};

export default Propostas;