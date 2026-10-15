import { useEffect, useState } from 'react';
import { DEFAULT_IT_PRODUCTS, sanitizeInterestProducts } from '../../../../api/lib/itNoticeFilter.mjs';

export const IT_PRODUCTS_EVENT = 'b2g-it-products-changed';
export type ITProductPreferences = { enabled: boolean; products: string[] };

export function getITProductsStorageKey() {
  let user: any = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* Sessão ainda não carregada. */ }
  return `b2g-it-products-v1:${user.tenantCompanyId || 'global'}:${user.id || user.userId || 'anonymous'}`;
}

export function readITProductPreferences(): ITProductPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(getITProductsStorageKey()) || 'null');
    return { enabled: value?.enabled !== false, products: sanitizeInterestProducts(value?.products) };
  } catch { return { enabled: true, products: [...DEFAULT_IT_PRODUCTS] }; }
}

export function saveITProductPreferences(value: ITProductPreferences) {
  const preferences = { enabled: value.enabled, products: sanitizeInterestProducts(value.products) };
  localStorage.setItem(getITProductsStorageKey(), JSON.stringify(preferences));
  window.dispatchEvent(new Event(IT_PRODUCTS_EVENT));
}

export function useITProductPreferences() {
  const [preferences, setPreferences] = useState(readITProductPreferences);
  useEffect(() => {
    const refresh = () => setPreferences(readITProductPreferences());
    const storage = (event: StorageEvent) => { if (!event.key || event.key === getITProductsStorageKey()) refresh(); };
    window.addEventListener(IT_PRODUCTS_EVENT, refresh);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(IT_PRODUCTS_EVENT, refresh); window.removeEventListener('storage', storage); };
  }, []);
  return preferences;
}
