import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Panel,
  MarkerType,
  Connection,
  Edge,
  ConnectionMode,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Server,
  Database,
  Globe,
  Smartphone,
  Cloud,
  ArrowLeft,
  Layers,
  Box,
  Upload,
  Download,
  Save,
  Wifi,
  RadioTower,
  Network,
  Router,
  Cable,
  Shield,
  Building2,
  ImagePlus,
  Trash2,
  FolderOpen,
  Clock3,
  Eye,
  Pencil,
  PenLine,
  Undo2,
  Plus,
  X,
  FileText
} from 'lucide-react';
import type { Space } from '../types';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const iconMap: Record<string, any> = {
  server: Server,
  database: Database,
  globe: Globe,
  smartphone: Smartphone,
  cloud: Cloud,
  router: Router,
  switch: Network,
  accessPoint: Wifi,
  radio: RadioTower,
  fiber: Cable,
  firewall: Shield,
  pop: Building2,
};

const BackgroundImageNode = ({ data }: any) => (
  <div
    className="pointer-events-none overflow-hidden rounded-xl border border-[#2b3d56]/80 bg-[#050914]/60 shadow-2xl"
    style={{
      width: data.width || 1280,
      height: data.height || 760,
      opacity: data.opacity ?? 0.38
    }}
  >
    <img
      src={data.src}
      alt="Imagem de fundo do diagrama"
      className="h-full w-full object-contain"
      draggable={false}
    />
  </div>
);

