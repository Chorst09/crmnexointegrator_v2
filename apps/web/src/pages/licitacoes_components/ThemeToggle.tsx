import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import { cn } from './utils';

interface ThemeToggleProps {
  variant?: 'icon' | 'segmented' | 'compact';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'segmented', className }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          "p-2 rounded-lg text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-cyan-300 dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] transition-colors flex items-center justify-center cursor-pointer",
          className
        )}
        title={resolvedTheme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        aria-label="Alternar tema"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-amber-700 dark:text-amber-400 animate-in spin-in-180 duration-300" />
        ) : (
          <Moon className="w-5 h-5 text-[rgb(var(--crm-muted-rgb)_/_1)] animate-in spin-in-180 duration-300" />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] transition-colors border border-[var(--crm-border)] dark:border-[var(--crm-border)] cursor-pointer",
          className
        )}
        title={resolvedTheme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
      >
        <span className="flex items-center gap-2">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
          <span>{resolvedTheme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-cyan-300 border border-[var(--crm-border)] dark:border-cyan-800/60">
          Alternar
        </span>
      </button>
    );
  }

  // Segmented control: Claro | Escuro | Sistema
  return (
    <div
      className={cn(
        "inline-flex items-center p-0.5 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_0.9)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] dark:border-[var(--crm-border)] text-[11px] font-medium text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[#90b8c2] transition-colors",
        className
      )}
      role="group"
      aria-label="Seleção de Modo de Tema"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={cn(
          "flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer flex-1",
          theme === 'light'
            ? "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] font-bold shadow-xs border border-[var(--crm-border)]"
            : "hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)] dark:hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
        )}
        title="Modo Claro"
      >
        <Sun className="w-3 h-3 text-amber-500 flex-shrink-0" />
        <span>Claro</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={cn(
          "flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer flex-1",
          theme === 'dark'
            ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold shadow-xs border border-cyan-400/50"
            : "hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)] dark:hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
        )}
        title="Modo Escuro"
      >
        <Moon className="w-3 h-3 text-cyan-700 dark:text-cyan-200 flex-shrink-0" />
        <span>Escuro</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('system')}
        className={cn(
          "flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer flex-1",
          theme === 'system'
            ? "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-gradient-to-r dark:from-teal-600 dark:to-cyan-600 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-white font-bold shadow-xs border border-[var(--crm-border)] dark:border-cyan-400/50"
            : "hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)] dark:hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
        )}
        title="Seguir configuração do sistema operacional"
      >
        <Laptop className="w-3 h-3 text-cyan-700 dark:text-cyan-400 flex-shrink-0" />
        <span>Auto</span>
      </button>
    </div>
  );
};
