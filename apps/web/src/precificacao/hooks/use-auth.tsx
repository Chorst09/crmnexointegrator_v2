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

/**
 * Converte o usuário do CRM para o formato do Simulador
 */
const crmUserToProfile = (crmUser: any): UserProfile | null => {
  if (!crmUser) return null;
  
  // Ler o token JWT do localStorage (salvo pelo CRM após login)
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('token') || '')
    : '';

  return {
    id: crmUser.id || '',
    email: crmUser.email || '',
    full_name: crmUser.name || crmUser.full_name || '',
    role: (crmUser.role || 'user').toLowerCase(),
    token, // ← Token JWT do CRM para autenticar chamadas de API
    createdAt: crmUser.createdAt || new Date().toISOString(),
    emailConfirmed: true,
    accountStatus: 'approved',
    companyId: crmUser.companyId || null
  };
};

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
        console.log('🔄 Inicializando autenticação do CRM via localStorage...');
        
        // Ler o usuário do localStorage (onde o CRM salva após login)
        const userRaw = localStorage.getItem('user');
        
        if (userRaw) {
          try {
            const crmUser = JSON.parse(userRaw);
            const profile = crmUserToProfile(crmUser);
            
            if (profile) {
              console.log('✅ Usuário do CRM encontrado:', profile.email, '- Role:', profile.role);
              if (mountedRef.current) {
                setUser(profile);
              }
            }
          } catch (parseError) {
            console.error('❌ Erro ao parsear usuário do localStorage:', parseError);
          }
        } else {
          console.log('📋 Nenhum usuário logado no CRM');
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

    // Listener para mudanças no localStorage (quando o usuário faz login/logout no CRM)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        if (e.newValue) {
          try {
            const crmUser = JSON.parse(e.newValue);
            const profile = crmUserToProfile(crmUser);
            if (profile && mountedRef.current) {
              console.log('🔄 Usuário atualizado via storage event:', profile.email);
              setUser(profile);
            }
          } catch (error) {
            console.error('❌ Erro ao processar storage event:', error);
          }
        } else {
          // Usuário foi removido (logout)
          if (mountedRef.current) {
            console.log('👋 Usuário deslogado via storage event');
            setUser(null);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // No CRM integrado, o login é feito pela página de login do CRM
    console.warn('⚠️ Login deve ser feito pela página de login do CRM');
    return false;
  };

  const signup = async (email: string, password: string, fullName: string, role?: string): Promise<boolean> => {
    // No CRM integrado, o signup é feito pelo admin
    console.warn('⚠️ Signup deve ser feito pelo administrador do CRM');
    return false;
  };

  const logout = async (): Promise<void> => {
    // No CRM integrado, o logout deve ser feito pela função de logout do CRM
    console.warn('⚠️ Logout deve ser feito pela página de logout do CRM');
    if (mountedRef.current) {
      setUser(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const crmUser = JSON.parse(userRaw);
        const profile = crmUserToProfile(crmUser);
        if (profile && mountedRef.current) {
          console.log('🔄 Usuário atualizado:', profile.email);
          setUser(profile);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
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
