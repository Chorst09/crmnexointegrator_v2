import React, { useState } from 'react';
import { User, CheckCircle2, Users, MessageSquare, Bell, X, ChevronDown } from 'lucide-react';

type RACIRole = 'responsible' | 'accountable' | 'consulted' | 'informed';

interface RACIData {
  responsibleIds: string[];
  accountableId: string | null;
  consultedIds: string[];
  informedIds: string[];
}

interface RACIMatrixProps {
  users: Array<{ id: string; name: string; email?: string; color?: string; initials?: string }>;
  value: RACIData;
  onChange: (data: RACIData) => void;
  readonly?: boolean;
}

const roleConfig = {
  responsible: {
    label: 'Responsável',
    shortLabel: 'R',
    description: 'Quem executa o trabalho',
    icon: CheckCircle2,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    multiple: true
  },
  accountable: {
    label: 'Aprovador',
    shortLabel: 'A',
    description: 'Quem aprova e tem autoridade final (apenas 1 pessoa)',
    icon: User,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    multiple: false
  },
  consulted: {
    label: 'Consultado',
    shortLabel: 'C',
    description: 'Quem deve ser consultado antes de decisões',
    icon: MessageSquare,
    color: 'text-green-400 bg-green-500/10 border-green-500/30',
    multiple: true
  },
  informed: {
    label: 'Informado',
    shortLabel: 'I',
    description: 'Quem deve ser mantido informado do progresso',
    icon: Bell,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    multiple: true
  }
};

export default function RACIMatrix({ users, value, onChange, readonly = false }: RACIMatrixProps) {
  const [expandedRole, setExpandedRole] = useState<RACIRole | null>(null);

  const toggleUser = (role: RACIRole, userId: string) => {
    if (readonly) return;

    const newValue = { ...value };

    if (role === 'accountable') {
      newValue.accountableId = newValue.accountableId === userId ? null : userId;
    } else if (role === 'responsible') {
      const ids = new Set(newValue.responsibleIds);
      if (ids.has(userId)) ids.delete(userId);
      else ids.add(userId);
      newValue.responsibleIds = Array.from(ids);
    } else if (role === 'consulted') {
      const ids = new Set(newValue.consultedIds);
      if (ids.has(userId)) ids.delete(userId);
      else ids.add(userId);
      newValue.consultedIds = Array.from(ids);
    } else if (role === 'informed') {
      const ids = new Set(newValue.informedIds);
      if (ids.has(userId)) ids.delete(userId);
      else ids.add(userId);
      newValue.informedIds = Array.from(ids);
    }

    onChange(newValue);
  };

  const isUserSelected = (role: RACIRole, userId: string): boolean => {
    if (role === 'accountable') return value.accountableId === userId;
    if (role === 'responsible') return value.responsibleIds.includes(userId);
    if (role === 'consulted') return value.consultedIds.includes(userId);
    if (role === 'informed') return value.informedIds.includes(userId);
    return false;
  };

  const getSelectedUsers = (role: RACIRole) => {
    if (role === 'accountable') {
      return value.accountableId ? users.filter(u => u.id === value.accountableId) : [];
    }
    if (role === 'responsible') {
      return users.filter(u => value.responsibleIds.includes(u.id));
    }
    if (role === 'consulted') {
      return users.filter(u => value.consultedIds.includes(u.id));
    }
    if (role === 'informed') {
      return users.filter(u => value.informedIds.includes(u.id));
    }
    return [];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-bold text-slate-100">Matriz RACI</h4>
          <p className="text-xs text-slate-500 mt-0.5">Defina responsabilidades e comunicação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.keys(roleConfig) as RACIRole[]).map(role => {
          const config = roleConfig[role];
          const Icon = config.icon;
          const selectedUsers = getSelectedUsers(role);
          const isExpanded = expandedRole === role;

          return (
            <div key={role} className={`rounded-lg border ${config.color} p-3`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-100">{config.label}</p>
                    <p className="text-[10px] text-slate-500">{config.description}</p>
                  </div>
                </div>
                {!readonly && (
                  <button
                    type="button"
                    onClick={() => setExpandedRole(isExpanded ? null : role)}
                    className="rounded p-1 text-slate-400 hover:bg-[#070b16] hover:text-slate-200"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Selected Users Display */}
              {selectedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-1.5 rounded-md bg-[#070b16] border border-[#263345] px-2 py-1"
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ${user.color || 'bg-slate-600'}`}>
                        {user.initials || user.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-300">{user.name}</span>
                      {!readonly && (
                        <button
                          type="button"
                          onClick={() => toggleUser(role, user.id)}
                          className="ml-1 text-slate-500 hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic mt-2">Nenhum usuário atribuído</p>
              )}

              {/* User Selection Dropdown */}
              {isExpanded && !readonly && (
                <div className="mt-3 max-h-40 overflow-y-auto rounded-md border border-[#263345] bg-[#070b16]">
                  {users.map(user => {
                    const isSelected = isUserSelected(role, user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(role, user.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#111827] ${
                          isSelected ? 'bg-[#111827]' : ''
                        }`}
                      >
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${user.color || 'bg-slate-600'}`}>
                          {user.initials || user.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{user.name}</p>
                          {user.email && <p className="text-[10px] text-slate-500 truncate">{user.email}</p>}
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readonly && (
        <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 mt-3">
          <p className="text-xs text-blue-300">
            <strong>Dica:</strong> Use RACI para evitar confusão de responsabilidades. 
            <span className="text-blue-400"> Accountable (A)</span> deve ser apenas 1 pessoa com autoridade final.
          </p>
        </div>
      )}
    </div>
  );
}
