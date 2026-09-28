/**
 * Limpa completamente a sessão de autenticação
 * Útil quando há problemas com tokens
 */
export const clearAuthSession = async () => {
  try {
    // Fazer logout via API
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.warn('Erro ao fazer logout via API:', error);
  }

  // Limpar TODOS os dados de storage
  if (typeof window !== 'undefined') {
    // Limpar completamente localStorage
    localStorage.clear();
    
    // Limpar completamente sessionStorage
    sessionStorage.clear();
    
    // Limpar cookies de autenticação
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
  }
};

/**
 * Reset completo da autenticação - força um estado limpo
 */
export const forceAuthReset = async () => {
  console.log('🔄 Forçando reset completo da autenticação...');
  
  // Limpar sessão
  await clearAuthSession();
  
  if (typeof window !== 'undefined') {
    // Aguardar um pouco para garantir que tudo foi limpo
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Recarregar a página para garantir estado limpo
    window.location.reload();
  }
};

/**
 * Verifica se o erro é relacionado a token de autenticação
 */
export const isAuthTokenError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';
  
  return (
    errorMessage.includes('token') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('invalid') ||
    errorName.includes('autherror')
  );
};

/**
 * Tenta recuperar a sessão ou limpa se inválida
 */
export const recoverOrClearSession = async () => {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.log('🔄 Sessão inválida detectada, limpando...');
      await clearAuthSession();
      return null;
    }
    
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Erro ao recuperar sessão:', error);
    if (isAuthTokenError(error)) {
      await clearAuthSession();
    }
    return null;
  }
};