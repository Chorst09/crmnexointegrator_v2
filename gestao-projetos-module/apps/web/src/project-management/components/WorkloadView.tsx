import React from 'react';
import { Issue } from '../types';
import { mockUsers } from '../data';

export default function WorkloadView({ issues }: { issues: Issue[] }) {
  // Calculate workload per user (count of tasks)
  const userWorkload = mockUsers.map(user => {
    const userIssues = issues.filter(i => i.assignee?.id === user.id);
    const capacity = 5; // Fake capacity limit
    return {
      ...user,
      taskCount: userIssues.length,
      capacity
    };
  });

  return (
    <div className="h-full bg-[#070b16] overflow-y-auto p-6 text-slate-300">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-slate-100 mb-6">Carga de Trabalho da Equipe (WIP)</h2>

        <div className="grid gap-4">
          {userWorkload.map(user => {
            const usagePercent = Math.min(100, (user.taskCount / user.capacity) * 100);
            const isOverloaded = user.taskCount > user.capacity;

            return (
              <div key={user.id} className="bg-[#111827] border border-[#263345] rounded-lg p-5 flex items-center gap-6">
                <div className="flex items-center gap-3 w-48 shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${user.color}`}>
                    {user.initials}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">{user.name}</h3>
                    <p className="text-xs text-slate-500">{user.taskCount} fases ativas</p>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400">Capacidade</span>
                    <span className={isOverloaded ? "text-red-400 font-bold" : "text-slate-300"}>
                      {user.taskCount} / {user.capacity}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-[#0d1423] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOverloaded ? 'bg-red-500' : 'bg-[#ff7a00]'}`}
                      style={{ width: `${usagePercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bg-[#111827] border border-[#263345] rounded-lg p-5 flex items-center gap-6 opacity-60">
            <div className="flex items-center gap-3 w-48 shrink-0">
              <div className="w-10 h-10 rounded-full border border-dashed border-slate-500 flex items-center justify-center text-slate-500 text-xs">
                ?
              </div>
              <div>
                <h3 className="font-semibold text-slate-300">Não Atribuídas</h3>
                <p className="text-xs text-slate-500">{issues.filter(i => !i.assignee).length} fases</p>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400 italic">Atribua estas fases para balancear a carga.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
