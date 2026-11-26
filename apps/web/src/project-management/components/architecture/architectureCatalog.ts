import { MarkerType } from '@xyflow/react';

export type NodeAccentKey = 'blue' | 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

export const ACCENT_PALETTE: Record<
  NodeAccentKey,
  { label: string; hex: string; border: string; bg: string; badge: string; glow: string }
> = {
  blue: {
    label: 'Azul',
    hex: '#3b82f6',
    border: 'border-blue-500/60',
    bg: 'bg-blue-500/15',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    glow: 'shadow-[0_0_24px_rgba(59,130,246,0.28)]',
  },
  cyan: {
    label: 'Ciano',
    hex: '#22d3ee',
    border: 'border-cyan-400/60',
    bg: 'bg-cyan-500/15',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    glow: 'shadow-[0_0_24px_rgba(34,211,238,0.28)]',
  },
  emerald: {
    label: 'Esmeralda',
    hex: '#34d399',
    border: 'border-emerald-400/60',
    bg: 'bg-emerald-500/15',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    glow: 'shadow-[0_0_24px_rgba(52,211,153,0.28)]',
  },
  amber: {
    label: 'Âmbar',
    hex: '#f59e0b',
    border: 'border-amber-400/60',
    bg: 'bg-amber-500/15',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    glow: 'shadow-[0_0_24px_rgba(245,158,11,0.28)]',
  },
  violet: {
    label: 'Violeta',
    hex: '#a855f7',
    border: 'border-purple-400/60',
    bg: 'bg-purple-500/15',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    glow: 'shadow-[0_0_24px_rgba(168,85,247,0.28)]',
  },
  rose: {
    label: 'Alerta',
    hex: '#f43f5e',
    border: 'border-rose-400/60',
    bg: 'bg-rose-500/15',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    glow: 'shadow-[0_0_24px_rgba(244,63,94,0.28)]',
  },
  slate: {
    label: 'Neutro',
    hex: '#94a3b8',
    border: 'border-slate-400/50',
    bg: 'bg-slate-500/15',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    glow: 'shadow-[0_0_24px_rgba(148,163,184,0.2)]',
  },
};

export const EDGE_COLORS = [
  { label: 'Ciano (Fibra)', hex: '#22d3ee' },
  { label: 'Azul (LAN/WAN)', hex: '#3b82f6' },
  { label: 'Âmbar (Rádio/Backup)', hex: '#f59e0b' },
  { label: 'Esmeralda (PoE/Wi-Fi)', hex: '#34d399' },
  { label: 'Violeta (VPN/Cloud)', hex: '#a855f7' },
  { label: 'Vermelho (Crítico)', hex: '#f43f5e' },
  { label: 'Cinza (Padrão)', hex: '#94a3b8' },
];

export type CatalogItem = {
  id: string;
  category: 'infra' | 'security' | 'cloud' | 'physical';
  label: string;
  sublabel: string;
  icon: string;
  accent: NodeAccentKey;
  imageName?: string;
  variant?: 'physical';
  physicalType?: 'radio' | 'dish' | 'tower' | 'rack';
};

