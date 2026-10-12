'use strict';
const dns = require('node:dns').promises;
const net = require('node:net');

const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&#(?:x2f|47);/gi, '/').replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
const isPrivateIp = ip => /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|::$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:|::ffff:)/i.test(ip);
const isFileUrl = url => /\.(?:pdf|zip|docx?|xlsx?|odt)(?:[?#]|$)/i.test(url);

function compraFromNotice(notice) {
  for (const value of [notice.numeroControlePNCP, notice.numero_controle_pncp, notice.id]) {
    const match = String(value || '').match(/(\d{14})-\d+-(\d+)\/(\d{4})/);
    if (match && Number(match[2]) > 0) return { cnpj: match[1], ano: match[3], seq: String(Number(match[2])) };
  }
  for (const value of [notice.pncpPageLink, notice.linkCompraPNCP, notice.link]) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/^\/app\/editais\/(\d{14})\/(\d{4})\/(\d+)\/?$/);
      if (url.hostname === 'pncp.gov.br' && match && Number(match[3]) > 0) return { cnpj: match[1], ano: match[2], seq: String(Number(match[3])) };
    } catch { /* Referência ausente. */ }
  }
  const cnpj = String(notice.orgaoEntidade?.cnpj || notice.cnpjOrgao || '').replace(/\D/g, '');
  if (cnpj.length === 14 && /^\d{4}$/.test(String(notice.anoCompra || notice.ano)) && Number(notice.sequencialCompra) > 0) {
    return { cnpj, ano: String(notice.anoCompra || notice.ano), seq: String(notice.sequencialCompra) };
  }
  return null;
}

function atasFromNotice(notice) {
  const references = [];
  for (const value of [notice.linkAtaPNCP, notice.link, notice.numeroControlePncpAta, notice.numeroControlePNCPAta, notice.id,
    ...(Array.isArray(notice.origens) ? notice.origens.map(origin => origin.url) : []),
    ...(Array.isArray(notice.atas) ? notice.atas.flatMap(ata => [ata.linkAtaPNCP, ata.numeroControlePncpAta]) : [])]) {
    const path = String(value || '').match(/\/app\/atas\/(\d{14})\/(\d{4})\/(\d+)\/(\d+)/);
    if (path && Number(path[3]) > 0 && Number(path[4]) > 0) references.push({ cnpj: path[1], ano: path[2], seq: String(Number(path[3])), ata: String(Number(path[4])) });
    const control = String(value || '').match(/(\d{14})-1-(\d+)\/(\d{4})-(\d+)/);
    if (control && Number(control[2]) > 0 && Number(control[4]) > 0) references.push({ cnpj: control[1], ano: control[3], seq: String(Number(control[2])), ata: String(Number(control[4])) });
  }
  return Array.from(new Map(references.map(ref => [`${ref.cnpj}/${ref.ano}/${ref.seq}/${ref.ata}`, ref])).values());
}
const ataFromNotice = notice => atasFromNotice(notice)[0] || null;

