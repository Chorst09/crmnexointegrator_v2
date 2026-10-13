'use strict';

const textOf = html => String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#(?:x2f|47);/gi, '/').replace(/\s+/g, ' ').trim();
const isDouNotice = notice => /^dou-/i.test(notice.id || '') || /Imprensa Nacional|\bDOU\b/i.test(notice.fonte || '')
  || /^https:\/\/(?:www\.)?in\.gov\.br\/web\/dou\/\-\//i.test(notice.link || '');
const douArticle = html => String(html || '').match(/<(?:div|article)[^>]*class=["'][^"']*texto-dou[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article)>/i)?.[1] || '';
const normalizedNumber = value => String(Number(String(value || '').split('/')[0]));

function douReferences(notice, article = '') {
  const content = textOf(`${notice.tituloPublicacao || ''} ${notice.resumo || notice.objeto_resumo || ''} ${article}`);
  let uasg = content.match(/\bUASG\s*[:\-–]?\s*(\d{6})\b/i)?.[1];
  const numberedUasg = content.match(/\b(preg[aã]o|concorr[eê]ncia|dispensa)(?:\s+eletr[oô]nic[oa])?\s*n[º°o.]?\s*(\d{6})\s*[-–]\s*(\d{1,5})\s*\/\s*(20\d{2})\b/i);
  if (!uasg && numberedUasg) uasg = numberedUasg[2];
  const tender = numberedUasg ? [numberedUasg[0], numberedUasg[1], numberedUasg[3], numberedUasg[4]]
    : content.match(/\b(preg[aã]o|concorr[eê]ncia|dispensa|leil[aã]o)(?:\s+(?:eletr[oô]nic[oa]|p[uú]blic[oa]))?\s*(?:n(?:[º°o.]|úmero)?\s*[.:º°-]?\s*)?(\d{1,5})\s*\/\s*(20\d{2})\b/i);
  const codes = tender && (/preg/i.test(tender[1]) ? { compras: '05', pncp: 6 } : /concorr/i.test(tender[1]) ? { compras: '03', pncp: 4 } : /dispensa/i.test(tender[1]) ? { compras: '06', pncp: 8 } : { compras: '12', pncp: 1 });
  const urls = new Set([notice.linkSistemaOrigem, notice.linkCompraPNCP].filter(Boolean));
  const raw = `${article} ${notice.resumo || ''}`.replace(/&amp;/gi, '&');
  if (/\b(?:www\.)?petronect\.com\.br\b/i.test(content)) urls.add('https://www.petronect.com.br/');
  for (const match of raw.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    try {
      const url = new URL(match[0].replace(/[.,;)]*$/, ''));
      // Páginas iniciais não identificam a contratação e não devem ser varridas.
      if (/\.(pdf|zip|docx?)(?:$|[?#])/i.test(url.href) || /\/app\/editais\/\d{14}\/\d{4}\/\d+/.test(url.pathname)
        || url.searchParams.has('compra') || /(?:licitac|edital|pregao|processo|download|anexo)/i.test(url.pathname + url.search)) urls.add(url.href);
    } catch { /* Referência incompleta no aviso. */ }
  }
  let control = notice.numeroControlePNCP || '';
  for (const value of [content, ...urls]) {
    const pncp = String(value).match(/(\d{14})-1-(\d+)\/(20\d{2})/);
    const path = String(value).match(/\/app\/editais\/(\d{14})\/(20\d{2})\/(\d+)/);
    if (pncp) control = `${pncp[1]}-1-${pncp[2].padStart(6, '0')}/${pncp[3]}`;
    else if (path) control = `${path[1]}-1-${path[3].padStart(6, '0')}/${path[2]}`;
  }
  let idCompra = uasg && tender ? `${uasg}${codes.compras}${tender[2].padStart(5, '0')}${tender[3]}` : null;
  for (const value of urls) {
    let url;
    try { url = new URL(value); } catch { continue; }
    const id = url.searchParams.get('compra');
    if (url.hostname === 'cnetmobile.estaleiro.serpro.gov.br' && /^\d{17}$/.test(id || '')
      && (!uasg || id.slice(0, 6) === uasg) && (!tender || (id.slice(6, 8) === codes.compras
        && normalizedNumber(id.slice(8, 13)) === normalizedNumber(tender[2]) && id.slice(13) === tender[3]))) {
      idCompra = id;
      uasg = id.slice(0, 6);
    }
  }
  return { uasg, numero: tender?.[2], ano: tender?.[3], modalidade: codes?.pncp, idCompra, control, links: [...urls] };
}

function createDouEnricher({ fetchImpl = global.fetch } = {}) {
  const cache = new Map();
  const json = async (url, signal) => {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  return async (notice, { article = '', signal } = {}) => {
    if (!isDouNotice(notice)) return { dados: {}, diagnosticos: [] };
    const ref = douReferences(notice, article);
    const dados = { ...(ref.uasg ? { codigoUasg: ref.uasg } : {}), ...(ref.links.length ? { origens: [...(notice.origens || []), ...ref.links.map(url => ({ id: 'dou-sistema-origem', nome: 'Sistema citado no DOU', url }))] } : {}) };
    if (!notice.linkSistemaOrigem && ref.links.includes('https://www.petronect.com.br/')) dados.linkSistemaOrigem = 'https://www.petronect.com.br/';
    if (!ref.control && !ref.idCompra) return { dados, diagnosticos: [] };
    const key = ref.control || ref.idCompra;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < (cached.patch.numeroControlePNCP ? 3600000 : 60000)) return { dados: { ...dados, ...cached.patch }, diagnosticos: cached.diagnosticos };
    const diagnosticos = [];
    let item;
    const matches = candidate => candidate && (!ref.uasg || String(candidate.unidadeOrgao?.codigoUnidade || candidate.unidadeOrgaoCodigoUnidade) === ref.uasg)
      && (!ref.numero || normalizedNumber(candidate.numeroCompra) === normalizedNumber(ref.numero))
      && (!ref.ano || String(candidate.anoCompra || candidate.anoCompraPncp) === ref.ano)
      && (!ref.modalidade || Number(candidate.modalidadeId || candidate.modalidadeIdPncp) === ref.modalidade);
    const controlRef = ref.control.match(/^(\d{14})-1-(\d+)\/(\d{4})$/);
    if (controlRef) {
      try {
        const candidate = await json(`https://pncp.gov.br/api/consulta/v1/orgaos/${controlRef[1]}/compras/${controlRef[3]}/${Number(controlRef[2])}`, signal);
        if (matches(candidate) && candidate.numeroControlePNCP === ref.control) item = candidate;
      } catch (error) { diagnosticos.push({ fonte: 'DOU → PNCP', mensagem: error.message }); }
    }
    if (!item && ref.idCompra) {
      try {
        const data = await json(`https://dadosabertos.compras.gov.br/modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id?tipo=idCompra&codigo=${ref.idCompra}`, signal);
        item = data?.resultado?.find(candidate => String(candidate.idCompra) === ref.idCompra && matches(candidate));
      } catch (error) { diagnosticos.push({ fonte: 'DOU → Compras.gov.br', mensagem: error.message }); }
    }
    // A base de dados abertos pode estar atrasada. O cadastro UASG fornece o CNPJ,
    // mas o número do edital NÃO é o sequencial PNCP: localizar e validar a compra.
    if (!item && ref.uasg && ref.numero && ref.ano) {
      try {
        const data = await json(`https://dadosabertos.compras.gov.br/modulo-uasg/1_consultarUasg?codigoUasg=${ref.uasg}&pagina=1&statusUasg=true`, signal);
        const unit = data?.resultado?.find(unit => String(unit.codigoUasg) === ref.uasg);
        const cnpj = String(unit?.cnpjCpfOrgao || '').replace(/\D/g, '').padStart(14, '0');
        if (!/^\d{14}$/.test(cnpj) || Number(cnpj) === 0) throw new Error('UASG sem CNPJ público confirmado.');
        const pub = String(notice.dataPublicacao || '').slice(0, 10);
        const date = /^\d{4}-\d{2}-\d{2}$/.test(pub) ? new Date(`${pub}T12:00:00Z`) : new Date();
        const start = new Date(date.getTime() - 14 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
        const end = new Date(date.getTime() + 1 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
        const found = [];
        for (let pagina = 1; pagina <= 3; pagina++) {
          const url = new URL('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao');
          Object.entries({ dataInicial: start, dataFinal: end, codigoModalidadeContratacao: ref.modalidade, cnpj, pagina, tamanhoPagina: 50 }).forEach(([k, v]) => url.searchParams.set(k, v));
          const result = await json(url.href, signal);
          found.push(...(result?.data || []).filter(candidate => candidate.orgaoEntidade?.cnpj === cnpj && matches(candidate)));
          if (pagina >= Number(result?.totalPaginas || 1)) break;
        }
        const unique = [...new Map(found.map(candidate => [candidate.numeroControlePNCP, candidate])).values()];
        if (unique.length === 1) item = unique[0];
        else if (unique.length > 1) diagnosticos.push({ fonte: 'DOU → PNCP', mensagem: 'Mais de uma compra corresponde ao aviso; associação automática não confirmada.' });
      } catch (error) { diagnosticos.push({ fonte: 'DOU → PNCP', mensagem: error.message }); }
    }
    const patch = {};
    if (item?.numeroControlePNCP) {
      if (!(Number(item.valorTotalEstimado) > 0) && item.orcamentoSigilosoCodigo == null) {
        const ref = item.numeroControlePNCP.match(/^(\d{14})-1-(\d+)\/(\d{4})$/);
        if (ref) try {
          const metadata = await json(`https://pncp.gov.br/api/consulta/v1/orgaos/${ref[1]}/compras/${ref[3]}/${Number(ref[2])}`, signal);
          if (metadata?.numeroControlePNCP === item.numeroControlePNCP && matches(metadata)) item = metadata;
        } catch (error) { diagnosticos.push({ fonte: 'DOU → orçamento PNCP', mensagem: error.message }); }
      }
      const control = item.numeroControlePNCP.match(/^(\d{14})-1-(\d+)\/(\d{4})$/);
      if (control) {
        const valor = Number(item.valorTotalEstimado);
        const sigiloso = item.orcamentoSigilosoCodigo != null && Number(item.orcamentoSigilosoCodigo) !== 1;
        Object.assign(patch, { numeroControlePNCP: item.numeroControlePNCP, cnpjOrgao: control[1], anoCompra: Number(control[3]), sequencialCompra: Number(control[2]),
          linkCompraPNCP: `https://pncp.gov.br/app/editais/${control[1]}/${control[3]}/${Number(control[2])}`,
          linkSistemaOrigem: item.linkSistemaOrigem || '', linkProcessoEletronico: item.linkProcessoEletronico || '',
          idCompra: item.idCompra || ref.idCompra || undefined,
          uf: item.unidadeOrgao?.ufSigla || item.unidadeOrgaoUfSigla || notice.uf || '',
          municipio: item.unidadeOrgao?.municipioNome || item.unidadeOrgaoMunicipioNome || notice.municipio || '',
          ...(!sigiloso && Number.isFinite(valor) && valor > 0 ? { valor } : {}),
          fonteValor: !sigiloso && valor > 0 ? 'PNCP — contratação vinculada ao aviso DOU' : undefined,
          ...(sigiloso ? { valor: null, orcamentoSigiloso: true, motivoValorNaoInformado: item.orcamentoSigilosoDescricao || 'Orçamento sigiloso na fonte oficial' } : {}),
          dataEncerramento: item.dataEncerramentoProposta || null,
          dataAberturaProposta: item.dataAberturaProposta || null });
      }
    }
    cache.set(key, { at: Date.now(), patch, diagnosticos });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return { dados: { ...dados, ...patch }, diagnosticos };
  };
}
module.exports = { createDouEnricher, isDouNotice, douArticle, douReferences };
