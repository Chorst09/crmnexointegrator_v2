// Opinionated default proposal templates.
// These are meant to be created once (if missing) and then editable by the user.

const DOUBLE_BRAND = {
  primaryColor: '#1E40AF', // blue-800
  secondaryColor: '#475569', // slate-600
  fontFamily: 'Inter',
  fontSize: 11,
  pageMargins: { top: 60, right: 50, bottom: 60, left: 50 },
  pageSize: 'A4',
  pageOrientation: 'portrait'
};

const DOUBLE_ASSETS = {
  cover: 'url("/proposal-templates/double/cover.webp") center/cover no-repeat',
  hero: 'url("/proposal-templates/double/hero.webp") center/cover no-repeat',
  page: 'url("/proposal-templates/double/page.webp") center/cover no-repeat',
  who: 'url("/proposal-templates/double/who.webp") center/cover no-repeat',
  letterhead: 'url("/proposal-templates/double/letterhead.webp") center/cover no-repeat'
};

const propostaComercialDouble = {
  type: 'COMMERCIAL',
  name: 'Proposta Comercial',
  description:
    'Modelo comercial baseado na apresentação "Datacenter - Firewall Virtual - Proposta Comercial Double".',
  isDefault: false,
  isActive: true,

  coverEnabled: true,
  // A capa do PPTX já tem o texto embutido no background.
  coverTitle: null,
  coverSubtitle: null,
  coverLogo: null,
  coverBackground: DOUBLE_ASSETS.cover,

  // Os backgrounds já carregam molduras/brand; por padrão não usamos header/footer.
  headerEnabled: false,
  headerLogo: null,
  headerText: null,
  headerHeight: 90,

  footerEnabled: false,
  footerText: null,
  footerLogo: null,
  footerHeight: 70,

  indexEnabled: true,
  indexTitle: 'Índice',

  // Estrutura mais simples (foco comercial), mas ainda alinhada ao mercado.
  sections: [
    {
      id: 'about',
      title: 'Quem Somos',
      enabled: true,
      order: 1,
      layout: 'double-who',
      pageBackground: DOUBLE_ASSETS.who,
      body:
        'Com três décadas de história no mercado, a Double TI + Telecom se destaca pela experiência consolidada de sua equipe e pela confiança conquistada junto aos clientes. Nossa jornada é guiada pela tradição que nos conecta às nossas raízes e pela inovação, que nos impulsionam a evoluir continuamente.',
      highlights: ['+30 anos', '+500 clientes', '+5000 projetos'],
      notes:
        'Acreditamos que o sucesso do nosso negócio está diretamente ligado ao sucesso dos nossos clientes. Por isso, investimos continuamente em infraestrutura, robustez, segurança, inovação e atendimento personalizado.'
    },
    {
      id: 'product',
      title: 'Descritivo do Produto',
      enabled: true,
      order: 2,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'O FIREWALL VIRTUAL DOUBLE é a solução ideal para empresas que buscam proteger seus ambientes digitais com alta disponibilidade, flexibilidade e segurança, sem os custos e limitações de equipamentos físicos. Hospedado em nossos data centers, o serviço oferece proteção contra ameaças, controle de tráfego, VPN, balanceamento e gestão centralizada de regras.',
      bullets: [
        'Firewall de próxima geração (NGFW) com funcionalidades de segurança avançadas',
        'Recursos escaláveis sob demanda (CPU, memória, throughput e conexões simultâneas)',
        'Políticas de firewall, regras de filtragem, NAT, controle de acesso e segmentação de rede',
        'Relatórios de tráfego, uso, tentativas de acesso e eventos de segurança',
        'Monitoramento ativo e suporte especializado 24x7',
        'Integração com redes locais, ambientes em nuvem, PABX, servidores e sistemas corporativos',
        'Proteção contra ameaças, ataques DDoS, invasões, malware e tráfego malicioso'
      ]
    },
    {
      id: 'project',
      title: 'Projeto, Escopo Técnico e Diferenciais',
      enabled: true,
      order: 3,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'O projeto prevê a implantação da solução FIREWALL VIRTUAL DOUBLE (Fortinet ou Check Point), entregando segurança perimetral em nuvem para ambientes corporativos. O serviço contempla provisionamento de ambiente virtualizado com recursos dedicados, IP fixo, configuração personalizada (regras, VPN, NAT, filtros e segmentação), relatórios e monitoramento contínuo.',
      bullets: [
        'Plataforma 100% gerenciada pela equipe técnica própria da DOUBLE',
        'Suporte técnico especializado 24x7, com atendimento ágil e humanizado',
        'Monitoramento proativo com alertas de segurança, disponibilidade e desempenho',
        'Infraestrutura em Data Center nacional, com baixa latência e alta segurança',
        'Escalabilidade sob demanda e atualizações constantes',
        'Elimina custos com hardware físico, licenciamento e manutenções locais'
      ]
    },
    {
      id: 'assumptions',
      title: 'Premissas',
      enabled: true,
      order: 4,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'Uso e conteúdo: o cliente é responsável pela finalidade, regras e utilização do serviço, em conformidade com a legislação vigente (LGPD, Marco Civil, etc.)',
        'Proibição de atividades ilícitas/abusivas: fraudes, invasões, malware, DDoS, phishing, spam ou ações que comprometam redes de terceiros',
        'Licenciamento de software/integrações externas: responsabilidade do cliente, salvo quando contratado com a DOUBLE',
        'Gestão e configuração: regras, filtros, VPNs e políticas são do cliente, salvo contratação de gestão assistida/gerenciada',
        'Boas práticas de segurança: senhas fortes, revisão periódica de regras e monitoramento de acessos',
        'Escalabilidade e limites: respeitar capacidade contratada; expansões mediante solicitação formal'
      ]
    },
    {
      id: 'investment',
      title: 'Investimento e Condições',
      enabled: true,
      order: 5,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      placeholders: [
        'Vigência de contrato (meses)',
        'Prazo de entrega (ex.: 4 a 8 semanas)',
        'Validade do orçamento (ex.: 15 dias)',
        'Tabela de serviços com valores (mensal/contrato)'
      ]
    },
    {
      id: 'hiring',
      title: 'Informações para Contratação',
      enabled: true,
      order: 6,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'Pessoa jurídica: CNPJ, IE, contrato social/alteração, dados de representantes legais, testemunha (nome, e-mail e CPF) e endereço de faturamento (se diferente)',
        'Contato financeiro: nome, telefone/celular e e-mail',
        'Contato técnico (TI): nome, telefone/celular e e-mail',
        'Data de vencimento mensal: dias 5, 10, 25 ou 30',
        'Após recebimento, emissão do Termo de Contratação (TCS) conforme LGPD (Lei 13.709/2018)',
        'Prazo de ativação inicia após TCS assinado (preferencialmente via assinatura digital)'
      ]
    },
    {
      id: 'security',
      title: 'Segurança da Informação, Privacidade e LGPD',
      enabled: true,
      order: 7,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'A Double TI + Telecom se compromete a cumprir a legislação aplicável sobre segurança da informação, privacidade e proteção de dados (Marco Civil, LGPD e demais normas). O tratamento de dados pessoais ocorrerá apenas sob instrução/autorização do contratante, estritamente para finalidades necessárias ao cumprimento das atividades propostas.'
    }
  ],

  ...DOUBLE_BRAND
};

