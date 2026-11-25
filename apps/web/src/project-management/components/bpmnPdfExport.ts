import { jsPDF } from 'jspdf';
import { BPMN_GOVERNANCE, type BpmnDiagram, type BpmnEdge, type BpmnNode } from '../data/bpmnTemplates';

export interface ComputedLane {
  id: string;
  label: string;
  y: number;
  height: number;
}

export interface ComputedNode extends BpmnNode {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BpmnLayout {
  width: number;
  height: number;
  laneHeaderWidth: number;
  lanes: ComputedLane[];
  nodesById: Record<string, ComputedNode>;
  nodes: ComputedNode[];
}

export function computeBpmnLayout(diagram: BpmnDiagram): BpmnLayout {
  const laneHeaderWidth = 164;
  const paddingLeft = 42;
  const paddingRight = 56;
  const colStep = 144;

  const maxCol = diagram.nodes.reduce((acc, n) => Math.max(acc, n.col), 4);
  const contentWidth = paddingLeft + (maxCol + 1) * colStep + paddingRight;
  const width = Math.max(980, laneHeaderWidth + contentWidth);

  let currentY = 0;
  const lanes: ComputedLane[] = diagram.lanes.map((lane) => {
    const height = lane.height || 130;
    const item = { id: lane.id, label: lane.label, y: currentY, height };
    currentY += height;
    return item;
  });

  const laneMap = new Map(lanes.map((l) => [l.id, l]));
  const nodesById: Record<string, ComputedNode> = {};
  const nodes: ComputedNode[] = diagram.nodes.map((node) => {
    const lane = laneMap.get(node.laneId) || lanes[0];
    const cx = laneHeaderWidth + paddingLeft + node.col * colStep + 56;
    const offset = (node.rowOffset || 0) * ((lane?.height || 130) * 0.34);
    const cy = (lane ? lane.y + lane.height / 2 : 65) + offset;

    let w = 114;
    let h = 58;
    if (node.type === 'start' || node.type === 'end') {
      w = 32;
      h = 32;
    } else if (node.type === 'gateway') {
      w = 42;
      h = 42;
    }

    const computed: ComputedNode = {
      ...node,
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h
    };
    nodesById[node.id] = computed;
    return computed;
  });

  return {
    width,
    height: Math.max(240, currentY),
    laneHeaderWidth,
    lanes,
    nodesById,
    nodes
  };
}

function getAnchor(node: ComputedNode, side: 'top' | 'right' | 'bottom' | 'left'): { x: number; y: number } {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  switch (side) {
    case 'top':
      return { x: cx, y: node.y };
    case 'bottom':
      return { x: cx, y: node.y + node.h };
    case 'left':
      return { x: node.x, y: cy };
    case 'right':
    default:
      return { x: node.x + node.w, y: cy };
  }
}

export interface ComputedEdgePath {
  edge: BpmnEdge;
  points: Array<{ x: number; y: number }>;
  labelPos: { x: number; y: number };
}

export function computeEdgePoints(edge: BpmnEdge, nodesById: Record<string, ComputedNode>): ComputedEdgePath | null {
  const fromNode = nodesById[edge.from];
  const toNode = nodesById[edge.to];
  if (!fromNode || !toNode) return null;

  const fromSide = edge.fromSide || 'right';
  const toSide = edge.toSide || 'left';
  const start = getAnchor(fromNode, fromSide);
  const end = getAnchor(toNode, toSide);
  const route = edge.route || 'auto';

  const pts: Array<{ x: number; y: number }> = [start];

  if (route === 'top-loop') {
    const offset = edge.loopOffset || 28;
    const topY = Math.max(10, Math.min(fromNode.y, toNode.y) - offset);
    pts.push({ x: start.x, y: topY });
    pts.push({ x: end.x, y: topY });
    pts.push(end);
  } else if (route === 'bottom-loop') {
    const offset = edge.loopOffset || 28;
    const bottomY = Math.max(fromNode.y + fromNode.h, toNode.y + toNode.h) + offset;
    pts.push({ x: start.x, y: bottomY });
    pts.push({ x: end.x, y: bottomY });
    pts.push(end);
  } else if (route === 'step-v-h') {
    if (fromSide === 'bottom' || fromSide === 'top') {
      pts.push({ x: start.x, y: end.y });
      pts.push(end);
    } else {
      const midX = start.x + (end.x - start.x) * 0.45;
      pts.push({ x: midX, y: start.y });
      pts.push({ x: midX, y: end.y });
      pts.push(end);
    }
  } else if (route === 'step-h-v') {
    const midX = start.x + (end.x - start.x) * 0.5;
    if (Math.abs(start.y - end.y) > 2) {
      pts.push({ x: midX, y: start.y });
      pts.push({ x: midX, y: end.y });
    }
    pts.push(end);
  } else {
    if (Math.abs(start.y - end.y) <= 3 && start.x <= end.x) {
      pts.push(end);
    } else {
      const midX = start.x + (end.x - start.x) * 0.5;
      pts.push({ x: midX, y: start.y });
      pts.push({ x: midX, y: end.y });
      pts.push(end);
    }
  }

  let labelPos = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
  if (pts.length >= 4 && (route === 'top-loop' || route === 'bottom-loop')) {
    labelPos = { x: (pts[1].x + pts[2].x) / 2, y: pts[1].y };
  } else if (pts.length === 3 && (fromSide === 'bottom' || fromSide === 'top')) {
    labelPos = { x: pts[0].x, y: (pts[0].y + pts[1].y) / 2 };
  } else if (pts.length >= 2) {
    labelPos = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  }

  return { edge, points: pts, labelPos };
}

function renderBpmnPage(pdf: jsPDF, diagram: BpmnDiagram, pageLabelOverride?: string) {
  const pageW = 297;
  const pageH = 210;
  const margin = 10;

  // Fundo branco
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageW, pageH, 'F');

