import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const AnimatedStats = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = 'blue',
  trend = null,
  prefix = '',
  suffix = '',
  animate = true,
  onClick = null,
  size = 'default',
  valueTitle = null
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (animate && typeof value === 'number') {
      const duration = 1000;
      const steps = 30;
      const increment = value / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    } else {
      setDisplayValue(value);
    }
  }, [value, animate]);

  const colorClasses = {
    blue: {
      wash: 'from-cyan-400/24 via-blue-500/10 to-transparent',
      light: 'from-cyan-400/22 to-blue-500/8 dark:from-cyan-400/18 dark:to-blue-500/8',
      text: 'text-cyan-700 dark:text-cyan-200',
      icon: 'text-cyan-700 dark:text-cyan-200'
    },
    green: {
      wash: 'from-emerald-500/22 via-emerald-500/10 to-transparent',
      light: 'from-emerald-500/18 to-teal-500/8 dark:from-emerald-400/18 dark:to-teal-400/8',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: 'text-emerald-700 dark:text-emerald-300'
    },
    purple: {
      wash: 'from-blue-500/22 via-cyan-500/10 to-transparent',
      light: 'from-blue-500/18 to-cyan-500/8 dark:from-blue-400/18 dark:to-cyan-400/8',
      text: 'text-blue-700 dark:text-blue-200',
      icon: 'text-blue-700 dark:text-blue-200'
    },
    orange: {
      wash: 'from-orange-500/28 via-orange-500/12 to-transparent',
      light: 'from-orange-500/24 to-amber-500/8 dark:from-orange-400/22 dark:to-amber-400/8',
      text: 'text-orange-700 dark:text-orange-200',
      icon: 'text-orange-700 dark:text-orange-200'
    },
    red: {
      wash: 'from-red-500/25 via-red-500/10 to-transparent',
      light: 'from-red-500/20 to-red-500/5 dark:from-red-400/20 dark:to-red-400/5',
      text: 'text-red-700 dark:text-red-200',
      icon: 'text-red-700 dark:text-red-200'
    },
    yellow: {
      wash: 'from-amber-500/25 via-amber-500/10 to-transparent',
      light: 'from-amber-500/20 to-amber-500/5 dark:from-amber-400/20 dark:to-amber-400/5',
      text: 'text-amber-800 dark:text-amber-200',
      icon: 'text-amber-800 dark:text-amber-200'
    }
  };

  const classes = colorClasses[color] || colorClasses.blue;
  const compact = size === 'compact';
  const formattedDisplayValue = typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue;
  const valueText = `${prefix}${formattedDisplayValue ?? ''}${suffix}`;
  const isLongValue = String(valueText).length > (compact ? 9 : 12);
  const valueSizeClass = isLongValue
    ? 'text-[clamp(1.125rem,1.6vw,1.5rem)]'
    : (compact ? 'text-xl' : 'text-2xl');

  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-3 h-3" />;
      case 'down':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    
    switch (trend.direction) {
      case 'up':
        return 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300 dark:bg-emerald-500/10';
      case 'down':
        return 'text-red-700 bg-red-500/10 dark:text-red-200 dark:bg-red-500/10';
      default:
        return 'text-orange-700 bg-orange-500/10 dark:text-orange-200 dark:bg-orange-500/10';
    }
  };

  return (
    <div
      className={`crm-panel crm-stat-card group relative overflow-hidden rounded-xl border p-3.5 transition-shadow duration-200 hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className={`absolute inset-0 bg-gradient-to-br ${classes.wash}`} />
      </div>
      <div className="relative z-10 flex items-start gap-3">
        {Icon && (
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${classes.light} border border-white/10`}>
            {typeof Icon === 'string' ? <span className="text-lg">{Icon}</span> : <Icon className={`h-[18px] w-[18px] ${classes.icon}`} />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug text-[var(--crm-muted)]">{title}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className={`${valueSizeClass} max-w-full break-words font-bold leading-tight tracking-tight tabular-nums ${classes.text}`} title={valueTitle || valueText}>
              {valueText}
            </p>
            {trend && (
              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${getTrendColor()}`}>
                {getTrendIcon()}<span>{trend.value}</span>
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-[11px] leading-snug text-[var(--crm-muted)]">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

export default AnimatedStats;
