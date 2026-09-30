import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Eye, Edit, Trash2, MoreHorizontal, ChevronDown } from 'lucide-react';

const ModernTable = ({
  title,
  data = [],
  columns = [],
  searchTerm = '',
  onSearchChange,
  filters = [],
  onView,
  onEdit,
  onDelete,
  onBulkDelete = null,
  bulkDeleteLabel = 'Excluir selecionados',
  renderActions = null,
  rowClassName = null,
  customActions = [],
  emptyState = null,
  loading = false,
  pagination = null
}) => {
  const [selectedRows, setSelectedRows] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const selectedItems = useMemo(
    () => data.filter((item) => selectedRows.includes(item?.id)),
    [data, selectedRows]
  );

  useEffect(() => {
    const currentIds = new Set(data.map((item) => item?.id).filter(Boolean));
    setSelectedRows((previous) => {
      const next = previous.filter((id) => currentIds.has(id));
      return next.length === previous.length ? previous : next;
    });
  }, [data]);

  const handleBulkDeleteClick = async () => {
    if (typeof onBulkDelete !== 'function' || selectedItems.length === 0) return;
    const shouldClearSelection = await onBulkDelete(selectedItems, selectedRows);
    if (shouldClearSelection !== false) {
      setSelectedRows([]);
    }
  };

  const hasActions =
    typeof renderActions === 'function' ||
    Boolean(onView) ||
    Boolean(onEdit) ||
    Boolean(onDelete) ||
    customActions.length > 0;

  if (loading) {
    return (
      <div className="crm-panel overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-black/10 dark:bg-white/10 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-black/5 dark:bg-white/5 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(data.map(item => item.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedRows([...selectedRows, id]);
    } else {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id));
    }
  };

  return (
    <div className="crm-panel overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.55)]">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-[var(--crm-ink)]">{title}</h3>
            <p className="text-sm text-[var(--crm-muted)] mt-1">{data.length} itens encontrados</p>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
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
            
            {filters.length > 0 && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="crm-btn crm-btn-secondary"
              >
                <Filter className="w-4 h-4" />
                Filtros
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && filters.length > 0 && (
          <div className="mt-4 crm-panel-muted p-4 motion-safe:animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filters.map((filter, index) => (
                <div key={index}>
                  <label className="block text-sm font-semibold text-[var(--crm-ink)] mb-1">
                    {filter.label}
                  </label>
                  <select
                    value={filter.value}
                    onChange={(e) => filter.onChange(e.target.value)}
                    className="crm-input"
                  >
                    <option value="">Todos</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.55)] border-b border-[color:var(--crm-border)]">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-950"
                  />
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-4 text-left text-xs font-bold text-[var(--crm-muted)] uppercase tracking-wider"
                  >
                    {column.label}
                  </th>
                ))}
                {hasActions && (
                  <th className="px-6 py-4 text-right text-xs font-bold text-[var(--crm-muted)] uppercase tracking-wider sticky right-0 z-20 bg-[rgb(var(--crm-surface-2-rgb)_/_0.95)] supports-[backdrop-filter]:bg-[rgb(var(--crm-surface-2-rgb)_/_0.78)] backdrop-blur-md shadow-[-12px_0_16px_-14px_rgba(15,23,42,0.45)]">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--crm-border)]">
              {data.map((item, index) => {
                const isSelected = selectedRows.includes(item.id);

                return (
                  <tr
                    key={item.id || index}
                    className={[
                      'transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                      isSelected ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.08)]' : '',
                      typeof rowClassName === 'function' ? rowClassName(item) : ''
                    ].join(' ')}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(item.id, e.target.checked)}
                        className="rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-950"
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-4">
                        {column.render ? column.render(item) : (
                          <div className="text-sm text-[var(--crm-ink)]">
                            {item[column.key]}
                          </div>
                        )}
                      </td>
                    ))}
                    {hasActions && (
                      <td
                        className={[
                          'px-6 py-4 text-right sticky right-0 z-10 backdrop-blur-md shadow-[-12px_0_16px_-14px_rgba(15,23,42,0.45)]',
                          isSelected
                            ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.14)]'
                            : 'bg-[rgb(var(--crm-surface-rgb)_/_0.94)] supports-[backdrop-filter]:bg-[rgb(var(--crm-surface-rgb)_/_0.78)]'
                        ].join(' ')}
                      >
                        {typeof renderActions === 'function' ? (
                          <div className="flex items-center justify-end gap-2">
                            {renderActions(item)}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-2">
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
                            {customActions.length > 0 && (
                              <div className="relative group">
                                <button className="p-2 text-[var(--crm-muted)] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-52 crm-panel opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                  {customActions.map((action, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => action.onClick(item)}
                                      className="w-full px-4 py-2 text-left text-sm text-[var(--crm-ink)] hover:bg-black/5 dark:hover:bg-white/5 first:rounded-t-2xl last:rounded-b-2xl flex items-center gap-2"
                                    >
                                      {action.icon && <action.icon className="w-4 h-4" />}
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
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
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16">
          {emptyState || (
            <div>
              <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-[var(--crm-muted)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-2">Nenhum item encontrado</h3>
              <p className="text-[var(--crm-muted)] max-w-sm mx-auto">
                {searchTerm 
                  ? 'Tente ajustar os termos de busca ou filtros'
                  : 'Nenhum dado disponível no momento'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination && (
        <div className="px-6 py-4 border-t border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.55)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--crm-muted)]">
              Mostrando {pagination.from} a {pagination.to} de {pagination.total} resultados
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={pagination.onPrevious}
                disabled={!pagination.hasPrevious}
                className="crm-btn crm-btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={pagination.onNext}
                disabled={!pagination.hasNext}
                className="crm-btn crm-btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 crm-panel px-6 py-3 flex items-center gap-4 motion-safe:animate-scale-in">
          <span className="text-sm font-medium">{selectedRows.length} itens selecionados</span>
          <div className="flex items-center gap-2">
            {typeof onBulkDelete === 'function' ? (
              <button
                type="button"
                onClick={handleBulkDeleteClick}
                className="crm-btn crm-btn-danger px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {bulkDeleteLabel}
              </button>
            ) : (
              <button className="crm-btn crm-btn-primary px-3 py-1.5 text-sm">
                Ação em Lote
              </button>
            )}
            <button 
              onClick={() => setSelectedRows([])}
              className="crm-btn crm-btn-secondary px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernTable;
