import { useState } from 'react';

interface UpdateCommissionParams {
  table: 'channel_seller' | 'channel_director' | 'seller' | 'channel_influencer' | 'channel_indicator';
  id: string;
  field: string;
  value: number;
}

export function useCommissionsEditor(options?: { onUpdated?: () => Promise<void> }) {
  const { onUpdated } = options ?? {};
  const [isUpdating, setIsUpdating] = useState(false);

  const updateCommission = async ({ table, id, field, value }: UpdateCommissionParams) => {
    setIsUpdating(true);
    try {
      // IDs das comissões do simulador são strings curtas por design (ex: cd_default_001)
      // e não UUIDs — a validação UUID foi removida pois bloqueava todo save.
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error('ID da comissão inválido.');
      }

      const response = await fetch('/api/simulator/commissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table,
          id,
          field,
          value
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar comissão');
      }

      // Refresh data after successful update
      if (onUpdated) {
        await onUpdated();
      }
    } catch (error) {
      console.error('Erro ao atualizar comissão:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateCommission,
    isUpdating
  };
}
