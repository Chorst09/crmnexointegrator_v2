// Parser robusto de tabelas e matriz de itens do Termo de Referência (TR) e Edital
// Suporta tabelas delimitadas (| e ;), layouts colunares posicionais e blocos descritivos de TR

function parseNumber(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (/^[xX*.\-_]+$/.test(cleaned) || /sigiloso|reservado|confidencial/iu.test(cleaned)) return null;
  const s = cleaned.replace(/R\$|\s/gi, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const UNIDADES_REGEX = /\b(UN(?:IDADE)?S?|UND|UNID|PE[CÇ]AS?|P[CÇ]S?|CONJUNTOS?|CJS?|M[EÊ]SES?|SERVI[CÇ]OS?|SERVS?|LICEN[CÇ]AS?|LICS?|KITS?|LOTES?|HORAS?|HRS?|DI[AÁ]RIAS?|METROS?|M2|M3|KG|QUILOS?|LITROS?|LTS?|PACOTES?|PCTS?|ROLOS?|CAIXAS?|CXS?|PARES?)\b/iu;

function cleanDescription(desc) {
  return String(desc || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:;|.]+/, '')
    .replace(/[\s\-:;|.]+$/, '')
    .trim();
}

function deduplicateItems(items) {
  const map = new Map();
  for (const it of items) {
    if (!it.item_numero) continue;
    if (!map.has(it.item_numero)) {
      map.set(it.item_numero, it);
    } else {
      const existing = map.get(it.item_numero);
      const betterTotal = it.valor_estimado_total && !existing.valor_estimado_total;
      const longerDesc = (it.especificacao_sucinta || '').length > (existing.especificacao_sucinta || '').length;
      if (betterTotal || longerDesc) {
        map.set(it.item_numero, {
          ...existing,
          ...it,
          especificacao_sucinta: longerDesc ? it.especificacao_sucinta : existing.especificacao_sucinta,
          valor_estimado_total: it.valor_estimado_total || existing.valor_estimado_total,
          valor_estimado_unitario: it.valor_estimado_unitario || existing.valor_estimado_unitario
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.item_numero - b.item_numero);
}

function extractTableDelimited(lines) {
  const items = [];
  const tableLines = lines.filter(l => l.includes('|') || l.includes(';'));
  if (tableLines.length < 2) return [];

  const headerIdx = tableLines.findIndex(l => 
    /(?:item|lote)/iu.test(l) && 
    /(?:descri|objeto|especifica|produto)/iu.test(l) && 
    /(?:quant|qtd|unid|valor|pre[cç]o)/iu.test(l)
  );

  const startLines = headerIdx >= 0 ? tableLines.slice(headerIdx + 1) : tableLines;

  for (const line of startLines) {
    if (/^\s*\|?\s*[-:=+\s|]+\s*\|?\s*$/.test(line)) continue;
    if (/(?:total\s+geral|valor\s+total\s+estimado|or[cç]amento\s+total)/iu.test(line)) break;

    const delim = line.includes('|') ? '|' : ';';
    const parts = line.split(delim).map(p => p.trim()).filter((p, i, arr) => !(i === 0 && p === '') && !(i === arr.length - 1 && p === ''));
    if (parts.length < 3) continue;

    const itemMatch = parts[0].match(/^(?:item|lote)?\s*(\d{1,4})/iu);
    if (!itemMatch) continue;
    const itemNum = Number(itemMatch[1]);

    let codigo = null;
    let desc = '';
    let unidade = 'UN';
    let qtd = null;
    let unit = null;
    let total = null;

    const remaining = parts.slice(1);
    const nums = [];
    for (let c = 0; c < remaining.length; c++) {
      const col = remaining[c];
      const parsed = parseNumber(col);
      if (parsed !== null && parsed > 0) {
        nums.push({ val: parsed, orig: col, idx: c });
      } else if (UNIDADES_REGEX.test(col) && col.length <= 15) {
        unidade = col.match(UNIDADES_REGEX)[0].toUpperCase();
      } else if (/(?:\d{2}\.\d{2}\.\d{2}\.\d{4,5}-\d|\b(?:catmat|catser)?\s*\d{5,8}\b)/iu.test(col)) {
        codigo = col;
      } else if (col.length > desc.length && !/^R\$\s*[\dxX.,]+$/iu.test(col)) {
        desc = col;
      }
    }

    if (nums.length >= 3) {
      qtd = nums[0].val;
      unit = nums[1].val;
      total = nums[2].val;
    } else if (nums.length === 2) {
      qtd = nums[0].val;
      total = nums[1].val;
      unit = qtd > 0 ? Number((total / qtd).toFixed(2)) : total;
    } else if (nums.length === 1) {
      qtd = nums[0].val;
    }

    if (!desc && remaining[0] && !parseNumber(remaining[0])) {
      desc = remaining[0];
    }

    if (itemNum > 0 && (desc || qtd !== null)) {
      items.push({
        item_numero: itemNum,
        codigo_catalogo: codigo || `ITEM-${itemNum}`,
        especificacao_sucinta: cleanDescription(desc) || `Item ${itemNum}`,
        unidade: unidade || 'UN',
        quantitativo: qtd || 1,
        valor_estimado_unitario: unit,
        valor_estimado_total: total || (qtd && unit ? Number((qtd * unit).toFixed(2)) : null)
      });
    }
  }

  return deduplicateItems(items);
}

function extractBlocksTR(text) {
  const rawBlocks = String(text || '').split(/(?=\n\s*(?:ITEM|LOTE)\s+\d+\b)/iu).filter(b => /(?:ITEM|LOTE)\s+\d+\b/iu.test(b));
  const items = [];
  for (const block of rawBlocks) {
    const itemMatch = block.match(/(?:ITEM|LOTE)\s+(\d{1,4})\b(?:[ \t]*[-–—:][ \t]*([^\n]+))?/iu);
    if (!itemMatch) continue;
    const itemNum = Number(itemMatch[1]);
    const firstLineDesc = (itemMatch[2] || '').trim();

    const descMatch = block.match(/(?:descri[cç][aã]o|especifica[cç][aã]o|objeto)\s*[:\-]\s*([^\n]+)/iu);
    let desc = descMatch ? descMatch[1].trim() : firstLineDesc;
    if (!desc || desc.length < 3) desc = firstLineDesc || `Item ${itemNum}`;

    const unidMatch = block.match(/(?:unidade(?:\s+de\s+medida)?|unid|und)\s*[:\-]?\s*([A-Za-zçãéíóú0-9]+)/iu);
    const unidade = unidMatch && UNIDADES_REGEX.test(unidMatch[1]) ? unidMatch[1].toUpperCase() : 'UN';

    const qtdMatch = block.match(/(?:quantitativo|quantidade|qtde|qtd)\s*[:\-]?\s*(\d[\d.,]*)/iu);
    const qtd = qtdMatch ? parseNumber(qtdMatch[1]) : 1;

    const unitMatch = block.match(/(?:valor\s+(?:unit[aá]rio|estimado\s+unit[aá]rio|de\s+refer[êe]ncia)|pre[cç]o\s+unit[aá]rio)\s*[:\-]?\s*(?:R\$\s*)?([\d.,]+|[\dxX.,]+)/iu);
    const unit = unitMatch ? parseNumber(unitMatch[1]) : null;

    const totalMatch = block.match(/(?:valor\s+(?:total|global|estimado\s+total)|pre[cç]o\s+total)\s*[:\-]?\s*(?:R\$\s*)?([\d.,]+|[\dxX.,]+)/iu);
    const total = totalMatch ? parseNumber(totalMatch[1]) : (unit && qtd ? Number((unit * qtd).toFixed(2)) : null);

    const codMatch = block.match(/(?:c[oó]digo|catmat|catser)\s*[:\-]?\s*([0-9.\-]+)/iu);
    const codigo = codMatch ? codMatch[1] : `ITEM-${itemNum}`;

    items.push({
      item_numero: itemNum,
      codigo_catalogo: codigo,
      especificacao_sucinta: cleanDescription(desc),
      unidade,
      quantitativo: qtd || 1,
      valor_estimado_unitario: unit,
      valor_estimado_total: total
    });
  }
  return deduplicateItems(items);
}

function extractPositionalTable(text) {
  const lines = String(text || '').split(/\r?\n|\f/);
  const headerIdx = lines.findIndex(line => 
    /(?:item|lote)/iu.test(line) && 
    /(?:descri|especifica|objeto)/iu.test(line) && 
    /(?:qtde|quant|unid|vl\.|valor|pre[cç]o)/iu.test(line)
  );

  const rows = [];
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
  let current = null;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(?:total\s+global|total\s+geral|or[cç]amento\s+total|valor\s+global)\b/iu.test(line)) {
      if (current) rows.push(current);
      current = null;
      break;
    }
    if (/^\s*(?:cl[aá]usula|se[cç][aã]o|\d+\.\d+\.\s+[A-ZÀ-Ý])/iu.test(line)) {
      if (current) { rows.push(current); current = null; }
      continue;
    }

    // Linha com padrão Curitiba: ITEM CODIGO DESCRICAO QTDE VL_UNIT VL_TOTAL
    const curitibaMatch = line.match(/^\s*(\d{1,4})\s+(\d{2}\.\d{2}\.\d{2}\.\d{4,5}-\d)\s+(.+?)\s+(\d[\d.,]*)\s+(R\$\s*[\dxX.,]+)\s+(R\$\s*[\dxX.,]+)\s*$/iu);
    if (curitibaMatch) {
      if (current) rows.push(current);
      current = {
        item_numero: Number(curitibaMatch[1]),
        codigo_catalogo: curitibaMatch[2],
        especificacao_sucinta: cleanDescription(curitibaMatch[3]),
        unidade: 'UN',
        quantitativo: parseNumber(curitibaMatch[4]) || 1,
        valor_estimado_unitario: parseNumber(curitibaMatch[5]),
        valor_estimado_total: parseNumber(curitibaMatch[6]),
        linhas_desc: [cleanDescription(curitibaMatch[3])]
      };
      continue;
    }

    // Linha genérica de item com unidade explícita: ITEM DESCRICAO UNIDADE QUANTIDADE VL_UNIT VL_TOTAL
    const genericItemMatch = line.match(/^\s*(\d{1,4})\s+(.+?)\s+(UN|UND|UNID|UNIDADE|UNIDADES|PE[CÇ]A|PE[CÇ]AS|P[CÇ]|CONJUNTO|CJ|M[EÊ]S|MESES|SERVI[CÇ]O|SERV|LICEN[CÇ]A|KIT|LOTE|HORA|HR|DI[AÁ]RIA|METRO|M|M2|M3|KG|LT|PACOTE|CX|PAR)\s+(\d[\d.,]*)\s+((?:R\$\s*)?[\d.]+,\d{2}|[\dxX.,]+)\s+((?:R\$\s*)?[\d.]+,\d{2}|[\dxX.,]+)\s*$/iu);
    if (genericItemMatch) {
      if (current) rows.push(current);
      const qtd = parseNumber(genericItemMatch[4]) || 1;
      const unit = parseNumber(genericItemMatch[5]);
      const total = parseNumber(genericItemMatch[6]);
      current = {
        item_numero: Number(genericItemMatch[1]),
        codigo_catalogo: `ITEM-${genericItemMatch[1]}`,
        especificacao_sucinta: cleanDescription(genericItemMatch[2]),
        unidade: genericItemMatch[3].toUpperCase(),
        quantitativo: qtd,
        valor_estimado_unitario: unit,
        valor_estimado_total: total || (unit ? Number((unit * qtd).toFixed(2)) : null),
        linhas_desc: [cleanDescription(genericItemMatch[2])]
      };
      continue;
    }

    // Linha com número de item no início e descrição com valores no final
    const newRowMatch = line.match(/^\s*(\d{1,4})\s+([A-ZÀ-Ý0-9][^\t\n]{5,})/u);
    if (newRowMatch && headerIdx >= 0) {
      const valuesMatch = line.match(/(?:R\$\s*)?([\d.]+(?:,\d{2}))\s+(?:R\$\s*)?([\d.]+(?:,\d{2}))\s*$/u);
      if (valuesMatch) {
        if (current) rows.push(current);
        const unit = parseNumber(valuesMatch[1]);
        const total = parseNumber(valuesMatch[2]);
        const descText = line.replace(valuesMatch[0], '').replace(/^\s*\d{1,4}\s+/, '').trim();
        current = {
          item_numero: Number(newRowMatch[1]),
          codigo_catalogo: `ITEM-${newRowMatch[1]}`,
          especificacao_sucinta: cleanDescription(descText),
          unidade: 'UN',
          quantitativo: unit > 0 && total > 0 ? Math.round(total / unit) : 1,
          valor_estimado_unitario: unit,
          valor_estimado_total: total,
          linhas_desc: [cleanDescription(descText)]
        };
        continue;
      }
    }

    // Linha de continuação de descrição
    if (current && /^\s{4,}\S/.test(line) && !/^\s*(?:PROCESSO|PREG[AÃ]O|VALOR|TOTAL|DATA)/iu.test(line)) {
      const extra = line.trim();
      if (extra && extra.length > 2 && !/^R\$\s*[\d.,]+$/iu.test(extra)) {
        current.linhas_desc.push(extra);
        current.especificacao_sucinta = cleanDescription(current.linhas_desc.join(' '));
      }
    }
  }

  if (current) rows.push(current);

  return deduplicateItems(rows.map(({ linhas_desc, ...r }) => r));
}

function extractCatalogTable(text) {
  if (!text) return [];

  // 1. Tenta extrair formato delimitado (tabelas com pipe | ou ;)
  const delimited = extractTableDelimited(String(text).split(/\r?\n|\f/));
  if (delimited.length > 0) return delimited;

  // 2. Tenta extrair formato posicional / colunar
  const positional = extractPositionalTable(text);
  if (positional.length > 0) return positional;

  // 3. Tenta extrair blocos de Termo de Referência
  const blocks = extractBlocksTR(text);
  if (blocks.length > 0) return blocks;

  return [];
}

module.exports = { extractCatalogTable, parseNumber, cleanDescription };
