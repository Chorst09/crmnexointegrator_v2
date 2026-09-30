import type { Partner, RO, Training } from './types';

export const initialPartners: Partner[] = [
    // All distributor and supplier partners have been removed
];

export const initialRos: RO[] = [
    // All ROs referencing distributors and suppliers have been removed
];

export const initialTrainings: Training[] = [
    // All trainings referencing suppliers have been removed
];

export const salesData = [
  { name: 'Jan', 'Projetos': 30, 'Vendas': 20 },
  { name: 'Fev', 'Projetos': 45, 'Vendas': 25 },
  { name: 'Mar', 'Projetos': 60, 'Vendas': 40 },
  { name: 'Abr', 'Projetos': 50, 'Vendas': 35 },
  { name: 'Mai', 'Projetos': 70, 'Vendas': 55 },
  { name: 'Jun', 'Projetos': 85, 'Vendas': 65 },
];

export const quoteStatusData = [
  { name: 'Pendente', value: 15, color: '#FFC107' },
  { name: 'Enviado', value: 25, color: '#2196F3' },
  { name: 'Aprovado', value: 35, color: '#4CAF50' },
  { name: 'Rejeitado', value: 10, color: '#F44336' },
  // Removed 'Aguardando Distribuidor' status
];

// Removed features - all exports are empty arrays
export const initialRFPs: any[] = [];
export const initialPriceRecords: any[] = [];
export const initialEditais: any[] = [];

export const PIE_COLORS = ['#4CAF50', '#FFC107', '#2196F3', '#F44336', '#9C27B0'];
