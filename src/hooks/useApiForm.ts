import { useState } from 'react';

interface UseApiFormOptions {
  endpoint: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface FormState {
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

export function useApiForm<T extends Record<string, any>>({
  endpoint,
  onSuccess,
  onError
}: UseApiFormOptions) {
  const [state, setState] = useState<FormState>({
    isLoading: false,
    error: null,
    success: null
  });

  const submitForm = async (data: T): Promise<boolean> => {
    setState({
      isLoading: true,
      error: null,
      success: null
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse = await response.json();

      if (response.ok && result.success) {
        setState({
          isLoading: false,
          error: null,
          success: result.message
        });
        
        if (onSuccess) {
          onSuccess(result.data);
        }
        
        return true;
      } else {
        const errorMessage = result.message || 'Ocorreu um erro ao enviar os dados.';
        setState({
          isLoading: false,
          error: errorMessage,
          success: null
        });
        
        if (onError) {
          onError(errorMessage);
        }
        
        return false;
      }
    } catch (error) {
      const errorMessage = 'Erro de conexão. Tente novamente.';
      console.error('Erro ao enviar formulário:', error);
      
      setState({
        isLoading: false,
        error: errorMessage,
        success: null
      });
      
      if (onError) {
        onError(errorMessage);
      }
      
      return false;
    }
  };

  const clearMessages = () => {
    setState(prev => ({
      ...prev,
      error: null,
      success: null
    }));
  };

  return {
    ...state,
    submitForm,
    clearMessages
  };
}