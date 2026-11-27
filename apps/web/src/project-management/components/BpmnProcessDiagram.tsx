import React, { useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, ZoomIn, ZoomOut, ShieldCheck, ArrowRight, GitBranch,
  Layers, Link2, ExternalLink, RotateCcw, Building2, Upload, ArrowLeft, X, Copy, Pencil,
  Hand, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  BPMN_GOVERNANCE,
  type BpmnDiagram,
  type BpmnEdge,
  type BpmnNode,
  type BpmnNodeType,
  type BpmnAnchorSide
} from '../data/bpmnTemplates';
import { computeBpmnLayout, computeEdgePoints } from './bpmnPdfExport';

interface BpmnProcessDiagramProps {
  diagram: BpmnDiagram;
  onChange: (updated: BpmnDiagram) => void;
  onSelectLinkedCode?: (code: string) => void;
  onResetToTemplate?: () => void;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

export default function BpmnProcessDiagram({
  diagram,
  onChange,
  onSelectLinkedCode,
  onResetToTemplate
}: BpmnProcessDiagramProps) {
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showEdgeForm, setShowEdgeForm] = useState(false);
  const [showHeaderEditor, setShowHeaderEditor] = useState(false);
  const [showGovernance, setShowGovernance] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ col: number; laneId: string } | null>(null);
  const [inlineEditNodeId, setInlineEditNodeId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [inlineEditLaneId, setInlineEditLaneId] = useState<string | null>(null);
  const [inlineEditLaneValue, setInlineEditLaneValue] = useState('');
  const [panMode, setPanMode] = useState(false);
  const [panning, setPanning] = useState<{ startX: number; scrollLeft: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const nodeLabelInputRef = useRef<HTMLInputElement | null>(null);

  const handleFitToWidth = () => {
    const el = scrollContainerRef.current;
    if (!el || !layout.width) return;
    const available = Math.max(320, el.clientWidth - 40);
    const fitZoom = Math.min(1, Math.max(0.45, Number((available / layout.width).toFixed(2))));
    setZoom(fitZoom);
  };

  const scrollHorizontal = (delta: number) => {
    scrollContainerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const [newEdge, setNewEdge] = useState<{
    from: string;
    to: string;
    label: string;
    fromSide: BpmnAnchorSide;
    toSide: BpmnAnchorSide;
    route: NonNullable<BpmnEdge['route']>;
  }>({
    from: diagram.nodes[0]?.id || '',
    to: diagram.nodes[1]?.id || '',
    label: '',
    fromSide: 'right',
    toSide: 'left',
    route: 'auto'
  });

  const layout = useMemo(() => computeBpmnLayout(diagram), [diagram]);
  const selectedNode = diagram.nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = diagram.edges.find((e) => e.id === selectedEdgeId) || null;

  const updateNode = (id: string, patch: Partial<BpmnNode>) => {
    onChange({
      ...diagram,
      nodes: diagram.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
    });
  };

  const duplicateNode = (node: BpmnNode) => {
    const id = `n-${Date.now()}`;
    const copy: BpmnNode = {
      ...node,
      id,
      label: `${node.label} (cópia)`,
      col: node.col + 1
    };
    onChange({
      ...diagram,
      nodes: [...diagram.nodes, copy]
    });
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const removeNode = (id: string) => {
    onChange({
      ...diagram,
      nodes: diagram.nodes.filter((n) => n.id !== id),
      edges: diagram.edges.filter((e) => e.from !== id && e.to !== id)
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const addNode = (type: BpmnNodeType) => {
    const maxCol = diagram.nodes.reduce((m, n) => Math.max(m, n.col), -1);
    const id = `n-${Date.now()}`;
    const defaultLabel =
      type === 'gateway'
        ? 'Decisão?'
        : type === 'subprocess'
          ? 'Novo subprocesso'
          : type === 'start'
            ? 'Início'
            : type === 'end'
              ? 'Fim'
              : 'Nova atividade';
    const created: BpmnNode = {
      id,
      type,
      label: defaultLabel,
      laneId: diagram.lanes[0]?.id || 'lane-0',
      col: maxCol + 1,
      rowOffset: 0
    };
    onChange({
      ...diagram,
      nodes: [...diagram.nodes, created]
    });
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const addLane = () => {
    const id = `lane-${Date.now()}`;
    onChange({
      ...diagram,
      lanes: [...diagram.lanes, { id, label: `Nova Raia ${diagram.lanes.length + 1}`, height: 125 }]
    });
  };

  const updateLaneLabel = (id: string, label: string) => {
    onChange({
      ...diagram,
      lanes: diagram.lanes.map((l) => (l.id === id ? { ...l, label } : l))
    });
  };

  const removeLane = (id: string) => {
    if (diagram.lanes.length <= 1) return;
    const fallbackLaneId = diagram.lanes.find((l) => l.id !== id)?.id || diagram.lanes[0].id;
    onChange({
      ...diagram,
      lanes: diagram.lanes.filter((l) => l.id !== id),
      nodes: diagram.nodes.map((n) => (n.laneId === id ? { ...n, laneId: fallbackLaneId } : n))
    });
  };

  const handleAddEdge = () => {
    if (!newEdge.from || !newEdge.to || newEdge.from === newEdge.to) return;
    const created: BpmnEdge = {
      id: `e-${Date.now()}`,
      from: newEdge.from,
      to: newEdge.to,
      label: newEdge.label.trim() || undefined,
      fromSide: newEdge.fromSide,
      toSide: newEdge.toSide,
      route: newEdge.route
    };
    onChange({
      ...diagram,
      edges: [...diagram.edges, created]
    });
    setShowEdgeForm(false);
    setNewEdge((prev) => ({ ...prev, label: '' }));
  };

  const updateEdge = (id: string, patch: Partial<BpmnEdge>) => {
    onChange({
      ...diagram,
      edges: diagram.edges.map((e) => (e.id === id ? { ...e, ...patch } : e))
    });
  };

  const removeEdge = (id: string) => {
    onChange({
      ...diagram,
      edges: diagram.edges.filter((e) => e.id !== id)
    });
    if (selectedEdgeId === id) setSelectedEdgeId(null);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Selecione uma imagem de logo de até 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ ...diagram, companyLogo: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const getSvgCoords = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (event.clientX - rect.left) / zoom;
    const svgY = (event.clientY - rect.top) / zoom;
    const targetCol = Math.max(0, Math.round((svgX - layout.laneHeaderWidth - 42 - 56) / 144));
    const targetLane = layout.lanes.find((l) => svgY >= l.y && svgY <= l.y + l.height) || layout.lanes[0];
    return { col: targetCol, laneId: targetLane.id };
  };

  const startInlineEdit = (node: BpmnNode) => {
    setDraggingNodeId(null);
    setDragPreview(null);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setInlineEditNodeId(node.id);
    setInlineEditValue(node.label);
  };

  const commitInlineEdit = () => {
    if (!inlineEditNodeId) return;
    const trimmed = inlineEditValue.trim();
    if (trimmed) {
      updateNode(inlineEditNodeId, { label: trimmed });
    }
    setInlineEditNodeId(null);
  };

  const handleSvgMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNodeId) return;
    const pos = getSvgCoords(event);
    if (pos) setDragPreview(pos);
  };

  const handleSvgMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNodeId) return;
    const pos = getSvgCoords(event);
    const currentNode = diagram.nodes.find((n) => n.id === draggingNodeId);
    if (currentNode && pos && (currentNode.col !== pos.col || currentNode.laneId !== pos.laneId)) {
      updateNode(draggingNodeId, {
        col: pos.col,
        laneId: pos.laneId
      });
    }
    setDraggingNodeId(null);
    setDragPreview(null);
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      {/* Barra de ferramentas de edição do diagrama BPMN */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => addNode('start')}
            className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20"
          >
            <Plus className="h-3.5 w-3.5" /> Início
          </button>
          <button
            type="button"
            onClick={() => addNode('task')}
            className="flex items-center gap-1 rounded-md border border-[#1d5d8c]/40 bg-[#1d5d8c]/10 px-2.5 py-1.5 text-xs font-bold text-[#38bdf8] hover:bg-[#1d5d8c]/20"
          >
            <Plus className="h-3.5 w-3.5" /> Atividade
          </button>
          <button
            type="button"
            onClick={() => addNode('subprocess')}
            className="flex items-center gap-1 rounded-md border border-[#1d5d8c]/40 bg-[#1d5d8c]/10 px-2.5 py-1.5 text-xs font-bold text-[#38bdf8] hover:bg-[#1d5d8c]/20"
          >
            <Plus className="h-3.5 w-3.5" /> Subprocesso (+)
          </button>
          <button
            type="button"
            onClick={() => addNode('gateway')}
            className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20"
          >
            <Plus className="h-3.5 w-3.5" /> Decisão (X)
          </button>
          <button
            type="button"
            onClick={() => addNode('end')}
            className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20"
          >
            <Plus className="h-3.5 w-3.5" /> Fim
          </button>
          <button
            type="button"
            onClick={() => setShowEdgeForm((v) => !v)}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              showEdgeForm
                ? 'border-[#2563eb] bg-[#2563eb]/20 text-white'
                : 'border-[var(--crm-border)] text-[var(--crm-ink)] hover:border-[#2563eb]'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" /> Conectar nós
          </button>
          <button
            type="button"
            onClick={addLane}
            className="flex items-center gap-1 rounded-md border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-bold text-[var(--crm-ink)] hover:border-[#2563eb]"
          >
            <Layers className="h-3.5 w-3.5" /> + Raia
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHeaderEditor((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              showHeaderEditor
                ? 'border-[#2563eb] bg-[#2563eb] text-white'
                : 'border-[#2563eb]/50 bg-[#2563eb]/15 text-[#38bdf8] hover:bg-[#2563eb]/25'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar BPMN / Descritivo
          </button>
          <button
            type="button"
            onClick={() => setShowGovernance((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors ${
              showGovernance
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                : 'border-[var(--crm-border)] text-[var(--crm-muted)] hover:text-[var(--crm-ink)]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Governança
          </button>
          {onResetToTemplate && (
            <button
              type="button"
              onClick={onResetToTemplate}
              className="flex items-center gap-1.5 rounded-md border border-[var(--crm-border)] px-2.5 py-1.5 text-xs font-bold text-[var(--crm-muted)] hover:text-[var(--crm-ink)]"
              title="Restaurar modelo padrão do manual"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
            </button>
          )}
          <div className="flex items-center rounded-md border border-[var(--crm-border)] bg-transparent">
            <button
              type="button"
              onClick={() => scrollHorizontal(-280)}
              className="px-2 py-1.5 text-xs font-bold text-[var(--crm-muted)] hover:text-[var(--crm-ink)] border-r border-[var(--crm-border)]"
              title="Rolar BPMN para a esquerda"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={() => scrollHorizontal(280)}
              className="px-2 py-1.5 text-xs font-bold text-[var(--crm-muted)] hover:text-[var(--crm-ink)] border-r border-[var(--crm-border)]"
              title="Rolar BPMN para a direita"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 text-[var(--crm-muted)] hover:text-[var(--crm-ink)]"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-bold text-[var(--crm-ink)]">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 text-[var(--crm-muted)] hover:text-[var(--crm-ink)]"
              title="Aumentar zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFitToWidth}
              className="px-2 py-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 border-l border-[var(--crm-border)]"
              title="Ajustar largura do BPMN na tela"
            >
              Ajustar
            </button>
          </div>
        </div>
      </div>

      {/* Painel completo de edição do BPMN (Código, Título, Descritivo, Empresa, Responsável, Logo, Base e Rodapé) */}
      {showHeaderEditor && (
        <div className="rounded-lg border border-[#2563eb]/40 bg-[rgb(var(--crm-surface-2-rgb)/0.94)] p-4 grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Código BPMN</label>
            <input
              value={diagram.code}
              onChange={(e) => onChange({ ...diagram, code: e.target.value })}
              placeholder="Ex: BPMN-00"
              className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-bold text-[var(--crm-ink)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Título do BPMN</label>
            <input
              value={diagram.title}
              onChange={(e) => onChange({ ...diagram, title: e.target.value })}
              placeholder="Ex: Macroprocesso comercial"
              className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-bold text-[var(--crm-ink)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Subtítulo</label>
            <input
              value={diagram.subtitle || ''}
              onChange={(e) => onChange({ ...diagram, subtitle: e.target.value })}
              placeholder="ARQUITETURA DE PROCESSOS"
              className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Nome da Empresa</label>
            <input
              value={diagram.companyName || ''}
              onChange={(e) => onChange({ ...diagram, companyName: e.target.value })}
              placeholder="Ex: Empresa Cliente Ltda"
              className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-semibold text-[var(--crm-ink)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Nome do Responsável</label>
            <input
              value={diagram.responsibleName || ''}
              onChange={(e) => onChange({ ...diagram, responsibleName: e.target.value })}
              placeholder="Ex: Carlos Horst"
              className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-semibold text-[var(--crm-ink)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Base / Referência</label>
            <input
              value={diagram.sourceBase || ''}
              onChange={(e) => onChange({ ...diagram, sourceBase: e.target.value })}
              placeholder="Ex: Base: Manual §§ 1-2"
              className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Descritivo / Controles e Regras</label>
            <textarea
              rows={2}
              value={diagram.controlsText}
              onChange={(e) => onChange({ ...diagram, controlsText: e.target.value })}
              className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
            />
          </div>
          <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#2563eb]/40 bg-[#2563eb]/10 px-3 py-1.5 text-xs font-bold text-[#38bdf8] hover:bg-[#2563eb]/20">
                <Upload className="h-3.5 w-3.5" />
                {diagram.companyLogo ? 'Alterar Logo da Empresa' : 'Inserir Logo da Empresa'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
              </label>
              {diagram.companyLogo && (
                <div className="flex items-center gap-2">
                  <img src={diagram.companyLogo} alt="Logo" className="h-8 w-8 rounded bg-white object-contain p-0.5 border border-[var(--crm-border)]" />
                  <button
                    type="button"
                    onClick={() => onChange({ ...diagram, companyLogo: undefined })}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                  >
                    <X className="h-3.5 w-3.5" /> Remover logo
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowHeaderEditor(false)}
              className="rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1d4ed8]"
            >
              Concluir edição
            </button>
          </div>
        </div>
      )}

      {/* Formulário rápido para adicionar conexão */}
      {showEdgeForm && (
        <div className="rounded-lg border border-[#2563eb]/40 bg-[rgb(var(--crm-surface-2-rgb)/0.92)] p-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Origem</label>
            <select
              value={newEdge.from}
              onChange={(e) => setNewEdge((p) => ({ ...p, from: e.target.value }))}
              className="rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
            >
              {diagram.nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Destino</label>
            <select
              value={newEdge.to}
              onChange={(e) => setNewEdge((p) => ({ ...p, to: e.target.value }))}
              className="rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
            >
              {diagram.nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Rótulo (opcional)</label>
            <input
              value={newEdge.label}
              onChange={(e) => setNewEdge((p) => ({ ...p, label: e.target.value }))}
              placeholder="Ex: Sim / Não"
              className="w-32 rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Rota</label>
            <select
              value={newEdge.route}
              onChange={(e) => setNewEdge((p) => ({ ...p, route: e.target.value as NonNullable<BpmnEdge['route']> }))}
              className="rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
            >
              <option value="auto">Automática</option>
              <option value="step-h-v">Horizontal → Vertical</option>
              <option value="step-v-h">Vertical → Horizontal</option>
              <option value="top-loop">Retorno por cima</option>
              <option value="bottom-loop">Desvio por baixo</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddEdge}
            className="rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1d4ed8]"
          >
            Adicionar seta
          </button>
        </div>
      )}

      {/* Folha BPMN no padrão exato do PDF anexo */}
      <div className="w-full min-w-0 max-w-full overflow-x-clip rounded-xl border border-slate-300 bg-white text-slate-900 shadow-lg">
        {/* Faixa institucional azul-marinho */}
        <div className="bg-[#0f2744] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {diagram.companyLogo && (
              <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-white p-1 shadow flex items-center justify-center">
                <img src={diagram.companyLogo} alt={diagram.companyName || 'Logo'} className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wider text-[#7db3db] uppercase truncate">
                {(diagram.companyName?.trim() || 'NEXOS CRM').toUpperCase()} / {diagram.subtitle || 'ARQUITETURA DE PROCESSOS'}
              </p>
              <h2 className="mt-0.5 text-xl font-black text-white truncate">
                {diagram.code} <span className="mx-1.5 text-[#7db3db] font-normal">|</span> {diagram.title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {diagram.responsibleName?.trim() && (
              <span className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                Responsável: <strong>{diagram.responsibleName}</strong>
              </span>
            )}
            <span className="rounded-md bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
              {diagram.pageLabel}
            </span>
          </div>
        </div>

        {/* Legenda BPMN + dica de edição */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-2.5 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[#1f7a4c] bg-white" />
              Início/fim
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-5 rounded-[3px] border-[1.5px] border-[#1d5d8c] bg-white" />
              Atividade
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center font-black text-[#b47610]">X</span>
              Decisão exclusiva
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center font-black text-[#1d5d8c]">+</span>
              Processo detalhado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              Fluxo de sequência
            </span>
          </div>
          <span className="text-[11px] font-medium text-[#1d5d8c]">
            Clique para selecionar • Duplo clique no card para editar texto • Arraste para mover
          </span>
        </div>

        {/* Barra Flutuante Sticky de Navegação Horizontal, Arrastar (Pan) e Zoom */}
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-900/95 backdrop-blur-md px-4 py-2 text-xs text-white shadow-md">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollHorizontal(-320)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-white transition-colors"
              title="Mover quadro para a esquerda"
            >
              <ChevronLeft className="h-4 w-4 text-cyan-400" /> Esquerda
            </button>
            <button
              type="button"
              onClick={() => setPanMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
                panMode
                  ? 'border-cyan-400 bg-cyan-600 text-white shadow-sm'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title="Ativar modo arrastar quadro com o mouse"
            >
              <Hand className="h-3.5 w-3.5" /> {panMode ? 'Arrastando Quadro (Ativo)' : 'Arrastar Quadro'}
            </button>
            <button
              type="button"
              onClick={() => scrollHorizontal(320)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-white transition-colors"
              title="Mover quadro para a direita"
            >
              Direita <ChevronRight className="h-4 w-4 text-cyan-400" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.1).toFixed(2))))}
              className="rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-200"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-mono font-bold text-cyan-300">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
              className="rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-200"
              title="Aumentar zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFitToWidth}
              className="rounded-md border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 px-2.5 py-1.5 text-xs font-bold text-cyan-300"
              title="Ajustar largura do BPMN na tela"
            >
              Ajustar na Tela
            </button>
          </div>
        </div>

        {/* Canvas SVG com scroll horizontal e drag-to-pan */}
        <div
          ref={scrollContainerRef}
          onMouseDown={(e) => {
            const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (panMode || targetTag === 'svg' || targetTag === 'rect' || e.target === scrollContainerRef.current) {
              if (!draggingNodeId && scrollContainerRef.current) {
                setPanning({ startX: e.clientX, scrollLeft: scrollContainerRef.current.scrollLeft });
              }
            }
          }}
          onMouseMove={(e) => {
            if (panning && scrollContainerRef.current) {
              scrollContainerRef.current.scrollLeft = panning.scrollLeft - (e.clientX - panning.startX);
            }
          }}
          onMouseUp={() => setPanning(null)}
          onMouseLeave={() => setPanning(null)}
          className={`w-full max-w-full overflow-x-auto overflow-y-hidden bg-white p-5 ${
            panning ? 'cursor-grabbing' : panMode ? 'cursor-grab' : ''
          }`}
          style={{ scrollbarWidth: 'auto', scrollbarGutter: 'stable' }}
        >
          <div className="relative" style={{ width: layout.width * zoom, height: layout.height * zoom, minWidth: layout.width * zoom }}>
            <svg
              ref={svgRef}
              width={layout.width * zoom}
              height={layout.height * zoom}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="select-none"
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={() => {
                if (draggingNodeId) {
                  setDraggingNodeId(null);
                  setDragPreview(null);
                }
              }}
            >
              <defs>
                <marker
                  id={`bpmn-arrow-${diagram.id}`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#52657a" />
                </marker>
                <marker
                  id={`bpmn-arrow-selected-${diagram.id}`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#2563eb" />
                </marker>
              </defs>

              {/* Raias (Swimlanes) */}
              {layout.lanes.map((lane, idx) => (
                <g key={lane.id}>
                  <rect
                    x={0}
                    y={lane.y}
                    width={layout.width}
                    height={lane.height}
                    fill={idx % 2 === 0 ? '#f4f7fa' : '#ffffff'}
                    stroke="#b8c7d9"
                    strokeWidth={1}
                  />
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInlineEditLaneId(lane.id);
                      setInlineEditLaneValue(lane.label || '');
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setInlineEditLaneId(lane.id);
                      setInlineEditLaneValue(lane.label || '');
                    }}
                  >
                    <title>Clique para editar o nome da Área Responsável</title>
                    <rect
                      x={0}
                      y={lane.y}
                      width={layout.laneHeaderWidth}
                      height={lane.height}
                      fill="#e2ebf3"
                      stroke="#b8c7d9"
                      strokeWidth={1}
                    />
                    {wrapText(lane.label, 18).map((line, lineIdx, arr) => (
                      <text
                        key={lineIdx}
                        x={layout.laneHeaderWidth / 2}
                        y={lane.y + lane.height / 2 + (lineIdx - (arr.length - 1) / 2) * 15}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#1e293b"
                        fontSize="12"
                        fontWeight="600"
                      >
                        {line}
                      </text>
                    ))}
                    <text
                      x={layout.laneHeaderWidth / 2}
                      y={lane.y + lane.height - 12}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      fontWeight="500"
                    >
                      Clique p/ editar
                    </text>
                  </g>
                </g>
              ))}

              {/* Conectores (Edges) clicáveis */}
              {diagram.edges.map((edge) => {
                const computed = computeEdgePoints(edge, layout.nodesById);
                if (!computed) return null;
                const isEdgeSelected = selectedEdgeId === edge.id;
                const d = computed.points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                  .join(' ');
                return (
                  <g
                    key={edge.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                    className="cursor-pointer"
                  >
                    <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
                    <path
                      d={d}
                      fill="none"
                      stroke={isEdgeSelected ? '#2563eb' : '#52657a'}
                      strokeWidth={isEdgeSelected ? 2.2 : 1.35}
                      strokeLinejoin="round"
                      markerEnd={`url(#${isEdgeSelected ? `bpmn-arrow-selected-${diagram.id}` : `bpmn-arrow-${diagram.id}`})`}
                    />
                    {edge.label && (
                      <g>
                        <rect
                          x={computed.labelPos.x - Math.max(18, edge.label.length * 3.6 + 6)}
                          y={computed.labelPos.y - 9}
                          width={Math.max(36, edge.label.length * 7.2 + 12)}
                          height={16}
                          rx={3}
                          fill="#ffffff"
                          fillOpacity={0.94}
                        />
                        <text
                          x={computed.labelPos.x}
                          y={computed.labelPos.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={isEdgeSelected ? '#2563eb' : '#475569'}
                          fontSize="10.5"
                          fontWeight={isEdgeSelected ? '700' : '500'}
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Indicador visual de destino ao arrastar */}
              {draggingNodeId && dragPreview && (() => {
                const targetLane = layout.lanes.find((l) => l.id === dragPreview.laneId);
                if (!targetLane) return null;
                const px = layout.laneHeaderWidth + 42 + dragPreview.col * 144 + 56 - 58;
                const py = targetLane.y + targetLane.height / 2 - 30;
                return (
                  <rect
                    x={px}
                    y={py}
                    width={116}
                    height={60}
                    rx={8}
                    fill="#2563eb"
                    fillOpacity={0.08}
                    stroke="#2563eb"
                    strokeWidth={1.8}
                    strokeDasharray="5 4"
                    pointerEvents="none"
                  />
                );
              })()}

              {/* Nós BPMN (clicáveis e arrastáveis) */}
              {layout.nodes.map((node) => {
                const cx = node.x + node.w / 2;
                const cy = node.y + node.h / 2;
                const isSelected = selectedNodeId === node.id;

                const onNodeMouseDown = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                  if (e.detail >= 2) {
                    startInlineEdit(node);
                    return;
                  }
                  setDraggingNodeId(node.id);
                };

                const onNodeDoubleClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  startInlineEdit(node);
                };

                if (node.type === 'start' || node.type === 'end') {
                  return (
                    <g key={node.id} onMouseDown={onNodeMouseDown} onDoubleClick={onNodeDoubleClick} className="cursor-grab active:cursor-grabbing">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={node.w / 2}
                        fill="#ffffff"
                        stroke={isSelected ? '#2563eb' : '#1f7a4c'}
                        strokeWidth={node.type === 'end' ? 3.5 : 2}
                      />
                      {wrapText(node.label, 18).map((line, i) => (
                        <text
                          key={i}
                          x={cx}
                          y={node.y + node.h + 14 + i * 12}
                          textAnchor="middle"
                          fill="#1e293b"
                          fontSize="10.5"
                          fontWeight="500"
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                }

                if (node.type === 'gateway') {
                  const pts = `${cx},${node.y} ${node.x + node.w},${cy} ${cx},${node.y + node.h} ${node.x},${cy}`;
                  return (
                    <g key={node.id} onMouseDown={onNodeMouseDown} onDoubleClick={onNodeDoubleClick} className="cursor-grab active:cursor-grabbing">
                      <polygon
                        points={pts}
                        fill="#fef3c7"
                        stroke={isSelected ? '#2563eb' : '#d99b26'}
                        strokeWidth={isSelected ? 2.4 : 1.8}
                      />
                      {wrapText(node.label, 16).map((line, i) => (
                        <text
                          key={i}
                          x={cx}
                          y={node.y + node.h + 14 + i * 12}
                          textAnchor="middle"
                          fill="#1e293b"
                          fontSize="10.5"
                          fontWeight="500"
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                }

                const lines = wrapText(node.label, 16);
                const textBaseOffset = node.type === 'subprocess' ? -5 : 0;
                return (
                  <g key={node.id} onMouseDown={onNodeMouseDown} onDoubleClick={onNodeDoubleClick} className="cursor-grab active:cursor-grabbing">
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.w}
                      height={node.h}
                      rx={7}
                      ry={7}
                      fill="#ffffff"
                      stroke={isSelected ? '#2563eb' : '#1d5d8c'}
                      strokeWidth={isSelected ? 2.4 : 1.7}
                    />
                    {lines.map((line, idx) => (
                      <text
                        key={idx}
                        x={cx}
                        y={cy + textBaseOffset + (idx - (lines.length - 1) / 2) * 13}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#0f172a"
                        fontSize="11"
                        fontWeight="500"
                      >
                        {line}
                      </text>
                    ))}
                    {node.type === 'subprocess' && (
                      <g>
                        <rect
                          x={cx - 7}
                          y={node.y + node.h - 15}
                          width={14}
                          height={12}
                          rx={2}
                          fill="#f0f7ff"
                          stroke="#1d5d8c"
                          strokeWidth={1}
                        />
                        <text
                          x={cx}
                          y={node.y + node.h - 8.5}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#1d5d8c"
                          fontSize="11"
                          fontWeight="800"
                        >
                          +
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            {inlineEditNodeId && layout.nodesById[inlineEditNodeId] && (() => {
              const target = layout.nodesById[inlineEditNodeId];
              const isExternalLabel = target.type === 'start' || target.type === 'end' || target.type === 'gateway';
              const boxW = Math.max(130, target.w * zoom + 20);
              const boxH = isExternalLabel ? 30 : Math.max(46, target.h * zoom);
              const left = (target.x + target.w / 2) * zoom - boxW / 2;
              const top = isExternalLabel
                ? (target.y + target.h + 4) * zoom
                : target.y * zoom + (target.h * zoom - boxH) / 2;
              return (
                <textarea
                  autoFocus
                  value={inlineEditValue}
                  onChange={(e) => setInlineEditValue(e.target.value)}
                  onBlur={commitInlineEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitInlineEdit();
                    }
                    if (e.key === 'Escape') {
                      setInlineEditNodeId(null);
                    }
                  }}
                  style={{
                    left: Math.max(4, left),
                    top: Math.max(4, top),
                    width: boxW,
                    height: boxH
                  }}
                  className="absolute z-20 resize-none rounded-md border-2 border-[#2563eb] bg-white px-2 py-1 text-center text-xs font-semibold text-slate-900 shadow-lg outline-none"
                />
              );
            })()}
            {inlineEditLaneId && (() => {
              const targetLane = layout.lanes.find((l) => l.id === inlineEditLaneId);
              if (!targetLane) return null;
              const boxW = Math.max(120, layout.laneHeaderWidth * zoom - 12);
              const boxH = Math.min(72, Math.max(44, targetLane.height * zoom - 16));
              const left = 6;
              const top = targetLane.y * zoom + (targetLane.height * zoom - boxH) / 2;
              const commitLaneEdit = () => {
                const next = inlineEditLaneValue.trim();
                if (next) {
                  updateLaneLabel(inlineEditLaneId, next);
                }
                setInlineEditLaneId(null);
              };
              return (
                <textarea
                  autoFocus
                  value={inlineEditLaneValue}
                  onChange={(e) => setInlineEditLaneValue(e.target.value)}
                  onBlur={commitLaneEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitLaneEdit();
                    }
                    if (e.key === 'Escape') {
                      setInlineEditLaneId(null);
                    }
                  }}
                  style={{
                    left,
                    top: Math.max(4, top),
                    width: boxW,
                    height: boxH
                  }}
                  className="absolute z-20 resize-none rounded-md border-2 border-[#2563eb] bg-white px-2 py-1 text-center text-xs font-semibold text-slate-900 shadow-lg outline-none"
                />
              );
            })()}
          </div>
        </div>

        {/* Bloco CONTROLES E REGRAS + Rodapé igual ao PDF */}
        <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black tracking-wide text-[#1d5d8c] uppercase">
              {diagram.controlsTitle || 'CONTROLES E REGRAS'}
            </h3>
          </div>
          <textarea
            value={diagram.controlsText}
            onChange={(e) => onChange({ ...diagram, controlsText: e.target.value })}
            rows={2}
            className="w-full resize-none rounded border border-transparent bg-transparent text-xs leading-relaxed text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:p-1.5"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-200/80">
            <span>{diagram.sourceBase || 'Base: Arquitetura de Processos CRM'}</span>
            <span>{diagram.footerText || 'Uso interno • Modelo padronizado BPMN'}</span>
          </div>
        </div>
      </div>

      {/* Painel Inspector do nó ou seta selecionada + edição de raias */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-[var(--crm-ink)] flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[#2563eb]" />
              {selectedNode
                ? `Editar elemento: ${selectedNode.label}`
                : selectedEdge
                  ? 'Editar seta / fluxo de sequência'
                  : 'Clique em um elemento ou seta no diagrama para editar'}
            </h3>
            {selectedNode && (
              <div className="flex items-center gap-1.5">
                {selectedNode.linkedCode && onSelectLinkedCode && (
                  <button
                    type="button"
                    onClick={() => onSelectLinkedCode(selectedNode.linkedCode!)}
                    className="flex items-center gap-1 rounded bg-[#2563eb]/15 px-2.5 py-1 text-xs font-bold text-[#38bdf8] hover:bg-[#2563eb]/25"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir {selectedNode.linkedCode}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updateNode(selectedNode.id, { col: Math.max(0, selectedNode.col - 1) })}
                  className="rounded border border-[var(--crm-border)] p-1.5 text-[var(--crm-ink)] hover:border-[#2563eb]"
                  title="Mover 1 coluna para esquerda"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateNode(selectedNode.id, { col: selectedNode.col + 1 })}
                  className="rounded border border-[var(--crm-border)] p-1.5 text-[var(--crm-ink)] hover:border-[#2563eb]"
                  title="Mover 1 coluna para direita"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateNode(selectedNode)}
                  className="rounded border border-[var(--crm-border)] p-1.5 text-[var(--crm-ink)] hover:border-[#2563eb]"
                  title="Duplicar elemento"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeNode(selectedNode.id)}
                  className="rounded p-1.5 text-red-400 hover:bg-red-500/15"
                  title="Remover elemento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            {selectedEdge && (
              <button
                type="button"
                onClick={() => removeEdge(selectedEdge.id)}
                className="rounded p-1.5 text-red-400 hover:bg-red-500/15"
                title="Remover seta"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {selectedNode ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Texto / Rótulo</label>
                <input
                  ref={nodeLabelInputRef}
                  value={selectedNode.label}
                  onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                  className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-semibold text-[var(--crm-ink)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Tipo BPMN</label>
                <select
                  value={selectedNode.type}
                  onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as BpmnNodeType })}
                  className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
                >
                  <option value="start">Início (círculo)</option>
                  <option value="task">Atividade (retângulo)</option>
                  <option value="subprocess">Processo detalhado (+)</option>
                  <option value="gateway">Decisão exclusiva (X)</option>
                  <option value="end">Fim (círculo duplo)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Raia (Área)</label>
                <select
                  value={selectedNode.laneId}
                  onChange={(e) => updateNode(selectedNode.id, { laneId: e.target.value })}
                  className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
                >
                  {diagram.lanes.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Coluna horizontal (0..25)</label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={selectedNode.col}
                  onChange={(e) => updateNode(selectedNode.id, { col: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Posição vertical na raia</label>
                <select
                  value={String(selectedNode.rowOffset || 0)}
                  onChange={(e) => updateNode(selectedNode.id, { rowOffset: Number(e.target.value) })}
                  className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
                >
                  <option value="-0.6">Topo da raia</option>
                  <option value="0">Centro da raia</option>
                  <option value="0.6">Base da raia</option>
                </select>
              </div>
            </div>
          ) : selectedEdge ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Rótulo da seta</label>
                <input
                  value={selectedEdge.label || ''}
                  onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value || undefined })}
                  placeholder="Ex: Sim / Não / Revisão"
                  className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-semibold text-[var(--crm-ink)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Estilo da rota</label>
                <select
                  value={selectedEdge.route || 'auto'}
                  onChange={(e) => updateEdge(selectedEdge.id, { route: e.target.value as BpmnEdge['route'] })}
                  className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
                >
                  <option value="auto">Automática</option>
                  <option value="step-h-v">Horizontal → Vertical</option>
                  <option value="step-v-h">Vertical → Horizontal</option>
                  <option value="top-loop">Retorno por cima</option>
                  <option value="bottom-loop">Desvio por baixo</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Saída (Origem)</label>
                <select
                  value={selectedEdge.fromSide || 'right'}
                  onChange={(e) => updateEdge(selectedEdge.id, { fromSide: e.target.value as BpmnAnchorSide })}
                  className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
                >
                  <option value="right">Direita</option>
                  <option value="bottom">Base</option>
                  <option value="top">Topo</option>
                  <option value="left">Esquerda</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--crm-muted)] mb-1">Entrada (Destino)</label>
                <select
                  value={selectedEdge.toSide || 'left'}
                  onChange={(e) => updateEdge(selectedEdge.id, { toSide: e.target.value as BpmnAnchorSide })}
                  className="w-full rounded border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 py-1.5 text-xs text-[var(--crm-ink)]"
                >
                  <option value="left">Esquerda</option>
                  <option value="top">Topo</option>
                  <option value="bottom">Base</option>
                  <option value="right">Direita</option>
                </select>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--crm-muted)]">
              Selecione qualquer atividade, decisão, evento ou seta no diagrama acima para editar texto, raia, posição, rota ou abrir o subprocesso vinculado. Você também pode arrastar elementos no canvas.
            </p>
          )}
        </div>

        {/* Gerenciamento rápido de Raias e Fluxos */}
        <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-4 space-y-3">
          <h3 className="text-sm font-black text-[var(--crm-ink)]">Raias e Fluxos de Sequência</h3>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {diagram.lanes.map((lane) => (
              <div key={lane.id} className="flex items-center gap-2">
                <input
                  value={lane.label}
                  onChange={(e) => updateLaneLabel(lane.id, e.target.value)}
                  className="flex-1 rounded border border-[var(--crm-border)] bg-transparent px-2 py-1 text-xs font-semibold text-[var(--crm-ink)]"
                />
                {diagram.lanes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLane(lane.id)}
                    className="p-1 text-[var(--crm-muted)] hover:text-red-400"
                    title="Remover raia"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {diagram.edges.length > 0 && (
            <div className="pt-2 border-t border-[var(--crm-border)]">
              <p className="text-[11px] font-bold text-[var(--crm-muted)] mb-1.5">
                Conexões ativas ({diagram.edges.length}) — clique para editar
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {diagram.edges.map((edge) => {
                  const fromLbl = diagram.nodes.find((n) => n.id === edge.from)?.label || edge.from;
                  const toLbl = diagram.nodes.find((n) => n.id === edge.to)?.label || edge.to;
                  const active = selectedEdgeId === edge.id;
                  return (
                    <span
                      key={edge.id}
                      onClick={() => {
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[10px] ${
                        active
                          ? 'border-[#2563eb] bg-[#2563eb]/15 text-[#38bdf8]'
                          : 'border-[var(--crm-border)] text-[var(--crm-ink)] hover:border-[#2563eb]/60'
                      }`}
                    >
                      <span className="truncate max-w-[90px]">{fromLbl}</span>
                      <span>→</span>
                      <span className="truncate max-w-[90px]">{toLbl}</span>
                      {edge.label && <strong className="text-amber-400">({edge.label})</strong>}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEdge(edge.id);
                        }}
                        className="ml-0.5 text-[var(--crm-muted)] hover:text-red-400"
                        title="Remover seta"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seção Governança, automações e validação (Página 9 do PDF) */}
      {showGovernance && (
        <div className="rounded-xl border border-slate-300 bg-white text-slate-900 overflow-hidden shadow">
          <div className="bg-[#0f2744] px-6 py-4">
            <p className="text-[11px] font-bold tracking-wider text-[#7db3db] uppercase">
              {(diagram.companyName?.trim() || 'NEXOS CRM').toUpperCase()} / ARQUITETURA DE PROCESSOS
            </p>
            <h3 className="text-lg font-black text-white">{BPMN_GOVERNANCE.title}</h3>
          </div>
          <div className="p-6 grid gap-5 md:grid-cols-2">
            {BPMN_GOVERNANCE.sections.map((sec) => (
              <div key={sec.title} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <h4 className="text-xs font-black uppercase tracking-wide text-[#1d5d8c] mb-2">{sec.title}</h4>
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                  {sec.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 px-6 py-3 text-[11px] text-slate-500">
            <strong>Fontes:</strong> {BPMN_GOVERNANCE.sources}
          </div>
        </div>
      )}
    </div>
  );
}
