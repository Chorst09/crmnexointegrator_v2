// src/hooks/use-auth-simple.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define o tipo para o objeto de usuário, incluindo a role
interface User {
  id: string;
  email: string | null;
  role: 'admin' | 'diretor' | 'user';
}

// Define o tipo para o contexto de autenticação
interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    const checkUser = async () => {
      try {
        console.log('🔍 Verificando usuário atual...');
        
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (!response.ok) {
          console.log('❌ Nenhum usuário autenticado');
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const result = await response.json();
        
        if (result.success && result.data.user && isMounted) {
          console.log('👤 Usuário encontrado:', result.data.user.email);
          
          setUser({
            id: result.data.user.id,
            email: result.data.user.email || null,
            role: result.data.user.role || 'user'
          });
        } else if (isMounted) {
          console.log('❌ Nenhum usuário encontrado');
          setUser(null);
        }

        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Erro na verificação de usuário:', error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    // Verificação inicial
    checkUser();

    // Verificação periódica simples via API
    const interval = setInterval(() => {
      if (isMounted) {
        checkUser();
      }
    }, 30000); // Verificar a cada 30 segundos

    subscription = { unsubscribe: () => clearInterval(interval) };

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []); // SEM DEPENDÊNCIAS - isso é crucial

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook customizado para usar o contexto de autenticação
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
