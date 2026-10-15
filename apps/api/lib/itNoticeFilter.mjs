// Qualification uses procurement content, never the contracting agency's name.
export const DEFAULT_IT_PRODUCTS = [
  'computador', 'notebook', 'desktop', 'servidor de TI', 'storage', 'monitor de computador',
  'impressora', 'scanner de documentos', 'switch', 'roteador', 'firewall', 'access point',
  'rack de TI', 'cabeamento estruturado', 'fibra óptica', 'hardware', 'tablet', 'software',
  'licença de software', 'nuvem', 'cloud', 'AWS', 'Azure', 'antivírus', 'endpoint', 'ERP',
  'CRM', 'banco de dados', 'Windows', 'Linux', 'VMware', 'outsourcing de impressão',
  'fábrica de software', 'desenvolvimento de software', 'suporte de TI', 'service desk',
  'help desk', 'manutenção de computadores', 'consultoria em TI', 'segurança da informação',
  'backup', 'datacenter', 'infraestrutura de TI', 'redes de computadores', 'pentest'
];

export const normalizeITText = value => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/https?:\/\/\S+/gi, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
  .replace(/&(?:nbsp|amp|quot|apos);/gi, ' ')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const boundary = pattern => new RegExp(`(?:^|\\s)(?:${pattern})(?=\\s|$)`);
const groups = [
  ['Computadores e hardware', 'microcomputador(?:es)?|computador(?:es)?|notebooks?|laptops?|desktops?|chromebooks?|minipc|mini pc|hardware|placas? mae|placas? de video|gpu|cpu|memoria ram|ssd|hdd|raspberry pi'],
  ['Software e licenciamento', 'softwares?|aplicativos?|sistemas? informatizados?|sistemas? computacionais?|banco(?:s)? de dados|antivirus|antimalware|erp|crm|windows|linux|vmware|microsoft|office 365|microsoft 365|office365|microsoft365|google workspace|autodesk|adobe|red hat|oracle|sap|power bi|sql server|postgresql|mysql|nosql'],
  ['Nuvem e dados', 'storage|backup|datacenter|data center|cloud|computacao em nuvem|servicos? de nuvem|armazenamento (?:em nuvem|de dados)|virtualizacao|hiperconvergencia|nutanix|aws|azure|saas|iaas|paas|containers? de (?:aplicacoes|software)|kubernetes|docker'],
  ['Redes e conectividade', 'roteador(?:es)?|routers?|firewalls?|access points?|pontos? de acesso|wifi|wi fi|wlan|lan|sd wan|mpls|links? dedicados?|internet|intranet|redes? de (?:computadores|dados)|rede logica|cabeamento estruturado|cabos? (?:utp|de rede)|cat ?[56]e?|cat ?6a|patch panels?|patch cords?|fortinet|fortigate|unifi|ubiquiti|cisco|mikrotik|voip|telefonia ip|pabx ip'],
  ['Segurança digital', 'seguranca (?:da informacao|cibernetica|digital)|ciberseguranca|cybersecurity|pentest|teste(?:s)? de invasao|endpoint|edr|xdr|siem|sase|vpn|nac|hsm|d l p|dlp'],
  ['Serviços de TI', 'tecnologia da informacao|informatica|infraestrutura de ti|infraestrutura de tic|consultoria em ti|suporte (?:tecnico de ti|de ti|em ti)|servicos? (?:de|em) (?:ti|tic)|solucoes? (?:de|em) (?:ti|tic)|equipamentos? (?:de|para) (?:ti|tic)|service desk|help desk|outsourcing de impressao|fabrica de software'],
  ['Impressão e digitalização', 'impressoras?|toners?|cartuchos? de impressao|scanners? de (?:documentos|mesa)|digitalizadores? de documentos'],
].map(([category, pattern]) => ({ category, regex: boundary(pattern) }));

