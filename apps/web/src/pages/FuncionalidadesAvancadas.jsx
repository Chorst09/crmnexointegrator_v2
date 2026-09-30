import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Rocket } from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const TABS = [
  { id: 'price-tables', label: 'Tabelas de Preço', icon: '💰' },
  { id: 'competitors', label: 'Concorrentes', icon: '🏆' },
  { id: 'regions', label: 'Regiões/Carteiras', icon: '🌍' },
  { id: 'cross-sell', label: 'Cross-sell', icon: '🔄' },
  { id: 'upsell', label: 'Upsell', icon: '⬆️' },
  { id: 'approvals', label: 'Aprovações', icon: '✅' }
];

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const emptyData = {
  priceTables: [],
  competitors: [],
  regions: [],
  crossSell: [],
  upSell: [],
  approvals: []
};

const defaultForms = {
  'price-tables': {
    name: '',
    description: '',
    validFrom: todayIsoDate(),
    validUntil: '',
    region: '',
    customerSegment: '',
    isDefault: false,
    prices: [
      {
        productId: '',
        price: '',
        minQuantity: '1',
        maxQuantity: '',
        discount: '0'
      }
    ]
  },
  competitors: {
    name: '',
    website: '',
    strengths: '',
    weaknesses: '',
    pricing: '',
    marketShare: '',
    notes: '',
    isActive: true
  },
  regions: {
    name: '',
    code: '',
    country: 'Brasil',
    state: '',
    city: '',
    isActive: true
  },
  'cross-sell': {
    name: '',
    mainProductId: '',
    suggestedProductId: '',
    probabilityPercent: '50',
    discount: '0',
    isActive: true
  },
  upsell: {
    name: '',
    mainProductId: '',
    targetProductId: '',
    minQuantity: '1',
    discount: '0',
    isActive: true
  }
};

