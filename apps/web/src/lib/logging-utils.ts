/**
 * Comprehensive logging and monitoring utilities for Proposals API
 * Provides structured logging, performance monitoring, and error tracking
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  collection?: string;
  queryType?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorType?: string;
  retryCount?: number;
  fallbackUsed?: boolean;
  queryComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
  resultCount?: number;
  indexesUsed?: string[];
  metadata?: Record<string, any>;
}

export interface DatabaseOperationLog {
  timestamp: string;
  level: LogLevel;
  operation: 'READ' | 'WRITE' | 'DELETE' | 'UPDATE' | 'QUERY';
  collection: string;
  success: boolean;
  duration: number;
  resultCount?: number;
  errorType?: string;
  errorMessage?: string;
  indexesUsed?: string[];
  fallbackStrategy?: string;
  retryCount?: number;
  context: LogContext;
}

export interface ErrorAlert {
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  errorType: string;
  errorMessage: string;
  frequency: number;
  firstOccurrence: string;
  lastOccurrence: string;
  affectedOperations: string[];
  suggestedActions: string[];
  context: LogContext;
}

class Logger {
  private static instance: Logger;
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private errorFrequency: Map<string, ErrorAlert> = new Map();
  private operationLogs: DatabaseOperationLog[] = [];
  private maxLogRetention = 1000; // Keep last 1000 logs in memory

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log database operations with comprehensive details
   */
  logDatabaseOperation(
    operation: DatabaseOperationLog['operation'],
    collection: string,
    success: boolean,
    duration: number,
    context: LogContext,
    options?: {
      resultCount?: number;
      errorType?: string;
      errorMessage?: string;
      indexesUsed?: string[];
      fallbackStrategy?: string;
      retryCount?: number;
    }
  ): void {
    const logEntry: DatabaseOperationLog = {
      timestamp: new Date().toISOString(),
      level: success ? 'INFO' : 'ERROR',
      operation,
      collection,
      success,
      duration,
      context,
      ...options
    };

    // Add to in-memory log store
    this.operationLogs.push(logEntry);
    
    // Maintain log retention limit
    if (this.operationLogs.length > this.maxLogRetention) {
      this.operationLogs = this.operationLogs.slice(-this.maxLogRetention);
    }

    // Console logging with structured format
    const logMessage = this.formatDatabaseLog(logEntry);
    
    if (success) {
      console.log(logMessage);
    } else {
      console.error(logMessage);
      
      // Track error frequency for alerting
      this.trackErrorFrequency(logEntry);
    }

    // Log performance metrics if duration is significant
    if (duration > 1000) { // Log slow operations (>1s)
      console.warn(`Slow ${operation} operation detected: ${duration}ms for ${collection}`, {
        requestId: context.requestId,
        operation: context.operation,
        userId: context.userId
      });
    }
  }

  /**
   * Start performance monitoring for an operation
   */
  startPerformanceMonitoring(
    operationName: string,
    context: LogContext,
    metadata?: Record<string, any>
  ): string {
    const trackingId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metrics: PerformanceMetrics = {
      operationName,
      startTime: Date.now(),
      success: false,
      metadata: {
        ...metadata,
        ...context
      }
    };

    this.performanceMetrics.set(trackingId, metrics);
    
    console.log(`[PERF] Started monitoring: ${operationName}`, {
      trackingId,
      requestId: context.requestId,
      operation: context.operation
    });

    return trackingId;
  }

  /**
   * End performance monitoring and log results
   */
  endPerformanceMonitoring(
    trackingId: string,
    success: boolean,
    options?: {
      errorType?: string;
      retryCount?: number;
      fallbackUsed?: boolean;
      queryComplexity?: PerformanceMetrics['queryComplexity'];
      resultCount?: number;
      indexesUsed?: string[];
    }
  ): PerformanceMetrics | null {
    const metrics = this.performanceMetrics.get(trackingId);
    if (!metrics) {
      console.warn(`[PERF] No metrics found for tracking ID: ${trackingId}`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metrics.startTime;

    const updatedMetrics: PerformanceMetrics = {
      ...metrics,
      endTime,
      duration,
      success,
      ...options
    };

    this.performanceMetrics.set(trackingId, updatedMetrics);

    // Log performance results
    this.logPerformanceResults(updatedMetrics);

    // Clean up completed metrics after logging
    setTimeout(() => {
      this.performanceMetrics.delete(trackingId);
    }, 5000);

    return updatedMetrics;
  }

  /**
   * Log successful operations with metrics
   */
  logSuccess(
    operation: string,
    context: LogContext,
    metrics?: {
      duration?: number;
      resultCount?: number;
      indexesUsed?: string[];
      fallbackUsed?: boolean;
    }
  ): void {
    const message = `[SUCCESS] ${operation}`;
    const logData = {
      requestId: context.requestId,
      userId: context.userId,
      operation: context.operation,
      collection: context.collection,
      ...metrics
    };

    console.log(message, logData);

    // Log as database operation if collection is specified
    if (context.collection && metrics?.duration) {
      this.logDatabaseOperation(
        'READ', // Default to READ for success logs
        context.collection,
        true,
        metrics.duration,
        context,
        {
          resultCount: metrics.resultCount,
          indexesUsed: metrics.indexesUsed,
          fallbackStrategy: metrics.fallbackUsed ? 'FALLBACK_USED' : undefined
        }
      );
    }
  }

  /**
   * Log errors with comprehensive context
   */
  logError(
    operation: string,
    error: any,
    context: LogContext,
    options?: {
      severity?: ErrorAlert['severity'];
      suggestedActions?: string[];
      duration?: number;
      retryCount?: number;
    }
  ): void {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorType = this.classifyError(error);
    
    const logData = {
      requestId: context.requestId,
      userId: context.userId,
      operation: context.operation,
      collection: context.collection,
      errorType,
      errorMessage,
      stack: error?.stack,
      ...options
    };

    console.error(`[ERROR] ${operation} failed:`, logData);

    // Log as database operation if collection is specified
    if (context.collection && options?.duration) {
      this.logDatabaseOperation(
        'READ', // Default operation type
        context.collection,
        false,
        options.duration,
        context,
        {
          errorType,
          errorMessage,
          retryCount: options.retryCount
        }
      );
    }

    // Track error for alerting
    this.trackErrorFrequency({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      operation: 'READ',
      collection: context.collection || 'unknown',
      success: false,
      duration: options?.duration || 0,
      errorType,
      errorMessage,
      retryCount: options?.retryCount,
      context
    });
  }

  /**
   * Get performance statistics for monitoring
   */
  getPerformanceStats(): {
    activeOperations: number;
    averageResponseTime: number;
    errorRate: number;
    slowOperations: number;
    recentErrors: ErrorAlert[];
  } {
    const recentLogs = this.operationLogs.slice(-100); // Last 100 operations
    const errors = recentLogs.filter(log => !log.success);
    const slowOps = recentLogs.filter(log => log.duration > 1000);
    
    const totalDuration = recentLogs.reduce((sum, log) => sum + log.duration, 0);
    const averageResponseTime = recentLogs.length > 0 ? totalDuration / recentLogs.length : 0;
    
    const errorRate = recentLogs.length > 0 ? (errors.length / recentLogs.length) * 100 : 0;

    return {
      activeOperations: this.performanceMetrics.size,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      slowOperations: slowOps.length,
      recentErrors: Array.from(this.errorFrequency.values()).slice(-10)
    };
  }

  /**
   * Get recent database operation logs
   */
  getRecentLogs(limit: number = 50): DatabaseOperationLog[] {
    return this.operationLogs.slice(-limit);
  }

  /**
   * Check for repeated errors and generate alerts
   */
  checkForAlerts(): ErrorAlert[] {
    const alerts: ErrorAlert[] = [];
    const now = Date.now();
    const alertThreshold = 5 * 60 * 1000; // 5 minutes

    this.errorFrequency.forEach((alert, errorKey) => {
      const lastOccurrence = new Date(alert.lastOccurrence).getTime();
      
      // Alert if error occurred more than 3 times in the last 5 minutes
      if (alert.frequency >= 3 && (now - lastOccurrence) < alertThreshold) {
        alerts.push(alert);
      }
    });

    return alerts;
  }

  private formatDatabaseLog(log: DatabaseOperationLog): string {
    const status = log.success ? 'SUCCESS' : 'FAILED';
    const fallback = log.fallbackStrategy ? ` (fallback: ${log.fallbackStrategy})` : '';
    const retry = log.retryCount ? ` (retries: ${log.retryCount})` : '';
    
    return `[DB-${log.operation}] ${status} ${log.collection} in ${log.duration}ms${fallback}${retry} [${log.context.requestId}]`;
  }

  private logPerformanceResults(metrics: PerformanceMetrics): void {
    const status = metrics.success ? 'COMPLETED' : 'FAILED';
    const fallback = metrics.fallbackUsed ? ' (with fallback)' : '';
    const retry = metrics.retryCount ? ` (${metrics.retryCount} retries)` : '';
    
    const logData = {
      operation: metrics.operationName,
      duration: metrics.duration,
      success: metrics.success,
      queryComplexity: metrics.queryComplexity,
      resultCount: metrics.resultCount,
      indexesUsed: metrics.indexesUsed,
      fallbackUsed: metrics.fallbackUsed,
      retryCount: metrics.retryCount,
      metadata: metrics.metadata
    };

    if (metrics.success) {
      console.log(`[PERF] ${status}: ${metrics.operationName} in ${metrics.duration}ms${fallback}${retry}`, logData);
    } else {
      console.error(`[PERF] ${status}: ${metrics.operationName} after ${metrics.duration}ms${retry}`, logData);
    }

    // Warn about performance issues
    if (metrics.duration && metrics.duration > 2000) {
      console.warn(`[PERF] Slow operation detected: ${metrics.operationName} took ${metrics.duration}ms`, {
        queryComplexity: metrics.queryComplexity,
        fallbackUsed: metrics.fallbackUsed,
        indexesUsed: metrics.indexesUsed
      });
    }
  }

  private classifyError(error: any): string {
    const errorMessage = error?.message || error?.toString() || '';
    const errorCode = error?.code || '';

    if (errorMessage.includes('index') || errorCode === 'FAILED_PRECONDITION') {
      return 'INDEX_ERROR';
    }
    if (errorMessage.includes('permission') || errorCode === 'PERMISSION_DENIED') {
      return 'PERMISSION_ERROR';
    }
    if (errorMessage.includes('quota') || errorCode === 'RESOURCE_EXHAUSTED') {
      return 'QUOTA_ERROR';
    }
    if (errorMessage.includes('connection') || errorCode === 'UNAVAILABLE') {
      return 'CONNECTION_ERROR';
    }
    if (errorMessage.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    if (errorMessage.includes('authentication') || errorCode === 'UNAUTHENTICATED') {
      return 'AUTH_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  private trackErrorFrequency(log: DatabaseOperationLog): void {
    if (!log.errorType || !log.errorMessage) return;

    const errorKey = `${log.errorType}_${log.collection}_${log.operation}`;
    const now = new Date().toISOString();

    if (this.errorFrequency.has(errorKey)) {
      const existing = this.errorFrequency.get(errorKey)!;
      existing.frequency += 1;
      existing.lastOccurrence = now;
      
      // Update affected operations
      if (!existing.affectedOperations.includes(log.context.operation || 'unknown')) {
        existing.affectedOperations.push(log.context.operation || 'unknown');
      }
    } else {
      const alert: ErrorAlert = {
        timestamp: now,
        severity: this.determineSeverity(log.errorType),
        errorType: log.errorType,
        errorMessage: log.errorMessage,
        frequency: 1,
        firstOccurrence: now,
        lastOccurrence: now,
        affectedOperations: [log.context.operation || 'unknown'],
        suggestedActions: this.getSuggestedActions(log.errorType),
        context: log.context
      };

      this.errorFrequency.set(errorKey, alert);
    }

    // Clean up old error tracking (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const keysToDelete: string[] = [];
    
    this.errorFrequency.forEach((alert, key) => {
      if (new Date(alert.lastOccurrence).getTime() < oneHourAgo) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.errorFrequency.delete(key);
    });
  }

  private determineSeverity(errorType: string): ErrorAlert['severity'] {
    switch (errorType) {
      case 'INDEX_ERROR':
        return 'HIGH';
      case 'PERMISSION_ERROR':
      case 'AUTH_ERROR':
        return 'MEDIUM';
      case 'CONNECTION_ERROR':
      case 'TIMEOUT_ERROR':
        return 'MEDIUM';
      case 'QUOTA_ERROR':
        return 'CRITICAL';
      default:
        return 'LOW';
    }
  }

  private getSuggestedActions(errorType: string): string[] {
    switch (errorType) {
      case 'INDEX_ERROR':
        return [
          'Create required Firestore composite indexes',
          'Review query patterns for optimization',
          'Consider using fallback query strategies'
        ];
      case 'PERMISSION_ERROR':
        return [
          'Review Firestore security rules',
          'Verify user authentication tokens',
          'Check user role permissions'
        ];
      case 'CONNECTION_ERROR':
        return [
          'Check network connectivity',
          'Verify Firebase project configuration',
          'Implement retry mechanisms'
        ];
      case 'QUOTA_ERROR':
        return [
          'Review Firebase usage quotas',
          'Optimize query patterns to reduce reads',
          'Consider upgrading Firebase plan'
        ];
      case 'TIMEOUT_ERROR':
        return [
          'Optimize query performance',
          'Add appropriate indexes',
          'Implement query result caching'
        ];
      default:
        return [
          'Review error logs for specific details',
          'Check Firebase console for service status',
          'Contact support if issue persists'
        ];
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions for common logging patterns
export function logDatabaseOperation(
  operation: DatabaseOperationLog['operation'],
  collection: string,
  success: boolean,
  duration: number,
  context: LogContext,
  options?: Parameters<typeof logger.logDatabaseOperation>[5]
): void {
  logger.logDatabaseOperation(operation, collection, success, duration, context, options);
}

export function startPerformanceMonitoring(
  operationName: string,
  context: LogContext,
  metadata?: Record<string, any>
): string {
  return logger.startPerformanceMonitoring(operationName, context, metadata);
}

export function endPerformanceMonitoring(
  trackingId: string,
  success: boolean,
  options?: Parameters<typeof logger.endPerformanceMonitoring>[2]
): PerformanceMetrics | null {
  return logger.endPerformanceMonitoring(trackingId, success, options);
}

export function logSuccess(
  operation: string,
  context: LogContext,
  metrics?: Parameters<typeof logger.logSuccess>[2]
): void {
  logger.logSuccess(operation, context, metrics);
}

export function logError(
  operation: string,
  error: any,
  context: LogContext,
  options?: Parameters<typeof logger.logError>[3]
): void {
  logger.logError(operation, error, context, options);
}

export function getPerformanceStats(): ReturnType<typeof logger.getPerformanceStats> {
  return logger.getPerformanceStats();
}

export function getRecentLogs(limit?: number): DatabaseOperationLog[] {
  return logger.getRecentLogs(limit);
}

export function checkForAlerts(): ErrorAlert[] {
  return logger.checkForAlerts();
}