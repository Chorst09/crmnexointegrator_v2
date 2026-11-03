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
  const valueSizeClass = compact
    ? (isLongValue ? 'text-[clamp(1.45rem,2vw,1.9rem)]' : 'text-2xl')
    : (isLongValue ? 'text-[clamp(1.75rem,2.25vw,2.6rem)]' : 'text-3xl md:text-4xl');

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
      className={`
        crm-panel group relative overflow-hidden ${compact ? 'p-4 min-h-[132px]' : 'p-5 min-h-[148px]'}
        transition-all duration-300 hover:shadow-soft-xl hover:-translate-y-0.5
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className={`absolute inset-0 bg-gradient-to-br ${classes.wash}`}></div>
      </div>
      <div className="absolute inset-0 crm-dotgrid opacity-10"></div>

      <div className="relative z-10 flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className={`${compact ? 'text-[13px] leading-snug' : 'text-sm leading-snug'} max-w-[72%] font-bold text-[var(--crm-muted)]`}>
            {title}
          </p>

          <div className={`${compact ? 'p-2.5 rounded-xl' : 'p-3 rounded-2xl'} shrink-0 bg-gradient-to-br ${classes.light} border border-[rgb(var(--crm-ink-rgb)_/_0.1)] shadow-sm`}>
            {typeof Icon === 'string' ? (
              <span className={compact ? 'text-xl' : 'text-2xl'}>{Icon}</span>
            ) : (
              <Icon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} ${classes.icon}`} />
            )}
          </div>
        </div>

        <div className="min-w-0">
          <p
            className={`${valueSizeClass} max-w-full whitespace-nowrap font-extrabold leading-none tracking-normal ${classes.text} transition-all duration-300`}
            title={valueTitle || valueText}
          >
            {valueText}
          </p>
          
          {subtitle && (
            <p className={`${compact ? 'mt-2 text-[12px] leading-snug' : 'mt-2 text-xs leading-snug'} text-[var(--crm-muted)]`}>{subtitle}</p>
          )}
        </div>
        
        {trend && (
          <div className={`inline-flex w-fit items-center gap-1 rounded-full font-semibold ${compact ? 'mt-auto px-2 py-1 text-[11px]' : 'mt-auto px-2.5 py-1 text-xs'} ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* Hover Effect */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-[rgb(var(--crm-surface-rgb)_/_0.1)] to-transparent -skew-x-12 motion-safe:group-hover:animate-shine" />
      </div>
    </div>
  );
};

export default AnimatedStats;
