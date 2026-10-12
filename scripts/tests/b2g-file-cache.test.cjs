'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { jsPDF } = require('jspdf');
const { createFileCache, fileType } = require('../../apps/api/lib/editalFileCache.cjs');

test('valid PDFs remain discoverable with no dependency on the PNCP service', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2g-cache-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const reference = { cnpj: '60747318000162', ano: '2026', seq: '836' };
  const cache = createFileCache(dir);
  const doc = new jsPDF(); doc.text('Documento de teste do cache', 20, 20);
  const pdf = Buffer.from(doc.output('arraybuffer'));
  const local = path.join(dir, reference.cnpj, reference.ano, reference.seq, '1_Edital.pdf');
  fs.mkdirSync(path.dirname(local), { recursive: true }); fs.writeFileSync(local, pdf);
  cache.metadata(local, { titulo: 'Edital preservado', origem: 'PNCP_OFICIAL', sequencialDocumento: 1, url: 'https://pncp.gov.br/arquivo' });
  const files = cache.list(reference);
  assert.equal(files.length, 1);
  assert.equal(files[0].origem, 'CACHE_LOCAL');
  assert.equal(files[0].sequencialDocumento, 1);
  assert.equal(files[0].contentType, 'application/pdf');
  assert.ok(files[0].url.startsWith('/api/b2g-licitacoes/documentos/cache/'));
  assert.deepEqual(fs.readFileSync(files[0].localPath), pdf);
  assert.deepEqual(cache.list({ ...reference, cnpj: '../' }), []);
});
test('captcha HTML, empty and truncated PDFs are excluded from the download catalog', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2g-cache-invalid-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const reference = { cnpj: '60747318000162', ano: '2026', seq: '836' };
  const destination = path.join(dir, reference.cnpj, reference.ano, reference.seq);
  fs.mkdirSync(destination, { recursive: true });
  for (const [name, body] of Object.entries({ '1_Captcha.pdf': '<html>Captcha</html>', '2_Empty.pdf': '', '3_Truncated.pdf': '%PDF-1.7\nparcial' })) fs.writeFileSync(path.join(destination, name), body);
  assert.deepEqual(createFileCache(dir).list(reference), []);
  assert.equal(fileType(Buffer.from('<html>Captcha</html>')), null);
});
test('failed HTML download never replaces a previously preserved PDF', async t => {
  const vm = require('node:vm');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2g-download-atomic-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, 'Edital.pdf');
  const pdf = new jsPDF(); pdf.text('PDF anterior', 20, 20);
  const previous = Buffer.from(pdf.output('arraybuffer')); fs.writeFileSync(target, previous);
  const source = fs.readFileSync(path.resolve(__dirname, '../../apps/api/api/b2g-licitacoes.cjs'), 'utf8');
  const start = source.indexOf('async function downloadAndPersistFile(');
  const end = source.indexOf('\n/**\n * resolveLocalPath', start);
  const ctx = { fs, path, require, AbortController, setTimeout, clearTimeout, Buffer,
    inspectFile: require('../../apps/api/lib/editalFileCache.cjs').inspectFile,
    nextUA: () => 'Test', NodeReadable: require('node:stream').Readable,
    streamPipeline: require('node:stream/promises').pipeline,
    fetch: async () => new Response('<html>CAPTCHA</html>', { headers: { 'content-type': 'application/pdf' } }) };
  vm.createContext(ctx); vm.runInContext(source.slice(start, end)+'\nglobalThis.downloadFile=downloadAndPersistFile;',ctx);
  await assert.rejects(ctx.downloadFile('https://portal.gov.br/edital.pdf', target), /documento válido/);
  assert.deepEqual(fs.readFileSync(target), previous);
  assert.deepEqual(fs.readdirSync(dir), ['Edital.pdf']);
});
