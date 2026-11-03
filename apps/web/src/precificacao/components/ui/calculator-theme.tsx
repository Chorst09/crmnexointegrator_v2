/**
 * Tema centralizado para as calculadoras
 */

import React from 'react';
import { cn } from '@/lib/utils';

// Classes de tema centralizadas
export const calculatorTheme = {
  // Containers principais
  container: "container mx-auto p-6 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] min-h-screen",
  
  // Cards
  card: "bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  cardContent: 'p-6',
  
  // Inputs
  input: "bg-[rgb(var(--crm-surface-rgb)_/_1)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] placeholder-[rgb(var(--crm-muted-rgb)_/_1)]",
  
  // Buttons
  button: {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: "bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]",
    outline: "border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]",
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white'
  },
  
  // Tables
  table: {
    header: "border-[var(--crm-border)]",
    row: "border-[var(--crm-border)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.5)]",
    cell: "text-[rgb(var(--crm-ink-rgb)_/_1)]"
  },
  
  // Status colors
  status: {
    success: "text-green-700 dark:text-green-400",
    error: "text-red-700 dark:text-red-400",
    warning: "text-yellow-700 dark:text-yellow-400",
    info: "text-blue-700 dark:text-blue-400"
  },
  
  // Backgrounds
  background: {
    primary: "bg-[rgb(var(--crm-surface-2-rgb)_/_1)]",
    secondary: "bg-[rgb(var(--crm-surface-2-rgb)_/_1)]",
    accent: "bg-[rgb(var(--crm-surface-rgb)_/_1)]",
    muted: "bg-[rgb(var(--crm-surface-rgb)_/_1)]"
  },
  
  // Borders
  border: {
    primary: "border-[var(--crm-border)]",
    secondary: "border-[var(--crm-border)]",
    accent: "border-[var(--crm-border)]"
  },
  
  // Text colors
  text: {
    primary: "text-[rgb(var(--crm-ink-rgb)_/_1)]",
    secondary: "text-[rgb(var(--crm-ink-rgb)_/_1)]",
    muted: "text-[rgb(var(--crm-muted-rgb)_/_1)]",
    accent: "text-[rgb(var(--crm-ink-rgb)_/_1)]"
  }
};

// Componentes temáticos

interface ThemedCardProps {
  children: React.ReactNode;
  className?: string;
}

export const ThemedCard: React.FC<ThemedCardProps> = ({ children, className }) => (
  <div className={cn(calculatorTheme.card, className)}>
    {children}
  </div>
);

interface ThemedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const ThemedInput: React.FC<ThemedInputProps> = ({ className, ...props }) => (
  <input 
    className={cn(calculatorTheme.input, 'px-3 py-2 rounded-md', className)} 
    {...props} 
  />
);

interface ThemedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof calculatorTheme.button;
  className?: string;
}

export const ThemedButton: React.FC<ThemedButtonProps> = ({ 
  variant = 'primary', 
  className, 
  children, 
  ...props 
}) => (
  <button 
    className={cn(
      'px-4 py-2 rounded-md font-medium transition-colors',
      calculatorTheme.button[variant], 
      className
    )} 
    {...props}
  >
    {children}
  </button>
);

interface ThemedTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ThemedTable: React.FC<ThemedTableProps> = ({ children, className }) => (
  <div className={cn('overflow-x-auto', className)}>
    <table className="w-full text-[rgb(var(--crm-ink-rgb)_/_1)]">
      {children}
    </table>
  </div>
);

interface ThemedTableRowProps {
  children: React.ReactNode;
  className?: string;
  isHeader?: boolean;
}

export const ThemedTableRow: React.FC<ThemedTableRowProps> = ({ 
  children, 
  className, 
  isHeader = false 
}) => (
  <tr className={cn(
    isHeader ? calculatorTheme.table.header : calculatorTheme.table.row,
    className
  )}>
    {children}
  </tr>
);

interface ThemedTableCellProps {
  children: React.ReactNode;
  className?: string;
  isHeader?: boolean;
}

export const ThemedTableCell: React.FC<ThemedTableCellProps> = ({ 
  children, 
  className, 
  isHeader = false 
}) => {
  const Tag = isHeader ? 'th' : 'td';
  return (
    <Tag className={cn(
      'py-2 px-3',
      isHeader ? 'font-medium text-left' : calculatorTheme.table.cell,
      className
    )}>
      {children}
    </Tag>
  );
};

// Status indicators
interface StatusIndicatorProps {
  status: keyof typeof calculatorTheme.status;
  children: React.ReactNode;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  children, 
  className 
}) => (
  <span className={cn(calculatorTheme.status[status], className)}>
    {children}
  </span>
);

// Alert components
interface ThemedAlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const ThemedAlert: React.FC<ThemedAlertProps> = ({ 
  type, 
  title, 
  children, 
  className 
}) => {
  const alertStyles = {
    success: "bg-green-50/50 dark:bg-green-900/50 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300",
    error: "bg-red-50/50 dark:bg-red-900/50 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300",
    warning: "bg-yellow-50/50 dark:bg-yellow-900/50 border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300",
    info: "bg-blue-50/50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
  };

  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div className={cn(
      'p-3 border rounded-lg',
      alertStyles[type],
      className
    )}>
      {title && (
        <div className="flex items-center space-x-2 mb-1">
          <span>{iconMap[type]}</span>
          <span className="font-semibold">{title}</span>
        </div>
      )}
      <div className="text-sm">
        {children}
      </div>
    </div>
  );
};

// Container wrapper
interface CalculatorContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const CalculatorContainer: React.FC<CalculatorContainerProps> = ({ 
  children, 
  className 
}) => (
  <div className={cn(calculatorTheme.container, className)}>
    {children}
  </div>
);