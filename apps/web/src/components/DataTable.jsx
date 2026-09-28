import React from 'react';
import { Search, Filter, Eye, Edit, Trash2 } from 'lucide-react';

const DataTable = ({
  title,
  data = [],
  columns = [],
  searchTerm = '',
  onSearchChange,
  statusFilter = '',
  onStatusFilterChange,
  statusOptions = [],
  onView,
  onEdit,
  onDelete,
  emptyState = null,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="crm-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-[color:var(--crm-border)]">
          <h3 className="text-lg font-bold text-[var(--crm-ink)]">{title}</h3>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-panel overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.55)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-[var(--crm-ink)]">
            {title} ({data.length})
          </h3>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {onSearchChange && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--crm-muted)] w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="crm-input pl-10"
                />
              </div>
            )}
            
            {onStatusFilterChange && statusOptions.length > 0 && (
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="crm-input"
              >
                <option value="">Todos</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--crm-border)]">
            <thead className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.55)]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-bold text-[var(--crm-muted)] uppercase tracking-wider"
                  >
                    {column.label}
                  </th>
                ))}
                {(onView || onEdit || onDelete) && (
                  <th className="px-6 py-3 text-left text-xs font-bold text-[var(--crm-muted)] uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--crm-border)]">
              {data.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                      {column.render ? column.render(item) : (
                        <div className="text-sm text-[var(--crm-ink)]">
                          {item[column.key]}
                        </div>
                      )}
                    </td>
                  ))}
                  {(onView || onEdit || onDelete) && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {onView && (
                          <button
                            onClick={() => onView(item)}
                            className="p-2 text-sky-700 dark:text-sky-200 hover:bg-sky-500/10 rounded-xl transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(item)}
                            className="p-2 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-500/10 rounded-xl transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(item)}
                            className="p-2 text-red-700 dark:text-red-200 hover:bg-red-500/10 rounded-xl transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          {emptyState || (
            <>
              <div className="w-12 h-12 text-gray-400 mx-auto mb-4">📋</div>
              <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-2">Nenhum item encontrado</h3>
              <p className="text-[var(--crm-muted)]">
                {searchTerm || statusFilter 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Nenhum dado disponível no momento'
                }
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
