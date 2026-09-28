import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Compass, CheckSquare, Sparkles, Users, FileText,
  BarChart2, LayoutTemplate, MoreHorizontal,
  Search, Bell, Settings, Plus, ChevronDown, CheckCircle2,
  List as ListIcon, Calendar, Activity,
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
import { HomeView, PlannedView, DocsView, WhiteboardsView } from './components/GlobalViews';
import TaskModal from './components/TaskModal';
import CreateTaskModal from './components/CreateTaskModal';
import { mockIssues } from './data';
import { Space, Issue } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ViewMode = 'board' | 'list' | 'dashboard' | 'team' | 'calendar' | 'gantt' | 'activity' | 'workload';

const emptyProjectForm = {
  name: '',
  client: '',
  sponsor: '',
  manager: '',
  status: 'PLANEJAMENTO' as const,
  priority: 'Normal' as const,
  startDate: '',
  endDate: '',
  budget: '',
  objective: '',
  scope: '',
  deliverables: '',
  successCriteria: '',
  risks: '',
  notes: ''
};

type ProjectForm = typeof emptyProjectForm;

export default function App({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewMode>('board');
  const [globalView, setGlobalView] = useState('spaces');

  // Try to load issues from localStorage, fallback to mockIssues
  const [issues, setIssues] = useState<Issue[]>(() => {
    const saved = localStorage.getItem('pm_issues_v4');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return mockIssues;
  });

  // Save issues to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('pm_issues_v4', JSON.stringify(issues));
  }, [issues]);

  const [spaces, setSpaces] = useState<Space[]>(() => {
    const saved = localStorage.getItem('pm_projects_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [{
      id: 's1',
      name: 'Projeto Paranacidade',
      initial: 'P',
      color: 'bg-[#ff7a00]',
      client: 'Paranacidade',
      manager: 'Carlos Horst',
      status: 'PLANEJAMENTO',
      priority: 'Alta',
      objective: 'Implantar e acompanhar as etapas do projeto com controle executivo.',
      scope: 'Escopo inicial do projeto com fases de acesso, kick-off, plano de implantação e migração.',
      deliverables: 'Plano de implantação, cronograma, atas, evidências e acompanhamento por fases.',
      createdAt: new Date().toISOString()
    }];
  });
  const [activeSpaceId, setActiveSpaceId] = useState<string>('s1');
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({ 's1': true });

  // New States
  const [selectedTask, setSelectedTask] = useState<Issue | null>(null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projectFormError, setProjectFormError] = useState('');

  useEffect(() => {
    localStorage.setItem('pm_projects_v1', JSON.stringify(spaces));
  }, [spaces]);

  const activeProject = spaces.find(s => s.id === activeSpaceId) || spaces[0];
  const activeProjectIssues = issues.filter(issue => {
    if (!activeProject) return false;
    if (issue.projectId === activeProject.id) return true;
    return !issue.projectId && activeProject.id === spaces[0]?.id;
  });
  const isDashboardFocus = (globalView === 'spaces' && activeView === 'dashboard') || globalView === 'dashboards';

  const submitNewSpace = () => {
    const name = projectForm.name.trim();
    const scope = projectForm.scope.trim();
    const objective = projectForm.objective.trim();

    if (!name || !scope || !objective) {
      setProjectFormError('Informe nome, objetivo e escopo do projeto antes de criar as fases.');
      return;
    }

    if (isCreatingSpace) {
      const colors = ['bg-[#ff7a00]', 'bg-[#18c8df]', 'bg-[#22c55e]', 'bg-[#f6b40b]', 'bg-[#1f7fe5]'];
      const randomColor = colors[spaces.length % colors.length];
      const newSpace: Space = {
        id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...projectForm,
        name,
        scope,
        objective,
        initial: name.charAt(0).toUpperCase(),
        color: randomColor,
        createdAt: new Date().toISOString()
      };
      setSpaces(prev => [...prev, newSpace]);
      setActiveSpaceId(newSpace.id);
      setExpandedSpaces(prev => ({ ...prev, [newSpace.id]: true }));
      setActiveView('dashboard');
    }
    setIsCreatingSpace(false);
    setProjectForm(emptyProjectForm);
    setProjectFormError('');
  };

  const toggleSpace = (id: string) => {
    setExpandedSpaces(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [isCreatingTaskGlobal, setIsCreatingTaskGlobal] = useState(false);

  // Create a new task test flow
  const handleCreateTask = () => {
    setIsCreatingTaskGlobal(true);
  };

  const handleGlobalCreateTaskSubmit = (title: string, data: any) => {
    const normalizedTitle = title.trim();
    const newTask: Issue = {
      id: `new-${Date.now()}`,
      key: `TSK-${Math.floor(Math.random() * 1000) + 100}`,
      title: normalizedTitle,
      description: data.description || '',
      status: data.status || 'PENDENTE',
      projectId: activeSpaceId,
      priority: data.priority || 'Normal',
      assignee: data.assignee,
      dueDate: data.dueDate,
      customFields: data.customFields || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setIssues(prev => [newTask, ...prev]);
    setIsCreatingTaskGlobal(false);

    if (data.phaseKind === 'KICKOFF_INTERNO' || data.phaseKind === 'KICKOFF_EXTERNO') {
      const kickoffContext = {
        source: 'project-management',
        projectId: activeProject?.id,
        projectName: activeProject?.name,
        projectClient: activeProject?.client,
        projectManager: activeProject?.manager,
        projectScope: activeProject?.scope,
        projectObjective: activeProject?.objective,
        phaseId: newTask.id,
        phaseTitle: normalizedTitle,
        phaseDescription: data.description || '',
        kickoffType: data.phaseKind === 'KICKOFF_INTERNO' ? 'internal' : 'external',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('pm_kickoff_context', JSON.stringify(kickoffContext));
      navigate(`/kickoff?from=project&openCreate=1&type=${kickoffContext.kickoffType}`);
    }
  };

  const handleUpdateIssue = (updatedIssue: Issue) => {
    setIssues(prev => prev.map(issue => issue.id === updatedIssue.id ? updatedIssue : issue));
    setSelectedTask(updatedIssue);
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
          <div className="flex items-center gap-2 text-slate-400 hover:bg-[#1f2937] p-1.5 rounded cursor-pointer mb-4">
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
                  <div className="flex items-center gap-2">
                    <div className={cn("w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-bold text-white", space.color)}>{space.initial}</div>
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-sm">{space.name}</span>
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
                      <span className="text-xs text-slate-500">{activeSpaceId === space.id ? issues.length : 0}</span>
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
              <div className="flex items-center gap-2 text-xl font-bold text-slate-200">
                <div className={cn("w-5 h-5 rounded-sm text-[10px] flex items-center justify-center font-bold text-white mr-1", activeProject?.color || "bg-slate-700")}>
                  {activeProject?.initial || "P"}
                </div>
                {activeProject?.name || "Projeto Paranacidade"} <span className="text-slate-500 font-normal">/</span>
                <ListIcon className="w-5 h-5 text-slate-400 ml-1" /> Fases
                <ChevronDown className="w-5 h-5 text-slate-500 cursor-pointer" />
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                <button onClick={() => alert('Funcionalidade de Agentes será lançada em breve')} className="hover:text-slate-200 flex items-center gap-1"><Users2 className="w-4 h-4" /> Agentes</button>
                <button onClick={() => alert('ClickUp Brain em processamento...')} className="hover:text-slate-200 flex items-center gap-1"><Sparkles className="w-4 h-4 text-teal-400" /> Brain</button>
                <button onClick={() => alert('Compartilhar este projeto com outras pessoas')} className="hover:text-slate-200 flex items-center gap-1"><Users className="w-4 h-4" /> Compartilhar</button>
              </div>
            </div>

            <div className="flex items-center gap-6 overflow-x-auto text-sm font-medium hide-scrollbar">
              <Tab icon={Users} label="Equipe" active={activeView === 'team'} onClick={() => setActiveView('team')} />
              <Tab icon={BarChart2} label="Painéis" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
              <Tab icon={ListIcon} label="Lista" active={activeView === 'list'} onClick={() => setActiveView('list')} />
              <Tab icon={LayoutTemplate} label="Quadro" active={activeView === 'board'} onClick={() => setActiveView('board')} />
              <Tab icon={Calendar} label="Calendário" active={activeView === 'calendar'} onClick={() => setActiveView('calendar')} />
              <Tab icon={GanttChartSquare} label="Gantt" active={activeView === 'gantt'} onClick={() => setActiveView('gantt')} />
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
                  <p className="mt-1 text-sm font-black text-[#ffb15c]">{activeProject.status || 'PLANEJAMENTO'}</p>
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
          {activeView === 'board' && <KanbanBoard issues={issues} setIssues={setIssues} onTaskClick={setSelectedTask} onCreateTask={handleGlobalCreateTaskSubmit} />}
          {activeView === 'list' && <ListView issues={issues} onTaskClick={setSelectedTask} />}
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
          {activeView === 'team' && <TeamView />}
          {activeView === 'calendar' && <CalendarView issues={issues} onTaskClick={setSelectedTask} />}
          {activeView === 'gantt' && <GanttView issues={issues} />}
          {activeView === 'activity' && <ActivityView />}
          {activeView === 'workload' && <WorkloadView issues={issues} />}
        </div>

          </>
          )
        ) : (
          <div className="flex-1 overflow-hidden relative bg-[#070b16]">
            {globalView === 'home' && (
              <HomeView
                onCreateProject={() => {
                  setIsCreatingSpace(true);
                  setGlobalView('spaces');
                }}
                onOpenDashboard={() => {
                  setGlobalView('spaces');
                  setActiveView('dashboard');
                }}
              />
            )}
            {globalView === 'planned' && <PlannedView />}
            {globalView === 'teams' && <TeamView />}
            {globalView === 'docs' && <DocsView />}
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
            {globalView === 'whiteboards' && <WhiteboardsView />}
          </div>
        )}
      </main>

      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} onUpdate={handleUpdateIssue} />
      )}

      {isCreatingTaskGlobal && (
        <CreateTaskModal
          onClose={() => setIsCreatingTaskGlobal(false)}
          onCreate={handleGlobalCreateTaskSubmit}
        />
      )}

      {isCreatingSpace && (
        <ProjectCreateModal
          form={projectForm}
          error={projectFormError}
          onChange={(patch) => {
            setProjectForm(prev => ({ ...prev, ...patch }));
            setProjectFormError('');
          }}
          onCancel={() => {
            setIsCreatingSpace(false);
            setProjectForm(emptyProjectForm);
            setProjectFormError('');
          }}
          onSubmit={submitNewSpace}
        />
      )}
    </div>
  );
}

