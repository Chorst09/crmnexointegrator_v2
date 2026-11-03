import React from 'react';

const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend = null,
  onClick = null
}) => {
  const colorClasses = {
    blue: {
      badge: 'from-cyan-500/24 to-blue-500/18 text-cyan-700 dark:text-cyan-300',
      value: 'text-cyan-700 dark:text-cyan-300'
    },
    green: {
      badge: 'from-emerald-500/25 to-teal-500/20 text-emerald-700 dark:text-emerald-300',
      value: 'text-emerald-700 dark:text-emerald-300'
    },
    yellow: {
      badge: 'from-amber-500/25 to-yellow-500/20 text-amber-700 dark:text-amber-300',
      value: 'text-amber-700 dark:text-amber-300'
    },
    red: {
      badge: 'from-rose-500/25 to-red-500/20 text-rose-700 dark:text-rose-300',
      value: 'text-rose-700 dark:text-rose-300'
    },
    purple: {
      badge: 'from-blue-500/24 to-cyan-500/18 text-blue-700 dark:text-blue-300',
      value: 'text-blue-700 dark:text-blue-300'
    },
    orange: {
      badge: 'from-orange-500/25 to-amber-500/20 text-orange-700 dark:text-orange-300',
      value: 'text-orange-700 dark:text-orange-300'
    }
  };

  const classes = colorClasses[color] || colorClasses.blue;

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-gradient-to-br from-[rgb(var(--crm-surface-rgb)_/_0.95)] via-[rgb(var(--crm-surface-rgb)_/_1)] to-[rgb(var(--crm-surface-rgb)_/_0.8)] p-6 shadow-soft-xl dark:border-[var(--crm-border)] dark:from-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-2-rgb)_/_1)]",
        'transition-all duration-300',
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-soft-2xl hover:border-orange-400/45 dark:hover:border-orange-400/45' : ''
      ].join(' ')}
      onClick={onClick}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgb(var(--crm-surface-rgb)_/_0.4)] via-transparent to-orange-300/10 opacity-70 dark:from-orange-400/8 dark:to-cyan-300/10" />

      <div className="relative z-[1] flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${classes.value}`}>{value}</p>

          {subtitle && (
            <p className="mt-1 truncate text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">{subtitle}</p>
          )}

          {trend && (
            <div
              className={[
                'mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                trend.direction === 'up'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : trend.direction === 'down'
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : "bg-[rgb(var(--crm-surface-rgb)_/_0.15)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
              ].join(' ')}
            >
              <span className="mr-1">{trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'}</span>
              {trend.value}
            </div>
          )}
        </div>

        <div className={`rounded-xl border border-[var(--crm-border)] bg-gradient-to-br p-3 shadow-soft-xl dark:border-[rgb(var(--crm-ink-rgb)_/_0.1)] ${classes.badge}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
