import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

export default function AttachmentList({ documents, onOpenOpportunity, onDelete, showOpportunity = true, disabled = false }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const run = async (document, action) => {
    if (action === 'delete' && !window.confirm(`Excluir o arquivo “${document.originalName}”?`)) return;
    setBusyId(document.id); setError('');
    try {
      if (action === 'delete') await onDelete(document);
      else {
        const response = await fetch(buildApiUrl(`/opportunities/document/${encodeURIComponent(document.id)}/download`), { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Não foi possível baixar o arquivo.');
        const url = URL.createObjectURL(await response.blob());
        const anchor = window.document.createElement('a');
        anchor.href = url; anchor.download = document.originalName; window.document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (cause) { setError(cause.message); }
    finally { setBusyId(''); }
  };
  return <div className="space-y-2">
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {showOpportunity && documents.length > 0 && <div className="hidden md:grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-3 text-xs font-bold text-[var(--crm-muted)]"><span>Arquivo</span><span>Oportunidade</span><span>Ações</span></div>}
    {documents.map(document => <div key={document.id} className={`grid grid-cols-1 ${showOpportunity ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : 'sm:grid-cols-[minmax(0,1fr)_auto]'} gap-3 rounded-xl border border-[color:var(--crm-border)] p-3`}>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--crm-ink)] break-all">{document.originalName}</div>
        <div className="text-xs text-[var(--crm-muted)] mt-1">{(document.size / 1024 / 1024).toFixed(2)} MB{document.createdAt ? ` • ${new Date(document.createdAt).toLocaleDateString('pt-BR')}` : ''}</div>
      </div>
      {showOpportunity && <div className="min-w-0 text-sm text-[var(--crm-ink)]">
        <div className="md:hidden text-xs font-semibold text-[var(--crm-muted)] mb-1">Oportunidade</div>
        {document.opportunity ? <>
          <div className="font-semibold">{document.opportunity.number || 'Oportunidade'}</div>
          <div className="break-words text-xs mt-1">{document.opportunity.projectName || document.opportunity.title}</div>
          {onOpenOpportunity && <button type="button" onClick={() => onOpenOpportunity(document.opportunity.id)} className="mt-2 text-xs font-semibold text-[var(--crm-accent)] underline">Abrir oportunidade</button>}
        </> : <span className="text-xs text-[var(--crm-muted)]">Sem oportunidade vinculada — cadastro anterior</span>}
      </div>}
      <div className="flex items-start gap-1">
        <button type="button" aria-label={`Baixar ${document.originalName}`} disabled={disabled || Boolean(busyId)} onClick={() => run(document, 'download')} className="crm-btn crm-btn-ghost px-2 py-2"><Download className="h-4 w-4" /></button>
        {onDelete && <button type="button" aria-label={`Excluir ${document.originalName}`} disabled={disabled || Boolean(busyId)} onClick={() => run(document, 'delete')} className="crm-btn crm-btn-danger px-2 py-2"><Trash2 className="h-4 w-4" /></button>}
      </div>
    </div>)}
  </div>;
}
