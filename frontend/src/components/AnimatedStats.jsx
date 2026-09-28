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
  onClick = null 
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
      bg: 'from-blue-500 to-blue-600',
      light: 'from-blue-100 to-blue-200',
      text: 'text-blue-600',
      icon: 'text-blue-500'
    },
    green: {
      bg: 'from-green-500 to-green-600',
      light: 'from-green-100 to-green-200',
      text: 'text-green-600',
      icon: 'text-green-500'
    },
    purple: {
      bg: 'from-purple-500 to-purple-600',
      light: 'from-purple-100 to-purple-200',
      text: 'text-purple-600',
      icon: 'text-purple-500'
    },
    orange: {
      bg: 'from-orange-500 to-orange-600',
      light: 'from-orange-100 to-orange-200',
      text: 'text-orange-600',
      icon: 'text-orange-500'
    },
    red: {
      bg: 'from-red-500 to-red-600',
      light: 'from-red-100 to-red-200',
      text: 'text-red-600',
      icon: 'text-red-500'
    },
    yellow: {
      bg: 'from-yellow-500 to-yellow-600',
      light: 'from-yellow-100 to-yellow-200',
      text: 'text-yellow-600',
      icon: 'text-yellow-500'
    }
  };

  const classes = colorClasses[color] || colorClasses.blue;

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
        return 'text-green-600 bg-green-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div 
      className={`
        relative overflow-hidden rounded-2xl p-6 
        bg-gradient-to-br from-white via-gray-50 to-white
        border border-gray-200 shadow-sm
        transition-all duration-300 hover:shadow-lg hover:scale-[1.02]
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className={`absolute inset-0 bg-gradient-to-br ${classes.bg}`}></div>
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline">
              <p className={`text-3xl font-bold ${classes.text} transition-all duration-300`}>
                {prefix}{typeof displayValue === 'number' ? displayValue.toLocaleString() : displayValue}{suffix}
              </p>
            </div>
            
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
            
            {trend && (
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-2 ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>{trend.value}</span>
              </div>
            )}
          </div>
          
          <div className={`p-3 rounded-xl bg-gradient-to-br ${classes.light} shadow-sm`}>
            <Icon className={`w-6 h-6 ${classes.icon}`} />
          </div>
        </div>
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-10 transition-opacity duration-300 transform -skew-x-12"></div>
    </div>
  );
};

export default AnimatedStats;