export const getPreSalesClosure = (item) => item?.flow?.preSalesClosure || item?.calculoDetalhes?.encerramento || null;

export default function PreSalesClosureNotice({ closure, compact = false }) {
  if (!closure) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--crm-ink)]">
      <p className="font-semibold">{closure.status === 'CANCELADA' ? 'Cotação cancelada' : 'Cotação reprovada'}</p>
      <p className={`${compact ? 'line-clamp-3' : 'whitespace-pre-wrap'} mt-1 break-words`}>Motivo: {closure.motivo}</p>
      {!compact && <p className="mt-2 text-xs text-[var(--crm-muted)]">{closure.porNome} • {new Date(closure.em).toLocaleString('pt-BR')}</p>}
    </div>
  );
}
