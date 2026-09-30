import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit,
  ExternalLink,
  Key,
  Link2,
  Mail,
  PhoneCall,
  PlugZap,
  Plus,
  RefreshCcw,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Webhook,
  XCircle,
  Zap
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import Modal from '../components/Modal';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

// ─── CRM Platforms ────────────────────────────────────────────────────────────
const CRM_PLATFORMS = [
  {
    id: 'zoho',
    name: 'Zoho CRM',
    description: 'Sincronize contatos, leads, oportunidades e atividades com o Zoho CRM.',
    logo: '🟠',
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    badgeColor: 'bg-orange-500/20 text-orange-300',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v6/',
    features: ['Contatos e Leads', 'Oportunidades', 'Atividades', 'Relatórios'],
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: '1000.XXXXXXXX' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Seu client secret' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password', placeholder: 'Obtido via OAuth' },
      { key: 'orgId', label: 'Org ID', type: 'text', placeholder: 'ID da organização Zoho' },
    ]
  },
  {
    id: 'bitrix24',
    name: 'Bitrix24',
    description: 'Integre com o Bitrix24 para sincronizar CRM, tarefas e comunicações.',
    logo: '🔵',
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    badgeColor: 'bg-blue-500/20 text-blue-300',
    docsUrl: 'https://training.bitrix24.com/rest_help/',
    features: ['Leads e Negócios', 'Contatos e Empresas', 'Tarefas', 'Webhooks'],
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', placeholder: 'https://seudominio.bitrix24.com.br/rest/1/XXXXX/' },
      { key: 'userId', label: 'User ID', type: 'text', placeholder: 'ID do usuário Bitrix24' },
    ]
  },
  {
    id: 'totvs',
    name: 'TOTVS',
    description: 'Receba leads e cadastros comerciais vindos do ERP TOTVS no B2B Lead Management.',
    logo: '🟣',
    color: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
    badgeColor: 'bg-violet-500/20 text-violet-300',
    docsUrl: 'https://tdn.totvs.com/',
    features: ['Clientes e Leads', 'Dados fiscais', 'CNPJ e cadastro', 'Sincronização via API'],
    fields: [
      { key: 'apiBaseUrl', label: 'Base URL', type: 'url', placeholder: 'https://api.seuerp.com.br' },
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Token de integração TOTVS' },
      { key: 'companyCode', label: 'Código Empresa', type: 'text', placeholder: 'Filial/empresa no ERP' },
    ]
  },
  {
    id: 'ixc',
    name: 'IXC Software',
    description: 'Integre com o IXC para sincronizar clientes, contratos e dados comerciais no CRM.',
    logo: '🔷',
    color: 'from-cyan-500/20 to-sky-600/10 border-cyan-500/30',
    badgeColor: 'bg-cyan-500/20 text-cyan-300',
    docsUrl: 'https://wiki.ixcsoft.com.br/',
    features: ['Clientes e contratos', 'Planos e serviços', 'Status financeiro', 'Sincronização via API'],
    fields: [
      { key: 'apiBaseUrl', label: 'Base URL', type: 'url', placeholder: 'https://seu-ixc.dominio.com.br/webservice/v1' },
      { key: 'apiUser', label: 'Usuário API', type: 'text', placeholder: 'Usuário de integração IXC' },
      { key: 'apiPassword', label: 'Senha API', type: 'password', placeholder: 'Senha do usuário API IXC' },
      { key: 'apiToken', label: 'Token/API Key', type: 'password', placeholder: 'Token de integração IXC' },
      { key: 'tenantCode', label: 'Código da Empresa', type: 'text', placeholder: 'Identificador da unidade/tenant no IXC' },
      { key: 'defaultServiceType', label: 'Tipo Serviço Padrão', type: 'text', placeholder: 'Ex.: INTERNET, SCM, FIBRA' },
    ]
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Conecte com o Pipedrive para sincronizar pipeline, contatos e negócios.',
    logo: '🟢',
    color: 'from-green-500/20 to-green-600/10 border-green-500/30',
    badgeColor: 'bg-green-500/20 text-green-300',
    docsUrl: 'https://developers.pipedrive.com/docs/api/v1',
    features: ['Pipeline de Vendas', 'Contatos', 'Negócios', 'Atividades'],
    fields: [
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Seu token de API Pipedrive' },
      { key: 'companyDomain', label: 'Domínio', type: 'text', placeholder: 'suaempresa.pipedrive.com' },
    ]
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sincronize contatos, empresas, negócios e campanhas com o HubSpot.',
    logo: '🟡',
    color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    badgeColor: 'bg-yellow-500/20 text-yellow-300',
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
    features: ['Contatos e Empresas', 'Negócios', 'Marketing', 'Relatórios'],
    fields: [
      { key: 'apiKey', label: 'Private App Token', type: 'password', placeholder: 'pat-na1-XXXXXXXX' },
      { key: 'portalId', label: 'Portal ID', type: 'text', placeholder: 'ID do portal HubSpot' },
    ]
  }
];

