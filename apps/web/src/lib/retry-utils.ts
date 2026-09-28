/**
 * Retry utility for handling transient database errors
 * Implements exponential backoff with jitter for optimal retry behavior
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors: string[];
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalDuration: number;
  lastAttemptError?: any;
}

// Default retry configuration for database operations
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: [
    'UNAVAILABLE',
    'DEADLINE_EXCEEDED',
    'RESOURCE_EXHAUSTED',
    'INTERNAL',
    'connection',
    'network',
    'timeout'
  ]
};

// Retry configuration for different operation types
export const RETRY_CONFIGS = {
  READ: {
    ...DEFAULT_RETRY_OPTIONS,
    maxAttempts: 3,
    baseDelayMs: 500
  },
  write: {
    ...DEFAULT_RETRY_OPTIONS,
    maxAttempts: 2,
    baseDelayMs: 1000
  },
  query: {
    ...DEFAULT_RETRY_OPTIONS,
    maxAttempts: 3,
    baseDelayMs: 750
  }
} as const;

/**
 * Determines if an error is retryable based on error patterns
 */
export function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;

  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || '';

  return retryableErrors.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
    errorCode.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitterFactor: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * jitterFactor * (Math.random() - 0.5);

  return Math.max(0, cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  operationName: string = 'operation'
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();

  let lastError: any;
  let attempts = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    attempts = attempt;

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      if (attempt > 1) {
        console.log(`${operationName} succeeded on attempt ${attempt}/${config.maxAttempts} after ${duration}ms`);
      }

      return {
        success: true,
        result,
        attempts,
        totalDuration: duration
      };

    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, config.retryableErrors)) {
        console.log(`${operationName} failed with non-retryable error on attempt ${attempt}:`, (error as any)?.message || error);
        break;
      }

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        console.log(`${operationName} failed after ${attempt} attempts:`, (error as any)?.message || error);
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs,
        config.backoffMultiplier,
        config.jitterFactor
      );

      console.log(`${operationName} failed on attempt ${attempt}/${config.maxAttempts}, retrying in ${delay}ms:`, (error as any)?.message || error);
      await sleep(delay);
    }
  }

  const totalDuration = Date.now() - startTime;

  return {
    success: false,
    error: lastError,
    attempts,
    totalDuration,
    lastAttemptError: lastError
  };
}

/**
 * Retry wrapper specifically for Firestore operations
 */
export async function withFirestoreRetry<T>(
  operation: () => Promise<T>,
  operationType: keyof typeof RETRY_CONFIGS = 'query',
  operationName: string = 'firestore operation'
): Promise<RetryResult<T>> {
  const config = RETRY_CONFIGS[operationType];
  return withRetry(operation, config, operationName);
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeoutMs: number = 60000,
    private successThreshold: number = 2
  ) { }

  async execute<T>(operation: () => Promise<T>, operationName: string = 'operation'): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeoutMs) {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Try again later.`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Global circuit breaker for database operations
export const databaseCircuitBreaker = new CircuitBreaker(5, 60000, 2);

/**
 * Enhanced query execution with retry and circuit breaker
 */
export async function executeWithRecovery<T>(
  operation: () => Promise<T>,
  operationType: keyof typeof RETRY_CONFIGS = 'query',
  operationName: string = 'database operation',
  useCircuitBreaker: boolean = true
): Promise<T> {
  const executeOperation = async () => {
    const retryResult = await withFirestoreRetry(operation, operationType, operationName);

    if (!retryResult.success) {
      throw retryResult.lastAttemptError || new Error(`${operationName} failed after ${retryResult.attempts} attempts`);
    }

    return retryResult.result!;
  };

  if (useCircuitBreaker) {
    return databaseCircuitBreaker.execute(executeOperation, operationName);
  }

  return executeOperation();
}

/**
 * Enhanced recovery mechanisms with fallback strategies
 */
export interface RecoveryOptions {
  enableFallback: boolean;
  fallbackStrategy: 'SIMPLIFIED_QUERY' | 'CLIENT_SORT' | 'UNORDERED_QUERY' | 'CACHED_RESULT';
  maxFallbackResults: number;
  enableClientSideSort: boolean;
  cacheTimeout: number;
}

export const DEFAULT_RECOVERY_OPTIONS: RecoveryOptions = {
  enableFallback: true,
  fallbackStrategy: 'CLIENT_SORT',
  maxFallbackResults: 100,
  enableClientSideSort: true,
  cacheTimeout: 300000 // 5 minutes
};

/**
 * Execute operation with comprehensive recovery mechanisms
 */
export async function executeWithAdvancedRecovery<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation?: () => Promise<T>,
  options: Partial<RecoveryOptions> = {},
  operationName: string = 'database operation'
): Promise<{ result: T; usedFallback: boolean; recoveryMethod?: string }> {
  const config = { ...DEFAULT_RECOVERY_OPTIONS, ...options };

  try {
    // Try primary operation with retry and circuit breaker
    const result = await executeWithRecovery(primaryOperation, 'query', operationName);
    return { result, usedFallback: false };
  } catch (primaryError) {
    console.warn(`Primary operation failed for ${operationName}:`, (primaryError as any)?.message);

    if (!config.enableFallback || !fallbackOperation) {
      throw primaryError;
    }

    try {
      console.log(`Attempting fallback strategy: ${config.fallbackStrategy} for ${operationName}`);
      const fallbackResult = await executeWithRecovery(fallbackOperation, 'query', `${operationName} (fallback)`);

      return {
        result: fallbackResult,
        usedFallback: true,
        recoveryMethod: config.fallbackStrategy
      };
    } catch (fallbackError) {
      console.error(`Both primary and fallback operations failed for ${operationName}:`, {
        primaryError: (primaryError as any)?.message,
        fallbackError: (fallbackError as any)?.message
      });

      // Throw the original error to maintain error context
      throw primaryError;
    }
  }
}

/**
 * Client-side sorting utility for fallback scenarios
 */
export class ClientSideSorter {
  static sortByDate<T extends { createdAt: any }>(
    items: T[],
    direction: 'asc' | 'desc' = 'desc'
  ): T[] {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return direction === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }

  static sortByField<T>(
    items: T[],
    field: keyof T,
    direction: 'asc' | 'desc' = 'asc'
  ): T[] {
    return [...items].sort((a, b) => {
      const valueA = a[field];
      const valueB = b[field];

      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  static limitResults<T>(items: T[], limit: number): T[] {
    return items.slice(0, limit);
  }
}

/**
 * Simple in-memory cache for fallback scenarios
 */
export class FallbackCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global fallback cache instance
export const fallbackCache = new FallbackCache();