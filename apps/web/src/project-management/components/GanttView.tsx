import React, { useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isWeekend,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Rows3,
} from 'lucide-react';
import type { Issue, IssueStatus } from '../types';

interface GanttViewProps {
  issues: Issue[];
}

type Scale = 'weeks' | 'months';

const ROW_HEIGHT = 58;

const STATUS_STYLE: Record<
  IssueStatus,
  { color: string; soft: string; progress: number; label: string }
> = {
  PENDENTE: { color: '#94a3b8', soft: '#334155', progress: 8, label: 'Pendente' },
  PLANEJAMENTO: { color: '#18c8df', soft: '#1e3a5f', progress: 18, label: 'Planejamento' },
  'EM PROGRESSO': { color: '#ff7a00', soft: '#164e63', progress: 58, label: 'Em andamento' },
  'EM RISCO': { color: '#f59e0b', soft: '#78350f', progress: 42, label: 'Em risco' },
  'ATUALIZAÇÃO NECESSÁRIA': {
    color: '#facc15',
    soft: '#713f12',
    progress: 34,
    label: 'Atualização necessária',
  },
  'EM ESPERA': { color: '#a78bfa', soft: '#4c1d95', progress: 28, label: 'Em espera' },
  CONCLUÍDO: { color: '#22c55e', soft: '#115e59', progress: 100, label: 'Concluído' },
  CANCELADO: { color: '#f87171', soft: '#7f1d1d', progress: 100, label: 'Cancelado' },
};

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = parseISO(value.slice(0, 10));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function initials(assignee?: Issue['assignee']) {
  if (!assignee) return '?';
  return assignee.initials || assignee.name.slice(0, 2).toUpperCase();
}

