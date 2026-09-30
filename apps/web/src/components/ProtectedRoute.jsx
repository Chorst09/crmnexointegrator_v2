import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await fetch(API_ENDPOINTS.auth.me, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(true);
          setUserRole(data.user.role);
          
          // Atualizar dados do usuário no localStorage
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          // Token inválido ou erro de autorização
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Erro na verificação de autenticação:', error);
        // Em caso de erro de rede, assumir não autenticado
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="crm-panel px-5 py-4 flex items-center gap-3 motion-safe:animate-scale-in">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <div className="text-sm font-semibold text-[var(--crm-muted)]">Verificando sessao...</div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && !requiredRole.includes(userRole)) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="crm-panel p-8 text-center max-w-lg motion-safe:animate-fade-up">
          <h1 className="text-2xl font-bold text-[var(--crm-ink)] mb-2">Acesso negado</h1>
          <p className="text-[var(--crm-muted)]">Voce nao tem permissao para acessar esta pagina.</p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