const contextualProducts = [
  { category: 'Servidores', product: boundary('servidor(?:es)?'), invalid: /\bservidor(?:es)?\s+(?:publicos?|municipais?|estaduais?|ativos?|inativos?|aposentados?|comissionados?)\b|\b(?:remuneracao|salarios?|uniformes?|alimentacao|transporte|beneficios?|assistencia medica|plano de saude)\s+(?:\S+\s+){0,8}servidor(?:es)?\b/ },
  { category: 'Monitores e telas', product: boundary('monitor(?:es)?|displays?'), invalid: /\b(?:multiparametricos?|cardiacos?|fetal|fetais|pacientes?|hospitalares?|medicos?|escolares?|pedagogicos?|recreacao|vigilantes?)\b/, context: /\b(?:aquisicao|fornecimento|locacao|compra|computadores?|informatica|polegadas?|led|lcd|ips|hdmi|displayport|full hd|4k)\b/ },
  { category: 'Tablets', product: boundary('tablets?|ipads?'), invalid: /\b(?:medicamentos?|comprimidos?|farmaceutic|mg)\b/ },
  { category: 'Scanners', product: boundary('scanners?'), invalid: /\b(?:tomografia|tomografos?|ultrassom|ressonancia|intraoral|odontologic|odontologicos?|hospitalares?|medicos?)\b/ },
  { category: 'Switches', product: boundary('switch(?:es)?'), invalid: /\b(?:potencia|eletricos?|eletrica|alta tensao|chaveamento)\b/ },
  { category: 'Fibra óptica', product: boundary('fibra(?:s)? optica(?:s)?'), invalid: /\b(?:cirurgia|cirurgico|cirurgicos|endoscopia|laser|odontologicos?)\b/ },
  { category: 'Racks de TI', product: boundary('racks?'), context: /\b(?:19 polegadas?|servidores?|rede|redes|informatica|ti|datacenter|data center|patch panel|telecomunicacoes)\b/ },
  { category: 'Energia para TI', product: boundary('nobreaks?|no breaks?|ups'), context: /\b(?:computadores?|servidores?|rede|redes|informatica|ti|datacenter|data center|storage)\b/ }
];

export function getNoticeContent(notice) {
  if (typeof notice === 'string') return notice;
  if (!notice || typeof notice !== 'object') return '';
  const fields = ['titulo', 'objetoCompra', 'objeto_resumo', 'resumo', 'descricao', 'description', 'informacaoComplementar', 'objeto'];
  const texts = fields.map(field => notice[field]).filter(value => typeof value === 'string');
  if (Array.isArray(notice.itens)) {
    notice.itens.forEach(item => {
      for (const field of ['descricao', 'especificacao', 'description', 'nome']) {
        if (typeof item?.[field] === 'string') texts.push(item[field]);
      }
    });
  }
  return texts.join(' ');
}

export function classifyITNotice(notice) {
  const text = normalizeITText(getNoticeContent(notice));
  if (!text) return { isIT: false, categories: [] };
  // Vehicle accessories do not make the purchase of vehicles an IT procurement.
  const content = text.replace(/computador(?:es)? de bordo/g, '');
  const categories = groups.filter(group => group.regex.test(content)).map(group => group.category);
  for (const rule of contextualProducts) {
    if (rule.product.test(content) && (!rule.invalid || !rule.invalid.test(content)) && (!rule.context || rule.context.test(content))) {
      categories.push(rule.category);
    }
  }
  return { isIT: categories.length > 0, categories: [...new Set(categories)] };
}

export const isITNotice = notice => classifyITNotice(notice).isIT;

const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'por', 'a', 'o', 'as', 'os', 'um', 'uma']);
const aliases = new Map([
  ['computador', ['computador', 'computadores', 'microcomputador', 'microcomputadores']],
  ['notebook', ['notebook', 'notebooks', 'laptop', 'laptops']],
  ['switch', ['switch', 'switches']], ['roteador', ['roteador', 'roteadores', 'router', 'routers']],
  ['servidor', ['servidor', 'servidores']], ['monitor', ['monitor', 'monitores']],
  ['impressora', ['impressora', 'impressoras']], ['licenca', ['licenca', 'licencas', 'licenciamento']],
  ['antivirus', ['antivirus', 'antimalware']], ['tablet', ['tablet', 'tablets', 'ipad', 'ipads']]
]);
const canonicalToken = token => {
  for (const [root, values] of aliases) if (values.includes(token)) return root;
  return token.length > 4 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token;
};

const productText = value => normalizeITText(value)
  .replace(/\b(?:microsoft\s+)?office\s*365\b|\bmicrosoft\s*365\b/g, 'office365');
const productMatcher = notice => {
  const words = new Set(productText(getNoticeContent(notice)).split(' ').map(canonicalToken));
  return (query = '') => {
    const terms = productText(query).split(' ').filter(token => token && !stopWords.has(token));
    if (!terms.length) return !normalizeITText(query);
    return terms.every(term => words.has(canonicalToken(term)));
  };
};

export const matchesProductQuery = (notice, query = '') => productMatcher(notice)(query);

export function sanitizeInterestProducts(value, fallback = DEFAULT_IT_PRODUCTS) {
  let products = value;
  if (typeof products === 'string') {
    try { products = JSON.parse(products); } catch { return [...fallback]; }
  }
  if (!Array.isArray(products)) return [...fallback];
  const seen = new Set();
  return products.filter(product => typeof product === 'string').map(product => product.trim().replace(/\s+/g, ' ').slice(0, 60))
    .filter(product => {
      const normalized = normalizeITText(product);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).slice(0, 64);
}

export function getInterestMatches(notice, products) {
  if (!isITNotice(notice)) return [];
  const matches = productMatcher(notice);
  return sanitizeInterestProducts(products, []).filter(product => matches(product));
}
