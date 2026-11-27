import { jsPDF } from 'jspdf';
import type { SavedAnaliseTRItem } from '../TRsAnalisadosPage';

const STATUS_LABEL: Record<string, string> = {
  ATENDE_100: 'Atende 100%',
  ATENDE_RESSALVA: 'Atende c/ Ressalva',
  NAO_ATENDE: 'Não Atende',
  NAO_INFORMADO: 'Não Consta',
};

const safeText = (v: unknown, fallback = '—'): string => {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s || fallback;
};

const escHtml = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildAnaliseTrHtmlDocument = (item: SavedAnaliseTRItem): string => {
  const a = item.analise_json || {};
  const modelos = a.modelos_recomendados || [];
  const matriz = a.matriz_comparativa || [];
  const alertas = a.alertas_desclassificacao || [];
  const fontes = a.fontes_consultadas || [];
  const dataFormatada = item.updated_at || item.created_at
    ? new Date(item.updated_at || item.created_at || '').toLocaleString('pt-BR')
    : new Date().toLocaleString('pt-BR');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Parecer Técnico de TR - ${escHtml(item.titulo_objeto)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 11px;
      line-height: 1.45;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #0e7490 100%);
      color: #ffffff;
      padding: 18px 20px;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }
    .header h1 { margin: 0 0 4px 0; font-size: 17px; letter-spacing: 0.3px; }
    .header .sub { font-size: 10px; color: #bae6fd; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .badge-score {
      background: ${item.percentual_atendimento >= 95 ? '#10b981' : '#f59e0b'};
      color: #0f172a;
      font-weight: 900;
      padding: 8px 14px;
      border-radius: 8px;
      text-align: center;
      white-space: nowrap;
      font-size: 14px;
    }
    .section {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0369a1;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin: 0 0 10px 0;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 14px;
      margin-bottom: 10px;
    }
    .meta-item strong { color: #334155; display: block; font-size: 9.5px; text-transform: uppercase; }
    .model-card {
      border: 1px solid #a7f3d0;
      background: #f0fdf4;
      border-radius: 7px;
      padding: 10px 12px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .model-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .model-title { font-size: 12px; font-weight: 800; color: #065f46; }
    .model-pct { background: #10b981; color: #fff; font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 99px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; color: #0f172a; font-weight: 800; text-transform: uppercase; font-size: 9px; }
    .st-ok { color: #047857; font-weight: 800; }
    .st-warn { color: #b45309; font-weight: 800; }
    .st-bad { color: #be123c; font-weight: 800; }
    .alert-box { border: 1px solid #fecdd3; background: #fff1f2; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; }
    .alert-box h3 { margin: 0 0 6px 0; font-size: 11px; color: #be123c; text-transform: uppercase; }
    ul { margin: 4px 0 0 18px; padding: 0; }
    li { margin-bottom: 3px; }
    .footer { text-align: center; font-size: 9px; color: #64748b; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="sub">GOVFLOW B2G • Parecer Técnico de Engenharia &amp; Pré-Vendas</div>
      <h1>${escHtml(item.titulo_objeto)}</h1>
      <div style="font-size:10px; color:#e2e8f0;">Gerado em ${escHtml(dataFormatada)}</div>
    </div>
    <div class="badge-score">${item.percentual_atendimento}% Aderência</div>
  </div>

  <div class="section">
    <div class="section-title">1. Identificação e Resumo Executivo do TR</div>
    <div class="meta-grid">
      <div class="meta-item"><strong>Órgão / Entidade</strong>${escHtml(safeText(item.orgao, 'Não informado'))}</div>
      <div class="meta-item"><strong>Categoria Tecnológica</strong>${escHtml(safeText(item.categoria_tecnologica, 'TI / Infraestrutura'))}</div>
      <div class="meta-item"><strong>Veredicto Técnico</strong>${escHtml(safeText(item.veredicto || a.aderencia_geral?.veredicto))}</div>
      <div class="meta-item"><strong>Arquivos Analisados</strong>TR: ${escHtml((item.arquivos_tr || []).join(', ') || '—')} ${item.arquivos_datasheet?.length ? `| Datasheet: ${escHtml(item.arquivos_datasheet.join(', '))}` : ''}</div>
    </div>
    <p style="margin: 6px 0;"><strong>Resumo Executivo:</strong> ${escHtml(safeText(a.resumo_tr?.resumo_executivo))}</p>
    ${a.aderencia_geral?.justificativa_veredicto ? `<p style="margin: 6px 0 0 0; color:#065f46;"><strong>Justificativa do Veredicto:</strong> ${escHtml(a.aderencia_geral.justificativa_veredicto)}</p>` : ''}
  </div>

  <div class="section">
    <div class="section-title">2. Modelos de Equipamentos Recomendados (${modelos.length})</div>
    ${modelos.length === 0 ? '<p>Nenhum modelo recomendado registrado.</p>' : modelos.map((m) => `
      <div class="model-card">
        <div class="model-head">
          <div class="model-title">${escHtml(m.fabricante)} — ${escHtml(m.modelo)} ${m.part_number ? `<span style="font-weight:400; font-size:10px; color:#334155;">(PN: ${escHtml(m.part_number)})</span>` : ''}</div>
          <span class="model-pct">${m.aderencia_percentual}%</span>
        </div>
        <div style="font-size:10.5px; color:#1e293b;">${escHtml(m.justificativa_tecnica)}</div>
        ${(m.acessorios_licencas_necessarios || []).length > 0 ? `<div style="font-size:10px; margin-top:4px;"><strong>Acessórios / Licenças:</strong> ${escHtml(m.acessorios_licencas_necessarios?.join(', '))}</div>` : ''}
      </div>
    `).join('')}
  </div>

  <div class="section" style="page-break-inside: auto;">
    <div class="section-title">3. Matriz Técnica Comparativa (${matriz.length} requisitos)</div>
    <table>
      <thead>
        <tr>
          <th style="width:14%;">Item / Cat.</th>
          <th style="width:30%;">Requisito do TR</th>
          <th style="width:30%;">Especificação Encontrada</th>
          <th style="width:12%;">Status</th>
          <th style="width:14%;">Evidência / Obs.</th>
        </tr>
      </thead>
      <tbody>
        ${matriz.map((r) => {
          const cls = r.status === 'ATENDE_100' ? 'st-ok' : r.status === 'NAO_ATENDE' ? 'st-bad' : 'st-warn';
          return `
            <tr>
              <td><strong>${escHtml(r.item_tr)}</strong><br/><span style="color:#64748b; font-size:9px;">${escHtml(r.categoria)}</span></td>
              <td>${escHtml(r.requisito_tr)}</td>
              <td>${escHtml(r.especificacao_encontrada)}</td>
              <td class="${cls}">${escHtml(STATUS_LABEL[r.status] || r.status)}</td>
              <td>${escHtml([r.evidencia_pagina_ou_fonte, r.observacao].filter(Boolean).join(' • ') || '—')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  ${alertas.length > 0 ? `
    <div class="alert-box">
      <h3>4. Alertas Críticos de Desclassificação</h3>
      <ul>${alertas.map((al) => `<li>${escHtml(al)}</li>`).join('')}</ul>
    </div>
  ` : ''}

  ${fontes.length > 0 ? `
    <div class="section">
      <div class="section-title">5. Fontes Consultadas</div>
      <ul>${fontes.slice(0, 10).map((f) => `<li>${escHtml(f.title)} — ${escHtml(f.url)}</li>`).join('')}</ul>
    </div>
  ` : ''}

  <div class="footer">NEXOS CRM • Módulo GOVFLOW B2G — Documento Técnico Estruturado A4</div>
</body>
</html>`;
};

export const gerarPdfAnaliseTR = (
  item: SavedAnaliseTRItem,
  mode: 'download' | 'bloburl' = 'download'
): string | void => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const a = item.analise_json || {};
  const modelos = a.modelos_recomendados || [];
  const matriz = a.matriz_comparativa || [];
  const alertas = a.alertas_desclassificacao || [];

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(12);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setDrawColor(6, 182, 212);
    doc.setLineWidth(0.7);
    doc.line(margin, y, margin, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(3, 105, 161);
    doc.text(title.toUpperCase(), margin + 3, y + 4.8);
    y += 10;
  };

  const drawWrappedText = (text: string, fontSize = 9, color: [number, number, number] = [30, 41, 59], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.43;
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 1.5;
  };

  // Cabeçalho Executivo
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentWidth, 26, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(34, 211, 238);
  doc.text('GOVFLOW B2G • PARECER TÉCNICO DE ANÁLISE DE TR', margin + 4, y + 6);

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(safeText(item.titulo_objeto), contentWidth - 40);
  doc.text(titleLines.slice(0, 2), margin + 4, y + 12.5);

  // Badge de aderência
  const pct = Number(item.percentual_atendimento ?? 0);
  doc.setFillColor(pct >= 95 ? 16 : 245, pct >= 95 ? 185 : 158, pct >= 95 ? 129 : 11);
  doc.roundedRect(pageWidth - margin - 34, y + 5, 30, 14, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pct}%`, pageWidth - margin - 19, y + 11.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('ADERÊNCIA', pageWidth - margin - 19, y + 16, { align: 'center' });

  y += 31;

  // 1. Identificação e Resumo
  drawSectionTitle('1. Identificação e Resumo Executivo do TR');
  drawWrappedText(`Órgão: ${safeText(item.orgao, 'Não informado')}   |   Categoria: ${safeText(item.categoria_tecnologica, 'TI / Infraestrutura')}`, 9, [15, 23, 42], true);
  drawWrappedText(`Veredicto: ${safeText(item.veredicto || a.aderencia_geral?.veredicto)}`, 9, [4, 120, 87], true);
  if ((item.arquivos_tr || []).length > 0) {
    drawWrappedText(`Arquivos TR: ${(item.arquivos_tr || []).join(', ')}`, 8.5, [71, 85, 105]);
  }
  if (a.resumo_tr?.resumo_executivo) {
    drawWrappedText(`Resumo Executivo: ${a.resumo_tr.resumo_executivo}`, 9, [30, 41, 59]);
  }
  if (a.aderencia_geral?.justificativa_veredicto) {
    drawWrappedText(`Justificativa: ${a.aderencia_geral.justificativa_veredicto}`, 9, [51, 65, 85]);
  }
  y += 2;

  // 2. Modelos Recomendados
  drawSectionTitle(`2. Modelos de Equipamentos Recomendados (${modelos.length})`);
  if (modelos.length === 0) {
    drawWrappedText('Nenhum modelo recomendado registrado nesta análise.', 9, [100, 116, 139]);
  } else {
    modelos.forEach((m, idx) => {
      const headerTxt = `${idx + 1}. ${m.fabricante} — ${m.modelo}${m.part_number ? ` (PN: ${m.part_number})` : ''} — ${m.aderencia_percentual}%`;
      drawWrappedText(headerTxt, 9.5, [6, 95, 70], true);
      drawWrappedText(safeText(m.justificativa_tecnica), 8.5, [30, 41, 59]);
      if ((m.acessorios_licencas_necessarios || []).length > 0) {
        drawWrappedText(`Acessórios/Licenças: ${m.acessorios_licencas_necessarios?.join(', ')}`, 8.2, [3, 105, 161]);
      }
      y += 1.5;
    });
  }

  // 3. Matriz Comparativa
  drawSectionTitle(`3. Matriz Técnica Comparativa (${matriz.length} requisitos)`);
  const colWidths = [24, 58, 58, 22, 20]; // soma = 182mm = contentWidth
  const drawTableHeader = () => {
    ensureSpace(9);
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const headers = ['Item', 'Requisito do TR', 'Especificação Encontrada', 'Status', 'Evidência'];
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x + 1.5, y + 4.4);
      x += colWidths[i];
    });
    y += 6.5;
  };

  if (matriz.length > 0) {
    drawTableHeader();
    matriz.forEach((r) => {
      const c1 = doc.splitTextToSize(`${safeText(r.item_tr)}\n${safeText(r.categoria, '')}`.trim(), colWidths[0] - 2.5);
      const c2 = doc.splitTextToSize(safeText(r.requisito_tr), colWidths[1] - 2.5);
      const c3 = doc.splitTextToSize(safeText(r.especificacao_encontrada), colWidths[2] - 2.5);
      const c4 = doc.splitTextToSize(STATUS_LABEL[r.status] || r.status, colWidths[3] - 2.5);
      const c5 = doc.splitTextToSize(safeText(r.evidencia_pagina_ou_fonte || r.observacao, '—'), colWidths[4] - 2.5);

      const maxLines = Math.max(c1.length, c2.length, c3.length, c4.length, c5.length);
      const rowHeight = Math.max(6, maxLines * 3.5 + 2.5);

      if (y + rowHeight > pageHeight - 16) {
        doc.addPage();
        y = 16;
        drawTableHeader();
      }

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentWidth, rowHeight);

      const cells = [c1, c2, c3, c4, c5];
      let x = margin;
      cells.forEach((lines, idx) => {
        if (idx > 0) doc.line(x, y, x, y + rowHeight);
        doc.setFont('helvetica', idx === 0 || idx === 3 ? 'bold' : 'normal');
        doc.setFontSize(7.2);
        if (idx === 3) {
          if (r.status === 'ATENDE_100') doc.setTextColor(4, 120, 87);
          else if (r.status === 'NAO_ATENDE') doc.setTextColor(190, 18, 60);
          else doc.setTextColor(180, 83, 9);
        } else {
          doc.setTextColor(30, 41, 59);
        }
        doc.text(lines, x + 1.2, y + 3.8);
        x += colWidths[idx];
      });
      y += rowHeight;
    });
    y += 4;
  }

  // 4. Alertas Críticos
  if (alertas.length > 0) {
    drawSectionTitle('4. Alertas Críticos de Desclassificação');
    alertas.forEach((al) => {
      drawWrappedText(`• ${al}`, 8.5, [190, 18, 60]);
    });
  }

  // Numeração de páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `NEXOS CRM • GOVFLOW B2G — Parecer Técnico de Análise de TR`,
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  if (mode === 'bloburl') {
    return String(doc.output('bloburl'));
  }

  const safeFile = (item.titulo_objeto || item.id || 'analise_tr')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  doc.save(`parecer_tr_${safeFile}.pdf`);
};
