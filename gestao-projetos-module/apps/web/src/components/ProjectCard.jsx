import { TrendingUp, AlertCircle, Clock, Users, DollarSign } from 'lucide-react';

const healthColor = (score) => {
  if (score >= 80) return 'text-green-700 dark:text-green-400';
  if (score >= 60) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
};

export default function ProjectCard({ project, onClick }) {
  const getStatusColor = (status) => {
    const colors = {
      PLANEJADO: 'slate',
      EM_ANDAMENTO: 'blue',
      PAUSADO: 'yellow',
      CONCLUIDO: 'green',
      CANCELADO: 'red'
    };
    return colors[status] || 'slate';
  };

  const color = getStatusColor(project.status);
  const healthScoreClass = project.healthScore >= 80 ? 'border-green-200 dark:border-green-800 from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' : 
                           project.healthScore >= 60 ? 'border-yellow-200 dark:border-yellow-800 from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20' :
                           'border-red-200 dark:border-red-800 from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20';
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br ${healthScoreClass} transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer`}
    >
      {/* Header com status gradient */}
      <div className={`h-2 w-full ${color === 'slate' ? 'bg-gradient-to-r from-slate-400 to-slate-600' : color === 'blue' ? 'bg-gradient-to-r from-blue-400 to-cyan-600' : color === 'yellow' ? 'bg-gradient-to-r from-yellow-400 to-amber-600' : color === 'green' ? 'bg-gradient-to-r from-green-400 to-emerald-600' : 'bg-gradient-to-r from-red-400 to-rose-600'}`} />

      <div className="p-5 space-y-4">
        {/* Top section: Número + Status */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">{project.number}</p>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{project.name}</h3>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            project.type === 'B2G' 
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          }`}>
            {project.type}
          </span>
        </div>

        {/* Cliente */}
        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{project.company?.name || 'Sem cliente'}</p>

        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Progresso</span>
            <span className="font-bold text-slate-900 dark:text-white">{project.progressPercent || 0}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all duration-500"
              style={{ width: `${project.progressPercent || 0}%` }}
            />
          </div>
        </div>

        {/* Health Score + KPIs */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-600">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${project.healthScore >= 80 ? 'bg-green-100 dark:bg-green-900/30' : project.healthScore >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <TrendingUp size={16} className={healthColor(project.healthScore)} />
            </div>
            <div className="text-xs">
              <p className="text-slate-500 dark:text-slate-400">Health</p>
              <p className={`font-bold text-lg ${healthColor(project.healthScore)}`}>{project.healthScore || 75}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Clock size={16} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-xs">
              <p className="text-slate-500 dark:text-slate-400">Fase</p>
              <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[80px]">{project.phase?.replace(/_/g, ' ') || '-'}</p>
            </div>
          </div>
        </div>

        {/* Gestor */}
        <div className="flex items-center gap-2 pt-2 text-xs text-slate-600 dark:text-slate-400">
          <Users size={14} />
          <span className="truncate">{project.projectManager?.name || 'Sem gestor'}</span>
        </div>
      </div>
    </div>
  );
}
