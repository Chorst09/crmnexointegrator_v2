import React from 'react';

const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  actions = [],
  breadcrumbs = [],
  gradient = 'blue'
}) => {
  const standardHeaderGradient = 'from-[#06111a] via-[#082735] to-[#0b3a46]';
  const gradients = {
    blue: standardHeaderGradient,
    green: standardHeaderGradient,
    purple: standardHeaderGradient,
    orange: standardHeaderGradient,
    red: standardHeaderGradient,
    indigo: standardHeaderGradient
  };

  return (
    <div className={`crm-page-header relative overflow-hidden rounded-xl bg-gradient-to-r ${gradients[gradient]} px-4 py-3 sm:px-5 sm:py-4 mb-4 shadow-sm motion-safe:animate-fade-up`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      <div className="relative z-10">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="mb-2">
            <ol className="flex items-center space-x-1.5 text-[11px]">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <span className="text-white/60 mx-2">/</span>}
                  <span className={index === breadcrumbs.length - 1 ? 'text-white font-medium' : 'text-white/80'}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div className="shrink-0 p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                <Icon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0 crm-page-header-copy">
              <h1 className="text-xl font-semibold text-white mb-0.5 leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="max-w-3xl text-white/90 text-[13px] leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions.length > 0 && (
            <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end lg:shrink-0">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={!!action.disabled}
                  className={`
                    px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200
                    flex min-h-9 items-center justify-center gap-2 backdrop-blur-sm
                    ${action.variant === 'primary'
                      ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm'
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
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
