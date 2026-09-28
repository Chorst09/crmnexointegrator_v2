import { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings, 
  Bell, 
  Play, 
  Plus, 
  Mail, 
  MessageCircle, 
  CheckCircle, 
  AlertCircle,
  Target,
  Users,
  Calendar,
  Activity,
  Settings as Workflow,
  Zap as Bot,
  TrendingUp,
  Eye
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const Automacoes = () => {
  const [activeTab, setActiveTab] = useState('workflows');
  const [workflows, setWorkflows] = useState([]);
  const [automationRules, setAutomationRules] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para modais
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewAutomation, setPreviewAutomation] = useState(null);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  
  // Estados para formulários
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    description: '',
    trigger: 'LEAD_CREATED',
    conditions: [],
    actions: [],
    active: true,
    priority: 'MEDIUM'
  });
  
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    type: 'LEAD_DISTRIBUTION',
    schedule: 'IMMEDIATE',
    conditions: {},
    actions: {},
    active: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [workflowsRes, rulesRes, notificationsRes] = await Promise.all([
        fetch(buildApiUrl('/workflows'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/workflows/automation-rules'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/workflows/notifications'), { headers: getAuthHeaders() })
      ]);

      if (workflowsRes.ok) {
        const data = await workflowsRes.json();
        setWorkflows(data.workflows || []);
      }

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setAutomationRules(data.rules || []);
      }

      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications(data.notifications || []);
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

  const executeWorkflow = async (workflowId) => {
    try {
      const response = await fetch(buildApiUrl(`/workflows/${workflowId}/execute`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ triggerData: {} })
      });

      if (response.ok) {
        alert('Workflow executado com sucesso!');
        fetchData();
      } else {
        alert('Erro ao executar workflow');
      }
    } catch (error) {
      console.error('Erro ao executar workflow:', error);
      alert('Erro de conexão');
    }
  };

  const executeAutomationRules = async () => {
    try {
      const response = await fetch(buildApiUrl('/workflows/automation-rules/execute-pending'), {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchData();
      } else {
        alert('Erro ao executar automações');
      }
    } catch (error) {
      console.error('Erro ao executar automações:', error);
      alert('Erro de conexão');
    }
  };

  const getStatusColor = (status, type = 'default') => {
    const colors = {
      execution: {
        PENDING: 'bg-yellow-100 text-yellow-800',
        RUNNING: 'bg-blue-100 text-blue-800',
        COMPLETED: 'bg-green-100 text-green-800',
        FAILED: 'bg-red-100 text-red-800'
      },
      notification: {
        PENDING: 'bg-yellow-100 text-yellow-800',
        SENT: 'bg-green-100 text-green-800',
        DELIVERED: 'bg-blue-100 text-blue-800',
        READ: 'bg-gray-100 text-gray-800',
        FAILED: 'bg-red-100 text-red-800'
      }
    };
    return colors[type]?.[status] || 'bg-gray-100 text-gray-800';
  };

  const getTriggerIcon = (trigger) => {
    const icons = {
      LEAD_CREATED: Users,
      OPPORTUNITY_WON: Target,
      CONTRACT_SIGNED: CheckCircle,
      SUPPORT_TICKET: AlertCircle,
      NPS_LOW_SCORE: AlertCircle,
      CHURN_RISK: AlertCircle,
      MANUAL: Play
    };
    return icons[trigger] || Zap;
  };

  const getChannelIcon = (channel) => {
    const icons = {
      EMAIL: Mail,
      WHATSAPP: MessageCircle,
      SMS: MessageCircle,
      PUSH: Bell,
      IN_APP: Bell
    };
    return icons[channel] || Bell;
  };

  const openModal = (type) => {
    if (type === 'workflow') {
      setShowWorkflowModal(true);
      setEditingWorkflow(null);
      setWorkflowForm({
        name: '',
        description: '',
        trigger: 'LEAD_CREATED',
        conditions: [],
        actions: [],
        active: true,
        priority: 'MEDIUM'
      });
    } else if (type === 'rule') {
      setShowRuleModal(true);
      setEditingRule(null);
      setRuleForm({
        name: '',
        description: '',
        type: 'LEAD_DISTRIBUTION',
        schedule: 'IMMEDIATE',
        conditions: {},
        actions: {},
        active: true
      });
    }
  };

  const closeModals = () => {
    setShowWorkflowModal(false);
    setShowRuleModal(false);
    setShowPreviewModal(false);
    setPreviewAutomation(null);
    setEditingWorkflow(null);
    setEditingRule(null);
  };

  const handleWorkflowSubmit = async (e) => {
    e.preventDefault();
    
    if (!workflowForm.name || !workflowForm.description) {
      alert('Nome e descrição são obrigatórios');
      return;
    }

    try {
      const url = editingWorkflow 
        ? buildApiUrl(`/advanced-workflows/${editingWorkflow.id}`)
        : buildApiUrl('/advanced-workflows');
      const method = editingWorkflow ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...workflowForm,
          type: 'CONDITIONAL',
          category: 'SALES'
        })
      });

      if (response.ok) {
        alert(editingWorkflow ? 'Workflow atualizado com sucesso!' : 'Workflow criado com sucesso!');
        closeModals();
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar workflow');
      }
    } catch (error) {
      console.error('Erro ao salvar workflow:', error);
      alert('Erro de conexão');
    }
  };

  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    
    if (!ruleForm.name || !ruleForm.description) {
      alert('Nome e descrição são obrigatórios');
      return;
    }

    try {
      const url = editingRule 
        ? buildApiUrl(`/workflows/automation-rules/${editingRule.id}`)
        : buildApiUrl('/workflows/automation-rules');
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(ruleForm)
      });

      if (response.ok) {
        alert(editingRule ? 'Regra atualizada com sucesso!' : 'Regra criada com sucesso!');
        closeModals();
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar regra');
      }
    } catch (error) {
      console.error('Erro ao salvar regra:', error);
      alert('Erro de conexão');
    }
  };

  const addCondition = (formType) => {
    if (formType === 'workflow') {
      setWorkflowForm(prev => ({
        ...prev,
        conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }]
      }));
    }
  };

  const addAction = (formType) => {
    if (formType === 'workflow') {
      setWorkflowForm(prev => ({
        ...prev,
        actions: [...prev.actions, { type: 'CREATE_ACTIVITY', config: {} }]
      }));
    }
  };

  const removeCondition = (formType, index) => {
    if (formType === 'workflow') {
      setWorkflowForm(prev => ({
        ...prev,
        conditions: prev.conditions.filter((_, i) => i !== index)
      }));
    }
  };

  const removeAction = (formType, index) => {
    if (formType === 'workflow') {
      setWorkflowForm(prev => ({
        ...prev,
        actions: prev.actions.filter((_, i) => i !== index)
      }));
    }
  };

  const updateCondition = (formType, index, field, value) => {
    if (formType === 'workflow') {
      setWorkflowForm(prev => ({
        ...prev,
        conditions: prev.conditions.map((condition, i) => 
          i === index ? { ...condition, [field]: value } : condition
        )
      }));
    }
  };

  const updateAction = (formType, index, field, value) => {
    if (formType === 'workflow') {
      setWorkflowForm(prev => ({
        ...prev,
        actions: prev.actions.map((action, i) => 
          i === index ? { ...action, [field]: value } : action
        )
      }));
    }
  };

  const configurePresetAutomation = (automationType) => {
    const presetConfigs = {
      'Distribuição Automática de Leads': {
        name: 'Distribuição Automática de Leads',
        description: 'Distribui novos leads automaticamente para vendedores baseado em critérios inteligentes',
        trigger: 'LEAD_CREATED',
        triggerLabel: 'Novo Lead Criado',
        conditions: [
          { field: 'lead.score', operator: 'greater_than', value: '50', label: 'Score do Lead > 50' }
        ],
        actions: [
          { type: 'ASSIGN_LEAD', config: { strategy: 'round_robin' }, label: 'Atribuir Lead (Round Robin)' }
        ],
        active: true,
        priority: 'HIGH',
        benefits: ['Distribuição justa entre vendedores', 'Resposta rápida a novos leads', 'Aumento da conversão']
      },
      'Follow-up Automático': {
        name: 'Follow-up Automático',
        description: 'Cria atividades de follow-up para oportunidades sem atividade recente',
        trigger: 'MANUAL',
        triggerLabel: 'Execução Manual/Agendada',
        conditions: [
          { field: 'opportunity.lastActivity', operator: 'less_than', value: '3', label: 'Sem atividade há 3+ dias' }
        ],
        actions: [
          { type: 'CREATE_ACTIVITY', config: { subject: 'Follow-up necessário', type: 'CALL' }, label: 'Criar Tarefa de Ligação' }
        ],
        active: true,
        priority: 'MEDIUM',
        benefits: ['Nunca perde um follow-up', 'Melhora relacionamento com clientes', 'Aumenta taxa de fechamento']
      },
      'Notificações de Email': {
        name: 'Notificações de Email',
        description: 'Envia emails automáticos baseados em eventos do sistema',
        trigger: 'OPPORTUNITY_WON',
        triggerLabel: 'Oportunidade Ganha',
        conditions: [],
        actions: [
          { type: 'SEND_EMAIL', config: { template: 'congratulations', subject: 'Parabéns pela venda!' }, label: 'Enviar E-mail de Parabéns' }
        ],
        active: true,
        priority: 'MEDIUM',
        benefits: ['Comunicação automática', 'Melhora experiência do cliente', 'Economiza tempo da equipe']
      },
      'Alertas de WhatsApp': {
        name: 'Alertas de WhatsApp',
        description: 'Envia mensagens WhatsApp para eventos importantes e urgentes',
        trigger: 'SUPPORT_TICKET',
        triggerLabel: 'Ticket de Suporte Criado',
        conditions: [
          { field: 'ticket.priority', operator: 'equals', value: 'URGENT', label: 'Prioridade = Urgente' }
        ],
        actions: [
          { type: 'SEND_WHATSAPP', config: { message: 'Ticket urgente criado: {{ticket.title}}' }, label: 'Enviar WhatsApp para Gerente' }
        ],
        active: true,
        priority: 'URGENT',
        benefits: ['Resposta imediata a urgências', 'Melhora SLA de suporte', 'Comunicação eficiente']
      },
      'Criação de Tarefas': {
        name: 'Criação de Tarefas',
        description: 'Cria tarefas automaticamente baseado em condições específicas',
        trigger: 'CONTRACT_SIGNED',
        triggerLabel: 'Contrato Assinado',
        conditions: [],
        actions: [
          { type: 'CREATE_ACTIVITY', config: { subject: 'Iniciar onboarding do cliente', type: 'TASK' }, label: 'Criar Tarefa de Onboarding' }
        ],
        active: true,
        priority: 'HIGH',
        benefits: ['Processo padronizado', 'Nada é esquecido', 'Onboarding mais eficiente']
      },
      'Detecção de Churn': {
        name: 'Detecção de Churn',
        description: 'Identifica clientes com risco de cancelamento usando IA',
        trigger: 'CHURN_RISK',
        triggerLabel: 'Risco de Churn Detectado',
        conditions: [
          { field: 'churn.riskLevel', operator: 'equals', value: 'HIGH', label: 'Risco Alto de Churn' }
        ],
        actions: [
          { type: 'CREATE_NOTIFICATION', config: { message: 'Cliente com alto risco de churn detectado' }, label: 'Criar Notificação de Alerta' },
          { type: 'CREATE_ACTIVITY', config: { subject: 'Ação preventiva de churn', type: 'CALL' }, label: 'Criar Tarefa Preventiva' }
        ],
        active: true,
        priority: 'URGENT',
        benefits: ['Prevenção proativa de churn', 'Retenção de clientes', 'Aumento do LTV']
      }
    };

    const config = presetConfigs[automationType];
    if (config) {
      setPreviewAutomation(config);
      setShowPreviewModal(true);
    } else {
      alert('Configuração não encontrada para esta automação');
    }
  };

  const confirmPresetConfiguration = () => {
    if (previewAutomation) {
      setWorkflowForm(previewAutomation);
      setShowPreviewModal(false);
      setShowWorkflowModal(true);
      setEditingWorkflow(null);
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
        title="Centro de Automações"
        subtitle="Otimize processos com workflows inteligentes, regras automatizadas e notificações personalizadas"
        icon={Bot}
        gradient="purple"
        breadcrumbs={['CRM', 'Automações']}
        actions={[
          {
            label: 'Executar Automações',
            icon: Play,
            onClick: executeAutomationRules,
            variant: 'secondary'
          },
          {
            label: 'Novo Workflow',
            icon: Plus,
            onClick: () => openModal('workflow'),
            variant: 'secondary'
          },
          {
            label: 'Nova Regra',
            icon: Plus,
            onClick: () => openModal('rule'),
            variant: 'primary'
          }
        ]}
      />

      {/* Métricas Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Workflows Ativos"
          value={workflows.filter(w => w.active).length}
          subtitle={`${workflows.length} total`}
          icon={Workflow}
          color="blue"
          trend={{ direction: 'up', value: '+3 este mês' }}
        />
        
        <AnimatedStats
          title="Regras Ativas"
          value={automationRules.filter(r => r.active).length}
          subtitle={`${automationRules.length} total`}
          icon={Settings}
          color="green"
          trend={{ direction: 'up', value: '+2 esta semana' }}
        />
        
        <AnimatedStats
          title="Notificações Hoje"
          value={notifications.filter(n => {
            const today = new Date().toDateString();
            return new Date(n.createdAt).toDateString() === today;
          }).length}
          subtitle={`${notifications.filter(n => n.status === 'SENT').length} enviadas`}
          icon={Bell}
          color="yellow"
          trend={{ direction: 'up', value: '+15% hoje' }}
        />
        
        <AnimatedStats
          title="Taxa de Sucesso"
          value="95"
          suffix="%"
          subtitle="Últimas 24h"
          icon={TrendingUp}
          color="purple"
          trend={{ direction: 'up', value: '+2% esta semana' }}
        />
      </div>

      {/* Tabs */}
      <GradientCard gradient="gray" className="shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'workflows', label: 'Workflows', icon: Workflow, count: workflows.length, color: 'blue' },
              { id: 'rules', label: 'Regras de Automação', icon: Settings, count: automationRules.length, color: 'green' },
              { id: 'notifications', label: 'Notificações', icon: Bell, count: notifications.length, color: 'yellow' }
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
                         'border-yellow-500 text-yellow-600 bg-yellow-50')
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-3 rounded-t-xl transition-all duration-200 hover:bg-gray-50`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    activeTab === tab.id 
                      ? (tab.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                         tab.color === 'green' ? 'bg-green-100 text-green-700' :
                         'bg-yellow-100 text-yellow-700')
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
          {/* Tab Workflows */}
          {activeTab === 'workflows' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Workflows Automatizados</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {workflows.filter(w => w.active).length} de {workflows.length} workflows ativos
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflows.map((workflow) => {
                  const TriggerIcon = getTriggerIcon(workflow.trigger);
                  
                  return (
                    <GradientCard 
                      key={workflow.id} 
                      gradient="blue" 
                      className="p-6 hover:shadow-xl transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start">
                          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mr-4 shadow-lg">
                            <TriggerIcon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900 mb-1">{workflow.name}</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">{workflow.description}</p>
                          </div>
                        </div>
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          workflow.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {workflow.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                          <span className="text-sm text-gray-600">Trigger:</span>
                          <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                            {workflow.trigger}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-white/50 rounded-lg">
                            <div className="text-lg font-bold text-gray-900">
                              {workflow._count?.executions || 0}
                            </div>
                            <div className="text-xs text-gray-600">Execuções</div>
                          </div>
                          <div className="text-center p-3 bg-white/50 rounded-lg">
                            <div className="text-lg font-bold text-gray-900">
                              {workflow.actions?.length || 0}
                            </div>
                            <div className="text-xs text-gray-600">Ações</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => executeWorkflow(workflow.id)}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl text-sm font-medium hover:from-blue-700 hover:to-blue-800 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          <Play className="w-4 h-4" />
                          Executar
                        </button>
                        <button className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-3 rounded-xl text-sm font-medium hover:from-gray-700 hover:to-gray-800 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl">
                          <Settings className="w-4 h-4" />
                          Editar
                        </button>
                      </div>
                    </GradientCard>
                  );
                })}
              </div>

              {workflows.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Workflow className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum workflow encontrado</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Comece criando seu primeiro workflow automatizado para otimizar seus processos
                  </p>
                  <button
                    onClick={() => openModal('workflow')}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    Criar Primeiro Workflow
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab Regras de Automação */}
          {activeTab === 'rules' && (
            <ModernTable
              title="Regras de Automação"
              data={automationRules.filter(item => 
                !searchTerm || 
                item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchTerm.toLowerCase())
              )}
              columns={[
                {
                  key: 'name',
                  label: 'Nome',
                  render: (item) => (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">{item.description}</div>
                    </div>
                  )
                },
                {
                  key: 'type',
                  label: 'Tipo',
                  render: (item) => (
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {item.type}
                    </span>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.active ? 'Ativo' : 'Inativo'}
                    </span>
                  )
                },
                {
                  key: 'lastRun',
                  label: 'Última Execução',
                  render: (item) => (
                    <div className="flex items-center">
                      <Activity className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {item.lastRun 
                          ? new Date(item.lastRun).toLocaleString('pt-BR')
                          : 'Nunca'
                        }
                      </span>
                    </div>
                  )
                },
                {
                  key: 'nextRun',
                  label: 'Próxima Execução',
                  render: (item) => (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {item.nextRun 
                          ? new Date(item.nextRun).toLocaleString('pt-BR')
                          : 'Sob demanda'
                        }
                      </span>
                    </div>
                  )
                }
              ]}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onView={(item) => alert(`Ver detalhes da regra: ${item.name}`)}
              onEdit={(item) => alert(`Editar regra: ${item.name}`)}
              customActions={[
                {
                  label: 'Executar Agora',
                  icon: Play,
                  onClick: (item) => alert(`Executar regra: ${item.name}`)
                },
                {
                  label: 'Duplicar',
                  icon: Settings,
                  onClick: (item) => alert(`Duplicar regra: ${item.name}`)
                }
              ]}
              emptyState={
                <div>
                  <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma regra encontrada</h3>
                  <p className="text-gray-500">Crie regras de automação para otimizar seus processos</p>
                </div>
              }
            />
          )}

          {/* Tab Notificações */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Central de Notificações</h3>
                <p className="text-sm text-gray-600 mt-1">Histórico de todas as notificações enviadas pelo sistema</p>
              </div>
              
              <div className="space-y-4">
                {notifications.map((notification) => {
                  const ChannelIcon = getChannelIcon(notification.channel);
                  
                  return (
                    <GradientCard 
                      key={notification.id} 
                      gradient="gray" 
                      className="p-6 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start flex-1">
                          <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl mr-4">
                            <ChannelIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <h4 className="text-lg font-semibold text-gray-900">{notification.title}</h4>
                              <span className={`ml-3 inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(notification.status, 'notification')}`}>
                                {notification.status === 'SENT' ? 'Enviado' :
                                 notification.status === 'DELIVERED' ? 'Entregue' :
                                 notification.status === 'READ' ? 'Lido' :
                                 notification.status === 'FAILED' ? 'Falhou' : 'Pendente'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-3 leading-relaxed">{notification.message}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center">
                                <span className="font-medium">Canal:</span>
                                <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                  {notification.channel}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <span className="font-medium">Tipo:</span>
                                <span className="ml-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                                  {notification.type}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                <span>{new Date(notification.createdAt).toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          {notification.sentAt && (
                            <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Enviado
                            </div>
                          )}
                          {notification.readAt && (
                            <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                              <Eye className="w-3 h-3 mr-1" />
                              Lido
                            </div>
                          )}
                        </div>
                      </div>
                    </GradientCard>
                  );
                })}
              </div>

              {notifications.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Bell className="w-10 h-10 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma notificação encontrada</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    As notificações enviadas pelo sistema aparecerão aqui
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </GradientCard>

      {/* Seção de Automações Pré-configuradas */}
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 rounded-2xl p-8 border border-blue-200 shadow-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-3">Automações Pré-configuradas</h3>
          <p className="text-gray-600 text-lg">Templates prontos para usar - configure em poucos cliques</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Distribuição Automática de Leads',
              description: 'Distribui novos leads automaticamente para vendedores baseado em critérios inteligentes',
              icon: Users,
              gradient: 'blue',
              features: ['Round Robin', 'Por Região', 'Por Score'],
              popular: true
            },
            {
              title: 'Follow-up Automático',
              description: 'Cria atividades de follow-up para oportunidades sem atividade recente',
              icon: Calendar,
              gradient: 'green',
              features: ['Lembretes', 'Tarefas', 'Emails']
            },
            {
              title: 'Notificações de Email',
              description: 'Envia emails automáticos baseados em eventos do sistema',
              icon: Mail,
              gradient: 'purple',
              features: ['Templates', 'Personalização', 'Agendamento']
            },
            {
              title: 'Alertas de WhatsApp',
              description: 'Envia mensagens WhatsApp para eventos importantes e urgentes',
              icon: MessageCircle,
              gradient: 'green',
              features: ['Instantâneo', 'Templates', 'Grupos']
            },
            {
              title: 'Criação de Tarefas',
              description: 'Cria tarefas automaticamente baseado em condições específicas',
              icon: CheckCircle,
              gradient: 'orange',
              features: ['Condições', 'Prioridades', 'Atribuição']
            },
            {
              title: 'Detecção de Churn',
              description: 'Identifica clientes com risco de cancelamento usando IA',
              icon: AlertCircle,
              gradient: 'red',
              features: ['IA Avançada', 'Alertas', 'Prevenção'],
              new: true
            }
          ].map((automation, index) => {
            const Icon = automation.icon;
            return (
              <GradientCard 
                key={index} 
                gradient={automation.gradient} 
                className="p-6 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
              >
                {automation.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 text-xs font-semibold rounded-bl-xl shadow-lg">
                    ⭐ Popular
                  </div>
                )}
                {automation.new && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-green-600 to-green-700 text-white px-3 py-1 text-xs font-semibold rounded-bl-xl shadow-lg">
                    ✨ Novo
                  </div>
                )}
                
                <div className="flex items-start mb-4">
                  <div className={`p-4 rounded-xl mr-4 shadow-lg ${
                  automation.gradient === 'blue' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                  automation.gradient === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                  automation.gradient === 'purple' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                  automation.gradient === 'orange' ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
                  'bg-gradient-to-br from-red-500 to-red-600'
                }`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{automation.title}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{automation.description}</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex flex-wrap gap-2">
                    {automation.features.map((feature, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white/70 text-gray-700 text-xs font-medium rounded-full border border-gray-200">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={() => configurePresetAutomation(automation.title)}
                  className={`w-full text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl ${
                  automation.gradient === 'blue' ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' :
                  automation.gradient === 'green' ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' :
                  automation.gradient === 'purple' ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800' :
                  automation.gradient === 'orange' ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800' :
                  'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                }`}>
                  <Settings className="w-4 h-4" />
                  Configurar Automação
                </button>
              </GradientCard>
            );
          })}
        </div>
      </div>

      {/* Modal Preview Automação */}
      {showPreviewModal && previewAutomation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                Preview: {previewAutomation.name}
              </h2>
              <p className="text-gray-600 mt-1">
                Revise as configurações antes de criar esta automação
              </p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-500" />
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nome</label>
                    <p className="text-gray-900 font-medium">{previewAutomation.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prioridade</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      previewAutomation.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                      previewAutomation.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {previewAutomation.priority === 'URGENT' ? 'Urgente' :
                       previewAutomation.priority === 'HIGH' ? 'Alta' : 'Média'}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <p className="text-gray-900">{previewAutomation.description}</p>
                </div>
              </div>

              {/* Trigger */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                  Evento Disparador
                </h3>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-200 rounded-lg">
                    <Zap className="w-4 h-4 text-yellow-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{previewAutomation.triggerLabel}</p>
                    <p className="text-sm text-gray-600">Quando este evento ocorrer, o workflow será executado</p>
                  </div>
                </div>
              </div>

              {/* Condições */}
              {previewAutomation.conditions.length > 0 && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
                    Condições
                  </h3>
                  <div className="space-y-2">
                    {previewAutomation.conditions.map((condition, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200">
                        <div className="p-1 bg-orange-200 rounded">
                          <AlertCircle className="w-3 h-3 text-orange-700" />
                        </div>
                        <span className="text-gray-900">{condition.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Play className="w-5 h-5 mr-2 text-green-500" />
                  Ações a Executar
                </h3>
                <div className="space-y-2">
                  {previewAutomation.actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
                      <div className="p-1 bg-green-200 rounded">
                        <Play className="w-3 h-3 text-green-700" />
                      </div>
                      <span className="text-gray-900">{action.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Benefícios */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-purple-500" />
                  Benefícios Esperados
                </h3>
                <ul className="space-y-2">
                  {previewAutomation.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-gray-900">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                
                <button
                  onClick={confirmPresetConfiguration}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Configurar Automação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Workflow */}
      {showWorkflowModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingWorkflow ? 'Editar Workflow' : 'Novo Workflow'}
              </h2>
              <p className="text-gray-600 mt-1">
                Configure um workflow automatizado para otimizar seus processos
              </p>
            </div>
            
            <form onSubmit={handleWorkflowSubmit} className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-500" />
                  Informações Básicas
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Workflow *
                    </label>
                    <input
                      type="text"
                      value={workflowForm.name}
                      onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Distribuição Automática de Leads"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prioridade
                    </label>
                    <select
                      value={workflowForm.priority}
                      onChange={(e) => setWorkflowForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="LOW">Baixa</option>
                      <option value="MEDIUM">Média</option>
                      <option value="HIGH">Alta</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição *
                  </label>
                  <textarea
                    value={workflowForm.description}
                    onChange={(e) => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
                    required
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descreva o que este workflow faz..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="workflowActive"
                    checked={workflowForm.active}
                    onChange={(e) => setWorkflowForm(prev => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="workflowActive" className="ml-2 block text-sm text-gray-900">
                    Ativar workflow imediatamente
                  </label>
                </div>
              </div>

              {/* Trigger */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                  Evento Disparador
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quando executar este workflow?
                  </label>
                  <select
                    value={workflowForm.trigger}
                    onChange={(e) => setWorkflowForm(prev => ({ ...prev, trigger: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="LEAD_CREATED">Novo Lead Criado</option>
                    <option value="OPPORTUNITY_WON">Oportunidade Ganha</option>
                    <option value="CONTRACT_SIGNED">Contrato Assinado</option>
                    <option value="SUPPORT_TICKET">Ticket de Suporte</option>
                    <option value="NPS_LOW_SCORE">NPS Baixo</option>
                    <option value="CHURN_RISK">Risco de Churn</option>
                    <option value="MANUAL">Execução Manual</option>
                  </select>
                </div>
              </div>

              {/* Condições */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
                    Condições (Opcional)
                  </h3>
                  <button
                    type="button"
                    onClick={() => addCondition('workflow')}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Condição
                  </button>
                </div>

                {workflowForm.conditions.map((condition, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-orange-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Campo</label>
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition('workflow', index, 'field', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="">Selecione...</option>
                        <option value="company.size">Tamanho da Empresa</option>
                        <option value="opportunity.value">Valor da Oportunidade</option>
                        <option value="lead.score">Score do Lead</option>
                        <option value="user.region">Região do Vendedor</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Operador</label>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition('workflow', index, 'operator', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="equals">Igual a</option>
                        <option value="not_equals">Diferente de</option>
                        <option value="greater_than">Maior que</option>
                        <option value="less_than">Menor que</option>
                        <option value="contains">Contém</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition('workflow', index, 'value', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Valor da condição"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => removeCondition('workflow', index)}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              {/* Ações */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Play className="w-5 h-5 mr-2 text-green-500" />
                    Ações a Executar
                  </h3>
                  <button
                    type="button"
                    onClick={() => addAction('workflow')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Ação
                  </button>
                </div>

                {workflowForm.actions.map((action, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 bg-green-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ação</label>
                      <select
                        value={action.type}
                        onChange={(e) => updateAction('workflow', index, 'type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="CREATE_ACTIVITY">Criar Atividade</option>
                        <option value="SEND_EMAIL">Enviar E-mail</option>
                        <option value="SEND_WHATSAPP">Enviar WhatsApp</option>
                        <option value="ASSIGN_LEAD">Atribuir Lead</option>
                        <option value="UPDATE_FIELD">Atualizar Campo</option>
                        <option value="CREATE_NOTIFICATION">Criar Notificação</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Configuração</label>
                      <input
                        type="text"
                        value={action.config?.message || ''}
                        onChange={(e) => updateAction('workflow', index, 'config', { ...action.config, message: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Configuração da ação"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => removeAction('workflow', index)}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                ))}

                {workflowForm.actions.length === 0 && (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <Play className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Nenhuma ação configurada. Adicione pelo menos uma ação.</p>
                  </div>
                )}
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {editingWorkflow ? 'Atualizar' : 'Criar'} Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Regra */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingRule ? 'Editar Regra' : 'Nova Regra de Automação'}
              </h2>
              <p className="text-gray-600 mt-1">
                Configure uma regra de automação para executar ações recorrentes
              </p>
            </div>
            
            <form onSubmit={handleRuleSubmit} className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-green-500" />
                  Informações Básicas
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome da Regra *
                    </label>
                    <input
                      type="text"
                      value={ruleForm.name}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Ex: Follow-up Automático"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Regra
                    </label>
                    <select
                      value={ruleForm.type}
                      onChange={(e) => setRuleForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="LEAD_DISTRIBUTION">Distribuição de Leads</option>
                      <option value="FOLLOW_UP">Follow-up Automático</option>
                      <option value="TASK_CREATION">Criação de Tarefas</option>
                      <option value="NOTIFICATION">Notificações</option>
                      <option value="DATA_UPDATE">Atualização de Dados</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrição *
                  </label>
                  <textarea
                    value={ruleForm.description}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                    required
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Descreva o que esta regra faz..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agendamento
                  </label>
                  <select
                    value={ruleForm.schedule}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, schedule: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="IMMEDIATE">Imediato</option>
                    <option value="HOURLY">A cada hora</option>
                    <option value="DAILY">Diário</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensal</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ruleActive"
                    checked={ruleForm.active}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="ruleActive" className="ml-2 block text-sm text-gray-900">
                    Ativar regra imediatamente
                  </label>
                </div>
              </div>

              {/* Configurações Específicas */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-purple-500" />
                  Configurações Específicas
                </h3>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-700 mb-3">
                    Configure as condições e ações específicas para esta regra:
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Condição Principal
                      </label>
                      <input
                        type="text"
                        value={ruleForm.conditions.main || ''}
                        onChange={(e) => setRuleForm(prev => ({ 
                          ...prev, 
                          conditions: { ...prev.conditions, main: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Ex: leads sem atividade há 3 dias"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ação Principal
                      </label>
                      <input
                        type="text"
                        value={ruleForm.actions.main || ''}
                        onChange={(e) => setRuleForm(prev => ({ 
                          ...prev, 
                          actions: { ...prev.actions, main: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Ex: criar tarefa de follow-up"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  {editingRule ? 'Atualizar' : 'Criar'} Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automacoes;