/**
 * Helpers de API para o módulo Simuladores/Precificação
 * Integrado com o sistema de autenticação do CRM (localStorage)
 */

/**
 * Retorna os headers de autenticação do CRM
 * O token é salvo em localStorage.getItem('token') após o login
 */
export const getCRMAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

/**
 * Wrapper de fetch que inclui automaticamente o token do CRM
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  return fetch(url, {
    ...options,
    headers: {
      ...getCRMAuthHeaders(),
      ...(options.headers || {}),
    },
  });
};

/**
 * URL base da API do CRM
 */
export const buildApiUrl = (path: string): string => {
  const base = '/api';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};
