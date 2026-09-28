/**
 * Sistema de notificações centralizado para as calculadoras
 */

import { toast } from "sonner";

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Exibe uma notificação de sucesso
 */
export const showSuccessNotification = (
  message: string,
  options?: NotificationOptions
) => {
  toast.success(message, {
    description: options?.description,
    duration: options?.duration || 4000,
    action: options?.action
  });
};

/**
 * Exibe uma notificação de erro
 */
export const showErrorNotification = (
  message: string,
  options?: NotificationOptions
) => {
  toast.error(message, {
    description: options?.description,
    duration: options?.duration || 6000,
    action: options?.action
  });
};

/**
 * Exibe uma notificação de aviso
 */
export const showWarningNotification = (
  message: string,
  options?: NotificationOptions
) => {
  toast.warning(message, {
    description: options?.description,
    duration: options?.duration || 5000,
    action: options?.action
  });
};

/**
 * Exibe uma notificação informativa
 */
export const showInfoNotification = (
  message: string,
  options?: NotificationOptions
) => {
  toast.info(message, {
    description: options?.description,
    duration: options?.duration || 4000,
    action: options?.action
  });
};

/**
 * Notificações específicas para operações das calculadoras
 */
export const calculatorNotifications = {
  proposalSaved: (proposalId: string) => {
    showSuccessNotification(
      'Proposta salva com sucesso!',
      {
        description: `ID: ${proposalId}`,
        action: {
          label: 'Ver propostas',
          onClick: () => {
            // Implementar navegação para lista de propostas
            console.log('Navegar para propostas');
          }
        }
      }
    );
  },

  proposalSaveError: (error: string) => {
    showErrorNotification(
      'Erro ao salvar proposta',
      {
        description: error,
        duration: 8000
      }
    );
  },

  proposalLoaded: (proposalTitle: string) => {
    showInfoNotification(
      'Proposta carregada',
      {
        description: `"${proposalTitle}" foi carregada para edição`
      }
    );
  },

  proposalDeleted: (proposalTitle: string) => {
    showSuccessNotification(
      'Proposta excluída',
      {
        description: `"${proposalTitle}" foi removida`
      }
    );
  },

  configurationSaved: () => {
    showSuccessNotification(
      'Configurações salvas',
      {
        description: 'As alterações foram aplicadas com sucesso'
      }
    );
  },

  configurationError: (error: string) => {
    showErrorNotification(
      'Erro ao salvar configurações',
      {
        description: error
      }
    );
  },

  paybackWarning: (actualPayback: number, maxPayback: number) => {
    showWarningNotification(
      'Payback acima do limite',
      {
        description: `Payback de ${actualPayback} meses excede o limite de ${maxPayback} meses`,
        duration: 6000
      }
    );
  },

  validationError: (field: string, message: string) => {
    showErrorNotification(
      `Erro de validação: ${field}`,
      {
        description: message
      }
    );
  },

  dataImported: (count: number) => {
    showSuccessNotification(
      'Dados importados',
      {
        description: `${count} item(s) foram importados com sucesso`
      }
    );
  },

  exportCompleted: (filename: string) => {
    showSuccessNotification(
      'Exportação concluída',
      {
        description: `Arquivo "${filename}" foi gerado`
      }
    );
  }
};

/**
 * Notificação de loading com promise
 */
export const showLoadingNotification = async <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
): Promise<T> => {
  const result = await toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error
  });
  return result as T;
};