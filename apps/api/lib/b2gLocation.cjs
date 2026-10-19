'use strict';

// Códigos e nomes oficiais do IBGE. O catálogo local mantém a busca disponível
// mesmo quando a API de localidades está fora do ar.
const { municipios } = require('../data/municipios-ibge.json');
const normalizeCity = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const states = new Set(municipios.map(([, , uf]) => uf));
const byName = new Map();
for (const [codigo, cidade, uf] of municipios) {
  const key = normalizeCity(cidade);
  const matches = byName.get(key) || [];
  matches.push({ codigoMunicipioIbge: codigo, cidade, uf });
  byName.set(key, matches);
}
const inputError = message => Object.assign(new Error(message), { status: 400 });
function resolveLocation({ uf = '', cidade = '' } = {}) {
  uf = String(uf).trim().toUpperCase();
  cidade = String(cidade).trim();
  if (uf && !states.has(uf)) throw inputError('Selecione uma UF válida.');
  if (!cidade) return { uf, cidade: '', codigoMunicipioIbge: '' };
  const matches = (byName.get(normalizeCity(cidade)) || []).filter(item => !uf || item.uf === uf);
  if (!matches.length) throw inputError(`Município "${cidade}" não encontrado${uf ? ` em ${uf}` : ''}. Confira o nome e o estado selecionado.`);
  if (matches.length > 1) throw inputError(`Há mais de um município chamado "${cidade}". Selecione o estado para buscar.`);
  return { ...matches[0] };
}
function matchesLocation(item, { uf = '', cidade = '' } = {}) {
  return (!uf || String(item.uf || '').trim().toUpperCase() === uf)
    && (!cidade || normalizeCity(item.municipio || item.cidade) === normalizeCity(cidade));
}
module.exports = { resolveLocation, matchesLocation, normalizeCity };
