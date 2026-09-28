/**
 * Sistema de cache para melhorar performance das calculadoras
 */

export interface CacheItem<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number; // Time to live em milissegundos
  tags?: string[];
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  serialize?: boolean;
}

export class CalculatorCache {
  private cache = new Map<string, CacheItem>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutos

  /**
   * Define um item no cache
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const {
      ttl = this.defaultTTL,
      tags = [],
      serialize = false
    } = options;

    const item: CacheItem<T> = {
      key,
      value: serialize ? JSON.parse(JSON.stringify(value)) : value,
      timestamp: Date.now(),
      ttl,
      tags
    };

    this.cache.set(key, item);
  }

  /**
   * Obtém um item do cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Verifica se o item expirou
    if (this.isExpired(item)) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Verifica se um item existe no cache
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    if (this.isExpired(item)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove um item do cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove itens expirados
   */
  cleanup(): number {
    let removedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Remove itens por tag
   */
  invalidateByTag(tag: string): number {
    let removedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.tags?.includes(tag)) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats(): {
    size: number;
    expired: number;
    totalSize: number;
    oldestItem: number | null;
    newestItem: number | null;
  } {
    let expired = 0;
    let totalSize = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const item of this.cache.values()) {
      if (this.isExpired(item)) {
        expired++;
      }

      totalSize += JSON.stringify(item.value).length;

      if (oldestTimestamp === null || item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
      }

      if (newestTimestamp === null || item.timestamp > newestTimestamp) {
        newestTimestamp = item.timestamp;
      }
    }

    return {
      size: this.cache.size,
      expired,
      totalSize,
      oldestItem: oldestTimestamp,
      newestItem: newestTimestamp
    };
  }

  /**
   * Verifica se um item expirou
   */
  private isExpired(item: CacheItem): boolean {
    if (!item.ttl) {
      return false;
    }

    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * Obtém ou define um valor (memoização)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options: CacheOptions = {}
  ): Promise<T> {
    // Tenta obter do cache primeiro
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Se não encontrou, executa a factory function
    const value = await factory();
    this.set(key, value, options);
    
    return value;
  }
}

// Instância global do cache
export const calculatorCache = new CalculatorCache();

/**
 * Hook para usar cache em componentes React
 */
export const useCachedValue = <T>(
  key: string,
  factory: () => T,
  dependencies: any[] = [],
  options: CacheOptions = {}
): T => {
  // Cria uma chave única baseada nas dependências
  const depsKey = `${key}-${JSON.stringify(dependencies)}`;
  
  // Tenta obter do cache
  let value = calculatorCache.get<T>(depsKey);
  
  if (value === null) {
    // Se não encontrou, calcula o valor
    value = factory();
    calculatorCache.set(depsKey, value, options);
  }
  
  return value;
};

/**
 * Cache específico para cálculos de DRE
 */
export const cacheDRECalculation = (
  input: any,
  result: any,
  ttl: number = 10 * 60 * 1000 // 10 minutos
): void => {
  const key = `dre-${JSON.stringify(input)}`;
  calculatorCache.set(key, result, { 
    ttl, 
    tags: ['dre', 'calculation'] 
  });
};

/**
 * Obtém cálculo de DRE do cache
 */
export const getCachedDRECalculation = (input: any): any | null => {
  const key = `dre-${JSON.stringify(input)}`;
  return calculatorCache.get(key);
};

/**
 * Cache para resultados de propostas
 */
export const cacheProposalResult = (
  proposalId: string,
  result: any,
  ttl: number = 30 * 60 * 1000 // 30 minutos
): void => {
  const key = `proposal-${proposalId}`;
  calculatorCache.set(key, result, { 
    ttl, 
    tags: ['proposal', 'result'] 
  });
};

/**
 * Obtém resultado de proposta do cache
 */
export const getCachedProposalResult = (proposalId: string): any | null => {
  const key = `proposal-${proposalId}`;
  return calculatorCache.get(key);
};

/**
 * Cache para configurações de comissão
 */
export const cacheCommissionConfig = (
  config: any,
  ttl: number = 60 * 60 * 1000 // 1 hora
): void => {
  calculatorCache.set('commission-config', config, { 
    ttl, 
    tags: ['commission', 'config'] 
  });
};

/**
 * Obtém configurações de comissão do cache
 */
export const getCachedCommissionConfig = (): any | null => {
  return calculatorCache.get('commission-config');
};

/**
 * Invalida cache relacionado a cálculos
 */
export const invalidateCalculationCache = (): void => {
  calculatorCache.invalidateByTag('calculation');
  calculatorCache.invalidateByTag('dre');
};

/**
 * Invalida cache relacionado a propostas
 */
export const invalidateProposalCache = (): void => {
  calculatorCache.invalidateByTag('proposal');
};

/**
 * Invalida cache relacionado a configurações
 */
export const invalidateConfigCache = (): void => {
  calculatorCache.invalidateByTag('config');
  calculatorCache.invalidateByTag('commission');
};

/**
 * Agenda limpeza automática do cache
 */
export const scheduleCleanup = (intervalMinutes: number = 15): number => {
  return window.setInterval(() => {
    const removed = calculatorCache.cleanup();
    if (removed > 0) {
      console.log(`Cache cleanup: ${removed} itens expirados removidos`);
    }
  }, intervalMinutes * 60 * 1000);
};

/**
 * Cancela limpeza automática
 */
export const cancelCleanup = (intervalId: number): void => {
  clearInterval(intervalId);
};

/**
 * Exporta estatísticas do cache
 */
export const exportCacheStats = (): void => {
  const stats = calculatorCache.getStats();
  
  console.table({
    'Itens no Cache': stats.size,
    'Itens Expirados': stats.expired,
    'Tamanho Total (bytes)': stats.totalSize,
    'Item Mais Antigo': stats.oldestItem ? new Date(stats.oldestItem).toLocaleString() : 'N/A',
    'Item Mais Recente': stats.newestItem ? new Date(stats.newestItem).toLocaleString() : 'N/A'
  });
};

/**
 * Pré-carrega dados no cache
 */
export const preloadCache = async (
  preloadFunctions: Array<{ key: string; factory: () => Promise<any>; options?: CacheOptions }>
): Promise<void> => {
  const promises = preloadFunctions.map(async ({ key, factory, options }) => {
    try {
      const value = await factory();
      calculatorCache.set(key, value, options);
    } catch (error) {
      console.error(`Erro ao pré-carregar cache para ${key}:`, error);
    }
  });

  await Promise.all(promises);
};