const PhysicalDeviceShape = ({ type }: { type: string }) => {
  if (type === 'tower') {
    return (
      <svg viewBox="0 0 220 260" className="h-64 w-56 overflow-visible drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]">
        <defs>
          <linearGradient id="towerSteel" x1="0" x2="1">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
        </defs>
        <path d="M88 244 L110 22 L132 244 Z" fill="rgba(15,23,42,0.3)" stroke="url(#towerSteel)" strokeWidth="5" />
        <path d="M91 218 H129 M94 190 H126 M97 160 H123 M100 132 H120 M103 104 H117 M106 76 H114" stroke="#94a3b8" strokeWidth="4" />
        <path d="M92 218 L126 190 M128 218 L94 190 M95 190 L123 160 M125 190 L97 160 M98 160 L120 132 M122 160 L100 132 M101 132 L117 104 M119 132 L103 104 M104 104 L114 76 M116 104 L106 76" stroke="#f97316" strokeWidth="3" />
        <path d="M110 22 V2" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="56" cy="95" rx="23" ry="36" fill="#e5e7eb" stroke="#64748b" strokeWidth="4" transform="rotate(-18 56 95)" />
        <path d="M76 96 H104" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="164" cy="125" rx="25" ry="38" fill="#f1f5f9" stroke="#64748b" strokeWidth="4" transform="rotate(16 164 125)" />
        <path d="M137 125 H115" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
        <rect x="36" y="38" width="14" height="50" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="3" />
        <rect x="170" y="58" width="14" height="58" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="3" />
      </svg>
    );
  }

  if (type === 'rack') {
    return (
      <svg viewBox="0 0 280 220" className="h-56 w-72 overflow-visible drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]">
        <defs>
          <linearGradient id="rackMetal" x1="0" x2="1">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="48%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>
        <rect x="36" y="8" width="208" height="204" rx="10" fill="url(#rackMetal)" stroke="#64748b" strokeWidth="5" />
        {[36, 68, 100, 132].map((y) => (
          <g key={y}>
            <rect x="58" y={y} width="164" height="20" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            {Array.from({ length: 10 }).map((_, index) => (
              <rect key={index} x={72 + index * 13} y={y + 5} width="8" height="8" rx="1.5" fill={index % 3 === 0 ? '#22d3ee' : '#94a3b8'} />
            ))}
            <circle cx="210" cy={y + 10} r="3" fill="#22c55e" />
          </g>
        ))}
        <path d="M82 58 C82 86 158 78 158 105 C158 132 92 119 92 148" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
        <path d="M116 58 C116 92 190 80 190 118 C190 154 126 138 126 166" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
        <rect x="62" y="172" width="156" height="22" rx="4" fill="#020617" stroke="#334155" strokeWidth="2" />
      </svg>
    );
  }

  if (type === 'dish') {
    return (
      <svg viewBox="0 0 300 190" className="h-48 w-80 overflow-visible drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]">
        <defs>
          <radialGradient id="dishFace" cx="45%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="64%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="92" rx="78" ry="72" fill="url(#dishFace)" stroke="#475569" strokeWidth="5" />
        <ellipse cx="112" cy="92" rx="42" ry="38" fill="none" stroke="#94a3b8" strokeWidth="3" opacity="0.55" />
        <circle cx="112" cy="92" r="8" fill="#64748b" />
        <path d="M166 92 H214" stroke="#94a3b8" strokeWidth="10" strokeLinecap="round" />
        <rect x="207" y="62" width="48" height="62" rx="10" fill="#e5e7eb" stroke="#64748b" strokeWidth="5" />
        <path d="M255 93 H286" stroke="#64748b" strokeWidth="9" strokeLinecap="round" />
        <path d="M76 150 L52 184 M139 150 L162 184" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
        <path d="M204 76 C184 62 180 40 176 22" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
        <path d="M214 70 C198 50 197 34 197 14" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 190" className="h-48 w-80 overflow-visible drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]">
      <defs>
        <linearGradient id="radioBody" x1="0" x2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="55%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <radialGradient id="radioDish" cx="42%" cy="42%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#dbe3ec" />
          <stop offset="100%" stopColor="#94a3b8" />
        </radialGradient>
      </defs>
      <ellipse cx="220" cy="95" rx="64" ry="58" fill="url(#radioDish)" stroke="#64748b" strokeWidth="5" />
      <rect x="58" y="54" width="94" height="82" rx="16" fill="url(#radioBody)" stroke="#64748b" strokeWidth="5" />
      <rect x="22" y="66" width="48" height="58" rx="12" fill="#cbd5e1" stroke="#64748b" strokeWidth="5" />
      {[0, 1, 2, 3].map((index) => (
        <path key={index} d={`M${34 + index * 7} 78 V112`} stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      ))}
      <circle cx="112" cy="95" r="25" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="4" />
      <path d="M152 95 H178" stroke="#64748b" strokeWidth="9" strokeLinecap="round" />
      <path d="M178 72 H268" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <path d="M178 118 H268" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <path d="M268 72 H302 M268 118 H302" stroke="#94a3b8" strokeWidth="7" strokeLinecap="round" />
      <path d="M86 44 C95 18 118 18 128 44" fill="none" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
      <path d="M70 44 C84 4 132 4 148 44" fill="none" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
      <path d="M252 36 C272 50 284 70 286 95" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
      <path d="M262 22 C292 44 308 70 310 98" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
};

const DiagramSetNodesContext = React.createContext<any>(null);

const connectionHandleClass = [
  'h-3.5',
  'w-3.5',
  'border-2',
  'border-[#111827]',
  'bg-[#ff7a00]',
  'opacity-80',
  'transition-all',
  'hover:scale-125',
  'hover:opacity-100',
  'hover:shadow-[0_0_12px_rgba(255,122,0,0.8)]'
].join(' ');

const ArchNode = ({ id, data, selected }: any) => {
  const [imgError, setImgError] = useState(false);
  const { setNodes: setFlowNodes } = useReactFlow();
  const setDiagramNodes = React.useContext(DiagramSetNodesContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const Icon = iconMap[data.icon] || Box;
  const readOnly = Boolean(data.readOnly);

  const getNormalizedName = (name: string) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower === 'node.js' || lower === 'nodejs') return 'nodedotjs';
    if (lower === 'vue' || lower === 'vuejs') return 'vuedotjs';
    return lower.replace(/[^a-z0-9]/g, '');
  };

  const normalized = getNormalizedName(data.imageName || data.label);
  const customImage = data.uploadedImage || (normalized ? `https://cdn.simpleicons.org/${normalized}/0ea5e9` : null);
  const isPhysical = data.variant === 'physical';
  const usesDeviceShape = isPhysical && data.physicalType && !data.uploadedImage;
  const updateNodeData = (patch: Record<string, any>) => {
    const updateNodes = setDiagramNodes || setFlowNodes;
    updateNodes((nds: any[]) => nds.map((n) => (
      n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
    )));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateNodeData({ uploadedImage: dataUrl });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const editNameBox = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (readOnly) return;
    const nextValue = window.prompt('Nome do ponto/local do componente', data.nameBox || data.siteName || '');
    if (nextValue === null) return;
    updateNodeData({ nameBox: nextValue.trim() });
  };

  useEffect(() => {
    setImgError(false);
  }, [customImage]);

  return (
    <div className={`relative text-slate-200 transition-colors ${usesDeviceShape ? `flex min-w-[330px] flex-col items-center gap-1 rounded-md border border-transparent bg-transparent p-2 ${selected ? 'shadow-[0_0_0_2px_rgba(255,122,0,0.8)]' : ''}` : `bg-[#111827] border ${selected ? 'border-[#ff7a00] shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'border-[#263345]'} rounded-md shadow-lg ${isPhysical ? 'flex min-w-[280px] max-w-[340px] flex-col items-stretch gap-3 p-3' : 'flex min-w-[190px] items-center gap-3 p-4'}`}`}>
      <Handle id="top-target" type="target" position={Position.Top} className={connectionHandleClass} />
      <Handle id="right-target" type="target" position={Position.Right} className={connectionHandleClass} />
      <Handle id="bottom-target" type="target" position={Position.Bottom} className={connectionHandleClass} />
      <Handle id="left-target" type="target" position={Position.Left} className={connectionHandleClass} />
      {data.nameBox && (
        <div className="absolute -top-9 left-1/2 min-w-[130px] -translate-x-1/2 rounded-md border border-[#ff7a00]/70 bg-[#070b16] px-3 py-1.5 text-center text-xs font-black text-slate-100 shadow-lg shadow-black/30">
          {data.nameBox}
        </div>
      )}
      <div
        className={`text-[#ff7a00] flex items-center justify-center shrink-0 overflow-hidden relative group ${usesDeviceShape ? 'h-52 w-80 overflow-visible rounded-none bg-transparent p-0' : `rounded-lg bg-[#070b16] border border-[#263345] ${isPhysical ? 'h-40 w-full p-0' : 'h-12 w-12 p-1.5'}`} ${readOnly ? '' : 'cursor-pointer'}`}
        onClick={(event) => {
          event.stopPropagation();
          if (readOnly) return;
          fileInputRef.current?.click();
        }}
        onMouseDown={(event) => event.stopPropagation()}
        title={readOnly ? 'Imagem do componente' : 'Clique para alterar a imagem'}
      >
        {usesDeviceShape ? (
          <PhysicalDeviceShape type={data.physicalType} />
        ) : customImage && !imgError ? (
          <img
            src={customImage}
            alt={data.label}
            crossOrigin="anonymous"
            onError={() => setImgError(true)}
            className={`${isPhysical ? 'h-full w-full object-contain' : 'h-full w-full object-contain'}`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
            <Icon className={isPhysical ? 'h-9 w-9' : 'h-6 w-6'} />
            {isPhysical && <span className="text-[10px] font-semibold text-slate-500">Enviar foto real</span>}
          </div>
        )}
        {!readOnly && (
          <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center rounded-lg">
            <Upload className="w-4 h-4 text-white" />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageUpload}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
      <div className={isPhysical ? 'min-w-0 text-center' : 'flex-1'}>
        <div className={`font-bold leading-tight ${usesDeviceShape ? 'inline-flex rounded-md border border-[#263345] bg-[#070b16]/90 px-3 py-1 text-xs shadow-lg shadow-black/30' : 'text-sm'}`}>{data.label}</div>
        {data.sublabel && <div className={`${usesDeviceShape ? 'mt-1 text-[9px]' : 'mt-0.5 text-[10px]'} text-slate-400`}>{data.sublabel}</div>}
        {!readOnly && (
          <div className={`mt-2 flex flex-wrap gap-1.5 ${isPhysical ? 'justify-center' : ''}`}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              onMouseDown={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 rounded border border-[#263345] px-2 py-0.5 text-[10px] font-semibold text-slate-400 transition-colors hover:border-[#ff7a00]/70 hover:text-[#ff7a00]"
            >
              <Upload className="h-3 w-3" />
              Imagem
            </button>
            <button
              type="button"
              onClick={editNameBox}
              onMouseDown={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 rounded border border-[#263345] px-2 py-0.5 text-[10px] font-semibold text-slate-400 transition-colors hover:border-[#ff7a00]/70 hover:text-[#ff7a00]"
            >
              <Pencil className="h-3 w-3" />
              Nome
            </button>
          </div>
        )}
      </div>
      <Handle id="top-source" type="source" position={Position.Top} className={connectionHandleClass} />
      <Handle id="right-source" type="source" position={Position.Right} className={connectionHandleClass} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className={connectionHandleClass} />
      <Handle id="left-source" type="source" position={Position.Left} className={connectionHandleClass} />
    </div>
  );
};

const nodeTypes = { arch: ArchNode, backgroundImage: BackgroundImageNode };

const BACKGROUND_IMAGE_NODE_ID = 'diagram-background-image';
const BACKGROUND_IMAGE_NODE_POSITION = { x: -120, y: -80 };
const BACKGROUND_IMAGE_NODE_SIZE = { width: 1280, height: 760 };
const DIAGRAMS_STORAGE_KEY = 'architecture_diagrams_v1';
const LEGACY_DIAGRAM_STORAGE_KEY = 'saved_diagram';

const physicalComponentImages = {
  radio:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Tropo%20Scatter%20Microwave%20System%20Antenna.jpg?width=960',
  dish:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Parabolic%20antennas%20point-to-point%20link.jpg?width=960',
  tower:
    'https://commons.wikimedia.org/wiki/Special:FilePath/Microwave%20Radio%20Antenna%20Tower%20in%20Brewster%2C%20Minnesota%20%2844879513262%29.jpg?width=960',
  rack:
    'https://commons.wikimedia.org/wiki/Special:FilePath/19-inch%20rackmount%20Ethernet%20switches%20and%20patch%20panels.jpg?width=960'
};

type SavedDiagramEntry = {
  id: string;
  name: string;
  clientName?: string;
  projectName?: string;
  templateKey?: string;
  nodes: any[];
  edges: any[];
  drawings?: DrawingStroke[];
  backgroundImage: string | null;
  backgroundOpacity: number;
  createdAt: string;
  updatedAt: string;
};

type DrawingPoint = {
  x: number;
  y: number;
};

type DrawingStroke = {
  id: string;
  color: string;
  width: number;
  points: DrawingPoint[];
};

const readSavedDiagrams = (): SavedDiagramEntry[] => {
  try {
    const saved = localStorage.getItem(DIAGRAMS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Nao foi possivel carregar diagramas salvos.', error);
    return [];
  }
};

const buildLegacyDiagramEntry = (): SavedDiagramEntry | null => {
  try {
    const legacy = localStorage.getItem(LEGACY_DIAGRAM_STORAGE_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    const now = new Date().toISOString();
    return {
      id: 'legacy-diagram',
      name: 'Meu Diagrama',
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      drawings: parsed.drawings || [],
      backgroundImage: parsed.backgroundImage || null,
      backgroundOpacity: typeof parsed.backgroundOpacity === 'number' ? parsed.backgroundOpacity : 0.38,
      createdAt: parsed.createdAt || now,
      updatedAt: parsed.updatedAt || now,
    };
  } catch (error) {
    console.warn('Nao foi possivel migrar o diagrama antigo.', error);
    return null;
  }
};

const defaultEdgeOptions = {
  style: { stroke: '#374151', strokeWidth: 2 },
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#374151',
  },
};

const cloneDiagram = (diagram: { nodes: any[]; edges: any[] }) => ({
  nodes: diagram.nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data }
  })),
  edges: diagram.edges.map((edge) => ({
    ...edge,
    style: edge.style ? { ...edge.style } : undefined,
    markerEnd: edge.markerEnd ? { ...edge.markerEnd } : undefined
  }))
});

const buildStrokePath = (points: DrawingPoint[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.01} ${points[0].y + 0.01}`;
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

const templates = {
  'blank': { nodes: [], edges: [] },
  'fiber-radio': {
    nodes: [
      { id: 'internet', type: 'arch', position: { x: 420, y: 10 }, data: { label: 'Operadora / Internet', icon: 'globe', sublabel: 'Link principal', imageName: 'internet' } },
      { id: 'pop', type: 'arch', position: { x: 420, y: 150 }, data: { label: 'POP Fibra', icon: 'pop', sublabel: 'DIO / OLT / Core', imageName: 'fiber' } },
      { id: 'tower-a', type: 'arch', position: { x: 120, y: 300 }, data: { label: 'Torre Rádio A', icon: 'radio', sublabel: 'Ponto de transmissão', imageName: 'radio' } },
      { id: 'tower-b', type: 'arch', position: { x: 420, y: 300 }, data: { label: 'Torre Rádio B', icon: 'radio', sublabel: 'Ponto remoto', imageName: 'radio' } },
      { id: 'core-switch', type: 'arch', position: { x: 700, y: 300 }, data: { label: 'Switch Core', icon: 'switch', sublabel: 'VLANs / Trunks', imageName: 'cisco' } },
      { id: 'ap-area', type: 'arch', position: { x: 700, y: 460 }, data: { label: 'Access Points', icon: 'accessPoint', sublabel: 'Wi-Fi corporativo', imageName: 'wifi' } },
    ],
    edges: [
      { id: 'e-fiber-1', source: 'internet', target: 'pop', label: 'Fibra', style: { stroke: '#22d3ee', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' } },
      { id: 'e-radio-1', source: 'pop', target: 'tower-a', label: 'Fibra até torre', style: { stroke: '#22d3ee', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' } },
      { id: 'e-radio-2', source: 'tower-a', target: 'tower-b', label: 'Rádio enlace', style: { stroke: '#f6b40b', strokeWidth: 3, strokeDasharray: '8 6' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f6b40b' } },
      { id: 'e-lan-1', source: 'tower-b', target: 'core-switch', label: 'Backhaul', style: { stroke: '#ff7a00', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ff7a00' } },
      { id: 'e-lan-2', source: 'core-switch', target: 'ap-area', label: 'PoE / VLAN Wi-Fi', style: { stroke: '#34d399', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#34d399' } },
    ]
  },
  'switch-ap': {
    nodes: [
      { id: 'router', type: 'arch', position: { x: 420, y: 40 }, data: { label: 'Roteador / Firewall', icon: 'firewall', sublabel: 'Gateway / NAT / VPN', imageName: 'fortinet' } },
      { id: 'core-switch', type: 'arch', position: { x: 420, y: 190 }, data: { label: 'Switch Core', icon: 'switch', sublabel: '10G / VLANs', imageName: 'cisco' } },
      { id: 'access-1', type: 'arch', position: { x: 150, y: 350 }, data: { label: 'Switch Acesso 1', icon: 'switch', sublabel: 'PoE / Andar 1', imageName: 'switch' } },
      { id: 'access-2', type: 'arch', position: { x: 420, y: 350 }, data: { label: 'Switch Acesso 2', icon: 'switch', sublabel: 'PoE / Andar 2', imageName: 'switch' } },
      { id: 'access-3', type: 'arch', position: { x: 690, y: 350 }, data: { label: 'Switch Acesso 3', icon: 'switch', sublabel: 'PoE / Galpão', imageName: 'switch' } },
      { id: 'ap-1', type: 'arch', position: { x: 150, y: 520 }, data: { label: 'AP Escritório', icon: 'accessPoint', sublabel: 'SSID Corp / Guest', imageName: 'wifi' } },
      { id: 'ap-2', type: 'arch', position: { x: 420, y: 520 }, data: { label: 'AP Produção', icon: 'accessPoint', sublabel: 'Cobertura industrial', imageName: 'wifi' } },
      { id: 'ap-3', type: 'arch', position: { x: 690, y: 520 }, data: { label: 'AP Externo', icon: 'accessPoint', sublabel: 'Área externa', imageName: 'wifi' } },
    ],
    edges: [
      { id: 'e1', source: 'router', target: 'core-switch' },
      { id: 'e2', source: 'core-switch', target: 'access-1' },
      { id: 'e3', source: 'core-switch', target: 'access-2' },
      { id: 'e4', source: 'core-switch', target: 'access-3' },
      { id: 'e5', source: 'access-1', target: 'ap-1' },
      { id: 'e6', source: 'access-2', target: 'ap-2' },
      { id: 'e7', source: 'access-3', target: 'ap-3' },
    ]
  },
  '3-tier': {
    nodes: [
      { id: 'client', type: 'arch', position: { x: 250, y: 50 }, data: { label: 'Web Client', icon: 'globe', sublabel: 'React / SPA', imageName: 'react' } },
      { id: 'api', type: 'arch', position: { x: 250, y: 200 }, data: { label: 'API Gateway', icon: 'server', sublabel: 'Node.js Express', imageName: 'nodedotjs' } },
      { id: 'db', type: 'arch', position: { x: 250, y: 350 }, data: { label: 'Database', icon: 'database', sublabel: 'PostgreSQL', imageName: 'postgresql' } },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'api' },
      { id: 'e2', source: 'api', target: 'db' },
    ]
  },
  'microservices': {
    nodes: [
      { id: 'client', type: 'arch', position: { x: 400, y: 50 }, data: { label: 'Mobile App', icon: 'smartphone', sublabel: 'iOS / Android', imageName: 'apple' } },
      { id: 'gateway', type: 'arch', position: { x: 400, y: 200 }, data: { label: 'API Gateway', icon: 'cloud', sublabel: 'Kong / Nginx', imageName: 'nginx' } },
      { id: 'auth', type: 'arch', position: { x: 150, y: 350 }, data: { label: 'Auth Service', icon: 'server', sublabel: 'Go', imageName: 'go' } },
      { id: 'users', type: 'arch', position: { x: 400, y: 350 }, data: { label: 'Users Service', icon: 'server', sublabel: 'Node.js', imageName: 'nodedotjs' } },
      { id: 'orders', type: 'arch', position: { x: 650, y: 350 }, data: { label: 'Orders Service', icon: 'server', sublabel: 'Java', imageName: 'java' } },
      { id: 'db-auth', type: 'arch', position: { x: 150, y: 500 }, data: { label: 'Auth DB', icon: 'database', sublabel: 'Redis', imageName: 'redis' } },
      { id: 'db-users', type: 'arch', position: { x: 400, y: 500 }, data: { label: 'Users DB', icon: 'database', sublabel: 'PostgreSQL', imageName: 'postgresql' } },
      { id: 'db-orders', type: 'arch', position: { x: 650, y: 500 }, data: { label: 'Orders DB', icon: 'database', sublabel: 'MongoDB', imageName: 'mongodb' } },
    ],
    edges: [
      { id: 'e1', source: 'client', target: 'gateway' },
      { id: 'e2', source: 'gateway', target: 'auth' },
      { id: 'e3', source: 'gateway', target: 'users' },
      { id: 'e4', source: 'gateway', target: 'orders' },
      { id: 'e5', source: 'auth', target: 'db-auth' },
      { id: 'e6', source: 'users', target: 'db-users' },
      { id: 'e7', source: 'orders', target: 'db-orders' },
    ]
  }
};

function ArchitectureDiagramContent({ onBack, activeProject }: { onBack: () => void; activeProject?: Space | null }) {
  const initialDiagram = cloneDiagram(templates['fiber-radio']);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialDiagram.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialDiagram.edges);
  const [drawings, setDrawings] = useState<DrawingStroke[]>([]);
  const [penEnabled, setPenEnabled] = useState(false);
  const [penColor, setPenColor] = useState('#f97316');
  const [penWidth, setPenWidth] = useState(4);
  const [activeTemplate, setActiveTemplate] = useState('fiber-radio');
  const [customNodeName, setCustomNodeName] = useState('');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.38);
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagramEntry[]>([]);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [viewingDiagramId, setViewingDiagramId] = useState<string | null>(null);
  const [activeDiagramName, setActiveDiagramName] = useState('Diagrama sem titulo');
  const [diagramMode, setDiagramMode] = useState<'edit' | 'view'>('edit');
  const [diagramClientName, setDiagramClientName] = useState(activeProject?.client || '');
  const [diagramProjectName, setDiagramProjectName] = useState(activeProject?.name || '');
  const [newDiagramFormOpen, setNewDiagramFormOpen] = useState(false);
  const [savedDiagramsModalOpen, setSavedDiagramsModalOpen] = useState(false);
  const [newDiagramForm, setNewDiagramForm] = useState({
    name: activeProject?.name ? `Arquitetura - ${activeProject.name}` : 'Novo Diagrama de Arquitetura',
    clientName: activeProject?.client || '',
    projectName: activeProject?.name || '',
    templateKey: 'blank'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const isDrawingRef = useRef(false);
  const activeStrokeIdRef = useRef<string | null>(null);

  const { getNodes, screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const saved = readSavedDiagrams();
    const legacy = buildLegacyDiagramEntry();
    const entries = legacy && !saved.some((entry) => entry.id === legacy.id)
      ? [legacy, ...saved]
      : saved;
    setSavedDiagrams(entries);
    if (entries.length > 0) {
      localStorage.setItem(DIAGRAMS_STORAGE_KEY, JSON.stringify(entries));
    }
  }, []);

  const persistSavedDiagrams = useCallback((entries: SavedDiagramEntry[]) => {
    const ordered = [...entries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    localStorage.setItem(DIAGRAMS_STORAGE_KEY, JSON.stringify(ordered));
    setSavedDiagrams(ordered);
  }, []);

  const getFlowPointFromPointer = (event: React.PointerEvent<HTMLDivElement>) => (
    screenToFlowPosition({ x: event.clientX, y: event.clientY })
  );

  const startDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!penEnabled || diagramMode !== 'edit') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getFlowPointFromPointer(event);
    const strokeId = `stroke-${Date.now()}`;
    isDrawingRef.current = true;
    activeStrokeIdRef.current = strokeId;
    setDrawings((current) => [
      ...current,
      {
        id: strokeId,
        color: penColor,
        width: penWidth,
        points: [point]
      }
    ]);
  };

  const continueDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || !activeStrokeIdRef.current) return;
    event.preventDefault();
    const point = getFlowPointFromPointer(event);
    setDrawings((current) => current.map((stroke) => {
      if (stroke.id !== activeStrokeIdRef.current) return stroke;
      const lastPoint = stroke.points[stroke.points.length - 1];
      if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 2) {
        return stroke;
      }
      return { ...stroke, points: [...stroke.points, point] };
    }));
  };

  const stopDrawing = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    isDrawingRef.current = false;
    activeStrokeIdRef.current = null;
  };

  const undoDrawing = () => {
    setDrawings((current) => current.slice(0, -1));
  };

  const clearDrawings = () => {
    if (drawings.length === 0) return;
    if (!window.confirm('Limpar todas as anotacoes do diagrama?')) return;
    setDrawings([]);
  };

  const onConnect = useCallback((params: Connection | Edge) => {
    const edgeId = `edge-${params.source}-${params.target}-${Date.now()}`;
    setEdges((eds) => addEdge({
      ...params,
      id: edgeId,
      type: 'smoothstep',
      style: { stroke: '#ff7a00', strokeWidth: 2.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ff7a00' }
    }, eds));
  }, [setEdges]);

  const flowNodes = React.useMemo(() => {
    const diagramNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        readOnly: diagramMode === 'view'
      },
      zIndex: node.zIndex ?? 10
    }));

    if (!backgroundImage) return diagramNodes;
    return [
      {
        id: BACKGROUND_IMAGE_NODE_ID,
        type: 'backgroundImage',
        position: BACKGROUND_IMAGE_NODE_POSITION,
        data: {
          src: backgroundImage,
          opacity: backgroundOpacity,
          width: BACKGROUND_IMAGE_NODE_SIZE.width,
          height: BACKGROUND_IMAGE_NODE_SIZE.height
        },
        selectable: false,
        draggable: false,
        connectable: false,
        deletable: false,
        zIndex: 0,
      },
      ...diagramNodes
    ];
  }, [backgroundImage, backgroundOpacity, diagramMode, nodes]);

  const loadSavedDiagram = (entry: SavedDiagramEntry, mode: 'edit' | 'view' = 'edit') => {
    setNodes(entry.nodes || []);
    setEdges(entry.edges || []);
    setDrawings(entry.drawings || []);
    setBackgroundImage(entry.backgroundImage || null);
    setBackgroundOpacity(typeof entry.backgroundOpacity === 'number' ? entry.backgroundOpacity : 0.38);
    setActiveTemplate('saved');
    setActiveDiagramId(mode === 'edit' ? entry.id : null);
    setViewingDiagramId(mode === 'view' ? entry.id : null);
    setActiveDiagramName(entry.name);
    setDiagramClientName(entry.clientName || '');
    setDiagramProjectName(entry.projectName || '');
    setDiagramMode(mode);
    setPenEnabled(false);
  };

  const viewDiagramAsPDF = async (entry: SavedDiagramEntry) => {
    // Carregar temporariamente o diagrama
    setNodes(entry.nodes || []);
    setEdges(entry.edges || []);
    setDrawings(entry.drawings || []);
    setBackgroundImage(entry.backgroundImage || null);
    setBackgroundOpacity(typeof entry.backgroundOpacity === 'number' ? entry.backgroundOpacity : 0.38);

    // Aguardar o React renderizar
    await new Promise(resolve => setTimeout(resolve, 300));

    // Exportar para PDF com nome estruturado
    const nodes = entry.nodes || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach((n: any) => {
      const width = n.width || 180;
      const height = n.height || 120;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + width);
      maxY = Math.max(maxY, n.position.y + height);
    });

    (entry.drawings || []).forEach((stroke: any) => {
      stroke.points.forEach((point: any) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 80;
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const imageWidth = boundsWidth + padding * 2;
    const imageHeight = boundsHeight + padding * 2;

    const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportElement) {
      alert('Erro ao capturar diagrama');
      return;
    }

    const translateX = -minX + padding;
    const translateY = -minY + padding;

    try {
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#070b16',
        width: imageWidth,
        height: imageHeight,
        cacheBust: true,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${translateX}px, ${translateY}px) scale(1)`,
        },
      });

      // Criar PDF com cabeçalho profissional
      const pdf = new jsPDF({
        orientation: imageWidth > imageHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Cabeçalho
      pdf.setFillColor(7, 11, 22); // #070b16
      pdf.rect(0, 0, pageWidth, 80, 'F');

      pdf.setFontSize(22);
      pdf.setTextColor(255, 255, 255);
      pdf.text(entry.name, 20, 35);

      pdf.setFontSize(11);
      pdf.setTextColor(143, 156, 175);
      if (entry.clientName) pdf.text(`Cliente: ${entry.clientName}`, 20, 52);
      if (entry.projectName) pdf.text(`Projeto: ${entry.projectName}`, 20, 65);

      // Data de geração
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
      pdf.text(`Gerado em: ${dataGeracao}`, pageWidth - 150, 25);

      // Logo/Marca (opcional - pode adicionar depois)
      pdf.setFontSize(16);
      pdf.setTextColor(255, 122, 0);
      pdf.text('NEXOS', pageWidth - 150, 50);

      // Diagrama
      const diagramY = 90;
      const availableHeight = pageHeight - diagramY - 20;
      const availableWidth = pageWidth - 40;

      const scale = Math.min(
        availableWidth / imageWidth,
        availableHeight / imageHeight,
        1
      );

      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale;
      const x = (pageWidth - scaledWidth) / 2;

      pdf.addImage(dataUrl, 'PNG', x, diagramY, scaledWidth, scaledHeight);

      // Rodapé
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Diagrama de Arquitetura - Gestão de Projetos Nexos', 20, pageHeight - 10);
      pdf.text(`Página 1`, pageWidth - 60, pageHeight - 10);

      // Salvar com nome estruturado
      const nomeArquivo = `${entry.clientName || 'diagrama'}_${entry.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(nomeArquivo);

    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      alert('Erro ao gerar o PDF. Tente novamente.');
    }
  };

  const loadTemplate = (key: keyof typeof templates | 'saved') => {
    setActiveTemplate(key);
    if (key === 'saved') {
      const latest = savedDiagrams[0];
      if (latest) {
        loadSavedDiagram(latest);
      }
    } else {
      const nextDiagram = cloneDiagram(templates[key]);
      setNodes(nextDiagram.nodes);
      setEdges(nextDiagram.edges);
      setDrawings([]);
      setActiveDiagramId(null);
      setViewingDiagramId(null);
      setActiveDiagramName(`Modelo ${key}`);
      setDiagramClientName(activeProject?.client || '');
      setDiagramProjectName(activeProject?.name || '');
      setDiagramMode('edit');
      setPenEnabled(false);
      if (key === 'blank') {
        setBackgroundImage(null);
        setBackgroundOpacity(0.38);
      }
    }
  };

  const openNewDiagramForm = () => {
    setNewDiagramForm({
      name: activeProject?.name ? `Arquitetura - ${activeProject.name}` : 'Novo Diagrama de Arquitetura',
      clientName: activeProject?.client || diagramClientName || '',
      projectName: activeProject?.name || diagramProjectName || '',
      templateKey: 'blank'
    });
    setNewDiagramFormOpen(true);
  };

  const createNewDiagram = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const templateKey = newDiagramForm.templateKey as keyof typeof templates;
    const selectedTemplate = templates[templateKey] || templates.blank;
    const nextDiagram = cloneDiagram(selectedTemplate);
    const name = newDiagramForm.name.trim() || 'Diagrama sem titulo';

    setNodes(nextDiagram.nodes);
    setEdges(nextDiagram.edges);
    setDrawings([]);
    setBackgroundImage(null);
    setBackgroundOpacity(0.38);
    setActiveTemplate(templateKey);
    setActiveDiagramId(null);
    setViewingDiagramId(null);
    setActiveDiagramName(name);
    setDiagramClientName(newDiagramForm.clientName.trim());
    setDiagramProjectName(newDiagramForm.projectName.trim());
    setDiagramMode('edit');
    setPenEnabled(false);
    setNewDiagramFormOpen(false);
  };

  const saveDiagram = () => {
    if (diagramMode === 'view') {
      alert('Este diagrama esta em modo visualizacao. Clique em Editar para alterar e salvar.');
      return;
    }

    const now = new Date().toISOString();
    if (!activeDiagramId && (!activeDiagramName || /^Modelo |Diagrama sem titulo$/i.test(activeDiagramName))) {
      openNewDiagramForm();
      return;
    }

    const name = activeDiagramName.trim() || 'Diagrama sem titulo';
    const payload = {
      nodes,
      edges,
      drawings,
      backgroundImage,
      backgroundOpacity,
      clientName: diagramClientName.trim(),
      projectName: diagramProjectName.trim(),
      templateKey: activeTemplate,
      updatedAt: now,
    };

    if (activeDiagramId) {
      const updated = savedDiagrams.map((entry) => (
        entry.id === activeDiagramId
          ? { ...entry, ...payload, name }
          : entry
      ));
      persistSavedDiagrams(updated);
      setActiveDiagramName(name);
      alert('Diagrama atualizado com sucesso!');
      return;
    }

    const id = `diagram-${Date.now()}`;
    const created: SavedDiagramEntry = {
      id,
      name,
      ...payload,
      createdAt: now,
    };
    persistSavedDiagrams([created, ...savedDiagrams]);
    setActiveTemplate('saved');
    setActiveDiagramId(id);
    setActiveDiagramName(name);
    alert('Diagrama salvo com sucesso!');
  };

  const deleteSavedDiagram = (entryId: string) => {
    const entry = savedDiagrams.find((item) => item.id === entryId);
    if (!entry) return;
    if (!window.confirm(`Excluir o diagrama "${entry.name}"?`)) return;

    const updated = savedDiagrams.filter((item) => item.id !== entryId);
    persistSavedDiagrams(updated);
    if (activeDiagramId === entryId) {
      setActiveDiagramId(null);
      setActiveDiagramName('Diagrama sem titulo');
    }
    if (viewingDiagramId === entryId) {
      setViewingDiagramId(null);
      setActiveDiagramName('Diagrama sem titulo');
      setDiagramMode('edit');
    }
  };

  const preloadImage = (src: string) => new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });

  const downloadPDF = async () => {
    if (backgroundImage) {
      await preloadImage(backgroundImage);
    }

    const exportNodes = getNodes();
    if (backgroundImage && !exportNodes.some((node) => node.id === BACKGROUND_IMAGE_NODE_ID)) {
      exportNodes.push({
        id: BACKGROUND_IMAGE_NODE_ID,
        type: 'backgroundImage',
        position: BACKGROUND_IMAGE_NODE_POSITION,
        data: {
          width: BACKGROUND_IMAGE_NODE_SIZE.width,
          height: BACKGROUND_IMAGE_NODE_SIZE.height,
        },
      } as any);
    }
    if (exportNodes.length === 0 && drawings.length === 0) return;

    // Calculate bounds manually since exports might differ by version
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    exportNodes.forEach((n) => {
      const width = n.id === BACKGROUND_IMAGE_NODE_ID
        ? Number(n.data?.width || BACKGROUND_IMAGE_NODE_SIZE.width)
        : n.measured?.width || 200;
      const height = n.id === BACKGROUND_IMAGE_NODE_ID
        ? Number(n.data?.height || BACKGROUND_IMAGE_NODE_SIZE.height)
        : n.measured?.height || 150;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + width);
      maxY = Math.max(maxY, n.position.y + height);
    });

    drawings.forEach((stroke) => {
      stroke.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 60;
    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;

    const imageWidth = boundsWidth + padding * 2;
    const imageHeight = boundsHeight + padding * 2;

    const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportElement) return;

    // We can manually force the transform on the element just for the snapshot
    // But since html-to-image takes a style object, we can just apply a translate
    const translateX = -minX + padding;
    const translateY = -minY + padding;

    try {
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#070b16',
        width: imageWidth,
        height: imageHeight,
        cacheBust: true,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${translateX}px, ${translateY}px) scale(1)`,
        },
      });
      const pdf = new jsPDF({
        orientation: imageWidth > imageHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imageWidth, imageHeight]
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, imageWidth, imageHeight);
      pdf.save('diagrama.pdf');
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      alert('Erro ao gerar o PDF. Tente novamente.');
    }
  };

  const addNode = (icon: string, label: string) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'arch',
      position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 100 },
      data: { label, icon, sublabel: 'Componente de rede' }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addNetworkNode = (icon: string, label: string, sublabel: string, imageName?: string) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'arch',
      position: { x: Math.random() * 280 + 260, y: Math.random() * 260 + 140 },
      data: { label, icon, sublabel, imageName: imageName || label }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addPhysicalNode = (icon: string, label: string, sublabel: string, physicalType: string, referenceImage: string) => {
    const newNode = {
      id: `physical-${Date.now()}`,
      type: 'arch',
      position: { x: Math.random() * 320 + 300, y: Math.random() * 260 + 160 },
      data: {
        label,
        icon,
        sublabel,
        variant: 'physical',
        physicalType,
        referenceImage,
        imageName: '',
        nameBox: ''
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addCustomNode = () => {
    if (!customNodeName.trim()) return;
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'arch',
      position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 100 },
      data: { label: customNodeName, icon: 'server', sublabel: 'Customizado', imageName: customNodeName }
    };
    setNodes((nds) => [...nds, newNode]);
    setCustomNodeName('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newNode = {
        id: `node-${Date.now()}`,
        type: 'arch',
        position: { x: Math.random() * 200 + 200, y: Math.random() * 200 + 100 },
        data: {
          label: file.name.split('.')[0],
          icon: 'radio',
          sublabel: 'Componente físico',
          uploadedImage: dataUrl,
          variant: 'physical',
          imageName: ''
        }
      };
      setNodes((nds) => [...nds, newNode]);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#070b16] overflow-hidden w-full absolute inset-0 z-50">
      <div className="h-14 border-b border-[#263345] bg-[#111827] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="w-px h-6 bg-[#263345]"></div>
          <h2 className="text-slate-200 font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#ff7a00]" /> Diagrama de Arquitetura
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Botão para abrir modal de Diagramas Salvos */}
          <button
            type="button"
            onClick={() => setSavedDiagramsModalOpen(true)}
            className="flex items-center gap-2 rounded-md bg-[#070b16] border border-[#263345] px-3 py-1.5 text-sm font-semibold text-slate-300 hover:border-[#ff7a00] hover:text-white transition-colors"
            title="Ver diagramas salvos"
          >
            <FolderOpen className="h-4 w-4" />
            Diagramas Salvos
            {savedDiagrams.length > 0 && (
              <span className="ml-1 rounded-full bg-[#ff7a00] px-2 py-0.5 text-[10px] font-bold text-white">
                {savedDiagrams.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={openNewDiagramForm}
            className="flex items-center gap-2 rounded-md bg-[#ff7a00] px-3 py-1.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#f6b40b] hover:text-[#050914]"
          >
            <Plus className="h-4 w-4" /> Novo Diagrama
          </button>
          <div className="flex items-center gap-2 bg-[#070b16] p-1 rounded-lg border border-[#263345]">
            {savedDiagrams.length > 0 && (
              <button
                onClick={() => loadTemplate('saved')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTemplate === 'saved' ? 'bg-[#ff7a00] text-white' : 'text-[#ff7a00] hover:bg-[#ff7a00]/10'}`}
              >Salvos ({savedDiagrams.length})</button>
            )}
            <div className="w-px h-4 bg-[#263345] mx-1"></div>
            <button
              onClick={() => loadTemplate('blank')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTemplate === 'blank' ? 'bg-[#263345] text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >Em Branco</button>
            <button
              onClick={() => loadTemplate('fiber-radio')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTemplate === 'fiber-radio' ? 'bg-[#263345] text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >Fibra + Rádio</button>
            <button
              onClick={() => loadTemplate('switch-ap')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTemplate === 'switch-ap' ? 'bg-[#263345] text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >Switches + APs</button>
            <button
              onClick={() => loadTemplate('3-tier')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTemplate === '3-tier' ? 'bg-[#263345] text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >Web 3-Tier</button>
            <button
              onClick={() => loadTemplate('microservices')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTemplate === 'microservices' ? 'bg-[#263345] text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >Microserviços</button>
          </div>

          {diagramMode === 'edit' && (
            <div className="flex items-center gap-2 rounded-lg border border-[#263345] bg-[#070b16] p-1">
              <button
                type="button"
                onClick={() => setPenEnabled((current) => !current)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${penEnabled ? 'bg-[#ff7a00] text-white' : 'text-slate-400 hover:bg-[#263345] hover:text-slate-200'}`}
                title="Caneta para anotacoes"
              >
                <PenLine className="h-4 w-4" /> Caneta
              </button>
              <input
                type="color"
                value={penColor}
                onChange={(event) => setPenColor(event.target.value)}
                className="h-7 w-8 cursor-pointer rounded border border-[#263345] bg-[#111827] p-0.5"
                title="Cor da caneta"
              />
              <input
                type="range"
                min="2"
                max="12"
                step="1"
                value={penWidth}
                onChange={(event) => setPenWidth(Number(event.target.value))}
                className="w-20 accent-[#ff7a00]"
                title="Espessura da caneta"
              />
              <button
                type="button"
                onClick={undoDrawing}
                disabled={drawings.length === 0}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-[#263345] hover:text-slate-200 disabled:cursor-not-allowed disabled:text-slate-700"
                title="Desfazer ultimo risco"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={clearDrawings}
                disabled={drawings.length === 0}
                className="rounded-md p-1.5 text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:text-slate-700"
                title="Limpar anotacoes"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 border-l border-[#263345] pl-3">
            {(activeDiagramId || viewingDiagramId) && (
              <span className="hidden xl:inline max-w-44 truncate text-xs text-slate-400">
                {diagramMode === 'view' ? 'Visualizando' : 'Editando'}: <strong className="font-semibold text-slate-200">{activeDiagramName}</strong>
              </span>
            )}
            {diagramMode === 'view' && viewingDiagramId && (
              <button
                onClick={() => {
                  const entry = savedDiagrams.find((item) => item.id === viewingDiagramId);
                  if (entry) loadSavedDiagram(entry, 'edit');
                }}
                className="flex items-center gap-2 text-sm text-white bg-[#ff7a00] hover:bg-[#f6b40b] px-3 py-1.5 rounded-md transition-colors font-medium shadow-sm"
              >
                <Pencil className="w-4 h-4" /> Editar
              </button>
            )}
            <button
              onClick={saveDiagram}
              disabled={diagramMode === 'view'}
              className={`flex items-center gap-2 text-sm border px-3 py-1.5 rounded-md transition-colors font-medium shadow-sm ${diagramMode === 'view' ? 'cursor-not-allowed border-[#263345] bg-[#0b1220] text-slate-600' : 'border-[#263345] bg-[#111827] text-slate-300 hover:bg-[#263345] hover:text-white'}`}
            >
              <Save className="w-4 h-4" /> Salvar
            </button>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 text-sm text-white bg-[#ff7a00] hover:bg-[#f6b40b] px-4 py-1.5 rounded-md transition-colors font-medium shadow-lg"
            >
              <Download className="w-4 h-4" /> Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        <DiagramSetNodesContext.Provider value={setNodes}>
          <ReactFlow
            nodes={flowNodes}
            edges={edges}
            onNodesChange={diagramMode === 'edit' ? onNodesChange : undefined}
            onEdgesChange={diagramMode === 'edit' ? onEdgesChange : undefined}
            onConnect={diagramMode === 'edit' ? onConnect : undefined}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            nodesDraggable={diagramMode === 'edit' && !penEnabled}
            nodesConnectable={diagramMode === 'edit' && !penEnabled}
            elementsSelectable={diagramMode === 'edit' && !penEnabled}
            panOnDrag={diagramMode === 'edit' && !penEnabled}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={28}
            connectionLineStyle={{ stroke: '#ff7a00', strokeWidth: 2.5 }}
            colorMode="dark"
            fitView
            className="bg-[#070b16]"
          >
            <Background color="#263345" gap={24} size={2} />
            <Controls className="bg-[#111827] border-[#263345] fill-slate-300" />
            <MiniMap
              nodeColor={(n) => '#ff7a00'}
              maskColor="rgba(15, 23, 42, 0.7)"
              className="bg-[#111827] border border-[#263345] rounded-md"
            />
            <ViewportPortal>
              <svg
                className="pointer-events-none absolute left-0 top-0 overflow-visible"
                style={{ width: 1, height: 1, zIndex: 6 }}
              >
                {drawings.map((stroke) => (
                  <path
                    key={stroke.id}
                    d={buildStrokePath(stroke.points)}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.92}
                  />
                ))}
              </svg>
            </ViewportPortal>

          {diagramMode === 'edit' && (
          <Panel position="top-left" className="w-56 bg-[#111827]/90 backdrop-blur-md border border-[#263345] p-2 rounded-md shadow-xl flex flex-col gap-1.5 max-h-[calc(100vh-120px)] overflow-y-auto">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Diagrama</h3>
            <input
              type="text"
              value={activeDiagramName}
              onChange={(event) => setActiveDiagramName(event.target.value)}
              className="bg-[#070b16] border border-[#263345] rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff7a00]"
              placeholder="Nome do diagrama"
            />
            <input
              type="text"
              value={diagramClientName}
              onChange={(event) => setDiagramClientName(event.target.value)}
              className="bg-[#070b16] border border-[#263345] rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff7a00]"
              placeholder="Nome do cliente"
            />
            <input
              type="text"
              value={diagramProjectName}
              onChange={(event) => setDiagramProjectName(event.target.value)}
              className="bg-[#070b16] border border-[#263345] rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff7a00]"
              placeholder="Nome do projeto"
            />
            <div className="my-1 h-px bg-[#263345]" />
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Componentes</h3>
            <button onClick={() => addNetworkNode('fiber', 'Fibra Óptica', 'Backbone / FO / DIO', 'fiber')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <Cable className="w-3.5 h-3.5 text-[#22d3ee]" /> Fibra / DIO
            </button>
            <button onClick={() => addNetworkNode('radio', 'Rádio Enlace', 'PTP / Backhaul', 'radio')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <RadioTower className="w-3.5 h-3.5 text-[#f6b40b]" /> Rádio Enlace
            </button>
            <button onClick={() => addNetworkNode('switch', 'Switch', 'Core / Acesso / PoE', 'switch')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <Network className="w-3.5 h-3.5 text-[#34d399]" /> Switch
            </button>
            <button onClick={() => addNetworkNode('accessPoint', 'Access Point', 'Wi-Fi / SSID / PoE', 'wifi')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <Wifi className="w-3.5 h-3.5 text-[#38bdf8]" /> Access Point
            </button>
            <button onClick={() => addNetworkNode('router', 'Roteador', 'Gateway / WAN', 'router')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <Router className="w-3.5 h-3.5 text-[#ff7a00]" /> Roteador
            </button>
            <button onClick={() => addNetworkNode('firewall', 'Firewall', 'Segurança / VPN', 'fortinet')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <Shield className="w-3.5 h-3.5 text-[#ff7a00]" /> Firewall
            </button>
            <button onClick={() => addNetworkNode('server', 'Servidor', 'Servidor local / VM', 'server')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <Server className="w-3.5 h-3.5 text-[#ff7a00]" /> Servidor
            </button>
            <button onClick={() => addNetworkNode('cloud', 'Cloud Service', 'Cloud / SaaS / DC', 'cloud')} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
              <Cloud className="w-3.5 h-3.5 text-[#ff7a00]" /> Cloud
            </button>

            <div className="mt-1.5 pt-2 border-t border-[#263345] flex flex-col gap-1.5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Componentes Físicos</h3>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-[#ff7a00] hover:bg-[#f6b40b] text-white hover:text-[#050914] px-2 py-1.5 rounded-md text-xs font-semibold transition-colors w-full"
              >
                <ImagePlus className="w-3.5 h-3.5" /> Adicionar foto real
              </button>
              <button onClick={() => addPhysicalNode('radio', 'Rádio Físico', 'PTP / Backhaul / Torre', 'radio', physicalComponentImages.radio)} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
                <RadioTower className="w-3.5 h-3.5 text-[#f6b40b]" /> Rádio físico
              </button>
              <button onClick={() => addPhysicalNode('radio', 'Antena / Dish', 'Antena externa / enlace', 'dish', physicalComponentImages.dish)} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
                <RadioTower className="w-3.5 h-3.5 text-[#ff7a00]" /> Antena / Dish
              </button>
              <button onClick={() => addPhysicalNode('pop', 'Torre / Mastro', 'Estrutura física', 'tower', physicalComponentImages.tower)} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
                <Building2 className="w-3.5 h-3.5 text-[#22d3ee]" /> Torre / Mastro
              </button>
              <button onClick={() => addPhysicalNode('switch', 'Rack / POP', 'Rack, DIO, OLT, switch', 'rack', physicalComponentImages.rack)} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-[#263345] px-2 py-1.5 rounded-md transition-colors text-left">
                <Network className="w-3.5 h-3.5 text-[#34d399]" /> Rack / POP
              </button>
              <p className="text-[9px] leading-3 text-slate-500">
                Use foto real do equipamento. Depois clique em Nome para marcar o ponto, como Paranacidade ou Newage.
              </p>
            </div>

            <div className="mt-1.5 pt-2 border-t border-[#263345] flex flex-col gap-1.5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Tecnologia Específica</h3>
              <input
                type="text"
                placeholder="Ex: React, Docker, AWS"
                className="bg-[#070b16] border border-[#263345] rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#ff7a00]"
                value={customNodeName}
                onChange={(e) => setCustomNodeName(e.target.value)}
                onKeyDown={(e) => {
                   if (e.key === 'Enter') addCustomNode();
                }}
              />
              <button
                onClick={addCustomNode}
                className="bg-[#ff7a00] hover:bg-[#f6b40b] text-white px-2 py-1.5 rounded-md text-xs font-semibold transition-colors w-full"
              >
                Adicionar ao Diagrama
              </button>
            </div>

            <div className="mt-1.5 pt-2 border-t border-[#263345] flex flex-col gap-1.5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Imagem de Fundo</h3>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={backgroundInputRef}
                onChange={handleBackgroundUpload}
              />
              <button
                onClick={() => backgroundInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#263345] border border-[#263345] text-slate-300 hover:text-white px-2 py-1.5 rounded-md text-xs font-semibold transition-colors w-full"
              >
                <ImagePlus className="w-3.5 h-3.5" /> Adicionar fundo
              </button>
              {backgroundImage && (
                <>
                  <label className="text-[11px] font-semibold text-slate-400">
                    Opacidade
                    <input
                      type="range"
                      min="0.12"
                      max="0.85"
                      step="0.01"
                      value={backgroundOpacity}
                      onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
                      className="mt-1 w-full accent-[#ff7a00]"
                    />
                  </label>
                  <button
                    onClick={() => setBackgroundImage(null)}
                    className="flex items-center justify-center gap-2 border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover fundo
                  </button>
                </>
              )}
              <p className="text-[9px] leading-3 text-slate-500">
                Para imagem de um componente, clique no ícone do próprio componente e envie a foto ou símbolo dele.
              </p>
            </div>
            </Panel>
          )}
          </ReactFlow>
        </DiagramSetNodesContext.Provider>
        {diagramMode === 'edit' && penEnabled && (
          <div
            className="absolute inset-0 z-20 cursor-crosshair"
            onPointerDown={startDrawing}
            onPointerMove={continueDrawing}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={stopDrawing}
          />
        )}
      </div>

      {/* Modal de Diagramas Salvos */}
      {savedDiagramsModalOpen && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-lg border border-[#263345] bg-[#111827] shadow-2xl">
            {/* Header do Modal */}
            <div className="flex items-center justify-between border-b border-[#263345] bg-[#070b16] px-6 py-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-[#ff7a00]" />
                Diagramas Salvos
                <span className="ml-2 rounded-full bg-[#ff7a00] px-3 py-1 text-sm font-bold text-white">
                  {savedDiagrams.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setSavedDiagramsModalOpen(false)}
                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-[#263345] hover:text-slate-200"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              {savedDiagrams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="h-16 w-16 text-slate-600 mb-4" />
                  <p className="text-lg font-semibold text-slate-300 mb-2">
                    Nenhum diagrama salvo ainda
                  </p>
                  <p className="text-sm text-slate-500 max-w-md">
                    Crie seu primeiro diagrama de arquitetura e salve para ele aparecer aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedDiagrams.map((entry) => (
                    <div
                      key={entry.id}
                      className={`group relative flex flex-col rounded-lg border transition-all hover:shadow-xl ${
                        activeDiagramId === entry.id
                          ? 'border-[#ff7a00] bg-[#ff7a00]/10 shadow-lg shadow-[#ff7a00]/20'
                          : viewingDiagramId === entry.id
                          ? 'border-[#22d3ee] bg-[#22d3ee]/10 shadow-lg shadow-[#22d3ee]/20'
                          : 'border-[#263345] bg-[#070b16] hover:border-[#ff7a00]/50'
                      }`}
                    >
                      {/* Badge de Status */}
                      {(activeDiagramId === entry.id || viewingDiagramId === entry.id) && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-lg ${
                            activeDiagramId === entry.id ? 'bg-[#ff7a00]' : 'bg-[#22d3ee]'
                          }`}>
                            {activeDiagramId === entry.id ? '✏️ Editando' : '👁️ Visualizando'}
                          </span>
                        </div>
                      )}

                      {/* Conteúdo do Card */}
                      <div className="flex flex-col flex-1 p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="rounded-md bg-[#ff7a00]/20 p-2">
                            <Layers className="h-5 w-5 text-[#ff7a00]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-100 text-sm mb-1 line-clamp-2">
                              {entry.name}
                            </h3>
                            {(entry.clientName || entry.projectName) && (
                              <p className="text-xs text-slate-400 truncate">
                                {[entry.clientName, entry.projectName].filter(Boolean).join(' • ')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>
                            {new Date(entry.updatedAt).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-2 mt-auto">
                          <button
                            type="button"
                            onClick={() => {
                              viewDiagramAsPDF(entry);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-[#22d3ee] hover:bg-[#22d3ee]/10 hover:text-white"
                          >
                            <FileText className="h-3.5 w-3.5" /> Visualizar PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              loadSavedDiagram(entry, 'edit');
                              setSavedDiagramsModalOpen(false);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 rounded-md border border-[#ff7a00]/30 bg-[#ff7a00]/10 px-3 py-2 text-xs font-semibold text-[#ff7a00] transition-colors hover:border-[#ff7a00] hover:bg-[#ff7a00]/20 hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedDiagram(entry.id)}
                            className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/20 hover:text-red-200"
                            title="Excluir diagrama"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {newDiagramFormOpen && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={createNewDiagram}
            className="w-full max-w-lg rounded-xl border border-[#263345] bg-[#111827] p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#ff7a00]">Novo Diagrama</p>
                <h3 className="mt-1 text-lg font-bold text-slate-100">Diagrama de Arquitetura</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewDiagramFormOpen(false)}
                className="rounded-md p-2 text-slate-500 transition-colors hover:bg-[#263345] hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Nome do diagrama
                <input
                  type="text"
                  value={newDiagramForm.name}
                  onChange={(event) => setNewDiagramForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#ff7a00]"
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Nome do cliente
                <input
                  type="text"
                  value={newDiagramForm.clientName}
                  onChange={(event) => setNewDiagramForm((current) => ({ ...current, clientName: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#ff7a00]"
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Nome do projeto
                <input
                  type="text"
                  value={newDiagramForm.projectName}
                  onChange={(event) => setNewDiagramForm((current) => ({ ...current, projectName: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#ff7a00]"
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Modelo inicial
                <select
                  value={newDiagramForm.templateKey}
                  onChange={(event) => setNewDiagramForm((current) => ({ ...current, templateKey: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#ff7a00]"
                >
                  <option value="blank">Em Branco</option>
                  <option value="fiber-radio">Fibra + Rádio</option>
                  <option value="switch-ap">Switches + APs</option>
                  <option value="3-tier">Web 3-Tier</option>
                  <option value="microservices">Microserviços</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewDiagramFormOpen(false)}
                className="rounded-md border border-[#263345] px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-[#263345] hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-[#ff7a00] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#f6b40b] hover:text-[#050914]"
              >
                Criar Diagrama
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ArchitectureDiagram(props: { onBack: () => void; activeProject?: Space | null }) {
  return (
    <ReactFlowProvider>
      <ArchitectureDiagramContent {...props} />
    </ReactFlowProvider>
  );
}