const STATUS_COLORS = {
  connected: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  disconnected: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  error: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const TYPE_META = {
  ERP: { label: 'Sistema ERP', icon: PlugZap },
  WHATSAPP: { label: 'WhatsApp Business', icon: Activity },
  EMAIL_MARKETING: { label: 'E-mail Marketing', icon: Mail },
  VOIP: { label: 'Telefonia VoIP', icon: PhoneCall },
  API_EXTERNAL: { label: 'API Externa', icon: Link2 },
  WEBHOOK: { label: 'Webhook', icon: Webhook }
};

// ─── CRM Platform Card ────────────────────────────────────────────────────────
function PlatformCard({ platform, config, onSave, onTest }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => {
    const initial = {};
    platform.fields.forEach(f => { initial[f.key] = config?.[f.key] || ''; });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const isConfigured = platform.fields.some(f => form[f.key]?.trim());
  const status = config?.status || (isConfigured ? 'pending' : 'disconnected');

  useEffect(() => {
    const next = {};
    platform.fields.forEach((field) => {
      next[field.key] = config?.[field.key] || '';
    });
    setForm(next);
  }, [config, platform.fields]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(platform.id, form);
      setTestResult({ success: true, message: 'Configuração salva com sucesso!' });
    } catch (e) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(platform.id, form);
      setTestResult({ success: true, message: result?.message || 'Conexão testada com sucesso!' });
    } catch (e) {
      setTestResult({ success: false, message: e.message || 'Falha na conexão' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${platform.color} overflow-hidden`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{platform.logo}</span>
            <div>
              <h3 className="font-bold text-[var(--crm-ink)]">{platform.name}</h3>
              <p className="text-xs text-[var(--crm-muted)] mt-0.5">{platform.description}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}>
            {status === 'connected' ? '● Conectado' : status === 'error' ? '● Erro' : status === 'pending' ? '● Pendente' : '○ Não configurado'}
          </span>
        </div>

        {/* Features */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {platform.features.map(f => (
            <span key={f} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--crm-muted)]">{f}</span>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-xs font-semibold text-[var(--crm-ink)] hover:bg-[var(--crm-bg)] transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <a
            href={platform.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-xs font-semibold text-[var(--crm-muted)] hover:text-[var(--crm-ink)] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Docs
          </a>
          {isConfigured && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-xs font-semibold text-[var(--crm-muted)] hover:text-[var(--crm-ink)] transition-colors"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
              Testar
            </button>
          )}
        </div>
      </div>

      {/* Config Form */}
      {expanded && (
        <div className="border-t border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {platform.fields.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-[var(--crm-muted)] mb-1.5">
                  <Key className="inline h-3 w-3 mr-1" />{field.label}
                </label>
                <input
                  type={field.type}
                  value={form[field.key]}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="crm-input text-sm"
                />
              </div>
            ))}
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${testResult.success ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {testResult.message}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setExpanded(false)} className="crm-btn crm-btn-secondary text-xs px-3 py-2">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="crm-btn crm-btn-primary text-xs px-3 py-2">
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Integracoes() {
  const [activeTab, setActiveTab] = useState('crm');
  const [integracoes, setIntegracoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCrmConfigs, setLoadingCrmConfigs] = useState(false);
  const [crmConfigs, setCrmConfigs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm-integrations-config') || '{}'); } catch { return {}; }
  });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [formData, setFormData] = useState({ name: '', type: 'WEBHOOK', apiKey: '', webhookUrl: '', isActive: true });

  const loadIntegracoes = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.integrations, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setIntegracoes(Array.isArray(data) ? data : []);
    } catch { setIntegracoes([]); }
    finally { setLoading(false); }
  };

  const loadCrmConfigs = async () => {
    try {
      setLoadingCrmConfigs(true);
      const res = await fetch(`${API_ENDPOINTS.integrations}/crm-configs`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const serverConfigs = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

      setCrmConfigs((prev) => {
        const merged = { ...prev, ...serverConfigs };
        localStorage.setItem('crm-integrations-config', JSON.stringify(merged));
        return merged;
      });
    } catch {
      // Mantém fallback local quando backend indisponível
    } finally {
      setLoadingCrmConfigs(false);
    }
  };

  useEffect(() => {
    loadIntegracoes();
    loadCrmConfigs();
  }, []);

  const handleSaveCrmConfig = async (platformId, config) => {
    const res = await fetch(`${API_ENDPOINTS.integrations}/crm-configs/${encodeURIComponent(platformId)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ config, status: 'pending' })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Não foi possível salvar a configuração.');
    }

    setCrmConfigs((prev) => {
      const updated = { ...prev, [platformId]: data };
      localStorage.setItem('crm-integrations-config', JSON.stringify(updated));
      return updated;
    });
  };

  const handleTestCrmConfig = async (platformId, config) => {
    const res = await fetch(`${API_ENDPOINTS.integrations}/crm-configs/${encodeURIComponent(platformId)}/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ config })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data?.details?.savedConfig) {
        setCrmConfigs((prev) => {
          const updated = { ...prev, [platformId]: data.details.savedConfig };
          localStorage.setItem('crm-integrations-config', JSON.stringify(updated));
          return updated;
        });
      }
      throw new Error(data?.error || 'Falha ao testar conexão.');
    }

    if (data?.savedConfig) {
      setCrmConfigs((prev) => {
        const updated = { ...prev, [platformId]: data.savedConfig };
        localStorage.setItem('crm-integrations-config', JSON.stringify(updated));
        return updated;
      });
    }

    return { message: data?.message || 'Conexão estabelecida com sucesso!' };
  };

  const handleSubmitCustom = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(API_ENDPOINTS.integrations, {
        method: editingIntegration ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...formData, id: editingIntegration?.id })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível salvar a integração.');
      }

      setShowForm(false);
      setEditingIntegration(null);
      setFormData({ name: '', type: 'WEBHOOK', apiKey: '', webhookUrl: '', isActive: true });
      loadIntegracoes();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao salvar integração');
    }
    finally { setSaving(false); }
  };

  const openCustomForm = (integration = null) => {
    setEditingIntegration(integration);
    setFormData(integration ? {
      name: integration.name || '',
      type: integration.type || 'WEBHOOK',
      apiKey: integration.apiKey || '',
      webhookUrl: integration.webhookUrl || '',
      isActive: integration.isActive !== false
    } : { name: '', type: 'WEBHOOK', apiKey: '', webhookUrl: '', isActive: true });
    setShowForm(true);
  };

  const closeCustomForm = () => {
    setShowForm(false);
    setEditingIntegration(null);
    setFormData({ name: '', type: 'WEBHOOK', apiKey: '', webhookUrl: '', isActive: true });
  };

  const deleteCustomIntegration = async (integration) => {
    if (!window.confirm(`Excluir a integração "${integration.name}"?`)) return;

    try {
      const res = await fetch(`${API_ENDPOINTS.integrations}?id=${encodeURIComponent(integration.id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível excluir a integração.');
      }

      loadIntegracoes();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao excluir integração');
    }
  };

  const connectedCount = CRM_PLATFORMS.filter(p => crmConfigs[p.id]?.status === 'connected').length;
  const configuredCount = CRM_PLATFORMS.filter(p => Object.values(crmConfigs[p.id] || {}).some(v => typeof v === 'string' && v.trim())).length;

  const tabs = [
    { id: 'crm', label: 'Plataformas CRM', icon: Zap },
    { id: 'custom', label: 'Integrações Customizadas', icon: Link2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        subtitle="Conecte o NexosCRM com outras plataformas e ferramentas"
        icon={Link2}
        gradient="blue"
        breadcrumbs={['Home', 'Automação / Integrações', 'Integrações']}
        actions={activeTab === 'custom' ? [{ label: 'Nova Integração', onClick: () => openCustomForm(), icon: Plus, variant: 'primary' }] : []}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AnimatedStats title="Plataformas" value={CRM_PLATFORMS.length} subtitle="Disponíveis" icon={PlugZap} color="blue" />
        <AnimatedStats title="Conectadas" value={connectedCount} subtitle="Ativas" icon={CheckCircle2} color="green" />
        <AnimatedStats title="Configuradas" value={configuredCount} subtitle="Com credenciais" icon={Key} color="purple" />
        <AnimatedStats title="Customizadas" value={integracoes.filter(i => i.isActive).length} subtitle="Ativas" icon={Webhook} color="orange" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--crm-accent)] text-white shadow-sm'
                  : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: CRM Platforms */}
      {activeTab === 'crm' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Integrações com backend ativo</p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                As credenciais são persistidas no servidor e o teste valida a configuração antes de marcar o card como conectado.
                A sincronização automática completa continua em evolução por conector.
              </p>
            </div>
          </div>

          {loadingCrmConfigs && (
            <div className="flex items-center justify-center py-4 text-sm text-[var(--crm-muted)]">
              <RefreshCcw className="h-4 w-4 animate-spin mr-2" />
              Carregando configurações salvas...
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {CRM_PLATFORMS.map(platform => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                config={crmConfigs[platform.id]}
                onSave={handleSaveCrmConfig}
                onTest={handleTestCrmConfig}
              />
            ))}
          </div>

          {/* Roadmap */}
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
            <h3 className="font-semibold text-[var(--crm-ink)] mb-4 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-[var(--crm-accent)]" />
              Roadmap de Integrações
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { phase: 'Fase 1 — Em breve', items: ['Zoho CRM — Sincronização de contatos', 'Bitrix24 — Leads e negócios', 'IXC Software — Clientes e contratos'], color: 'border-blue-500/30 bg-blue-500/10 text-blue-300' },
                { phase: 'Fase 2 — Planejado', items: ['HubSpot — Marketing e CRM', 'Salesforce — Enterprise', 'RD Station — Marketing'], color: 'border-purple-500/30 bg-purple-500/10 text-purple-300' },
                { phase: 'Fase 3 — Futuro', items: ['WhatsApp Business API', 'Google Workspace', 'Microsoft 365'], color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
              ].map(phase => (
                <div key={phase.phase} className={`rounded-xl border p-3 ${phase.color}`}>
                  <p className="text-xs font-bold mb-2">{phase.phase}</p>
                  <ul className="space-y-1">
                    {phase.items.map(item => (
                      <li key={item} className="text-xs opacity-80 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-current shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Custom Integrations */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[var(--crm-muted)]">
              <RefreshCcw className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : integracoes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--crm-border)] p-12 text-center">
              <Link2 className="mx-auto h-10 w-10 text-[var(--crm-muted)] mb-3" />
              <p className="font-semibold text-[var(--crm-ink)]">Nenhuma integração customizada</p>
              <p className="text-sm text-[var(--crm-muted)] mt-1">Crie webhooks e APIs externas personalizadas</p>
              <button onClick={() => openCustomForm()} className="crm-btn crm-btn-primary mt-4 text-sm">
                <Plus className="h-4 w-4" /> Nova Integração
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {integracoes.map(item => {
                const meta = TYPE_META[item.type] || { label: item.type, icon: Link2 };
                const Icon = meta.icon;
                return (
                  <div key={item.id} className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-bg)] p-2.5">
                        <Icon className="h-5 w-5 text-[var(--crm-accent)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--crm-ink)] truncate">{item.name}</p>
                        <p className="text-xs text-[var(--crm-muted)]">{meta.label}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${item.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
                        {item.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    {item.webhookUrl && (
                      <p className="mt-2 text-xs text-[var(--crm-muted)] truncate">{item.webhookUrl}</p>
                    )}
                    <div className="mt-4 flex justify-end gap-2 border-t border-[color:var(--crm-border)] pt-3">
                      <button
                        type="button"
                        onClick={() => openCustomForm(item)}
                        className="crm-btn crm-btn-secondary px-3 py-2 text-xs"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomIntegration(item)}
                        className="crm-btn crm-btn-danger px-3 py-2 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Integração Customizada */}
      <Modal isOpen={showForm} onClose={closeCustomForm} title={editingIntegration ? 'Editar Integração Customizada' : 'Nova Integração Customizada'}>
        <form onSubmit={handleSubmitCustom} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Nome *</label>
              <input type="text" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="crm-input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Tipo *</label>
              <select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))} className="crm-input">
                {Object.entries(TYPE_META).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="isActive" type="checkbox" checked={!!formData.isActive} onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4" />
              <label htmlFor="isActive" className="text-sm font-semibold text-[var(--crm-ink)]">Ativa</label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">API Key</label>
              <input type="text" value={formData.apiKey} onChange={e => setFormData(p => ({ ...p, apiKey: e.target.value }))} className="crm-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1.5">Webhook URL</label>
              <input type="url" value={formData.webhookUrl} onChange={e => setFormData(p => ({ ...p, webhookUrl: e.target.value }))} className="crm-input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeCustomForm} className="crm-btn crm-btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary">{saving ? 'Salvando...' : editingIntegration ? 'Atualizar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
