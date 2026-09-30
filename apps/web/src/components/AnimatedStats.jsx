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
  size = 'default'
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
        crm-panel group relative overflow-hidden ${compact ? 'p-4 min-h-[112px]' : 'p-6'}
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

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <p className={`${compact ? 'text-xs leading-snug' : 'text-sm'} font-semibold text-[var(--crm-muted)] mb-1`}>{title}</p>
            <div className="flex items-baseline">
              <p className={`${compact ? 'text-2xl leading-none break-words' : 'text-3xl'} font-bold ${classes.text} transition-all duration-300`}>
                {prefix}{typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}{suffix}
              </p>
            </div>
            
            {subtitle && (
              <p className={`${compact ? 'text-[11px] leading-snug' : 'text-xs'} text-[var(--crm-muted)] mt-1`}>{subtitle}</p>
            )}
            
            {trend && (
              <div className={`inline-flex items-center gap-1 rounded-full font-medium ${compact ? 'mt-2 px-1.5 py-0.5 text-[10px]' : 'mt-2 px-2 py-1 text-xs'} ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>{trend.value}</span>
              </div>
            )}
          </div>
          
          <div className={`${compact ? 'p-2.5 rounded-xl' : 'p-3 rounded-2xl'} shrink-0 bg-gradient-to-br ${classes.light} border border-white/10 shadow-sm`}>
            {typeof Icon === 'string' ? (
              <span className={compact ? 'text-xl' : 'text-2xl'}>{Icon}</span>
            ) : (
              <Icon className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} ${classes.icon}`} />
            )}
          </div>
        </div>
      </div>

      {/* Hover Effect */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 motion-safe:group-hover:animate-shine" />
      </div>
    </div>
  );
};

export default AnimatedStats;
