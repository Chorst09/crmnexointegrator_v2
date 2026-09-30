export type IssueType = 'Iniciativa' | 'Épico' | 'História' | 'Bug' | 'Tarefa' | 'Subtarefa';
export type IssuePriority = 'Urgente' | 'Alta' | 'Normal' | 'Baixa';
export type IssueStatus = 'PENDENTE' | 'PLANEJAMENTO' | 'EM PROGRESSO' | 'EM RISCO' | 'ATUALIZAÇÃO NECESSÁRIA' | 'EM ESPERA' | 'CONCLUÍDO' | 'CANCELADO';

export interface Space {
  id: string;
  name: string;
  initial: string;
  color: string;
  client?: string;
  sponsor?: string;
  manager?: string;
  status?: 'PLANEJAMENTO' | 'EM EXECUCAO' | 'EM RISCO' | 'CONCLUIDO';
  priority?: IssuePriority;
  startDate?: string;
  endDate?: string;
  budget?: string;
  objective?: string;
  scope?: string;
  deliverables?: string;
  successCriteria?: string;
  risks?: string;
  notes?: string;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
  role?: string;
  email?: string;
}

export interface CustomField {
  id: string;
  name: string;
  value: string;
}

export interface Issue {
  id: string;
  projectId?: string;
  key?: string;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee?: User;
  startDate?: string;
  dueDate?: string;
  estimate?: string;
  points?: string;
  customFields?: CustomField[];
  followUps?: FollowUp[];
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Column {
  id: IssueStatus;
  title: string;
  colorClass: string;
  iconType?: 'dashed' | 'circle' | 'check';
}

export interface ActivityLog {
  id: string;
  user: User;
  action: string;
  target: string;
  timestamp: string;
}
