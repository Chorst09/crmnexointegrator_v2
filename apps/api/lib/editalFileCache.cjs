'use strict';
const fs = require('node:fs');
const path = require('node:path');

function fileType(buffer) {
  if (buffer.subarray(0, 5).equals(Buffer.from('%PDF-')) && buffer.subarray(-2048).includes(Buffer.from('%%EOF'))) return 'application/pdf';
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return 'application/zip';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))) return 'application/msword';
  return null;
}

function inspectFile(localPath) {
  const size = fs.statSync(localPath).size;
  if (!size || size > 100 * 1024 * 1024) return null;
  const fd = fs.openSync(localPath, 'r');
  try {
    const head = Buffer.alloc(Math.min(1024, size));
    const tail = Buffer.alloc(Math.min(2048, size));
    fs.readSync(fd, head, 0, head.length, 0);
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    return fileType(Buffer.concat([head, tail]));
  } finally { fs.closeSync(fd); }
}

function createFileCache(rootDir) {
  const directory = ({ cnpj, ano, seq }) => {
    if (!/^\d{14}$/.test(String(cnpj)) || !/^\d{4}$/.test(String(ano)) || !/^\d+$/.test(String(seq)) || Number(seq) <= 0) return null;
    return path.join(rootDir, String(cnpj), String(ano), String(Number(seq)));
  };
  const list = reference => {
    const dir = directory(reference);
    if (!dir || !fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(name => !name.startsWith('.') && !name.endsWith('.json')).flatMap(name => {
      const localPath = path.join(dir, name);
      // Arquivos de captcha/HTML e downloads truncados nunca aparecem como PDF.
      if (!fs.lstatSync(localPath).isFile()) return [];
      const size = fs.statSync(localPath).size;
      if (!size || size > 100 * 1024 * 1024) return [];
      const contentType = inspectFile(localPath);
      if (!contentType) return [];
      let metadata = {};
      try { metadata = JSON.parse(fs.readFileSync(localPath + '.json', 'utf8')); } catch { /* Cache anterior sem metadados. */ }
      const url = `/api/b2g-licitacoes/documentos/cache/${reference.cnpj}/${reference.ano}/${Number(reference.seq)}/${encodeURIComponent(name)}`;
      return [{ ...metadata, titulo: metadata.titulo || name.replace(/^\d+_/, ''), sequencialDocumento: metadata.sequencialDocumento || Number(name.match(/^(\d+)_/)?.[1]) || null, origemOriginal: metadata.origem, origem: 'CACHE_LOCAL', url, uri: url, contentType, tamanhoArquivo: size, localPath, filename: name }];
    });
  };
  const metadata = (localPath, doc) => {
    if (!localPath.startsWith(path.resolve(rootDir) + path.sep)) throw new Error('Diretório de cache inválido.');
    const temporary = localPath + '.json.tmp';
    fs.writeFileSync(temporary, JSON.stringify({ titulo: doc.titulo, origem: doc.origem, sequencialDocumento: doc.sequencialDocumento, urlOriginal: doc.url || doc.uri, preservadoEm: new Date().toISOString() }));
    fs.renameSync(temporary, localPath + '.json');
  };
  return { list, metadata };
}
module.exports = { createFileCache, fileType, inspectFile };
