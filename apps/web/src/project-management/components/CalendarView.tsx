import React from 'react';
import { Issue } from '../types';

export default function CalendarView({ issues, onTaskClick }: { issues: Issue[], onTaskClick?: (issue: Issue) => void }) {
  // Hardcoded for September 2023 to match mock data
  const daysInMonth = 30;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const startDayOfWeek = 5; // Sept 1 2023 was a Friday (0=Sun, 1=Mon, ..., 5=Fri)

  const paddedDays = Array.from({ length: startDayOfWeek }, () => null);
  const allCells = [...paddedDays, ...days];

  return (
    <div className="h-full bg-[#070b16] overflow-auto p-6 text-slate-300 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Setembro 2023</h2>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[#0d1423] border border-[#263345] rounded-lg overflow-hidden flex-1 min-h-[600px]">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="bg-[#111827] py-2 text-center text-xs font-semibold text-slate-400">
            {day}
          </div>
        ))}

        {allCells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="bg-[#111827] p-2 min-h-[100px] opacity-50"></div>;
          }

          // Format day to match mock data like "2023-09-04"
          const dateStr = `2023-09-${day.toString().padStart(2, '0')}`;
          const dayIssues = issues.filter(i => i.dueDate === dateStr || i.startDate === dateStr);

          return (
            <div key={day} className="bg-[#111827] p-2 min-h-[100px] hover:bg-[#111827] transition-colors border-t border-[#263345]">
              <span className="text-xs font-medium text-slate-500 mb-1 inline-block">{day}</span>
              <div className="flex flex-col gap-1">
                {dayIssues.map(issue => {
                  const isStart = issue.startDate === dateStr;
                  const isDue = issue.dueDate === dateStr;

                  return (
                    <div
                      key={issue.id}
                      onClick={() => onTaskClick?.(issue)}
                      className={`text-[10px] px-1.5 py-1 rounded truncate cursor-pointer ${
                        isDue ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#ff7a00]/20 text-[#ff7a00] border border-[#ff7a00]/30'
                      }`}
                      title={issue.title}
                    >
                      {isDue ? 'Fim: ' : 'Início: '} {issue.title.substring(0, 20)}...
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
