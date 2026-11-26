import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ViewportPortal,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileCode2,
  FileImage,
  FileText,
  FolderOpen,
  Grid3X3,
  ImagePlus,
  Layers,
  LayoutGrid,
  Magnet,
  Maximize2,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Save,
  Search,
  Sparkles,
  SquareDashedBottom,
  StickyNote,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import type { Space } from '../types';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  ACCENT_PALETTE,
  ARCHITECTURE_TEMPLATES,
  CATEGORY_LABELS,
  COMPONENT_CATALOG,
  EDGE_COLORS,
  type CatalogItem,
  type NodeAccentKey,
} from './architecture/architectureCatalog';
import {
  ArchNode,
  BackgroundImageNode,
  DiagramActionsContext,
  iconMap,
  NoteNode,
  ZoneNode,
} from './architecture/ArchitectureNodes';

const nodeTypes = {
  arch: ArchNode,
  zone: ZoneNode,
  note: NoteNode,
  backgroundImage: BackgroundImageNode,
};

const BACKGROUND_IMAGE_NODE_ID = 'diagram-background-image';
const BACKGROUND_IMAGE_NODE_POSITION = { x: -120, y: -80 };
const BACKGROUND_IMAGE_NODE_SIZE = { width: 1280, height: 760 };
const DIAGRAMS_STORAGE_KEY = 'architecture_diagrams_v1';
const LEGACY_DIAGRAM_STORAGE_KEY = 'saved_diagram';

const physicalComponentImages: Record<string, string> = {
  radio: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tropo%20Scatter%20Microwave%20System%20Antenna.jpg?width=960',
  dish: 'https://commons.wikimedia.org/wiki/Special:FilePath/Parabolic%20antennas%20point-to-point%20link.jpg?width=960',
  tower: 'https://commons.wikimedia.org/wiki/Special:FilePath/Microwave%20Radio%20Antenna%20Tower%20in%20Brewster%2C%20Minnesota%20%2844879513262%29.jpg?width=960',
  rack: 'https://commons.wikimedia.org/wiki/Special:FilePath/19-inch%20rackmount%20Ethernet%20switches%20and%20patch%20panels.jpg?width=960',
};

type DrawingPoint = { x: number; y: number };
type DrawingStroke = { id: string; color: string; width: number; opacity?: number; points: DrawingPoint[] };

const PEN_COLOR_PRESETS = [
  { label: 'Laranja', hex: '#f97316' },
  { label: 'Ciano', hex: '#22d3ee' },
  { label: 'Azul', hex: '#3b82f6' },
  { label: 'Esmeralda', hex: '#34d399' },
  { label: 'Amarelo', hex: '#facc15' },
  { label: 'Violeta', hex: '#a855f7' },
  { label: 'Rosa', hex: '#ec4899' },
  { label: 'Vermelho', hex: '#f43f5e' },
  { label: 'Branco', hex: '#f8fafc' },
  { label: 'Cinza', hex: '#94a3b8' },
];

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
  } catch {
    return null;
  }
};

const cloneDiagram = (diagram: { nodes: any[]; edges: any[] }) => ({
  nodes: diagram.nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    style: node.style ? { ...node.style } : undefined,
    data: { ...node.data },
  })),
  edges: diagram.edges.map((edge) => ({
    ...edge,
    style: edge.style ? { ...edge.style } : undefined,
    markerEnd: edge.markerEnd ? { ...edge.markerEnd } : undefined,
  })),
});

const buildStrokePath = (points: DrawingPoint[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.01} ${points[0].y + 0.01}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#38bdf8', strokeWidth: 2.5 },
  labelStyle: { fill: '#e2e8f0', fontSize: 11, fontWeight: 600 },
  labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9, rx: 6, ry: 6 },
  labelBgPadding: [6, 3] as [number, number],
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#38bdf8',
    width: 18,
    height: 18,
  },
};

