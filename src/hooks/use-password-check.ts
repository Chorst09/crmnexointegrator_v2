import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';

interface PasswordCheckResult {
  needsPasswordChange: boolean;
  loading: boolean;
  error: string | null;
  checkComplete: boolean;
}

export function usePasswordCheck(): PasswordCheckResult {
  const { user } = useAuth();
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkComplete, setCheckComplete] = useState(false);

  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!user?.id) {
        setLoading(false);
        setCheckComplete(true);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if user needs to change password
        const response = await fetch(`/api/profiles/${user.id}`, {
          credentials: 'include'
        });
        
        let profile = null;
        let profileError = null;
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            profile = result.data;
          } else {
            profileError = result.error;
          }
        } else {
          profileError = `HTTP ${response.status}`;
        }

        if (profileError) {
          console.error('Erro ao verificar status da senha:', profileError?.message || profileError);
          setError('Erro ao verificar status da senha');
          setNeedsPasswordChange(false);
        } else {
          // User needs to change password if password_changed is false OR null
          const needsChange = (profile.password_changed === false || profile.password_changed === null);
          
          console.log('Password check result:', {
            userId: user.id,
            passwordChanged: profile.password_changed,
            needsChange
          });
          
          setNeedsPasswordChange(needsChange);
        }
      } catch (err: any) {
        console.error('Erro na verificação de senha:', err);
        setError(err.message || 'Erro na verificação de senha');
        setNeedsPasswordChange(false);
      } finally {
        setLoading(false);
        setCheckComplete(true);
      }
    };

    checkPasswordStatus();
  }, [user?.id]);

  return {
    needsPasswordChange,
    loading,
    error,
    checkComplete
  };
}

// Hook para marcar que a senha foi alterada
export function useMarkPasswordChanged() {
  const { user } = useAuth();

  const markPasswordChanged = async (): Promise<boolean> => {
    if (!user?.id) {
      return false;
    }

    try {
      const response = await fetch(`/api/profiles/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          password_changed: true,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erro ao atualizar perfil');
      }



      return true;
    } catch (err) {
      console.error('Erro ao marcar senha como alterada:', err);
      return false;
    }
  };

  return { markPasswordChanged };
}