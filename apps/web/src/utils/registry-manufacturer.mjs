const text = (value) => String(value ?? '').trim();
const words = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/([A-Z])(?=\d)/g, '$1 ').replace(/[^A-Z0-9]+/g, ' ').trim();

const BRANDS = [
  ['VEEAM'], ['DELL'], ['LENOVO'], ['HPE', 'HEWLETT PACKARD ENTERPRISE'],
  ['HP', 'HEWLETT PACKARD'], ['CISCO'], ['FORTINET'], ['ARUBA'], ['HUAWEI'],
  ['SOPHOS'], ['MICROSOFT'], ['VMWARE'], ['NUTANIX'], ['CHECKPOINT', 'CHECK POINT'],
  ['PALO ALTO', 'PALOALTO'], ['EXTREME', 'EXTREME NETWORKS'], ['RUCKUS'], ['AVAYA'],
  ['INTEL'], ['AMD'], ['ORACLE'], ['IBM'], ['RED HAT', 'REDHAT'], ['ZABBIX'],
  ['TP-LINK', 'TP LINK', 'TPLINK'], ['TREND MICRO'], ['WITHSECURE', 'WITH SECURE'],
  ['BITDEFENDER'], ['ACRONIS'], ['GOTO'], ['LOGITECH'], ['UBIQUITI'], ['MIKROTIK']
];

export const getOpportunityFabricante = (item, fornMap = new Map()) => {
  if (text(item?.fabricante)) return text(item.fabricante).toUpperCase();
  const linked = (Array.isArray(item?.fornecedorIds) ? item.fornecedorIds : [])
    .map(id => text(fornMap.get(id))).filter(Boolean);
  if (linked.length) return [...new Set(linked.map(name => name.toUpperCase()))].join(', ');

  const candidates = BRANDS.flatMap(([name, ...aliases]) =>
    [name, ...aliases].map(alias => ({ name, match: words(alias) })));
  for (const name of fornMap.values()) {
    if (words(name).length >= 3) candidates.push({ name: text(name).toUpperCase(), match: words(name) });
  }
  // Only identifying fields are searched. Notes may mention a competing brand.
  for (const source of [item?.numeroOportunidade, item?.produto, item?.titulo]) {
    const normalized = ` ${words(source)} `;
    const matches = candidates.map(candidate => ({ ...candidate, index: normalized.indexOf(` ${candidate.match} `) }))
      .filter(candidate => candidate.index !== -1)
      .sort((a, b) => a.index - b.index || b.match.length - a.match.length);
    if (matches.length) return matches[0].name.toUpperCase();
  }
  return '';
};
