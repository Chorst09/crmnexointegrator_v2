import { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Package,
  Percent,
  Pencil,
  Plus,
  Tag,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import Modal from '../components/Modal';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

const initialForm = () => ({
  name: '',
  description: '',
  category: '',
  price: 0,
  margin: 0,
  active: true
});

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(initialForm);

  const produtosArray = Array.isArray(produtos) ? produtos : [];

  const loadProdutos = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.products, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setProdutos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProdutos();
  }, []);

  const openCreate = () => {
    setEditingProduct(null);
    setFormData(initialForm());
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product?.name || '',
      description: product?.description || '',
      category: product?.category || '',
      price: product?.price || 0,
      margin: product?.margin || 0,
      active: product?.active !== undefined ? product.active : true
    });
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setSaving(false);
    setEditingProduct(null);
    setFormData(initialForm());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingProduct?.id) {
        await fetch(API_ENDPOINTS.products, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...formData, id: editingProduct.id })
        });
      } else {
        await fetch(API_ENDPOINTS.products, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData)
        });
      }
      closeModal();
      loadProdutos();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id, active) => {
    try {
      await fetch(API_ENDPOINTS.products, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, active: !active })
      });
      loadProdutos();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(produtosArray.map((p) => p.category || 'Sem categoria'));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [produtosArray]);

  const filteredProdutos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return produtosArray.filter((p) => {
      const cat = p.category || 'Sem categoria';
      if (categoryFilter && cat !== categoryFilter) return false;
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;
      if (!term) return true;
      const hay = [p.name, p.description, p.category].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [produtosArray, searchTerm, categoryFilter, statusFilter]);

  const kpis = useMemo(() => {
    const total = produtosArray.length;
    const active = produtosArray.filter((p) => p.active).length;
    const inactive = total - active;
    const avgMargin =
      total > 0
        ? produtosArray.reduce((acc, p) => acc + (Number(p.margin) || 0), 0) / total
        : 0;
    const avgPrice =
      total > 0
        ? produtosArray.reduce((acc, p) => acc + (Number(p.price) || 0), 0) / total
        : 0;
    return { total, active, inactive, avgMargin, avgPrice, categories: categories.length };
  }, [produtosArray, categories.length]);

  const columns = useMemo(() => ([
    {
      key: 'name',
      label: 'Produto',
      render: (item) => (
        <div className="min-w-[240px]">
          <div className="text-sm font-extrabold text-[var(--crm-ink)]">{item.name}</div>
          <div className="mt-0.5 text-xs text-[var(--crm-muted)] truncate">{item.description || 'Sem descricao'}</div>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (item) => (
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold bg-black/5 dark:bg-white/5 text-[var(--crm-ink)]">
          {item.category || 'Sem categoria'}
        </span>
      )
    },
    {
      key: 'price',
      label: 'Preco',
      render: (item) => (
        <span className="text-sm font-extrabold text-[var(--crm-ink)]">{formatCurrency(item.price)}</span>
      )
    },
    {
      key: 'margin',
      label: 'Margem',
      render: (item) => (
        <span className="text-sm font-extrabold text-[var(--crm-ink)]">{Number(item.margin || 0).toFixed(1)}%</span>
      )
    },
    {
      key: 'active',
      label: 'Status',
      render: (item) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold',
            item.active
              ? 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
              : 'bg-slate-500/10 text-slate-800 dark:text-slate-200'
          ].join(' ')}
        >
          {item.active ? 'Ativo' : 'Inativo'}
        </span>
      )
    }
  ]), []);

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="Catalogo e precificacao"
        icon={Package}
        gradient="indigo"
        breadcrumbs={['Home', 'Produtos']}
        actions={[
          {
            label: 'Novo Produto',
            onClick: openCreate,
            icon: Plus,
            variant: 'primary'
          }
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
        <AnimatedStats title="Total" value={kpis.total} subtitle="Produtos" icon={Package} color="blue" />
        <AnimatedStats title="Ativos" value={kpis.active} subtitle="Disponiveis" icon={ToggleRight} color="green" />
        <AnimatedStats title="Inativos" value={kpis.inactive} subtitle="Desabilitados" icon={ToggleLeft} color="orange" />
        <AnimatedStats title="Categorias" value={kpis.categories} subtitle="Grupos" icon={Tag} color="purple" />
        <AnimatedStats title="Preco medio" value={Number(kpis.avgPrice.toFixed(0))} prefix="R$ " subtitle="Base" icon={DollarSign} color="yellow" />
        <AnimatedStats title="Margem media" value={Number(kpis.avgMargin.toFixed(1))} suffix="%" subtitle="Estimativa" icon={Percent} color="red" />
      </div>

      <ModernTable
        title="Catalogo"
        data={filteredProdutos}
        columns={columns}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          {
            label: 'Categoria',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: categories.map((c) => ({ value: c, label: c }))
          },
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'active', label: 'Ativos' },
              { value: 'inactive', label: 'Inativos' }
            ]
          }
        ]}
        loading={loading}
        onEdit={openEdit}
        renderActions={(item) => (
          <>
            <button
              type="button"
              onClick={() => openEdit(item)}
              className="crm-btn crm-btn-secondary px-3 py-1.5 text-xs"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              onClick={() => toggleActive(item.id, item.active)}
              className="crm-btn crm-btn-ghost px-3 py-1.5 text-xs"
              title={item.active ? 'Desativar' : 'Ativar'}
            >
              {item.active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
              {item.active ? 'Desativar' : 'Ativar'}
            </button>
          </>
        )}
      />

      <Modal isOpen={showForm} onClose={closeModal} title={editingProduct ? 'Editar Produto' : 'Novo Produto'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Nome *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="crm-input"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Descricao</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="crm-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Categoria</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                className="crm-input"
                placeholder="Ex: Hardware, Servicos..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Preco</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData((p) => ({ ...p, price: Number(e.target.value) }))}
                className="crm-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">Margem (%)</label>
              <input
                type="number"
                step="0.1"
                value={formData.margin}
                onChange={(e) => setFormData((p) => ({ ...p, margin: Number(e.target.value) }))}
                className="crm-input"
              />
            </div>

            <div className="flex items-center gap-3 sm:justify-end">
              <input
                id="active"
                type="checkbox"
                checked={!!formData.active}
                onChange={(e) => setFormData((p) => ({ ...p, active: e.target.checked }))}
                className="h-4 w-4 rounded border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.86)]"
              />
              <label htmlFor="active" className="text-sm font-semibold text-[var(--crm-ink)]">
                Produto ativo
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button type="button" onClick={closeModal} className="crm-btn crm-btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary">
              {saving ? 'Salvando...' : editingProduct ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
