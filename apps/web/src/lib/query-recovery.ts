import { 
  executeWithAdvancedRecovery, 
  ClientSideSorter, 
  fallbackCache,
  RecoveryOptions 
} from './retry-utils';

export interface QueryRecoveryResult<T> {
  data: T[];
  usedFallback: boolean;
  recoveryMethod?: string;
  performanceImpact?: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedAction?: string;
}

export interface QueryOptions {
  userId: string;
  type?: string;
  baseId?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Enhanced query recovery for proposals with multiple fallback strategies
 */
export class ProposalQueryRecovery {
  constructor(private collection: any) {}
  
  /**
   * Execute query with comprehensive fallback strategies
   */
  async executeQueryWithRecovery(options: QueryOptions): Promise<QueryRecoveryResult<any>> {
    const cacheKey = this.generateCacheKey(options);
    
    // Primary query operation (with indexes)
    const primaryOperation = async () => {
      let query = this.collection.where('createdBy', '==', options.userId);
      
      if (options.type) {
        query = query.where('type', '==', options.type);
      }
      
      if (options.baseId) {
        query = query.where('baseId', '==', options.baseId);
      }
      
      if (options.orderBy) {
        query = query.orderBy(options.orderBy, options.orderDirection || 'desc');
      }
      
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      const snapshot = await query.get();
      return this.processSnapshot(snapshot);
    };
    
    // Fallback operation (simplified query without ordering)
    const fallbackOperation = async () => {
      // Try simplified query without ordering first
      let query = this.collection.where('createdBy', '==', options.userId);
      
      // Only add type filter if it doesn't require additional indexes
      if (options.type && !options.baseId) {
        query = query.where('type', '==', options.type);
      }
      
      const snapshot = await query.get();
      let results = this.processSnapshot(snapshot);
      
      // Apply client-side filtering if needed
      if (options.baseId) {
        results = results.filter((item: any) => item.baseId === options.baseId);
      }
      
      // Apply client-side sorting
      if (options.orderBy === 'createdAt') {
        results = ClientSideSorter.sortByDate(results, options.orderDirection);
      } else if (options.orderBy) {
        results = ClientSideSorter.sortByField(results, options.orderBy, options.orderDirection);
      }
      
      // Apply limit
      if (options.limit) {
        results = ClientSideSorter.limitResults(results, options.limit);
      }
      
      return results;
    };
    
    try {
      const recoveryResult = await executeWithAdvancedRecovery(
        primaryOperation,
        fallbackOperation,
        {
          enableFallback: true,
          fallbackStrategy: 'CLIENT_SORT',
          maxFallbackResults: options.limit || 100,
          enableClientSideSort: true
        },
        'proposal query'
      );
      
      const result: QueryRecoveryResult<any> = {
        data: recoveryResult.result,
        usedFallback: recoveryResult.usedFallback,
        recoveryMethod: recoveryResult.recoveryMethod,
        performanceImpact: this.assessPerformanceImpact(recoveryResult),
        recommendedAction: this.getRecommendedAction(recoveryResult)
      };
      
      // Cache successful results for future fallback use
      if (result.data.length > 0) {
        fallbackCache.set(cacheKey, result.data, 300000); // 5 minutes
      }
      
      return result;
      
    } catch (error) {
      // Last resort: try cached results
      const cachedData = fallbackCache.get(cacheKey);
      if (cachedData) {
        console.log('Using cached data as last resort fallback');
        return {
          data: cachedData,
          usedFallback: true,
          recoveryMethod: 'CACHED_RESULT',
          performanceImpact: 'LOW',
          recommendedAction: 'Data may be stale. Check network connectivity and try refreshing.'
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Process Firestore snapshot into array of documents
   */
  private processSnapshot(snapshot: any): any[] {
    const results: any[] = [];
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      });
    });
    
    return results;
  }
  
  /**
   * Generate cache key for query options
   */
  private generateCacheKey(options: QueryOptions): string {
    const parts = [
      'proposals',
      options.userId,
      options.type || 'all',
      options.baseId || 'all',
      options.orderBy || 'none',
      options.orderDirection || 'desc',
      options.limit || 'unlimited'
    ];
    
    return parts.join('_');
  }
  
  /**
   * Assess performance impact of recovery method
   */
  private assessPerformanceImpact(recoveryResult: any): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (!recoveryResult.usedFallback) {
      return 'LOW';
    }
    
    switch (recoveryResult.recoveryMethod) {
      case 'CACHED_RESULT':
        return 'LOW';
      case 'SIMPLIFIED_QUERY':
        return 'MEDIUM';
      case 'CLIENT_SORT':
        return 'MEDIUM';
      case 'UNORDERED_QUERY':
        return 'HIGH';
      default:
        return 'MEDIUM';
    }
  }
  
  /**
   * Get recommended action based on recovery method
   */
  private getRecommendedAction(recoveryResult: any): string {
    if (!recoveryResult.usedFallback) {
      return 'Query executed successfully with optimal performance.';
    }
    
    switch (recoveryResult.recoveryMethod) {
      case 'CACHED_RESULT':
        return 'Using cached data. Check network connectivity and refresh if needed.';
      case 'SIMPLIFIED_QUERY':
        return 'Using simplified query. Consider creating required Firestore indexes for better performance.';
      case 'CLIENT_SORT':
        return 'Using client-side sorting. Create composite indexes to improve query performance.';
      case 'UNORDERED_QUERY':
        return 'Results may not be properly ordered. Create required indexes for optimal sorting.';
      default:
        return 'Using fallback query strategy. Check Firestore indexes and network connectivity.';
    }
  }
}

/**
 * Utility functions for query recovery
 */
export class QueryRecoveryUtils {
  /**
   * Detect if error is related to missing indexes
   */
  static isIndexError(error: any): boolean {
    const errorMessage = error?.message || error?.toString() || '';
    const indexErrorPatterns = [
      /requires an index/i,
      /composite index/i,
      /index.*not found/i,
      /missing.*index/i,
      /FAILED_PRECONDITION.*index/i
    ];
    
    return indexErrorPatterns.some(pattern => pattern.test(errorMessage));
  }
  
  /**
   * Extract required fields from index error message
   */
  static extractRequiredFields(error: any): string[] {
    const errorMessage = error?.message || error?.toString() || '';
    const fields: string[] = [];
    
    // Common patterns for field extraction
    const fieldPatterns = [
      /field[:\s]+([^\s,]+)/gi,
      /'([^']+)'/g,
      /"([^"]+)"/g
    ];
    
    fieldPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(errorMessage)) !== null) {
        const field = match[1];
        if (field && !fields.includes(field) && field !== 'desc' && field !== 'asc') {
          fields.push(field);
        }
      }
    });
    
    return fields;
  }
  
  /**
   * Generate index creation URL for Firebase console
   */
  static generateIndexUrl(projectId?: string): string {
    if (!projectId) {
      return 'https://console.firebase.google.com/firestore/indexes';
    }
    return `https://console.firebase.google.com/project/${projectId}/firestore/indexes`;
  }
}