function ProjectCreateModal({
  form,
  error,
  onChange,
  onCancel,
  onSubmit
}: {
  form: ProjectForm;
  error: string;
  onChange: (patch: Partial<ProjectForm>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const fieldClass = "w-full rounded-md border border-[#374151] bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff7a00] focus:ring-2 focus:ring-[#ff7a00]/20";
  const labelClass = "text-[11px] font-bold uppercase tracking-wide text-[#8f9caf]";

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
                  Novo projeto
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-100">Cadastro completo do projeto</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">Escopo, objetivo, responsáveis e critérios entram antes da criação das fases.</p>
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

        <div className="overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-4 py-3 text-sm font-semibold text-[#ffb15c]">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="flex flex-col gap-1.5 lg:col-span-2">
              <span className={labelClass}>Nome do projeto *</span>
              <input className={fieldClass} value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ex.: Implantação Paranacidade" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Cliente</span>
              <input className={fieldClass} value={form.client} onChange={(e) => onChange({ client: e.target.value })} placeholder="Cliente ou órgão" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Patrocinador</span>
              <input className={fieldClass} value={form.sponsor} onChange={(e) => onChange({ sponsor: e.target.value })} placeholder="Sponsor" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Gerente</span>
              <input className={fieldClass} value={form.manager} onChange={(e) => onChange({ manager: e.target.value })} placeholder="Responsável" />
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
                <option>PLANEJAMENTO</option>
                <option>EM EXECUCAO</option>
                <option>EM RISCO</option>
                <option>CONCLUIDO</option>
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

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Objetivo *</span>
              <textarea className={`${fieldClass} min-h-[110px] resize-none`} value={form.objective} onChange={(e) => onChange({ objective: e.target.value })} placeholder="Resultado esperado e impacto do projeto" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Escopo *</span>
              <textarea className={`${fieldClass} min-h-[110px] resize-none`} value={form.scope} onChange={(e) => onChange({ scope: e.target.value })} placeholder="O que entra e os limites principais do projeto" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Entregáveis</span>
              <textarea className={`${fieldClass} min-h-[90px] resize-none`} value={form.deliverables} onChange={(e) => onChange({ deliverables: e.target.value })} placeholder="Pacotes, documentos, homologações e entregas" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Critérios de sucesso</span>
              <textarea className={`${fieldClass} min-h-[90px] resize-none`} value={form.successCriteria} onChange={(e) => onChange({ successCriteria: e.target.value })} placeholder="Indicadores, aceite e metas" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Riscos</span>
              <textarea className={`${fieldClass} min-h-[90px] resize-none`} value={form.risks} onChange={(e) => onChange({ risks: e.target.value })} placeholder="Dependências, bloqueios e pontos de atenção" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Observações</span>
              <textarea className={`${fieldClass} min-h-[90px] resize-none`} value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Contexto adicional" />
            </label>
          </div>

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

        <div className="flex items-center justify-end gap-3 border-t border-[#263345] bg-[#111827] px-6 py-4">
          <button type="button" onClick={onCancel} className="rounded-md border border-[#374151] px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-[#1f2937] hover:text-white">
            Cancelar
          </button>
          <button type="button" onClick={onSubmit} className="rounded-md bg-[#ff7a00] px-5 py-2 text-sm font-black text-white shadow-[0_0_24px_rgba(255,122,0,0.2)] transition-colors hover:bg-[#f6b40b] hover:text-[#050914]">
            Criar projeto
          </button>
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
