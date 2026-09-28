/**
 * Tema centralizado para as calculadoras
 */

import React from 'react';
import { cn } from '@/lib/utils';

// Classes de tema centralizadas
export const calculatorTheme = {
  // Containers principais
  container: 'container mx-auto p-6 bg-slate-950 text-white min-h-screen',
  
  // Cards
  card: 'bg-slate-900/80 border-slate-800 text-white',
  cardContent: 'p-6',
  
  // Inputs
  input: 'bg-slate-800 border-slate-700 text-white placeholder-slate-400',
  
  // Buttons
  button: {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
    outline: 'border-slate-600 text-slate-300 hover:bg-slate-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white'
  },
  
  // Tables
  table: {
    header: 'border-slate-700',
    row: 'border-slate-800 hover:bg-slate-800/50',
    cell: 'text-slate-300'
  },
  
  // Status colors
  status: {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400'
  },
  
  // Backgrounds
  background: {
    primary: 'bg-slate-950',
    secondary: 'bg-slate-900',
    accent: 'bg-slate-800',
    muted: 'bg-slate-700'
  },
  
  // Borders
  border: {
    primary: 'border-slate-800',
    secondary: 'border-slate-700',
    accent: 'border-slate-600'
  },
  
  // Text colors
  text: {
    primary: 'text-white',
    secondary: 'text-slate-300',
    muted: 'text-slate-400',
    accent: 'text-slate-200'
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
    <table className="w-full text-white">
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
    success: 'bg-green-900/50 border-green-700 text-green-300',
    error: 'bg-red-900/50 border-red-700 text-red-300',
    warning: 'bg-yellow-900/50 border-yellow-700 text-yellow-300',
    info: 'bg-blue-900/50 border-blue-700 text-blue-300'
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