function extractDocuments(text, baseUrl) {
  const documents = [];
  const add = (raw, title, explicit = false) => {
    try {
      const url = new URL(decode(raw), baseUrl);
      if (!/^https?:$/.test(url.protocol)) return;
      if (!isFileUrl(url.href) && !(explicit && /download|arquivo|anexo|documento/i.test(url.href))) return;
      documents.push({ titulo: String(title || decodeURIComponent(url.pathname.split('/').pop()) || 'Documento').replace(/<[^>]*>/g, '').trim(),
        url: url.href, uri: url.href, origem: 'SISTEMA_ORIGEM', tipoDocumentoNome: /\.pdf(?:[?#]|$)/i.test(url.href) ? 'PDF' : 'Documento do sistema de origem' });
    } catch { /* Link inválido. */ }
  };
  for (const match of String(text).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    add(match[1], match[2], /edital|anexo|termo de refer|download|documento/i.test(match[2]));
  }
  for (const match of String(text).matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) add(match[1]);
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 15) return;
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
    const url = value.url || value.uri || value.documentoUri || value.urlArquivo || value.downloadUrl;
    if (url) add(url, value.titulo || value.nome || value.nomeArquivo || value.filename, true);
    Object.values(value).forEach(item => visit(item, depth + 1));
  };
  try { visit(JSON.parse(text)); } catch { /* Página HTML. */ }
  for (const match of String(text).matchAll(/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* JSON incompleto. */ }
  }
  // Portais com objetos JSON embutidos em scripts, sem depender da ordem das chaves.
  for (const match of String(text).matchAll(/["'](?:url|uri|documentoUri|urlArquivo|downloadUrl)["']\s*:\s*["']([^"']+)["']/gi)) add(match[1]);
  const unique = new Map();
  for (const doc of documents) if (!unique.has(doc.url)) unique.set(doc.url, doc);
  return Array.from(unique.values());
}

function createDocumentResolver({ getPncpFiles, getAtaFiles, fetchImpl = global.fetch, lookup = dns.lookup } = {}) {
  const assertPublic = async value => {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Endereço de origem inválido.');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local')) throw new Error('Endereço de origem não público.');
    const ips = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!ips.length || ips.some(entry => isPrivateIp(entry.address))) throw new Error('Endereço de origem não público.');
    return url.href;
  };
  const read = async (value, signal) => {
    let url = await assertPublic(value);
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetchImpl(url, { headers: { Accept: 'application/json,text/html,application/pdf,*/*', 'User-Agent': 'Mozilla/5.0 (compatible; NexosCRM/2.0)' }, redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(7000)]) });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = await assertPublic(new URL(res.headers.get('location'), url).href); continue; }
      if (!res.ok) throw new Error(`Origem HTTP ${res.status}`);
      if (res.status === 204) throw new Error(/captcha/i.test(res.headers.get('message-detail') || '') ? 'O Compras.gov exige verificação humana para baixar este edital. Acesse o sistema de origem.' : 'A fonte não retornou um arquivo.');
      const type = res.headers.get('content-type') || '';
      if (/application\/pdf|application\/(?:x-)?zip|application\/octet-stream/i.test(type)) {
        await res.body?.cancel();
        return { url, binary: true, type };
      }
      if (Number(res.headers.get('content-length')) > 3 * 1024 * 1024) throw new Error('Página de origem excede o limite de leitura.');
      const reader = res.body.getReader();
      const chunks = []; let size = 0;
      for (;;) {
        const { done, value: chunk } = await reader.read(); if (done) break;
        size += chunk.length;
        if (size > 3 * 1024 * 1024) { await reader.cancel(); throw new Error('Página de origem excede o limite de leitura.'); }
        chunks.push(Buffer.from(chunk));
      }
      return { url, text: Buffer.concat(chunks).toString('utf8'), type };
    }
    throw new Error('Origem redirecionou excessivamente.');
  };
  return async (notice, { skipPncpFiles = false } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    const documentos = [], diagnosticos = [], linksOrigem = new Set();
    const atas = atasFromNotice(notice);
    const ata = atas[0];
    const compra = compraFromNotice(notice) || ata;
    const fontesConsultadas = new Set();
    const originPromises = new Map();
    const readOrigin = async raw => {
      if (!raw || !/^https?:\/\//i.test(raw)) return;
      let url;
      try { url = new URL(raw); } catch { return; }
      if (url.hostname === 'pncp.gov.br' && !isFileUrl(raw) && !/\/arquivos\/\d+/.test(url.pathname)) return;
      if (originPromises.has(raw) || originPromises.size >= 6) return;
      linksOrigem.add(raw);
      fontesConsultadas.add(url.hostname);
      const task = (async () => {
        try {
          const result = await read(raw, controller.signal);
          if (result.binary) documentos.push({ titulo: decodeURIComponent(new URL(result.url).pathname.split('/').pop()) || 'Edital e anexos', url: result.url, uri: result.url, origem: 'SISTEMA_ORIGEM', tipoDocumentoNome: /pdf/i.test(result.type) ? 'PDF' : 'Documento oficial' });
          else {
            // O portal Compras.gov é uma SPA; seus documentos não estão no HTML.
            const compraId = url.hostname === 'cnetmobile.estaleiro.serpro.gov.br' && url.searchParams.get('compra');
            if (/^\d{17}$/.test(compraId || '')) {
              const file = await read(`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-consultas/public/v1/compras/${compraId}/edital`, controller.signal);
              if (file.binary) documentos.push({ titulo: 'Edital e anexos — Compras.gov.br', url: file.url, uri: file.url, origem: 'COMPRASGOV', tipoDocumentoNome: /pdf/i.test(file.type) ? 'PDF' : 'Edital e anexos' });
              return;
            }
            const found = extractDocuments(result.text, result.url);
            documentos.push(...found);
            if (!found.length) diagnosticos.push({ fonte: new URL(raw).hostname, mensagem: /captcha/i.test(result.text) ? 'O portal exige verificação humana. Abra o sistema de origem para acessar os arquivos.' : 'A página de origem não expôs links públicos de documentos.' });
          }
        } catch (error) { diagnosticos.push({ fonte: new URL(raw).hostname, mensagem: error.message }); }
      })();
      originPromises.set(raw, task);
      await task;
    };
    try {
      const initial = [...(Array.isArray(notice.documentos) ? notice.documentos : []), ...(Array.isArray(notice.arquivos) ? notice.arquivos : [])];
      for (const doc of initial) {
        const url = doc.url || doc.uri || doc.urlArquivo;
        if (url) { try { await assertPublic(url); documentos.push({ ...doc, url, uri: url, titulo: doc.titulo || doc.nome || 'Documento oficial', origem: doc.origem || 'SISTEMA_ORIGEM' }); } catch { /* Não publicar endereços privados. */ } }
      }
      const origins = [notice.linkSistemaOrigem, notice.linkProcessoEletronico, notice.link, notice.linkCompraPNCP, notice.linkAtaPNCP, ...(Array.isArray(notice.origens) ? notice.origens : []).map(origin => origin.url)];
      const tasks = origins.filter(Boolean).map(readOrigin);
      if (compra) {
        if (!skipPncpFiles) tasks.push((async () => {
          fontesConsultadas.add('PNCP — documentos da compra');
          try { documentos.push(...await getPncpFiles(compra.cnpj, compra.ano, compra.seq, { signal: controller.signal })); }
          catch (error) { diagnosticos.push({ fonte: 'PNCP', mensagem: error.message }); }
        })());
        tasks.push((async () => {
          try {
            fontesConsultadas.add('PNCP — API pública de consulta');
            const metadata = await read(`https://pncp.gov.br/api/consulta/v1/orgaos/${compra.cnpj}/compras/${compra.ano}/${compra.seq}`, controller.signal);
            const data = JSON.parse(metadata.text);
            await Promise.allSettled([readOrigin(data.linkSistemaOrigem), readOrigin(data.linkProcessoEletronico)]);
          } catch (error) { diagnosticos.push({ fonte: 'Metadados PNCP', mensagem: error.message }); }
        })());
      }
      if (getAtaFiles) for (const ata of atas) tasks.push((async () => {
        fontesConsultadas.add('PNCP — documentos da ata');
        try { documentos.push(...await getAtaFiles(ata, { signal: controller.signal })); }
        catch (error) { diagnosticos.push({ fonte: 'Anexos da ata', mensagem: error.message }); }
      })());
      // Recupera o identificador e a origem por uma API independente do PNCP.
      if (compra && !notice.idCompra && !notice.linkSistemaOrigem) tasks.push((async () => {
        fontesConsultadas.add('Compras.gov.br — dados abertos');
        try {
          const control = `${compra.cnpj}-1-${compra.seq.padStart(6, '0')}/${compra.ano}`;
          const result = await read(`https://dadosabertos.compras.gov.br/modulo-contratacoes/1.1_consultarContratacoes_PNCP_14133_Id?tipo=numeroControlePNCPCompra&codigo=${encodeURIComponent(control)}`, controller.signal);
          const items = JSON.parse(result.text).resultado;
          if (!Array.isArray(items)) throw new Error('Resposta de contratação inválida.');
          const item = items.find(item => item.numeroControlePNCP === control);
          if (item) {
            documentos.push(...extractDocuments(JSON.stringify(item), result.url));
            await readOrigin(item.linkSistemaOrigem || (/^\d{17}$/.test(String(item.idCompra || '')) ? `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${item.idCompra}` : ''));
          }
        } catch (error) { diagnosticos.push({ fonte: 'Compras.gov.br — dados abertos', mensagem: error.message }); }
      })());
      if (/^\d{17}$/.test(String(notice.idCompra || ''))) tasks.push(readOrigin(`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=${notice.idCompra}`));
      await Promise.allSettled(tasks);
      await Promise.allSettled(originPromises.values());
      const unique = new Map();
      for (const doc of documentos) if (!unique.has(doc.url || doc.uri)) unique.set(doc.url || doc.uri, doc);
      const checked = await Promise.allSettled(Array.from(unique.values()).slice(0, 100).map(async doc => { await assertPublic(doc.url || doc.uri); return doc; }));
      return { documentos: checked.filter(result => result.status === 'fulfilled').map(result => result.value), diagnosticos, linksOrigem: Array.from(linksOrigem), fontesConsultadas: Array.from(fontesConsultadas) };
    } finally { clearTimeout(timer); }
  };
}
module.exports = { createDocumentResolver, extractDocuments, compraFromNotice, ataFromNotice, atasFromNotice, isPrivateIp };
