/**
 * Fallback query utilities for handling missing Firestore indexes
 * Provides intelligent query degradation and client-side sorting capabilities
 */

import { QueryFallbackResult, IndexErrorInfo } from './types';

export interface QueryOptions {
  userId: string;
  type?: string;
  baseId?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
}

export interface FallbackStrategy {
  name: string;
  description: string;
  performanceImpact: 'LOW' | 'MEDIUM' | 'HIGH';
  execute: (query: any, options: QueryOptions) => Promise<any>;
}

/**
 * Client-side sorting utilities
 */
export class ClientSorter {
  static sortByField(documents: any[], field: string, direction: 'asc' | 'desc' = 'desc'): any[] {
    return documents.sort((a, b) => {
      const valueA = this.getFieldValue(a, field);
      const valueB = this.getFieldValue(b, field);
      
      // Handle null/undefined values
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return direction === 'asc' ? -1 : 1;
      if (valueB == null) return direction === 'asc' ? 1 : -1;
      
      // Handle different data types
      if (valueA instanceof Date && valueB instanceof Date) {
        return direction === 'asc' 
          ? valueA.getTime() - valueB.getTime()
          : valueB.getTime() - valueA.getTime();
      }
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return direction === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return direction === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // Fallback to string comparison
      const strA = String(valueA);
      const strB = String(valueB);
      return direction === 'asc' 
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }
  
  private static getFieldValue(document: any, field: string): any {
    // Handle nested field paths (e.g., 'user.name')
    const fieldParts = field.split('.');
    let value = document;
    
    for (const part of fieldParts) {
      if (value == null) return null;
      value = value[part];
    }
    
    // Convert Firestore Timestamp to Date for comparison
    if (value && typeof value.toDate === 'function') {
      return value.toDate();
    }
    
    return value;
  }
  
  static applyLimit(documents: any[], limit?: number): any[] {
    return limit ? documents.slice(0, limit) : documents;
  }
  
  static filterByField(documents: any[], field: string, value: any): any[] {
    return documents.filter(doc => {
      const docValue = this.getFieldValue(doc, field);
      return docValue === value;
    });
  }
}

/**
 * Fallback strategy implementations
 */
export const FALLBACK_STRATEGIES: Record<string, FallbackStrategy> = {
  UNORDERED_QUERY: {
    name: 'Unordered Query',
    description: 'Execute query without ordering, sort on client if needed',
    performanceImpact: 'MEDIUM',
    execute: async (baseQuery: any, options: QueryOptions) => {
      let query = baseQuery;
      
      // Apply user filter (always required)
      query = query.where('createdBy', '==', options.userId);
      
      // Apply additional filters
      if (options.baseId) {
        query = query.where('baseId', '==', options.baseId);
      }
      
      if (options.type) {
        query = query.where('type', '==', options.type);
      }
      
      // Apply limit if specified (helps with performance)
      if (options.limit) {
        query = query.limit(options.limit * 2); // Get extra to account for client-side sorting
      }
      
      return query.get();
    }
  },
  
  SIMPLIFIED_QUERY: {
    name: 'Simplified Query',
    description: 'Use fewer filters to avoid complex index requirements',
    performanceImpact: 'MEDIUM',
    execute: async (baseQuery: any, options: QueryOptions) => {
      let query = baseQuery;
      
      // Always filter by user
      query = query.where('createdBy', '==', options.userId);
      
      // Only add one additional filter to reduce index complexity
      if (options.baseId) {
        query = query.where('baseId', '==', options.baseId);
      } else if (options.type) {
        query = query.where('type', '==', options.type);
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit * 3); // Get more for client-side filtering
      }
      
      return query.get();
    }
  },
  
  USER_ONLY_QUERY: {
    name: 'User-Only Query',
    description: 'Query only by user ID, filter everything else on client',
    performanceImpact: 'HIGH',
    execute: async (baseQuery: any, options: QueryOptions) => {
      let query = baseQuery;
      
      // Only filter by user to minimize index requirements
      query = query.where('createdBy', '==', options.userId);
      
      // Apply a reasonable limit to prevent excessive data transfer
      const maxLimit = options.limit ? Math.max(options.limit * 5, 100) : 100;
      query = query.limit(maxLimit);
      
      return query.get();
    }
  }
};

/**
 * Intelligent fallback query executor
 */
export class FallbackQueryExecutor {
  constructor(private baseQuery: any) {}
  
  async executeWithFallback(
    options: QueryOptions,
    preferredStrategy?: string
  ): Promise<QueryFallbackResult> {
    const startTime = Date.now();
    
    // Try the preferred strategy first, or determine best strategy
    const strategy = preferredStrategy 
      ? FALLBACK_STRATEGIES[preferredStrategy]
      : this.selectBestStrategy(options);
    
    if (!strategy) {
      throw new Error(`Unknown fallback strategy: ${preferredStrategy}`);
    }
    
    try {
      console.log(`Executing fallback strategy: ${strategy.name}`);
      
      const snapshot = await strategy.execute(this.baseQuery, options);
      let documents = this.snapshotToDocuments(snapshot);
      
      // Apply client-side filtering if needed
      documents = this.applyClientSideFiltering(documents, options, strategy.name);
      
      // Apply client-side sorting if needed
      if (options.orderBy) {
        documents = ClientSorter.sortByField(
          documents, 
          options.orderBy, 
          options.orderDirection || 'desc'
        );
      }
      
      // Apply final limit
      if (options.limit) {
        documents = ClientSorter.applyLimit(documents, options.limit);
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        snapshot: this.documentsToSnapshot(documents),
        usedFallback: true,
        fallbackType: strategy.name,
        performanceImpact: strategy.performanceImpact,
        recommendedAction: this.getRecommendedAction(strategy, options, executionTime)
      };
      
    } catch (error) {
      console.error(`Fallback strategy ${strategy.name} failed:`, error);
      throw error;
    }
  }
  
