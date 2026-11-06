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
    <div className={`relative overflow-hidden ${compact ? 'rounded-xl p-4 md:px-5' : 'rounded-2xl p-6 md:p-7 mb-6'} bg-gradient-to-r ${gradients[gradient]} shadow-soft-xl motion-safe:animate-fade-up`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      <div className="relative z-10">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className={compact ? 'mb-2' : 'mb-4'}>
            <ol className={`flex items-center space-x-2 ${compact ? 'text-[11px]' : 'text-sm'}`}>
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <span className="text-[rgb(var(--crm-ink-rgb)_/_0.6)] mx-2">/</span>}
                  <span className={index === breadcrumbs.length - 1 ? "text-[rgb(var(--crm-ink-rgb)_/_1)] font-medium" : "text-[rgb(var(--crm-ink-rgb)_/_0.8)]"}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className={`flex flex-col justify-between items-start ${compact ? 'lg:flex-row lg:items-center gap-3' : 'xl:flex-row xl:items-center gap-5'}`}>
          <div className={`flex min-w-0 items-center ${compact ? 'gap-3' : 'gap-4'}`}>
            {Icon && (
              <div className={`shrink-0 bg-[rgb(var(--crm-surface-rgb)_/_0.2)] backdrop-blur-sm ${compact ? 'p-2 rounded-lg' : 'p-3 rounded-xl'}`}>
                <Icon className={`${compact ? 'h-5 w-5' : 'w-7 h-7'} text-[rgb(var(--crm-ink-rgb)_/_1)]`} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className={`${compact ? 'text-xl md:text-2xl mb-1' : 'text-2xl md:text-3xl mb-2'} font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] leading-tight`}>
                {title}
              </h1>
              {subtitle && (
                <p className={`max-w-3xl text-[rgb(var(--crm-ink-rgb)_/_0.9)] ${compact ? 'text-xs md:text-sm leading-snug' : 'text-base md:text-lg leading-relaxed'}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions.length > 0 && (
            <div className={`flex w-full flex-wrap ${compact ? 'gap-2 lg:w-auto lg:justify-end' : 'gap-3 xl:w-auto xl:justify-end'}`}>
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={!!action.disabled}
                  className={`
                    ${compact ? 'px-3 py-2 rounded-lg text-xs min-h-9' : 'px-4 py-2.5 rounded-xl min-h-11'} font-semibold transition-all duration-200
                    flex items-center justify-center gap-2 backdrop-blur-sm
                    ${action.variant === 'primary' 
                      ? "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] shadow-lg"
                      : "bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.3)] border border-[var(--crm-border)]"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/20
                  `}
                >
                  {action.icon && <action.icon className="w-4 h-4" />}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-300/5 rounded-full -translate-y-32 translate-x-32"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-300/5 rounded-full translate-y-24 -translate-x-24"></div>
    </div>
  );
};

export default PageHeader;
