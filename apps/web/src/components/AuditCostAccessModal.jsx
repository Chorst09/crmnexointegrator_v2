import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Eye,
  FileCheck2,
  Filter,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  X
} from 'lucide-react';
import { fetchCorporateAuditLogs } from '../utils/auditLogger';

export default function AuditCostAccessModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchCorporateAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedRole !== 'ALL') {
        if ((log.userRole || '').toUpperCase() !== selectedRole) return false;
      }
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        (log.userName || '').toLowerCase().includes(q) ||
        (log.userEmail || '').toLowerCase().includes(q) ||
        (log.resourceId || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        JSON.stringify(log.details || '').toLowerCase().includes(q)
      );
    });
  }, [logs, selectedRole, searchTerm]);

  const stats = useMemo(() => {
    const total = logs.length;
    const preVendasCount = logs.filter((l) => ['PRE_SALES', 'PRE_VENDAS'].includes((l.userRole || '').toUpperCase())).length;
    const adminCount = logs.filter((l) => ['ADMIN', 'MASTER'].includes((l.userRole || '').toUpperCase())).length;
    return { total, preVendasCount, adminCount };
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Log de Auditoria de Acesso a Custos & Margens
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                  <Shield className="h-3 w-3" /> Tabela audit_logs
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Rastreabilidade corporativa mandatória: histórico de consultas a custos e margens de distribuidores por técnicos e administradores.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo de Rastreabilidade */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-950/60 border-b border-slate-800">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Total de Acessos Auditados</div>
              <div className="text-lg font-bold text-white">{stats.total}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Consultas Pré-Vendas / Engenharia</div>
              <div className="text-lg font-bold text-purple-300">{stats.preVendasCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Consultas Administrativas / Master</div>
              <div className="text-lg font-bold text-amber-300">{stats.adminCount}</div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800 bg-slate-900/80">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por usuário, orçamento, distribuidor ou ação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Todos os Perfis</option>
              <option value="PRE_VENDAS">Pré-Vendas / Técnico</option>
              <option value="ADMIN">Administrador</option>
              <option value="MASTER">Master Admin</option>
            </select>

            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Tabela de Logs */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold text-slate-400">Nenhum log de auditoria encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Os acessos a relatórios e custos serão listados automaticamente aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Usuário & Perfil</th>
                    <th className="py-2.5 px-3">Ação Auditada</th>
                    <th className="py-2.5 px-3">Recurso</th>
                    <th className="py-2.5 px-3">Detalhes do Acesso (Custos & Distribuidores)</th>
                    <th className="py-2.5 px-3 text-right">Rastreabilidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-300">
                  {filteredLogs.map((log) => {
                    const dateFormatted = log.createdAt
                      ? new Date(log.createdAt).toLocaleString('pt-BR')
                      : '-';

                    const details = typeof log.details === 'object' && log.details !== null ? log.details : {};
                    const distribuidoresText = Array.isArray(details.distribuidores)
                      ? details.distribuidores.join(', ')
                      : details.distribuidor || 'Distribuidor Homologado';

                    const roleBadgeColor =
                      log.userRole === 'MASTER'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : log.userRole === 'ADMIN'
                        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        : 'bg-purple-500/15 text-purple-300 border-purple-500/30';

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {dateFormatted}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-white">{log.userName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${roleBadgeColor}`}>
                              {log.userRole}
                            </span>
                            <span className="text-slate-500 text-[11px] truncate max-w-[130px]">
                              {log.userEmail}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-cyan-300">
                            {log.action === 'CONSULTA_CUSTOS_MARGENS'
                              ? 'Consulta de Custos e Margens'
                              : log.action === 'CONSULTA_COTACOES_DISTRIBUIDOR'
                              ? 'Cotações de Distribuidores'
                              : log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-200">
                            {log.resourceId || log.resource || '-'}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase">
                            {log.resource}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 max-w-[280px]">
                          <div className="text-slate-200 truncate" title={distribuidoresText}>
                            <span className="text-slate-400">Dist:</span> {distribuidoresText}
                          </div>
                          {details.margemMedia && (
                            <div className="text-[11px] text-emerald-400">
                              Margem: {details.margemMedia}
                              {details.totalCusto ? ` · Custo: R$ ${Number(details.totalCusto).toLocaleString('pt-BR')}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            <ShieldCheck className="h-3 w-3" /> Auditado
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 p-4 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Auditoria contínua corporativa ativada conforme política de segurança da informação.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
