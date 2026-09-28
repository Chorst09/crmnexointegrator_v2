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
          "p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-cyan-300 dark:hover:text-white dark:hover:bg-[#08303b] transition-colors flex items-center justify-center cursor-pointer",
          className
        )}
        title={resolvedTheme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        aria-label="Alternar tema"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-180 duration-300" />
        ) : (
          <Moon className="w-5 h-5 text-slate-600 animate-in spin-in-180 duration-300" />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-100 dark:hover:bg-[#08303b]/80 transition-colors border border-slate-200 dark:border-[#0e4453]/60 cursor-pointer",
          className
        )}
        title={resolvedTheme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
      >
        <span className="flex items-center gap-2">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-cyan-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
          <span>{resolvedTheme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#0a3541] text-slate-600 dark:text-cyan-300 border border-slate-300 dark:border-cyan-800/60">
          Alternar
        </span>
      </button>
    );
  }

  // Segmented control: Claro | Escuro | Sistema
  return (
    <div
      className={cn(
        "inline-flex items-center p-0.5 rounded-lg bg-slate-200/90 dark:bg-[#02181f] border border-slate-300/80 dark:border-[#073d4c] text-[11px] font-medium text-slate-600 dark:text-[#90b8c2] transition-colors",
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
            ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200"
            : "hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-[#04242d]"
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
            : "hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-[#04242d]"
        )}
        title="Modo Escuro"
      >
        <Moon className="w-3 h-3 text-cyan-200 flex-shrink-0" />
        <span>Escuro</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('system')}
        className={cn(
          "flex items-center justify-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer flex-1",
          theme === 'system'
            ? "bg-white dark:bg-gradient-to-r dark:from-teal-600 dark:to-cyan-600 text-slate-900 dark:text-white font-bold shadow-xs border border-slate-200 dark:border-cyan-400/50"
            : "hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-[#04242d]"
        )}
        title="Seguir configuração do sistema operacional"
      >
        <Laptop className="w-3 h-3 text-cyan-400 flex-shrink-0" />
        <span>Auto</span>
      </button>
    </div>
  );
};
