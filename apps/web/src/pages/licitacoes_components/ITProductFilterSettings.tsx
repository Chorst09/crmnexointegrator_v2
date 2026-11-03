import React, { useState } from 'react';
import { Filter, RotateCcw, X } from 'lucide-react';
import { DEFAULT_IT_PRODUCTS, normalizeITText } from '../../../../api/lib/itNoticeFilter.mjs';
import { saveITProductPreferences, useITProductPreferences, ITProductPreferences } from './itProductPreferences';

export function ITProductFilterSettings() {
  const preferences = useITProductPreferences();
  const [product, setProduct] = useState('');
  const [error, setError] = useState('');
  const save = (next: ITProductPreferences) => {
    try { saveITProductPreferences(next); setError(''); }
    catch { setError('Não foi possível salvar a configuração neste navegador. Tente novamente.'); }
  };
  const addProduct = (event: React.FormEvent) => {
    event.preventDefault();
    const next = product.trim();
    if (!next) return;
    if (preferences.products.some(value => normalizeITText(value) === normalizeITText(next))) {
      setError('Esse produto já está na lista.'); return;
    }
    if (preferences.products.length >= 64) { setError('A lista aceita até 64 produtos de interesse.'); return; }
    save({ ...preferences, products: [...preferences.products, next] });
    setProduct('');
  };
  return (
    <section className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 space-y-4" aria-labelledby="it-products-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="it-products-heading" className="flex items-center gap-2 text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]"><Filter className="h-5 w-5 text-cyan-700 dark:text-cyan-400" />Filtro Automático de Produtos de TI</h2>
        <label className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] cursor-pointer">
          <input type="checkbox" checked={preferences.enabled} onChange={event => save({ ...preferences, enabled: event.target.checked })} aria-label="Descoberta automática de produtos de TI" className="h-4 w-4 accent-cyan-500" />
          {preferences.enabled ? 'Ativo' : 'Busca manual'}
        </label>
      </div>
      <p className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Ativo: descubra editais de TI automaticamente. No modo manual, digite o produto na busca. Nos dois modos, editais de outros segmentos são descartados.</p>
      <div>
        <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Produtos de interesse</h3>
        <p className="mt-1 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">A lista destaca produtos nos editais e não limita os resultados: outros produtos de TI também aparecem. Adicionar um termo não libera editais de outros segmentos.</p>
      </div>
      <form onSubmit={addProduct} className="flex flex-col gap-2 sm:flex-row">
        <input value={product} onChange={event => setProduct(event.target.value)} maxLength={60} placeholder="Adicionar produto de TI de interesse…" aria-label="Adicionar produto de interesse" className="min-w-0 flex-1 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] outline-none focus:border-cyan-400" />
        <button type="submit" disabled={!product.trim()} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">Adicionar produto</button>
      </form>
      {error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
      <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.5)] p-3">
        {preferences.products.map(value => <span key={value} className="inline-flex items-center gap-1 rounded-full border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/60 px-3 py-1 text-xs text-cyan-700 dark:text-cyan-200">{value}<button type="button" onClick={() => save({ ...preferences, products: preferences.products.filter(item => item !== value) })} aria-label={`Remover ${value}`} className="rounded-full p-1 hover:bg-cyan-50 dark:hover:bg-cyan-900"><X className="h-3 w-3" /></button></span>)}
        {!preferences.products.length && <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Sem produtos destacados. A descoberta automática continua buscando todos os editais de TI.</p>}
      </div>
      <button type="button" onClick={() => save({ enabled: true, products: [...DEFAULT_IT_PRODUCTS] })} className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:text-cyan-700 dark:hover:text-cyan-100"><RotateCcw className="h-3.5 w-3.5" />Restaurar padrão</button>
      <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Preferências salvas para seu usuário neste navegador.</p>
    </section>
  );
}
