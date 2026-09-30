import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CalendarClock,
  DollarSign,
  Plus,
  Receipt,
  Save,
  SlidersHorizontal,
  User,
  X
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import Modal from '../components/Modal';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const STATUS_META = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-900 dark:text-amber-200' },
  APPROVED: { label: 'Aprovada', cls: 'bg-sky-500/10 text-sky-900 dark:text-sky-200' },
  PAID: { label: 'Paga', cls: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-red-500/10 text-red-900 dark:text-red-200' }
};

const MONTHLY_COMMISSION_FIELDS = [
  { key: 'commissionProject12', months: 12, label: '12 meses' },
  { key: 'commissionProject24', months: 24, label: '24 meses' },
  { key: 'commissionProject36', months: 36, label: '36 meses' },
  { key: 'commissionProject48', months: 48, label: '48 meses' },
  { key: 'commissionProject60', months: 60, label: '60 meses' }
];

const EMPTY_COMMISSION_RULES = {
  commissionSalePercentage: '',
  commissionProject12: '',
  commissionProject24: '',
  commissionProject36: '',
  commissionProject48: '',
  commissionProject60: ''
};

const normalizePercentInput = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPercentValue = (value) => {
  if (value === null || value === undefined || value === '') return 'nao definido';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(2).replace('.', ',')}%` : 'nao definido';
};

export default function Comissoes() {
  const [comissoes, setComissoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [filtros, setFiltros] = useState({
    sellerId: '',
    status: '',
    period: 'current_month'
  });

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [selectedRuleSellerId, setSelectedRuleSellerId] = useState('');
  const [commissionRules, setCommissionRules] = useState(EMPTY_COMMISSION_RULES);
  const [formData, setFormData] = useState({
    opportunityId: '',
    sellerId: '',
    projectType: 'SINGLE',
    projectMonths: '12',
    percentage: 5,
    amount: 0
  });

  const loadUsuarios = async () => {
    try {
      const res = await fetch(`${API_ENDPOINTS.users}?role=SELLER`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar usuarios:', error);
      setUsuarios([]);
    }
  };

  const loadComissoes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtros.sellerId) params.append('sellerId', filtros.sellerId);
      if (filtros.status) params.append('status', filtros.status);
      if (filtros.period) params.append('period', filtros.period);

      const res = await fetch(`${API_ENDPOINTS.commissions}?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setComissoes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar comissoes:', error);
      setComissoes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsuarios();
  }, []);

  useEffect(() => {
    loadComissoes();
  }, [filtros]);

  useEffect(() => {
    if (!selectedRuleSellerId && usuarios.length > 0) {
      setSelectedRuleSellerId(usuarios[0].id);
    }
  }, [selectedRuleSellerId, usuarios]);

  const selectedRuleSeller = useMemo(
    () => usuarios.find((u) => u.id === selectedRuleSellerId) || null,
    [selectedRuleSellerId, usuarios]
  );

  useEffect(() => {
    if (!selectedRuleSeller) {
      setCommissionRules(EMPTY_COMMISSION_RULES);
      return;
    }

    setCommissionRules({
      commissionSalePercentage: selectedRuleSeller.commissionSalePercentage ?? '',
      commissionProject12: selectedRuleSeller.commissionProject12 ?? '',
      commissionProject24: selectedRuleSeller.commissionProject24 ?? '',
      commissionProject36: selectedRuleSeller.commissionProject36 ?? '',
      commissionProject48: selectedRuleSeller.commissionProject48 ?? '',
      commissionProject60: selectedRuleSeller.commissionProject60 ?? ''
    });
  }, [selectedRuleSeller]);

  const getConfiguredRate = (sellerId, projectType, projectMonths) => {
    const seller = usuarios.find((u) => u.id === sellerId);
    if (!seller) return null;
    if (projectType === 'MONTHLY') {
      return seller[`commissionProject${projectMonths}`] ?? null;
    }
    return seller.commissionSalePercentage ?? null;
  };

  const applyConfiguredRate = (nextValues) => {
    const next = { ...formData, ...nextValues };
    const rate = getConfiguredRate(next.sellerId, next.projectType, next.projectMonths);
    return {
      ...next,
      percentage: rate !== null && rate !== undefined ? Number(rate) : next.percentage
    };
  };

  const commissionRuleRows = useMemo(() => (
    usuarios.map((seller) => ({
      id: seller.id,
      name: seller.name,
      email: seller.email,
      single: seller.commissionSalePercentage,
      monthly: MONTHLY_COMMISSION_FIELDS.map((field) => ({
        ...field,
        value: seller[field.key]
      }))
    }))
  ), [usuarios]);

  const totals = useMemo(() => {
    const items = Array.isArray(comissoes) ? comissoes : [];
    return items.reduce(
      (acc, c) => {
        const amount = Number(c.amount) || 0;
        acc.total += amount;
        if (c.status === 'PAID') acc.paid += amount;
        if (c.status === 'APPROVED') acc.approved += amount;
        if (c.status === 'PENDING') acc.pending += amount;
        return acc;
      },
      { total: 0, paid: 0, approved: 0, pending: 0 }
    );
  }, [comissoes]);

  const filteredComissoes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const items = Array.isArray(comissoes) ? comissoes : [];
    if (!term) return items;
    return items.filter((c) => {
      const hay = [
        c.opportunity?.title,
        c.opportunity?.company?.name,
        c.seller?.name,
        STATUS_META[c.status]?.label
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [comissoes, searchTerm]);

  const updateStatus = async (id, status) => {
    try {
      await fetch(API_ENDPOINTS.commissions, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id,
          status,
          paidAt: status === 'PAID' ? new Date().toISOString() : null
        })
      });
      loadComissoes();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const closeModal = () => {
    setShowForm(false);
    setSaving(false);
    setFormData({ opportunityId: '', sellerId: '', projectType: 'SINGLE', projectMonths: '12', percentage: 5, amount: 0 });
  };

  const handleSaveCommissionRules = async () => {
    if (!selectedRuleSeller) return;

    try {
      setSavingRules(true);

      const payload = {
        id: selectedRuleSeller.id,
        name: selectedRuleSeller.name,
        email: selectedRuleSeller.email,
        role: selectedRuleSeller.role,
        regionId: selectedRuleSeller.regionId ?? null,
        quota: selectedRuleSeller.quota ?? null,
        accessB2B: selectedRuleSeller.accessB2B,
        accessB2G: selectedRuleSeller.accessB2G,
        accessPreSales: selectedRuleSeller.accessPreSales,
        permissionOverrides: selectedRuleSeller.permissionOverrides || {},
        isCompanyOwner: selectedRuleSeller.isCompanyOwner,
        commissionSalePercentage: normalizePercentInput(commissionRules.commissionSalePercentage),
        commissionProject12: normalizePercentInput(commissionRules.commissionProject12),
        commissionProject24: normalizePercentInput(commissionRules.commissionProject24),
        commissionProject36: normalizePercentInput(commissionRules.commissionProject36),
        commissionProject48: normalizePercentInput(commissionRules.commissionProject48),
        commissionProject60: normalizePercentInput(commissionRules.commissionProject60)
      };

      const res = await fetch(API_ENDPOINTS.users, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Falha ao salvar regras de comissao');

      const updated = await res.json();
      setUsuarios((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedRuleSellerId(updated.id);
    } catch (error) {
      console.error('Erro ao salvar regras de comissao:', error);
    } finally {
      setSavingRules(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await fetch(API_ENDPOINTS.commissions, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          opportunityId: formData.opportunityId,
          sellerId: formData.sellerId,
          percentage: Number(formData.percentage) || 0,
          amount: Number(formData.amount) || 0
        })
      });
      closeModal();
      loadComissoes();
    } catch (error) {
      console.error('Erro ao criar comissao:', error);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => ([
    {
      key: 'opportunity',
      label: 'Oportunidade',
      render: (item) => (
        <div className="min-w-[260px]">
          <div className="text-sm font-extrabold text-[var(--crm-ink)]">
            {item.opportunity?.title || 'Oportunidade'}
          </div>
          <div className="mt-0.5 text-xs text-[var(--crm-muted)] truncate">
            {item.opportunity?.company?.name || 'Empresa nao informada'}
          </div>
        </div>
      )
    },
    {
      key: 'seller',
      label: 'Vendedor',
      render: (item) => (
        <span className="text-sm font-semibold text-[var(--crm-ink)]">{item.seller?.name || '-'}</span>
      )
    },
    {
      key: 'percentage',
      label: 'Percentual',
      render: (item) => (
        <span className="text-sm font-extrabold text-[var(--crm-ink)]">{Number(item.percentage || 0).toFixed(1)}%</span>
      )
    },
    {
      key: 'amount',
      label: 'Comissao',
      render: (item) => (
        <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-200">
          {formatCurrency(item.amount)}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => {
        const meta = STATUS_META[item.status] || { label: item.status || '-', cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-200' };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ${meta.cls}`}>
            {meta.label}
          </span>
        );
      }
    },
    {
      key: 'createdAt',
      label: 'Criada em',
      render: (item) => (
        <span className="text-sm text-[var(--crm-ink)]">
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '-'}
        </span>
      )
    },
    {
      key: 'paidAt',
      label: 'Pagamento',
      render: (item) => (
        <span className="text-sm text-[var(--crm-ink)]">
          {item.paidAt ? new Date(item.paidAt).toLocaleDateString('pt-BR') : '-'}
        </span>
      )
    }
  ]), []);

  return (
    <div>
      <PageHeader
        title="Comissoes"
        subtitle="Gerencie o comissionamento dos vendedores"
        icon={DollarSign}
        gradient="blue"
        breadcrumbs={['Home', 'Comissoes']}
        actions={[
          {
            label: 'Nova Comissao',
            onClick: () => setShowForm(true),
            icon: Plus,
            variant: 'primary'
          }
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <AnimatedStats title="Total" value={Math.round(totals.total)} prefix="R$ " subtitle="No periodo" icon={Receipt} color="blue" />
        <AnimatedStats title="Pagas" value={Math.round(totals.paid)} prefix="R$ " subtitle="Liquidadas" icon={Check} color="green" />
        <AnimatedStats title="Aprovadas" value={Math.round(totals.approved)} prefix="R$ " subtitle="Aguardando pagamento" icon={DollarSign} color="purple" />
        <AnimatedStats title="Pendentes" value={Math.round(totals.pending)} prefix="R$ " subtitle="Para revisar" icon={X} color="orange" />
      </div>

      <section className="mb-8 overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[var(--crm-border)] bg-[linear-gradient(135deg,rgba(22,78,99,0.16),rgba(37,99,235,0.08))] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-500/10 text-cyan-200">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[var(--crm-ink)]">Regras de Comissionamento</h2>
              <p className="mt-1 max-w-3xl text-sm text-[var(--crm-muted)]">
                Configure o percentual de comissão por vendedor para projetos pontuais e contratos mensais.
              </p>
            </div>
          </div>

          <div className="w-full lg:max-w-sm">
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-[var(--crm-muted)]">Vendedor</label>
            <select
              value={selectedRuleSellerId}
              onChange={(e) => setSelectedRuleSellerId(e.target.value)}
              className="crm-input"
            >
              <option value="">Selecione</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)_auto] xl:items-end">
          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-bg)] p-4">
            <div className="flex items-center gap-2 text-sm font-black text-[var(--crm-ink)]">
              <DollarSign className="h-4 w-4 text-emerald-300" />
              Projeto pontual
            </div>
            <p className="mt-1 text-xs text-[var(--crm-muted)]">Percentual aplicado em vendas avulsas.</p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold text-[var(--crm-muted)]">Comissão (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={commissionRules.commissionSalePercentage}
                onChange={(e) => setCommissionRules((p) => ({ ...p, commissionSalePercentage: e.target.value }))}
                className="crm-input text-lg font-black"
                placeholder="Ex: 5"
                disabled={!selectedRuleSeller}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-bg)] p-4">
            <div className="flex items-center gap-2 text-sm font-black text-[var(--crm-ink)]">
              <CalendarClock className="h-4 w-4 text-sky-300" />
              Projetos mensais
            </div>
            <p className="mt-1 text-xs text-[var(--crm-muted)]">Defina uma comissão diferente conforme o prazo contratado.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {MONTHLY_COMMISSION_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-bold text-[var(--crm-muted)]">{field.label}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={commissionRules[field.key]}
                    onChange={(e) => setCommissionRules((p) => ({ ...p, [field.key]: e.target.value }))}
                    className="crm-input text-sm font-black"
                    placeholder="%"
                    disabled={!selectedRuleSeller}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveCommissionRules}
            disabled={!selectedRuleSeller || savingRules}
            className="crm-btn crm-btn-primary h-12 justify-center px-5"
          >
            <Save className="h-4 w-4" />
            {savingRules ? 'Salvando...' : 'Salvar Regras'}
          </button>
        </div>

        <div className="border-t border-[var(--crm-border)] bg-[rgba(7,20,38,0.24)] p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[var(--crm-ink)]">Regras salvas por vendedor</h3>
              <p className="text-xs text-[var(--crm-muted)]">Resumo persistido para consulta rapida e edicao.</p>
            </div>
            <span className="text-xs font-bold text-[var(--crm-muted)]">{commissionRuleRows.length} vendedor(es)</span>
          </div>

          {commissionRuleRows.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {commissionRuleRows.map((seller) => (
                <button
                  key={seller.id}
                  type="button"
                  onClick={() => setSelectedRuleSellerId(seller.id)}
                  className={[
                    'w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-cyan-500/10',
                    selectedRuleSellerId === seller.id
                      ? 'border-cyan-300/70 bg-cyan-500/12 shadow-[0_18px_34px_-28px_rgba(34,211,238,0.85)]'
                      : 'border-[var(--crm-border)] bg-[var(--crm-bg)]'
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] text-cyan-200">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-[var(--crm-ink)]">{seller.name}</div>
                        <div className="truncate text-xs text-[var(--crm-muted)]">{seller.email || 'sem email'}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-200">Pontual</div>
                      <div className="text-sm font-black text-[var(--crm-ink)]">{formatPercentValue(seller.single)}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {seller.monthly.map((rule) => (
                      <div key={rule.key} className="rounded-xl border border-[var(--crm-border)] bg-[rgba(11,34,67,0.58)] px-2 py-2 text-center">
                        <div className="text-[10px] font-bold text-[var(--crm-muted)]">{rule.months}m</div>
                        <div className="mt-0.5 text-xs font-black text-[var(--crm-ink)]">{formatPercentValue(rule.value)}</div>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--crm-border)] bg-[var(--crm-bg)] p-5 text-sm text-[var(--crm-muted)]">
              Nenhum vendedor encontrado para exibir regras de comissionamento.
            </div>
          )}
        </div>
      </section>

      <ModernTable
        title="Lista de Comissoes"
        data={filteredComissoes}
        columns={columns}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          {
            label: 'Vendedor',
            value: filtros.sellerId,
            onChange: (value) => setFiltros((p) => ({ ...p, sellerId: value })),
            options: usuarios.map((u) => ({ value: u.id, label: u.name }))
          },
          {
            label: 'Status',
            value: filtros.status,
            onChange: (value) => setFiltros((p) => ({ ...p, status: value })),
            options: [
              { value: 'PENDING', label: 'Pendente' },
              { value: 'APPROVED', label: 'Aprovada' },
              { value: 'PAID', label: 'Paga' },
              { value: 'CANCELLED', label: 'Cancelada' }
            ]
          },
          {
            label: 'Periodo',
            value: filtros.period,
            onChange: (value) => setFiltros((p) => ({ ...p, period: value })),
            options: [
              { value: 'current_month', label: 'Mes atual' },
              { value: 'last_month', label: 'Mes passado' },
              { value: 'current_quarter', label: 'Trimestre atual' },
              { value: 'current_year', label: 'Ano atual' },
              { value: 'all', label: 'Todos' }
            ]
          }
        ]}
        loading={loading}
        renderActions={(item) => (
          <>
            {item.status === 'PENDING' && (
              <>
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, 'APPROVED')}
                  className="crm-btn crm-btn-primary px-3 py-1.5 text-xs"
                  title="Aprovar"
                >
                  <Check className="h-4 w-4" />
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, 'CANCELLED')}
                  className="crm-btn crm-btn-danger px-3 py-1.5 text-xs"
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              </>
            )}
            {item.status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => updateStatus(item.id, 'PAID')}
                className="crm-btn crm-btn-primary px-3 py-1.5 text-xs"
                title="Marcar como paga"
              >
                <DollarSign className="h-4 w-4" />
                Pagar
              </button>
            )}
          </>
        )}
      />

      <Modal isOpen={showForm} onClose={closeModal} title="Nova Comissao">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Vendedor *</label>
              <select
                required
                value={formData.sellerId}
                onChange={(e) => setFormData(applyConfiguredRate({ sellerId: e.target.value }))}
                className="crm-input"
              >
                <option value="">Selecione</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Tipo de projeto *</label>
              <select
                required
                value={formData.projectType}
                onChange={(e) => setFormData(applyConfiguredRate({ projectType: e.target.value }))}
                className="crm-input"
              >
                <option value="SINGLE">Projeto pontual</option>
                <option value="MONTHLY">Projeto mensal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Prazo mensal</label>
              <select
                value={formData.projectMonths}
                onChange={(e) => setFormData(applyConfiguredRate({ projectMonths: e.target.value }))}
                className="crm-input"
                disabled={formData.projectType !== 'MONTHLY'}
              >
                {MONTHLY_COMMISSION_FIELDS.map((field) => (
                  <option key={field.months} value={String(field.months)}>{field.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Percentual (%) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={formData.percentage}
                onChange={(e) => setFormData((p) => ({ ...p, percentage: Number(e.target.value) }))}
                className="crm-input"
              />
              <p className="mt-2 text-xs text-[var(--crm-muted)]">
                Regra configurada: {formatPercentValue(getConfiguredRate(formData.sellerId, formData.projectType, formData.projectMonths))}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.amount}
                onChange={(e) => setFormData((p) => ({ ...p, amount: Number(e.target.value) }))}
                className="crm-input"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Oportunidade (opcional)</label>
              <input
                type="text"
                value={formData.opportunityId}
                onChange={(e) => setFormData((p) => ({ ...p, opportunityId: e.target.value }))}
                className="crm-input"
                placeholder="ID da oportunidade"
              />
              <div className="mt-2 text-xs text-[var(--crm-muted)] flex items-center gap-2">
                <User className="h-4 w-4" />
                Se o backend exigir, preencha o ID da oportunidade.
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button type="button" onClick={closeModal} className="crm-btn crm-btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary">
              {saving ? 'Salvando...' : 'Criar Comissao'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
