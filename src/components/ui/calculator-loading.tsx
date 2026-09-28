/**
 * Componentes de loading para as calculadoras
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Calculator, FileText, Settings } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <Loader2 className={cn(
      'animate-spin text-blue-500',
      sizeClasses[size],
      className
    )} />
  );
};

interface CalculatorLoadingProps {
  message?: string;
  type?: 'calculation' | 'saving' | 'loading' | 'exporting';
  className?: string;
}

export const CalculatorLoading: React.FC<CalculatorLoadingProps> = ({
  message,
  type = 'loading',
  className
}) => {
  const getIcon = () => {
    switch (type) {
      case 'calculation':
        return <Calculator className="w-8 h-8 text-blue-500 animate-pulse" />;
      case 'saving':
        return <FileText className="w-8 h-8 text-green-500 animate-pulse" />;
      case 'exporting':
        return <Settings className="w-8 h-8 text-purple-500 animate-pulse" />;
      default:
        return <LoadingSpinner size="lg" />;
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'calculation':
        return 'Calculando...';
      case 'saving':
        return 'Salvando proposta...';
      case 'exporting':
        return 'Exportando dados...';
      default:
        return 'Carregando...';
    }
  };

  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-8 space-y-4',
      'bg-slate-900/50 rounded-lg border border-slate-700',
      className
    )}>
      {getIcon()}
      <p className="text-slate-300 text-sm font-medium">
        {message || getDefaultMessage()}
      </p>
    </div>
  );
};

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  type?: 'calculation' | 'saving' | 'loading' | 'exporting';
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message,
  type = 'loading'
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 rounded-lg border border-slate-700 p-8 max-w-sm w-full mx-4">
        <CalculatorLoading message={message} type={type} className="bg-transparent border-none p-0" />
      </div>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  lines = 1 
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-slate-700 rounded animate-pulse"
          style={{
            width: `${Math.random() * 40 + 60}%`
          }}
        />
      ))}
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  className
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header skeleton */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`header-${index}`} className="h-6 bg-slate-600 rounded animate-pulse" />
        ))}
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={`row-${rowIndex}`} 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div 
              key={`cell-${rowIndex}-${colIndex}`} 
              className="h-4 bg-slate-700 rounded animate-pulse" 
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface CardSkeletonProps {
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ className }) => {
  return (
    <div className={cn(
      'bg-slate-900/80 border border-slate-800 rounded-lg p-6 space-y-4',
      className
    )}>
      {/* Title skeleton */}
      <div className="h-6 bg-slate-700 rounded animate-pulse w-1/3" />
      
      {/* Content skeleton */}
      <div className="space-y-3">
        <Skeleton lines={3} />
      </div>
      
      {/* Button skeleton */}
      <div className="flex space-x-2">
        <div className="h-10 bg-slate-700 rounded animate-pulse w-24" />
        <div className="h-10 bg-slate-700 rounded animate-pulse w-20" />
      </div>
    </div>
  );
};

interface ProgressBarProps {
  progress: number;
  message?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  message,
  className
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {message && (
        <p className="text-sm text-slate-300 font-medium">{message}</p>
      )}
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 text-right">
        {Math.round(progress)}%
      </p>
    </div>
  );
};