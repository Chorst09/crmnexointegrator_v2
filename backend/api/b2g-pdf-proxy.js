const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../lib/auth');

// Domínios autorizados para download
const ALLOWED_DOMAINS = [
  'pncp.gov.br',
  'comprasnet.gov.br',
  'portaldatransparencia.gov.br',
  'imprensanacional.gov.br',
  'curitiba.pr.gov.br',
  'transparencia.curitiba.pr.gov.br',
  'compras.gov.br',
  'comprasgovernamentais.gov.br'
];

/**
 * GET /api/b2g/pdf/download
 * Proxy para download de PDFs de editais com validação de segurança
 */
router.get('/download', authenticateToken, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Parâmetro "url" é obrigatório' });
  }

  try {
    // Validar URL
    const parsedUrl = new URL(url);
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      parsedUrl.hostname.endsWith(domain)
    );

    if (!isAllowed) {
      console.warn(`❌ Tentativa de download de domínio não autorizado: ${parsedUrl.hostname}`);
      return res.status(403).json({
        error: 'Domínio não autorizado para download',
        domain: parsedUrl.hostname
      });
    }

    console.log(`📥 Iniciando download de: ${url}`);

    // Fazer requisição ao documento
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NexosCRM/2.0 (+https://nexos.chorstconsult.com.br)',
        'Accept': 'application/pdf,application/octet-stream,*/*'
      },
      timeout: 60000 // 60 segundos
    });

    if (!response.ok) {
      console.error(`❌ Erro ao baixar documento: HTTP ${response.status}`);
      return res.status(response.status).json({
        error: `Erro ao baixar documento: HTTP ${response.status}`,
        url
      });
    }

    // Extrair nome do arquivo
    let filename = 'documento.pdf';
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    } else {
      // Tentar extrair da URL
      const urlFilename = url.split('/').pop().split('?')[0];
      if (urlFilename && /\.(pdf|PDF)$/.test(urlFilename)) {
        filename = urlFilename;
      }
    }

    // Sanitizar nome do arquivo
    filename = filename.replace(/[^a-zA-Z0-9.-_]/g, '_');

    // Configurar headers de resposta
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const contentLength = response.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Stream do PDF para o cliente
    response.body.pipe(res);

    console.log(`✅ Download iniciado: ${filename} (${contentLength || 'tamanho desconhecido'})`);

  } catch (error) {
    console.error('❌ Erro no proxy de PDF:', error);

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Timeout ao tentar baixar o documento. Tente novamente.'
      });
    }

    res.status(500).json({
      error: 'Erro ao processar download do documento',
      details: error.message
    });
  }
});

/**
 * GET /api/b2g/pdf/info
 * Retorna informações sobre um PDF sem fazer download
 */
router.get('/info', authenticateToken, async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Parâmetro "url" é obrigatório' });
  }

  try {
    const parsedUrl = new URL(url);
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      parsedUrl.hostname.endsWith(domain)
    );

    if (!isAllowed) {
      return res.status(403).json({ error: 'Domínio não autorizado' });
    }

    // Fazer apenas HEAD request
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'NexosCRM/2.0'
      },
      timeout: 10000
    });

    res.json({
      available: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      lastModified: response.headers.get('last-modified')
    });

  } catch (error) {
    res.status(500).json({
      error: 'Erro ao verificar documento',
      available: false
    });
  }
});

module.exports = router;
