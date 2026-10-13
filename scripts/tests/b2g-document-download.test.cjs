'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { jsPDF } = require('jspdf');
const helper = import('../../apps/web/src/pages/licitacoes_components/documentDownload.mjs');
const pdf = () => new Blob([new jsPDF().output('arraybuffer')], { type: 'application/octet-stream' });

test('origin link sizes and years never replace the PDF extension', async () => {
  const { prepareDocumentDownload } = await helper;
  const source = pdf();
  const result = await prepareDocumentDownload(source, { title: 'Edital retificado PE 0060/2026 - serviço de monitoramento remoto 5.013kB' });
  assert.equal(result.filename, 'Edital retificado PE 0060_2026 - serviço de monitoramento remoto.pdf');
  assert.equal(result.blob.type, 'application/pdf');
  assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), Buffer.from(await source.arrayBuffer()));
  assert.equal((await prepareDocumentDownload(source, { title: 'Edital.2026' })).filename, 'Edital.2026.pdf');
});

test('official attachment filenames take precedence and RFC 5987 names are decoded', async () => {
  const { prepareDocumentDownload } = await helper;
  assert.equal((await prepareDocumentDownload(pdf(), { title: 'Edital 5.013kB', contentDisposition: 'attachment; filename="PE_0060_2026.pdf"' })).filename, 'PE_0060_2026.pdf');
  assert.equal((await prepareDocumentDownload(pdf(), { contentDisposition: "attachment; filename=edital.pdf; filename*=UTF-8''Edital%20retifica%C3%A7%C3%A3o.pdf" })).filename, 'Edital retificação.pdf');
});

test('HTML mislabeled as PDF and incomplete PDFs are rejected', async () => {
  const { prepareDocumentDownload } = await helper;
  await assert.rejects(prepareDocumentDownload(new Blob(['<html>Captcha</html>'], { type: 'application/pdf' })), /resposta inválida/);
  await assert.rejects(prepareDocumentDownload(new Blob(['%PDF-1.7\nparcial'])), /incompleto/);
});

test('ZIP and Office files retain their actual format', async () => {
  const { prepareDocumentDownload } = await helper;
  const zip = new Blob([new Uint8Array([0x50,0x4b,0x03,0x04,0x01])], { type: 'application/octet-stream' });
  assert.equal((await prepareDocumentDownload(zip, { title: 'Anexos 12,5 MB' })).filename, 'Anexos.zip');
  const office = await prepareDocumentDownload(zip, { title: 'Proposta.docx' });
  assert.equal(office.filename, 'Proposta.docx');
  assert.equal(office.blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});
