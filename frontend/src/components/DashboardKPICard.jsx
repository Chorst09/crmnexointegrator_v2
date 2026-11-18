import React from 'react';

/**
 * Dashboard KPI Card – visual replacement for the old AnimatedStats component.
 * Uses the project's glassmorphism CSS class `glass-card` and accepts the same
 * props that AnimatedStats used, plus an optional `trend` prop.
 */
export default function DashboardKPICard({
  title = '',
  value = 0,
  subtitle = '',
  icon: Icon,
  color = 'blue',
  trend,
  format = 'default' // 'currency' | 'default'
}) {
  const formattedValue = (() => {
    if (typeof value === 'number') {
      if (format === 'currency') {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
      }
      return new Intl.NumberFormat('pt-BR').format(value);
    }
    return value;
  })();
  return (
    <div className="glass-card p-4 shadow-lg flex flex-col justify-between h-full">
      <div className="flex items-center mb-2">
        {Icon && <Icon className={`w-6 h-6 text-${color}-500 mr-2`} />}
        <h3 className="text-sm font-medium text-white">{title}</h3>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{formattedValue}</div>
      {subtitle && <p className="text-xs text-gray-300">{subtitle}</p>}
      {trend && (
        <p className={`text-sm mt-2 ${trend.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          ↗ {trend.value}
        </p>
      )}
    </div>
  );
}
