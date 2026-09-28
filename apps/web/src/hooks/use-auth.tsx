"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { UserProfile } from '@/lib/types';

// Define o tipo para o contexto de autenticação
interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, fullName: string, role?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    setIsMounted(true);
    mountedRef.current = true;
    
    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação PostgreSQL...');
        
        // Verificar se há um usuário logado
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.user) {
            console.log('✅ Usuário encontrado:', result.data.user.email);
            if (mountedRef.current) {
              setUser(result.data.user);
            }
          }
        } else {
          console.log('📋 Nenhuma sessão válida encontrada');
        }
      } catch (error) {
        console.error('❌ Erro na inicialização da auth:', error);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success && result.data.user) {
        if (mountedRef.current) {
          setUser(result.data.user);
        }
        return true;
      } else {
        console.error('Login failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const signup = async (email: string, password: string, fullName: string, role: string = 'user'): Promise<boolean> => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, full_name: fullName, role }),
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success && result.data.user) {
        if (mountedRef.current) {
          setUser(result.data.user);
        }
        return true;
      } else {
        console.error('Signup failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (mountedRef.current) {
        setUser(null);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.user) {
          if (mountedRef.current) {
            setUser(result.data.user);
          }
        }
      } else {
        if (mountedRef.current) {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      if (mountedRef.current) {
        setUser(null);
      }
    }
  };

  if (!isMounted) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0f172a',
        color: 'white'
      }}>
        Carregando...
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0f172a',
        color: 'white'
      }}>
        Autenticando...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
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