// Os números do processo e da compra no órgão não são o sequencial do PNCP.
export function resolvePncpCompra(licitacao: any): { cnpj: string; ano: string; sequencial: string } | null {
  if (!licitacao) return null;
  const identifiers = [licitacao.numeroControlePNCP, licitacao.numero_controle_pncp, licitacao.id];
  for (const value of identifiers) {
    const match = String(value || '').match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
    if (match && Number(match[2]) > 0) {
      return { cnpj: match[1], ano: match[3], sequencial: String(Number(match[2])) };
    }
  }
  const cnpj = String(licitacao.orgaoEntidade?.cnpj || licitacao.cnpjOrgao || licitacao.cnpj || '').replace(/\D/g, '');
  const ano = String(licitacao.anoCompra || licitacao.ano || '').trim();
  const sequencial = String(licitacao.sequencialCompra || '').trim();
  if (/^\d{14}$/.test(cnpj) && /^\d{4}$/.test(ano) && /^\d+$/.test(sequencial) && Number(sequencial) > 0) {
    return { cnpj, ano, sequencial: String(Number(sequencial)) };
  }
  for (const value of [licitacao.pncpPageLink, licitacao.link]) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/^\/app\/editais\/(\d{14})\/(\d{4})\/(\d+)\/?$/);
      if (url.hostname === 'pncp.gov.br' && match && Number(match[3]) > 0) {
        return { cnpj: match[1], ano: match[2], sequencial: String(Number(match[3])) };
      }
    } catch { /* Sem referência PNCP válida. */ }
  }
  return null;
}