export const COMPONENT_CATALOG: CatalogItem[] = [
  // Infra & Rede
  { id: 'fiber', category: 'infra', label: 'Fibra / DIO', sublabel: 'Backbone / FO / OLT', icon: 'fiber', accent: 'cyan', imageName: 'fiber' },
  { id: 'radio', category: 'infra', label: 'Rádio Enlace', sublabel: 'PTP / Backhaul', icon: 'radio', accent: 'amber', imageName: 'radio' },
  { id: 'switch', category: 'infra', label: 'Switch Core/PoE', sublabel: 'VLANs / Trunks / PoE+', icon: 'switch', accent: 'emerald', imageName: 'switch' },
  { id: 'ap', category: 'infra', label: 'Access Point', sublabel: 'Wi-Fi 6 / SSID Corp', icon: 'accessPoint', accent: 'cyan', imageName: 'wifi' },
  { id: 'router', category: 'infra', label: 'Roteador / BGP', sublabel: 'Gateway / WAN / MPLS', icon: 'router', accent: 'blue', imageName: 'router' },
  { id: 'internet', category: 'infra', label: 'Link Operadora', sublabel: 'Internet Dedicada / ASN', icon: 'globe', accent: 'cyan', imageName: 'internet' },
  { id: 'pop', category: 'infra', label: 'POP / Datacenter', sublabel: 'Ponto de Presença', icon: 'pop', accent: 'blue', imageName: 'pop' },

  // Segurança
  { id: 'firewall', category: 'security', label: 'Firewall NGFW', sublabel: 'Segurança / SD-WAN / VPN', icon: 'firewall', accent: 'rose', imageName: 'fortinet' },
  { id: 'vpn', category: 'security', label: 'Concentrador VPN', sublabel: 'IPsec / SSL / Zero Trust', icon: 'lock', accent: 'violet', imageName: 'wireguard' },
  { id: 'monitor', category: 'security', label: 'NOC / Monitoramento', sublabel: 'Zabbix / Grafana / SNMP', icon: 'activity', accent: 'emerald', imageName: 'grafana' },

  // Cloud & Compute
  { id: 'server', category: 'cloud', label: 'Servidor / VM', sublabel: 'Compute / Hypervisor', icon: 'server', accent: 'blue', imageName: 'server' },
  { id: 'database', category: 'cloud', label: 'Banco de Dados', sublabel: 'PostgreSQL / Cluster', icon: 'database', accent: 'violet', imageName: 'postgresql' },
  { id: 'cloud', category: 'cloud', label: 'Cloud / SaaS', sublabel: 'AWS / Azure / GCP', icon: 'cloud', accent: 'violet', imageName: 'cloud' },
  { id: 'container', category: 'cloud', label: 'Cluster K8s', sublabel: 'Kubernetes / Docker', icon: 'cpu', accent: 'cyan', imageName: 'kubernetes' },
  { id: 'client', category: 'cloud', label: 'Cliente / Terminal', sublabel: 'Estação / Mobile', icon: 'smartphone', accent: 'slate', imageName: 'apple' },

  // Físico / Telecom
  { id: 'phys-radio', category: 'physical', label: 'Rádio Físico', sublabel: 'PTP / Torre', icon: 'radio', accent: 'amber', variant: 'physical', physicalType: 'radio' },
  { id: 'phys-dish', category: 'physical', label: 'Antena / Dish', sublabel: 'Enlace Parabólico', icon: 'radio', accent: 'blue', variant: 'physical', physicalType: 'dish' },
  { id: 'phys-tower', category: 'physical', label: 'Torre / Mastro', sublabel: 'Estrutura Física', icon: 'pop', accent: 'cyan', variant: 'physical', physicalType: 'tower' },
  { id: 'phys-rack', category: 'physical', label: 'Rack / POP 42U', sublabel: 'DIO / OLT / Patch Panel', icon: 'switch', accent: 'emerald', variant: 'physical', physicalType: 'rack' },
];

export const CATEGORY_LABELS: Record<CatalogItem['category'], string> = {
  infra: 'Rede & Telecom',
  security: 'Segurança & NOC',
  cloud: 'Cloud & Servidores',
  physical: 'Equipamentos Físicos',
};

export type TemplateDefinition = {
  key: string;
  label: string;
  description: string;
  nodes: any[];
  edges: any[];
};

const edgeArrow = (color: string) => ({
  type: MarkerType.ArrowClosed,
  color,
  width: 18,
  height: 18,
});

