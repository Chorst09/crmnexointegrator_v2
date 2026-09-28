/**
 * Hook personalizado para gerenciar estado das calculadoras
 */

import { useState, useCallback, useEffect } from 'react';
import { calculatorNotifications } from '@/lib/utils/notifications';

export interface CalculatorState<T = any> {
  data: T;
  hasChanged: boolean;
  isLoading: boolean;
  errors: Record<string, string>;
}

export interface UseCalculatorStateOptions<T> {
  initialData: T;
  validateFn?: (data: T) => Record<string, string>;
  onSave?: (data: T) => Promise<void>;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export function useCalculatorState<T>({
  initialData,
  validateFn,
  onSave,
  autoSave = false,
  autoSaveDelay = 2000
}: UseCalculatorStateOptions<T>) {
  const [state, setState] = useState<CalculatorState<T>>({
    data: initialData,
    hasChanged: false,
    isLoading: false,
    errors: {}
  });

  // Update data
  const updateData = useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    setState(prev => {
      const newData = typeof updates === 'function' 
        ? updates(prev.data)
        : { ...prev.data, ...updates };

      const errors = validateFn ? validateFn(newData) : {};

      return {
        ...prev,
        data: newData,
        hasChanged: true,
        errors
      };
    });
  }, [validateFn]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      data: initialData,
      hasChanged: false,
      isLoading: false,
      errors: {}
    });
  }, [initialData]);

  // Save data
  const save = useCallback(async () => {
    if (!onSave) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await onSave(state.data);
      setState(prev => ({ 
        ...prev, 
        hasChanged: false, 
        isLoading: false 
      }));
      calculatorNotifications.configurationSaved();
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      calculatorNotifications.configurationError(
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    }
  }, [onSave, state.data]);

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !state.hasChanged || Object.keys(state.errors).length > 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      save();
    }, autoSaveDelay);

    return () => clearTimeout(timeoutId);
  }, [autoSave, autoSaveDelay, state.hasChanged, state.errors, save]);

  // Validation status
  const isValid = Object.keys(state.errors).length === 0;

  return {
    ...state,
    isValid,
    updateData,
    reset,
    save,
    setLoading: (loading: boolean) => 
      setState(prev => ({ ...prev, isLoading: loading })),
    setErrors: (errors: Record<string, string>) =>
      setState(prev => ({ ...prev, errors }))
  };
}

// Hook específico para dados de cliente
export interface ClientData {
  name: string;
  contact: string;
  projectName: string;
  email: string;
  phone: string;
}

export function useClientData(initialData?: Partial<ClientData>) {
  const validateClient = (data: ClientData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!data.name?.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (!data.email?.trim()) {
      errors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Email inválido';
    }

    if (!data.phone?.trim()) {
      errors.phone = 'Telefone é obrigatório';
    }

    return errors;
  };

  return useCalculatorState({
    initialData: {
      name: '',
      contact: '',
      projectName: '',
      email: '',
      phone: '',
      ...initialData
    },
    validateFn: validateClient
  });
}

// Hook específico para dados do gerente de contas
export interface AccountManagerData {
  name: string;
  email: string;
  phone: string;
  distributorId?: string;
}

export function useAccountManagerData(initialData?: Partial<AccountManagerData>) {
  const validateAccountManager = (data: AccountManagerData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!data.name?.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    if (!data.email?.trim()) {
      errors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Email inválido';
    }

    if (!data.phone?.trim()) {
      errors.phone = 'Telefone é obrigatório';
    }

    return errors;
  };

  return useCalculatorState({
    initialData: {
      name: '',
      email: '',
      phone: '',
      distributorId: '',
      ...initialData
    },
    validateFn: validateAccountManager
  });
}

// Hook para gerenciar propostas
export interface ProposalData {
  title: string;
  client: string | ClientData;
  accountManager: string;
  type: string;
  status: string;
  value: number;
  contractPeriod: number;
}

export function useProposalData(initialData?: Partial<ProposalData>) {
  const validateProposal = (data: ProposalData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!data.title?.trim()) {
      errors.title = 'Título é obrigatório';
    }

    if (!data.client) {
      errors.client = 'Cliente é obrigatório';
    }

    if (data.value < 0) {
      errors.value = 'Valor não pode ser negativo';
    }

    if (data.contractPeriod <= 0) {
      errors.contractPeriod = 'Período contratual deve ser maior que zero';
    }

    return errors;
  };

  return useCalculatorState({
    initialData: {
      title: '',
      client: '',
      accountManager: '',
      type: 'GENERAL',
      status: 'Rascunho',
      value: 0,
      contractPeriod: 12,
      ...initialData
    },
    validateFn: validateProposal
  });
}