import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { updateChartThemes } from './chartColors';

const THEME_STORAGE_KEY = 'crm-theme';

// 'system' follows prefers-color-scheme.
const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {}
});

const getSystemPrefersDark = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const resolveTheme = (theme) => {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return getSystemPrefersDark() ? 'dark' : 'light';
};

const applyResolvedThemeToDocument = (resolvedTheme) => {
  if (typeof document === 'undefined') return;
  const isDark = resolvedTheme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.remove('dark');
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  // Helps native form controls render appropriately in both modes.
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  });

  const [systemTheme, setSystemTheme] = useState(() => resolveTheme('system'));
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures (private mode, etc.).
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  // Keep DOM in sync whenever resolvedTheme changes.
  useEffect(() => {
    applyResolvedThemeToDocument(resolvedTheme);
    updateChartThemes();
  }, [resolvedTheme]);

  // If following system, listen for OS theme changes.
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemTheme(resolveTheme('system'));
    handler();

    // Safari compatibility.
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme
  }), [theme, resolvedTheme, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
