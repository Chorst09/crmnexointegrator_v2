import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { normalizeUserRole } from '@/lib/permissions';

import { UserRole } from '@/lib/types';

export type { UserRole };

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export interface UseUserProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  isDirector: boolean;
  isUser: boolean;
  canAccessCommissions: boolean;
  canAccessPricing: boolean;
  canAccessDRE: boolean;
  canViewAllProposals: boolean;
  refreshProfile: () => Promise<void>;
  updateRole: (userId: string, newRole: UserRole) => Promise<boolean>;
}

export function useUserProfile(): UseUserProfileResult {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Buscar perfil via API
      console.log('🔍 Buscando perfil para usuário:', user.id, user.email);

      const response = await fetch(`/api/profiles/${user.id}`, {
        credentials: 'include'
      });

      let data = null;
      let profileError = null;

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          data = result.data;
        } else {
          profileError = result.error;
        }
      } else {
        profileError = `HTTP ${response.status}`;
      }

      console.log('📊 Resultado da busca:', { data, error: profileError });

      if (profileError || !data) {
        console.log('⚠️ Perfil não encontrado, criando perfil básico');

        // Criar perfil básico com o menor privilégio para evitar elevação indevida
        const profileData: UserProfile = {
          id: user.id,
          email: user.email || '',
          role: 'user',
          full_name: user.name || user.email || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setProfile(profileData);

        // Tentar criar perfil via API (sem bloquear se falhar)
        try {
          console.log('💾 Tentando criar perfil via API');
          const createResponse = await fetch('/api/profiles', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(profileData)
          });

          if (createResponse.ok) {
            console.log('✅ Perfil criado com sucesso');
          }
        } catch (insertErr) {
          console.warn('⚠️ Não foi possível criar perfil:', insertErr);
        }
      } else {
        console.log('✅ Perfil encontrado:', data);
        setProfile(data);
      }
    } catch (err) {
      console.error('Erro ao buscar perfil do usuário:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil');

      // Fallback final: usar dados básicos como admin
      if (user) {
        console.log('🆘 Fallback final - criando perfil user');
        setProfile({
          id: user.id,
          email: user.email || '',
          role: 'user',
          full_name: user.name || user.email || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateRole = async (userId: string, newRole: UserRole): Promise<boolean> => {
    try {
      // Verificar se o usuário atual é admin
      if (normalizeUserRole(profile?.role) !== 'admin') {
        throw new Error('Apenas administradores podem alterar roles');
      }

      const response = await fetch(`/api/profiles/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          role: newRole,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao atualizar role');
      }

      // Se está atualizando o próprio perfil, recarregar
      if (userId === user?.id) {
        await fetchProfile();
      }

      return true;
    } catch (err) {
      console.error('Erro ao atualizar role:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar role');
      return false;
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [authLoading, user, fetchProfile]);

  // Computed properties baseadas no role
  const normalizedProfileRole = normalizeUserRole(profile?.role);
  const isAdmin = normalizedProfileRole === 'admin';
  const isDirector = normalizedProfileRole === 'director';
  const isUser = normalizedProfileRole === 'user';

  // Permissões baseadas no role
  const canAccessCommissions = isAdmin || isDirector; // Admin e Director podem ver comissões
  const canAccessPricing = isAdmin || isDirector; // Admin e Director podem ver tabelas de preços
  const canAccessDRE = isAdmin || isDirector; // Admin e Director podem ver DRE
  const canViewAllProposals = isAdmin || isDirector; // Admin e Diretor podem ver todas as propostas

  return {
    profile,
    isLoading,
    error,
    isAdmin,
    isDirector,
    isUser,
    canAccessCommissions,
    canAccessPricing,
    canAccessDRE,
    canViewAllProposals,
    refreshProfile: fetchProfile,
    updateRole
  };
}

// Hook para verificar permissões específicas
export function usePermissions() {
  const {
    canAccessCommissions,
    canAccessPricing,
    canAccessDRE,
    canViewAllProposals,
    isAdmin,
    isDirector,
    isUser
  } = useUserProfile();

  const checkPermission = (permission: string): boolean => {
    switch (permission) {
      case 'commissions':
        return canAccessCommissions;
      case 'pricing':
        return canAccessPricing;
      case 'dre':
        return canAccessDRE;
      case 'all_proposals':
        return canViewAllProposals;
      case 'admin_only':
        return isAdmin;
      case 'director_or_admin':
        return isDirector || isAdmin;
      default:
        return false;
    }
  };

  return {
    checkPermission,
    canAccessCommissions,
    canAccessPricing,
    canAccessDRE,
    canViewAllProposals,
    isAdmin,
    isDirector,
    isUser
  };
}
