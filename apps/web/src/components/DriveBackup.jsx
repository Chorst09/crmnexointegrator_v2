import { useCallback, useEffect, useState } from 'react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

export default function DriveBackup() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/admin/backup/drive/status'), { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao consultar o Drive');
      setStatus(data);
    } catch (error) { setMessage(error.message); }
  }, []);
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);
  const action = async (type, name) => {
    setBusy(true);
    try {
      const response = await fetch(buildApiUrl(`/admin/backup/drive/${type}`), {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha na operação');
      setMessage(data.message);
      await refresh();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const disabled = busy || status?.running || !status?.configured;
  return <div className="space-y-5">
    <div className="crm-card rounded-2xl p-6 border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] space-y-4">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">Google Drive · Backup completo independente</h2>
        <button type="button" onClick={refresh} className="px-4 py-2 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]">Atualizar status</button>
      </div>
      <p className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Banco doublecrm, uploads dos dois serviços, aplicação e configurações. A rotina local das 02h30 continua independente.</p>
      <div className="grid md:grid-cols-3 gap-4 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
        <div><strong>Conta</strong><p>{status?.account || 'chorstconsult@gmail.com'}</p></div>
        <div><strong>Agendamento</strong><p>Todo dia às 18h · Brasília</p><p>{status?.scheduled ? 'Agendamento instalado' : 'Agendamento não confirmado'}</p></div>
        <div><strong>Conexão</strong><p>{status?.connectionError || (status?.configured ? 'Conta configurada' : 'Aguardando autorização do Google')}</p></div>
      </div>
      <p className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Pasta privada: DOUBLECRM_BACKUP. São mantidos apenas os 3 backups mais recentes no Drive e na cópia local desta rotina. As cópias anteriores são apagadas automaticamente após um novo backup verificado.</p>
      <p className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Último envio: {status?.uploaded && status?.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Ainda não confirmado'} · {status?.running ? 'Operação em andamento' : 'Sem operação em andamento'}</p>
      {status?.overdue && <p role="alert" className="text-amber-700 dark:text-amber-300">O envio esperado desde {new Date(status.expectedBackupAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} não foi confirmado.</p>}
      {status?.scheduler && !status.scheduler.serviceActive && <p role="alert" className="text-amber-700 dark:text-amber-300">Serviço cron inativo ou indisponível para consulta.</p>}
      <button type="button" disabled={disabled} onClick={() => action('run')} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-40">Gerar e enviar backup agora</button>
      {(message || status?.error) && <p role="status" className="text-amber-700 dark:text-amber-300 whitespace-pre-wrap">{status?.error || message}</p>}
    </div>
    <div className="crm-card rounded-2xl p-6 border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] space-y-4">
      <h3 className="text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">Cópias disponíveis no Google Drive ({status?.files?.length || 0})</h3>
      <p className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">“Preparar restauração” baixa a cópia do Drive e confere o checksum. “Testar” restaura o banco em uma base temporária, sem alterar a produção. Prepare a cópia antes de testar.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] text-left"><thead><tr><th className="p-2">Arquivo</th><th className="p-2">Tamanho</th><th className="p-2">Recuperação</th></tr></thead>
        <tbody>{(status?.files || []).map(file => <tr key={file.name} className="border-t border-[var(--crm-border)]"><td className="p-2 font-mono">{file.name}</td><td className="p-2">{(file.size / 1024 / 1024).toFixed(2)} MB</td><td className="p-2 flex gap-2"><button type="button" disabled={disabled} onClick={() => action('prepare', file.name)} className="bg-cyan-50 dark:bg-cyan-800 p-2 rounded disabled:opacity-40">Preparar restauração</button><button type="button" disabled={disabled || status?.prepared !== file.name} onClick={() => action('test', file.name)} className="bg-[rgb(var(--crm-surface-rgb)_/_1)] p-2 rounded disabled:opacity-40">Testar</button></td></tr>)}</tbody>
      </table></div>
      {status?.prepared && <div className="space-y-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]"><p>Cópia preparada e verificada: {status.prepared}. Para restaurar, o administrador executa no servidor o comando abaixo. Ele cria um backup prévio e interrompe a API durante a recuperação.</p><pre className="overflow-x-auto bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-3 rounded">python3 /var/www/nexoscrm/backend/scripts/drive-backup.py restore {status.prepared} RESTAURAR_DOUBLECRM</pre></div>}
      {status?.lastRestoreTestAt && <p className="text-sm text-emerald-700 dark:text-emerald-300">Último teste de restauração: {new Date(status.lastRestoreTestAt).toLocaleString('pt-BR')} · {status.testedBackup}</p>}
      <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Em outro servidor, instale PostgreSQL 15, Node.js, PM2 e rclone e configure o acesso ao Drive antes da recuperação. As dependências Node precisam ser reinstaladas. As configurações do Apache são incluídas para recuperação pelo administrador.</p>
    </div>
  </div>;
}
