import { useCallback, useEffect, useState } from 'react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const CONFIRMATION_PHRASE = 'RESTAURAR NEXOS';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const typeBadge = (type) => {
  const map = {
    json: { label: 'JSON', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
    dump: { label: 'DUMP', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
    sql: { label: 'SQL', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' }
  };
  const meta = map[type] || { label: String(type || '?').toUpperCase(), className: 'bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const eventLabel = (event) => {
  const map = {
    restore_start: 'Início',
    restore_success: 'Sucesso',
    restore_error: 'Erro',
    safety_backup: 'Backup de segurança',
    restart: 'Reinício do container'
  };
  return map[event] || event || '-';
};

export default function LocalBackupRestore() {
  const [backups, setBackups] = useState([]);
  const [backupDir, setBackupDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [validating, setValidating] = useState('');
  const [validations, setValidations] = useState({});

  const [restoring, setRestoring] = useState('');
  const [restoreResult, setRestoreResult] = useState(null);

  const [confirm, setConfirm] = useState({ isOpen: false, filename: null });
  const [confirmText, setConfirmText] = useState('');

  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(buildApiUrl('/admin/backup/list'), { headers: getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao listar backups (${res.status})`);
      setBackups(Array.isArray(data.files) ? data.files : []);
      setBackupDir(data.backupDir || '');
    } catch (err) {
      setError(err.message || 'Erro ao listar backups');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLog = useCallback(async () => {
    try {
      setLogLoading(true);
      const res = await fetch(buildApiUrl('/admin/backup/restore-log?limit=50'), { headers: getAuthHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setLogEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      // log é best-effort
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
    loadLog();
  }, [loadBackups, loadLog]);

  const validateBackup = async (filename) => {
    try {
      setValidating(filename);
      setError('');
      const res = await fetch(buildApiUrl('/admin/backup/validate'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ filename })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) {
        throw new Error(data?.error || `Erro ao validar backup (${res.status})`);
      }
      setValidations((prev) => ({ ...prev, [filename]: data }));
    } catch (err) {
      setError(err.message || 'Erro ao validar backup');
    } finally {
      setValidating('');
    }
  };

  const downloadBackup = async (filename) => {
    try {
      setError('');
      const res = await fetch(buildApiUrl(`/admin/backup/download/${encodeURIComponent(filename)}`), {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Erro ao baixar backup (${res.status})`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err.message || 'Erro ao baixar backup');
    }
  };

  const openConfirm = (filename) => {
    setConfirmText('');
    setConfirm({ isOpen: true, filename });
  };

  const closeConfirm = () => {
    setConfirm({ isOpen: false, filename: null });
    setConfirmText('');
  };

  const performRestore = async () => {
    const filename = confirm.filename;
    if (!filename || confirmText.trim() !== CONFIRMATION_PHRASE) return;
    try {
      setRestoring(filename);
      setError('');
      setRestoreResult(null);
      setMessage('Iniciando restauração...');

      const res = await fetch(buildApiUrl('/admin/backup/restore'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'x-restore-confirmation': 'RESTAURAR_NEXOS'
        },
        body: JSON.stringify({ filename })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Erro ao restaurar backup (${res.status})`);
      }

      setRestoreResult(data);
      setMessage(
        `Backup restaurado com sucesso: ${data?.database?.tableCount || 0} tabela(s), ${data?.database?.totalRows || 0} registro(s), ${data?.uploads?.restoredFiles || 0} arquivo(s) de upload. O servidor está reiniciando para aplicar os dados.`
      );
      closeConfirm();

      // O container reinicia após a resposta. Redireciona para o login após alguns segundos.
      setTimeout(() => {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
        } catch {
          // ignore
        }
        window.location.href = '/login';
      }, 4000);
    } catch (err) {
      setError(err.message || 'Erro ao restaurar backup');
      setMessage('');
      closeConfirm();
    } finally {
      setRestoring('');
      loadLog();
    }
  };

  const isRestoreEnabled = (filename, restorable) => {
    if (!restorable) return false;
    if (restoring) return false;
    const v = validations[filename];
    return Boolean(v && v.valid);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="crm-card rounded-2xl p-6 border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-2">
              <span>💾</span> Restauração de Backups
            </h2>
            <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">
              Lista, valida e restaura backups completos (.json) salvos no diretório de backups do servidor.
            </p>
          </div>
          <button
            type="button"
            onClick={loadBackups}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)] flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            <span>{loading ? 'Atualizando...' : 'Atualizar lista'}</span>
          </button>
        </div>

        {backupDir && (
          <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-mono">
            Diretório: {backupDir}
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
            <strong>Erro:</strong> {error}
          </div>
        )}

        {message && !error && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg text-sm">
            {message}
          </div>
        )}
      </div>

      {/* Lista de backups */}
      <div className="crm-card rounded-2xl p-6 border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] space-y-4">
        <h3 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">
          Backups disponíveis ({backups.length})
        </h3>

        {backups.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--crm-border)]">
            <table className="w-full text-left text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
              <thead className="bg-[rgb(var(--crm-surface-rgb)_/_0.8)] text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase tracking-wider font-semibold border-b border-[var(--crm-border)]">
                <tr>
                  <th className="px-4 py-3">Arquivo</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Tamanho</th>
                  <th className="px-4 py-3">Modificado</th>
                  <th className="px-4 py-3">Validação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--crm-border)]">
                {backups.map((file) => {
                  const v = validations[file.name];
                  return (
                    <tr key={file.name} className="hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)] transition-colors">
                      <td className="px-4 py-3 font-mono text-cyan-700 dark:text-cyan-300 font-medium break-all">
                        {file.name}
                      </td>
                      <td className="px-4 py-3">{typeBadge(file.type)}</td>
                      <td className="px-4 py-3 font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{file.sizeFormatted}</td>
                      <td className="px-4 py-3 text-[rgb(var(--crm-ink-rgb)_/_1)]">{formatDateTime(file.modifiedAt)}</td>
                      <td className="px-4 py-3">
                        {v ? (
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${v.valid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/40' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300/40'}`}>
                              {v.valid ? '✓ Válido' : '✗ Inválido'}
                            </span>
                            {v.tableSummary && (
                              <div className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                                {v.tableSummary.tableCount} tab · {(v.tableSummary.totalRows || 0).toLocaleString('pt-BR')} reg
                              </div>
                            )}
                            {v.note && <div className="text-[10px] text-amber-700 dark:text-amber-300">{v.note}</div>}
                            {v.issues && v.issues.length > 0 && (
                              <div className="text-[10px] text-red-600 dark:text-red-400">{v.issues.join('; ')}</div>
                            )}
                            {v.error && !(v.issues && v.issues.length) && (
                              <div className="text-[10px] text-red-600 dark:text-red-400">{v.error}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {file.restorable && (
                            <button
                              type="button"
                              onClick={() => validateBackup(file.name)}
                              disabled={validating === file.name}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50"
                            >
                              {validating === file.name ? 'Validando...' : 'Validar'}
                            </button>
                          )}
                          {file.restorable && (
                            <button
                              type="button"
                              onClick={() => openConfirm(file.name)}
                              disabled={!isRestoreEnabled(file.name, file.restorable)}
                              title={isRestoreEnabled(file.name, file.restorable) ? 'Restaurar este backup' : 'Valide o backup antes de restaurar'}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Restaurar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadBackup(file.name)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.5)]"
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.3)] border border-dashed border-[var(--crm-border)] text-center text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
            {loading ? 'Consultando backups no servidor...' : 'Nenhum backup encontrado no diretório de backups.'}
          </div>
        )}

        {restoring && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
            Restaurando <strong>{restoring}</strong>... O sistema ficará indisponível por alguns instantes durante o reinício do container.
          </div>
        )}

        {restoreResult && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs space-y-2">
            <div className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">Resultado da restauração</div>
            <div className="text-[rgb(var(--crm-ink-rgb)_/_1)]">
              {restoreResult.database?.tableCount || 0} tabela(s) · {restoreResult.database?.totalRows || 0} registro(s) restaurados.
            </div>
            {restoreResult.safety && (
              <div className="text-[rgb(var(--crm-muted-rgb)_/_1)]">
                Backup de segurança gerado: {restoreResult.safety.name} ({restoreResult.safety.method})
              </div>
            )}
            {restoreResult.database?.tables?.length > 0 && (
              <div className="text-[rgb(var(--crm-muted-rgb)_/_1)] truncate">
                {restoreResult.database.tables.map((t) => `${t.tableName}: ${t.restoredRows}`).join(' · ')}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
          Apenas usuários Admin e Master podem restaurar. Antes de restaurar, valide o backup. A operação cria um backup de segurança automático e reinicia o container ao final.
        </p>
      </div>

      {/* Log de restauração */}
      <div className="crm-card rounded-2xl p-6 border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-2">
            <span>📋</span> Log da última restauração
          </h3>
          <button
            type="button"
            onClick={loadLog}
            disabled={logLoading}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)] disabled:opacity-50"
          >
            {logLoading ? 'Atualizando...' : 'Atualizar log'}
          </button>
        </div>

        {logEntries.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--crm-border)] max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
              <thead className="bg-[rgb(var(--crm-surface-rgb)_/_0.8)] text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase tracking-wider font-semibold border-b border-[var(--crm-border)] sticky top-0">
                <tr>
                  <th className="px-4 py-2">Data/Hora</th>
                  <th className="px-4 py-2">Evento</th>
                  <th className="px-4 py-2">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--crm-border)]">
                {[...logEntries].reverse().map((entry, idx) => (
                  <tr key={idx} className="hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)]">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(entry.at)}</td>
                    <td className="px-4 py-2">
                      <span className={`font-semibold ${entry.event === 'restore_error' ? 'text-red-600 dark:text-red-400' : entry.event === 'restore_success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[rgb(var(--crm-ink-rgb)_/_1)]'}`}>
                        {eventLabel(entry.event)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[rgb(var(--crm-muted-rgb)_/_1)] break-all">
                      {entry.source || entry.name || entry.error || entry.method || entry.status || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_0.3)] border border-dashed border-[var(--crm-border)] text-center text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
            Nenhuma restauração registrada ainda.
          </div>
        )}
      </div>

      {/* Modal de confirmação dupla */}
      {confirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="crm-card rounded-2xl p-6 border border-red-300/60 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-red-700 dark:text-red-300">Confirmar Restauração</h3>
            </div>

            <div className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] space-y-2">
              <p>
                Você está prestes a restaurar o backup <strong className="font-mono text-cyan-700 dark:text-cyan-300">{confirm.filename}</strong>.
              </p>
              <p className="text-red-700 dark:text-red-300 font-medium">
                Esta ação substitui todas as tabelas do banco de dados pelos dados do backup. É irreversível.
              </p>
              <ul className="list-disc list-inside text-[rgb(var(--crm-muted-rgb)_/_1)] space-y-0.5 text-xs">
                <li>Um backup de segurança automático será gerado antes da substituição.</li>
                <li>O container será reiniciado ao final da restauração.</li>
                <li>Sua sessão será encerrada — faça login novamente após o reinício.</li>
              </ul>
            </div>

            {(() => {
              const v = confirm.filename ? validations[confirm.filename] : null;
              if (v && v.tableSummary) {
                return (
                  <div className="rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_0.6)] border border-[var(--crm-border)] p-3 text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    <div className="font-semibold mb-1">Validação</div>
                    <div>{v.tableSummary.tableCount} tabela(s) · {(v.tableSummary.totalRows || 0).toLocaleString('pt-BR')} registro(s) · {v.uploadsCount || 0} arquivo(s) de upload</div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                Para confirmar, digite exatamente: <span className="font-mono font-bold text-red-700 dark:text-red-300">{CONFIRMATION_PHRASE}</span>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] focus:outline-none focus:border-red-400"
                placeholder={CONFIRMATION_PHRASE}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={Boolean(restoring)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.5)] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={performRestore}
                disabled={confirmText.trim() !== CONFIRMATION_PHRASE || Boolean(restoring)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {restoring ? 'Restaurando...' : 'Confirmar Restauração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
