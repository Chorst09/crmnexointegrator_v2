import { Issue, User, Column, ActivityLog } from './types';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Carlos Horst', initials: 'CH', color: 'bg-[#ff7a00]', role: 'Admin', email: 'chorst@example.com' },
  { id: 'u2', name: 'User 2', initials: 'U2', color: "bg-[rgb(var(--crm-surface-rgb)_/_1)]", role: 'Membro', email: 'user2@example.com' },
  { id: 'u3', name: 'Ana Silva', initials: 'AS', color: 'bg-emerald-500', role: 'Convidado', email: 'ana@example.com' },
];

export const mockColumns: Column[] = [
  { id: 'PENDENTE', title: 'PENDENTE', colorClass: "text-[rgb(var(--crm-muted-rgb)_/_1)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)]", iconType: 'dashed' },
  { id: 'PLANEJAMENTO', title: 'PLANEJAMENTO', colorClass: "text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)]", iconType: 'circle' },
  { id: 'EM PROGRESSO', title: 'EM PROGRESSO', colorClass: "text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[#3b82f6]", iconType: 'circle' },
  { id: 'EM RISCO', title: 'EM RISCO', colorClass: "text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[#d97706]", iconType: 'circle' },
  { id: 'ATUALIZAÇÃO NECESSÁRIA', title: 'ATUALIZAÇÃO NECESSÁRIA', colorClass: "text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[#eab308]", iconType: 'circle' },
  { id: 'EM ESPERA', title: 'EM ESPERA', colorClass: "text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_1)]", iconType: 'circle' },
  { id: 'CONCLUÍDO', title: 'CONCLUÍDO', colorClass: "text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[#22c55e]", iconType: 'check' },
  { id: 'CANCELADO', title: 'CANCELADO', colorClass: 'text-white bg-red-500', iconType: 'check' },
];

export const mockIssues: Issue[] = [
  {
    id: 'i1', title: 'Etapa 2: Reunião Inicial / Kick-off (até 10 (dez) dias corridos da as...',
    status: 'PENDENTE', priority: 'Alta',
    assignee: mockUsers[0], startDate: '2023-09-01', dueDate: '2023-09-04',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'i2', title: 'Etapa 3: Elaboração do Plano de Implantação e Migração (Até 40...',
    status: 'PENDENTE', priority: 'Normal',
    startDate: '2023-10-01', dueDate: '2023-10-09',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  },
  {
    id: 'i3', title: 'Etapa 1: Acesso Inicial e Avaliação (Imediatamente após a...',
    status: 'EM PROGRESSO', priority: 'Alta',
    assignee: mockUsers[0], startDate: '2023-08-25', dueDate: '2023-08-28',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
];

export const mockActivities: ActivityLog[] = [
  { id: 'a1', user: mockUsers[0], action: 'criou a fase', target: 'Etapa 1: Acesso Inicial...', timestamp: '2 horas atrás' },
  { id: 'a2', user: mockUsers[0], action: 'moveu a fase para', target: 'EM PROGRESSO', timestamp: '1 hora atrás' },
  { id: 'a3', user: mockUsers[1], action: 'adicionou um comentário em', target: 'Etapa 2: Reunião Inicial', timestamp: '30 minutos atrás' },
];
