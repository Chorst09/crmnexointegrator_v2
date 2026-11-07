// ─── Chave de storage compartilhada com SearchPage ───────────────────────────
export const ACTIVE_SOURCES_KEY = 'pipeline_active_sources_v2';
export const ACTIVE_SOURCES_EVENT = 'pipeline-active-sources-changed';

// ─── Chaves para Filtro de Produtos de TI ────────────────────────────────────
export const TI_FILTER_ENABLED_KEY = 'ti_filter_enabled';
export const TI_FILTER_KEYWORDS_KEY = 'ti_filter_keywords';
export const TI_FILTER_EVENT = 'ti-filter-changed';

// Keywords padrão de TI
export const DEFAULT_TI_KEYWORDS = [...new Set([
  // Hardware
  'computador', 'notebook', 'desktop', 'workstation', 'servidor', 'storage', 'nas', 'san',
  'monitor', 'impressora', 'scanner', 'multifuncional', 'switch', 'roteador', 'router',
  'firewall', 'access point', 'wifi', 'rack', 'nobreak', 'ups', 'cabeamento estruturado',
  'fibra óptica', 'fibra optica', 'patch panel', 'tablet', 'ipad', 'chromebook',
  // Software e Licenças
  'software', 'licença', 'licenca', 'sistema operacional', 'windows', 'linux', 'ubuntu',
  'microsoft', 'office', 'adobe', 'autocad', 'antivírus', 'antivirus', 'mcafee',
  'kaspersky', 'endpoint', 'backup', 'veeam', 'acronis',
  // Cloud e Virtualização
  'nuvem', 'cloud', 'aws', 'azure', 'google cloud', 'gcp', 'saas', 'iaas', 'paas',
  'vmware', 'hyper-v', 'virtualização', 'virtualizacao', 'container', 'docker', 'kubernetes',
  // ERP, CRM e Sistemas
  'erp', 'crm', 'sistema de gestão', 'sistema de gestao', 'totvs', 'sap', 'oracle',
  'banco de dados', 'database', 'sql', 'mysql', 'postgresql', 'mongodb',
  // Serviços de TI
  'outsourcing', 'terceirização', 'tercerizacao', 'help desk', 'service desk',
  'suporte técnico', 'suporte tecnico', 'manutenção de ti', 'manutencao de ti',
  'consultoria de ti', 'consultoria em ti', 'desenvolvimento de software',
  'desenvolvimento de sistema', 'fábrica de software', 'fabrica de software',
  'integração de sistemas', 'integracao de sistemas',
  // Segurança
  'segurança da informação', 'seguranca da informacao', 'pentest', 'teste de invasão',
  'teste de invasao', 'firewall', 'vpn', 'certificado digital', 'ssl', 'criptografia',
  // Infraestrutura
  'datacenter', 'data center', 'infraestrutura de ti', 'infraestrutura de rede',
  'cabeamento', 'rede de computadores', 'telefonia ip', 'voip', 'pabx ip',
  // Genéricos de TI
  'ti', 'tecnologia da informação', 'tecnologia da informacao', 'informática',
  'informatica', 'tecnologia', 'digital', 'cftv', 'câmera', 'camera'
])];


// Uma lista vazia salva é uma escolha explícita, não uma restauração dos padrões.
export function readTIFilterSettings(storage = localStorage) {
  let enabled = true;
  let keywords = DEFAULT_TI_KEYWORDS;
  try { enabled = storage.getItem(TI_FILTER_ENABLED_KEY) !== 'false'; } catch (_) {}
  try {
    const saved = storage.getItem(TI_FILTER_KEYWORDS_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        keywords = [...new Set(parsed.filter(value => typeof value === 'string').map(value => value.trim().toLowerCase()).filter(Boolean))];
      }
    }
  } catch (_) {}
  return { enabled, keywords };
}
