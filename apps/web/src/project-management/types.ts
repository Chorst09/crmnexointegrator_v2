export type IssueType = 'Iniciativa' | 'Épico' | 'História' | 'Bug' | 'Tarefa' | 'Subtarefa';
export type IssuePriority = 'Urgente' | 'Alta' | 'Normal' | 'Baixa';
export type IssueStatus = 'PENDENTE' | 'PLANEJAMENTO' | 'EM PROGRESSO' | 'EM RISCO' | 'ATUALIZAÇÃO NECESSÁRIA' | 'EM ESPERA' | 'CONCLUÍDO' | 'CANCELADO';

export interface Space {
  id: string;
  number?: string;
  name: string;
  initial: string;
  color: string;
  type?: 'B2B' | 'B2G';
  companyId?: string;
  projectManagerId?: string;
  opportunityId?: string;
  client?: string;
  sponsor?: string;
  manager?: string;
  status?: 'PLANEJADO' | 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO' | 'CANCELADO';
  phase?: 'SETUP' | 'KICKOFF_INTERNO' | 'KICKOFF_EXTERNO' | 'EXECUCAO' | 'MONITORAMENTO' | 'ENCERRAMENTO';
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
  teamMembers?: ProjectTeamMember[];
}

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
  role?: string;
  email?: string;
  allocationPercent?: number;
  hourlyCost?: number;
  memberId?: string;
}

export interface ProjectTeamMember {
  id: string;
  userId: string;
  role?: string;
  allocationPercent?: number;
  hourlyCost?: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
}

export interface CustomField {
  id: string;
  name: string;
  value: string;
}

export interface Issue {
  id: string;
  projectId?: string;
  phaseId?: string;
  key?: string;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee?: User;
  startDate?: string;
  dueDate?: string;
  estimate?: string;
  estimatedHours?: number;
  actualHours?: number;
  points?: string;
  sourceType?: 'phase' | 'task' | 'local';
  customFields?: CustomField[];
  followUps?: FollowUp[];
  createdAt: string;
  updatedAt: string;
  // Matriz RACI
  responsibleIds?: string[];
  accountableId?: string | null;
  accountable?: User;
  consultedIds?: string[];
  informedIds?: string[];
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