export const ARCHITECTURE_TEMPLATES: Record<string, TemplateDefinition> = {
  blank: {
    key: 'blank',
    label: 'Em Branco',
    description: 'Canvas limpo para começar do zero',
    nodes: [],
    edges: [],
  },
  'fiber-radio': {
    key: 'fiber-radio',
    label: 'Fibra + Rádio',
    description: 'Backbone óptico, enlace PTP e distribuição Wi-Fi',
    nodes: [
      {
        id: 'zone-core',
        type: 'zone',
        position: { x: 260, y: -20 },
        style: { width: 420, height: 270 },
        data: { label: 'NÚCLEO / OPERADORA', sublabel: 'Backbone & POP Principal', accent: 'cyan', borderStyle: 'dashed' },
        zIndex: 1,
      },
      {
        id: 'zone-remote',
        type: 'zone',
        position: { x: 40, y: 290 },
        style: { width: 920, height: 320 },
        data: { label: 'REDE DE ACESSO & DISTRIBUIÇÃO', sublabel: 'Torres PTP + Camada PoE', accent: 'blue', borderStyle: 'dashed' },
        zIndex: 1,
      },
      { id: 'internet', type: 'arch', position: { x: 350, y: 20 }, data: { label: 'Operadora / Internet', icon: 'globe', sublabel: 'Link Dedicado BGP', accent: 'cyan', imageName: 'internet', metaIp: 'AS 262xxx', metaStatus: 'online' } },
      { id: 'pop', type: 'arch', position: { x: 350, y: 145 }, data: { label: 'POP Fibra', icon: 'pop', sublabel: 'DIO / OLT / Core', accent: 'blue', imageName: 'fiber', metaVlan: '10G SFP+' } },
      { id: 'tower-a', type: 'arch', position: { x: 80, y: 345 }, data: { label: 'Torre Rádio A', icon: 'radio', sublabel: 'Ponto de transmissão', accent: 'amber', imageName: 'radio', metaIp: '10.10.1.1' } },
      { id: 'tower-b', type: 'arch', position: { x: 380, y: 345 }, data: { label: 'Torre Rádio B', icon: 'radio', sublabel: 'Ponto remoto', accent: 'amber', imageName: 'radio', metaIp: '10.10.1.2' } },
      { id: 'core-switch', type: 'arch', position: { x: 680, y: 345 }, data: { label: 'Switch Core', icon: 'switch', sublabel: 'VLANs / Trunks', accent: 'emerald', imageName: 'cisco', metaVlan: 'VLAN 10,20' } },
      { id: 'ap-area', type: 'arch', position: { x: 680, y: 495 }, data: { label: 'Access Points', icon: 'accessPoint', sublabel: 'Wi-Fi 6 Corporativo', accent: 'cyan', imageName: 'wifi', metaStatus: 'online' } },
    ],
    edges: [
      { id: 'e-fiber-1', source: 'internet', target: 'pop', label: 'Fibra 10G', type: 'smoothstep', animated: true, style: { stroke: '#22d3ee', strokeWidth: 2.5 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e-radio-1', source: 'pop', target: 'tower-a', label: 'Fibra até torre', type: 'smoothstep', style: { stroke: '#22d3ee', strokeWidth: 2.5 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e-radio-2', source: 'tower-a', target: 'tower-b', label: 'Rádio Enlace PTP', type: 'smoothstep', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2.5, strokeDasharray: '6 5' }, markerEnd: edgeArrow('#f59e0b') },
      { id: 'e-lan-1', source: 'tower-b', target: 'core-switch', label: 'Backhaul 1G', type: 'smoothstep', style: { stroke: '#3b82f6', strokeWidth: 2.5 }, markerEnd: edgeArrow('#3b82f6') },
      { id: 'e-lan-2', source: 'core-switch', target: 'ap-area', label: 'PoE+ / Wi-Fi', type: 'smoothstep', style: { stroke: '#34d399', strokeWidth: 2.5 }, markerEnd: edgeArrow('#34d399') },
    ],
  },
  'sd-wan': {
    key: 'sd-wan',
    label: 'SD-WAN Matriz-Filial',
    description: 'Firewall FortiGate, VPN IPsec redundante e Wi-Fi corporativo',
    nodes: [
      {
        id: 'zone-matriz',
        type: 'zone',
        position: { x: 40, y: 170 },
        style: { width: 340, height: 390 },
        data: { label: 'MATRIZ', sublabel: '10.10.0.0/16', accent: 'blue', borderStyle: 'dashed' },
        zIndex: 1,
      },
      {
        id: 'zone-filial',
        type: 'zone',
        position: { x: 540, y: 170 },
        style: { width: 340, height: 390 },
        data: { label: 'FILIAL 01', sublabel: '10.20.0.0/16', accent: 'emerald', borderStyle: 'dashed' },
        zIndex: 1,
      },
      { id: 'wan-cloud', type: 'arch', position: { x: 335, y: 15 }, data: { label: 'SD-WAN / MPLS + Fibra', icon: 'cloud', sublabel: 'Dupla abordagem WAN', accent: 'cyan', imageName: 'cloud' } },
      { id: 'fw-matriz', type: 'arch', position: { x: 95, y: 230 }, data: { label: 'Firewall 40F Matriz', icon: 'firewall', sublabel: 'NGFW / SD-WAN', accent: 'rose', imageName: 'fortinet', metaIp: '10.10.0.1', metaStatus: 'online' } },
      { id: 'sw-matriz', type: 'arch', position: { x: 95, y: 400 }, data: { label: 'Switch Core Matriz', icon: 'switch', sublabel: 'Servidores + LAN', accent: 'emerald', imageName: 'switch', metaVlan: 'VLAN 10-50' } },
      { id: 'fw-filial', type: 'arch', position: { x: 595, y: 230 }, data: { label: 'MikroTik RB4011', icon: 'router', sublabel: 'Gateway / VPN Filial', accent: 'blue', imageName: 'mikrotik', metaIp: '10.20.0.1', metaStatus: 'online' } },
      { id: 'ap-filial', type: 'arch', position: { x: 595, y: 400 }, data: { label: 'Ubiquiti U6+ Wi-Fi 6', icon: 'accessPoint', sublabel: 'Cobertura Corporativa', accent: 'cyan', imageName: 'ubiquiti', metaVlan: '3x APs PoE' } },
    ],
    edges: [
      { id: 'e-sd1', source: 'wan-cloud', target: 'fw-matriz', label: 'Link Dedicado', type: 'smoothstep', style: { stroke: '#22d3ee', strokeWidth: 2.5 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e-sd2', source: 'wan-cloud', target: 'fw-filial', label: 'Fibra + 4G Failover', type: 'smoothstep', style: { stroke: '#22d3ee', strokeWidth: 2.5 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e-sd3', source: 'fw-matriz', target: 'fw-filial', label: 'Túnel VPN IPsec', type: 'smoothstep', animated: true, style: { stroke: '#a855f7', strokeWidth: 2.5, strokeDasharray: '6 5' }, markerEnd: edgeArrow('#a855f7') },
      { id: 'e-sd4', source: 'fw-matriz', target: 'sw-matriz', label: 'Trunk 10G', type: 'smoothstep', style: { stroke: '#34d399', strokeWidth: 2.5 }, markerEnd: edgeArrow('#34d399') },
      { id: 'e-sd5', source: 'fw-filial', target: 'ap-filial', label: 'PoE+ / VLAN Corp', type: 'smoothstep', style: { stroke: '#34d399', strokeWidth: 2.5 }, markerEnd: edgeArrow('#34d399') },
    ],
  },
  'switch-ap': {
    key: 'switch-ap',
    label: 'Switches + APs',
    description: 'Topologia hierárquica Core -> Acesso PoE -> Wi-Fi',
    nodes: [
      { id: 'router', type: 'arch', position: { x: 380, y: 20 }, data: { label: 'Roteador / Firewall', icon: 'firewall', sublabel: 'Gateway / NAT / VPN', accent: 'rose', imageName: 'fortinet' } },
      { id: 'core-switch', type: 'arch', position: { x: 380, y: 165 }, data: { label: 'Switch Core', icon: 'switch', sublabel: '10G / VLANs', accent: 'blue', imageName: 'cisco' } },
      { id: 'access-1', type: 'arch', position: { x: 90, y: 330 }, data: { label: 'Switch Acesso 1', icon: 'switch', sublabel: 'PoE / Andar 1', accent: 'emerald', imageName: 'switch' } },
      { id: 'access-2', type: 'arch', position: { x: 380, y: 330 }, data: { label: 'Switch Acesso 2', icon: 'switch', sublabel: 'PoE / Andar 2', accent: 'emerald', imageName: 'switch' } },
      { id: 'access-3', type: 'arch', position: { x: 670, y: 330 }, data: { label: 'Switch Acesso 3', icon: 'switch', sublabel: 'PoE / Galpão', accent: 'emerald', imageName: 'switch' } },
      { id: 'ap-1', type: 'arch', position: { x: 90, y: 495 }, data: { label: 'AP Escritório', icon: 'accessPoint', sublabel: 'SSID Corp / Guest', accent: 'cyan', imageName: 'wifi' } },
      { id: 'ap-2', type: 'arch', position: { x: 380, y: 495 }, data: { label: 'AP Produção', icon: 'accessPoint', sublabel: 'Cobertura industrial', accent: 'cyan', imageName: 'wifi' } },
      { id: 'ap-3', type: 'arch', position: { x: 670, y: 495 }, data: { label: 'AP Externo', icon: 'accessPoint', sublabel: 'Área externa', accent: 'cyan', imageName: 'wifi' } },
    ],
    edges: [
      { id: 'e1', source: 'router', target: 'core-switch', label: 'Uplink 10G', type: 'smoothstep', style: { stroke: '#3b82f6', strokeWidth: 2.5 }, markerEnd: edgeArrow('#3b82f6') },
      { id: 'e2', source: 'core-switch', target: 'access-1', label: 'Fibra 10G', type: 'smoothstep', style: { stroke: '#22d3ee', strokeWidth: 2 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e3', source: 'core-switch', target: 'access-2', label: 'Fibra 10G', type: 'smoothstep', style: { stroke: '#22d3ee', strokeWidth: 2 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e4', source: 'core-switch', target: 'access-3', label: 'Fibra 10G', type: 'smoothstep', style: { stroke: '#22d3ee', strokeWidth: 2 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e5', source: 'access-1', target: 'ap-1', label: 'PoE+', type: 'smoothstep', style: { stroke: '#34d399', strokeWidth: 2 }, markerEnd: edgeArrow('#34d399') },
      { id: 'e6', source: 'access-2', target: 'ap-2', label: 'PoE+', type: 'smoothstep', style: { stroke: '#34d399', strokeWidth: 2 }, markerEnd: edgeArrow('#34d399') },
      { id: 'e7', source: 'access-3', target: 'ap-3', label: 'PoE+', type: 'smoothstep', style: { stroke: '#34d399', strokeWidth: 2 }, markerEnd: edgeArrow('#34d399') },
    ],
  },
  '3-tier': {
    key: '3-tier',
    label: 'Web 3-Tier',
    description: 'Frontend SPA, API Gateway e Banco PostgreSQL',
    nodes: [
      { id: 'client', type: 'arch', position: { x: 250, y: 40 }, data: { label: 'Web Client', icon: 'globe', sublabel: 'React / SPA', accent: 'cyan', imageName: 'react' } },
      { id: 'api', type: 'arch', position: { x: 250, y: 195 }, data: { label: 'API Gateway', icon: 'server', sublabel: 'Node.js Express', accent: 'emerald', imageName: 'nodedotjs' } },
      { id: 'db', type: 'arch', position: { x: 250, y: 350 }, data: { label: 'Database', icon: 'database', sublabel: 'PostgreSQL', accent: 'violet', imageName: 'postgresql' } },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'api', label: 'HTTPS / REST', type: 'smoothstep', animated: true, style: { stroke: '#22d3ee', strokeWidth: 2 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e2', source: 'api', target: 'db', label: 'TLS / Prisma', type: 'smoothstep', style: { stroke: '#a855f7', strokeWidth: 2 }, markerEnd: edgeArrow('#a855f7') },
    ],
  },
  microservices: {
    key: 'microservices',
    label: 'Microserviços',
    description: 'API Gateway, serviços isolados e bancos dedicados',
    nodes: [
      { id: 'client', type: 'arch', position: { x: 380, y: 30 }, data: { label: 'Mobile & Web', icon: 'smartphone', sublabel: 'iOS / Android / SPA', accent: 'cyan', imageName: 'apple' } },
      { id: 'gateway', type: 'arch', position: { x: 380, y: 175 }, data: { label: 'API Gateway', icon: 'cloud', sublabel: 'Kong / Nginx', accent: 'blue', imageName: 'nginx' } },
      { id: 'auth', type: 'arch', position: { x: 100, y: 340 }, data: { label: 'Auth Service', icon: 'firewall', sublabel: 'Go / OAuth2', accent: 'rose', imageName: 'go' } },
      { id: 'users', type: 'arch', position: { x: 380, y: 340 }, data: { label: 'Users Service', icon: 'server', sublabel: 'Node.js', accent: 'emerald', imageName: 'nodedotjs' } },
      { id: 'orders', type: 'arch', position: { x: 660, y: 340 }, data: { label: 'Orders Service', icon: 'server', sublabel: 'Java / Spring', accent: 'amber', imageName: 'java' } },
      { id: 'db-auth', type: 'arch', position: { x: 100, y: 495 }, data: { label: 'Auth Cache', icon: 'database', sublabel: 'Redis', accent: 'rose', imageName: 'redis' } },
      { id: 'db-users', type: 'arch', position: { x: 380, y: 495 }, data: { label: 'Users DB', icon: 'database', sublabel: 'PostgreSQL', accent: 'blue', imageName: 'postgresql' } },
      { id: 'db-orders', type: 'arch', position: { x: 660, y: 495 }, data: { label: 'Orders DB', icon: 'database', sublabel: 'MongoDB', accent: 'emerald', imageName: 'mongodb' } },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'gateway', label: 'HTTPS', type: 'smoothstep', animated: true, style: { stroke: '#22d3ee', strokeWidth: 2 }, markerEnd: edgeArrow('#22d3ee') },
      { id: 'e2', source: 'gateway', target: 'auth', type: 'smoothstep', style: { stroke: '#3b82f6', strokeWidth: 2 }, markerEnd: edgeArrow('#3b82f6') },
      { id: 'e3', source: 'gateway', target: 'users', type: 'smoothstep', style: { stroke: '#3b82f6', strokeWidth: 2 }, markerEnd: edgeArrow('#3b82f6') },
      { id: 'e4', source: 'gateway', target: 'orders', type: 'smoothstep', style: { stroke: '#3b82f6', strokeWidth: 2 }, markerEnd: edgeArrow('#3b82f6') },
      { id: 'e5', source: 'auth', target: 'db-auth', type: 'smoothstep', style: { stroke: '#f43f5e', strokeWidth: 2 }, markerEnd: edgeArrow('#f43f5e') },
      { id: 'e6', source: 'users', target: 'db-users', type: 'smoothstep', style: { stroke: '#34d399', strokeWidth: 2 }, markerEnd: edgeArrow('#34d399') },
      { id: 'e7', source: 'orders', target: 'db-orders', type: 'smoothstep', style: { stroke: '#f59e0b', strokeWidth: 2 }, markerEnd: edgeArrow('#f59e0b') },
    ],
  },
};
