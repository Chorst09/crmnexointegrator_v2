import { useEffect, useState } from 'react';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import AttachmentList from './AttachmentList';

// Company screens aggregate the opportunity-owned files without a second upload flow.
export default function CompanyDocuments({ companyId, documentType, onOpenOpportunity, onManage }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const contracts = documentType === 'CONTRACT';
  const label = contracts ? 'Contratos das oportunidades' : 'Documentos das oportunidades';
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setDocuments([]);
    fetch(buildApiUrl(`/companies/${encodeURIComponent(companyId)}/documents?documentType=${documentType}`), { headers: getAuthHeaders(), signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Não foi possível carregar ${contracts ? 'os contratos' : 'os documentos'}.`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Resposta inválida ao consultar os arquivos.');
        if (!controller.signal.aborted) setDocuments(data);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyId, documentType, reload]);
  return <section aria-label={label} className="crm-panel-muted p-4 space-y-4">
    <div className="flex flex-wrap justify-between gap-3">
      <div><h4 className="text-sm font-bold text-[var(--crm-ink)]">{label}</h4><p className="text-xs text-[var(--crm-muted)] mt-1">Arquivos anexados nas oportunidades desta empresa, com a origem indicada ao lado.</p></div>
      {onManage && <button type="button" onClick={onManage} className="crm-btn crm-btn-secondary text-xs">Abrir oportunidades</button>}
    </div>
    {loading && <p role="status" className="text-sm text-[var(--crm-muted)]">Carregando arquivos...</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error} <button type="button" onClick={() => setReload(value => value + 1)} className="underline">Tentar novamente</button></p>}
    {!loading && !error && documents.length === 0 && <p className="text-sm text-[var(--crm-muted)]">{contracts ? 'Nenhum contrato anexado às oportunidades desta empresa.' : 'Nenhum documento anexado às oportunidades desta empresa.'}</p>}
    <AttachmentList documents={documents} onOpenOpportunity={onOpenOpportunity} />
  </section>;
}