const propostaTecnicaDouble = {
  type: 'TECHNICAL',
  name: 'Proposta Técnica',
  description:
    'Modelo técnico detalhado para a mesma solução (Firewall Virtual / NGFW), seguindo o raciocínio do modelo comercial.',
  isDefault: false,
  isActive: true,

  coverEnabled: true,
  coverTitle: 'PROPOSTA TÉCNICA',
  coverSubtitle: 'Especificações, arquitetura, implantação e operação da solução',
  coverLogo: null,
  coverBackground: DOUBLE_ASSETS.hero,

  headerEnabled: false,
  headerLogo: null,
  headerText: null,
  headerHeight: 90,

  footerEnabled: false,
  footerText: null,
  footerLogo: null,
  footerHeight: 70,

  indexEnabled: true,
  indexTitle: 'Índice',

  // Estrutura mais completa (foco técnico), típica de propostas de MSSP/infra.
  sections: [
    {
      id: 'about',
      title: 'Quem Somos',
      enabled: true,
      order: 1,
      layout: 'double-who',
      pageBackground: DOUBLE_ASSETS.who,
      body:
        'A Double TI + Telecom atua há mais de 30 anos com foco em infraestrutura crítica, conectividade e segurança. Entregamos projetos com governança e operação contínua, combinando experiência de campo, processos e proximidade com o cliente.',
      highlights: ['+30 anos', '+500 clientes', '+5000 projetos']
    },
    {
      id: 'objective',
      title: 'Objetivo e Escopo',
      enabled: true,
      order: 2,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'Definir e detalhar a implantação e operação de um Firewall Virtual (NGFW) gerenciado, garantindo segurança perimetral, segmentação de rede, conectividade via VPN e visibilidade do tráfego, com monitoramento e suporte 24x7.',
      bullets: [
        'Levantamento e alinhamento de requisitos (aplicações, usuários, links, políticas e integrações)',
        'Provisionamento do ambiente virtualizado com recursos dimensionados (CPU/RAM/throughput/sessões)',
        'Configuração inicial (políticas, NAT, objetos, roteamento, VPNs e perfis de segurança)',
        'Plano de testes, corte assistido e validação (aceite técnico)',
        'Operação contínua: monitoramento, ajustes, relatórios e suporte'
      ],
      placeholders: ['Itens fora de escopo (opcional): gestão de endpoints, SIEM, SOC dedicado, etc.']
    },
    {
      id: 'overview',
      title: 'Visão Geral da Solução',
      enabled: true,
      order: 3,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'O serviço consiste em um NGFW virtual hospedado em data center, com gestão centralizada e políticas customizadas por cliente. A solução contempla inspeção de tráfego, controle de aplicações, prevenção de intrusões, VPNs e geração de relatórios.',
      bullets: [
        'NGFW virtual (Fortinet ou Check Point), com recursos de segurança por assinatura/licenciamento',
        'Gerência e governança de mudanças (solicitação, validação e aplicação de regras)',
        'Logs e relatórios: tráfego, eventos, tentativas de acesso e indicadores de segurança',
        'Escalabilidade sob demanda e atualização contínua de assinaturas (quando aplicável)'
      ]
    },
    {
      id: 'architecture',
      title: 'Arquitetura e Topologia',
      enabled: true,
      order: 4,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'A topologia de referência interliga o ambiente do cliente ao NGFW virtual por links dedicados ou Internet (VPN). O tráfego pode ser direcionado para inspeção total/parcial conforme políticas, com segmentação por VLAN/sub-redes e regras específicas.',
      bullets: [
        'Site-to-site IPsec para matriz/filiais e/ou integração com nuvens públicas (quando aplicável)',
        'Criação de zonas/segmentos (ex.: LAN, SERVIDORES, VOIP, GUEST, DMZ, VPN)',
        'Políticas de saída (egress) e publicação de serviços (ingress) via NAT e regras por aplicação',
        'Opções de roteamento: estático, dinâmico (quando aplicável) e failover de links'
      ],
      placeholders: ['Diagrama de topologia (anexo): inserir desenho do ambiente do cliente.']
    },
    {
      id: 'sizing',
      title: 'Dimensionamento e Capacidade',
      enabled: true,
      order: 5,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'O dimensionamento considera volume de tráfego, quantidade de usuários, conexões simultâneas, perfis de inspeção (IPS/AV/SSL) e número de túneis VPN. O sizing final é validado após o levantamento de requisitos.',
      bullets: [
        'Parâmetros: throughput (L3/L7), UTM, sessões simultâneas, novas conexões/s, túneis VPN e usuários remotos',
        'Perfis de inspeção (ex.: SSL inspection) impactam desempenho e devem ser planejados',
        'Crescimento: aumento de recursos (CPU/RAM) e licenças sob demanda'
      ],
      placeholders: [
        'Sizing inicial proposto: [x] vCPU, [y] GB RAM, [z] Mbps UTM, [n] sessões',
        'Retenção de logs: [dias] e volume estimado'
      ]
    },
    {
      id: 'security_features',
      title: 'Recursos de Segurança (NGFW)',
      enabled: true,
      order: 6,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'Controle de aplicações (App Control) e categorização de tráfego',
        'IPS/IDS com assinaturas atualizadas e políticas por risco',
        'Antivírus/antimalware em tráfego web e arquivos (quando aplicável)',
        'Filtro Web/DNS e bloqueio por categoria/domínio',
        'Controle de acesso (identidade, grupos, IPs, horários) e segmentação',
        'Inspeção SSL/TLS (opcional) com política por aplicação/categoria',
        'Proteção contra DoS/DDoS (rate limiting, policies e detecção)'
      ],
      placeholders: ['Lista final de features habilitadas será definida no kickoff técnico.']
    },
    {
      id: 'policies',
      title: 'Políticas, NAT, Segmentação e Filtros',
      enabled: true,
      order: 7,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'As políticas são organizadas por zonas e serviços, com objetos padronizados e documentação. Alterações seguem fluxo de solicitação, validação e aplicação, garantindo rastreabilidade.',
      bullets: [
        'Regras por zona (ex.: LAN -> Internet, LAN -> DC, VPN -> SERVIDORES) com princípio do menor privilégio',
        'NAT de saída e publicação de serviços (DNAT/Port Forward) conforme necessidade',
        'Listas de permissão/bloqueio e filtros por categoria de aplicação',
        'Gestão de mudanças: janela, rollback e aprovação (quando aplicável)'
      ]
    },
    {
      id: 'connectivity',
      title: 'Conectividade, VPN e Integrações',
      enabled: true,
      order: 8,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'VPN site-to-site IPsec (matriz/filiais/terceiros) com criptografia e parâmetros acordados',
        'VPN de acesso remoto (SSL-VPN ou IPsec) com grupos e políticas por perfil',
        'Integrações: roteadores, switches, links dedicados, VoIP/PABX, servidores e nuvens',
        'Autenticação (opcional): AD/LDAP/RADIUS e MFA conforme tecnologia suportada'
      ],
      placeholders: ['Inventário de túneis: origem, destino, redes, criptografia, keepalive, etc.']
    },
    {
      id: 'ha_dr',
      title: 'Alta Disponibilidade e Resiliência',
      enabled: true,
      order: 9,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'Quando contratado, o serviço pode operar em alta disponibilidade (HA), com redundância e mecanismos de failover. Estratégias de backup e restauração preservam configurações e políticas.',
      bullets: [
        'HA (active-passive) com sincronização de políticas e estado (quando suportado)',
        'Failover automatizado e testes periódicos de comutação',
        'Backup de configurações e versionamento para rollback',
        'Resiliência de infraestrutura: energia, climatização e conectividade do data center'
      ],
      placeholders: ['Modelo HA: [single] / [HA] / [multi-site], conforme contratação.']
    },
    {
      id: 'monitoring',
      title: 'Monitoramento, Logs e Relatórios',
      enabled: true,
      order: 10,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'Monitoramento 24x7 de disponibilidade, consumo de recursos e saúde do serviço',
        'Acompanhamento de eventos de segurança e alertas (por severidade)',
        'Relatórios periódicos: tráfego, top aplicações, bloqueios, tentativas de intrusão e tendências',
        'Exportação de logs (opcional): Syslog/SIEM conforme necessidade do cliente'
      ]
    },
    {
      id: 'deployment',
      title: 'Implantação (Plano de Execução)',
      enabled: true,
      order: 11,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'A implantação é conduzida por etapas, minimizando risco e garantindo previsibilidade. O corte é realizado em janela acordada e com plano de reversão.',
      bullets: [
        'Kickoff e discovery: levantamento de redes, serviços, regras e integrações',
        'Design e aprovação: arquitetura, segmentação, padrões de objetos e políticas',
        'Provisionamento e configuração: base NGFW, VPNs, NAT, perfis de segurança e logs',
        'Testes: conectividade, navegação, publicação de serviços, performance e failover (se HA)',
        'Cutover assistido e validação: acompanhamento e ajustes finos'
      ],
      placeholders: ['Cronograma: [data] a [data], com janela de corte em [dia/horário].']
    },
    {
      id: 'tests',
      title: 'Plano de Testes e Aceite',
      enabled: true,
      order: 12,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'Teste de navegação e políticas de saída (sites, categorias e aplicações)',
        'Teste de VPNs (site-to-site e acesso remoto), rotas e reachability entre redes',
        'Teste de publicação de serviços (DNAT) e validação de portas',
        'Teste de logs/relatórios e integração com Syslog/SIEM (se aplicável)',
        'Teste de failover/retorno (quando HA contratado) e critérios de aceite'
      ]
    },
    {
      id: 'sla_support',
      title: 'Operação, Suporte e SLA',
      enabled: true,
      order: 13,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'Atendimento 24x7 para indisponibilidade e incidentes críticos (conforme SLA)',
        'Canal de atendimento e registro de chamados (prioridade, status e histórico)',
        'Janelas de manutenção programada (quando necessárias) com comunicação prévia',
        'Relatórios de operação e reuniões de acompanhamento (opcional)'
      ],
      placeholders: [
        'SLA proposto: [P1/P2/P3], tempos de resposta e acionamento',
        'Horário comercial / 24x7 conforme contrato'
      ]
    },
    {
      id: 'assumptions',
      title: 'Premissas, Limitações e Responsabilidades',
      enabled: true,
      order: 14,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      bullets: [
        'O cliente é responsável por informações e acessos necessários para implantação (redes, IPs, links, contatos técnicos)',
        'Regras e exceções devem ser solicitadas formalmente e aprovadas pelo responsável do cliente',
        'Softwares/licenças de terceiros e integrações externas são de responsabilidade do cliente, salvo contratação adicional',
        'Boas práticas: revisão periódica de regras, segregação por perfis e gestão de credenciais'
      ]
    },
    {
      id: 'compliance',
      title: 'Segurança da Informação, Privacidade e LGPD',
      enabled: true,
      order: 15,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      body:
        'O tratamento de dados pessoais ocorrerá apenas sob instruções do controlador (contratante) e para finalidades necessárias à execução do serviço, em conformidade com a LGPD (Lei 13.709/2018) e demais legislações aplicáveis.',
      bullets: [
        'Princípios: minimização, necessidade e confidencialidade',
        'Controles: acesso restrito, logging e segregação',
        'Retenção e descarte: conforme contrato e políticas do cliente'
      ]
    },
    {
      id: 'annexes',
      title: 'Anexos (Diagramas, Matriz de Regras)',
      enabled: true,
      order: 16,
      layout: 'double-page',
      pageBackground: DOUBLE_ASSETS.page,
      placeholders: [
        'Diagrama de topologia (rede atual e rede proposta)',
        'Inventário de túneis VPN (origem/destino/redes/parâmetros)',
        'Matriz de regras (origem/destino/serviço/ação/perfis)',
        'Lista de publicações (DNAT) e acessos remotos'
      ]
    }
  ],

  ...DOUBLE_BRAND
};

module.exports = {
  propostaComercialDouble,
  propostaTecnicaDouble
};
