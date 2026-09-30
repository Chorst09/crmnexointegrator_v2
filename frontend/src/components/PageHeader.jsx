import React from 'react';

const PageHeader = ({ 
  title, 
  subtitle, 
  icon: Icon,
  actions = [],
  breadcrumbs = [],
  gradient = 'blue'
}) => {
  const gradients = {
    blue: 'from-blue-600 via-blue-700 to-blue-800',
    green: 'from-green-600 via-green-700 to-green-800',
    purple: 'from-purple-600 via-purple-700 to-purple-800',
    orange: 'from-orange-600 via-orange-700 to-orange-800',
    red: 'from-red-600 via-red-700 to-red-800',
    indigo: 'from-indigo-600 via-indigo-700 to-indigo-800'
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradients[gradient]} p-8 mb-8`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      <div className="relative z-10">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="mb-4">
            <ol className="flex items-center space-x-2 text-sm">
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

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Icon className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/90 text-lg">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`
                    px-4 py-2 rounded-xl font-medium transition-all duration-200
                    flex items-center gap-2 backdrop-blur-sm
                    ${action.variant === 'primary' 
                      ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg' 
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                    }
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
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
    </div>
  );
};

export default PageHeader;