export const GanttView: React.FC<GanttViewProps> = ({ issues }) => {
  const [scale, setScale] = useState<Scale>('weeks');
  const today = useMemo(() => new Date(), []);

  const timeline = useMemo(() => {
    const validStarts = issues.map((issue) => parseDate(issue.startDate)).filter(Boolean) as Date[];
    const validEnds = issues.map((issue) => parseDate(issue.dueDate)).filter(Boolean) as Date[];
    const fallbackStart = addDays(today, -14);
    const fallbackEnd = addDays(today, 42);
    const rawStart = validStarts.length
      ? new Date(Math.min(...validStarts.map((date) => date.getTime())))
      : fallbackStart;
    const rawEnd = validEnds.length
      ? new Date(Math.max(...validEnds.map((date) => date.getTime())))
      : fallbackEnd;
    const start = startOfWeek(addDays(rawStart, -7), { weekStartsOn: 1 });
    const end = endOfWeek(addDays(rawEnd, 14), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    const months = days.reduce<Array<{ label: string; count: number }>>((groups, day) => {
      const label = format(day, 'MMMM yyyy', { locale: ptBR });
      const last = groups[groups.length - 1];
      if (last?.label === label) last.count += 1;
      else groups.push({ label, count: 1 });
      return groups;
    }, []);

    return { start, end, days, months };
  }, [issues, today]);

  const cellWidth = scale === 'weeks' ? 34 : 20;
  const timelineWidth = timeline.days.length * cellWidth;
  const completed = issues.filter((issue) => issue.status === 'CONCLUÍDO').length;
  const atRisk = issues.filter((issue) => issue.status === 'EM RISCO').length;
  const averageProgress = issues.length
    ? Math.round(
        issues.reduce((total, issue) => total + STATUS_STYLE[issue.status].progress, 0) /
          issues.length,
      )
    : 0;
  const todayOffset = differenceInCalendarDays(today, timeline.start) * cellWidth;
  const todayIsVisible = today >= timeline.start && today <= timeline.end;

  return (
    <div className="h-full overflow-auto bg-[#070b16] p-5 text-[#e6eefb]">
      <div className="mx-auto min-w-[980px] max-w-[1800px] overflow-hidden rounded-lg border border-[#263345] bg-[#070b16] shadow-2xl shadow-black/20">
        <header className="flex items-center justify-between gap-5 border-b border-[#263345] bg-[#111827] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays size={19} className="text-[#ff7a00]" />
              <h2 className="text-base font-semibold text-white">Cronograma do projeto</h2>
            </div>
            <p className="mt-1 text-xs text-[#94a8c8]">
              {format(timeline.start, "dd 'de' MMM", { locale: ptBR })} a{' '}
              {format(timeline.end, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-3 text-[11px] text-[#94a8c8] xl:flex">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-[#18c8df]" /> Planejado
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-[#ff7a00]" /> Em andamento
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-[#22c55e]" /> Concluído
              </span>
            </div>
            <div className="flex rounded-md border border-[#374151] bg-[#0b1729] p-1">
              {(['weeks', 'months'] as Scale[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setScale(option)}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    scale === option
                      ? 'bg-[#ff7a00] text-[#07111f]'
                      : 'text-[#94a8c8] hover:text-white'
                  }`}
                >
                  {option === 'weeks' ? 'Semanas' : 'Meses'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-4 border-b border-[#263345] bg-[#0b1729]">
          <div className="flex items-center gap-3 border-r border-[#263345] px-5 py-3">
            <Rows3 size={17} className="text-[#ff7a00]" />
            <div>
              <p className="text-lg font-semibold text-white">{issues.length}</p>
              <p className="text-[11px] text-[#94a8c8]">Fases no cronograma</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-r border-[#263345] px-5 py-3">
            <CheckCircle2 size={17} className="text-[#22c55e]" />
            <div>
              <p className="text-lg font-semibold text-white">{completed}</p>
              <p className="text-[11px] text-[#94a8c8]">Fases concluídas</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-r border-[#263345] px-5 py-3">
            <AlertTriangle size={17} className="text-[#f59e0b]" />
            <div>
              <p className="text-lg font-semibold text-white">{atRisk}</p>
              <p className="text-[11px] text-[#94a8c8]">Fases em risco</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-3">
            <Clock3 size={17} className="text-[#a78bfa]" />
            <div>
              <p className="text-lg font-semibold text-white">{averageProgress}%</p>
              <p className="text-[11px] text-[#94a8c8]">Progresso estimado</p>
            </div>
          </div>
        </section>

        <div className="flex min-h-[460px]">
          <div className="w-[430px] shrink-0 border-r border-[#263345] bg-[#0b1729]">
            <div className="grid h-[70px] grid-cols-[1fr_112px_62px] items-end border-b border-[#263345] px-4 pb-3 text-[10px] font-semibold uppercase text-[#6f87aa]">
              <span>Fase</span>
              <span>Responsável</span>
              <span className="text-right">Duração</span>
            </div>
            {issues.map((issue) => {
              const start = parseDate(issue.startDate);
              const end = parseDate(issue.dueDate);
              const duration = start && end ? Math.max(differenceInCalendarDays(end, start) + 1, 1) : 0;
              const style = STATUS_STYLE[issue.status];

              return (
                <div
                  key={issue.id}
                  className="grid grid-cols-[1fr_112px_62px] items-center border-b border-[#1f3b5c] px-4 hover:bg-[#0d1423]"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: style.color }} />
                      <p className="truncate text-sm font-medium text-[#e6eefb]">{issue.title}</p>
                    </div>
                    <p className="mt-1 truncate pl-4 text-[10px] text-[#6f87aa]">
                      {issue.key} · {style.label}
                    </p>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                      style={{ borderColor: style.color, color: style.color, backgroundColor: style.soft }}
                    >
                      {initials(issue.assignee)}
                    </span>
                    <span className="truncate text-[11px] text-[#94a8c8]">
                      {issue.assignee?.name || 'Sem responsável'}
                    </span>
                  </div>
                  <span className="text-right text-xs font-medium text-[#94a8c8]">
                    {duration ? `${duration}d` : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto bg-[#070b16]">
            <div className="relative" style={{ width: timelineWidth }}>
              <div className="sticky top-0 z-20 h-[70px] border-b border-[#263345] bg-[#111827]">
                <div className="flex h-8 border-b border-[#263345]">
                  {timeline.months.map((month) => (
                    <div
                      key={month.label}
                      className="border-r border-[#263345] px-3 pt-2 text-[10px] font-semibold capitalize text-[#94a8c8]"
                      style={{ width: month.count * cellWidth }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>
                <div className="flex h-[38px]">
                  {timeline.days.map((day, index) => {
                    const showLabel = scale === 'weeks' || index % 2 === 0;
                    return (
                      <div
                        key={day.toISOString()}
                        className={`flex shrink-0 flex-col items-center justify-center border-r border-[#1f3b5c] text-[9px] ${
                          isWeekend(day) ? 'bg-[#0d1423] text-[#6f87aa]' : 'text-[#94a8c8]'
                        }`}
                        style={{ width: cellWidth }}
                      >
                        {showLabel && (
                          <>
                            <span className="uppercase">{format(day, 'EEEEE', { locale: ptBR })}</span>
                            <strong className={isSameDay(day, today) ? 'text-[#ff7a00]' : 'text-[#e6eefb]'}>
                              {format(day, 'dd')}
                            </strong>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-0 z-0 flex">
                  {timeline.days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`shrink-0 border-r border-[#0d1423] ${isWeekend(day) ? 'bg-[#0b1729]' : ''}`}
                      style={{ width: cellWidth }}
                    />
                  ))}
                </div>

                {todayIsVisible && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-[#ff7a00]"
                    style={{ left: todayOffset + cellWidth / 2 }}
                  >
                    <span className="absolute -top-1 -translate-x-1/2 rounded bg-[#ff7a00] px-1.5 py-0.5 text-[9px] font-semibold text-[#07111f]">
                      Hoje
                    </span>
                  </div>
                )}

                {issues.map((issue) => {
                  const start = parseDate(issue.startDate) || timeline.start;
                  const end = parseDate(issue.dueDate) || start;
                  const left = Math.max(differenceInCalendarDays(start, timeline.start) * cellWidth, 0);
                  const width = Math.max((differenceInCalendarDays(end, start) + 1) * cellWidth, cellWidth);
                  const style = STATUS_STYLE[issue.status];

                  return (
                    <div
                      key={issue.id}
                      className="relative z-[1] flex items-center border-b border-[#1f3b5c] px-1.5"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div
                        className="group relative h-8 overflow-hidden rounded-md border shadow-lg shadow-black/20"
                        style={{ left, width, minWidth: 48, borderColor: style.color, backgroundColor: style.soft }}
                        title={`${issue.title} · ${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 opacity-90"
                          style={{ width: `${style.progress}%`, backgroundColor: style.color }}
                        />
                        <div className="relative flex h-full items-center justify-between gap-2 px-2.5">
                          <span className="truncate text-[11px] font-semibold text-white">{issue.title}</span>
                          <span className="shrink-0 text-[10px] font-semibold text-white/90">{style.progress}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttView;
