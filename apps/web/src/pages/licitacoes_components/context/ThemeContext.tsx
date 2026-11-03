import React, { ReactNode } from 'react';
import { useTheme as useCRMTheme } from '../../../theme/ThemeProvider';

// Licitações shares the CRM preference; only the root provider updates the DOM.
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => <>{children}</>;
export const useTheme = useCRMTheme;
