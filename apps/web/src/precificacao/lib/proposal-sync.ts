/**
 * Sincronização de Propostas em Tempo Real
 * 
 * Fornece utilitários para manter propostas sincronizadas entre usuários
 * quando dados são alterados por admin ou outros usuários
 */

/**
 * Setup listeners para auto-refresh de propostas
 * Chamado por componentes que usam useProposalsWithPermissions
 * 
 * @param fetchProposals Função de callback para recarregar propostas
 * @param loadingProposals Estado de carregamento (para evitar requests simultâneos)
 * @returns Função cleanup para remover listeners
 */
export function setupProposalSyncListeners(
  fetchProposals: () => void | Promise<void>,
  loadingProposals?: boolean
): () => void {
  const handleProposalUpdated = () => {
    if (loadingProposals) return; // Evitar requisições simultâneas
    console.log('📢 Proposta foi atualizada, recarregando...');
    fetchProposals();
  };

  const handleProposalCreated = () => {
    if (loadingProposals) return;
    console.log('📢 Nova proposta foi criada, recarregando...');
    fetchProposals();
  };

  // Listeners para eventos customizados
  window.addEventListener('proposalUpdated', handleProposalUpdated);
  window.addEventListener('proposalCreated', handleProposalCreated);

  // Retorna função cleanup
  return () => {
    window.removeEventListener('proposalUpdated', handleProposalUpdated);
    window.removeEventListener('proposalCreated', handleProposalCreated);
  };
}

/**
 * Setup auto-refresh periódico como fallback
 * Se eventos customizados falharem, isso garante sincronização eventual
 * 
 * @param fetchProposals Função de callback para recarregar propostas
 * @param loadingProposals Estado de carregamento
 * @param intervalMs Intervalo em milissegundos (default: 30000 = 30s)
 * @returns Função cleanup para remover intervalo
 */
export function setupProposalAutoRefresh(
  fetchProposals: () => void | Promise<void>,
  loadingProposals?: boolean,
  intervalMs: number = 30000
): () => void {
  const interval = setInterval(() => {
    if (loadingProposals) return; // Evitar requisições simultâneas
    console.log(`🔄 Auto-sync: Sincronizando propostas...`);
    fetchProposals();
  }, intervalMs);

  return () => clearInterval(interval);
}

/**
 * Dispara evento customizado quando proposta é criada/atualizada
 * Chamado por API routes após sucesso
 * 
 * @param proposalData Dados da proposta criada/atualizada
 * @param eventType 'created' ou 'updated'
 */
export function notifyProposalChange(
  proposalData: any,
  eventType: 'created' | 'updated' = 'updated'
): void {
  const eventName = eventType === 'created' ? 'proposalCreated' : 'proposalUpdated';
  
  if (typeof window !== 'undefined') {
    console.log(`📤 Disparando evento: ${eventName}`, proposalData?.id);
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: proposalData,
        bubbles: true
      })
    );
  }
}

/**
 * Hook helper para setup completo de sincronização
 * Combina listeners de eventos + auto-refresh
 */
export function useProposalSync(
  fetchProposals: () => void | Promise<void>,
  loadingProposals?: boolean
) {
  const cleanupListeners = setupProposalSyncListeners(fetchProposals, loadingProposals);
  const cleanupRefresh = setupProposalAutoRefresh(fetchProposals, loadingProposals);

  const cleanup = () => {
    cleanupListeners();
    cleanupRefresh();
  };

  return { cleanup };
}
