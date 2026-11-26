import React, { useEffect, useRef, useState } from 'react';
import { Handle, NodeResizer, NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import {
  Activity,
  Box,
  Building2,
  Cable,
  Cloud,
  Copy,
  Cpu,
  Database,
  Globe,
  Lock,
  Network,
  Pencil,
  RadioTower,
  Router,
  Server,
  Shield,
  Smartphone,
  StickyNote,
  Trash2,
  Upload,
  Wifi,
} from 'lucide-react';
import { ACCENT_PALETTE, type NodeAccentKey } from './architectureCatalog';

export const iconMap: Record<string, any> = {
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
  lock: Lock,
  activity: Activity,
  cpu: Cpu,
};

export const DiagramActionsContext = React.createContext<{
  setNodes: any;
  duplicateNode: (id: string) => void;
  deleteNode: (id: string) => void;
} | null>(null);

const connectionHandleClass = [
  '!h-3',
  '!w-3',
  '!border-2',
  '!border-slate-950',
  '!bg-cyan-400',
  'opacity-0',
  'group-hover/node:opacity-95',
  'transition-all',
  'hover:!scale-125',
  'hover:!opacity-100',
  'hover:!shadow-[0_0_10px_rgba(34,211,238,0.9)]',
].join(' ');

export const BackgroundImageNode = ({ data }: any) => (
  <div
    className="pointer-events-none overflow-hidden rounded-xl border border-slate-700/60 bg-transparent shadow-2xl"
    style={{
      width: data.width || 1280,
      height: data.height || 760,
      opacity: data.opacity ?? 0.38,
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

export const PhysicalDeviceShape = ({ type }: { type: string }) => {
  if (type === 'tower') {
    return (
      <svg viewBox="0 0 220 260" className="h-52 w-44 overflow-visible drop-shadow-[0_14px_20px_rgba(0,0,0,0.45)]">
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
      <svg viewBox="0 0 280 220" className="h-44 w-56 overflow-visible drop-shadow-[0_14px_20px_rgba(0,0,0,0.45)]">
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
      <svg viewBox="0 0 300 190" className="h-40 w-64 overflow-visible drop-shadow-[0_14px_20px_rgba(0,0,0,0.45)]">
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
    <svg viewBox="0 0 320 190" className="h-40 w-64 overflow-visible drop-shadow-[0_14px_20px_rgba(0,0,0,0.45)]">
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

export const ZoneNode = ({ id, data, selected }: any) => {
  const actions = React.useContext(DiagramActionsContext);
  const accent = ACCENT_PALETTE[(data.accent as NodeAccentKey) || 'blue'] || ACCENT_PALETTE.blue;
  const readOnly = Boolean(data.readOnly);

  return (
    <div
      className={`group/node relative h-full w-full rounded-2xl transition-all ${
        data.borderStyle === 'solid' ? 'border-2 border-solid' : 'border-2 border-dashed'
      } ${accent.border} bg-slate-950/35 backdrop-blur-[2px] ${
        selected ? accent.glow : ''
      }`}
    >
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={220}
          minHeight={140}
          lineClassName="!border-cyan-400"
          handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-slate-950 !bg-cyan-400"
        />
      )}
      {!readOnly && selected && actions && (
        <NodeToolbar position={Position.Top} className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/95 p-1 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => actions.duplicateNode(id)}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-cyan-300"
            title="Duplicar zona"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => actions.deleteNode(id)}
            className="rounded p-1.5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300"
            title="Excluir zona"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </NodeToolbar>
      )}
      <div className="flex items-center justify-between gap-2 px-3.5 pt-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent.hex }} />
          <span className="truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
            {data.label || 'Zona / Sub-rede'}
          </span>
        </div>
        {data.sublabel && (
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${accent.badge}`}>
            {data.sublabel}
          </span>
        )}
      </div>
    </div>
  );
};

export const NoteNode = ({ id, data, selected }: any) => {
  const actions = React.useContext(DiagramActionsContext);
  const accent = ACCENT_PALETTE[(data.accent as NodeAccentKey) || 'amber'] || ACCENT_PALETTE.amber;
  const readOnly = Boolean(data.readOnly);

  return (
    <div
      className={`group/node relative flex h-full w-full flex-col rounded-xl border ${accent.border} bg-slate-900/90 p-3.5 shadow-xl backdrop-blur-md ${
        selected ? accent.glow : ''
      }`}
    >
      {!readOnly && (
        <NodeResizer
          isVisible={selected}
          minWidth={170}
          minHeight={100}
          lineClassName="!border-amber-400"
          handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-slate-950 !bg-amber-400"
        />
      )}
      {!readOnly && selected && actions && (
        <NodeToolbar position={Position.Top} className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/95 p-1 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => actions.duplicateNode(id)}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-cyan-300"
            title="Duplicar nota"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => actions.deleteNode(id)}
            className="rounded p-1.5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300"
            title="Excluir nota"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </NodeToolbar>
      )}
      <div className="mb-1.5 flex items-center gap-1.5">
        <StickyNote className="h-3.5 w-3.5 shrink-0" style={{ color: accent.hex }} />
        <span className="truncate text-xs font-bold text-slate-100">{data.label || 'Nota Técnica'}</span>
      </div>
      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
        {data.content || 'Clique para editar esta anotação no painel lateral.'}
      </p>
    </div>
  );
};

export const ArchNode = ({ id, data, selected }: any) => {
  const [imgError, setImgError] = useState(false);
  const { setNodes: setFlowNodes } = useReactFlow();
  const actions = React.useContext(DiagramActionsContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const Icon = iconMap[data.icon] || Box;
  const readOnly = Boolean(data.readOnly);
  const accent = ACCENT_PALETTE[(data.accent as NodeAccentKey) || 'blue'] || ACCENT_PALETTE.blue;

  const getNormalizedName = (name: string) => {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower === 'node.js' || lower === 'nodejs') return 'nodedotjs';
    if (lower === 'vue' || lower === 'vuejs') return 'vuedotjs';
    return lower.replace(/[^a-z0-9]/g, '');
  };

  const NON_BRAND_ICONS = new Set([
    'fiber',
    'radio',
    'switch',
    'wifi',
    'router',
    'internet',
    'pop',
    'server',
    'cloud',
    'componentederede',
    'novodiagrama',
  ]);

  const normalized = getNormalizedName(data.imageName || '');
  const shouldUseSimpleIcon = Boolean(normalized) && !NON_BRAND_ICONS.has(normalized);
  const customImage = data.uploadedImage || (shouldUseSimpleIcon ? `https://cdn.simpleicons.org/${normalized}/${accent.hex.replace('#', '')}` : null);
  const isPhysical = data.variant === 'physical';
  const usesDeviceShape = isPhysical && data.physicalType && !data.uploadedImage;

  const updateNodeData = (patch: Record<string, any>) => {
    const updateNodes = actions?.setNodes || setFlowNodes;
    updateNodes((nds: any[]) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      updateNodeData({ uploadedImage: event.target?.result as string });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    setImgError(false);
  }, [customImage]);

  const statusBadge =
    data.metaStatus === 'online'
      ? { dot: 'bg-emerald-400', text: 'Online' }
      : data.metaStatus === 'planned'
      ? { dot: 'bg-amber-400', text: 'Planejado' }
      : data.metaStatus === 'critical'
      ? { dot: 'bg-rose-400', text: 'Crítico' }
      : null;

  return (
    <div
      className={`group/node relative text-[var(--crm-ink)] transition-all ${
        usesDeviceShape
          ? `flex min-w-[260px] flex-col items-center gap-1 rounded-xl border border-transparent bg-transparent p-2 ${
              selected ? 'ring-2 ring-cyan-400/80' : ''
            }`
          : `overflow-hidden rounded-xl border bg-slate-900/90 backdrop-blur-md shadow-xl ${
              selected ? `${accent.border} ${accent.glow} ring-1 ring-cyan-400/50` : 'border-slate-700/75 hover:border-slate-500/80'
            } ${isPhysical ? 'flex min-w-[240px] max-w-[300px] flex-col items-stretch gap-2.5 p-3' : 'flex min-w-[220px] max-w-[280px] flex-col'}`
      }`}
    >
      {!usesDeviceShape && (
        <div className="h-1 w-full" style={{ backgroundColor: accent.hex }} />
      )}

      {!readOnly && selected && actions && (
        <NodeToolbar position={Position.Top} className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/95 p-1 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-cyan-300"
            title="Alterar imagem / foto"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => actions.duplicateNode(id)}
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 hover:text-cyan-300"
            title="Duplicar componente"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => actions.deleteNode(id)}
            className="rounded p-1.5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300"
            title="Excluir componente"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </NodeToolbar>
      )}

      <Handle id="top-target" type="target" position={Position.Top} className={connectionHandleClass} />
      <Handle id="right-target" type="target" position={Position.Right} className={connectionHandleClass} />
      <Handle id="bottom-target" type="target" position={Position.Bottom} className={connectionHandleClass} />
      <Handle id="left-target" type="target" position={Position.Left} className={connectionHandleClass} />

      {data.nameBox && (
        <div className="absolute -top-8 left-1/2 z-10 min-w-[120px] -translate-x-1/2 whitespace-nowrap rounded-md border border-cyan-400/60 bg-slate-950/90 px-2.5 py-1 text-center text-[11px] font-bold text-cyan-200 shadow-lg">
          {data.nameBox}
        </div>
      )}

      <div className={usesDeviceShape ? 'flex flex-col items-center' : isPhysical ? 'flex flex-col gap-2.5' : 'flex items-center gap-3 p-3'}>
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden ${
            usesDeviceShape
              ? 'h-40 w-64 overflow-visible rounded-none bg-transparent p-0'
              : `rounded-lg border border-slate-700/70 ${accent.bg} ${isPhysical ? 'h-36 w-full p-1' : 'h-11 w-11 p-1.5'}`
          } ${readOnly ? '' : 'cursor-pointer'}`}
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
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
              <Icon className={isPhysical ? 'h-8 w-8' : 'h-5 w-5'} style={{ color: accent.hex }} />
              {isPhysical && <span className="text-[10px] font-semibold text-slate-400">Enviar foto</span>}
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

        <div className={`min-w-0 ${isPhysical || usesDeviceShape ? 'text-center' : 'flex-1'}`}>
          <div className={`font-bold leading-snug text-slate-100 ${usesDeviceShape ? 'inline-flex rounded-md border border-slate-700/80 bg-slate-900/90 px-3 py-1 text-xs shadow-lg' : 'text-[13px]'}`}>
            {data.label}
          </div>
          {data.sublabel && (
            <div className="mt-0.5 truncate text-[11px] text-slate-400">{data.sublabel}</div>
          )}

          {(data.metaIp || data.metaVlan || statusBadge) && (
            <div className={`mt-2 flex flex-wrap gap-1 ${isPhysical || usesDeviceShape ? 'justify-center' : ''}`}>
              {statusBadge && (
                <span className="inline-flex items-center gap-1 rounded border border-slate-700/70 bg-slate-950/70 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-200">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dot}`} />
                  {statusBadge.text}
                </span>
              )}
              {data.metaIp && (
                <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-cyan-300">
                  {data.metaIp}
                </span>
              )}
              {data.metaVlan && (
                <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-300">
                  {data.metaVlan}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle id="top-source" type="source" position={Position.Top} className={connectionHandleClass} />
      <Handle id="right-source" type="source" position={Position.Right} className={connectionHandleClass} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className={connectionHandleClass} />
      <Handle id="left-source" type="source" position={Position.Left} className={connectionHandleClass} />
    </div>
  );
};