  // Faixa superior azul-marinho (idêntica ao PDF anexo)
  pdf.setFillColor(15, 39, 68);
  pdf.rect(0, 0, pageW, 24, 'F');

  let titleStartX = margin;
  if (diagram.companyLogo && diagram.companyLogo.startsWith('data:image/')) {
    try {
      const fmt = diagram.companyLogo.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(margin, 3.5, 17, 17, 1.5, 1.5, 'F');
      pdf.addImage(diagram.companyLogo, fmt, margin + 1, 4.5, 15, 15, undefined, 'FAST');
      titleStartX = margin + 21;
    } catch {
      // ignora logo inválido no PDF
    }
  }

  const companyLabel = diagram.companyName?.trim() ? diagram.companyName.trim().toUpperCase() : 'NEXOS CRM';
  pdf.setTextColor(125, 179, 219);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.text(`${companyLabel} / ${diagram.subtitle || 'ARQUITETURA DE PROCESSOS'}`, titleStartX, 8);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(`${diagram.code}  |  ${diagram.title}`, titleStartX, 17.5);

  if (diagram.responsibleName?.trim()) {
    pdf.setTextColor(203, 213, 225);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Responsável: ${diagram.responsibleName.trim()}`, pageW - margin, 17.5, { align: 'right' });
  }

  // Legenda BPMN
  const legendY = 30.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(90, 107, 124);

  pdf.setDrawColor(31, 122, 76);
  pdf.setLineWidth(0.45);
  pdf.circle(margin + 2, legendY - 1, 1.8, 'S');
  pdf.text('Início/fim', margin + 5.5, legendY);

  pdf.setDrawColor(29, 93, 140);
  pdf.roundedRect(margin + 24, legendY - 2.8, 4.5, 3.2, 0.6, 0.6, 'S');
  pdf.text('Atividade', margin + 30, legendY);

  pdf.setTextColor(180, 118, 16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('X', margin + 48, legendY);
  pdf.setTextColor(90, 107, 124);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Decisão exclusiva', margin + 52, legendY);

  pdf.setTextColor(29, 93, 140);
  pdf.setFont('helvetica', 'bold');
  pdf.text('+', margin + 81, legendY);
  pdf.setTextColor(90, 107, 124);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Processo detalhado', margin + 85, legendY);

  pdf.text('-> Fluxo de sequência', margin + 116, legendY);

  // Área do diagrama escalada para caber perfeitamente em A4 paisagem
  const layout = computeBpmnLayout(diagram);
  const availW = pageW - margin * 2;
  const availH = 128;
  const scale = Math.min(availW / layout.width, availH / layout.height);
  const offsetX = margin + (availW - layout.width * scale) / 2;
  const offsetY = 35;

  const tx = (px: number) => offsetX + px * scale;
  const ty = (py: number) => offsetY + py * scale;
  const ts = (len: number) => len * scale;

  // Raias
  layout.lanes.forEach((lane, idx) => {
    const ly = ty(lane.y);
    const lh = ts(lane.height);
    const lw = ts(layout.width);
    const hdrW = ts(layout.laneHeaderWidth);

    if (idx % 2 === 0) {
      pdf.setFillColor(244, 247, 250);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(tx(0), ly, lw, lh, 'F');

    pdf.setFillColor(226, 235, 243);
    pdf.rect(tx(0), ly, hdrW, lh, 'F');

    pdf.setDrawColor(184, 199, 217);
    pdf.setLineWidth(0.25);
    pdf.rect(tx(0), ly, lw, lh, 'S');
    pdf.line(tx(layout.laneHeaderWidth), ly, tx(layout.laneHeaderWidth), ly + lh);

    pdf.setTextColor(30, 41, 59);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.max(6.5, 8.2 * Math.min(1, scale * 3.5)));
    const lines = pdf.splitTextToSize(lane.label, hdrW - 4);
    pdf.text(lines, tx(0) + hdrW / 2, ly + lh / 2 - (lines.length - 1) * 1.6, { align: 'center', baseline: 'middle' });
  });

  // Conectores (edges)
  diagram.edges.forEach((edge) => {
    const computed = computeEdgePoints(edge, layout.nodesById);
    if (!computed) return;
    const { points, labelPos } = computed;

    pdf.setDrawColor(90, 107, 124);
    pdf.setLineWidth(0.32);
    for (let i = 0; i < points.length - 1; i++) {
      pdf.line(tx(points[i].x), ty(points[i].y), tx(points[i + 1].x), ty(points[i + 1].y));
    }

    const prev = points[points.length - 2];
    const last = points[points.length - 1];
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
    const headLen = 1.8;
    const ex = tx(last.x);
    const ey = ty(last.y);
    const p1x = ex - headLen * Math.cos(angle - Math.PI / 6);
    const p1y = ey - headLen * Math.sin(angle - Math.PI / 6);
    const p2x = ex - headLen * Math.cos(angle + Math.PI / 6);
    const p2y = ey - headLen * Math.sin(angle + Math.PI / 6);
    pdf.setFillColor(90, 107, 124);
    pdf.triangle(ex, ey, p1x, p1y, p2x, p2y, 'F');

    if (edge.label) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(5.5);
      const tw = pdf.getTextWidth(edge.label) + 2;
      const lx = tx(labelPos.x);
      const ly = ty(labelPos.y);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(lx - tw / 2, ly - 1.8, tw, 3.2, 'F');
      pdf.setTextColor(71, 85, 105);
      pdf.text(edge.label, lx, ly + 0.4, { align: 'center', baseline: 'middle' });
    }
  });

  // Nós
  layout.nodes.forEach((node) => {
    const nx = tx(node.x);
    const ny = ty(node.y);
    const nw = ts(node.w);
    const nh = ts(node.h);
    const cx = nx + nw / 2;
    const cy = ny + nh / 2;

    if (node.type === 'start' || node.type === 'end') {
      const r = nw / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(31, 122, 76);
      pdf.setLineWidth(node.type === 'end' ? 0.85 : 0.45);
      pdf.circle(cx, cy, r, 'FD');

      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(5.8);
      const lblLines = pdf.splitTextToSize(node.label, Math.max(18, nw * 2.2));
      pdf.text(lblLines, cx, ny + nh + 2.8, { align: 'center' });
    } else if (node.type === 'gateway') {
      const halfW = nw / 2;
      const halfH = nh / 2;
      pdf.setFillColor(254, 243, 199);
      pdf.setDrawColor(217, 155, 38);
      pdf.setLineWidth(0.45);
      pdf.lines(
        [
          [halfW, halfH],
          [-halfW, halfH],
          [-halfW, -halfH],
          [halfW, -halfH]
        ],
        cx,
        ny,
        [1, 1],
        'FD',
        true
      );

      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(5.8);
      const lblLines = pdf.splitTextToSize(node.label, Math.max(20, nw * 1.8));
      pdf.text(lblLines, cx, ny + nh + 2.8, { align: 'center' });
    } else {
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(29, 93, 140);
      pdf.setLineWidth(0.45);
      pdf.roundedRect(nx, ny, nw, nh, 1.6, 1.6, 'FD');

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(Math.max(5.5, Math.min(7.2, nw * 0.25)));
      const lblLines = pdf.splitTextToSize(node.label, nw - 3);
      const textOffset = node.type === 'subprocess' ? -1.1 : 0;
      pdf.text(lblLines, cx, cy + textOffset - (lblLines.length - 1) * 1.1, { align: 'center', baseline: 'middle' });

      if (node.type === 'subprocess') {
        pdf.setTextColor(29, 93, 140);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text('+', cx, ny + nh - 1.5, { align: 'center' });
      }
    }
  });

  // Seção CONTROLES E REGRAS
  const ctrlY = Math.max(170, offsetY + ts(layout.height) + 8);
  pdf.setTextColor(29, 93, 140);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(diagram.controlsTitle || 'CONTROLES E REGRAS', margin, ctrlY);

  pdf.setTextColor(30, 41, 59);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const ctrlLines = pdf.splitTextToSize(diagram.controlsText || '', pageW - margin * 2);
  pdf.text(ctrlLines, margin, ctrlY + 5);

  // Rodapé
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(7);
  if (diagram.sourceBase) {
    pdf.text(diagram.sourceBase, margin, pageH - 12);
  }
  pdf.text(diagram.footerText || 'Uso interno • Modelo padronizado BPMN', margin, pageH - 7);
  pdf.text(pageLabelOverride || diagram.pageLabel || '01 / 01', pageW - margin, pageH - 7, { align: 'right' });
}

function appendGovernancePage(pdf: jsPDF, companyName?: string) {
  const pageW = 297;
  const pageH = 210;
  const margin = 10;
  const companyLabel = companyName?.trim() ? companyName.trim().toUpperCase() : 'NEXOS CRM';

  pdf.addPage('a4', 'l');
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageW, pageH, 'F');
  pdf.setFillColor(15, 39, 68);
  pdf.rect(0, 0, pageW, 24, 'F');

  pdf.setTextColor(125, 179, 219);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.text(`${companyLabel} / ARQUITETURA DE PROCESSOS`, margin, 8);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(BPMN_GOVERNANCE.title, margin, 17.5);

  let gy = 36;
  BPMN_GOVERNANCE.sections.forEach((sec) => {
    pdf.setTextColor(29, 93, 140);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.text(sec.title, margin, gy);
    gy += 5;

    pdf.setTextColor(30, 41, 59);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.2);
    const joined = sec.items.join('; ') + '.';
    const lines = pdf.splitTextToSize(joined, pageW - margin * 2);
    pdf.text(lines, margin, gy);
    gy += lines.length * 4.5 + 6;
  });

  pdf.setTextColor(29, 93, 140);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('Fontes', margin, gy);
  pdf.setTextColor(30, 41, 59);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.2);
  pdf.text(BPMN_GOVERNANCE.sources, margin, gy + 5);
}

export function exportBpmnDiagramToPdf(diagram: BpmnDiagram, includeGovernance = true) {
  const pdf = new jsPDF('l', 'mm', 'a4');
  renderBpmnPage(pdf, diagram);
  if (includeGovernance) {
    appendGovernancePage(pdf, diagram.companyName);
  }
  pdf.save(`${diagram.code}_${diagram.title.replace(/\s+/g, '_')}.pdf`);
}

export function exportAllBpmnDiagramsToPdf(
  processName: string,
  diagrams: BpmnDiagram[],
  meta?: { companyName?: string; responsibleName?: string; companyLogo?: string }
) {
  if (!diagrams || diagrams.length === 0) return;
  const pdf = new jsPDF('l', 'mm', 'a4');
  const total = diagrams.length;
  diagrams.forEach((d, index) => {
    if (index > 0) pdf.addPage('a4', 'l');
    const enriched: BpmnDiagram = {
      ...d,
      companyName: d.companyName || meta?.companyName,
      responsibleName: d.responsibleName || meta?.responsibleName,
      companyLogo: d.companyLogo || meta?.companyLogo
    };
    const pageLabel = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    renderBpmnPage(pdf, enriched, pageLabel);
  });
  appendGovernancePage(pdf, meta?.companyName || diagrams[0]?.companyName);
  pdf.save(`${processName.replace(/\s+/g, '_')}_BPMN_Completo.pdf`);
}
