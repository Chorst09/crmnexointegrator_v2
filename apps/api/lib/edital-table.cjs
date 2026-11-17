// Parser robusto de tabelas e matriz de itens do Termo de Referência (TR) e Edital
// Suporta modelo CGU/Federal (Apêndice I + Apêndice II), tabelas delimitadas (| e ;), layouts colunares e blocos descritivos

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
    .replace(/^(?:ITEM|Item|LOTE|Lote)\s*\d{1,4}\s*[-–—:]\s*/iu, '')
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
          valor_estimado_unitario: it.valor_estimado_unitario || existing.valor_estimado_unitario,
          quantitativo: it.quantitativo || existing.quantitativo
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.item_numero - b.item_numero);
}

function scoreItems(items) {
  if (!items || !items.length) return 0;
  let score = items.length * 10;
  score += items.filter(it => it.valor_estimado_total && it.valor_estimado_total > 0).length * 15;
  score += items.filter(it => it.valor_estimado_unitario && it.valor_estimado_unitario > 0).length * 10;
  score += items.filter(it => it.quantitativo && it.quantitativo > 0).length * 5;
  score += items.filter(it => it.especificacao_sucinta && it.especificacao_sucinta.length > 5).length * 2;
  return score;
}

// 1. Extração para modelo CGU / Federal (Apêndice I - Relação/Preços + Apêndice II - Descritivo detalhado)
function extractCguApendiceItems(text) {
  const ap1Match = text.match(/(?:^|\n)\s*(?:Ap[eê]ndice|ANEXO)\s+I\s*[-–—:]\s*[^\n]+/i);
  const ap2Match = text.match(/(?:^|\n)\s*(?:Ap[eê]ndice|ANEXO)\s+II\s*[-–—:]\s*[^\n]+/i);

  const ap1Start = ap1Match ? ap1Match.index : -1;
  const ap2Start = ap2Match ? ap2Match.index : -1;

  if (ap1Start < 0 && ap2Start < 0) return [];

  // Extrair pares de preços (Unitário e Total) do Apêndice I
  const pricePairs = [];
  if (ap1Start >= 0) {
    const ap1End = ap2Start > ap1Start ? ap2Start : text.length;
    const ap1Text = text.slice(ap1Start, ap1End);
    const lines = ap1Text.split('\n');
    for (const line of lines) {
      const m = line.match(/R\$\s*([\d.]+(?:,\d{2}))\s+(?:R\$\s*)?([\d.]+(?:,\d{2}))/);
      if (m) {
        const u = parseNumber(m[1]);
        const t = parseNumber(m[2]);
        if (u !== null && t !== null) pricePairs.push({ unit: u, total: t });
      }
    }
  }

  // Delimitar escopo dos itens do Termo de Referência antes de ETP, Contrato ou Anexo II/III
  let searchStart = ap2Start >= 0 ? ap2Start : ap1Start;
  let ap2End = text.length;
  const stopKeywords = [
    text.search(/\n\s*Estudo\s+T[eé]cnico\s+Preliminar\b/iu),
    text.search(/\n\s*ANEXO\s+II\b/iu),
    text.search(/\n\s*ANEXO\s+III\b/iu),
    text.search(/\n\s*MINUTA\s+DE\s+TERMO\s+DE\s+CONTRATO\b/iu)
  ].filter(idx => idx > searchStart);
  if (stopKeywords.length > 0) ap2End = Math.min(...stopKeywords);

  const scopeText = text.slice(searchStart, ap2End);
  const blockRegex = /(?:^|\n)\s*(?:ITEM|Item)\s+(\d{1,4})\b\s*[-–—:]\s*([\s\S]+?)(?=(?:\n\s*(?:ITEM|Item)\s+\d{1,4}\b\s*[-–—:]|$))/gi;
  const blocks = [...scopeText.matchAll(blockRegex)];

  if (blocks.length === 0) return [];

  const items = [];
  for (const b of blocks) {
    const num = Number(b[1]);
    const body = b[2].trim();

    // Quantidade expressa no cabeçalho ou corpo
    const qtdMatch = body.slice(0, 300).match(/(?:[-–—:]\s*)?(\d[\d.,]*)\s*unidades?\b/iu) ||
                     body.match(/(?:quantitativo|quantidade|qtde|qtd)\s*[:\-]?\s*(\d[\d.,]*)/iu);
    let qtd = qtdMatch ? parseNumber(qtdMatch[1]) : null;

    // Unidade
    let unidade = 'UN';
    const headerSnippet = body.slice(0, 200);
    if (/unidades?\b/iu.test(headerSnippet)) unidade = 'UN';
    else if (/metros?\b/iu.test(headerSnippet)) unidade = 'METRO';
    else if (/caixas?\b/iu.test(headerSnippet)) unidade = 'CX';
    else if (/pacotes?\b/iu.test(headerSnippet)) unidade = 'PACOTE';
    else {
      const uMatch = body.match(UNIDADES_REGEX);
      if (uMatch) unidade = uMatch[0].toUpperCase();
    }

    // Descrição sucinta
    let titleMatch = body.match(/^(.+?)(?:\s*[-–—:]\s*\d[\d.,]*\s*unidades?|\n\n)/is);
    let desc = cleanDescription(titleMatch ? titleMatch[1] : body.split('\n')[0]);
    if (!desc || desc.length < 3) desc = `Item ${num}`;

    // Código catálogo / modelo
    const codMatch = body.match(/(?:c[oó]digo|catmat|catser)\s*[:\-]?\s*([0-9.\-]+)/iu);
    const modMatch = body.match(/MODELO\s+REFER[ÊE]NCIA\s*[:\-]\s*([^\n;.]+)/iu);
    const codigo = codMatch ? codMatch[1] : (modMatch ? modMatch[1].trim() : `ITEM-${num}`);

    // Preços associados (do Apêndice I ou do próprio corpo)
    const price = pricePairs[num - 1] || null;
    let unit = price ? price.unit : null;
    let total = price ? price.total : null;

    if (!unit) {
      const uMatch = body.match(/(?:valor|pre[cç]o)\s+unit[aá]rio\s*[:\-]?\s*(?:R\$\s*)?([\d.,]+)/iu);
      if (uMatch) unit = parseNumber(uMatch[1]);
    }
    if (!total) {
      const tMatch = body.match(/(?:valor|pre[cç]o)\s+total\s*[:\-]?\s*(?:R\$\s*)?([\d.,]+)/iu);
      if (tMatch) total = parseNumber(tMatch[1]);
    }

    if (!qtd && unit && total) {
      qtd = Math.round(total / unit);
    } else if (qtd && unit && !total) {
      total = Number((unit * qtd).toFixed(2));
    }

    items.push({
      item_numero: num,
      codigo_catalogo: codigo,
      especificacao_sucinta: desc,
      unidade,
      quantitativo: qtd || 1,
      valor_estimado_unitario: unit,
      valor_estimado_total: total
    });
  }

  return deduplicateItems(items);
}

