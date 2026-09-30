import { useState, useCallback } from 'react';
import { useAuth } from './use-auth';
import { getPermissionsForRole } from '@/lib/permissions';

/**
 * Obtém o token de autenticação do CRM (localStorage)
 */
const getCRMAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export function useProposalsWithPermissions() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    if (!user || !user.role) {
      setProposals([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const permissions = getPermissionsForRole(user.role as any);

      console.log('🔍 Buscando propostas com permissões:', {
        userRole: user.role,
        userId: user.id,
        canViewAllProposals: permissions.canViewAllProposals
      });

      const response = await fetch(`/api/simulator/proposals?all=true`, {
        method: 'GET',
        headers: getCRMAuthHeaders(),
      });

      if (!response.ok) {
        // Em caso de 401, retornar array vazio silenciosamente
        if (response.status === 401 || response.status === 403) {
          console.warn('⚠️ Sem autorização para buscar propostas - usando lista vazia');
          setProposals([]);
          return;
        }
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const result = await response.json();

      // Suporta múltiplos formatos de resposta da API
      const proposalsData =
        result?.data?.proposals ||
        result?.proposals ||
        (Array.isArray(result) ? result : []);

      console.log(`✅ ${proposalsData.length} propostas carregadas para ${user.role}`);
      setProposals(proposalsData);
    } catch (error: any) {
      console.error('❌ Erro ao carregar propostas:', error);
      setError(error.message);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    proposals,
    loading,
    error,
    fetchProposals,
    setProposals
  };
}
