'use strict';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

// Compila uma vez por busca. Siglas como TI, SAN e NAS precisam ser palavras
// inteiras: não podem coincidir com “material”, “sanitário” ou “apenas”.
function createTIProductMatcher(keywords) {
  const terms = [...new Set(String(keywords || '').split(',').map(normalize).filter(Boolean))];
  const patterns = terms.map(term => new RegExp(`(?:^| )${term.replace(/ /g, ' +')}${term.length > 3 ? '(?:s|es)?' : ''}(?= |$)`));
  return notice => {
    const fields = [notice.objeto, notice.objetoCompra, notice.objeto_resumo, notice.titulo,
      notice.descricao, notice.resumo, notice.informacaoComplementar];
    for (const item of Array.isArray(notice.itens) ? notice.itens : []) {
      fields.push(item.descricao, item.descricaoDetalhada, item.descricaoItem);
    }
    return fields.some(field => {
      const text = normalize(field);
      return patterns.some(pattern => pattern.test(text));
    });
  };
}

module.exports = { createTIProductMatcher };
