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

  const totalGeralMatriz = (ficha.matriz_itens || []).reduce((acc, it) => acc + (it.valor_estimado_total || (it.valor_estimado_unitario || 0) * (it.quantitativo || 1)), 0);

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ficha Técnica - ${ficha.id_licitacao} - ${ficha.orgao_comprador}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; padding: 0; margin: 0; background: #fff; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
    .header-top { display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .title { font-size: 18px; font-weight: 800; color: #0369a1; margin: 6px 0 2px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
    .badge-alert { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #fee2e2; color: #b91c1c; }
    .section { margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; page-break-inside: avoid; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px; }
    .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px; }
    .value { font-size: 12px; font-weight: 600; color: #0f172a; }
    .value-highlight { font-size: 14px; font-weight: 800; color: #059669; }
    .value-alert { font-size: 13px; font-weight: 700; color: #be123c; }
    .resumo { font-size: 11.5px; color: #334155; line-height: 1.5; white-space: pre-line; background: #f8fafc; padding: 10px; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 6px; }
    th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; }
    td { padding: 6px 8px; border: 1px solid #e2e8f0; }
    ul { margin: 0; padding-left: 16px; font-size: 11px; color: #334155; }
    li { margin-bottom: 3px; }
    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <span>República Federativa do Brasil • Lei nº 14.133/2021</span>
      <span>${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
    <div class="title">Ficha Técnica & Análise de Edital / TR</div>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:6px; flex-wrap:wrap; gap:8px;">
      <div>
        <span style="font-size:15px; font-weight:800; color:#1e293b; display:block;">${ficha.orgao_comprador}</span>
        ${ficha.orgao_cnpj ? `<span style="font-size:11px; color:#475569; font-weight:600;">CNPJ: ${ficha.orgao_cnpj}</span>` : ''}
      </div>
      <div>
        <span class="badge">ID: ${ficha.id_licitacao}</span>
        <span class="badge" style="background:#f1f5f9; color:#334155;">${ficha.modalidade_contratacao || 'Licitação'}</span>
      </div>
    </div>
  </div>

  <!-- Cronograma e Prazos Críticos -->
  <div class="section" style="background:#f0f9ff; border-color:#bae6fd;">
    <div class="section-title" style="color:#0369a1; border-color:#e0f2fe;">Cronograma Crítico & Portal da Disputa</div>
    <div class="grid-4">
      <div>
        <span class="label">Portal a Licitar</span>
        <span class="value" style="color:#0284c7;">${ficha.portal_compras || 'Não identificado'}</span>
      </div>
      <div>
        <span class="label">Abertura da Sessão</span>
        <span class="value" style="color:#1d4ed8;">${ficha.data_abertura || 'Consulte o Edital'}</span>
      </div>
      <div>
        <span class="label">Limite de Propostas</span>
        <span class="value-alert">${ficha.data_limite_proposta || 'Não identificado'}</span>
      </div>
      <div>
        <span class="label">Valor Total Estimado</span>
        <span class="value-highlight">${formatarMoeda(ficha.valor_estimado_total || totalGeralMatriz)}</span>
      </div>
    </div>
  </div>

  <!-- 1. Resumo Executivo -->
  <div class="section">
    <div class="section-title">1. Objeto & Resumo Executivo da Contratação</div>
    <div class="resumo">${ficha.resumo_executivo}</div>
  </div>

  <!-- 2. Matriz de Itens e Quantitativos (TR) -->
  <div class="section">
    <div class="section-title">2. Matriz de Itens e Quantitativos (Extraídos do TR)</div>
    <table>
      <thead>
        <tr>
          <th style="width:35px;">Item</th>
          <th style="width:90px;">Código</th>
          <th>Descrição / Especificação Técnica</th>
          <th style="width:45px;">Unid</th>
          <th style="width:55px; text-align:right;">Qtd</th>
          <th style="width:85px; text-align:right;">Valor Unit.</th>
          <th style="width:95px; text-align:right;">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        ${(ficha.matriz_itens && ficha.matriz_itens.length > 0) ? ficha.matriz_itens.map(it => `
          <tr>
            <td>${it.item_numero || 1}</td>
            <td><small style="color:#475569;">${it.codigo_catalogo || '-'}</small></td>
            <td><strong>${it.especificacao_sucinta}</strong></td>
            <td>${it.unidade || 'UN'}</td>
            <td style="text-align:right;">${it.quantitativo}</td>
            <td style="text-align:right;">${formatarMoeda(it.valor_estimado_unitario)}</td>
            <td style="text-align:right; font-weight:700;">${formatarMoeda(it.valor_estimado_total || ((it.valor_estimado_unitario || 0) * (it.quantitativo || 1)))}</td>
          </tr>
        `).join('') : `
          <tr><td colspan="7" style="text-align:center; padding:12px; color:#64748b;">Nenhum item isolado identificado. Consulte a tabela nos anexos originais.</td></tr>
        `}
      </tbody>
      ${(ficha.matriz_itens && ficha.matriz_itens.length > 0) ? `
      <tfoot>
        <tr style="background:#f8fafc; font-weight:bold;">
          <td colspan="6" style="text-align:right;">Total Geral dos Itens:</td>
          <td style="text-align:right; color:#059669;">${formatarMoeda(totalGeralMatriz)}</td>
        </tr>
      </tfoot>
      ` : ''}
    </table>
  </div>

  <!-- 3. Requisitos de Habilitação -->
  <div class="section">
    <div class="section-title">3. Documentações Necessárias & Requisitos de Habilitação</div>
    <div class="grid">
      <div>
        <span class="label">Qualificação Técnica (Atestados)</span>
        <ul>
          ${(ficha.requisitos_habilitacao?.atestados_capacidade_tecnica || []).map(a => `<li>${a}</li>`).join('') || '<li>Sem atestados específicos discriminados.</li>'}
        </ul>
      </div>
      <div>
        <span class="label">Regularidade Fiscal, Social e Trabalhista</span>
        <ul>
          ${(ficha.requisitos_habilitacao?.certidoes_e_registros_especificos || []).map(c => `<li>${c}</li>`).join('') || '<li>Certidões regulares (Federal, Estadual, Municipal, FGTS e CNDT).</li>'}
        </ul>
      </div>
    </div>
    <div class="grid" style="margin-top:10px;">
      <div>
        <span class="label">Qualificação Econômico-Financeira</span>
        <ul>
          ${(ficha.requisitos_habilitacao?.exigencias_contabeis || []).map(e => `<li><strong>${e.nome_indice}:</strong> ${e.regra}</li>`).join('') || '<li>Balanço patrimonial e índices contábeis (Lei 14.133/2021).</li>'}
        </ul>
      </div>
      <div>
        <span class="label">Qualificação de Equipe & Conselhos</span>
        <ul>
          ${(ficha.requisitos_habilitacao?.qualificacao_equipe_chave || []).map(q => `<li>${q}</li>`).join('') || '<li>Sem exigências de equipe chave destacadas.</li>'}
        </ul>
      </div>
    </div>
  </div>

  <!-- 4. Pontos de Atenção e Riscos -->
  <div class="section" style="background:#fff7ed; border-color:#fed7aa;">
    <div class="section-title" style="color:#c2410c; border-color:#ffedd5;">4. Matriz de Riscos & Cláusulas Críticas</div>
    <div class="grid-3">
      <div>
        <span class="label">Exigência de Amostra / PoC</span>
        <span class="value" style="font-size:11px;">${ficha.pontos_de_atencao_risco?.exigencia_amostra_poc || 'Não identificado.'}</span>
      </div>
      <div>
        <span class="label">Regras de Vistoria Técnica</span>
        <span class="value" style="font-size:11px;">${ficha.pontos_de_atencao_risco?.regras_vistoria?.detalhes_e_prazo || 'Não informada ou dispensada.'}</span>
      </div>
      <div>
        <span class="label">Garantia Contratual</span>
        <span class="value" style="font-size:11px;">${ficha.pontos_de_atencao_risco?.garantia_contratual || 'Não informada.'}</span>
      </div>
    </div>
    <div style="margin-top:10px;">
      <span class="label">Cláusulas Punitivas e Multas</span>
      <ul>
        ${(ficha.pontos_de_atencao_risco?.clausulas_punitivas_multas || []).map(p => `<li style="color:#991b1b;">${p}</li>`).join('') || '<li>Penalidades padrão nos termos da Lei nº 14.133/2021.</li>'}
      </ul>
    </div>
  </div>

  <div class="footer">
    Processo nº ${ficha.id_licitacao} • NEXOS AI & Double TI • Ficha Técnica Oficial de Licitações
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
