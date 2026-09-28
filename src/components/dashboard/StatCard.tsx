import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtext: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, subtext }) => {
  // Mapear cores baseado no ícone/título
  const getGradientColors = (title: string) => {
    if (title.includes('PABX')) return 'from-blue-600 to-blue-800';
    if (title.includes('Máquinas')) return 'from-purple-600 to-purple-800';
    if (title.includes('Fibra') && !title.includes('Double')) return 'from-green-600 to-green-800';
    if (title.includes('Double')) return 'from-red-600 to-red-800';
    if (title.includes('MAN')) return 'from-cyan-600 to-cyan-800';
    return 'from-slate-600 to-slate-800';
  };

  const getShadowColor = (title: string) => {
    if (title.includes('PABX')) return 'hover:shadow-blue-500/25';
    if (title.includes('Máquinas')) return 'hover:shadow-purple-500/25';
    if (title.includes('Fibra') && !title.includes('Double')) return 'hover:shadow-green-500/25';
    if (title.includes('Double')) return 'hover:shadow-red-500/25';
    if (title.includes('MAN')) return 'hover:shadow-cyan-500/25';
    return 'hover:shadow-slate-500/25';
  };

  const gradient = getGradientColors(title);
  const shadowColor = getShadowColor(title);

  return (
    <div className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)] ${shadowColor} hover:shadow-[0_22px_52px_-30px_rgba(0,0,0,0.95)] transition-all duration-300 transform hover:brightness-[1.02] border border-slate-700/30 group overflow-hidden relative`}>
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`} />
      
      {/* Content */}
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${gradient} shadow-lg`}>
            <div className="text-white">
              {icon}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tracking-tight text-white group-hover:text-cyan-300 transition-colors">
              {value}
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-bold tracking-tight text-sm mb-1 group-hover:text-cyan-300 transition-colors">
            {title}
          </h3>
          <p className="text-slate-400 text-sm">{subtext}</p>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-12 h-12 bg-gradient-to-tr from-white/5 to-transparent rounded-tr-full" />
    </div>
  );
};

export default StatCard;
