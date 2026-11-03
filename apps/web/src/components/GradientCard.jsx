import React from 'react';

const GradientCard = ({
  children,
  gradient = 'blue',
  className = '',
  hover = true,
  onClick = null
}) => {
  const gradients = {
    blue: "border-cyan-200/50 bg-gradient-to-br from-cyan-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-sky-100/90 dark:border-cyan-300/25 dark:from-[rgb(var(--crm-surface-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    green: "border-emerald-200/55 bg-gradient-to-br from-emerald-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-cyan-50/90 dark:border-emerald-300/25 dark:from-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    purple: "border-indigo-200/55 bg-gradient-to-br from-indigo-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-sky-50/90 dark:border-indigo-300/25 dark:from-[rgb(var(--crm-surface-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    orange: "border-amber-200/55 bg-gradient-to-br from-amber-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-orange-50/90 dark:border-amber-300/25 dark:from-[rgb(var(--crm-surface-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    red: "border-rose-200/55 bg-gradient-to-br from-rose-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-orange-50/85 dark:border-rose-300/25 dark:from-[rgb(var(--crm-surface-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    yellow: "border-yellow-200/55 bg-gradient-to-br from-yellow-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-amber-50/90 dark:border-yellow-300/25 dark:from-[rgb(var(--crm-surface-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    indigo: "border-blue-200/55 bg-gradient-to-br from-blue-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-indigo-50/90 dark:border-blue-300/25 dark:from-[rgb(var(--crm-surface-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    pink: "border-fuchsia-200/55 bg-gradient-to-br from-fuchsia-50/95 via-[rgb(var(--crm-surface-rgb)_/_1)] to-pink-50/90 dark:border-fuchsia-300/25 dark:from-[rgb(var(--crm-surface-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]",
    gray: "border-[var(--crm-border)] bg-gradient-to-br from-[rgb(var(--crm-surface-rgb)_/_0.95)] via-[rgb(var(--crm-surface-rgb)_/_1)] to-[rgb(var(--crm-surface-rgb)_/_0.9)] dark:border-cyan-300/20 dark:from-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:via-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:to-[rgb(var(--crm-surface-rgb)_/_1)]"
  };

  return (
    <div
      className={[
        'group relative overflow-hidden rounded-3xl border shadow-soft-xl backdrop-blur-md',
        gradients[gradient] || gradients.blue,
        hover ? "transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-2xl hover:border-cyan-300/45 dark:hover:border-cyan-200/35 dark:hover:border-cyan-800/35" : '',
        onClick ? 'cursor-pointer' : '',
        className
      ].join(' ')}
      onClick={onClick}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-[rgb(var(--crm-surface-rgb)_/_0.25)] via-transparent to-cyan-300/10 dark:from-cyan-300/8 dark:to-cyan-200/12" />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
};

export default GradientCard;
