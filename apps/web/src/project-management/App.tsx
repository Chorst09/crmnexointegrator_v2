import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Compass, CheckSquare, Sparkles, Users, FileText,
  BarChart2, LayoutTemplate, MoreHorizontal,
  Search, Bell, Settings, Plus, ChevronDown, CheckCircle2,
  List as ListIcon, Calendar, Activity, Upload,
  Users2, GanttChartSquare, ArrowLeft, X, Target, Briefcase, DollarSign
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import KanbanBoard from './components/KanbanBoard';
import ListView from './components/ListView';
import Dashboard from './components/Dashboard';
import TeamView from './components/TeamView';
import CalendarView from './components/CalendarView';
import GanttView from './components/GanttView';
import ActivityView from './components/ActivityView';
import WorkloadView from './components/WorkloadView';
import ProjectRACIMatrixView from './components/ProjectRACIMatrixView';
import { HomeView, PlannedView, DocsView, WhiteboardsView } from './components/GlobalViews';
import TaskModal from './components/TaskModal';
import CreateTaskModal from './components/CreateTaskModal';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import { Space, Issue, ProjectTeamMember, User } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ViewMode = 'board' | 'list' | 'dashboard' | 'team' | 'calendar' | 'gantt' | 'raci' | 'activity' | 'workload';
type ProjectStatus = NonNullable<Space['status']>;
type ProjectPhase = NonNullable<Space['phase']>;
type ProjectPriority = 'Baixa' | 'Normal' | 'Alta' | 'Urgente';

type CompanyOption = {
  id: string;
  name: string;
  clientType?: 'B2B' | 'B2G' | string;
};

type UserOption = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  accessB2B?: boolean;
  accessB2G?: boolean;
  accessManagement?: boolean;
};

type ApiProject = {
  id: string;
  number?: string;
  name: string;
  description?: string | null;
  type?: 'B2B' | 'B2G';
  phase?: ProjectPhase;
  status?: ProjectStatus | string;
  budget?: number | string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  createdAt?: string;
  metadata?: Record<string, unknown> | null;
  companyId?: string;
  projectManagerId?: string;
  opportunityId?: string | null;
  company?: { id?: string; name?: string; clientType?: string } | null;
  projectManager?: { id?: string; name?: string; email?: string } | null;
  phases?: ApiProjectPhase[];
  tasks?: ApiProjectTask[];
  team?: ProjectTeamMember[];
};

type ApiProjectPhase = {
  id: string;
  name: string;
  description?: string | null;
  order?: number;
  status?: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  progressPercent?: number;
  createdAt?: string;
  updatedAt?: string;
  responsibleIds?: string[];
  accountableId?: string | null;
  consultedIds?: string[];
  informedIds?: string[];
};

type ApiProjectTask = {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  assignedTo?: { id?: string; name?: string; email?: string } | null;
  assignedToId?: string | null;
  phaseId?: string | null;
  estimatedHours?: number | string | null;
  actualHours?: number | string | null;
};

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluido',
  CANCELADO: 'Cancelado'
};

const PROJECT_STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'PLANEJADO', label: 'Planejado' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'PAUSADO', label: 'Pausado' },
  { value: 'CONCLUIDO', label: 'Concluido' },
  { value: 'CANCELADO', label: 'Cancelado' }
];

const emptyProjectForm = {
  name: '',
  type: 'B2B' as 'B2B' | 'B2G',
  companyId: '',
  client: '',
  sponsor: '',
  projectManagerId: '',
  manager: '',
  status: 'PLANEJADO' as ProjectStatus,
  phase: 'SETUP' as ProjectPhase,
  priority: 'Normal' as ProjectPriority,
  startDate: '',
  endDate: '',
  budget: '',
  opportunityId: '',
  objective: '',
  scope: '',
  deliverables: '',
  successCriteria: '',
  risks: '',
  notes: ''
};

type ProjectForm = typeof emptyProjectForm;

type GeneratedProjectPhase = {
  name: string;
  description?: string;
  order?: number;
  plannedStartDay?: number | null;
  plannedEndDay?: number | null;
  deliverable?: string;
  requirements?: string[];
  materials?: string[];
  pmbokProcessGroup?: string;
};

function normalizeProjectStatus(value?: string | null): ProjectStatus {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PLANEJAMENTO') return 'PLANEJADO';
  if (raw === 'EM EXECUCAO' || raw === 'EM EXECUÇÃO' || raw === 'EM PROGRESSO') return 'EM_ANDAMENTO';
  if (raw === 'EM RISCO') return 'PAUSADO';
  if (raw === 'CONCLUÍDO') return 'CONCLUIDO';
  if (['PLANEJADO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO'].includes(raw)) {
    return raw as ProjectStatus;
  }
  return 'PLANEJADO';
}

function normalizeProjectPhase(value?: string | null): ProjectPhase {
  const raw = String(value || '').trim().toUpperCase();
  if (['SETUP', 'KICKOFF_INTERNO', 'KICKOFF_EXTERNO', 'EXECUCAO', 'MONITORAMENTO', 'ENCERRAMENTO'].includes(raw)) {
    return raw as ProjectPhase;
  }
  return 'SETUP';
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  return String(value).split('T')[0];
}

