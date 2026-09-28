/**
 * Sistema de logs para monitoramento das calculadoras
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  userId?: string;
  sessionId?: string;
  calculatorType?: string;
  action?: string;
}

export interface LoggerOptions {
  level: LogLevel;
  maxEntries: number;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
}

export class CalculatorLogger {
  private logs: LogEntry[] = [];
  private options: LoggerOptions;
  private sessionId: string;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: LogLevel.INFO,
      maxEntries: 1000,
      enableConsole: true,
      enableStorage: true,
      enableRemote: false,
      ...options
    };

    this.sessionId = this.generateSessionId();
    this.loadFromStorage();
  }

  /**
   * Log de debug
   */
  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log de informação
   */
  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log de aviso
   */
  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log de erro
   */
  error(message: string, context?: string, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  /**
   * Log genérico
   */
  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (level < this.options.level) {
      return;
    }

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message,
      context,
      data,
      sessionId: this.sessionId
    };

    this.addEntry(entry);
  }

  /**
   * Log específico para ações da calculadora
   */
  logCalculatorAction(
    calculatorType: string,
    action: string,
    message: string,
    data?: any,
    userId?: string
  ): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level: LogLevel.INFO,
      message,
      context: 'calculator-action',
      data,
      userId,
      sessionId: this.sessionId,
      calculatorType,
      action
    };

    this.addEntry(entry);
  }

  /**
   * Log de erro com stack trace
   */
  logError(error: Error, context?: string, additionalData?: any): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level: LogLevel.ERROR,
      message: error.message,
      context: context || 'error',
      data: {
        stack: error.stack,
        name: error.name,
        ...additionalData
      },
      sessionId: this.sessionId
    };

    this.addEntry(entry);
  }

  /**
   * Log de performance
   */
  logPerformance(
    operation: string,
    duration: number,
    context?: string,
    additionalData?: any
  ): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level: LogLevel.INFO,
      message: `Performance: ${operation} took ${duration}ms`,
      context: context || 'performance',
      data: {
        operation,
        duration,
        ...additionalData
      },
      sessionId: this.sessionId
    };

    this.addEntry(entry);
  }

  /**
   * Adiciona entrada ao log
   */
  private addEntry(entry: LogEntry): void {
    this.logs.push(entry);

    // Limita o número de entradas
    if (this.logs.length > this.options.maxEntries) {
      this.logs = this.logs.slice(-this.options.maxEntries);
    }

    // Output para console se habilitado
    if (this.options.enableConsole) {
      this.outputToConsole(entry);
    }

    // Salva no storage se habilitado
    if (this.options.enableStorage) {
      this.saveToStorage();
    }

    // Envia para endpoint remoto se habilitado
    if (this.options.enableRemote && this.options.remoteEndpoint) {
      this.sendToRemote(entry);
    }
  }

  /**
   * Output para console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelName}]`;
    
    const message = entry.context 
      ? `${prefix} [${entry.context}] ${entry.message}`
      : `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(message, entry.data);
        break;
    }
  }

  /**
   * Salva logs no localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const recentLogs = this.logs.slice(-100); // Salva apenas os 100 mais recentes
      localStorage.setItem('calculator-logs', JSON.stringify(recentLogs));
    } catch (error) {
      console.error('Erro ao salvar logs no storage:', error);
    }
  }

  /**
   * Carrega logs do localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('calculator-logs');
      if (stored) {
        const logs = JSON.parse(stored) as LogEntry[];
        this.logs = logs;
      }
    } catch (error) {
      console.error('Erro ao carregar logs do storage:', error);
    }
  }

  /**
   * Envia log para endpoint remoto
   */
  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.options.remoteEndpoint) return;

    try {
      await fetch(this.options.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      console.error('Erro ao enviar log para endpoint remoto:', error);
    }
  }

  /**
   * Obtém logs filtrados
   */
  getLogs(filter?: {
    level?: LogLevel;
    context?: string;
    calculatorType?: string;
    action?: string;
    startTime?: number;
    endTime?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level !== undefined) {
        filtered = filtered.filter(log => log.level >= filter.level!);
      }

      if (filter.context) {
        filtered = filtered.filter(log => log.context === filter.context);
      }

      if (filter.calculatorType) {
        filtered = filtered.filter(log => log.calculatorType === filter.calculatorType);
      }

      if (filter.action) {
        filtered = filtered.filter(log => log.action === filter.action);
      }

      if (filter.startTime) {
        filtered = filtered.filter(log => log.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter(log => log.timestamp <= filter.endTime!);
      }
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Obtém estatísticas dos logs
   */
  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    byContext: Record<string, number>;
    byCalculatorType: Record<string, number>;
    errorRate: number;
    avgLogsPerHour: number;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: {} as Record<string, number>,
      byContext: {} as Record<string, number>,
      byCalculatorType: {} as Record<string, number>,
      errorRate: 0,
      avgLogsPerHour: 0
    };

    let errorCount = 0;
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    let recentLogs = 0;

    this.logs.forEach(log => {
      // Por nível
      const levelName = LogLevel[log.level];
      stats.byLevel[levelName] = (stats.byLevel[levelName] || 0) + 1;

      // Por contexto
      if (log.context) {
        stats.byContext[log.context] = (stats.byContext[log.context] || 0) + 1;
      }

      // Por tipo de calculadora
      if (log.calculatorType) {
        stats.byCalculatorType[log.calculatorType] = (stats.byCalculatorType[log.calculatorType] || 0) + 1;
      }

      // Contagem de erros
      if (log.level === LogLevel.ERROR) {
        errorCount++;
      }

      // Logs recentes
      if (log.timestamp >= oneHourAgo) {
        recentLogs++;
      }
    });

    stats.errorRate = stats.total > 0 ? (errorCount / stats.total) * 100 : 0;
    stats.avgLogsPerHour = recentLogs;

    return stats;
  }

  /**
   * Limpa logs antigos
   */
  clearOldLogs(maxAge: number = 7 * 24 * 60 * 60 * 1000): number { // 7 dias
    const cutoff = Date.now() - maxAge;
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
    
    const removedCount = initialCount - this.logs.length;
    
    if (removedCount > 0 && this.options.enableStorage) {
      this.saveToStorage();
    }

    return removedCount;
  }

  /**
   * Exporta logs
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'level', 'message', 'context', 'calculatorType', 'action'];
    const csvLines = [headers.join(',')];

    this.logs.forEach(log => {
      const row = [
        new Date(log.timestamp).toISOString(),
        LogLevel[log.level],
        `"${log.message.replace(/"/g, '""')}"`,
        log.context || '',
        log.calculatorType || '',
        log.action || ''
      ];
      csvLines.push(row.join(','));
    });

    return csvLines.join('\n');
  }

  /**
   * Gera ID único
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gera ID de sessão
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Instância global do logger (lazy initialization)
let calculatorLoggerInstance: CalculatorLogger | null = null;

function getCalculatorLogger(): CalculatorLogger {
  if (!calculatorLoggerInstance) {
    calculatorLoggerInstance = new CalculatorLogger();
  }
  return calculatorLoggerInstance;
}

export const calculatorLogger = {
  get instance() {
    return getCalculatorLogger();
  }
};

// Funções de conveniência
export const logCalculatorAction = (
  calculatorType: string,
  action: string,
  message: string,
  data?: any,
  userId?: string
) => {
  if (typeof window === 'undefined') return;
  getCalculatorLogger().logCalculatorAction(calculatorType, action, message, data, userId);
};

export const logError = (error: Error, context?: string, additionalData?: any) => {
  if (typeof window === 'undefined') return;
  getCalculatorLogger().logError(error, context, additionalData);
};

export const logPerformance = (
  operation: string,
  duration: number,
  context?: string,
  additionalData?: any
) => {
  if (typeof window === 'undefined') return;
  getCalculatorLogger().logPerformance(operation, duration, context, additionalData);
};

// Wrapper para medir performance de funções
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T> | T,
  context?: string
): Promise<T> => {
  const start = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    logPerformance(operation, duration, context, { success: true });
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    
    logPerformance(operation, duration, context, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    
    throw error;
  }
};