import { FichaTecnicaEditalTR } from '../types';

export const formatarMoeda = (valor?: number | null): string => {
  if (valor === undefined || valor === null || isNaN(valor)) return 'Não identificado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

export const gerarPdfFichaTecnica = (
  ficha: FichaTecnicaEditalTR,
  modo: 'bloburl' | 'download' = 'download'
): string | void => {
  // Document text is untrusted when embedded in the printable HTML report.
  ficha = JSON.parse(JSON.stringify(ficha, (_key, value) => typeof value === 'string'
    ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    : value));
  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ficha Técnica - ${ficha.id_licitacao} - ${ficha.orgao_comprador}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; padding: 0; margin: 0; background: #fff; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
    .header-top { display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .title { font-size: 20px; font-weight: 800; color: #0369a1; margin: 8px 0 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
    .section { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; page-break-inside: avoid; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 12px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; font-size: 12px; }
    .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; }
    .value { font-size: 13px; font-weight: 600; color: #0f172a; }
    .value-highlight { font-size: 15px; font-weight: 800; color: #059669; }
    .resumo { font-size: 12px; color: #334155; line-height: 1.6; white-space: pre-line; background: #f8fafc; padding: 12px; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    th { background: #f1f5f9; text-align: left; padding: 8px; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    ul { margin: 0; padding-left: 18px; font-size: 11px; color: #334155; }
    li { margin-bottom: 4px; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <span>República Federativa do Brasil • Lei nº 14.133/2021</span>
      <span>${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
    <div class="title">Ficha Técnica & Auditoria de Edital/TR</div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
      <span style="font-size:14px; font-weight:700; color:#1e293b;">${ficha.orgao_comprador}</span>
      <span class="badge">ID: ${ficha.id_licitacao}</span>
    </div>
  </div>

  <div class="section" style="background:#f0fdf4; border-color:#bbf7d0;">
    <div class="grid-4">
      <div>
        <span class="label">Valor Total Estimado</span>
        <span class="value-highlight">${formatarMoeda(ficha.valor_estimado_total)}</span>
      </div>
      <div>
        <span class="label">Data de Abertura</span>
        <span class="value">${ficha.data_abertura || 'Consulte o Edital'}</span>
      </div>
      <div>
        <span class="label">Modalidade</span>
        <span class="value">${ficha.modalidade_contratacao || 'Não identificado'}</span>
      </div>
      <div>
        <span class="label">Critério de Julgamento</span>
        <span class="value">${ficha.criterio_julgamento || 'Menor Preço'}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Resumo Executivo do Certame</div>
    <div class="resumo">${ficha.resumo_executivo}</div>
  </div>

  <div class="section">
    <div class="section-title">2. Prazos e Condições de Execução</div>
    <div class="grid">
      <div>
        <span class="label">Prazo de Início / Entrega</span>
        <span class="value">${ficha.prazos_e_locais?.prazo_inicio_entrega || 'Conforme Edital'}</span>
      </div>
      <div>
        <span class="label">Vigência Contratual</span>
        <span class="value">${ficha.prazos_e_locais?.vigencia_contrato || 'Não identificado'}</span>
      </div>
    </div>
    <div style="margin-top:10px;">
      <span class="label">Locais de Entrega</span>
      <ul>
        ${(ficha.prazos_e_locais?.locais_prestacao_entrega || ['Conforme especificado no Termo de Referência']).map(loc => `<li>${loc}</li>`).join('')}
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Matriz de Itens e Quantitativos</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px;">Item</th>
          <th>Especificação</th>
          <th style="width:50px;">Unid</th>
          <th style="width:60px; text-align:right;">Qtd</th>
          <th style="width:90px; text-align:right;">Valor Unit.</th>
          <th style="width:100px; text-align:right;">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        ${(ficha.matriz_itens || []).map(it => `
          <tr>
            <td>${it.item_numero || 1}</td>
            <td><strong>${it.especificacao_sucinta}</strong> ${it.codigo_catalogo ? `<br/><small style="color:#64748b;">CATMAT/CATSER: ${it.codigo_catalogo}</small>` : ''}</td>
            <td>${it.unidade || 'UN'}</td>
            <td style="text-align:right;">${it.quantitativo}</td>
            <td style="text-align:right;">${formatarMoeda(it.valor_estimado_unitario)}</td>
            <td style="text-align:right; font-weight:700;">${formatarMoeda(it.valor_estimado_total || (it.valor_estimado_unitario || 0) * (it.quantitativo || 1))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">4. Requisitos de Habilitação</div>
    <div class="grid">
      <div>
        <span class="label">Qualificação Técnica</span>
        <ul>
          ${(ficha.requisitos_habilitacao?.atestados_capacidade_tecnica || []).map(a => `<li>${a}</li>`).join('') || '<li>Sem exigências específicas listadas.</li>'}
        </ul>
      </div>
      <div>
        <span class="label">Qualificação Econômico-Financeira</span>
        <ul>
          ${(ficha.requisitos_habilitacao?.exigencias_contabeis || []).map(e => `<li><strong>${e.nome_indice}:</strong> ${e.regra}</li>`).join('') || '<li>Índices usuais da Lei 14.133/2021.</li>'}
        </ul>
      </div>
    </div>
  </div>

  <div class="footer">
    Processo nº ${ficha.id_licitacao} • Documento gerado pela plataforma NEXOS CRM • B2G Inteligência
  </div>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  if (modo === 'bloburl') {
    return url;
  }

  // Modo download
  const link = document.createElement('a');
  link.href = url;
  link.download = `ficha_tecnica_${ficha.id_licitacao.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
