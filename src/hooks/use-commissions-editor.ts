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
      const isUuid =
        typeof id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (!isUuid) {
        // Isso acontece quando o app está usando dados de fallback (IDs como "cd_default_001").
        // Evita estourar erro do Prisma e informa o usuário.
        throw new Error('Não foi possível salvar: comissões ainda não carregadas do banco (ID inválido).');
      }

      const response = await fetch('/api/commissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table,
          data: {
            id,
            [field]: value
          }
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