  private selectBestStrategy(options: QueryOptions): FallbackStrategy {
    // Determine the best fallback strategy based on query complexity
    const hasMultipleFilters = !!(options.type && options.baseId);
    const hasOrdering = !!options.orderBy;
    
    if (hasMultipleFilters && hasOrdering) {
      return FALLBACK_STRATEGIES.USER_ONLY_QUERY;
    } else if (hasMultipleFilters || hasOrdering) {
      return FALLBACK_STRATEGIES.SIMPLIFIED_QUERY;
    } else {
      return FALLBACK_STRATEGIES.UNORDERED_QUERY;
    }
  }
  
  private snapshotToDocuments(snapshot: any): any[] {
    const documents: any[] = [];
    snapshot.forEach((doc: any) => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return documents;
  }
  
  private documentsToSnapshot(documents: any[]): any {
    // Create a mock snapshot-like object for compatibility
    return {
      forEach: (callback: (doc: any) => void) => {
        documents.forEach(doc => {
          const mockDoc = {
            id: doc.id,
            data: () => {
              const { id, ...data } = doc;
              return data;
            }
          };
          callback(mockDoc);
        });
      },
      size: documents.length,
      empty: documents.length === 0
    };
  }
  
  private applyClientSideFiltering(
    documents: any[], 
    options: QueryOptions, 
    strategyName: string
  ): any[] {
    let filtered = documents;
    
    // Apply filters that weren't applied server-side
    if (strategyName === 'USER_ONLY_QUERY') {
      if (options.type) {
        filtered = ClientSorter.filterByField(filtered, 'type', options.type);
      }
      if (options.baseId) {
        filtered = ClientSorter.filterByField(filtered, 'baseId', options.baseId);
      }
    } else if (strategyName === 'SIMPLIFIED_QUERY') {
      // If we only applied one filter server-side, apply the other client-side
      if (options.type && options.baseId) {
        // We applied baseId server-side, so filter by type client-side
        if (!options.baseId) {
          filtered = ClientSorter.filterByField(filtered, 'type', options.type);
        }
        // We applied type server-side, so filter by baseId client-side  
        if (!options.type) {
          filtered = ClientSorter.filterByField(filtered, 'baseId', options.baseId);
        }
      }
    }
    
    return filtered;
  }
  
  private getRecommendedAction(
    strategy: FallbackStrategy, 
    options: QueryOptions, 
    executionTime: number
  ): string {
    const baseMessage = `Create composite indexes to improve performance. Current execution took ${executionTime}ms using ${strategy.name}.`;
    
    if (strategy.performanceImpact === 'HIGH') {
      return `${baseMessage} High performance impact detected - index creation is strongly recommended.`;
    } else if (executionTime > 5000) {
      return `${baseMessage} Slow query detected - consider creating indexes or reducing query complexity.`;
    } else {
      return `${baseMessage} Performance is acceptable but can be improved with proper indexes.`;
    }
  }
}

/**
 * Enhanced query builder with automatic fallback detection
 */
export class EnhancedQueryBuilder {
  constructor(private collection: any) {}
  
  async executeQuery(options: QueryOptions): Promise<QueryFallbackResult> {
    try {
      // Try the optimal query first
      const result = await this.executeOptimalQuery(options);
      return {
        snapshot: result,
        usedFallback: false,
        performanceImpact: 'LOW',
        recommendedAction: 'Query executed successfully with optimal performance'
      };
      
    } catch (error) {
      console.warn('Optimal query failed, falling back to alternative strategies:', error);
      
      // Use fallback executor
      const fallbackExecutor = new FallbackQueryExecutor(this.collection);
      return fallbackExecutor.executeWithFallback(options);
    }
  }
  
  private async executeOptimalQuery(options: QueryOptions): Promise<any> {
    let query = this.collection;
    
    // Apply filters
    query = query.where('createdBy', '==', options.userId);
    
    if (options.baseId) {
      query = query.where('baseId', '==', options.baseId);
    }
    
    if (options.type) {
      query = query.where('type', '==', options.type);
    }
    
    // Apply ordering
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.orderDirection || 'desc');
    }
    
    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    return query.get();
  }
}

/**
 * Utility function to detect if an error requires fallback
 */
export function shouldUseFallback(error: any): boolean {
  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || '';
  
  const fallbackTriggers = [
    /requires an index/i,
    /composite index/i,
    /index.*not found/i,
    /missing.*index/i,
    /FAILED_PRECONDITION.*index/i,
    /inequality filter.*requires.*composite index/i
  ];
  
  return fallbackTriggers.some(pattern => pattern.test(errorMessage)) ||
         errorCode === 'FAILED_PRECONDITION';
}