// 2. Extração para tabelas delimitadas (| ou múltiplos ponto-e-vírgulas em CSV)
function extractTableDelimited(lines) {
  const items = [];
  const pipeLines = lines.filter(l => l.includes('|'));
  const hasPipeData = pipeLines.some(l => /^\s*\|?\s*\d{1,4}\s*\|/u.test(l));

  let startLines = [];
  if (hasPipeData) {
    startLines = pipeLines;
  } else {
    const tableLines = lines.filter(l => (l.match(/;/g) || []).length >= 2);
    if (tableLines.length < 2) return [];

    const headerIdx = tableLines.findIndex(l => 
      /(?:item|lote)/iu.test(l) && 
      /(?:descri|objeto|especifica|produto)/iu.test(l) && 
      /(?:quant|qtd|unid|valor|pre[cç]o)/iu.test(l)
    );

    // Sem cabeçalho legítimo para CSV, evita capturar frases narrativas
    if (headerIdx < 0) return [];
    startLines = tableLines.slice(headerIdx + 1);
  }

  for (const line of startLines) {
    if (/^\s*\|?\s*[-:=+\s|]+\s*\|?\s*$/.test(line)) continue;
    if (/(?:total\s+geral|valor\s+total\s+estimado|or[cç]amento\s+total)/iu.test(line)) break;

    const delim = line.includes('|') ? '|' : ';';
    const parts = line.split(delim).map(p => p.trim()).filter((p, i, arr) => !(i === 0 && p === '') && !(i === arr.length - 1 && p === ''));
    if (parts.length < 2) continue;

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

// 2b. Extração para minuta com layout colunar posicional e quebras de descrição entre linhas
function extractCuritibaDraftTable(text) {
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

// 3. Extração para tabelas posicionais / colunares
function extractPositionalTable(text) {
  const lines = String(text || '').split(/\r?\n|\f/);
  const headerIdx = lines.findIndex(line => 
    /(?:item|lote)/iu.test(line) && 
    /(?:descri|especifica|objeto)/iu.test(line) && 
    /(?:qtde|quant|unid|vl\.|valor|pre[cç]o)/iu.test(line)
  );

  if (headerIdx < 0) return [];

  const rows = [];
  let current = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
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

    // Linha Curitiba: ITEM CODIGO DESCRICAO QTDE VL_UNIT VL_TOTAL
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

    // Linha genérica com unidade explícita
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

// 4. Extração para blocos descritivos de TR genéricos
function extractBlocksTR(text) {
  let cleanText = String(text || '');
  const stopKeywords = [
    cleanText.search(/\n\s*Estudo\s+T[eé]cnico\s+Preliminar\b/iu),
    cleanText.search(/\n\s*ANEXO\s+II\b/iu),
    cleanText.search(/\n\s*ANEXO\s+III\b/iu),
    cleanText.search(/\n\s*MINUTA\s+DE\s+TERMO\s+DE\s+CONTRATO\b/iu)
  ].filter(idx => idx > 1000);
  if (stopKeywords.length > 0) {
    cleanText = cleanText.slice(0, Math.min(...stopKeywords));
  }

  const rawBlocks = cleanText.split(/(?=\n\s*(?:ITEM|LOTE)\s+\d+\b)/iu).filter(b => /(?:ITEM|LOTE)\s+\d+\b/iu.test(b));
  const items = [];
  for (const block of rawBlocks) {
    const itemMatch = block.match(/(?:ITEM|LOTE)\s+(\d{1,4})\b(?:[ \t]*[-–—:][ \t]*([^\n]+))?/iu);
    if (!itemMatch) continue;
    const itemNum = Number(itemMatch[1]);
    const firstLineDesc = (itemMatch[2] || '').trim();

    // Quantidade expressa no título ou no corpo
    const headerQtdMatch = firstLineDesc.match(/(?:[-–—:]\s*)?(\d[\d.,]*)\s*(?:unidades?|itens?|pe[cç]as?|und|un)\b/iu);
    const bodyQtdMatch = block.match(/(?:quantitativo|quantidade|qtde|qtd)\s*[:\-]?\s*(\d[\d.,]*)/iu);
    const qtd = headerQtdMatch ? parseNumber(headerQtdMatch[1]) : (bodyQtdMatch ? parseNumber(bodyQtdMatch[1]) : 1);

    const descMatch = block.match(/(?:descri[cç][aã]o|especifica[cç][aã]o|objeto)\s*[:\-]\s*([^\n]+)/iu);
    let desc = descMatch ? descMatch[1].trim() : firstLineDesc.replace(/(?:[-–—:]\s*)?\d[\d.,]*\s*(?:unidades?|itens?|pe[cç]as?|und|un)\b/iu, '').trim();
    if (!desc || desc.length < 3) desc = `Item ${itemNum}`;

    const unidMatch = block.match(/(?:unidade(?:\s+de\s+medida)?|unid|und)\s*[:\-]?\s*([A-Za-zçãéíóú0-9]+)/iu);
    const unidade = unidMatch && UNIDADES_REGEX.test(unidMatch[1]) ? unidMatch[1].toUpperCase() : 'UN';

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

// Orquestrador de estratégias: seleciona o candidato com melhor cobertura e qualidade
function extractCatalogTable(text) {
  if (!text) return [];

  const candidates = [];

  // 1. Modelo CGU / Federal (Apêndice I + II)
  try {
    const cguItems = extractCguApendiceItems(text);
    if (cguItems.length > 0) candidates.push(cguItems);
  } catch (e) {}

  // 1b. Minuta com layout colunar e wrapping de texto (Curitiba / Municípios)
  try {
    const draftItems = extractCuritibaDraftTable(text);
    if (draftItems.length > 0) candidates.push(draftItems);
  } catch (e) {}

  // 2. Tabela delimitada (| ou CSV com ;)
  try {
    const delimited = extractTableDelimited(String(text).split(/\r?\n|\f/));
    if (delimited.length > 0) candidates.push(delimited);
  } catch (e) {}

  // 3. Tabela posicional / colunar
  try {
    const positional = extractPositionalTable(text);
    if (positional.length > 0) candidates.push(positional);
  } catch (e) {}

  // 4. Blocos descritivos de TR
  try {
    const blocks = extractBlocksTR(text);
    if (blocks.length > 0) candidates.push(blocks);
  } catch (e) {}

  if (candidates.length === 0) return [];

  // Ordena pelo maior score de completude
  candidates.sort((a, b) => scoreItems(b) - scoreItems(a));
  return candidates[0];
}

module.exports = {
  extractCatalogTable,
  extractCguApendiceItems,
  extractTableDelimited,
  extractPositionalTable,
  extractBlocksTR,
  parseNumber,
  cleanDescription,
  deduplicateItems,
  scoreItems
};