function ArchitectureDiagramContent({ onBack, activeProject }: { onBack: () => void; activeProject?: Space | null }) {
  const initialDiagram = cloneDiagram(ARCHITECTURE_TEMPLATES['fiber-radio']);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialDiagram.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialDiagram.edges);
  const [drawings, setDrawings] = useState<DrawingStroke[]>([]);

  // History stack (Undo / Redo)
  const [history, setHistory] = useState<{ nodes: any[]; edges: any[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: any[]; edges: any[] }[]>([]);

  // Studio UI state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridVariant, setGridVariant] = useState<'dots' | 'lines' | 'none'>('dots');
  const [templatesMenuOpen, setTemplatesMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Pen state
  const [penEnabled, setPenEnabled] = useState(false);
  const [penMode, setPenMode] = useState<'pen' | 'highlighter'>('pen');
  const [penColor, setPenColor] = useState('#f97316');
  const [penWidth, setPenWidth] = useState(4);

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Metadata & Persistence
  const [activeTemplate, setActiveTemplate] = useState('fiber-radio');
  const [customNodeName, setCustomNodeName] = useState('');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.38);
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagramEntry[]>([]);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [viewingDiagramId, setViewingDiagramId] = useState<string | null>(null);
  const [activeDiagramName, setActiveDiagramName] = useState('Diagrama Fibra + Rádio');
  const [diagramMode, setDiagramMode] = useState<'edit' | 'view'>('edit');
  const [diagramClientName, setDiagramClientName] = useState(activeProject?.client || '');
  const [diagramProjectName, setDiagramProjectName] = useState(activeProject?.name || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modals & Toast
  const [newDiagramFormOpen, setNewDiagramFormOpen] = useState(false);
  const [savedDiagramsModalOpen, setSavedDiagramsModalOpen] = useState(false);
  const [newDiagramForm, setNewDiagramForm] = useState({
    name: activeProject?.name ? `Arquitetura - ${activeProject.name}` : 'Novo Diagrama de Arquitetura',
    clientName: activeProject?.client || '',
    projectName: activeProject?.name || '',
    templateKey: 'blank',
  });
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' | 'err' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const activeStrokeIdRef = useRef<string | null>(null);

  const { getNodes, screenToFlowPosition, fitView } = useReactFlow();

  const showToast = useCallback((text: string, tone: 'ok' | 'warn' | 'err' = 'ok') => {
    setToast({ text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-24), cloneDiagram({ nodes, edges })]);
    setFuture([]);
    setHasUnsavedChanges(true);
  }, [edges, nodes]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((prev) => [cloneDiagram({ nodes, edges }), ...prev]);
    setHistory((prev) => prev.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setHasUnsavedChanges(true);
  }, [edges, history, nodes, setEdges, setNodes]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((prev) => [...prev, cloneDiagram({ nodes, edges })]);
    setFuture((prev) => prev.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
    setHasUnsavedChanges(true);
  }, [edges, future, nodes, setEdges, setNodes]);

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

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = nodes.find((n) => n.id === nodeId);
      if (!source) return;
      pushHistory();
      const copyId = `${source.type}-${Date.now()}`;
      const cloned = {
        ...source,
        id: copyId,
        selected: true,
        position: { x: source.position.x + 36, y: source.position.y + 36 },
        style: source.style ? { ...source.style } : undefined,
        data: { ...source.data, label: `${source.data.label || 'Item'} (cópia)` },
      };
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(cloned));
      setSelectedNodeId(copyId);
      setSelectedEdgeId(null);
      showToast('Componente duplicado');
    },
    [nodes, pushHistory, setNodes, showToast]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      pushHistory();
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      showToast('Item removido', 'warn');
    },
    [pushHistory, selectedNodeId, setEdges, setNodes, showToast]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      pushHistory();
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
      showToast('Conexão removida', 'warn');
    },
    [pushHistory, selectedEdgeId, setEdges, showToast]
  );

  // Drawing handlers
  const getFlowPointFromPointer = (event: React.PointerEvent<HTMLDivElement>) =>
    screenToFlowPosition({ x: event.clientX, y: event.clientY });

  const startDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!penEnabled || diagramMode !== 'edit') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getFlowPointFromPointer(event);
    const strokeId = `stroke-${Date.now()}`;
    const isHighlighter = penMode === 'highlighter';
    isDrawingRef.current = true;
    activeStrokeIdRef.current = strokeId;
    setHasUnsavedChanges(true);
    setDrawings((current) => [
      ...current,
      {
        id: strokeId,
        color: penColor,
        width: isHighlighter ? Math.max(14, penWidth * 3) : penWidth,
        opacity: isHighlighter ? 0.36 : 0.96,
        points: [point],
      },
    ]);
  };

  const continueDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingRef.current || !activeStrokeIdRef.current) return;
    event.preventDefault();
    const native = event.nativeEvent as PointerEvent;
    const rawEvents = typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length > 0
      ? native.getCoalescedEvents()
      : [native];
    const incomingPoints = rawEvents.map((ev) => screenToFlowPosition({ x: ev.clientX, y: ev.clientY }));

    setDrawings((current) =>
      current.map((stroke) => {
        if (stroke.id !== activeStrokeIdRef.current) return stroke;
        const nextPoints = [...stroke.points];
        incomingPoints.forEach((pt) => {
          const lastPoint = nextPoints[nextPoints.length - 1];
          if (!lastPoint || Math.hypot(pt.x - lastPoint.x, pt.y - lastPoint.y) >= 3) {
            nextPoints.push(pt);
          }
        });
        return nextPoints.length === stroke.points.length ? stroke : { ...stroke, points: nextPoints };
      })
    );
  };

  const stopDrawing = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    isDrawingRef.current = false;
    activeStrokeIdRef.current = null;
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      pushHistory();
      const edgeId = `edge-${params.source}-${params.target}-${Date.now()}`;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: edgeId,
            type: 'smoothstep',
            style: { stroke: '#38bdf8', strokeWidth: 2.5 },
            labelStyle: { fill: '#e2e8f0', fontSize: 11, fontWeight: 600 },
            labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9, rx: 6, ry: 6 },
            labelBgPadding: [6, 3],
            markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8', width: 18, height: 18 },
          },
          eds
        )
      );
      setSelectedEdgeId(edgeId);
      setSelectedNodeId(null);
    },
    [pushHistory, setEdges]
  );

  const flowNodes = useMemo(() => {
    const diagramNodes = nodes.map((node) => ({
      ...node,
      data: { ...node.data, readOnly: diagramMode === 'view' },
      zIndex: node.type === 'zone' ? 1 : node.zIndex ?? 10,
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
          height: BACKGROUND_IMAGE_NODE_SIZE.height,
        },
        selectable: false,
        draggable: false,
        connectable: false,
        deletable: false,
        zIndex: 0,
      },
      ...diagramNodes,
    ];
  }, [backgroundImage, backgroundOpacity, diagramMode, nodes]);

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        labelStyle: edge.labelStyle || { fill: '#e2e8f0', fontSize: 11, fontWeight: 600 },
        labelBgStyle: edge.labelBgStyle || { fill: '#0f172a', fillOpacity: 0.9, rx: 6, ry: 6 },
        labelBgPadding: edge.labelBgPadding || [6, 3],
      })),
    [edges]
  );

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) || null, [edges, selectedEdgeId]);

  const updateSelectedNodeData = (patch: Record<string, any>) => {
    if (!selectedNodeId) return;
    setHasUnsavedChanges(true);
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
  };

  const updateSelectedEdge = (patch: Record<string, any>) => {
    if (!selectedEdgeId) return;
    setHasUnsavedChanges(true);
    setEdges((eds) => eds.map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e)));
  };

  const loadSavedDiagram = (entry: SavedDiagramEntry, mode: 'edit' | 'view' = 'edit') => {
    setHistory([]);
    setFuture([]);
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
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setHasUnsavedChanges(false);
    setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 80);
  };

  const loadTemplate = (key: string) => {
    setTemplatesMenuOpen(false);
    if (key === 'saved') {
      const latest = savedDiagrams[0];
      if (latest) loadSavedDiagram(latest);
      return;
    }
    const tpl = ARCHITECTURE_TEMPLATES[key];
    if (!tpl) return;
    const nextDiagram = cloneDiagram(tpl);
    setHistory([]);
    setFuture([]);
    setNodes(nextDiagram.nodes);
    setEdges(nextDiagram.edges);
    setDrawings([]);
    setActiveTemplate(key);
    setActiveDiagramId(null);
    setViewingDiagramId(null);
    setActiveDiagramName(key === 'blank' ? 'Novo Diagrama' : `Arquitetura ${tpl.label}`);
    setDiagramClientName(activeProject?.client || '');
    setDiagramProjectName(activeProject?.name || '');
    setDiagramMode('edit');
    setPenEnabled(false);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setHasUnsavedChanges(false);
    if (key === 'blank') {
      setBackgroundImage(null);
      setBackgroundOpacity(0.38);
    }
    setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 80);
  };

  const openNewDiagramForm = () => {
    setNewDiagramForm({
      name: activeProject?.name ? `Arquitetura - ${activeProject.name}` : 'Novo Diagrama de Arquitetura',
      clientName: activeProject?.client || diagramClientName || '',
      projectName: activeProject?.name || diagramProjectName || '',
      templateKey: 'blank',
    });
    setNewDiagramFormOpen(true);
  };

  const createNewDiagram = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tpl = ARCHITECTURE_TEMPLATES[newDiagramForm.templateKey] || ARCHITECTURE_TEMPLATES.blank;
    const nextDiagram = cloneDiagram(tpl);
    setHistory([]);
    setFuture([]);
    setNodes(nextDiagram.nodes);
    setEdges(nextDiagram.edges);
    setDrawings([]);
    setBackgroundImage(null);
    setBackgroundOpacity(0.38);
    setActiveTemplate(tpl.key);
    setActiveDiagramId(null);
    setViewingDiagramId(null);
    setActiveDiagramName(newDiagramForm.name.trim() || 'Diagrama sem título');
    setDiagramClientName(newDiagramForm.clientName.trim());
    setDiagramProjectName(newDiagramForm.projectName.trim());
    setDiagramMode('edit');
    setPenEnabled(false);
    setNewDiagramFormOpen(false);
    setHasUnsavedChanges(true);
    showToast('Novo diagrama criado');
  };

  const saveDiagram = useCallback(() => {
    if (diagramMode === 'view') {
      showToast('Este diagrama está em modo visualização. Clique em Editar.', 'warn');
      return;
    }

    const now = new Date().toISOString();
    const name = activeDiagramName.trim() || 'Diagrama sem título';
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
      const updated = savedDiagrams.map((entry) =>
        entry.id === activeDiagramId ? { ...entry, ...payload, name } : entry
      );
      persistSavedDiagrams(updated);
      setActiveDiagramName(name);
      setHasUnsavedChanges(false);
      showToast('Diagrama atualizado com sucesso');
      return;
    }

    const id = `diagram-${Date.now()}`;
    const created: SavedDiagramEntry = { id, name, ...payload, createdAt: now };
    persistSavedDiagrams([created, ...savedDiagrams]);
    setActiveTemplate('saved');
    setActiveDiagramId(id);
    setActiveDiagramName(name);
    setHasUnsavedChanges(false);
    showToast('Diagrama salvo em Diagramas Salvos');
  }, [
    activeDiagramId,
    activeDiagramName,
    activeTemplate,
    backgroundImage,
    backgroundOpacity,
    diagramClientName,
    diagramMode,
    diagramProjectName,
    drawings,
    edges,
    nodes,
    persistSavedDiagrams,
    savedDiagrams,
    showToast,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDiagram();
      } else if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        handleRedo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        handleUndo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        if (selectedNodeId) {
          event.preventDefault();
          duplicateNode(selectedNodeId);
        }
      } else if (event.key.toLowerCase() === 'v' && diagramMode === 'edit') {
        setPenEnabled(false);
      } else if (event.key.toLowerCase() === 'p' && diagramMode === 'edit') {
        setPenEnabled((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [diagramMode, duplicateNode, handleRedo, handleUndo, saveDiagram, selectedNodeId]);

  const deleteSavedDiagram = (entryId: string) => {
    const entry = savedDiagrams.find((item) => item.id === entryId);
    if (!entry) return;
    if (!window.confirm(`Excluir o diagrama "${entry.name}"?`)) return;

    const updated = savedDiagrams.filter((item) => item.id !== entryId);
    persistSavedDiagrams(updated);
    if (activeDiagramId === entryId) {
      setActiveDiagramId(null);
      setActiveDiagramName('Diagrama sem título');
    }
    if (viewingDiagramId === entryId) {
      setViewingDiagramId(null);
      setDiagramMode('edit');
    }
    showToast('Diagrama excluído', 'warn');
  };

  const captureDiagramPng = async (overrideNodes?: any[], overrideDrawings?: DrawingStroke[]) => {
    const targetNodes = overrideNodes || getNodes();
    const targetDrawings = overrideDrawings || drawings;
    if (targetNodes.length === 0 && targetDrawings.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    targetNodes.forEach((n) => {
      const width =
        n.id === BACKGROUND_IMAGE_NODE_ID
          ? Number(n.data?.width || BACKGROUND_IMAGE_NODE_SIZE.width)
          : Number(n.style?.width || n.measured?.width || 240);
      const height =
        n.id === BACKGROUND_IMAGE_NODE_ID
          ? Number(n.data?.height || BACKGROUND_IMAGE_NODE_SIZE.height)
          : Number(n.style?.height || n.measured?.height || 140);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + width);
      maxY = Math.max(maxY, n.position.y + height);
    });

    targetDrawings.forEach((stroke) => {
      stroke.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 72;
    const imageWidth = Math.max(320, maxX - minX + padding * 2);
    const imageHeight = Math.max(240, maxY - minY + padding * 2);

    const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportElement) return null;

    const translateX = -minX + padding;
    const translateY = -minY + padding;

    const dataUrl = await toPng(viewportElement, {
      backgroundColor: '#0b1120',
      width: imageWidth,
      height: imageHeight,
      pixelRatio: 2,
      cacheBust: true,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${translateX}px, ${translateY}px) scale(1)`,
      },
    });
    return { dataUrl, imageWidth, imageHeight };
  };

  const downloadPNG = async () => {
    setExportMenuOpen(false);
    try {
      const captured = await captureDiagramPng();
      if (!captured) return showToast('Adicione componentes antes de exportar.', 'warn');
      const link = document.createElement('a');
      link.download = `${(activeDiagramName || 'diagrama').replace(/\s+/g, '_')}.png`;
      link.href = captured.dataUrl;
      link.click();
      showToast('PNG exportado em alta resolução');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar PNG.', 'err');
    }
  };

  const downloadPDF = async (entryOverride?: SavedDiagramEntry) => {
    setExportMenuOpen(false);
    try {
      if (entryOverride) {
        loadSavedDiagram(entryOverride, 'view');
        await new Promise((r) => setTimeout(r, 320));
      }
      const captured = await captureDiagramPng();
      if (!captured) return showToast('Adicione componentes antes de exportar.', 'warn');

      const { dataUrl, imageWidth, imageHeight } = captured;
      const pdf = new jsPDF({
        orientation: imageWidth >= imageHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setFillColor(11, 17, 32);
      pdf.rect(0, 0, pageWidth, 68, 'F');
      pdf.setFontSize(17);
      pdf.setTextColor(248, 250, 252);
      pdf.text(entryOverride?.name || activeDiagramName || 'Diagrama de Arquitetura', 20, 28);

      pdf.setFontSize(9.5);
      pdf.setTextColor(148, 163, 184);
      const meta = [
        (entryOverride?.clientName || diagramClientName) && `Cliente: ${entryOverride?.clientName || diagramClientName}`,
        (entryOverride?.projectName || diagramProjectName) && `Projeto: ${entryOverride?.projectName || diagramProjectName}`,
      ]
        .filter(Boolean)
        .join('  •  ');
      if (meta) pdf.text(meta, 20, 48);

      pdf.setFontSize(13);
      pdf.setTextColor(34, 211, 238);
      pdf.text('NEXOS', pageWidth - 65, 30);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(new Date().toLocaleDateString('pt-BR'), pageWidth - 65, 45);

      const diagramY = 78;
      const availW = pageWidth - 36;
      const availH = pageHeight - diagramY - 28;
      const scale = Math.min(availW / imageWidth, availH / imageHeight, 1);
      const scaledW = imageWidth * scale;
      const scaledH = imageHeight * scale;
      pdf.addImage(dataUrl, 'PNG', (pageWidth - scaledW) / 2, diagramY, scaledW, scaledH);

      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      const compCount = nodes.filter((n) => n.type === 'arch').length;
      pdf.text(`Arquitetura NEXOS  •  ${compCount} componentes  •  ${edges.length} conexões`, 20, pageHeight - 10);
      pdf.save(`${(entryOverride?.name || activeDiagramName || 'diagrama').replace(/\s+/g, '_')}.pdf`);
      showToast('PDF executivo exportado');
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar PDF.', 'err');
    }
  };

  const exportJSON = () => {
    setExportMenuOpen(false);
    const payload = {
      name: activeDiagramName,
      clientName: diagramClientName,
      projectName: diagramProjectName,
      nodes,
      edges,
      drawings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(activeDiagramName || 'diagrama').replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Arquivo JSON exportado');
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          return showToast('JSON inválido para diagrama.', 'err');
        }
        pushHistory();
        setNodes(parsed.nodes);
        setEdges(parsed.edges);
        setDrawings(Array.isArray(parsed.drawings) ? parsed.drawings : []);
        if (parsed.name) setActiveDiagramName(parsed.name);
        if (parsed.clientName) setDiagramClientName(parsed.clientName);
        if (parsed.projectName) setDiagramProjectName(parsed.projectName);
        showToast('Diagrama importado do JSON');
        setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 80);
      } catch {
        showToast('Erro ao ler arquivo JSON.', 'err');
      }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  // Add helpers
  const getCenterFlowPos = () => {
    const rect = reactFlowWrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 260, y: 180 };
    return screenToFlowPosition({
      x: rect.left + rect.width / 2 + (Math.random() * 60 - 30),
      y: rect.top + rect.height / 2 + (Math.random() * 60 - 30),
    });
  };

  const addCatalogNode = (item: CatalogItem, position?: { x: number; y: number }) => {
    pushHistory();
    const id = `${item.variant || 'node'}-${Date.now()}`;
    const pos = position || getCenterFlowPos();
    const newNode = {
      id,
      type: 'arch',
      position: pos,
      data: {
        label: item.label,
        icon: item.icon,
        sublabel: item.sublabel,
        accent: item.accent,
        imageName: item.imageName || '',
        variant: item.variant,
        physicalType: item.physicalType,
        referenceImage: item.physicalType ? physicalComponentImages[item.physicalType] : undefined,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const addZoneNode = () => {
    pushHistory();
    const id = `zone-${Date.now()}`;
    const pos = getCenterFlowPos();
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'zone',
        position: { x: pos.x - 160, y: pos.y - 100 },
        style: { width: 340, height: 220 },
        data: { label: 'NOVA ZONA / SUB-REDE', sublabel: '10.0.0.0/24', accent: 'cyan', borderStyle: 'dashed' },
        zIndex: 1,
      },
    ]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const addNoteNode = () => {
    pushHistory();
    const id = `note-${Date.now()}`;
    const pos = getCenterFlowPos();
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'note',
        position: pos,
        style: { width: 220, height: 130 },
        data: { label: 'Nota Técnica', content: 'Descreva observações de link, VLAN ou SLA...', accent: 'amber' },
      },
    ]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const addCustomNode = () => {
    if (!customNodeName.trim()) return;
    pushHistory();
    const id = `node-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'arch',
        position: getCenterFlowPos(),
        data: {
          label: customNodeName.trim(),
          icon: 'server',
          sublabel: 'Tecnologia customizada',
          accent: 'violet',
          imageName: customNodeName.trim(),
        },
      },
    ]);
    setCustomNodeName('');
    setSelectedNodeId(id);
  };

  const autoOrganizeNodes = () => {
    const archNodes = nodes.filter((n) => n.type === 'arch' || n.type === 'note');
    if (archNodes.length === 0) return;
    pushHistory();
    const cols = Math.max(2, Math.ceil(Math.sqrt(archNodes.length)));
    const spacingX = 310;
    const spacingY = 180;
    const positionedIds = new Map<string, { x: number; y: number }>();
    archNodes.forEach((n, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positionedIds.set(n.id, { x: 80 + col * spacingX, y: 80 + row * spacingY });
    });
    setNodes((nds) =>
      nds.map((n) => (positionedIds.has(n.id) ? { ...n, position: positionedIds.get(n.id)! } : n))
    );
    setTimeout(() => fitView({ padding: 0.18, duration: 350 }), 60);
    showToast('Componentes alinhados em grade');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      pushHistory();
      const id = `node-${Date.now()}`;
      setNodes((nds) => [
        ...nds,
        {
          id,
          type: 'arch',
          position: getCenterFlowPos(),
          data: {
            label: file.name.split('.')[0],
            icon: 'radio',
            sublabel: 'Equipamento físico',
            uploadedImage: event.target?.result as string,
            variant: 'physical',
            accent: 'blue',
            imageName: '',
          },
        },
      ]);
      setSelectedNodeId(id);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
      setHasUnsavedChanges(true);
      showToast('Planta / imagem de fundo adicionada');
    };
    reader.readAsDataURL(file);
    if (backgroundInputRef.current) backgroundInputRef.current.value = '';
  };

  // Drag & Drop from left catalog
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/nexos-arch-item');
      if (!raw) return;
      try {
        const item = JSON.parse(raw) as CatalogItem;
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addCatalogNode(item, { x: position.x - 110, y: position.y - 36 });
      } catch {
        // ignore invalid drag payload
      }
    },
    [screenToFlowPosition]
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return COMPONENT_CATALOG;
    return COMPONENT_CATALOG.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sublabel.toLowerCase().includes(q) ||
        CATEGORY_LABELS[item.category].toLowerCase().includes(q)
    );
  }, [catalogSearch]);

  const stats = useMemo(
    () => ({
      components: nodes.filter((n) => n.type === 'arch').length,
      zones: nodes.filter((n) => n.type === 'zone').length,
      notes: nodes.filter((n) => n.type === 'note').length,
      connections: edges.length,
    }),
    [edges.length, nodes]
  );

  return (
    <div className="crm-workspace-backdrop absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Studio Header */}
      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-950/95 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={activeDiagramName}
                  disabled={diagramMode === 'view'}
                  onChange={(e) => {
                    setActiveDiagramName(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-44 min-w-0 truncate rounded bg-transparent px-1.5 py-0.5 text-sm font-bold text-slate-100 outline-none focus:bg-slate-900 focus:ring-1 focus:ring-cyan-500/50"
                />
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    hasUnsavedChanges
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {hasUnsavedChanges ? 'Não salvo' : 'Sincronizado'}
                </span>
              </div>
              {(diagramClientName || diagramProjectName) && (
                <p className="truncate px-1 text-[10.5px] text-slate-400">
                  {[diagramClientName, diagramProjectName].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
          </div>

          {/* Templates Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setTemplatesMenuOpen((o) => !o);
                setExportMenuOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-300"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Templates
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {templatesMenuOpen && (
              <div className="absolute left-0 top-10 z-50 w-72 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
                {Object.values(ARCHITECTURE_TEMPLATES).map((tpl) => (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => loadTemplate(tpl.key)}
                    className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors ${
                      activeTemplate === tpl.key
                        ? 'bg-cyan-500/15 text-cyan-200'
                        : 'text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="text-xs font-bold">{tpl.label}</span>
                    <span className="text-[10.5px] text-slate-400">{tpl.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSavedDiagramsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-cyan-500/50"
          >
            <FolderOpen className="h-3.5 w-3.5 text-cyan-400" />
            Salvos
            {savedDiagrams.length > 0 && (
              <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                {savedDiagrams.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={openNewDiagramForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500/50"
          >
            <Plus className="h-3.5 w-3.5 text-blue-400" />
            Novo
          </button>

          {diagramMode === 'view' && (
            <button
              type="button"
              onClick={() => setDiagramMode('edit')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-200"
            >
              <Pencil className="h-3.5 w-3.5" /> Modo Edição
            </button>
          )}

          <button
            type="button"
            onClick={saveDiagram}
            disabled={diagramMode === 'view'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-500/25 disabled:opacity-40"
            title="Salvar diagrama (Cmd+S)"
          >
            <Save className="h-3.5 w-3.5" />
            Salvar
          </button>

          {/* Export / Import Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen((o) => !o);
                setTemplatesMenuOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition-opacity hover:opacity-95"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => downloadPDF()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-400" /> Exportar PDF Executivo
                </button>
                <button
                  type="button"
                  onClick={downloadPNG}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  <FileImage className="h-3.5 w-3.5 text-cyan-400" /> Exportar PNG (2x HD)
                </button>
                <button
                  type="button"
                  onClick={exportJSON}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  <FileCode2 className="h-3.5 w-3.5 text-emerald-400" /> Exportar JSON
                </button>
                <div className="my-1 h-px bg-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    jsonInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  <Upload className="h-3.5 w-3.5 text-amber-400" /> Importar JSON
                </button>
              </div>
            )}
            <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={importJSON} />
          </div>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Component Palette */}
        {diagramMode === 'edit' && leftPanelOpen && (
          <aside className="z-20 flex w-64 shrink-0 flex-col border-r border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Biblioteca</span>
              <button
                type="button"
                onClick={() => setLeftPanelOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title="Recolher biblioteca"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="border-b border-slate-800/80 p-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar componente..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-1.5 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/60"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">Clique ou arraste para o canvas</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-2.5">
              {(['infra', 'security', 'cloud', 'physical'] as const).map((cat) => {
                const items = filteredCatalog.filter((i) => i.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {items.map((item) => {
                        const Icon = iconMap[item.icon] || Layers;
                        const accent = ACCENT_PALETTE[item.accent];
                        return (
                          <button
                            key={item.id}
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/nexos-arch-item', JSON.stringify(item));
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onClick={() => addCatalogNode(item)}
                            className="group flex items-center gap-2.5 rounded-lg border border-transparent bg-slate-900/40 px-2 py-1.5 text-left transition-all hover:border-slate-700/80 hover:bg-slate-900"
                          >
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 ${accent.bg}`}>
                              <Icon className="h-3.5 w-3.5" style={{ color: accent.hex }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-semibold text-slate-200 group-hover:text-white">
                                {item.label}
                              </div>
                              <div className="truncate text-[10px] text-slate-500">{item.sublabel}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Custom Tech & Photo */}
              <div className="border-t border-slate-800/80 pt-3">
                <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Personalizado & Fundo
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customNodeName}
                    onChange={(e) => setCustomNodeName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomNode()}
                    placeholder="Ex: AWS, Docker, Mikrotik"
                    className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/60"
                  />
                  <button
                    type="button"
                    onClick={addCustomNode}
                    className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-500"
                  >
                    +
                  </button>
                </div>

                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Foto de Equipamento
                </button>

                <input type="file" accept="image/*" className="hidden" ref={backgroundInputRef} onChange={handleBackgroundUpload} />
                <button
                  type="button"
                  onClick={() => backgroundInputRef.current?.click()}
                  className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Planta / Imagem de Fundo
                </button>

                {backgroundImage && (
                  <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                    <div className="flex items-center justify-between text-[10.5px] text-slate-400">
                      <span>Opacidade do fundo</span>
                      <span>{Math.round(backgroundOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.85"
                      step="0.02"
                      value={backgroundOpacity}
                      onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
                      className="mt-1 w-full accent-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setBackgroundImage(null)}
                      className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3 w-3" /> Remover fundo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Canvas Area */}
        <div
          ref={reactFlowWrapperRef}
          className="relative flex-1 bg-[#070b16]"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {diagramMode === 'edit' && !leftPanelOpen && (
            <button
              type="button"
              onClick={() => setLeftPanelOpen(true)}
              className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md hover:border-cyan-500/50"
            >
              <PanelLeftOpen className="h-3.5 w-3.5 text-cyan-400" /> Biblioteca
            </button>
          )}

          {!rightPanelOpen && (
            <button
              type="button"
              onClick={() => setRightPanelOpen(true)}
              className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md hover:border-cyan-500/50"
            >
              <PanelRightOpen className="h-3.5 w-3.5 text-cyan-400" /> Inspetor
            </button>
          )}

          <DiagramActionsContext.Provider value={{ setNodes, duplicateNode, deleteNode }}>
            <ReactFlow
              nodes={flowNodes}
              edges={styledEdges}
              onNodesChange={
                diagramMode === 'edit'
                  ? (changes) => {
                      setHasUnsavedChanges(true);
                      onNodesChange(changes);
                    }
                  : undefined
              }
              onEdgesChange={
                diagramMode === 'edit'
                  ? (changes) => {
                      setHasUnsavedChanges(true);
                      onEdgesChange(changes);
                    }
                  : undefined
              }
              onConnect={diagramMode === 'edit' ? onConnect : undefined}
              onNodeClick={(_, node) => {
                if (node.id === BACKGROUND_IMAGE_NODE_ID) return;
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
                setRightPanelOpen(true);
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
                setRightPanelOpen(true);
              }}
              onPaneClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setTemplatesMenuOpen(false);
                setExportMenuOpen(false);
              }}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              nodesDraggable={diagramMode === 'edit' && !penEnabled}
              nodesConnectable={diagramMode === 'edit' && !penEnabled}
              elementsSelectable={diagramMode === 'edit' && !penEnabled}
              panOnDrag={diagramMode === 'edit' && !penEnabled}
              snapToGrid={snapToGrid}
              snapGrid={[16, 16]}
              connectionRadius={28}
              connectionLineStyle={{ stroke: '#22d3ee', strokeWidth: 2.5 }}
              colorMode="dark"
              fitView
              fitViewOptions={{ padding: 0.22 }}
              className="bg-transparent"
            >
              {gridVariant !== 'none' && (
                <Background
                  variant={gridVariant === 'lines' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
                  color={gridVariant === 'lines' ? '#172033' : '#263345'}
                  gap={24}
                  size={gridVariant === 'lines' ? 1 : 1.6}
                />
              )}
              <Controls className="!border-slate-800 !bg-slate-900/90 !fill-slate-300 !shadow-xl" />
              <MiniMap
                nodeColor={(n) => (n.type === 'zone' ? '#1e293b' : '#22d3ee')}
                maskColor="rgba(7, 11, 22, 0.75)"
                className="!rounded-xl !border !border-slate-800 !bg-slate-900/90"
              />

              <ViewportPortal>
                <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" style={{ width: 1, height: 1, zIndex: 15 }}>
                  {drawings.map((stroke) => (
                    <path
                      key={stroke.id}
                      d={buildStrokePath(stroke.points)}
                      fill="none"
                      stroke={stroke.color}
                      strokeWidth={stroke.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={stroke.opacity ?? 0.96}
                    />
                  ))}
                </svg>
              </ViewportPortal>

              {/* Floating Canvas Dock */}
              {diagramMode === 'edit' && (
                <Panel position="bottom-center" className="flex flex-col items-center gap-1.5">
                  {penEnabled && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/90 bg-slate-900/95 px-3 py-1.5 shadow-2xl backdrop-blur-xl">
                      <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-0.5">
                        <button
                          type="button"
                          onClick={() => setPenMode('pen')}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            penMode === 'pen' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Caneta
                        </button>
                        <button
                          type="button"
                          onClick={() => setPenMode('highlighter')}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                            penMode === 'highlighter' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Marca-texto
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {PEN_COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.hex}
                            type="button"
                            onClick={() => setPenColor(preset.hex)}
                            className={`h-5 w-5 rounded-full border-2 transition-transform ${
                              penColor.toLowerCase() === preset.hex.toLowerCase()
                                ? 'scale-115 border-white shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                                : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: preset.hex }}
                            title={preset.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={penColor}
                          onChange={(e) => setPenColor(e.target.value)}
                          className="ml-1 h-6 w-6 cursor-pointer rounded-md border border-slate-700 bg-transparent"
                          title="Cor personalizada"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
                        <span className="text-[10px] font-semibold text-slate-400">{penWidth}px</span>
                        <input
                          type="range"
                          min="2"
                          max="12"
                          value={penWidth}
                          onChange={(e) => setPenWidth(Number(e.target.value))}
                          className="w-16 accent-amber-400"
                          title="Espessura do traço"
                        />
                        <button
                          type="button"
                          onClick={() => setDrawings((d) => d.slice(0, -1))}
                          disabled={drawings.length === 0}
                          className="rounded p-1 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                          title="Desfazer último traço"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDrawings([])}
                          disabled={drawings.length === 0}
                          className="rounded p-1 text-rose-300 hover:bg-rose-500/20 disabled:opacity-30"
                          title="Limpar todos os traços"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-800/90 bg-slate-900/95 px-2.5 py-1.5 shadow-2xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => setPenEnabled(false)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      !penEnabled ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Selecionar e mover (V)"
                  >
                    <MousePointer2 className="h-3.5 w-3.5" /> Selecionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPenEnabled((p) => !p)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      penEnabled ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Caneta livre (P)"
                  >
                    <PenLine className="h-3.5 w-3.5" /> Caneta
                  </button>

                  <div className="mx-1 h-4 w-px bg-slate-800" />

                  <button
                    type="button"
                    onClick={addZoneNode}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-cyan-300"
                    title="Adicionar Zona / Sub-rede"
                  >
                    <SquareDashedBottom className="h-3.5 w-3.5 text-cyan-400" /> + Zona
                  </button>
                  <button
                    type="button"
                    onClick={addNoteNode}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-amber-300"
                    title="Adicionar Nota Técnica"
                  >
                    <StickyNote className="h-3.5 w-3.5 text-amber-400" /> + Nota
                  </button>

                  <div className="mx-1 h-4 w-px bg-slate-800" />

                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                    title="Desfazer (Cmd+Z)"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={future.length === 0}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
                    title="Refazer (Cmd+Shift+Z)"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="mx-1 h-4 w-px bg-slate-800" />

                  <button
                    type="button"
                    onClick={() => setSnapToGrid((s) => !s)}
                    className={`rounded-lg p-1.5 transition-colors ${
                      snapToGrid ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                    title="Alinhar à grade (Snap to Grid)"
                  >
                    <Magnet className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setGridVariant((v) => (v === 'dots' ? 'lines' : v === 'lines' ? 'none' : 'dots'))
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    title={`Grade: ${gridVariant}`}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={autoOrganizeNodes}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-300"
                    title="Auto-organizar em grade"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fitView({ padding: 0.18, duration: 300 })}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    title="Ajustar à tela"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </DiagramActionsContext.Provider>

          {diagramMode === 'edit' && penEnabled && (
            <div
              className="absolute inset-0 z-20 cursor-crosshair touch-none select-none"
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={stopDrawing}
            />
          )}

          {/* Toast */}
          {toast && (
            <div
              className={`pointer-events-none absolute top-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold shadow-2xl backdrop-blur-md ${
                toast.tone === 'err'
                  ? 'border-rose-500/40 bg-rose-950/90 text-rose-200'
                  : toast.tone === 'warn'
                  ? 'border-amber-500/40 bg-amber-950/90 text-amber-200'
                  : 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              {toast.text}
            </div>
          )}
        </div>

        {/* Right Contextual Inspector */}
        {rightPanelOpen && (
          <aside className="z-20 flex w-72 shrink-0 flex-col border-l border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {selectedNode
                  ? selectedNode.type === 'zone'
                    ? 'Propriedades da Zona'
                    : selectedNode.type === 'note'
                    ? 'Propriedades da Nota'
                    : 'Propriedades do Nó'
                  : selectedEdge
                  ? 'Propriedades da Conexão'
                  : 'Inspetor do Diagrama'}
              </span>
              <button
                type="button"
                onClick={() => setRightPanelOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title="Fechar inspetor"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
              {selectedNode && selectedNode.type === 'arch' && (
                <>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Nome do componente</span>
                    <input
                      type="text"
                      value={selectedNode.data.label || ''}
                      onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Subtítulo / Função</span>
                    <input
                      type="text"
                      value={selectedNode.data.sublabel || ''}
                      onChange={(e) => updateSelectedNodeData({ sublabel: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Ponto / Local (etiqueta superior)</span>
                    <input
                      type="text"
                      placeholder="Ex: Matriz, Torre Norte, POP 01"
                      value={selectedNode.data.nameBox || ''}
                      onChange={(e) => updateSelectedNodeData({ nameBox: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">IP / CIDR</span>
                      <input
                        type="text"
                        placeholder="10.0.0.1"
                        value={selectedNode.data.metaIp || ''}
                        onChange={(e) => updateSelectedNodeData({ metaIp: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 font-mono text-[11px] text-cyan-200 outline-none focus:border-cyan-500/60"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">VLAN / Porta</span>
                      <input
                        type="text"
                        placeholder="VLAN 10 / 10G"
                        value={selectedNode.data.metaVlan || ''}
                        onChange={(e) => updateSelectedNodeData({ metaVlan: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-cyan-500/60"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Status operacional</span>
                    <select
                      value={selectedNode.data.metaStatus || ''}
                      onChange={(e) => updateSelectedNodeData({ metaStatus: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    >
                      <option value="">Sem indicador</option>
                      <option value="online">Online / Ativo</option>
                      <option value="planned">Planejado / Implantação</option>
                      <option value="critical">Crítico / Contingência</option>
                    </select>
                  </label>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">Cor de destaque</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(Object.keys(ACCENT_PALETTE) as NodeAccentKey[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateSelectedNodeData({ accent: key })}
                          className={`h-6 w-6 rounded-full border-2 transition-transform ${
                            (selectedNode.data.accent || 'blue') === key
                              ? 'scale-110 border-white'
                              : 'border-transparent opacity-75 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: ACCENT_PALETTE[key].hex }}
                          title={ACCENT_PALETTE[key].label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-800/80 pt-3">
                    <button
                      type="button"
                      onClick={() => duplicateNode(selectedNode.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/50"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNode(selectedNode.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </>
              )}

              {selectedNode && selectedNode.type === 'zone' && (
                <>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Título da Zona</span>
                    <input
                      type="text"
                      value={selectedNode.data.label || ''}
                      onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Sub-rede / Escopo</span>
                    <input
                      type="text"
                      value={selectedNode.data.sublabel || ''}
                      onChange={(e) => updateSelectedNodeData({ sublabel: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Borda</span>
                    <select
                      value={selectedNode.data.borderStyle || 'dashed'}
                      onChange={(e) => updateSelectedNodeData({ borderStyle: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100"
                    >
                      <option value="dashed">Tracejada</option>
                      <option value="solid">Sólida</option>
                    </select>
                  </label>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">Cor</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(Object.keys(ACCENT_PALETTE) as NodeAccentKey[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateSelectedNodeData({ accent: key })}
                          className={`h-6 w-6 rounded-full border-2 ${
                            (selectedNode.data.accent || 'blue') === key ? 'scale-110 border-white' : 'border-transparent opacity-75'
                          }`}
                          style={{ backgroundColor: ACCENT_PALETTE[key].hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNode(selectedNode.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1.5 text-xs font-semibold text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir Zona
                  </button>
                </>
              )}

              {selectedNode && selectedNode.type === 'note' && (
                <>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Título da Nota</span>
                    <input
                      type="text"
                      value={selectedNode.data.label || ''}
                      onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Conteúdo</span>
                    <textarea
                      rows={5}
                      value={selectedNode.data.content || ''}
                      onChange={(e) => updateSelectedNodeData({ content: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    />
                  </label>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">Cor</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(['amber', 'cyan', 'emerald', 'violet', 'rose'] as NodeAccentKey[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateSelectedNodeData({ accent: key })}
                          className={`h-6 w-6 rounded-full border-2 ${
                            (selectedNode.data.accent || 'amber') === key ? 'scale-110 border-white' : 'border-transparent opacity-75'
                          }`}
                          style={{ backgroundColor: ACCENT_PALETTE[key].hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNode(selectedNode.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1.5 text-xs font-semibold text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir Nota
                  </button>
                </>
              )}

              {selectedEdge && (
                <>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Rótulo do link / conexão</span>
                    <input
                      type="text"
                      placeholder="Ex: Fibra 10G, VPN IPsec, PoE+"
                      value={String(selectedEdge.label || '')}
                      onChange={(e) => updateSelectedEdge({ label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-400">Tipo de traçado</span>
                    <select
                      value={selectedEdge.type || 'smoothstep'}
                      onChange={(e) => updateSelectedEdge({ type: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100"
                    >
                      <option value="smoothstep">Ortogonal (SmoothStep)</option>
                      <option value="default">Curva (Bezier)</option>
                      <option value="straight">Linha Reta</option>
                    </select>
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2">
                    <span className="text-xs font-semibold text-slate-300">Fluxo animado</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.animated)}
                      onChange={(e) => updateSelectedEdge({ animated: e.target.checked })}
                      className="h-4 w-4 accent-cyan-400"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2">
                    <span className="text-xs font-semibold text-slate-300">Linha tracejada</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.style?.strokeDasharray)}
                      onChange={(e) =>
                        updateSelectedEdge({
                          style: {
                            ...(selectedEdge.style || {}),
                            strokeDasharray: e.target.checked ? '6 5' : undefined,
                          },
                        })
                      }
                      className="h-4 w-4 accent-cyan-400"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">Cor da conexão</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {EDGE_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() =>
                            updateSelectedEdge({
                              style: { ...(selectedEdge.style || {}), stroke: c.hex, strokeWidth: selectedEdge.style?.strokeWidth || 2.5 },
                              markerEnd: { type: MarkerType.ArrowClosed, color: c.hex, width: 18, height: 18 },
                            })
                          }
                          className={`h-6 w-6 rounded-full border-2 ${
                            selectedEdge.style?.stroke === c.hex ? 'scale-110 border-white' : 'border-transparent opacity-80'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-slate-800/80 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedEdge({
                          source: selectedEdge.target,
                          target: selectedEdge.source,
                        })
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/50"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" /> Inverter
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEdge(selectedEdge.id)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 py-1.5 text-xs font-semibold text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </>
              )}

              {!selectedNode && !selectedEdge && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                      <span className="text-[10px] text-slate-400">Componentes</span>
                      <div className="text-lg font-extrabold text-cyan-300">{stats.components}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                      <span className="text-[10px] text-slate-400">Conexões</span>
                      <div className="text-lg font-extrabold text-blue-300">{stats.connections}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                      <span className="text-[10px] text-slate-400">Zonas</span>
                      <div className="text-lg font-extrabold text-emerald-300">{stats.zones}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                      <span className="text-[10px] text-slate-400">Notas</span>
                      <div className="text-lg font-extrabold text-amber-300">{stats.notes}</div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800/80 pt-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">Cliente</span>
                      <input
                        type="text"
                        value={diagramClientName}
                        onChange={(e) => {
                          setDiagramClientName(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Nome do cliente"
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-400">Projeto</span>
                      <input
                        type="text"
                        value={diagramProjectName}
                        onChange={(e) => {
                          setDiagramProjectName(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Nome do projeto"
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500/60"
                      />
                    </label>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-2.5 text-[11px] text-slate-400">
                    <div className="mb-1.5 font-bold text-slate-300">Atalhos rápidos</div>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Salvar diagrama</span><kbd className="rounded bg-slate-800 px-1.5 text-[10px]">⌘S</kbd></div>
                      <div className="flex justify-between"><span>Desfazer / Refazer</span><kbd className="rounded bg-slate-800 px-1.5 text-[10px]">⌘Z / ⌘⇧Z</kbd></div>
                      <div className="flex justify-between"><span>Duplicar selecionado</span><kbd className="rounded bg-slate-800 px-1.5 text-[10px]">⌘D</kbd></div>
                      <div className="flex justify-between"><span>Selecionar / Caneta</span><kbd className="rounded bg-slate-800 px-1.5 text-[10px]">V / P</kbd></div>
                      <div className="flex justify-between"><span>Excluir item</span><kbd className="rounded bg-slate-800 px-1.5 text-[10px]">Backspace</kbd></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modal Diagramas Salvos */}
      {savedDiagramsModalOpen && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="flex items-center gap-3 text-base font-bold text-slate-100">
                <FolderOpen className="h-5 w-5 text-cyan-400" />
                Diagramas Salvos
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-bold text-cyan-300">
                  {savedDiagrams.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setSavedDiagramsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 72px)' }}>
              {savedDiagrams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <FolderOpen className="mb-3 h-12 w-12 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-200">Nenhum diagrama salvo ainda</p>
                  <p className="mt-1 text-xs text-slate-400">Salve o diagrama atual para acessá-lo a qualquer momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {savedDiagrams.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex flex-col rounded-xl border p-4 transition-all ${
                        activeDiagramId === entry.id
                          ? 'border-cyan-500/60 bg-cyan-500/10'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="mb-2 flex items-start gap-2.5">
                        <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-400">
                          <Layers className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-sm font-bold text-slate-100">{entry.name}</h3>
                          {(entry.clientName || entry.projectName) && (
                            <p className="truncate text-[11px] text-slate-400">
                              {[entry.clientName, entry.projectName].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {new Date(entry.updatedAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="mt-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSavedDiagramsModalOpen(false);
                            downloadPDF(entry);
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/50"
                        >
                          <FileText className="h-3.5 w-3.5" /> PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            loadSavedDiagram(entry, 'edit');
                            setSavedDiagramsModalOpen(false);
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedDiagram(entry.id)}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Diagrama */}
      {newDiagramFormOpen && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form onSubmit={createNewDiagram} className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Novo Diagrama</p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-100">Diagrama de Arquitetura</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewDiagramFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
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
                  onChange={(e) => setNewDiagramForm((c) => ({ ...c, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
                  required
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Nome do cliente
                <input
                  type="text"
                  value={newDiagramForm.clientName}
                  onChange={(e) => setNewDiagramForm((c) => ({ ...c, clientName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Nome do projeto
                <input
                  type="text"
                  value={newDiagramForm.projectName}
                  onChange={(e) => setNewDiagramForm((c) => ({ ...c, projectName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Modelo inicial
                <select
                  value={newDiagramForm.templateKey}
                  onChange={(e) => setNewDiagramForm((c) => ({ ...c, templateKey: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60"
                >
                  {Object.values(ARCHITECTURE_TEMPLATES).map((tpl) => (
                    <option key={tpl.key} value={tpl.key}>
                      {tpl.label} — {tpl.description}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewDiagramFormOpen(false)}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg"
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
