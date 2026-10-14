import { resolvePncpCompra } from './pncpDocuments';

export interface EditalArquivo {
  url: string;
  uri?: string;
  titulo: string;
  tipoDocumentoNome?: string;
  origem?: string;
  sequencialDocumento?: number;
}

const isInternalFile = (url: string) => url.startsWith('/api/b2g-licitacoes/arquivos/')
  || url.startsWith('/api/b2g-licitacoes/documentos/cache/');

export function getPncpIdentifiers(licitacao: unknown) {
  const identifiers = resolvePncpCompra(licitacao);
  return identifiers ? { cnpj: identifiers.cnpj, ano: identifiers.ano, seq: identifiers.sequencial } : null;
}

export function normalizeArquivo(value: any): EditalArquivo | null {
  const url = String(value?.url || value?.uri || '').trim();
  if (!/^https?:\/\//i.test(url) && !isInternalFile(url)) return null;
  const sequencial = Number(value.sequencialDocumento || url.match(/\/arquivos\/(\d+)(?:[?#]|$)/)?.[1]);
  return {
    url,
    uri: url,
    titulo: String(value.titulo || value.title || value.nome || 'Documento oficial'),
    tipoDocumentoNome: value.tipoDocumentoNome || value.tipoDocumentoDescricao || value.tipo,
    origem: value.origem,
    ...(Number.isSafeInteger(sequencial) && sequencial > 0 ? { sequencialDocumento: sequencial } : {})
  };
}

export function getInitialArquivos(licitacao: any): EditalArquivo[] {
  const values = Array.isArray(licitacao?.documentos) ? [...licitacao.documentos] : [];
  if (licitacao?.pdfUrl) values.push({ url: licitacao.pdfUrl, titulo: 'Edital.pdf' });
  const files = values.map(normalizeArquivo).filter((value): value is EditalArquivo => Boolean(value));
  const unique = new Map<string, EditalArquivo>();
  files.forEach(file => { if (!unique.has(file.url)) unique.set(file.url, file); });
  return [...unique.values()];
}

export function getArquivoDownloadEndpoint(licitacao: unknown, arquivo: EditalArquivo) {
  if (isInternalFile(arquivo.url)) return arquivo.url;
  const identifiers = getPncpIdentifiers(licitacao);
  let official = arquivo.origem === 'PNCP_OFICIAL';
  try { official ||= new URL(arquivo.url).hostname === 'pncp.gov.br'; } catch { /* URL já validada na normalização. */ }
  if (identifiers && official && arquivo.sequencialDocumento) {
    return `/api/b2g-licitacoes/arquivos/${identifiers.cnpj}/${identifiers.ano}/${identifiers.seq}/download/${arquivo.sequencialDocumento}`;
  }
  const params = new URLSearchParams({ url: arquivo.url, filename: arquivo.titulo });
  return `/api/b2g-licitacoes/proxy-download?${params}`;
}

export function getDownloadFilename(disposition: string | null, title: string) {
  const encoded = disposition?.match(/filename\*\s*=\s*(?:"?)([^;\r\n"]+)/i)?.[1];
  let filename;
  if (encoded) {
    try { filename = decodeURIComponent(encoded.trim().replace(/^[^']*'[^']*'/, '')); } catch { /* Usa o nome simples. */ }
  }
  filename ||= disposition?.match(/filename\s*=\s*(?:"([^"]+)"|([^;\r\n]+))/i)?.slice(1).find(Boolean)?.trim();
  return String(filename || title || 'Documento').normalize('NFC')
    .replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '').slice(0, 180) || 'Documento';
}
