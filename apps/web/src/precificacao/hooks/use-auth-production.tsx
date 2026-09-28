// src/hooks/use-auth-production.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string | null;
  role: 'admin' | 'diretor' | 'user';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Ensure we're on client side
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    let mounted = true;
    let authSubscription: any = null;

    const initAuth = async () => {
      try {
        console.log('🔄 [PROD] Inicializando auth...');
        
        // Wait a bit to ensure client is fully hydrated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!mounted) return;

        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (!response.ok) {
          console.log('ℹ️ [PROD] Nenhum usuário logado');
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const result = await response.json();
        
        if (result.success && result.data.user && mounted) {
          console.log('👤 [PROD] Usuário encontrado:', result.data.user.email);
          await processUser(result.data.user);
        } else if (mounted) {
          console.log('ℹ️ [PROD] Nenhum usuário logado');
          setUser(null);
          setLoading(false);
        }

        // Setup periodic check via API
        const interval = setInterval(async () => {
          if (!mounted) return;
          
          try {
            const checkResponse = await fetch('/api/auth/me', {
              credentials: 'include'
            });
            
            if (checkResponse.ok) {
              const checkResult = await checkResponse.json();
              if (checkResult.success && checkResult.data.user) {
                await processUser(checkResult.data.user);
              } else {
                setUser(null);
              }
            } else {
              setUser(null);
            }
          } catch (error) {
            console.error('❌ [PROD] Erro na verificação periódica:', error);
          }
        }, 30000); // Verificar a cada 30 segundos

        authSubscription = { unsubscribe: () => clearInterval(interval) };

      } catch (error) {
        console.error('❌ [PROD] Erro na inicialização:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    const processUser = async (userData: any) => {
      if (!mounted) return;

      try {
        if (mounted) {
          setUser({
            id: userData.id,
            email: userData.email || null,
            role: userData.role || 'user'
          });
          setLoading(false);
          console.log('✅ [PROD] Usuário processado:', { email: userData.email, role: userData.role });
        }
      } catch (error) {
        console.error('❌ [PROD] Erro ao processar usuário:', error);
        if (mounted) {
          setUser({
            id: userData.id,
            email: userData.email || null,
            role: 'user'
          });
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [isClient]);

  const logout = async () => {
    try {
      console.log('🚪 [PROD] Fazendo logout...');
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (error) {
      console.error('❌ [PROD] Erro no logout:', error);
    }
  };

  // Show loading until client is ready
  if (!isClient) {
    return (
      <AuthContext.Provider value={{ user: null, loading: true, logout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