const endpointByTab = {
  'price-tables': '/price-tables',
  competitors: '/competitors',
  regions: '/regions',
  'cross-sell': '/cross-sell',
  upsell: '/upsell'
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const formatDateBr = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const ActionModal = ({ open, title, children, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-[var(--crm-ink)]">{title}</h3>
          <button type="button" className="crm-btn" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default function FuncionalidadesAvancadas() {
  const [activeTab, setActiveTab] = useState('price-tables');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [products, setProducts] = useState([]);
  const [data, setData] = useState(emptyData);
  const [modalState, setModalState] = useState({ open: false, tab: null, mode: 'create', itemId: null });
  const [formState, setFormState] = useState(defaultForms['price-tables']);
  const [approvalComment, setApprovalComment] = useState('');

  const productOptions = useMemo(
    () => (Array.isArray(products) ? products.map((p) => ({ id: p.id, name: p.name })) : []),
    [products]
  );

  const clearMessages = () => {
    setError('');
    setFeedback('');
  };

  const loadData = async () => {
    setLoading(true);
    clearMessages();
    try {
      const headers = getAuthHeaders();
      const [priceTablesRes, competitorsRes, regionsRes, crossSellRes, upSellRes, approvalsRes, productsRes] = await Promise.all([
        fetch(buildApiUrl('/price-tables'), { headers }),
        fetch(buildApiUrl('/competitors'), { headers }),
        fetch(buildApiUrl('/regions'), { headers }),
        fetch(buildApiUrl('/cross-sell'), { headers }),
        fetch(buildApiUrl('/upsell'), { headers }),
        fetch(buildApiUrl('/approvals'), { headers }),
        fetch(buildApiUrl('/products'), { headers })
      ]);

      if (![priceTablesRes, competitorsRes, regionsRes, crossSellRes, upSellRes, approvalsRes, productsRes].every((res) => res.ok)) {
        throw new Error('Falha ao carregar dados das funcionalidades avançadas');
      }

      const [priceTables, competitors, regions, crossSell, upSell, approvals, loadedProducts] = await Promise.all([
        parseJsonSafe(priceTablesRes),
        parseJsonSafe(competitorsRes),
        parseJsonSafe(regionsRes),
        parseJsonSafe(crossSellRes),
        parseJsonSafe(upSellRes),
        parseJsonSafe(approvalsRes),
        parseJsonSafe(productsRes)
      ]);

      setData({
        priceTables: Array.isArray(priceTables) ? priceTables : [],
        competitors: Array.isArray(competitors) ? competitors : [],
        regions: Array.isArray(regions) ? regions : [],
        crossSell: Array.isArray(crossSell) ? crossSell : [],
        upSell: Array.isArray(upSell) ? upSell : [],
        approvals: Array.isArray(approvals) ? approvals : []
      });
      setProducts(Array.isArray(loadedProducts) ? loadedProducts : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreate = (tab) => {
    clearMessages();
    setModalState({ open: true, tab, mode: 'create', itemId: null });
    setFormState(defaultForms[tab]);
  };

  const openEdit = (tab, item) => {
    clearMessages();
    setModalState({ open: true, tab, mode: 'edit', itemId: item.id });

    if (tab === 'price-tables') {
      setFormState({
        name: item.name || '',
        description: item.description || '',
        validFrom: item.validFrom ? String(item.validFrom).slice(0, 10) : todayIsoDate(),
        validUntil: item.validUntil ? String(item.validUntil).slice(0, 10) : '',
        region: item.region || '',
        customerSegment: item.customerSegment || '',
        isDefault: Boolean(item.isDefault),
        prices: Array.isArray(item.prices) && item.prices.length > 0
          ? item.prices.map((priceRow) => ({
              productId: priceRow.productId || priceRow.product?.id || '',
              price: priceRow.price ?? '',
              minQuantity: priceRow.minQuantity ?? '1',
              maxQuantity: priceRow.maxQuantity ?? '',
              discount: priceRow.discount ?? '0'
            }))
          : [
              {
                productId: '',
                price: '',
                minQuantity: '1',
                maxQuantity: '',
                discount: '0'
              }
            ]
      });
      return;
    }

    if (tab === 'competitors') {
      setFormState({
        name: item.name || '',
        website: item.website || '',
        strengths: item.strengths || '',
        weaknesses: item.weaknesses || '',
        pricing: item.pricing || '',
        marketShare: item.marketShare || '',
        notes: item.notes || '',
        isActive: Boolean(item.isActive)
      });
      return;
    }

    if (tab === 'regions') {
      setFormState({
        name: item.name || '',
        code: item.code || '',
        country: item.country || 'Brasil',
        state: item.state || '',
        city: item.city || '',
        isActive: Boolean(item.isActive)
      });
      return;
    }

    if (tab === 'cross-sell') {
      setFormState({
        name: item.name || '',
        mainProductId: item.mainProductId || '',
        suggestedProductId: item.suggestedProductId || '',
        probabilityPercent: String(Math.round((Number(item.probability || 0) || 0) * 100)),
        discount: String(item.discount ?? 0),
        isActive: Boolean(item.isActive)
      });
      return;
    }

    if (tab === 'upsell') {
      setFormState({
        name: item.name || '',
        mainProductId: item.mainProductId || '',
        targetProductId: item.targetProductId || '',
        minQuantity: String(item.minQuantity ?? 1),
        discount: String(item.discount ?? 0),
        isActive: Boolean(item.isActive)
      });
    }
  };

  const closeModal = () => {
    setModalState({ open: false, tab: null, mode: 'create', itemId: null });
    setFormState(defaultForms['price-tables']);
  };

  const buildPayload = (tab) => {
    if (tab === 'price-tables') {
      const normalizedPrices = (Array.isArray(formState.prices) ? formState.prices : [])
        .map((priceRow) => ({
          productId: String(priceRow.productId || '').trim(),
          price: Number(priceRow.price || 0),
          minQuantity: Math.max(1, Number(priceRow.minQuantity || 1)),
          maxQuantity: priceRow.maxQuantity === '' || priceRow.maxQuantity === null || priceRow.maxQuantity === undefined
            ? null
            : Math.max(1, Number(priceRow.maxQuantity)),
          discount: Math.max(0, Number(priceRow.discount || 0))
        }))
        .filter((priceRow) => Boolean(priceRow.productId) && Number.isFinite(priceRow.price) && priceRow.price > 0);

      return {
        name: String(formState.name || '').trim(),
        description: String(formState.description || '').trim(),
        validFrom: formState.validFrom || todayIsoDate(),
        validUntil: formState.validUntil || null,
        region: String(formState.region || '').trim() || null,
        customerSegment: String(formState.customerSegment || '').trim() || null,
        isDefault: Boolean(formState.isDefault),
        prices: normalizedPrices
      };
    }

    if (tab === 'competitors') {
      return {
        name: String(formState.name || '').trim(),
        website: String(formState.website || '').trim() || null,
        strengths: String(formState.strengths || '').trim() || null,
        weaknesses: String(formState.weaknesses || '').trim() || null,
        pricing: String(formState.pricing || '').trim() || null,
        marketShare: String(formState.marketShare || '').trim() || null,
        notes: String(formState.notes || '').trim() || null,
        isActive: Boolean(formState.isActive)
      };
    }

    if (tab === 'regions') {
      return {
        name: String(formState.name || '').trim(),
        code: String(formState.code || '').trim().toUpperCase(),
        country: String(formState.country || '').trim() || 'Brasil',
        state: String(formState.state || '').trim(),
        city: String(formState.city || '').trim(),
        isActive: Boolean(formState.isActive)
      };
    }

    if (tab === 'cross-sell') {
      return {
        name: String(formState.name || '').trim(),
        mainProductId: String(formState.mainProductId || '').trim(),
        suggestedProductId: String(formState.suggestedProductId || '').trim(),
        probability: Math.max(0, Math.min(100, Number(formState.probabilityPercent || 0))) / 100,
        discount: Number(formState.discount || 0),
        isActive: Boolean(formState.isActive)
      };
    }

    if (tab === 'upsell') {
      return {
        name: String(formState.name || '').trim(),
        mainProductId: String(formState.mainProductId || '').trim(),
        targetProductId: String(formState.targetProductId || '').trim(),
        minQuantity: Math.max(1, Number(formState.minQuantity || 1)),
        discount: Number(formState.discount || 0),
        isActive: Boolean(formState.isActive)
      };
    }

    return {};
  };

  const validatePayload = (tab, payload) => {
    if (tab === 'price-tables') return Boolean(payload.name && payload.validFrom && Array.isArray(payload.prices) && payload.prices.length > 0);
    if (tab === 'competitors') return Boolean(payload.name);
    if (tab === 'regions') return Boolean(payload.name && payload.code && payload.state && payload.city);
    if (tab === 'cross-sell') return Boolean(payload.name && payload.mainProductId && payload.suggestedProductId);
    if (tab === 'upsell') return Boolean(payload.name && payload.mainProductId && payload.targetProductId);
    return false;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const tab = modalState.tab;
    if (!tab || !endpointByTab[tab]) return;

    clearMessages();
    const payload = buildPayload(tab);
    if (!validatePayload(tab, payload)) {
      setError('Preencha os campos obrigatórios do formulário.');
      return;
    }

    setSaving(true);
    try {
      const isEdit = modalState.mode === 'edit' && modalState.itemId;
      const response = await fetch(buildApiUrl(endpointByTab[tab]), {
        method: isEdit ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(isEdit ? { ...payload, id: modalState.itemId } : payload)
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result?.error || `Falha ao salvar registro em ${tab}`);
      }

      setFeedback(isEdit ? 'Registro atualizado com sucesso.' : 'Registro criado com sucesso.');
      closeModal();
      await loadData();
    } catch (err) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tab, id) => {
    if (!id || !endpointByTab[tab]) return;
    if (!window.confirm('Deseja realmente excluir este item?')) return;

    clearMessages();
    try {
      const response = await fetch(`${buildApiUrl(endpointByTab[tab])}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result?.error || `Falha ao excluir registro em ${tab}`);
      }
      setFeedback('Registro excluído com sucesso.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Erro ao excluir');
    }
  };

  const handleApprovalAction = async (approval, action) => {
    const pendingStep = approval?.steps?.find((step) => step.status === 'PENDING');
    if (!pendingStep?.id) {
      setError('Solicitação sem etapa pendente para processar.');
      return;
    }

    setSaving(true);
    clearMessages();
    try {
      const response = await fetch(buildApiUrl('/approvals'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action,
          stepId: pendingStep.id,
          comments: approvalComment || null
        })
      });
      const result = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result?.error || `Falha ao ${action === 'approve' ? 'aprovar' : 'rejeitar'} solicitação`);
      }

      setFeedback(action === 'approve' ? 'Solicitação aprovada.' : 'Solicitação rejeitada.');
      setApprovalComment('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Erro ao processar aprovação');
    } finally {
      setSaving(false);
    }
  };

  const renderModalForm = () => {
    if (!modalState.open || !modalState.tab) return null;
    const tab = modalState.tab;

    const inputBase = 'w-full px-3 py-2 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.55)] text-[var(--crm-ink)]';

    return (
      <ActionModal
        open={modalState.open}
        title={`${modalState.mode === 'edit' ? 'Editar' : 'Novo'} ${TABS.find((item) => item.id === tab)?.label || ''}`}
        onClose={closeModal}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {tab === 'price-tables' && (
            <>
              <input className={inputBase} placeholder="Nome *" value={formState.name} onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))} />
              <textarea className={inputBase} rows={3} placeholder="Descrição" value={formState.description} onChange={(e) => setFormState((p) => ({ ...p, description: e.target.value }))} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-[var(--crm-muted)]">Válida de *</label>
                  <input type="date" className={inputBase} value={formState.validFrom} onChange={(e) => setFormState((p) => ({ ...p, validFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-[var(--crm-muted)]">Até</label>
                  <input type="date" className={inputBase} value={formState.validUntil} onChange={(e) => setFormState((p) => ({ ...p, validUntil: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={inputBase} placeholder="Região" value={formState.region} onChange={(e) => setFormState((p) => ({ ...p, region: e.target.value }))} />
                <input className={inputBase} placeholder="Segmento" value={formState.customerSegment} onChange={(e) => setFormState((p) => ({ ...p, customerSegment: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--crm-ink)]"><input type="checkbox" checked={Boolean(formState.isDefault)} onChange={(e) => setFormState((p) => ({ ...p, isDefault: e.target.checked }))} /> Tabela padrão</label>
              <div className="rounded-xl border border-[var(--crm-border)] p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[var(--crm-ink)]">Produtos da Tabela *</div>
                  <button
                    type="button"
                    className="crm-btn"
                    onClick={() =>
                      setFormState((p) => ({
                        ...p,
                        prices: [
                          ...(Array.isArray(p.prices) ? p.prices : []),
                          { productId: '', price: '', minQuantity: '1', maxQuantity: '', discount: '0' }
                        ]
                      }))
                    }
                  >
                    Adicionar Produto
                  </button>
                </div>

                {(Array.isArray(formState.prices) ? formState.prices : []).map((row, idx) => (
                  <div key={`price-row-${idx}`} className="rounded-lg border border-[var(--crm-border)] p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                    <select
                      className={inputBase}
                      value={row.productId}
                      onChange={(e) =>
                        setFormState((p) => ({
                          ...p,
                          prices: (p.prices || []).map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, productId: e.target.value } : entry
                          )
                        }))
                      }
                    >
                      <option value="">Produto *</option>
                      {productOptions.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputBase}
                      placeholder="Preço *"
                      value={row.price}
                      onChange={(e) =>
                        setFormState((p) => ({
                          ...p,
                          prices: (p.prices || []).map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, price: e.target.value } : entry
                          )
                        }))
                      }
                    />
                    <input
                      type="number"
                      min="1"
                      className={inputBase}
                      placeholder="Qtd. mín"
                      value={row.minQuantity}
                      onChange={(e) =>
                        setFormState((p) => ({
                          ...p,
                          prices: (p.prices || []).map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, minQuantity: e.target.value } : entry
                          )
                        }))
                      }
                    />
                    <input
                      type="number"
                      min="1"
                      className={inputBase}
                      placeholder="Qtd. máx"
                      value={row.maxQuantity}
                      onChange={(e) =>
                        setFormState((p) => ({
                          ...p,
                          prices: (p.prices || []).map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, maxQuantity: e.target.value } : entry
                          )
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputBase}
                        placeholder="Desc. %"
                        value={row.discount}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            prices: (p.prices || []).map((entry, entryIdx) =>
                              entryIdx === idx ? { ...entry, discount: e.target.value } : entry
                            )
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="crm-btn"
                        disabled={(formState.prices || []).length <= 1}
                        onClick={() =>
                          setFormState((p) => ({
                            ...p,
                            prices: (p.prices || []).filter((_, entryIdx) => entryIdx !== idx)
                          }))
                        }
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-[var(--crm-muted)]">
                  Informe ao menos 1 produto com preço para salvar a tabela.
                </div>
              </div>
            </>
          )}

          {tab === 'competitors' && (
            <>
              <input className={inputBase} placeholder="Nome *" value={formState.name} onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))} />
              <input className={inputBase} placeholder="Website" value={formState.website} onChange={(e) => setFormState((p) => ({ ...p, website: e.target.value }))} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <textarea className={inputBase} rows={3} placeholder="Pontos fortes" value={formState.strengths} onChange={(e) => setFormState((p) => ({ ...p, strengths: e.target.value }))} />
                <textarea className={inputBase} rows={3} placeholder="Pontos fracos" value={formState.weaknesses} onChange={(e) => setFormState((p) => ({ ...p, weaknesses: e.target.value }))} />
              </div>
              <input className={inputBase} placeholder="Faixa de preço" value={formState.pricing} onChange={(e) => setFormState((p) => ({ ...p, pricing: e.target.value }))} />
              <input className={inputBase} placeholder="Participação de mercado" value={formState.marketShare} onChange={(e) => setFormState((p) => ({ ...p, marketShare: e.target.value }))} />
              <textarea className={inputBase} rows={3} placeholder="Observações" value={formState.notes} onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm text-[var(--crm-ink)]"><input type="checkbox" checked={Boolean(formState.isActive)} onChange={(e) => setFormState((p) => ({ ...p, isActive: e.target.checked }))} /> Ativo</label>
            </>
          )}

          {tab === 'regions' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={inputBase} placeholder="Nome *" value={formState.name} onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))} />
                <input className={inputBase} placeholder="Código *" value={formState.code} onChange={(e) => setFormState((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className={inputBase} placeholder="País" value={formState.country} onChange={(e) => setFormState((p) => ({ ...p, country: e.target.value }))} />
                <input className={inputBase} placeholder="Estado *" value={formState.state} onChange={(e) => setFormState((p) => ({ ...p, state: e.target.value }))} />
                <input className={inputBase} placeholder="Cidade *" value={formState.city} onChange={(e) => setFormState((p) => ({ ...p, city: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--crm-ink)]"><input type="checkbox" checked={Boolean(formState.isActive)} onChange={(e) => setFormState((p) => ({ ...p, isActive: e.target.checked }))} /> Ativa</label>
            </>
          )}

          {tab === 'cross-sell' && (
            <>
              <input className={inputBase} placeholder="Nome da regra *" value={formState.name} onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className={inputBase} value={formState.mainProductId} onChange={(e) => setFormState((p) => ({ ...p, mainProductId: e.target.value }))}>
                  <option value="">Produto principal *</option>
                  {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                <select className={inputBase} value={formState.suggestedProductId} onChange={(e) => setFormState((p) => ({ ...p, suggestedProductId: e.target.value }))}>
                  <option value="">Produto sugerido *</option>
                  {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="number" min="0" max="100" className={inputBase} placeholder="Probabilidade (%)" value={formState.probabilityPercent} onChange={(e) => setFormState((p) => ({ ...p, probabilityPercent: e.target.value }))} />
                <input type="number" min="0" step="0.01" className={inputBase} placeholder="Desconto (%)" value={formState.discount} onChange={(e) => setFormState((p) => ({ ...p, discount: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--crm-ink)]"><input type="checkbox" checked={Boolean(formState.isActive)} onChange={(e) => setFormState((p) => ({ ...p, isActive: e.target.checked }))} /> Ativa</label>
            </>
          )}

          {tab === 'upsell' && (
            <>
              <input className={inputBase} placeholder="Nome da regra *" value={formState.name} onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select className={inputBase} value={formState.mainProductId} onChange={(e) => setFormState((p) => ({ ...p, mainProductId: e.target.value }))}>
                  <option value="">Produto base *</option>
                  {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                <select className={inputBase} value={formState.targetProductId} onChange={(e) => setFormState((p) => ({ ...p, targetProductId: e.target.value }))}>
                  <option value="">Upgrade para *</option>
                  {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="number" min="1" className={inputBase} placeholder="Quantidade mínima" value={formState.minQuantity} onChange={(e) => setFormState((p) => ({ ...p, minQuantity: e.target.value }))} />
                <input type="number" min="0" step="0.01" className={inputBase} placeholder="Desconto (%)" value={formState.discount} onChange={(e) => setFormState((p) => ({ ...p, discount: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--crm-ink)]"><input type="checkbox" checked={Boolean(formState.isActive)} onChange={(e) => setFormState((p) => ({ ...p, isActive: e.target.checked }))} /> Ativa</label>
            </>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" className="crm-btn" onClick={closeModal} disabled={saving}>Cancelar</button>
            <button type="submit" className="crm-btn crm-btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </ActionModal>
    );
  };

  return (
    <div>
      <PageHeader
        title="Funcionalidades Avancadas"
        subtitle="Tabelas, concorrentes, regioes e aprovacoes"
        icon={Rocket}
        gradient="indigo"
        breadcrumbs={['Home', 'Configuracoes', 'Avancado']}
      />

      <div className="crm-panel-muted p-2 flex flex-wrap gap-2 mb-6 motion-safe:animate-fade-in">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                clearMessages();
                setActiveTab(tab.id);
              }}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-extrabold',
                'transition-all duration-200',
                isActive
                  ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.20)] border border-[rgb(var(--crm-accent-rgb)_/_0.35)] text-[var(--crm-ink)] shadow-soft-xl'
                  : 'bg-[rgb(var(--crm-surface-rgb)_/_0.70)] border border-[color:var(--crm-border)] text-[var(--crm-ink)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.85)]'
              ].join(' ')}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {(error || feedback) && (
        <div className={[
          'mb-4 p-3 rounded-xl text-sm font-medium',
          error ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
        ].join(' ')}>
          {error || feedback}
        </div>
      )}

      <div className="crm-panel p-6">
        {loading ? (
          <div className="text-[var(--crm-muted)]">Carregando dados...</div>
        ) : (
          <AdvancedContent
            activeTab={activeTab}
            data={data}
            openCreate={openCreate}
            openEdit={openEdit}
            handleDelete={handleDelete}
            handleApprovalAction={handleApprovalAction}
            approvalComment={approvalComment}
            setApprovalComment={setApprovalComment}
            saving={saving}
          />
        )}
      </div>

      {renderModalForm()}
    </div>
  );
}

function AdvancedContent({
  activeTab,
  data,
  openCreate,
  openEdit,
  handleDelete,
  handleApprovalAction,
  approvalComment,
  setApprovalComment,
  saving
}) {
  if (activeTab === 'price-tables') {
    return (
      <ListSection
        title="Tabelas de Preço"
        actionLabel="Nova Tabela"
        onAction={() => openCreate('price-tables')}
        items={data.priceTables}
        emptyLabel="Nenhuma tabela de preço cadastrada"
        renderItem={(table) => (
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-[var(--crm-ink)] truncate">{table.name}</h3>
              <p className="mt-1 text-sm text-[var(--crm-muted)]">{table.description || '-'}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--crm-muted)]">
                <span>Válida de: {formatDateBr(table.validFrom)}</span>
                <span>até: {formatDateBr(table.validUntil)}</span>
                {table.isDefault && <span className="font-extrabold text-emerald-700 dark:text-emerald-200">PADRÃO</span>}
              </div>
              <div className="mt-3 text-sm text-[var(--crm-muted)]">
                Produtos: {Array.isArray(table.prices) ? table.prices.length : 0}
              </div>
              {Array.isArray(table.prices) && table.prices.length > 0 && (
                <div className="mt-2 text-xs text-[var(--crm-muted)] space-y-1">
                  {table.prices.slice(0, 3).map((priceRow, idx) => (
                    <div key={`${table.id}-price-${idx}`}>
                      {(priceRow.product?.name || priceRow.productId || 'Produto')} | R$ {Number(priceRow.price || 0).toFixed(2)} | Min: {priceRow.minQuantity || 1}
                    </div>
                  ))}
                  {table.prices.length > 3 && <div>+ {table.prices.length - 3} produto(s)</div>}
                </div>
              )}
            </div>
            <ActionButtons onEdit={() => openEdit('price-tables', table)} onDelete={() => handleDelete('price-tables', table.id)} />
          </div>
        )}
      />
    );
  }

  if (activeTab === 'competitors') {
    return (
      <ListSection
        title="Concorrentes"
        actionLabel="Novo Concorrente"
        onAction={() => openCreate('competitors')}
        items={data.competitors}
        emptyLabel="Nenhum concorrente cadastrado"
        renderItem={(competitor) => (
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-extrabold text-[var(--crm-ink)] truncate">{competitor.name}</h3>
              {competitor.website && <div className="text-sm text-[var(--crm-muted)] mt-1 break-all">{competitor.website}</div>}
              <div className="mt-3 text-sm text-[var(--crm-muted)]">Comparações: {competitor._count?.comparisons || 0}</div>
            </div>
            <ActionButtons onEdit={() => openEdit('competitors', competitor)} onDelete={() => handleDelete('competitors', competitor.id)} />
          </div>
        )}
      />
    );
  }

  if (activeTab === 'regions') {
    return (
      <ListSection
        title="Regiões/Carteiras"
        actionLabel="Nova Região"
        onAction={() => openCreate('regions')}
        items={data.regions}
        emptyLabel="Nenhuma região cadastrada"
        renderItem={(region) => (
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-[var(--crm-ink)]">{region.name} ({region.code})</h3>
              <div className="mt-1 text-sm text-[var(--crm-muted)]">{region.city}, {region.state} - {region.country}</div>
              <div className="mt-3 text-sm text-[var(--crm-muted)]">Usuários: {region._count?.users || 0} | Empresas: {region._count?.companies || 0}</div>
            </div>
            <ActionButtons onEdit={() => openEdit('regions', region)} onDelete={() => handleDelete('regions', region.id)} />
          </div>
        )}
      />
    );
  }

  if (activeTab === 'cross-sell') {
    return (
      <ListSection
        title="Cross-sell"
        actionLabel="Nova Regra"
        onAction={() => openCreate('cross-sell')}
        items={data.crossSell}
        emptyLabel="Nenhuma regra de cross-sell cadastrada"
        renderItem={(rule) => (
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-[var(--crm-ink)]">{rule.name}</h3>
              <div className="mt-1 text-sm text-[var(--crm-muted)]">
                {rule.mainProduct?.name || '-'} → {rule.suggestedProduct?.name || '-'}
              </div>
              <div className="mt-2 text-sm text-[var(--crm-muted)]">
                Probabilidade: {Math.round((Number(rule.probability || 0) || 0) * 100)}% | Desconto: {rule.discount || 0}%
              </div>
            </div>
            <ActionButtons onEdit={() => openEdit('cross-sell', rule)} onDelete={() => handleDelete('cross-sell', rule.id)} />
          </div>
        )}
      />
    );
  }

  if (activeTab === 'upsell') {
    return (
      <ListSection
        title="Upsell"
        actionLabel="Nova Regra"
        onAction={() => openCreate('upsell')}
        items={data.upSell}
        emptyLabel="Nenhuma regra de upsell cadastrada"
        renderItem={(rule) => (
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-[var(--crm-ink)]">{rule.name}</h3>
              <div className="mt-1 text-sm text-[var(--crm-muted)]">
                {rule.mainProduct?.name || '-'} → {rule.targetProduct?.name || '-'}
              </div>
              <div className="mt-2 text-sm text-[var(--crm-muted)]">Qtd. mínima: {rule.minQuantity || 1} | Desconto: {rule.discount || 0}%</div>
            </div>
            <ActionButtons onEdit={() => openEdit('upsell', rule)} onDelete={() => handleDelete('upsell', rule.id)} />
          </div>
        )}
      />
    );
  }

  const pendingApprovals = Array.isArray(data.approvals) ? data.approvals.filter((a) => a.status === 'PENDING') : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-extrabold text-[var(--crm-ink)]">Aprovações</h2>
        <div className="text-sm font-semibold text-[var(--crm-muted)]">{pendingApprovals.length} pendentes</div>
      </div>

      <div className="mb-4">
        <textarea
          className="w-full px-3 py-2 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.55)] text-[var(--crm-ink)]"
          rows={2}
          placeholder="Comentário da decisão (opcional)"
          value={approvalComment}
          onChange={(e) => setApprovalComment(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {data.approvals.map((approval) => {
          const pendingStep = approval?.steps?.find((step) => step.status === 'PENDING');
          return (
            <div key={approval.id} className="crm-panel-muted p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--crm-ink)]">{approval.workflow?.name || 'Workflow'} - {approval.entityType}</h3>
                  <div className="text-sm text-[var(--crm-muted)] mt-1">Solicitante: {approval.requester?.name || '-'}</div>
                  <div className="text-sm text-[var(--crm-muted)] mt-1">Status: {approval.status}</div>
                  <div className="text-xs text-[var(--crm-muted)] mt-1">Criado em: {formatDateBr(approval.createdAt)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="crm-btn crm-btn-primary"
                    disabled={!pendingStep || saving || approval.status !== 'PENDING'}
                    onClick={() => handleApprovalAction(approval, 'approve')}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="crm-btn"
                    disabled={!pendingStep || saving || approval.status !== 'PENDING'}
                    onClick={() => handleApprovalAction(approval, 'reject')}
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.approvals.length === 0 && <div className="text-center text-[var(--crm-muted)] py-10">Nenhuma solicitação de aprovação</div>}
    </div>
  );
}

function ListSection({ title, actionLabel, onAction, items, emptyLabel, renderItem }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-extrabold text-[var(--crm-ink)]">{title}</h2>
        <button onClick={onAction} className="crm-btn crm-btn-primary">{actionLabel}</button>
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="crm-panel-muted p-4 transition-transform hover:-translate-y-0.5">
            {renderItem(item)}
          </div>
        ))}
      </div>

      {items.length === 0 && <div className="text-center text-[var(--crm-muted)] py-10">{emptyLabel}</div>}
    </div>
  );
}

function ActionButtons({ onEdit, onDelete }) {
  return (
    <div className="flex gap-2">
      <button type="button" className="crm-btn" onClick={onEdit}>Editar</button>
      <button type="button" className="crm-btn" onClick={onDelete}>Excluir</button>
    </div>
  );
}
