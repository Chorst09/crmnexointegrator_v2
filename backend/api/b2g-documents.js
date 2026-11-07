'use strict';

// Rotas públicas de arquivos PNCP. Este módulo não carrega Prisma, autenticação
// ou geradores de resumo; funciona também na imagem isolada do backend Docker.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const fetch = global.fetch;
const nextUA = () => 'Mozilla/5.0 (compatible; NexosCRM/2.0)';

// ── Cache de arquivos em memória ──────────────────────────────────────────────
const arquivosCache = new Map();
const ARQUIVOS_CACHE_TTL = 15 * 60 * 1000;

// ── Helper compartilhado para obter lista de arquivos reais e canais oficiais do certame ──
const getArquivosForEdital = async (cnpj, ano, seq) => {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  const cleanAno = Number(ano);
  const cleanSeq = Number(seq);

  if (!/^\d{14}$/.test(cleanCnpj) || !Number.isInteger(cleanAno) || cleanAno < 2000 || cleanAno > 9999 || !Number.isSafeInteger(cleanSeq) || cleanSeq <= 0) {
    throw Object.assign(new Error('CNPJ, ano ou sequencial PNCP inválido.'), { status: 400 });
  }

  const cacheKey = `arquivos_${cleanCnpj}_${cleanAno}_${cleanSeq}`;
  const now = Date.now();
  const cached = arquivosCache.get(cacheKey);
  if (cached && (now - cached.timestamp < ARQUIVOS_CACHE_TTL) && Array.isArray(cached.data) && cached.data.length > 0 && cached.hasRealFiles) {
    return cached.data;
  }

  let filesList = [];
  let pncpError = null;

  // 1. Tenta consultar anexos diretos no repositório de arquivos do PNCP com prioridade
  try {
    const pUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/arquivos`;
    const response = await fetch(pUrl, {
      headers: { Accept: 'application/json', 'User-Agent': nextUA() },
      signal: AbortSignal.timeout(10000)
    });
    if (response.status !== 204 && response.ok) {
      const pData = await response.json();
      if (!Array.isArray(pData)) throw new Error('PNCP retornou uma lista de anexos inválida.');
      if (pData.length > 0) {
        pData.filter(arq => arq.statusAtivo !== false).forEach(arq => {
          const originalUrl = arq.url || arq.uri;
          const docSeq = Number(arq.sequencialDocumento || originalUrl?.match(/\/arquivos\/(\d+)(?:[?#]|$)/)?.[1]) || null;
          const fileUrl = originalUrl || (docSeq ? `https://pncp.gov.br/pncp-api/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}/arquivos/${docSeq}` : null);
          if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) return;
          filesList.push({
            sequencialDocumento: docSeq,
            titulo: arq.titulo || `Anexo_Oficial_${docSeq || filesList.length + 1}`,
            tipoDocumentoNome: arq.tipoDocumentoNome || arq.tipoDocumentoDescricao || 'Anexo PNCP',
            url: fileUrl,
            uri: fileUrl,
            tamanhoArquivo: arq.tamanhoArquivo || null,
            dataPublicacaoPncp: arq.dataPublicacaoPncp,
            origem: 'PNCP_OFICIAL'
          });
        });
      }
    } else if (response.status !== 204 && response.status !== 404) {
      throw new Error(`PNCP HTTP ${response.status} ao consultar anexos.`);
    }
  } catch (err) {
    pncpError = err;
    console.warn(`[getArquivosForEdital] Consulta PNCP arquivos (${cleanCnpj}/${cleanAno}/${cleanSeq}):`, err.message);
  }

  // Se encontrou arquivos oficiais no PNCP, armazena no cache e retorna imediatamente!
  if (filesList.length > 0) {
    arquivosCache.set(cacheKey, { data: filesList, timestamp: now, hasRealFiles: true });
    return filesList;
  }

  // 2. Se o PNCP não tem arquivos diretos anexados, consulta os metadados da contratação (linkSistemaOrigem)
  let compraInfo = null;
  try {
    const cUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cleanCnpj}/compras/${cleanAno}/${cleanSeq}`;
    const cRes = await fetch(cUrl, {
      headers: { Accept: 'application/json', 'User-Agent': nextUA() },
      signal: AbortSignal.timeout(5000)
    });
    if (cRes.ok) {
      compraInfo = await cRes.json();
    }
  } catch (e) {
    console.warn(`[getArquivosForEdital] Aviso ao consultar compraInfo (${cleanCnpj}/${cleanAno}/${cleanSeq}):`, e.message);
  }

  // 3. Extração de arquivos reais do Portal de Compras Públicas se for o sistema de origem
  if (compraInfo?.linkSistemaOrigem) {
    const lso = compraInfo.linkSistemaOrigem.toLowerCase();
    if (lso.includes('portaldecompraspublicas.com.br')) {
      try {
        const pcpRes = await fetch(compraInfo.linkSistemaOrigem, {
          headers: { 'User-Agent': nextUA(), Accept: 'text/html' },
          signal: AbortSignal.timeout(4000)
        });
        if (pcpRes.ok) {
          const html = await pcpRes.text();
          const regex = /"nome":"([^"]+)","url":"([^"]+)","tipo":"([^"]+)"/g;
          let m;
          let docIdx = 1;
          while ((m = regex.exec(html)) !== null) {
            const nome = m[1].replace(/\\u002F/g, '/');
            const fileUrl = m[2].replace(/\\u002F/g, '/').replace(/\\\\u002F/g, '/');
            const tipo = m[3] || 'Edital e Anexos';
            filesList.push({
              sequencialDocumento: docIdx++,
              titulo: nome,
              tipoDocumentoNome: tipo,
              url: fileUrl,
              uri: fileUrl,
              tamanhoArquivo: null,
              dataPublicacaoPncp: compraInfo.dataPublicacaoPncp,
              origem: 'SISTEMA_ORIGEM',
              descricao: `Documento autêntico baixado diretamente do Portal de Compras Públicas (${tipo}).`
            });
          }
        }
      } catch (errPcp) {
        console.warn('[getArquivosForEdital] Aviso ao consultar anexos no Portal de Compras Públicas:', errPcp.message);
      }
    }
  }

  if (filesList.length > 0) {
    arquivosCache.set(cacheKey, { data: filesList, timestamp: now, hasRealFiles: true });
    return filesList;
  }

  if (pncpError) throw Object.assign(new Error('Não foi possível consultar os anexos no PNCP.'), { status: 502, cause: pncpError });
  return [];
};

// ── GET /arquivos/:cnpj/:ano/:seq — arquivos de uma licitação ─────────────────
router.get(['/arquivos/:cnpj/:ano/:seq', '/arquivos/:cnpj/:ano/:seq/'], async (req, res) => {
  const { cnpj, ano, seq } = req.params;
  try {
    const list = await getArquivosForEdital(cnpj, ano, seq);
    res.json(list);
  } catch (err) {
    console.error('Erro /arquivos/:cnpj/:ano/:seq:', err);
    res.status(err.status || 502).json({ error: err.message });
  }
});

// ── GET /pncp-arquivos — arquivos via query string ───────────────────────────
router.get(['/pncp-arquivos', '/pncp-arquivos/'], async (req, res) => {
  const cnpj = req.query.cnpj;
  const ano = req.query.ano;
  const seq = req.query.sequencial || req.query.seq;
  if (!cnpj || !ano || !seq) {
    return res.status(400).json({ error: 'Parâmetros cnpj, ano e sequencial são obrigatórios' });
  }
  try {
    const list = await getArquivosForEdital(cnpj, ano, seq);
    res.json(list);
  } catch (err) {
    console.error('Erro /pncp-arquivos:', err);
    res.status(err.status || 502).json({ error: err.message });
  }
});

const fs = require('fs');
const path = require('path');
const { pipeline: streamPipeline } = require('stream/promises');
const { Readable: NodeReadable } = require('stream');

// Diretório para armazenar anexos baixados (dentro do projeto, fora do webroot)
const ATTACHMENTS_DIR = process.env.EDITAIS_ATTACHMENTS_DIR || path.resolve(__dirname, '../attachments/editais');
if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

/**
 * downloadAndPersistFile — Baixa um arquivo remoto e persiste em disco.
 *
 * @param {string} remoteUrl   — URL original do arquivo (PNCP ou portal)
 * @param {string} localPath   — Caminho absoluto onde salvar
 * @param {number} [timeoutMs] — Timeout em ms (padrão 30s)
 * @returns {{ size: number, contentType: string }} — tamanho e MIME do arquivo salvo
 */
async function downloadAndPersistFile(remoteUrl, localPath, timeoutMs = 30000) {
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  const temporaryPath = `${localPath}.${crypto.randomUUID()}.tmp`;

  try {
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': nextUA(), Accept: '*/*' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${remoteUrl}`);

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html|application\/json/i.test(contentType)) throw new Error('O PNCP retornou uma página ou erro em vez do arquivo.');

    // Usa stream nativo para não manter tudo na memória
    if (res.body) {
      const writeStream = fs.createWriteStream(temporaryPath);
      await streamPipeline(NodeReadable.fromWeb(res.body), writeStream, { signal: controller.signal });
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(temporaryPath, buf);
    }

    const { size } = fs.statSync(temporaryPath);
    if (!size) throw new Error('O arquivo retornado pelo PNCP está vazio.');
    fs.renameSync(temporaryPath, localPath);
    return { size, contentType };
  } catch (err) {
    // Remove arquivo parcialmente escrito
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * resolveLocalPath — Gera caminho local padronizado para um arquivo de edital.
 * Formato: attachments/editais/{cnpj}/{ano}/{seq}/{docSeq}.{ext}
 */
function resolveLocalPath(cnpj, ano, seq, docSeq, filename) {
  const safeFilename = String(filename || `doc_${docSeq}`)
    .replace(/[^\w.\-]/g, '_')
    .replace(/_{2,}/g, '_');
  return path.join(ATTACHMENTS_DIR, String(cnpj), String(ano), String(seq), `${docSeq}_${safeFilename}`);
}

function setAttachmentFilename(res, filename) {
  const clean = String(filename).replace(/["\/\\\r\n]/g, '_');
  const ascii = clean.replace(/[^\x20-\x7E]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`);
}

// ── GET /arquivos/:cnpj/:ano/:seq/download/:docSeq — download com persistência ──
//
// Este endpoint:
//   1. Consulta o arquivo pelo índice docSeq via getArquivosForEdital
//   2. Se já existe no disco, serve diretamente (cache)
//   3. Caso contrário, baixa via downloadAndPersistFile e serve o binário
//
router.get('/arquivos/:cnpj/:ano/:seq/download/:docSeq', async (req, res) => {
  const { cnpj, ano, seq, docSeq } = req.params;
  const cleanCnpj = String(cnpj).replace(/\D/g, '');
  const cleanAno = Number(ano);
  const cleanSeq = Number(seq);
  const cleanDocSeq = Number(docSeq);

  if (!/^\d{14}$/.test(cleanCnpj) || !Number.isInteger(cleanAno) || cleanAno < 2000 || cleanAno > 9999 || !Number.isSafeInteger(cleanSeq) || cleanSeq <= 0 || !Number.isSafeInteger(cleanDocSeq) || cleanDocSeq <= 0) {
    return res.status(400).json({ error: 'CNPJ, ano, sequencial da compra ou do documento inválido.' });
  }

  try {
    // 1. Obtém a lista de arquivos reais do PNCP
    const arquivos = await getArquivosForEdital(cleanCnpj, cleanAno, cleanSeq);
    const arq = arquivos.find(a => Number(a.sequencialDocumento) === cleanDocSeq);

    if (!arq) {
      return res.status(404).json({ error: 'Arquivo não encontrado para este edital.' });
    }

    const fileUrl = arq.url || arq.uri;
    if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
      return res.status(422).json({ error: 'URL do arquivo inválida ou ausente.', url: fileUrl });
    }

    const localPath = resolveLocalPath(cleanCnpj, cleanAno, cleanSeq, cleanDocSeq, arq.titulo);

    // 2. Serve do cache se já existe no disco
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath).toLowerCase();
      const mimeMap = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.zip': 'application/zip' };
      const mime = mimeMap[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      setAttachmentFilename(res, arq.titulo);
      res.setHeader('X-Served-From', 'disk-cache');
      return fs.createReadStream(localPath).pipe(res);
    }

    // 3. Baixa, persiste e serve
    console.log(`[download-persist] Baixando ${fileUrl} → ${localPath}`);
    const { size, contentType } = await downloadAndPersistFile(fileUrl, localPath);
    console.log(`[download-persist] Salvo: ${localPath} (${size} bytes, ${contentType})`);

    res.setHeader('Content-Type', contentType);
    setAttachmentFilename(res, arq.titulo);
    res.setHeader('Content-Length', String(size));
    res.setHeader('X-Served-From', 'fresh-download');
    res.setHeader('X-Original-Url', fileUrl);
    return fs.createReadStream(localPath).pipe(res);

  } catch (err) {
    console.error('[download-persist] Erro:', err.message);
    // Fallback seguro: redireciona para a URL original
    try {
      const arquivos = await getArquivosForEdital(cleanCnpj, cleanAno, cleanSeq);
      const arq = arquivos.find(a => Number(a.sequencialDocumento) === cleanDocSeq);
      if (arq?.url) return res.redirect(302, arq.url);
    } catch (_) {}
    return res.status(502).json({ error: 'Erro ao baixar o arquivo.', detail: err.message });
  }
});


// Portais oficiais conhecidos: não disponibiliza um proxy para URLs arbitrárias.
const allowedDownloadHosts = [
  'pncp.gov.br', 'comprasnet.gov.br', 'compras.gov.br',
  'comprasgovernamentais.gov.br', 'portaldatransparencia.gov.br',
  'curitiba.pr.gov.br', 'portaldecompraspublicas.com.br',
  'bll.org.br', 'bllcompras.com', 'licitacoes-e.com.br'
];
function allowedDownloadUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && allowedDownloadHosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

router.get('/proxy-download', async (req, res) => {
  const fileUrl = String(req.query.url || '');
  if (!allowedDownloadUrl(fileUrl)) return res.status(422).json({ error: 'Use Abrir para acessar este arquivo no portal de origem.' });
  try {
    let currentUrl = fileUrl;
    let response;
    const signal = AbortSignal.timeout(60000);
    for (let redirects = 0; redirects <= 5; redirects++) {
      response = await fetch(currentUrl, { headers: { 'User-Agent': nextUA(), Accept: '*/*' }, redirect: 'manual', signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirecionamento sem destino.');
      const destination = new URL(location, currentUrl).href;
      if (!allowedDownloadUrl(destination)) throw new Error('Redirecionamento fora dos portais oficiais.');
      currentUrl = destination;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html|application\/json/i.test(contentType)) throw new Error('A URL retornou uma página em vez do arquivo.');
    const originalName = response.headers.get('content-disposition')?.match(/filename\s*=\s*"([^"]+)"/i)?.[1];
    setAttachmentFilename(res, originalName || req.query.filename || 'documento');
    res.setHeader('Content-Type', contentType);
    await streamPipeline(NodeReadable.fromWeb(response.body), res, { signal });
  } catch (error) {
    if (!res.headersSent) res.status(502).json({ error: 'Não foi possível baixar o arquivo original.' });
    else res.destroy(error);
  }
});

module.exports = router;
