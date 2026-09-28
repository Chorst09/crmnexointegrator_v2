'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { normalizeUserRole } from '@/lib/permissions';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAnyAdmin, setHasAnyAdmin] = useState(true);
  const [loading, setLoading] = useState(true);

  const checkAdminStatus = useCallback(async () => {
    try {
      // Check if any admin exists in the system - usar tabela profiles
      const response = await fetch('/api/profiles?limit=500', {
        credentials: 'include'
      });

      let adminUsers = null;
      let error = null;

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          adminUsers = result.data;
        } else {
          error = result.error;
        }
      } else {
        error = `HTTP ${response.status}`;
      }

      if (error) {
        console.error('Erro ao verificar admins:', error);
        // Se houver erro, assumir que não há admin para mostrar setup
        setHasAnyAdmin(false);
      } else {
        const hasAdmin = Array.isArray(adminUsers)
          ? adminUsers.some((profile: any) => normalizeUserRole(profile?.role) === 'admin')
          : false;
        setHasAnyAdmin(hasAdmin);
      }

      // Check if current user is admin
      setIsAdmin(normalizeUserRole(user?.role) === 'admin');

      console.log('Admin check result:', {
        hasAdmin: adminUsers && adminUsers.length > 0,
        userRole: user?.role,
        tableName: 'profiles'
      });

    } catch (error) {
      console.error('Erro ao verificar status de admin:', error);
      // If there's an error, assume no admin exists to show setup
      setHasAnyAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    checkAdminStatus();
  }, [user, checkAdminStatus]);

  return {
    isAdmin,
    hasAnyAdmin,
    loading,
    checkAdminStatus
  };
}
