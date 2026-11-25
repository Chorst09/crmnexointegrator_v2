import React from 'react';

const PageHeader = ({ 
  title, 
  subtitle, 
  icon: Icon,
  actions = [],
  breadcrumbs = [],
  gradient = 'blue',
  compact = false
}) => {
  const standardHeaderGradient = "from-[rgb(var(--crm-surface-2-rgb)_/_1)] via-[rgb(var(--crm-surface-2-rgb)_/_1)] to-[rgb(var(--crm-surface-rgb)_/_1)]";
  const gradients = {
    blue: standardHeaderGradient,
    green: standardHeaderGradient,
    purple: standardHeaderGradient,
    orange: standardHeaderGradient,
    red: standardHeaderGradient,
    indigo: standardHeaderGradient
  };

  return (
    <div className={`relative overflow-hidden ${compact ? 'rounded-xl px-4 py-2.5 mb-3' : 'rounded-2xl px-5 py-3.5 mb-4'} border border-cyan-400/20 bg-gradient-to-r ${gradients[gradient]} shadow-[inset_0_1px_0_rgba(140,235,255,0.12),0_12px_28px_-18px_rgba(0,180,255,0.32)] motion-safe:animate-fade-up`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(0,202,255,0.14),transparent_55%),radial-gradient(ellipse_at_88%_100%,rgba(124,58,237,0.12),transparent_55%)]" />

      <div className="relative z-10">
        {breadcrumbs.length > 0 && (
          <nav className="mb-1">
            <ol className="flex items-center space-x-1.5 text-[11px]">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <span className="text-[rgb(var(--crm-ink-rgb)_/_0.45)] mx-1.5">/</span>}
                  <span className={index === breadcrumbs.length - 1 ? "text-cyan-300 font-medium" : "text-[rgb(var(--crm-ink-rgb)_/_0.65)]"}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex flex-col justify-between items-start gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div className={`shrink-0 flex items-center justify-center border border-cyan-400/35 bg-cyan-500/15 text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.22)] backdrop-blur-sm ${compact ? 'h-9 w-9 rounded-lg' : 'h-10 w-10 rounded-xl'}`}>
                <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className={`${compact ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'} font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] leading-tight`}>
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 max-w-3xl text-xs md:text-[13px] leading-snug text-[rgb(var(--crm-ink-rgb)_/_0.78)]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions.length > 0 && (
            <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={!!action.disabled}
                  className={`
                    px-3.5 py-2 rounded-xl text-xs min-h-9 font-semibold transition-all duration-200
                    flex items-center justify-center gap-1.5 backdrop-blur-sm
                    ${action.variant === 'primary'
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white border border-cyan-300/40 shadow-[0_4px_14px_rgba(6,182,212,0.35)] hover:brightness-110"
                      : "bg-[rgb(var(--crm-surface-rgb)_/_0.55)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-cyan-400/25 hover:border-cyan-300/50 hover:bg-cyan-500/10"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {action.icon && <action.icon className="w-3.5 h-3.5" />}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
