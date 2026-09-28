import React, { useState, useRef, useEffect } from 'react';
import { Issue, Column, IssueStatus } from '../types';
import { mockColumns } from '../data';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Flag, Paperclip, Calendar, MoreHorizontal, Plus, GripVertical, User as UserIcon, CheckSquare, MessageSquare, CircleDashed, Circle, CheckCircle2 } from 'lucide-react';
import CreateTaskModal from './CreateTaskModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to generate a consistent fake ID based on the string ID
const getTaskId = (id: string, key?: string) => {
  if (key) return key;
  const num = id.replace(/[^0-9]/g, '') || (id.length * 11).toString();
  return `PRJ-${String(num).padStart(3, '0')}`;
};

// ...rest...

// Helper for fake tags
const getTags = (id: string) => {
  const isBug = id.includes('1') || id.includes('3');
  const isDesign = id.includes('2');

  if (isBug) return [{ label: 'Feature', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' }];
  if (isDesign) return [{ label: 'Design', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' }];
  return [{ label: 'Melhoria', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' }];
};

// Helper for fake checklist
const getChecklist = (id: string) => {
  const total = (id.length % 4) + 2;
  const done = id.length % (total + 1);
  return { done, total };
};

// Helper for fake comments
const getCommentsCount = (id: string) => {
  return (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % 5;
};

// Helper for colored titles
const getTitleColor = (id: string) => {
  const colors = [
    'text-blue-300',
    'text-emerald-300',
    'text-purple-300',
    'text-rose-300',
    'text-amber-300',
    'text-cyan-300'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function KanbanBoard({
  issues,
  setIssues,
  onTaskClick,
  onCreateTask
}: {
  issues: Issue[],
  setIssues: React.Dispatch<React.SetStateAction<Issue[]>>,
  onTaskClick?: (issue: Issue) => void,
  onCreateTask?: (title: string, data: any) => void
}) {
  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('pm_columns_v4');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return mockColumns;
  });

  useEffect(() => {
    localStorage.setItem('pm_columns_v4', JSON.stringify(columns));
  }, [columns]);

  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<IssueStatus | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<IssueStatus | null>(null);

  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [newTaskStatus, setNewTaskStatus] = useState<IssueStatus | null>(null);

  const handleColumnTitleChange = (id: IssueStatus, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingColumnId(null);
      return;
    }
    setColumns(prev => prev.map(col => col.id === id ? { ...col, title: newTitle.toUpperCase().trim() } : col));
    setEditingColumnId(null);
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      // If saved empty, remove the task (useful for canceling new tasks)
      setIssues(prev => prev.filter(iss => iss.id !== id || (iss.title && iss.title.trim() !== '')));
      setEditingTitleId(null);
      return;
    }
    setIssues(prev => prev.map(iss => iss.id === id ? { ...iss, title: newTitle.trim() } : iss));
    setEditingTitleId(null);
  };

  const handleAddTask = (status: IssueStatus) => {
    setNewTaskStatus(status);
    setIsCreatingTask(true);
  };

  const handleCreateNewTask = (title: string, data: any) => {
    if (!newTaskStatus) return;

    if (onCreateTask) {
      onCreateTask(title, { ...data, status: data.status || newTaskStatus });
      setIsCreatingTask(false);
      setNewTaskStatus(null);
      return;
    }

    const newId = `i-${Date.now()}`;
    const newTask: Issue = {
      id: newId,
      key: `TSK-${Math.floor(Math.random() * 1000) + 100}`,
      title: title.trim(),
      description: data.description || '',
      status: data.status || newTaskStatus,
      priority: data.priority || 'Normal',
      assignee: data.assignee,
      dueDate: data.dueDate,
      customFields: data.customFields || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIssues(prev => [newTask, ...prev]);
    setIsCreatingTask(false);
    setNewTaskStatus(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (editingTitleId) {
      e.preventDefault();
      return;
    }
    setDraggedIssueId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Fallback for some browsers
    e.dataTransfer.setData('text/plain', id);

    // Defer styling to not interrupt the drag event immediately
    requestAnimationFrame(() => {
      const el = document.getElementById(`issue-${id}`);
      if (el) {
        el.style.opacity = '0.4';
        el.style.transform = 'scale(0.98)';
      }
    });
  };

  const handleDragEnd = (e: React.DragEvent, id: string) => {
    setDraggedIssueId(null);
    setDragOverCol(null);
    const el = document.getElementById(`issue-${id}`);
    if (el) {
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    }
  };

  const handleDragOver = (e: React.DragEvent, colId: IssueStatus) => {
    e.preventDefault(); // MANDATORY for drop to work
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDrop = (e: React.DragEvent, status: IssueStatus) => {
    e.preventDefault();
    const id = draggedIssueId || e.dataTransfer.getData('text/plain');
    setDragOverCol(null);

    if (!id) return;

    setIssues(prev => prev.map(issue =>
      issue.id === id ? { ...issue, status, updatedAt: new Date().toISOString() } : issue
    ));
    setDraggedIssueId(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#070b16] overflow-hidden text-slate-300 font-sans">
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar">
        <div className="flex gap-5 items-start h-full pb-4">
          {columns.map(column => {
            const columnIssues = issues.filter(i => i.status === column.id);
            const isDragActive = dragOverCol === column.id;

            return (
              <div
                key={column.id}
                className="w-[320px] flex-shrink-0 flex flex-col h-full"
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 px-2 group">
                  <div className="flex items-center gap-2.5">
                    {editingColumnId === column.id ? (
                      <input
                        autoFocus
                        defaultValue={column.title}
                        onBlur={(e) => handleColumnTitleChange(column.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleColumnTitleChange(column.id, e.currentTarget.value);
                          if (e.key === 'Escape') setEditingColumnId(null);
                        }}
                        className={cn("w-32 bg-[#111827] text-[10px] font-bold tracking-wider rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-[#ff7a00]", column.colorClass.split('bg-')[0])}
                      />
                    ) : (
                      <span
                        onDoubleClick={() => setEditingColumnId(column.id)}
                        className={cn("px-2.5 py-1 rounded flex items-center text-[10px] font-bold tracking-wider cursor-text w-fit border border-transparent shadow-sm", column.colorClass)}
                      >
                        {column.iconType === 'dashed' && <CircleDashed className="w-3 h-3 mr-1.5 opacity-90" />}
                        {column.iconType === 'circle' && <Circle className="w-3 h-3 mr-1.5 opacity-90" />}
                        {column.iconType === 'check' && <CheckCircle2 className="w-3 h-3 mr-1.5 opacity-90" />}
                        {column.title}
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-500">
                      {columnIssues.length}
                    </span>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 gap-1">
                    <button onClick={() => handleAddTask(column.id)} className="p-1 hover:bg-[#0d1423] hover:text-slate-300 rounded transition-colors"><Plus className="w-4 h-4" /></button>
                    <button onClick={() => setEditingColumnId(column.id)} className="p-1 hover:bg-[#0d1423] hover:text-slate-300 rounded transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Column Cards Container */}
                <div className={cn(
                  "flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 px-1 pb-4 transition-colors duration-200",
                  isDragActive && "bg-[#1f2125]/80 rounded-md ring-2 ring-[#ff7a00]/30"
                )}>
                  {columnIssues.map(issue => {
                    const checklist = getChecklist(issue.id);
                    const tags = getTags(issue.id);
                    const commentsCount = getCommentsCount(issue.id);

                    return (
                      <div
                        id={`issue-${issue.id}`}
                        key={issue.id}
                        draggable={editingTitleId !== issue.id} // Disable drag when editing
                        onDragStart={(e) => handleDragStart(e, issue.id)}
                        onDragEnd={(e) => handleDragEnd(e, issue.id)}
                        onClick={() => {
                          // Only trigger modal if we are not editing
                          if (editingTitleId !== issue.id) {
                            onTaskClick?.(issue);
                          }
                        }}
                        className="group/card relative bg-[#111827] hover:bg-[#111827] rounded-md border border-[#263345] hover:border-[#374151] shadow-sm hover:shadow-lg cursor-grab active:cursor-grabbing transition-all duration-200 overflow-hidden flex flex-col"
                      >
                        {/* Priority Top Border Highlight */}
                        <div className={cn(
                          "absolute top-0 left-0 right-0 h-[2px]",
                          issue.priority === 'Alta' ? 'bg-yellow-500' : 'bg-[#1f2937]'
                        )} />

                        {/* Drag Handle & ID */}
                        <div className="px-4 pt-3 flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-slate-500 tracking-wider">
                            {getTaskId(issue.id, issue.key)}
                          </span>
                          <button className="opacity-0 group-hover/card:opacity-100 text-slate-600 hover:text-slate-400 transition-opacity cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Content */}
                        <div className="px-4 flex-1">
                          {/* Tags */}
                          <div className="flex flex-wrap gap-1.5 mb-2.5">
                            {tags.map((tag, idx) => (
                              <span key={idx} className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", tag.color)}>
                                {tag.label}
                              </span>
                            ))}
                          </div>

                          {/* Title - Smart Input Editable */}
                          <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                            {editingTitleId === issue.id ? (
                              <input
                                autoFocus
                                defaultValue={issue.title}
                                onBlur={(e) => handleTitleChange(issue.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleTitleChange(issue.id, e.currentTarget.value);
                                  if (e.key === 'Escape') {
                                    handleTitleChange(issue.id, issue.title);
                                  }
                                }}
                                className="w-full bg-[#111827] border border-[#ff7a00] text-[13px] font-medium text-white rounded px-2 py-1 outline-none shadow-sm"
                                placeholder="Digite o título da tarefa..."
                              />
                            ) : (
                              <div
                                onClick={() => setEditingTitleId(issue.id)}
                                className={cn(
                                  "text-[13px] font-medium leading-relaxed px-1 -mx-1 cursor-text hover:bg-[#111827] rounded transition-colors break-words",
                                  getTitleColor(issue.id)
                                )}
                              >
                                {issue.title}
                              </div>
                            )}
                          </div>

                          {/* Custom Fields */}
                          {issue.customFields && issue.customFields.length > 0 && (
                            <div className="flex flex-col gap-1.5 mb-3">
                              {issue.customFields.map((cf) => (
                                <div key={cf.id} className="flex items-center justify-between bg-[#111827] rounded px-2 py-1 text-[10px]">
                                  <span className="text-slate-500 font-medium truncate max-w-[45%]">{cf.name}:</span>
                                  <span className="text-slate-300 truncate max-w-[50%]">{cf.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                        </div>
                        {/* Footer (Stats & Avatars) */}
                        <div className="px-4 py-3 bg-[#111827]/50 border-t border-[#263345] flex items-center justify-between mt-auto">

                          {/* Badges/Stats */}
                          <div className="flex items-center gap-3">
                            <div className={cn("flex items-center gap-1 text-[11px]", checklist.done === checklist.total ? "text-emerald-500" : "text-slate-500")}>
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span className="font-medium">{checklist.done}/{checklist.total}</span>
                            </div>

                            {commentsCount > 0 && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="font-medium">{commentsCount}</span>
                              </div>
                            )}

                            {issue.dueDate && (
                              <div className={cn(
                                "flex items-center gap-1 text-[11px] font-medium",
                                issue.status === 'EM RISCO' ? "text-red-400" : "text-slate-500"
                              )}>
                                <Calendar className="w-3 h-3" />
                                {issue.dueDate.substring(5).replace('-', '/')}
                              </div>
                            )}
                          </div>

                          {/* Assignee Avatar */}
                          <div>
                            {issue.assignee ? (
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-[#111827]",
                                issue.assignee.color
                              )}>
                                {issue.assignee.initials}
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#0d1423] ring-2 ring-[#111827] text-slate-500 border border-dashed border-slate-600">
                                <UserIcon className="w-3 h-3" />
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}

                  {/* Drop zone placeholder if empty */}
                  {columnIssues.length === 0 && isDragActive && (
                    <div className="h-24 border-2 border-dashed border-[#ff7a00]/30 rounded-md bg-[#ff7a00]/5"></div>
                  )}

                  {/* Add task button at the bottom of the column */}
                  <button onClick={() => handleAddTask(column.id)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 hover:bg-[#111827] px-3 py-2 rounded-lg w-full text-left transition-colors border border-transparent hover:border-[#263345] mt-1 group">
                    <Plus className="w-4 h-4 opacity-70" />
                    <span>Adicionar Fase</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isCreatingTask && (
        <CreateTaskModal
          defaultStatus={newTaskStatus || 'PENDENTE'}
          onClose={() => {
            setIsCreatingTask(false);
            setNewTaskStatus(null);
          }}
          onCreate={handleCreateNewTask}
        />
      )}
    </div>
  );
}