function parseCurrencyValue(value: string) {
  const normalized = String(value || '')
    .replace(/[R$\s.]/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLookupText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findOptionByName<T extends { name: string }>(options: T[], value?: string | null) {
  const target = normalizeLookupText(value);
  if (!target) return undefined;
  return options.find((option) => normalizeLookupText(option.name) === target)
    || options.find((option) => normalizeLookupText(option.name).includes(target) || target.includes(normalizeLookupText(option.name)));
}

function normalizeAiPriority(value?: string | null): ProjectForm['priority'] | undefined {
  const raw = normalizeLookupText(value);
  if (!raw) return undefined;
  if (raw.includes('critica') || raw.includes('critical') || raw.includes('urgente')) return 'Urgente';
  if (raw.includes('alta') || raw.includes('high')) return 'Alta';
  if (raw.includes('baixa') || raw.includes('low')) return 'Baixa';
  return 'Normal';
}

function normalizeAiDateInput(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '';
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/\b([0-3]?\d)[\/\-.]([0-1]?\d)[\/\-.](\d{4})\b/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return '';
}

function formatAiBudget(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(numeric) ? String(numeric) : '';
}

function formatAiLongText(value: unknown, fallback = '') {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n');
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getInitials(name?: string, email?: string) {
  const source = String(name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function mapTeamMemberToUser(member: ProjectTeamMember, index = 0): User {
  const colors = ['bg-[#ff7a00]', 'bg-[#18c8df]', 'bg-[#22c55e]', 'bg-[#f6b40b]', 'bg-[#3b82f6]', 'bg-zinc-600'];
  const name = member.user?.name || 'Usuario sem nome';
  const email = member.user?.email || '';
  return {
    id: member.userId || member.user?.id || member.id,
    memberId: member.id,
    name,
    email,
    initials: getInitials(name, email),
    color: colors[index % colors.length],
    role: member.role,
    allocationPercent: member.allocationPercent ?? 100,
    hourlyCost: member.hourlyCost ?? 0
  };
}

function parseHours(value: unknown) {
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value || '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function mapProjectToSpace(project: ApiProject, index = 0): Space {
  const metadata = project.metadata && typeof project.metadata === 'object' ? project.metadata : {};
  const colors = ['bg-[#ff7a00]', 'bg-[#18c8df]', 'bg-[#22c55e]', 'bg-[#f6b40b]', 'bg-[#1f7fe5]'];
  const name = project.name || 'Projeto sem nome';
  const teamMembers = Array.isArray(project.team) ? [...project.team] : [];
  const hasProjectManagerInTeam = project.projectManagerId && teamMembers.some(member => member.userId === project.projectManagerId);
  if (project.projectManagerId && project.projectManager && !hasProjectManagerInTeam) {
    teamMembers.unshift({
      id: `manager-${project.projectManagerId}`,
      userId: project.projectManagerId,
      role: 'PROJECT_MANAGER',
      allocationPercent: 100,
      hourlyCost: 0,
      isActive: true,
      user: project.projectManager
    });
  }

  return {
    id: project.id,
    number: project.number,
    name,
    initial: name.charAt(0).toUpperCase(),
    color: colors[index % colors.length],
    type: project.type,
    companyId: project.companyId || project.company?.id,
    projectManagerId: project.projectManagerId || project.projectManager?.id,
    opportunityId: project.opportunityId || undefined,
    client: project.company?.name || String(metadata.client || ''),
    sponsor: String(metadata.sponsor || ''),
    manager: project.projectManager?.name || String(metadata.manager || ''),
    status: normalizeProjectStatus(project.status),
    phase: normalizeProjectPhase(project.phase),
    priority: (metadata.priority as Space['priority']) || 'Normal',
    startDate: toDateInputValue(project.plannedStartDate),
    endDate: toDateInputValue(project.plannedEndDate),
    budget: project.budget !== undefined && project.budget !== null ? String(project.budget) : '',
    objective: String(metadata.objective || ''),
    scope: String(metadata.scope || project.description || ''),
    deliverables: String(metadata.deliverables || ''),
    successCriteria: String(metadata.successCriteria || ''),
    risks: String(metadata.risks || ''),
    notes: String(metadata.notes || ''),
    createdAt: project.createdAt,
    teamMembers
  };
}

function normalizeIssueStatus(value?: string | null): Issue['status'] {
  const raw = String(value || '').trim().toUpperCase();
  if (['PENDING', 'TODO'].includes(raw)) return 'PENDENTE';
  if (['IN_PROGRESS', 'IN PROGRESS', 'DOING', 'EM_ANDAMENTO', 'EM EXECUCAO', 'EM EXECUÇÃO'].includes(raw)) return 'EM PROGRESSO';
  if (['AT_RISK', 'RISK', 'BLOCKED', 'PAUSADO'].includes(raw)) return 'EM RISCO';
  if (['DONE', 'COMPLETED', 'CONCLUIDO', 'CONCLUÍDO'].includes(raw)) return 'CONCLUÍDO';
  if (['SKIPPED', 'CANCELLED', 'CANCELED', 'CANCELADO'].includes(raw)) return 'CANCELADO';
  if (['PLANNED', 'PLANEJADO', 'PLANEJAMENTO'].includes(raw)) return 'PLANEJAMENTO';
  return 'PENDENTE';
}

function normalizeIssuePriority(value?: string | null): Issue['priority'] {
  const raw = String(value || '').trim().toUpperCase();
  if (['URGENT', 'URGENTE', 'CRITICAL'].includes(raw)) return 'Urgente';
  if (['HIGH', 'ALTA'].includes(raw)) return 'Alta';
  if (['LOW', 'BAIXA'].includes(raw)) return 'Baixa';
  return 'Normal';
}

function getIssueSequence(issue: Issue) {
  const keyMatch = String(issue.key || '').match(/^[A-Z]+-(\d+)$/i);
  if (keyMatch) return Number(keyMatch[1]);

  const titleMatch = String(issue.title || '').match(/\b(?:Fase|Etapa)\s*(\d+)\b/i);
  if (titleMatch) return Number(titleMatch[1]);

  return Number.MAX_SAFE_INTEGER;
}

function sortIssuesBySequence(items: Issue[]) {
  return [...items].sort((a, b) => {
    const sequenceDiff = getIssueSequence(a) - getIssueSequence(b);
    if (sequenceDiff !== 0) return sequenceDiff;

    const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdDiff !== 0) return createdDiff;

    return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
  });
}

function mapProjectPhaseToIssue(project: ApiProject, phase: ApiProjectPhase): Issue {
  const assignee = (phase as any).assignedTo;
  const initials = String(assignee?.name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join('');

  return {
    id: `phase-${phase.id}`,
    projectId: project.id,
    key: phase.order ? `FAS-${String(phase.order).padStart(2, '0')}` : undefined,
    title: phase.name || 'Fase sem nome',
    description: phase.description || '',
    status: normalizeIssueStatus(phase.status),
    priority: 'Normal',
    startDate: toDateInputValue(phase.plannedStartDate || phase.actualStartDate),
    dueDate: toDateInputValue(phase.plannedEndDate || phase.actualEndDate),
    estimatedHours: 0,
    actualHours: 0,
    sourceType: 'phase',
    assignee: assignee ? { id: assignee.id, name: assignee.name, initials, color: '#ff7a00' } : undefined,
    createdAt: phase.createdAt || project.createdAt || new Date().toISOString(),
    updatedAt: phase.updatedAt || project.createdAt || new Date().toISOString(),
    responsibleIds: phase.responsibleIds || [],
    accountableId: phase.accountableId || null,
    consultedIds: phase.consultedIds || [],
    informedIds: phase.informedIds || []
  };
}

function mapProjectTaskToIssue(project: ApiProject, task: ApiProjectTask): Issue {
  const initials = String(task.assignedTo?.name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return {
    id: `task-${task.id}`,
    projectId: project.id,
    phaseId: task.phaseId || undefined,
    key: undefined,
    title: task.title || 'Fase sem nome',
    description: task.description || '',
    status: normalizeIssueStatus(task.status),
    priority: normalizeIssuePriority(task.priority),
    dueDate: toDateInputValue(task.dueDate),
    assignee: task.assignedTo?.name ? {
      id: task.assignedTo.id || '',
      name: task.assignedTo.name,
      email: task.assignedTo.email || '',
      initials: initials || task.assignedTo.name.charAt(0).toUpperCase(),
      color: 'bg-[#ff7a00]'
    } : undefined,
    estimate: task.estimatedHours !== undefined && task.estimatedHours !== null ? String(task.estimatedHours) : '',
    estimatedHours: parseHours(task.estimatedHours),
    actualHours: parseHours(task.actualHours),
    sourceType: 'task',
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString()
  };
}

function getProjectPhaseId(issue: Issue) {
  const id = String(issue.id || '');
  if (!id.startsWith('phase-') || !issue.projectId) return '';
  return id.replace(/^phase-/, '');
}

function normalizeTitle(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .toLowerCase();
}

function issueStatusToProjectPhaseStatus(status?: Issue['status']) {
  switch (status) {
    case 'EM PROGRESSO':
    case 'EM RISCO':
    case 'ATUALIZAÇÃO NECESSÁRIA':
      return 'IN_PROGRESS';
    case 'CONCLUÍDO':
      return 'COMPLETED';
    case 'CANCELADO':
      return 'SKIPPED';
    case 'PENDENTE':
    case 'PLANEJAMENTO':
    case 'EM ESPERA':
    default:
      return 'PENDING';
  }
}

function issueStatusToTaskStatus(status?: Issue['status']) {
  switch (status) {
    case 'EM PROGRESSO':
    case 'ATUALIZAÇÃO NECESSÁRIA':
      return 'IN_PROGRESS';
    case 'EM RISCO':
      return 'BLOCKED';
    case 'CONCLUÍDO':
      return 'DONE';
    case 'CANCELADO':
      return 'BLOCKED';
    case 'PENDENTE':
    case 'PLANEJAMENTO':
    case 'EM ESPERA':
    default:
      return 'TODO';
  }
}

function issuePriorityToTaskPriority(priority?: Issue['priority']) {
  switch (priority) {
    case 'Urgente':
      return 'URGENT';
    case 'Alta':
      return 'HIGH';
    case 'Baixa':
      return 'LOW';
    case 'Normal':
    default:
      return 'MEDIUM';
  }
}

function buildPhaseRequestPayload(issue: Issue) {
  return {
    name: issue.title.trim(),
    description: issue.description || '',
    status: issueStatusToProjectPhaseStatus(issue.status),
    plannedStartDate: issue.startDate || null,
    plannedEndDate: issue.dueDate || null,
    assignedToId: issue.assignee?.id || null,
    // Matriz RACI
    responsibleIds: issue.responsibleIds || [],
    accountableId: issue.accountableId || null,
    consultedIds: issue.consultedIds || [],
    informedIds: issue.informedIds || []
  };
}

function buildTaskRequestPayload(issue: Issue) {
  return {
    title: issue.title.trim(),
    description: issue.description || '',
    status: issueStatusToTaskStatus(issue.status),
    priority: issuePriorityToTaskPriority(issue.priority),
    dueDate: issue.dueDate || null,
    assignedToId: issue.assignee?.id || null,
    phaseId: issue.phaseId || null,
    estimatedHours: issue.estimatedHours ?? parseHours(issue.estimate),
    actualHours: issue.actualHours ?? 0
  };
}

function getProjectTaskId(issue: Issue) {
  const id = String(issue.id || '');
  if (!id.startsWith('task-') || !issue.projectId) return '';
  return id.replace(/^task-/, '');
}

function getStoredProjectIssues(): Issue[] {
  const saved = localStorage.getItem('pm_issues_v4');
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((issue) => issue?.projectId) : [];
  } catch (e) {
    return [];
  }
}

function projectToForm(project: Space): ProjectForm {
  return {
    ...emptyProjectForm,
    name: project.name || '',
    type: project.type || 'B2B',
    companyId: project.companyId || '',
    client: project.client || '',
    sponsor: project.sponsor || '',
    projectManagerId: project.projectManagerId || '',
    manager: project.manager || '',
    status: project.status || 'PLANEJADO',
    phase: project.phase || 'SETUP',
    priority: project.priority || 'Normal',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    budget: project.budget || '',
    opportunityId: project.opportunityId || '',
    objective: project.objective || '',
    scope: project.scope || '',
    deliverables: project.deliverables || '',
    successCriteria: project.successCriteria || '',
    risks: project.risks || '',
    notes: project.notes || ''
  };
}

export default function App({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  const issueSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [activeView, setActiveView] = useState<ViewMode>('board');
  const [globalView, setGlobalView] = useState('spaces');

  const [issues, setIssues] = useState<Issue[]>(() => {
    return getStoredProjectIssues();
  });

  // Save issues to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pm_issues_v4', JSON.stringify(issues));
  }, [issues]);

  const [spaces, setSpaces] = useState<Space[]>(() => {
    const saved = localStorage.getItem('pm_projects_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed)
          ? parsed.map((space, index) => ({
              ...space,
              status: normalizeProjectStatus(space.status),
              phase: normalizeProjectPhase(space.phase),
              color: space.color || ['bg-[#ff7a00]', 'bg-[#18c8df]', 'bg-[#22c55e]'][index % 3],
              initial: space.initial || String(space.name || 'P').charAt(0).toUpperCase()
            }))
          : [];
      } catch (e) {}
    }
    return [];
  });
  const [activeSpaceId, setActiveSpaceId] = useState<string>('');
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState('');
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // New States
  const [selectedTask, setSelectedTask] = useState<Issue | null>(null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projectFormError, setProjectFormError] = useState('');
  const [generatedProjectPhases, setGeneratedProjectPhases] = useState<GeneratedProjectPhase[]>([]);

  // State variables for Agentes, Brain, and Compartilhar modals
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // States for ClickUp Brain Chat integration
  const [brainMessages, setBrainChat] = useState<{ role: 'user' | 'brain'; text: string }[]>([
    { role: 'brain', text: 'Olá! Sou o **CRM Nexos Brain** 🧠. Como posso ajudar com a estratégia, riscos ou fases do seu projeto hoje?' }
  ]);
  const [isBrainLoading, setIsBrainLoading] = useState(false);
  const [brainInput, setBrainInput] = useState('');

  useEffect(() => {
    localStorage.setItem('pm_projects_v1', JSON.stringify(spaces));
  }, [spaces]);

  // States for Agents & Project Sharing
  const [executingAgent, setExecutingAgent] = useState<string | null>(null);
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [projectTeam, setProjectTeam] = useState<any[]>([]);
  const [isAddingTeamMember, setIsAddingTeamMember] = useState(false);
  const [selectedNewMemberId, setSelectedNewMemberId] = useState<string>('');
  const [selectedNewMemberRole, setSelectedNewMemberRole] = useState<string>('Editor');

  const fetchProjectTeam = async () => {
    if (!activeSpaceId) return;
    try {
      const response = await fetch(buildApiUrl(`/projetos/${activeSpaceId}/team`), {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setProjectTeam(data);
      }
    } catch (err) {
      console.error('Erro ao buscar equipe do projeto:', err);
    }
  };

  const handleOpenShareModal = () => {
    setIsShareModalOpen(true);
    fetchProjectTeam();
  };

  const handleAddTeamMember = async () => {
    if (!activeSpaceId || !selectedNewMemberId) return;
    setIsAddingTeamMember(true);
    try {
      const response = await fetch(buildApiUrl(`/projetos/${activeSpaceId}/team`), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedNewMemberId,
          role: selectedNewMemberRole
        })
      });
      if (response.ok) {
        setSelectedNewMemberId('');
        fetchProjectTeam();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Erro ao adicionar membro à equipe.');
      }
    } catch (err) {
      console.error('Erro ao adicionar membro:', err);
    } finally {
      setIsAddingTeamMember(false);
    }
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    if (!activeSpaceId) return;
    if (!confirm('Tem certeza que deseja remover este membro do projeto?')) return;
    try {
      const response = await fetch(buildApiUrl(`/projetos/${activeSpaceId}/team/${memberId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        fetchProjectTeam();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Erro ao remover membro da equipe.');
      }
    } catch (err) {
      console.error('Erro ao remover membro:', err);
    }
  };

  const handleExecuteAgent = async (agentName: string, customPrompt: string) => {
    setExecutingAgent(agentName);
    setAgentResponse(null);
    try {
      const response = await fetch(buildApiUrl('/projetos/brain'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: activeSpaceId || 'general',
          projectName: activeProject?.name || 'Geral',
          scope: activeProject?.scope || 'Nenhum projeto específico selecionado',
          objective: activeProject?.objective || 'Sem objetivo',
          budget: activeProject?.budget || 'R$ 0,00',
          phases: activeProjectIssues || [],
          customPrompt: customPrompt
        })
      });

      if (!response.ok) {
        throw new Error(`Erro do Agente (HTTP ${response.status})`);
      }

      const data = await response.json();
      setAgentResponse(data.answer || 'O agente não retornou nenhuma resposta.');
    } catch (error) {
      console.error('Erro ao executar o agente:', error);
      setAgentResponse(`❌ Erro ao executar o agente: ${error instanceof Error ? error.message : 'Conexão falhou.'}`);
    } finally {
      setExecutingAgent(null);
    }
  };

  useEffect(() => {
    return () => {
      Object.values(issueSaveTimers.current).forEach(clearTimeout);
    };
  }, []);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    setProjectLoadError('');

    try {
      const response = await fetch(buildApiUrl('/projetos?limit=200'), {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status} ao carregar projetos`);
      }

      const payload = await response.json();
      const projects = Array.isArray(payload) ? payload : payload.projects || payload.data || [];
      const mapped = Array.isArray(projects) ? projects.map(mapProjectToSpace) : [];
      const apiIssues = Array.isArray(projects)
        ? projects.flatMap((project: ApiProject) => {
            const taskIssues = Array.isArray(project.tasks) ? project.tasks.map((task) => mapProjectTaskToIssue(project, task)) : [];
            const phaseIssues = Array.isArray(project.phases)
              ? project.phases.map((phase) => mapProjectPhaseToIssue(project, phase))
              : [];
            return [...phaseIssues, ...taskIssues];
          })
        : [];
      setIssues((current) => {
        const projectIds = new Set(mapped.map((project) => project.id));
        const apiIssueIds = new Set(apiIssues.map((issue) => issue.id));
        const apiTitleKeys = new Set(apiIssues.map((issue) => `${issue.projectId}::${normalizeTitle(issue.title)}`));
        const localProjectIssues = current.filter((issue) => (
          issue.projectId
          && projectIds.has(issue.projectId)
          && !['phase', 'task'].includes(String(issue.sourceType || ''))
          && !String(issue.id).startsWith('phase-')
          && !String(issue.id).startsWith('task-')
          && !apiIssueIds.has(issue.id)
          && !apiTitleKeys.has(`${issue.projectId}::${normalizeTitle(issue.title)}`)
        ));
        return [...apiIssues, ...localProjectIssues];
      });
      setSpaces(mapped);
      setExpandedSpaces((prev) => {
        const next = { ...prev };
        mapped.forEach((project) => {
          if (next[project.id] === undefined) next[project.id] = true;
        });
        return next;
      });
      setActiveSpaceId((current) => {
        const requestedProjectId = new URLSearchParams(window.location.search).get('projectId');
        if (requestedProjectId && mapped.some((project) => project.id === requestedProjectId)) return requestedProjectId;
        if (current && mapped.some((project) => project.id === current)) return current;
        return mapped[0]?.id || '';
      });
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      setProjectLoadError(error instanceof Error ? error.message : 'Erro ao carregar projetos');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const loadProjectDependencies = async () => {
    try {
      const [companiesRes, usersRes] = await Promise.all([
        fetch(buildApiUrl('/companies'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/users'), { headers: getAuthHeaders() })
      ]);

      if (companiesRes.ok) {
        const payload = await companiesRes.json();
        const rows = Array.isArray(payload) ? payload : payload.companies || payload.data || [];
        setCompanies(Array.isArray(rows) ? rows : []);
      }

      if (usersRes.ok) {
        const payload = await usersRes.json();
        const rows = Array.isArray(payload) ? payload : payload.users || payload.data || [];
        const assignable = Array.isArray(rows)
          ? rows.filter((user: UserOption) => {
              const role = String(user.role || '').toUpperCase();
              return ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR', 'SELLER', 'USER', 'USER_B2B', 'USER_B2G'].includes(role)
                || user.accessManagement
                || user.accessB2B
                || user.accessB2G;
            })
          : [];
        setUsers(assignable);
      }
    } catch (error) {
      console.error('Erro ao carregar empresas e usuários:', error);
    }
  };

  useEffect(() => {
    loadProjects();
    loadProjectDependencies();
  }, []);

  const activeProject = spaces.find(s => s.id === activeSpaceId) || spaces[0];
  const activeTeamUsers = (activeProject?.teamMembers || [])
    .filter(member => member.isActive !== false)
    .map(mapTeamMemberToUser);
  const activeProjectIssues = sortIssuesBySequence(
    (() => {
      if (!activeProject) return [];
      const projectIssues = issues.filter(issue => issue.projectId === activeProject.id);
      const taskPhaseIds = new Set(projectIssues.filter(issue => issue.sourceType === 'task').map(issue => issue.phaseId).filter(Boolean));
      const apiPhase = projectIssues.filter(issue => 
        issue.sourceType === 'phase' && 
        String(issue.id).startsWith('phase-') &&
        !taskPhaseIds.has(issue.id.replace(/^phase-/, ''))
      );
      const seenKeys = new Set(apiPhase.map(issue => normalizeTitle(issue.title)));
      const deduped = apiPhase.slice();
      for (const issue of projectIssues) {
        if (issue.sourceType === 'phase' && String(issue.id).startsWith('phase-')) continue;
        const key = normalizeTitle(issue.title);
        if (seenKeys.has(key)) continue;
        deduped.push(issue);
      }
      return deduped;
    })()
  );
  const activeProjectRaciIssues = sortIssuesBySequence(
    issues.filter(issue => issue.projectId === activeProject?.id && issue.sourceType === 'phase' && String(issue.id).startsWith('phase-'))
  );
  const isDashboardFocus = (globalView === 'spaces' && activeView === 'dashboard') || globalView === 'dashboards';

  const submitNewSpace = async () => {
    const name = projectForm.name.trim();
    const scope = projectForm.scope.trim();
    const objective = projectForm.objective.trim();

    if (!name || !projectForm.companyId || !projectForm.projectManagerId || !scope || !objective) {
      setProjectFormError('Informe nome, cliente, gestor, objetivo e escopo antes de criar o projeto planejado.');
      return;
    }

    if (isCreatingSpace || editingSpaceId) {
      try {
        setProjectFormError('');
        const response = await fetch(buildApiUrl(editingSpaceId ? `/projetos/${editingSpaceId}` : '/projetos'), {
          method: editingSpaceId ? 'PUT' : 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name,
            type: projectForm.type,
            companyId: projectForm.companyId,
            projectManagerId: projectForm.projectManagerId,
            status: projectForm.status,
            phase: projectForm.phase,
            budget: parseCurrencyValue(projectForm.budget),
            plannedStartDate: projectForm.startDate || null,
            plannedEndDate: projectForm.endDate || null,
            opportunityId: projectForm.opportunityId || null,
            description: scope,
            metadata: {
              objective,
              scope,
              methodology: 'PMBOK/PMI',
              charterFramework: 'Project Charter + Declaração de Escopo',
              analysisSource: generatedProjectPhases.length > 0 ? 'GEMINI_AI_ANALYSIS' : 'MANUAL',
              sponsor: projectForm.sponsor.trim(),
              priority: projectForm.priority,
              deliverables: projectForm.deliverables.trim(),
              successCriteria: projectForm.successCriteria.trim(),
              risks: projectForm.risks.trim(),
              notes: projectForm.notes.trim()
            },
            ...(!editingSpaceId && generatedProjectPhases.length > 0 ? { phases: generatedProjectPhases } : {})
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `Erro ${response.status} ao ${editingSpaceId ? 'atualizar' : 'criar'} projeto`);
        }

        const savedSpace = mapProjectToSpace(payload, spaces.findIndex((project) => project.id === payload.id));
        setSpaces(prev => editingSpaceId
          ? prev.map(project => project.id === savedSpace.id ? { ...project, ...savedSpace } : project)
          : [savedSpace, ...prev.filter(project => project.id !== savedSpace.id)]
        );
        setActiveSpaceId(savedSpace.id);
        setExpandedSpaces(prev => ({ ...prev, [savedSpace.id]: true }));
        setActiveView('dashboard');
        setGlobalView('spaces');
        navigate(`/projetos/${savedSpace.id}`);
      } catch (error) {
        console.error('Erro ao salvar projeto:', error);
        setProjectFormError(error instanceof Error ? error.message : 'Erro ao salvar projeto');
        return;
      }
    }
    setIsCreatingSpace(false);
    setEditingSpaceId(null);
    setProjectForm(emptyProjectForm);
    setGeneratedProjectPhases([]);
    setProjectFormError('');
  };

  const openProject = (projectId: string, view: ViewMode = 'dashboard') => {
    setActiveSpaceId(projectId);
    setGlobalView('spaces');
    setActiveView(view);
    navigate(`/projetos/${projectId}`);
  };

  const editProject = (projectId: string) => {
    const project = spaces.find((item) => item.id === projectId);
    if (!project) return;
    setProjectForm(projectToForm(project));
    setGeneratedProjectPhases([]);
    setEditingSpaceId(projectId);
    setIsCreatingSpace(false);
    setProjectFormError('');
  };

  const deleteProject = async (projectId: string) => {
    const project = spaces.find((item) => item.id === projectId);
    if (!project) return;
    const confirmed = window.confirm(`Excluir o projeto "${project.name}"? Esta ação remove o projeto e suas fases.`);
    if (!confirmed) return;

    try {
      const response = await fetch(buildApiUrl(`/projetos/${projectId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Erro ${response.status} ao excluir projeto`);
      }
      setSpaces(prev => prev.filter(item => item.id !== projectId));
      setIssues(prev => prev.filter(issue => issue.projectId !== projectId));
      setExpandedSpaces(prev => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      setActiveSpaceId(current => {
        if (current !== projectId) return current;
        return spaces.find(item => item.id !== projectId)?.id || '';
      });
      if (activeSpaceId === projectId) {
        setGlobalView('home');
      }
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      alert(error instanceof Error ? error.message : 'Erro ao excluir projeto');
    }
  };

  const getProjectIssueCount = (projectId: string) => {
    return issues.filter(issue => issue.projectId === projectId).length;
  };

  const toggleSpace = (id: string) => {
    setExpandedSpaces(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [isCreatingTaskGlobal, setIsCreatingTaskGlobal] = useState(false);

  const handleQueryBrain = async (promptText: string) => {
    if (!promptText.trim() || isBrainLoading) return;

    const userMsg = promptText.trim();
    setBrainChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setBrainInput('');
    setIsBrainLoading(true);

    try {
      const response = await fetch(buildApiUrl('/projetos/brain'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: activeSpaceId || 'general',
          projectName: activeProject?.name || 'Geral',
          scope: activeProject?.scope || 'Nenhum projeto específico selecionado',
          objective: activeProject?.objective || 'Sem objetivo',
          budget: activeProject?.budget || 'R$ 0,00',
          phases: activeProjectIssues || [],
          customPrompt: userMsg
        })
      });

      if (!response.ok) {
        throw new Error(`Erro do Brain (HTTP ${response.status})`);
      }

      const data = await response.json();
      setBrainChat(prev => [...prev, { role: 'brain', text: data.answer || 'Desculpe, o Brain não retornou resposta.' }]);
    } catch (error) {
      console.error('Erro ao consultar o Brain:', error);
      setBrainChat(prev => [...prev, { role: 'brain', text: `❌ Erro ao falar com o Brain: ${error instanceof Error ? error.message : 'Conexão falhou.'}` }]);
    } finally {
      setIsBrainLoading(false);
    }
  };

  // Create a new task test flow
  const handleCreateTask = () => {
    setIsCreatingTaskGlobal(true);
  };

  const saveProjectPhaseIssue = async (issue: Issue) => {
    const phaseId = getProjectPhaseId(issue);
    if (!phaseId || !issue.projectId) return;

    const payload = buildPhaseRequestPayload(issue);
    if (!payload.name) throw new Error('Informe o nome da fase antes de salvar.');

    const response = await fetch(buildApiUrl(`/projetos/${issue.projectId}/phases/${phaseId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(responsePayload.error || `Erro ${response.status} ao salvar fase`);
    }
  };

  const saveProjectTaskIssue = async (issue: Issue) => {
    const taskId = getProjectTaskId(issue);
    if (!taskId || !issue.projectId) return;

    const payload = buildTaskRequestPayload(issue);
    if (!payload.title) throw new Error('Informe o nome da tarefa antes de salvar.');

    const response = await fetch(buildApiUrl(`/projetos/${issue.projectId}/tasks/${taskId}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(responsePayload.error || `Erro ${response.status} ao salvar tarefa`);
    }
  };

  const convertPhaseToTaskIssue = async (issue: Issue) => {
    const phaseId = getProjectPhaseId(issue);
    if (!phaseId || !issue.projectId) return null;

    const payload = buildTaskRequestPayload({
      ...issue,
      phaseId,
      sourceType: 'task'
    });
    if (!payload.title) throw new Error('Informe o nome da tarefa antes de salvar.');

    const response = await fetch(buildApiUrl(`/projetos/${issue.projectId}/tasks`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(responsePayload.error || `Erro ${response.status} ao converter fase em tarefa`);
    }

    return mapProjectTaskToIssue({ id: issue.projectId } as ApiProject, responsePayload);
  };

  const saveProjectIssue = async (issue: Issue) => {
    if (getProjectTaskId(issue)) {
      await saveProjectTaskIssue(issue);
      return;
    }
    await saveProjectPhaseIssue(issue);
  };

  const scheduleProjectIssueSave = (issue: Issue) => {
    const canPersist = Boolean(getProjectPhaseId(issue) || getProjectTaskId(issue));
    if (!canPersist || !issue.title.trim()) return;

    if (issueSaveTimers.current[issue.id]) {
      clearTimeout(issueSaveTimers.current[issue.id]);
    }

    issueSaveTimers.current[issue.id] = setTimeout(() => {
      saveProjectIssue(issue).catch((error) => {
        console.error('Erro ao salvar item:', error);
        alert(error instanceof Error ? error.message : 'Erro ao salvar item');
      });
    }, 700);
  };

  const handlePersistedIssueChange = async (updatedIssue: Issue, previousIssue?: Issue) => {
    const originalIssue = previousIssue || issues.find(i => i.id === updatedIssue.id);
    setIssues(prev => prev.map(issue => issue.id === updatedIssue.id ? updatedIssue : issue));
    try {
      await saveProjectIssue(updatedIssue);
    } catch (error) {
      if (originalIssue) {
        setIssues(prev => prev.map(issue => issue.id === originalIssue.id ? originalIssue : issue));
      }
      console.error('Erro ao salvar item:', error);
      alert(error instanceof Error ? error.message : 'Erro ao salvar item');
    }
  };

  const handleGlobalCreateTaskSubmit = async (title: string, data: any) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || !activeProject?.id) return;

    try {
      const shouldCreateTask = data.assignee?.id || data.estimatedHours || data.phaseKind === 'DEFAULT';
      const response = await fetch(buildApiUrl(`/projetos/${activeProject.id}/${shouldCreateTask ? 'tasks' : 'phases'}`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(shouldCreateTask
          ? {
              title: normalizedTitle,
              description: data.description || '',
              status: issueStatusToTaskStatus(data.status || 'PENDENTE'),
              priority: issuePriorityToTaskPriority(data.priority || 'Normal'),
              dueDate: data.dueDate || null,
              assignedToId: data.assignee?.id || null,
              estimatedHours: parseHours(data.estimatedHours)
            }
          : {
              name: normalizedTitle,
              description: data.description || '',
              status: issueStatusToProjectPhaseStatus(data.status || 'PENDENTE'),
              plannedEndDate: data.dueDate || null
            })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Erro ${response.status} ao criar fase`);
      }

      const newTask = {
        ...(shouldCreateTask
          ? mapProjectTaskToIssue({ id: activeProject.id, createdAt: activeProject.createdAt } as ApiProject, payload)
          : mapProjectPhaseToIssue({ id: activeProject.id, createdAt: activeProject.createdAt } as ApiProject, payload)),
        priority: data.priority || 'Normal',
        assignee: data.assignee,
        estimate: data.estimatedHours ? String(data.estimatedHours) : '',
        estimatedHours: parseHours(data.estimatedHours),
        customFields: data.customFields || []
      };
      setIssues(prev => [...prev.filter(issue => issue.id !== newTask.id), newTask]);
      setIsCreatingTaskGlobal(false);

      if (data.phaseKind === 'KICKOFF_INTERNO' || data.phaseKind === 'KICKOFF_EXTERNO') {
        const kickoffContext = {
          source: 'project-management',
          projectId: activeProject.id,
          projectName: activeProject.name,
          projectClient: activeProject.client,
          projectManager: activeProject.manager,
          projectScope: activeProject.scope,
          projectObjective: activeProject.objective,
          phaseId: newTask.id,
          phaseTitle: normalizedTitle,
          phaseDescription: data.description || '',
          kickoffType: data.phaseKind === 'KICKOFF_INTERNO' ? 'internal' : 'external',
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('pm_kickoff_context', JSON.stringify(kickoffContext));
        navigate(`/kickoff?from=project&openCreate=1&type=${kickoffContext.kickoffType}`);
      }
    } catch (error) {
      console.error('Erro ao criar fase:', error);
      alert(error instanceof Error ? error.message : 'Erro ao criar fase');
    }
  };

  const handleUpdateIssue = (updatedIssue: Issue) => {
    // Atualiza o estado e agenda o save — fases agora suportam assignee diretamente
    setIssues(prev => prev.map(issue => issue.id === updatedIssue.id ? updatedIssue : issue));
    setSelectedTask(updatedIssue);
    scheduleProjectIssueSave(updatedIssue);
  };

  const handleDeletePhase = async (issue: Issue) => {
    const projectId = issue.projectId;
    if (!projectId) {
      alert('Não foi possível excluir: a fase não está vinculada a um projeto.');
      return;
    }
    const rawId = String(issue.id || '');
    const normalizedTitle = normalizeTitle(issue.title);

    const serverDelete = async (url: string) => {
      const response = await fetch(buildApiUrl(url), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erro ${response.status} ao excluir`);
      }
    };

    let deletedServer = false;
    try {
      if (rawId.startsWith('task-')) {
        await serverDelete(`/projetos/${projectId}/tasks/${rawId.replace(/^task-/, '')}`);
        deletedServer = true;
      } else {
        let phaseId = getProjectPhaseId(issue);
        if (!phaseId) {
          const realPhase = issues.find((item) =>
            item.projectId === projectId
            && getProjectPhaseId(item)
            && normalizeTitle(item.title) === normalizedTitle
          );
          if (realPhase) phaseId = getProjectPhaseId(realPhase);
        }

        if (phaseId) {
          await serverDelete(`/projetos/${projectId}/phases/${phaseId}`);
          deletedServer = true;
        } else {
          const detailRes = await fetch(buildApiUrl(`/projetos/${projectId}`), {
            headers: getAuthHeaders()
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const phases = Array.isArray(detail.phases) ? detail.phases : [];
            const match = phases.find((p: ApiProjectPhase) => normalizeTitle(p.name) === normalizedTitle);
            if (match) {
              await serverDelete(`/projetos/${projectId}/phases/${match.id}`);
              deletedServer = true;
            } else {
              const tasks = Array.isArray(detail.tasks) ? detail.tasks : [];
              const taskMatch = tasks.find((t: ApiProjectTask) => normalizeTitle(t.title) === normalizedTitle);
              if (taskMatch) {
                await serverDelete(`/projetos/${projectId}/tasks/${taskMatch.id}`);
                deletedServer = true;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert(error instanceof Error ? error.message : 'Erro ao excluir');
      return;
    }

    if (!deletedServer) {
      alert('O item não foi encontrado no servidor para exclusão definitiva. Se o problema persistir, recarregue a página e tente novamente.');
      return;
    }

    if (rawId.startsWith('task-')) {
      const taskId = rawId.replace(/^task-/, '');
      setIssues(prev => prev.filter(item => !(item.projectId === projectId && String(item.id).replace(/^task-/, '') === taskId)));
    } else {
      setIssues(prev => prev.filter(item => (
        item.projectId !== projectId
        || normalizeTitle(item.title) !== normalizedTitle
      )));
    }
    if (selectedTask?.id === issue.id) setSelectedTask(null);
  };

  return (
    <div className="flex h-screen bg-[#050914] font-sans overflow-hidden text-slate-300 text-sm">

      {/* Far Left Thin Navigation */}
      {!isDashboardFocus && (
      <nav className="w-16 bg-[#050914] flex-shrink-0 flex flex-col items-center py-4 border-r border-[#263345] z-30">
        <div className="w-8 h-8 bg-[#22c55e] rounded text-white flex items-center justify-center font-bold mb-6 cursor-pointer shadow-[0_0_22px_rgba(34,197,94,0.25)]">
          C
        </div>

        <div className="flex flex-col gap-4 w-full px-2">
          <NavItem icon={Home} label="Início" active={globalView === 'home'} onClick={() => setGlobalView('home')} />
          <NavItem icon={Compass} label="Projetos" active={globalView === 'spaces'} onClick={() => setGlobalView('spaces')} />
          <NavItem icon={CheckSquare} label="Planejado" active={globalView === 'planned'} onClick={() => setGlobalView('planned')} />
          <NavItem icon={Users} label="Equipes" active={globalView === 'teams'} onClick={() => setGlobalView('teams')} />
          <NavItem icon={FileText} label="Documentos" active={globalView === 'docs'} onClick={() => setGlobalView('docs')} />
          <NavItem icon={BarChart2} label="Painéis" active={globalView === 'dashboards'} onClick={() => setGlobalView('dashboards')} />
          <NavItem icon={LayoutTemplate} label="Quadros" active={globalView === 'whiteboards'} onClick={() => setGlobalView('whiteboards')} />
        </div>
      </nav>
      )}

      {/* Second Sidebar (Spaces) */}
      {globalView === 'spaces' && !isDashboardFocus && (
        <aside className="w-[280px] bg-[#111827] flex-shrink-0 flex flex-col h-full border-r border-[#263345] z-20">
          <div className="p-4 flex items-center justify-between border-b border-[#263345] bg-[linear-gradient(90deg,rgba(255,122,0,0.13),transparent)]">
          <h2 className="font-semibold text-slate-100">Projetos</h2>
          <button onClick={() => setIsCreatingSpace(true)} className="bg-[#ff7a00] hover:bg-[#f6b40b] text-white hover:text-[#050914] text-xs font-semibold px-3 py-2 rounded flex items-center gap-1 transition-colors">
            <Plus className="w-3 h-3" /> Criar
          </button>
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          <div
            className="flex items-center gap-2 text-slate-400 hover:bg-[#1f2937] p-1.5 rounded cursor-pointer mb-4"
            onClick={() => setGlobalView('home')}
          >
            <LayoutTemplate className="w-4 h-4" />
            <span className="text-sm">Todos os projetos</span>
          </div>

          <div className="flex flex-col gap-2">
            {spaces.map(space => (
              <div key={space.id}>
                <div
                  className={cn("flex items-center justify-between p-2 rounded cursor-pointer group", activeSpaceId === space.id ? "bg-[#263345] text-slate-100 ring-1 ring-[#ff7a00]/35" : "text-slate-300 hover:bg-[#1f2937]")}
                  onClick={() => setActiveSpaceId(space.id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <div className={cn("w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-bold text-white flex-shrink-0", space.color)}>{space.initial}</div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm text-slate-200" title={space.name}>{space.name}</span>
                      <span className="block truncate text-[10px] text-slate-500">{space.client || space.status || 'Projeto'}</span>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn("w-4 h-4 transition-transform", expandedSpaces[space.id] ? "rotate-180 text-slate-300" : "opacity-0 group-hover:opacity-100")}
                    onClick={(e) => { e.stopPropagation(); toggleSpace(space.id); }}
                  />
                </div>

                {expandedSpaces[space.id] && (
                  <div className="ml-5 mt-1 border-l border-slate-700 pl-2 flex flex-col gap-1">
                    <div
                      className={cn("flex items-center justify-between p-1.5 rounded cursor-pointer", activeView === 'list' && activeSpaceId === space.id ? 'bg-[#263345] text-slate-100' : 'text-slate-400 hover:bg-[#1f2937]')}
                      onClick={() => { setActiveView('list'); setActiveSpaceId(space.id); }}
                    >
                      <div className="flex items-center gap-2">
                        <ListIcon className="w-4 h-4" />
                        <span className="text-sm">Fases</span>
                      </div>
                      <span className="text-xs text-slate-500">{getProjectIssueCount(space.id)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div onClick={() => setIsCreatingSpace(true)} className="flex items-center gap-2 text-slate-500 hover:text-[#ffb15c] p-1.5 ml-5 rounded cursor-pointer mt-1">
              <Plus className="w-3.5 h-3.5" />
              <span className="text-sm">Novo Projeto</span>
            </div>
          </div>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#070b16]">

        {/* Top Global Bar */}
        {!isDashboardFocus && (
        <header className="h-12 border-b border-[#263345] px-4 flex items-center justify-between bg-[#111827] flex-shrink-0">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex h-8 items-center gap-1.5 rounded-md border border-[#374151] px-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-[#ff7a00] hover:bg-[#1f2937] hover:text-white"
                title="Voltar ao CRM"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
            )}
            <div className="flex items-center gap-2 cursor-pointer hover:bg-[#1f2937] px-2 py-1 rounded transition-colors">
              <div className="w-5 h-5 bg-[#22c55e] rounded text-white flex items-center justify-center font-bold text-xs">C</div>
              <span className="font-semibold text-slate-200">Gestão de Projetos</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>
          </div>

          <div className="flex-1 max-w-lg mx-4 flex items-center gap-2">
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-8 pr-3 py-1 bg-[#0d1423] border border-[#374151] rounded-md text-slate-300 placeholder-slate-500 focus:outline-none focus:border-[#ff7a00] text-xs transition-colors"
                placeholder="Pesquisar ⌘ K"
                onClick={() => alert('Pesquisa global ativada. Use ⌘ K para buscar fases, documentos ou pessoas.')}
              />
            </div>
            <button onClick={() => alert('Abrindo painel de Chat com IA...')} className="bg-[#0d1423] hover:bg-[#1f2937] border border-[#374151] text-slate-300 px-3 py-1 rounded-md text-xs font-medium flex items-center gap-2 transition-colors">
              Chats com IA <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <CheckCircle2 onClick={() => setGlobalView('planned')} className="w-5 h-5 hover:text-slate-200 cursor-pointer" />
            <Bell onClick={() => alert('Painel de Notificações')} className="w-5 h-5 hover:text-slate-200 cursor-pointer" />
            <div onClick={() => alert('Menu do Perfil')} className="w-6 h-6 rounded-full bg-[#ff7a00] flex items-center justify-center text-white text-xs font-bold ring-2 ring-[#111827] cursor-pointer">
              CH
            </div>
          </div>
        </header>
        )}

        {globalView === 'spaces' ? (
          isDashboardFocus ? (
            <div className="flex-1 overflow-hidden bg-[#070b16]">
              <Dashboard
                projects={spaces}
                issues={issues}
                activeProjectId={activeSpaceId}
                onProjectChange={setActiveSpaceId}
                onBack={() => setActiveView('list')}
                onCreateProject={() => setIsCreatingSpace(true)}
              />
            </div>
          ) : (
          <>
            {/* Project Header & Tabs */}
            <div className="bg-[#111827] border-b border-[#263345] flex-shrink-0">
          <div className="px-6 pt-4 pb-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xl font-bold text-slate-200 min-w-0 flex-1 mr-4">
                <div className={cn("w-5 h-5 rounded-sm text-[10px] flex items-center justify-center font-bold text-white mr-1 flex-shrink-0", activeProject?.color || "bg-slate-700")}>
                  {activeProject?.initial || "P"}
                </div>
                <span className="truncate max-w-[300px] sm:max-w-[500px] md:max-w-[750px] lg:max-w-[950px]" title={activeProject?.name || "Projetos"}>
                  {activeProject?.name || (isLoadingProjects ? "Carregando projetos..." : "Projetos")}
                </span>
                <span className="text-slate-500 font-normal flex-shrink-0">/</span>
                <ListIcon className="w-5 h-5 text-slate-400 ml-1 flex-shrink-0" /> <span className="flex-shrink-0">Fases</span>
                <ChevronDown className="w-5 h-5 text-slate-500 cursor-pointer flex-shrink-0" />
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                <button onClick={() => setIsAgentsModalOpen(true)} className="hover:text-slate-200 flex items-center gap-1 transition-colors"><Users2 className="w-4 h-4 text-cyan-400" /> Agentes</button>
                <button onClick={() => setIsBrainModalOpen(true)} className="hover:text-slate-200 flex items-center gap-1 transition-colors"><Sparkles className="w-4 h-4 text-teal-400" /> Brain</button>
                <button onClick={handleOpenShareModal} className="hover:text-slate-200 flex items-center gap-1 transition-colors"><Users className="w-4 h-4 text-orange-400" /> Compartilhar</button>
              </div>
            </div>

            <div className="flex items-center gap-6 overflow-x-auto text-sm font-medium hide-scrollbar">
              <Tab icon={Users} label="Equipe" active={activeView === 'team'} onClick={() => setActiveView('team')} />
              <Tab icon={BarChart2} label="Painéis" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
              <Tab icon={ListIcon} label="Lista" active={activeView === 'list'} onClick={() => setActiveView('list')} />
              <Tab icon={LayoutTemplate} label="Quadro" active={activeView === 'board'} onClick={() => setActiveView('board')} />
              <Tab icon={Calendar} label="Calendário" active={activeView === 'calendar'} onClick={() => setActiveView('calendar')} />
              <Tab icon={GanttChartSquare} label="Gantt" active={activeView === 'gantt'} onClick={() => setActiveView('gantt')} />
              <Tab icon={CheckCircle2} label="Matriz RACI" active={activeView === 'raci'} onClick={() => setActiveView('raci')} />
              <Tab icon={Activity} label="Atividade" active={activeView === 'activity'} onClick={() => setActiveView('activity')} />
              <Tab icon={ListIcon} label="Carga de trabalho" active={activeView === 'workload'} onClick={() => setActiveView('workload')} />
              <div className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer pb-2">
                <Plus className="w-4 h-4" /> Visualização
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 flex flex-col gap-3 flex-shrink-0 bg-[#070b16] border-b border-[#263345]">
          {activeProject && (
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
              <div className="rounded-lg border border-[#263345] bg-[#111827] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Escopo</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-200">{activeProject.scope || 'Escopo ainda não informado.'}</p>
              </div>
              <div className="rounded-lg border border-[#263345] bg-[#111827] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Objetivo</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-200">{activeProject.objective || 'Objetivo ainda não informado.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#263345] bg-[linear-gradient(140deg,rgba(255,122,0,0.16),rgba(17,24,39,0.98))] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Status</p>
                  <p className="mt-1 text-sm font-black text-[#ffb15c]">{PROJECT_STATUS_LABELS[activeProject.status || 'PLANEJADO']}</p>
                </div>
                <div className="rounded-lg border border-[#263345] bg-[linear-gradient(140deg,rgba(34,197,94,0.14),rgba(17,24,39,0.98))] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Fases</p>
                  <p className="mt-1 text-sm font-black text-[#22c55e]">{activeProjectIssues.length}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={() => alert('Controles de Visão (Filtros, Agrupamento)')} className="bg-[#111827] hover:bg-[#1f2937] text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 border border-[#374151]">
              <LayersIcon className="w-4 h-4 text-[#ff7a00]" /> Controles
            </button>

          <div className="ml-auto flex items-center gap-3 text-slate-400">
            <button onClick={() => alert('Busca específica na lista atual')} className="hover:bg-[#111827] p-1.5 rounded"><Search className="w-4 h-4" /></button>
            <button onClick={() => alert('Configurações da visualização atual')} className="hover:bg-[#111827] p-1.5 rounded"><Settings className="w-4 h-4" /></button>
            <div className="h-4 w-px bg-slate-700 mx-1"></div>
            <button onClick={handleCreateTask} className="bg-[#ff7a00] hover:bg-[#f6b40b] text-white hover:text-[#050914] px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Fase <ChevronDown className="w-3 h-3 ml-1" />
            </button>
          </div>
          </div>
        </div>

        {/* View Renderer */}
        <div className="flex-1 overflow-hidden relative bg-[#070b16]">
          {projectLoadError && (
            <div className="m-6 rounded-md border border-[#ff7a00]/35 bg-[#ff7a00]/10 px-4 py-3 text-sm font-semibold text-[#ffb15c]">
              {projectLoadError}
            </div>
          )}
          {!isLoadingProjects && spaces.length === 0 && !projectLoadError && (
            <div className="m-6 rounded-lg border border-[#263345] bg-[#111827] p-8 text-center">
              <Briefcase className="mx-auto mb-3 h-10 w-10 text-[#ff7a00]" />
              <h2 className="text-lg font-black text-slate-100">Nenhum projeto cadastrado</h2>
              <p className="mt-2 text-sm text-slate-500">Crie o primeiro projeto para iniciar o planejamento.</p>
              <button onClick={() => setIsCreatingSpace(true)} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#ff7a00] px-4 py-2 text-sm font-black text-white hover:bg-[#f6b40b] hover:text-[#050914]">
                <Plus className="h-4 w-4" />
                Novo Projeto
              </button>
            </div>
          )}
          {activeView === 'board' && activeProject && <KanbanBoard issues={activeProjectIssues} setIssues={setIssues} users={activeTeamUsers} onTaskClick={setSelectedTask} onCreateTask={handleGlobalCreateTaskSubmit} onIssueChange={handlePersistedIssueChange} onDeleteIssue={handleDeletePhase} />}
          {activeView === 'list' && activeProject && <ListView issues={activeProjectIssues} onTaskClick={setSelectedTask} onDeleteIssue={handleDeletePhase} />}
          {activeView === 'dashboard' && (
            <Dashboard
              projects={spaces}
              issues={issues}
              activeProjectId={activeSpaceId}
              onProjectChange={setActiveSpaceId}
              onBack={() => setActiveView('list')}
              onCreateProject={() => setIsCreatingSpace(true)}
            />
          )}
          {activeView === 'team' && (
            <TeamView
              projectId={activeProject?.id}
              projectName={activeProject?.name}
              users={users}
              onTeamChanged={loadProjects}
            />
          )}
          {activeView === 'calendar' && <CalendarView issues={activeProjectIssues} onTaskClick={setSelectedTask} />}
          {activeView === 'gantt' && <GanttView issues={activeProjectIssues} />}
          {activeView === 'raci' && activeProject && <ProjectRACIMatrixView issues={activeProjectRaciIssues} users={activeTeamUsers} onUpdateIssue={handlePersistedIssueChange} />}
          {activeView === 'activity' && <ActivityView project={activeProject} issues={activeProjectIssues} users={activeTeamUsers} onTaskClick={setSelectedTask} />}
          {activeView === 'workload' && <WorkloadView issues={activeProjectIssues} users={activeTeamUsers} />}
        </div>

          </>
          )
        ) : (
          <div className="flex-1 overflow-hidden relative bg-[#070b16]">
            {globalView === 'home' && (
              <HomeView
                projects={spaces}
                issues={issues}
                getPhaseCount={getProjectIssueCount}
                onCreateProject={() => {
                  setIsCreatingSpace(true);
                  setGeneratedProjectPhases([]);
                  setGlobalView('spaces');
                }}
                onOpenDashboard={() => {
                  setGlobalView('spaces');
                  setActiveView('dashboard');
                }}
                onEditProject={editProject}
                onDeleteProject={deleteProject}
              />
            )}
            {globalView === 'planned' && (
              <PlannedView
                projects={spaces}
                issues={issues}
                onCreateProject={() => {
                  setGlobalView('spaces');
                  setIsCreatingSpace(true);
                }}
                onOpenProject={(projectId) => {
                  setActiveSpaceId(projectId);
                  setGlobalView('spaces');
                  setActiveView('dashboard');
                }}
              />
            )}
            {globalView === 'teams' && (
              <TeamView
                projectId={activeProject?.id}
                projectName={activeProject?.name}
                users={users}
                onTeamChanged={loadProjects}
              />
            )}
            {globalView === 'docs' && (
              <DocsView
                projects={spaces}
                activeProjectId={activeSpaceId}
                onProjectChange={setActiveSpaceId}
                onCreateProject={() => {
                  setGlobalView('spaces');
                  setIsCreatingSpace(true);
                }}
              />
            )}
            {globalView === 'dashboards' && (
              <Dashboard
                projects={spaces}
                issues={issues}
                activeProjectId={activeSpaceId}
                onProjectChange={setActiveSpaceId}
                onBack={() => setGlobalView('home')}
                onCreateProject={() => {
                  setGlobalView('spaces');
                  setIsCreatingSpace(true);
                }}
              />
            )}
            {globalView === 'whiteboards' && <WhiteboardsView activeProject={activeProject} />}
          </div>
        )}
      </main>

      {selectedTask && (
        <TaskModal task={selectedTask} users={activeTeamUsers} onClose={() => setSelectedTask(null)} onUpdate={handleUpdateIssue} />
      )}

      {isCreatingTaskGlobal && (
        <CreateTaskModal
          users={activeTeamUsers}
          onClose={() => setIsCreatingTaskGlobal(false)}
          onCreate={handleGlobalCreateTaskSubmit}
        />
      )}

      {(isCreatingSpace || editingSpaceId) && (
        <ProjectCreateModal
          mode={editingSpaceId ? 'edit' : 'create'}
          form={projectForm}
          error={projectFormError}
          generatedPhases={generatedProjectPhases}
          companies={companies}
          users={users}
          statusOptions={PROJECT_STATUS_OPTIONS}
          onChange={(patch) => {
            setProjectForm(prev => ({ ...prev, ...patch }));
            setProjectFormError('');
          }}
          onAnalyzeResult={(patch, phases) => {
            setProjectForm(prev => ({ ...prev, ...patch }));
            setGeneratedProjectPhases(phases);
            setProjectFormError('');
          }}
          onCancel={() => {
            setIsCreatingSpace(false);
            setEditingSpaceId(null);
            setProjectForm(emptyProjectForm);
            setGeneratedProjectPhases([]);
            setProjectFormError('');
          }}
          onSubmit={submitNewSpace}
        />
      )}

      {/* --- AGENTES AI MODAL --- */}
      {isAgentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="flex max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0b1020] shadow-[0_0_50px_rgba(24,200,223,0.15)]">
            {/* Header */}
            <div className="relative border-b border-[#263345] bg-[linear-gradient(90deg,rgba(24,200,223,0.1),transparent)] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users2 className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-100">Agentes de Inteligência Artificial Ativos</h3>
                  <p className="text-xs text-slate-400">Automatizações cognitivas e monitoramento de governança para este projeto.</p>
                </div>
              </div>
              <button onClick={() => { setIsAgentsModalOpen(false); setAgentResponse(null); }} className="rounded-md border border-[#374151] p-1.5 text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0">
              {/* Left Column - List of agents */}
              <div className="lg:col-span-5 space-y-3">
                {[
                  {
                    name: 'Agente PMI/PMBOK Architect',
                    role: 'Gerência de Projetos',
                    status: 'Ativo',
                    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                    desc: 'Analisa o cronograma e escopo de forma contínua para sugerir caminhos críticos e zelar pelas restrições do PMI.',
                    prompt: 'Você é o Agente PMI/PMBOK Architect. Analise o projeto atual e gere uma auditoria de conformidade com o PMBOK (Caminho Crítico, restrições e premissas recomendadas).'
                  },
                  {
                    name: 'Agente Analista Financeiro & SLA',
                    role: 'Controladoria de Contratos',
                    status: 'Disponível',
                    color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
                    desc: 'Identifica desvios em custos, faturamento das fases e descumprimento de prazos/SLAs pactuados.',
                    prompt: 'Você é o Agente Analista Financeiro & SLA. Analise o orçamento, faturamento das fases e cronograma para identificar riscos de desvio financeiro e de SLA com recomendações de prevenção.'
                  },
                  {
                    name: 'Agente Redator Comercial de Propostas',
                    role: 'Vendas & Pré-Vendas',
                    status: 'Disponível',
                    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
                    desc: 'Gera escopos descritivos, propostas de projetos e materiais de kickoff com base nos editais anexados.',
                    prompt: 'Você é o Agente Redator Comercial de Propostas. Escreva uma proposta comercial formal de kickoff de projeto com base nos dados fornecidos do escopo e entregáveis.'
                  }
                ].map((agent, i) => (
                  <div key={i} className="p-3.5 rounded-lg border border-[#263345] bg-[#111827]/40 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-100">{agent.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${agent.color}`}>
                          {agent.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-cyan-400/80 font-medium">{agent.role}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{agent.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleExecuteAgent(agent.name, agent.prompt)}
                        disabled={!!executingAgent}
                        className="flex-1 py-1.5 text-center text-[11px] font-black text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-55 disabled:cursor-not-allowed rounded transition-all shadow-[0_0_12px_rgba(8,145,178,0.15)]"
                      >
                        {executingAgent === agent.name ? 'Executando...' : 'Executar Agente IA'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column - Results Display */}
              <div className="lg:col-span-7 flex flex-col h-full min-h-[300px] border border-[#263345] bg-[#070b16] rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-[#263345] bg-[#111827]/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Terminal do Agente</span>
                  {agentResponse && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(agentResponse);
                        alert('Resultados copiados!');
                      }}
                      className="text-[10px] px-2 py-1 bg-cyan-950/40 text-cyan-400 hover:text-cyan-300 border border-cyan-800/40 rounded transition-colors font-bold"
                    >
                      Copiar Resposta
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar text-xs">
                  {executingAgent ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-3 text-slate-400 animate-pulse">
                      <div className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-lg">
                        🧠
                      </div>
                      <div className="flex flex-col items-center space-y-1.5">
                        <p className="font-bold text-slate-300">Agente "{executingAgent}" trabalhando...</p>
                        <p className="text-[11px] text-slate-500 text-center max-w-xs">Analisando escopo, orçamento, objetivos e fases do projeto com o modelo de governança.</p>
                      </div>
                    </div>
                  ) : agentResponse ? (
                    <div className="space-y-3 text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {agentResponse.split('**').map((chunk, index) =>
                        index % 2 === 1 ? <strong key={index} className="font-bold text-cyan-300">{chunk}</strong> : chunk
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                      <span>🧠</span>
                      <p className="text-center text-[11px] max-w-xs">Selecione um agente cognitivo na lista à esquerda e clique em "Executar Agente IA" para ver a análise estratégica detalhada.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="border-t border-[#263345] bg-[#111827] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">CRM Nexos Core Agents Engine v3.0</span>
              <button onClick={() => { setIsAgentsModalOpen(false); setAgentResponse(null); }} className="rounded-md border border-[#374151] px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-[#1f2937] hover:text-white transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- COMPARTILHAR MODAL --- */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-orange-500/30 bg-[#0b1020] shadow-[0_0_50px_rgba(255,122,0,0.1)]">
            {/* Header */}
            <div className="relative border-b border-[#263345] bg-[linear-gradient(90deg,rgba(255,122,0,0.1),transparent)] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Users className="h-5 w-5 text-orange-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-100 font-sans">Compartilhar Projeto</h3>
                  <p className="text-xs text-slate-400">Gerencie quem tem acesso a este projeto.</p>
                </div>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="rounded-md border border-[#374151] p-1.5 text-slate-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {/* Copy Link Section */}
              <div className="p-3 rounded-lg border border-[#263345] bg-[#111827]/50 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Link de Acesso Direto</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/projetos?invite=${activeProject?.id || 'general'}`}
                    className="flex-1 bg-[#070b16] text-xs px-2.5 py-1.5 rounded border border-[#263345] text-slate-400 outline-none select-all truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/projetos?invite=${activeProject?.id || 'general'}`);
                      alert('Link copiado para a área de transferência!');
                    }}
                    className="px-3 py-1.5 bg-[#ff7a00] hover:bg-[#f6b40b] text-white hover:text-slate-950 font-bold rounded text-xs transition-all whitespace-nowrap cursor-pointer"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Add New Member Section */}
              <div className="p-3.5 rounded-lg border border-[#263345] bg-[#111827]/30 space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adicionar Membro à Equipe</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedNewMemberId}
                    onChange={(e) => setSelectedNewMemberId(e.target.value)}
                    className="flex-1 bg-[#070b16] border border-[#263345] rounded text-xs px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="">Selecione um usuário...</option>
                    {users
                      .filter(u => !projectTeam.some(m => m.userId === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email || 'CRM'})</option>
                      ))
                    }
                  </select>
                  <select
                    value={selectedNewMemberRole}
                    onChange={(e) => setSelectedNewMemberRole(e.target.value)}
                    className="bg-[#070b16] border border-[#263345] rounded text-xs px-2 py-1.5 text-slate-200"
                  >
                    <option>Editor</option>
                    <option>Administrador</option>
                    <option>Visualizador</option>
                  </select>
                  <button
                    onClick={handleAddTeamMember}
                    disabled={isAddingTeamMember || !selectedNewMemberId}
                    className="px-3 py-1.5 bg-[#ff7a00] hover:bg-[#f6b40b] hover:text-[#050914] text-white font-bold rounded text-xs transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {isAddingTeamMember ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Integrantes Ativos ({projectTeam.length})</label>
                <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                  {projectTeam.length > 0 ? (
                    projectTeam.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded bg-[#111827]/30 border border-[#263345]/50 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0">
                            {String(m.user?.name || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-200 truncate">{m.user?.name || 'Membro do Projeto'}</p>
                            <p className="text-[10px] text-slate-500 truncate">{m.user?.email || 'Membro do CRM'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-[#111827] border border-[#263345] px-2 py-0.5 rounded text-slate-300">
                            {m.role || 'Editor'}
                          </span>
                          <button
                            onClick={() => handleRemoveTeamMember(m.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-all"
                            title="Remover da equipe"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhum membro específico cadastrado na equipe. O gerente do projeto é o proprietário principal.</p>
                  )}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="border-t border-[#263345] bg-[#111827] px-6 py-4 flex items-center justify-end flex-shrink-0">
              <button onClick={() => setIsShareModalOpen(false)} className="rounded-md bg-[#ff7a00] hover:bg-[#f6b40b] hover:text-slate-950 px-5 py-2 text-xs font-black text-white transition-all shadow-[0_0_15px_rgba(255,122,0,0.15)]">
                Pronto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CLICKUP BRAIN MODAL --- */}
      {isBrainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="flex h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-teal-500/30 bg-[#0b1020] shadow-[0_0_50px_rgba(24,200,223,0.2)]">
            {/* Sidebar info */}
            <div className="hidden md:flex w-64 bg-[#111827]/70 border-r border-[#263345] p-5 flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
                  <span className="font-black text-slate-100 uppercase tracking-widest text-xs">Atalhos Brain</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O Brain tem acesso completo à sua estrutura de fases, objetivo, escopo e restrições para oferecer insights instantâneos.
                </p>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleQueryBrain('Por favor, faça um resumo estratégico e detalhado dos objetivos, escopo e premissas deste projeto.')}
                    disabled={isBrainLoading}
                    className="w-full text-left p-2.5 rounded bg-[#070b16] hover:bg-teal-950/20 border border-[#263345] hover:border-teal-400/40 text-xs text-slate-300 font-semibold transition-all duration-200"
                  >
                    📊 Resumir Status
                  </button>
                  <button
                    onClick={() => handleQueryBrain('Analise as fraquezas do escopo e sugira 3 riscos graves do PMI com as respectivas contramedidas.')}
                    disabled={isBrainLoading}
                    className="w-full text-left p-2.5 rounded bg-[#070b16] hover:bg-teal-950/20 border border-[#263345] hover:border-teal-400/40 text-xs text-slate-300 font-semibold transition-all duration-200"
                  >
                    ⚠️ Avaliar Riscos
                  </button>
                  <button
                    onClick={() => handleQueryBrain('Sugerir 3 melhorias e entregáveis adicionais fundamentais para este tipo de projeto obter sucesso.')}
                    disabled={isBrainLoading}
                    className="w-full text-left p-2.5 rounded bg-[#070b16] hover:bg-teal-950/20 border border-[#263345] hover:border-teal-400/40 text-xs text-slate-300 font-semibold transition-all duration-200"
                  >
                    🛠️ Sugerir Melhorias
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Powered by Gemini 3.8 Flash
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col h-full bg-[#050914]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#263345] bg-[#111827] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-100">CRM Nexos Brain</h3>
                    <p className="text-[10px] text-slate-400">Ativo sobre: <span className="text-teal-400 font-bold">{activeProject?.name || 'Projeto Geral'}</span></p>
                  </div>
                </div>
                <button onClick={() => setIsBrainModalOpen(false)} className="rounded-md border border-[#374151] p-1.5 text-slate-400 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {brainMessages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-3 max-w-[85%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto")}>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border",
                      msg.role === 'user'
                        ? "bg-[#ff7a00]/10 border-[#ff7a00]/30 text-[#ff7a00]"
                        : "bg-teal-500/10 border-teal-500/30 text-teal-400"
                    )}>
                      {msg.role === 'user' ? 'CH' : '🧠'}
                    </div>
                    <div className={cn(
                      "p-3.5 rounded-lg text-xs leading-relaxed space-y-2 border",
                      msg.role === 'user'
                        ? "bg-[#111827]/40 border-[#263345] text-slate-200"
                        : "bg-[#111827]/70 border-teal-500/20 text-slate-300 shadow-[0_0_15px_rgba(24,200,223,0.03)]"
                    )}>
                      {/* Simple markdown-style highlight formatter for bold text */}
                      <p className="whitespace-pre-line">
                        {msg.text.split('**').map((chunk, index) =>
                          index % 2 === 1 ? <strong key={index} className="font-bold text-teal-300">{chunk}</strong> : chunk
                        )}
                      </p>
                    </div>
                  </div>
                ))}

                {isBrainLoading && (
                  <div className="flex gap-3 max-w-[85%] mr-auto items-center animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                      🧠
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#111827]/70 border border-teal-500/20 text-slate-500 text-xs">
                      <div className="flex gap-1.5 items-center">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:0.4s]"></span>
                        <span className="text-[10px] font-bold text-slate-400 ml-1">O Brain está consultando o projeto no servidor...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-[#263345] bg-[#111827]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleQueryBrain(brainInput);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    disabled={isBrainLoading}
                    value={brainInput}
                    onChange={(e) => setBrainInput(e.target.value)}
                    placeholder={isBrainLoading ? "Aguarde o Brain responder..." : "Pergunte ao Brain sobre escopo, cronograma, riscos..."}
                    className="flex-1 bg-[#050914] text-xs px-3 py-2.5 rounded border border-[#263345] focus:border-teal-400 text-slate-200 outline-none placeholder:text-slate-600 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={isBrainLoading || !brainInput.trim()}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-[#263345] text-white hover:text-slate-950 font-bold rounded text-xs transition-all whitespace-nowrap cursor-pointer shadow-[0_0_15px_rgba(20,184,166,0.15)] disabled:shadow-none"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCreateModal({
  mode = 'create',
  form,
  error,
  generatedPhases = [],
  companies,
  users,
  statusOptions,
  onChange,
  onAnalyzeResult,
  onCancel,
  onSubmit
}: {
  mode?: 'create' | 'edit';
  form: ProjectForm;
  error: string;
  generatedPhases?: GeneratedProjectPhase[];
  companies: CompanyOption[];
  users: UserOption[];
  statusOptions: Array<{ value: ProjectStatus; label: string }>;
  onChange: (patch: Partial<ProjectForm>) => void;
  onAnalyzeResult: (patch: Partial<ProjectForm>, phases: GeneratedProjectPhase[]) => void;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'scope' | 'details'>('general');
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiFileInputKey, setAiFileInputKey] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const fieldClass = "w-full rounded-md border border-[#374151] bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff7a00] focus:ring-2 focus:ring-[#ff7a00]/20";
  const labelClass = "text-[11px] font-bold uppercase tracking-wide text-[#8f9caf]";
  const filteredCompanies = companies.filter((company) => !company.clientType || String(company.clientType).toUpperCase() === form.type);
  const filteredUsers = users.filter((user) => {
    if (form.type === 'B2G') return user.accessB2G || ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR', 'USER_B2G'].includes(String(user.role || '').toUpperCase());
    return user.accessB2B || ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR', 'SELLER', 'USER', 'USER_B2B'].includes(String(user.role || '').toUpperCase());
  });

  const handleAnalyzeWithAi = async () => {
    const sourceText = aiSourceText.trim();
    if (!sourceText && !aiFile) {
      setAiError('Anexe o edital/projeto ou cole o texto antes de usar a IA.');
      return;
    }

    setIsAnalyzing(true);
    setAiError('');

    try {
      const formData = new FormData();
      if (sourceText) formData.append('sourceText', sourceText);
      if (aiFile) formData.append('file', aiFile);
      formData.append('projectName', form.name);
      formData.append('projectType', form.type);
      formData.append('client', form.client);

      const token = localStorage.getItem('token');
      const response = await fetch(buildApiUrl('/projetos/ai-analyze'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAiError(payload.error || `Erro ${response.status} ao analisar com IA`);
        return;
      }

      const analysis = payload.analysis || {};
      const matchedCompany = findOptionByName(companies, analysis.client || form.client);
      const matchedManager = findOptionByName(users, analysis.manager || form.manager);
      const nextType = String(matchedCompany?.clientType || analysis.type || form.type).toUpperCase() === 'B2G' ? 'B2G' : 'B2B';
      const aiPriority = normalizeAiPriority(analysis.priority);
      onAnalyzeResult({
        name: analysis.name || form.name,
        type: nextType,
        companyId: matchedCompany?.id || form.companyId,
        client: matchedCompany?.name || analysis.client || form.client,
        sponsor: analysis.sponsor || form.sponsor,
        projectManagerId: matchedManager?.id || form.projectManagerId,
        manager: matchedManager?.name || analysis.manager || form.manager,
        budget: formatAiBudget(analysis.budget) || form.budget,
        startDate: normalizeAiDateInput(analysis.startDate) || form.startDate,
        endDate: normalizeAiDateInput(analysis.endDate) || form.endDate,
        objective: analysis.objective || form.objective,
        scope: analysis.scope || form.scope,
        deliverables: formatAiLongText(analysis.deliverables, form.deliverables),
        successCriteria: formatAiLongText(analysis.successCriteria, form.successCriteria),
        risks: formatAiLongText(analysis.risks, form.risks),
        notes: analysis.notes || form.notes,
        status: normalizeProjectStatus(analysis.status || 'PLANEJADO'),
        priority: aiPriority || form.priority,
        phase: 'SETUP'
      }, Array.isArray(analysis.phases) ? analysis.phases : []);
    } catch (error) {
      console.error('Erro ao analisar projeto com IA:', error);
      setAiError(error instanceof Error ? error.message : 'Erro ao analisar projeto com IA');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#374151] bg-[#0b1020] shadow-2xl">
        <div className="relative overflow-hidden border-b border-[#263345] bg-[radial-gradient(circle_at_12%_0%,rgba(255,122,0,0.28),transparent_28%),linear-gradient(120deg,#111827,#070b16_58%,#111827)] px-6 py-5">
          <div className="absolute right-10 top-0 h-24 w-24 rounded-full bg-[#22c55e]/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff7a00] text-white shadow-[0_0_24px_rgba(255,122,0,0.28)]">
                  <Briefcase className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-[#f6b40b]/40 bg-[#f6b40b]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#f6b40b]">
                  {mode === 'edit' ? 'Editar projeto' : 'Novo projeto'}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-100">
                {mode === 'edit' ? 'Editar cadastro do projeto' : 'Cadastro completo do projeto'}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                {mode === 'edit' ? 'Atualize escopo, objetivo, responsáveis e governança do projeto.' : 'Escopo, objetivo, responsáveis e critérios entram antes da criação das fases.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-[#374151] bg-[#111827]/80 p-2 text-slate-400 transition-colors hover:border-[#ff7a00] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="bg-[#111827]/80 border-b border-[#263345] px-6 py-2.5 flex gap-5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={cn(
              "pb-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 px-1 flex items-center gap-1.5",
              activeTab === 'general' ? "border-[#ff7a00] text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            <span>💼</span> Cadastro Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scope')}
            className={cn(
              "pb-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 px-1 flex items-center gap-1.5",
              activeTab === 'scope' ? "border-[#ff7a00] text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            <span>🎯</span> Objetivo e Escopo (IA)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={cn(
              "pb-1 text-xs font-black uppercase tracking-wider transition-all border-b-2 px-1 flex items-center gap-1.5",
              activeTab === 'details' ? "border-[#ff7a00] text-slate-100" : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            <span>📋</span> Entregas, Riscos e Notas
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 custom-scrollbar">
          {error && (
            <div className="mb-4 rounded-md border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-4 py-3 text-sm font-semibold text-[#ffb15c]">
              {error}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="flex flex-col gap-1.5 lg:col-span-2">
                  <span className={labelClass}>Nome do projeto *</span>
                  <input className={fieldClass} value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ex.: Implantação Paranacidade" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Tipo</span>
                  <select
                    className={fieldClass}
                    value={form.type}
                    onChange={(e) => onChange({ type: e.target.value as ProjectForm['type'], companyId: '', client: '' })}
                  >
                    <option value="B2B">B2B Privado</option>
                    <option value="B2G">B2G Governo</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Cliente *</span>
                  <select
                    className={fieldClass}
                    value={form.companyId}
                    onChange={(e) => {
                      const company = companies.find((item) => item.id === e.target.value);
                      onChange({
                        companyId: e.target.value,
                        client: company?.name || '',
                        type: (String(company?.clientType || form.type).toUpperCase() === 'B2G' ? 'B2G' : 'B2B') as ProjectForm['type']
                      });
                    }}
                  >
                    <option value="">Selecione...</option>
                    {filteredCompanies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Patrocinador</span>
                  <input className={fieldClass} value={form.sponsor} onChange={(e) => onChange({ sponsor: e.target.value })} placeholder="Sponsor" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Gerente *</span>
                  <select
                    className={fieldClass}
                    value={form.projectManagerId}
                    onChange={(e) => {
                      const user = users.find((item) => item.id === e.target.value);
                      onChange({ projectManagerId: e.target.value, manager: user?.name || '' });
                    }}
                  >
                    <option value="">Selecione...</option>
                    {filteredUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}{user.email ? ` - ${user.email}` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Orçamento</span>
                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#22c55e]" />
                    <input className={`${fieldClass} pl-9`} value={form.budget} onChange={(e) => onChange({ budget: e.target.value })} placeholder="R$ 0,00" />
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Status</span>
                  <select className={fieldClass} value={form.status} onChange={(e) => onChange({ status: e.target.value as ProjectForm['status'] })}>
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Prioridade</span>
                  <select className={fieldClass} value={form.priority} onChange={(e) => onChange({ priority: e.target.value as ProjectForm['priority'] })}>
                    <option>Baixa</option>
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Início</span>
                    <input type="date" className={fieldClass} value={form.startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Fim</span>
                    <input type="date" className={fieldClass} value={form.endDate} onChange={(e) => onChange({ endDate: e.target.value })} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scope' && (
            <div className="space-y-5">
              {mode === 'create' && (
                <div className="rounded-lg border border-[#263345] bg-[#111827] p-4">
                  <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-black text-slate-100">
                        <Sparkles className="h-4 w-4 text-[#18c8df]" />
                        Analisar com IA PMBOK/PMI
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Anexe o edital/projeto ou cole o conteúdo para preencher requisitos, escopo e fases.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[#18c8df]/45 bg-[#18c8df]/10 px-4 py-2 text-xs font-black text-[#67e8f9] transition-colors hover:border-[#67e8f9] hover:bg-[#18c8df]/15">
                        <Upload className="h-3.5 w-3.5" />
                        Anexar edital/projeto
                        <input
                          key={aiFileInputKey}
                          type="file"
                          className="sr-only"
                          accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain,text/markdown,text/csv,application/json"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            setAiFile(file);
                            setAiError('');
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleAnalyzeWithAi}
                        disabled={isAnalyzing}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-[#18c8df] px-4 py-2 text-xs font-black text-[#050914] transition-colors hover:bg-[#67e8f9] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {isAnalyzing ? 'Analisando...' : 'Gerar requisitos e fases'}
                      </button>
                    </div>
                  </div>
                  {aiFile && (
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-[#263345] bg-[#070b16] px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0 text-[#18c8df]" />
                        <span className="truncate text-xs font-semibold text-slate-300">{aiFile.name}</span>
                        <span className="text-[11px] text-slate-600">{Math.max(1, Math.round(aiFile.size / 1024))} KB</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAiFile(null);
                          setAiFileInputKey((value) => value + 1);
                          setAiError('');
                        }}
                        className="rounded-md p-1 text-slate-500 transition-colors hover:bg-[#1f2937] hover:text-white"
                        title="Remover anexo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <textarea
                    className={`${fieldClass} min-h-[120px] resize-y`}
                    value={aiSourceText}
                    onChange={(e) => {
                      setAiSourceText(e.target.value);
                      setAiError('');
                    }}
                    placeholder="Opcional: cole aqui também trechos do edital, termo de referência, requisitos técnicos, prazos e entregáveis..."
                  />
                  {aiError && (
                    <div className="mt-3 rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
                      {aiError}
                    </div>
                  )}
                  {generatedPhases.length > 0 && (
                    <div className="mt-4 rounded-md border border-[#18c8df]/25 bg-[#18c8df]/5 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-wide text-[#18c8df]">{generatedPhases.length} fases geradas</p>
                        <span className="text-[11px] font-semibold text-slate-500">Serão criadas junto com o projeto</span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {generatedPhases.map((phase, index) => (
                          <div key={`${phase.name}-${index}`} className="rounded-md border border-[#263345] bg-[#070b16] p-3">
                            <p className="text-xs font-black text-slate-100">{index + 1}. {phase.name}</p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{phase.description || phase.deliverable || 'Fase gerada pela IA.'}</p>
                            {phase.pmbokProcessGroup && (
                              <p className="mt-2 text-[11px] font-bold text-[#67e8f9]">{phase.pmbokProcessGroup}</p>
                            )}
                            {(phase.plannedStartDay || phase.plannedEndDay) && (
                              <p className="mt-2 text-[11px] font-bold text-[#ffb15c]">
                                Dia {phase.plannedStartDay || '?'} a {phase.plannedEndDay || '?'}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Objetivo *</span>
                  <textarea className={`${fieldClass} min-h-[140px] resize-y`} value={form.objective} onChange={(e) => onChange({ objective: e.target.value })} placeholder="Resultado esperado e impacto do projeto" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Escopo *</span>
                  <textarea className={`${fieldClass} min-h-[140px] resize-y`} value={form.scope} onChange={(e) => onChange({ scope: e.target.value })} placeholder="O que entra e os limites principais do projeto" />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Entregáveis</span>
                  <textarea className={`${fieldClass} min-h-[110px] resize-y`} value={form.deliverables} onChange={(e) => onChange({ deliverables: e.target.value })} placeholder="Pacotes, documentos, homologações e entregas" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Critérios de sucesso</span>
                  <textarea className={`${fieldClass} min-h-[110px] resize-y`} value={form.successCriteria} onChange={(e) => onChange({ successCriteria: e.target.value })} placeholder="Indicadores, aceite e metas" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Riscos</span>
                  <textarea className={`${fieldClass} min-h-[110px] resize-y`} value={form.risks} onChange={(e) => onChange({ risks: e.target.value })} placeholder="Dependências, bloqueios e pontos de atenção" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Observações</span>
                  <textarea className={`${fieldClass} min-h-[110px] resize-y`} value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Contexto adicional" />
                </label>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#374151] bg-[linear-gradient(140deg,rgba(255,122,0,0.16),rgba(17,24,39,0.96))] p-3">
              <Target className="mb-3 h-5 w-5 text-[#ff7a00]" />
              <p className="text-xs font-bold text-slate-100">Objetivo definido</p>
              <p className="mt-1 text-[11px] text-slate-500">{form.objective.trim() ? 'Pronto para validação executiva.' : 'Pendente'}</p>
            </div>
            <div className="rounded-lg border border-[#374151] bg-[linear-gradient(140deg,rgba(246,180,11,0.14),rgba(17,24,39,0.96))] p-3">
              <FileText className="mb-3 h-5 w-5 text-[#f6b40b]" />
              <p className="text-xs font-bold text-slate-100">Escopo registrado</p>
              <p className="mt-1 text-[11px] text-slate-500">{form.scope.trim() ? 'Base para montar as fases.' : 'Pendente'}</p>
            </div>
            <div className="rounded-lg border border-[#374151] bg-[linear-gradient(140deg,rgba(34,197,94,0.14),rgba(17,24,39,0.96))] p-3">
              <CheckCircle2 className="mb-3 h-5 w-5 text-[#22c55e]" />
              <p className="text-xs font-bold text-slate-100">Governança</p>
              <p className="mt-1 text-[11px] text-slate-500">{form.manager.trim() || form.sponsor.trim() ? 'Responsáveis informados.' : 'Pendente'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#263345] bg-[#111827] px-6 py-4 flex-shrink-0">
          <div className="flex gap-2">
            {activeTab !== 'general' && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'scope') setActiveTab('general');
                  else if (activeTab === 'details') setActiveTab('scope');
                }}
                className="rounded-md border border-[#374151] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-all hover:bg-[#1f2937]"
              >
                Voltar
              </button>
            )}
            {activeTab !== 'details' && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'general') setActiveTab('scope');
                  else if (activeTab === 'scope') setActiveTab('details');
                }}
                className="rounded-md border border-[#ff7a00]/50 bg-[#ff7a00]/10 px-4 py-2 text-xs font-semibold text-[#ff7a00] hover:text-white transition-all hover:bg-[#ff7a00]/25"
              >
                Próximo Passo
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="rounded-md border border-[#374151] px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-[#1f2937] hover:text-white">
              Cancelar
            </button>
            <button type="button" onClick={onSubmit} className="rounded-md bg-[#ff7a00] px-5 py-2 text-sm font-black text-white shadow-[0_0_24px_rgba(255,122,0,0.2)] transition-colors hover:bg-[#f6b40b] hover:text-[#050914]">
              {mode === 'edit' ? 'Salvar alterações' : 'Criar projeto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 w-full py-2 px-1 rounded-md transition-colors group",
      active ? "text-[#ff7a00] bg-[#ff7a00]/10" : "text-slate-500 hover:text-slate-300 hover:bg-[#263345]"
    )}>
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

function Tab({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 pb-2 border-b-2 transition-colors whitespace-nowrap",
        active ? "border-[#ff7a00] text-slate-200" : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600"
      )}
    >
      <Icon className={cn("w-4 h-4", active ? "text-[#ff7a00]" : "")} />
      {label}
    </button>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 12 12 17 22 12"/>
      <polyline points="2 17 12 22 22 17"/>
    </svg>
  );
}
