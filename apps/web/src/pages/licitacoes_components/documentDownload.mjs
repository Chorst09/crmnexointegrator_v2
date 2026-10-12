const knownExtension = /\.(?:pdf|zip|docx?|xlsx?|odt|ods|rtf|txt|csv|html?|json|bin)$/i;

function dispositionFilename(value) {
  const encoded = String(value || '').match(/filename\*\s*=\s*(?:"?)([^;\r\n"]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded.trim().replace(/^[^']*'[^']*'/, '')); } catch { /* Usa filename comum. */ }
  }
  return String(value || '').match(/filename\s*=\s*(?:"([^"]+)"|([^;\r\n]+))/i)?.slice(1).find(Boolean)?.trim();
}

export async function prepareDocumentDownload(blob, { title, contentDisposition } = {}) {
  if (!blob.size) throw new Error('A fonte retornou um arquivo vazio. Tente novamente.');
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const text = new TextDecoder().decode(head);
  const suppliedName = dispositionFilename(contentDisposition) || title || 'Documento';
  // Portais incluem o tamanho no texto do link (ex.: "Edital 5.013kB").
  const cleanName = String(suppliedName).normalize('NFC')
    .replace(/\s+\d+(?:[.,]\d+)*\s*(?:[KMGT]i?B|bytes?)\s*$/i, '')
    .replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, '_').trim()
    .replace(/^[. ]+|[. ]+$/g, '') || 'Documento';
  const declaredType = String(blob.type || '').split(';')[0].toLowerCase();
  let type = declaredType;
  let extension = '';
  if (/^(?:\uFEFF|\s)*%PDF-/.test(text)) {
    const tail = new TextDecoder().decode(await blob.slice(-8192).arrayBuffer());
    if (!tail.includes('%%EOF')) throw new Error('O PDF recebido está incompleto. Tente novamente.');
    type = 'application/pdf';
    extension = '.pdf';
  } else if (head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2])) {
    if (/\.docx$/i.test(cleanName)) {
      type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; extension = '.docx';
    } else if (/\.xlsx$/i.test(cleanName)) {
      type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; extension = '.xlsx';
    } else if (/\.(odt|ods)$/i.test(cleanName)) {
      extension = cleanName.match(/\.(odt|ods)$/i)[0].toLowerCase();
      type = extension === '.odt' ? 'application/vnd.oasis.opendocument.text' : 'application/vnd.oasis.opendocument.spreadsheet';
    } else { type = 'application/zip'; extension = '.zip'; }
  } else if (/text\/html|application\/(?:json|pdf)/i.test(declaredType) || /^\s*(?:<!doctype\s+html|<html\b|[\[{])/i.test(text)) {
    throw new Error('O serviço retornou uma página ou resposta inválida em vez do arquivo. Use Abrir para consultar a origem.');
  }
  const basename = extension ? cleanName.replace(knownExtension, '') : cleanName;
  const filename = `${basename.slice(0, 180 - extension.length)}${extension}`;
  return { blob: type !== blob.type ? new Blob([blob], { type }) : blob, filename };
}
