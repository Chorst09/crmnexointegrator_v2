// Read catalog tables before collapsing PDF layout whitespace. Prices may be
// placeholders in consultation drafts; quantities and catalog codes remain valid.
function parseNumber(value) {
  if (!value || /x/i.test(value)) return null;
  const text = value.replace(/R\$|\s/g, '');
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : text;
  return Number.isFinite(Number(normalized)) ? Number(normalized) : null;
}

function extractCatalogTable(text) {
  const lines = String(text || '').split(/\r?\n|\f/);
  const header = lines.findIndex(line => /ITEM\s+C[ÓO]DIGO\s+DESCRI[CÇ][AÃ]O\s+QTDE/i.test(line));
  if (header < 0) return [];
  const descriptionColumn = lines[header].search(/DESCRI[CÇ][AÃ]O/i);
  const quantityColumn = lines[header].search(/QTDE/i);
  const rows = [];
  let gap = [];
  let last;
  for (const line of lines.slice(header + 1)) {
    if (/^\s*\d+\.\d+\.\s/.test(line) || /^\s*(?:TOTAL\s+GLOBAL|GLOBAL)\s*$/i.test(line)) break;
    const match = line.match(/^\s*(\d+)\s+(\d{2}\.\d{2}\.\d{2}\.\d{5}-\d)\s+(.*?)\s*(\d[\d.,]*)\s+(R\$\s*[\dxX.,]+)\s+(R\$\s*[\dxX.,]+)\s*$/i);
    if (match) {
      const ownDescription = match[3].trim();
      let previousCount = Math.floor(gap.length / 2);
      if (gap.length % 2 && last && (!last.ownDescription || ownDescription)) previousCount++;
      if (!last) previousCount = 0;
      if (last) last.description.push(...gap.slice(0, previousCount));
      const row = {
        item_numero: Number(match[1]), codigo_catalogo: match[2],
        quantitativo: parseNumber(match[4]),
        valor_estimado_unitario: parseNumber(match[5]), valor_estimado_total: parseNumber(match[6]),
        ownDescription, description: [...gap.slice(previousCount), ...(ownDescription ? [ownDescription] : [])]
      };
      rows.push(row); last = row; gap = [];
    } else if (last && /^\s{12,}\S/.test(line) && !/^\s*(?:PROCESSO|VALOR|UNIT[ÁA]RIO|TOTAL|GLOBAL)/i.test(line)) {
      const detail = line.slice(descriptionColumn - 2, quantityColumn).trim();
      if (detail && !/R\$/.test(detail)) gap.push(detail);
    }
  }
  if (last) last.description.push(...gap);
  return rows.map(({ ownDescription, description, ...row }) => ({ ...row,
    especificacao_sucinta: description.join(' ').replace(/\s+/g, ' ').trim(),
    unidade: 'Não identificado'
  }));
}
module.exports = { extractCatalogTable };
