import { FichaTecnicaEditalTR } from '../types';

export const formatarMoeda = (valor?: number | null): string => {
  if (valor === undefined || valor === null || isNaN(valor)) return 'Não identificado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const safe = (v: unknown, fallback = 'Não informado'): string => {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return !s || /^(?:null|undefined|não identificado)$/i.test(s) ? fallback : s;
};

export const buildFichaHtmlDocument = (ficha: FichaTecnicaEditalTR): string => {
  const esc = JSON.parse(
    JSON.stringify(ficha, (_key, value) =>
      typeof value === 'string'
        ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        : value
    )
  ) as FichaTecnicaEditalTR;

  const cl = (esc.conlicitacao && typeof esc.conlicitacao === 'object' ? esc.conlicitacao : {}) as Record<string, any>;
  const req = esc.requisitos_habilitacao || ({} as any);
  const prazos = esc.prazos_e_locais || ({} as any);
  const risco = esc.pontos_de_atencao_risco || ({} as any);

  const totalGeralMatriz = (esc.matriz_itens || []).reduce(
    (acc, it) => acc + (it.valor_estimado_total || (it.valor_estimado_unitario || 0) * (it.quantitativo || 1)),
    0
  );

  const ident = {
    numero: safe(cl.identificacao?.numero_licitacao || esc.processo_administrativo || esc.id_licitacao),
    modalidade: safe(cl.identificacao?.modalidade || esc.modalidade_contratacao),
    uasg: safe(cl.identificacao?.uasg),
    portal: safe(cl.identificacao?.portal_realizacao || esc.portal_compras),
    contratacao: safe(cl.identificacao?.contratacao || esc.modalidade_contratacao),
    regulamentacao: safe(cl.identificacao?.regulamentacao_pregoeiro),
    objeto: safe(cl.identificacao?.objeto || esc.resumo_executivo),
  };

  const sessao = {
    data: safe(cl.sessao_publica?.data || esc.data_abertura),
    horario: safe(cl.sessao_publica?.horario, 'Conforme edital'),
    modo: safe(cl.sessao_publica?.modo_disputa || esc.modo_disputa),
    intervalo: safe(cl.sessao_publica?.intervalo_minimo),
  };

  const orgao = {
    nome: safe(cl.orgao_responsavel?.orgao || esc.orgao_comprador),
    cidadeUf: safe(cl.orgao_responsavel?.cidade_uf, ''),
    endereco: safe(cl.orgao_responsavel?.endereco || prazos.locais_prestacao_entrega?.[0]),
    email: safe(cl.orgao_responsavel?.email),
    telefone: safe(cl.orgao_responsavel?.telefone),
  };

  const detalhes = {
    valor: safe(cl.detalhes_licitacao?.valor_estimado, esc.pricesWithheld ? 'Sigiloso' : formatarMoeda(esc.valor_estimado_total || totalGeralMatriz)),
    criterio: safe(cl.detalhes_licitacao?.criterio_julgamento || esc.criterio_julgamento),
    prazoEntrega: safe(cl.detalhes_licitacao?.prazo_entrega || prazos.prazo_inicio_entrega),
    meEpp: safe(cl.detalhes_licitacao?.preferencia_me_epp),
    regionalidade: safe(cl.detalhes_licitacao?.restricoes_regionalidade),
    poc: safe(cl.detalhes_licitacao?.prova_de_conceito, 'Não mencionado'),
    margem: safe(cl.detalhes_licitacao?.margem_preferencia),
    visita: safe(cl.detalhes_licitacao?.visita_tecnica || risco.regras_vistoria?.detalhes_e_prazo),
    amostra: safe(cl.detalhes_licitacao?.amostra || risco.exigencia_amostra_poc),
  };

  const garantiaList = [
    cl.seguro_garantia?.garantia_proposta || { titulo: 'Não exige Garantia de Proposta', descricao: 'Não há no edital exigência identificada de garantia de proposta.' },
    cl.seguro_garantia?.garantia_contrato || { titulo: 'Garantia de Contrato', descricao: safe(risco.garantia_contratual, 'Não informada no edital.') },
    cl.seguro_garantia?.garantia_adicional || { titulo: 'Não exige Garantia Adicional', descricao: 'Não há previsão de garantia adicional nos termos dos arts. 59 ou 60 da Lei 14.133/2021.' },
    cl.seguro_garantia?.garantia_retomada || { titulo: 'Não exige Garantia de Retomada', descricao: 'Não há cláusula de retomada identificada.' },
  ];

  const prazosImp = cl.prazos_importantes || {};
  const criterios = cl.criterios_proposta_julgamento || {};
  const resumoItens = cl.resumo_itens || {};
  const habDocs: string[] = Array.isArray(cl.documentos_habilitacao) && cl.documentos_habilitacao.length > 0
    ? cl.documentos_habilitacao
    : [
        ...(req.habilitacao_juridica || []),
        ...(req.certidoes_e_registros_especificos || []),
        ...(req.exigencias_contabeis || []).map((e: any) => typeof e === 'string' ? e : `${e.nome_indice}: ${e.regra}`),
      ];
  const anexos: string[] = Array.isArray(cl.anexos_declaracoes) ? cl.anexos_declaracoes : [];
  const outras: string[] = Array.isArray(cl.outras_informacoes_relevantes) && cl.outras_informacoes_relevantes.length > 0
    ? cl.outras_informacoes_relevantes
    : (risco.pontos_de_atencao_gerais || []);
  const penalidades: string[] = Array.isArray(cl.penalidades_multas) && cl.penalidades_multas.length > 0
    ? cl.penalidades_multas
    : (risco.clausulas_punitivas_multas || []);
  const critica = cl.analise_critica || {};

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Resumo do Edital ${ident.numero} - ${orgao.nome}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.45; padding: 16px; margin: 0 auto; max-width: 960px; background: #fff; font-size: 11.5px; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 14px; }
    .header-top { display: flex; justify-content: space-between; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 4px 0 2px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .kpi-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; }
    .kpi-val { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; background: #e0f2fe; color: #0369a1; margin-top: 4px; }
    .section { margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; page-break-inside: avoid; }
    .section-danger { background: #fff1f2; border-color: #fecdd3; }
    .section-warning { background: #fffbeb; border-color: #fde68a; }
    .section-title { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #0f172a; margin: 0 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 14px; }
    .full { grid-column: span 2; }
    .label { font-size: 9.5px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 1px; }
    .value { font-size: 11px; color: #0f172a; white-space: pre-line; }
    .subcard { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #f8fafc; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
    th { background: #f1f5f9; text-align: left; padding: 5px 7px; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; }
    td { padding: 5px 7px; border: 1px solid #e2e8f0; vertical-align: top; }
    ul { margin: 0; padding-left: 16px; font-size: 11px; }
    li { margin-bottom: 2px; }
    .footer { margin-top: 16px; text-align: center; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <span>NEXOS AI • Resumo Estruturado de Edital (Padrão ConLicitação)</span>
      <span>Emitido em ${new Date().toLocaleDateString('pt-BR')}</span>
    </div>
    <div class="title">Resumo do Edital ${ident.numero}</div>
    <div style="font-size:11px; color:#475569;">Nº Controle / PNCP: ${esc.id_licitacao}${esc.orgao_cnpj ? ` • CNPJ: ${esc.orgao_cnpj}` : ''}</div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Valor Estimado</div>
      <div class="kpi-val" style="color:#059669;">${detalhes.valor}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Modalidade</div>
      <div class="kpi-val" style="font-size:13px;">${ident.contratacao}</div>
      ${sessao.modo !== 'Não informado' ? `<span class="badge">${sessao.modo}</span>` : ''}
    </div>
    <div class="kpi">
      <div class="kpi-label">Data da Sessão</div>
      <div class="kpi-val" style="font-size:13px;">${sessao.data}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Identificação da Licitação</div>
    <div class="grid">
      <div class="full"><span class="label">Objeto</span><span class="value">${ident.objeto}</span></div>
      <div><span class="label">Número da licitação</span><span class="value">${ident.numero}</span></div>
      <div><span class="label">Modalidade</span><span class="value">${ident.modalidade}</span></div>
      <div><span class="label">UASG</span><span class="value">${ident.uasg}</span></div>
      <div><span class="label">Portal de realização</span><span class="value">${ident.portal}</span></div>
      <div><span class="label">Contratação</span><span class="value">${ident.contratacao}</span></div>
      <div><span class="label">Regulamentação / Pregoeiro</span><span class="value">${ident.regulamentacao}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Informações da Sessão Pública</div>
    <div class="grid">
      <div><span class="label">Data</span><span class="value">${sessao.data}</span></div>
      <div><span class="label">Modo de Disputa</span><span class="value">${sessao.modo}</span></div>
      <div><span class="label">Horário</span><span class="value">${sessao.horario}</span></div>
      <div><span class="label">Intervalo mínimo</span><span class="value">${sessao.intervalo}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Órgão Responsável</div>
    <div class="grid">
      <div><span class="label">Órgão</span><span class="value">${orgao.nome}${orgao.cidadeUf ? ` — ${orgao.cidadeUf}` : ''}</span></div>
      <div><span class="label">Endereço</span><span class="value">${orgao.endereco}</span></div>
      <div><span class="label">E-mail</span><span class="value">${orgao.email}</span></div>
      <div><span class="label">Telefone</span><span class="value">${orgao.telefone}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">4. Detalhes da Licitação</div>
    <div class="grid">
      <div><span class="label">Valor estimado / orçamento</span><span class="value">${detalhes.valor}</span></div>
      <div><span class="label">Critério de julgamento</span><span class="value">${detalhes.criterio}</span></div>
      <div><span class="label">Prazo de entrega</span><span class="value">${detalhes.prazoEntrega}</span></div>
      <div><span class="label">Preferência ME/EPP</span><span class="value">${detalhes.meEpp}</span></div>
      <div><span class="label">Restrições de regionalidade</span><span class="value">${detalhes.regionalidade}</span></div>
      <div><span class="label">Exigência de prova de conceito</span><span class="value">${detalhes.poc}</span></div>
      <div><span class="label">Margem de preferência</span><span class="value">${detalhes.margem}</span></div>
      <div><span class="label">Exigência de visita técnica</span><span class="value">${detalhes.visita}</span></div>
      <div><span class="label">Exigência de amostra</span><span class="value">${detalhes.amostra}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">5. Seguro Garantia</div>
    ${garantiaList.map(g => `<div class="subcard"><strong>${safe(g.titulo)}</strong><div class="value">${safe(g.descricao)}</div></div>`).join('')}
  </div>

  <div class="section">
    <div class="section-title">6. Informações sobre Entrega e Execução</div>
    <div class="grid">
      <div><span class="label">Data / Prazo</span><span class="value">${safe(cl.entrega_execucao?.data_prazo || prazos.prazo_inicio_entrega)}</span></div>
      <div><span class="label">Local de entrega ou execução</span><span class="value">${safe(cl.entrega_execucao?.local_entrega_execucao || prazos.locais_prestacao_entrega?.join(' | '))}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">7. Prazos Importantes</div>
    <div class="grid">
      <div><span class="label">Tipo de fornecimento</span><span class="value">${safe(prazosImp.tipo_fornecimento || prazos.regime_execucao)}</span></div>
      <div><span class="label">Manifestação de recurso</span><span class="value">${safe(prazosImp.manifestacao_recurso)}</span></div>
      <div><span class="label">Documentação complementar</span><span class="value">${safe(prazosImp.documentacao_complementar)}</span></div>
      <div><span class="label">Recursos e contrarrazões</span><span class="value">${safe(prazosImp.recursos_contrarrazoes)}</span></div>
      <div><span class="label">Documento original</span><span class="value">${safe(prazosImp.documento_original)}</span></div>
      <div><span class="label">Esclarecimentos</span><span class="value">${safe(prazosImp.esclarecimentos || esc.data_fim_esclarecimento)}</span></div>
      <div><span class="label">Prazo contratual ou ARP</span><span class="value">${safe(prazosImp.prazo_contratual_arp || prazos.vigencia_contrato)}</span></div>
      <div><span class="label">Limite para impugnação</span><span class="value">${safe(prazosImp.limite_impugnacao || esc.data_fim_impugnacao)}</span></div>
      <div><span class="label">Limite para envio de propostas</span><span class="value">${safe(prazosImp.limite_envio_propostas || esc.data_limite_proposta)}</span></div>
      <div><span class="label">Vigência do contrato ou ata</span><span class="value">${safe(prazosImp.vigencia_contrato_ata || prazos.vigencia_contrato)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">8. Critérios da Proposta e Julgamento</div>
    <div class="grid">
      <div><span class="label">Validade da proposta</span><span class="value">${safe(criterios.validade_proposta)}</span></div>
      <div><span class="label">Exigências da proposta comercial</span><span class="value">${safe(criterios.exigencias_proposta_comercial)}</span></div>
      <div><span class="label">Critérios de desempate</span><span class="value">${safe(criterios.criterios_desempate)}</span></div>
      <div><span class="label">Programa de Integridade</span><span class="value">${safe(criterios.programa_integridade, 'Não mencionado')}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">9. Resumo dos Itens e Matriz de Quantitativos</div>
    <div class="grid" style="margin-bottom:8px;">
      <div><span class="label">Total de Itens / Lotes</span><span class="value">${safe(resumoItens.total_itens_lotes, String(esc.matriz_itens?.length || 0))}</span></div>
      <div><span class="label">Categorias principais</span><span class="value">${safe(resumoItens.categorias_principais)}</span></div>
      <div><span class="label">Descrição Geral</span><span class="value">${safe(resumoItens.descricao_geral || esc.resumo_executivo)}</span></div>
      <div><span class="label">Observações</span><span class="value">${safe(resumoItens.observacoes)}</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:35px;">Item</th>
          <th style="width:80px;">Código</th>
          <th>Descrição / Especificação Técnica</th>
          <th style="width:45px;">Unid</th>
          <th style="width:50px; text-align:right;">Qtd</th>
          <th style="width:80px; text-align:right;">Valor Unit.</th>
          <th style="width:90px; text-align:right;">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        ${(esc.matriz_itens && esc.matriz_itens.length > 0) ? esc.matriz_itens.map(it => `
          <tr>
            <td>${it.item_numero || 1}</td>
            <td>${it.codigo_catalogo || '-'}</td>
            <td><strong>${it.especificacao_sucinta}</strong></td>
            <td>${it.unidade || 'UN'}</td>
            <td style="text-align:right;">${it.quantitativo}</td>
            <td style="text-align:right;">${formatarMoeda(it.valor_estimado_unitario)}</td>
            <td style="text-align:right; font-weight:700;">${formatarMoeda(it.valor_estimado_total || ((it.valor_estimado_unitario || 0) * (it.quantitativo || 1)))}</td>
          </tr>
        `).join('') : `<tr><td colspan="7" style="text-align:center; color:#64748b;">Nenhum item isolado identificado.</td></tr>`}
      </tbody>
      ${(esc.matriz_itens && esc.matriz_itens.length > 0) ? `<tfoot><tr style="background:#f8fafc; font-weight:bold;"><td colspan="6" style="text-align:right;">Total Geral:</td><td style="text-align:right; color:#059669;">${formatarMoeda(totalGeralMatriz)}</td></tr></tfoot>` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-title">10. Documentos de Habilitação & Capacidade Técnica</div>
    <ul>${habDocs.length > 0 ? habDocs.map(d => `<li>${d}</li>`).join('') : '<li>Não informado</li>'}</ul>
    <div style="margin-top:8px;"><span class="label">Atestado de capacidade técnica</span><span class="value">${safe(cl.atestado_capacidade_tecnica || req.atestados_capacidade_tecnica?.join('\n'))}</span></div>
  </div>

  <div class="section">
    <div class="section-title">11. Anexos, Declarações & Outras Informações</div>
    <div class="grid">
      <div><span class="label">Anexos e declarações</span><ul>${anexos.length > 0 ? anexos.map(a => `<li>${a}</li>`).join('') : '<li>Não informado</li>'}</ul></div>
      <div><span class="label">Outras informações relevantes</span><ul>${outras.length > 0 ? outras.map(o => `<li>${o}</li>`).join('') : '<li>Não informado</li>'}</ul></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">12. Condições de Pagamento</div>
    <div class="value">${safe(cl.condicoes_pagamento)}</div>
  </div>

  <div class="section section-danger">
    <div class="section-title" style="color:#9f1239; border-color:#fecdd3;">13. Penalidades e Multas</div>
    <ul>${penalidades.length > 0 ? penalidades.map(p => `<li style="color:#881337;">${p}</li>`).join('') : '<li>Regras padrão da Lei 14.133/2021.</li>'}</ul>
  </div>

  <div class="section section-warning">
    <div class="section-title" style="color:#92400e; border-color:#fde68a;">14. Análise Crítica</div>
    <div class="grid">
      <div><span class="label">Conflito objeto / minuta</span><span class="value">${safe(critica.conflito_objeto_minuta)}</span></div>
      <div><span class="label">Previsão de reajuste / repactuação</span><span class="value">${safe(critica.previsao_reajuste_repactuacao)}</span></div>
      <div><span class="label">Conflito prazo de vigência / ARP</span><span class="value">${safe(critica.conflito_prazo_vigencia_arp)}</span></div>
      <div><span class="label">Permite renovação de contrato</span><span class="value">${safe(critica.permite_renovacao_contrato)}</span></div>
      <div><span class="label">Conflito prazos de entrega</span><span class="value">${safe(critica.conflito_prazos_entrega)}</span></div>
      <div><span class="label">Estabelece condições de pagamento</span><span class="value">${safe(critica.estabelece_condicoes_pagamento)}</span></div>
      <div><span class="label">Permite subcontratação</span><span class="value">${safe(critica.permite_subcontratacao)}</span></div>
    </div>
  </div>

  ${esc.consideracoes_licitante ? `
  <div class="section">
    <div class="section-title">15. Análise e Considerações do Licitante</div>
    <div class="value">${esc.consideracoes_licitante}</div>
  </div>` : ''}

  <div class="footer">
    Processo nº ${esc.id_licitacao} • NEXOS AI & Double TI • Padrão ConLicitação
  </div>
</body>
</html>`;
};

export const gerarPdfFichaTecnica = (
  ficha: FichaTecnicaEditalTR,
  modo: 'bloburl' | 'download' = 'download'
): string | void => {
  const htmlContent = buildFichaHtmlDocument(ficha);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  if (modo === 'bloburl') {
    return url;
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = `ficha_tecnica_${ficha.id_licitacao.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
