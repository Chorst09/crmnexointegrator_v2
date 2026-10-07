import { logCostAccessAudit } from './auditLogger';

const toCurrency = (v) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const STATUS_LABEL = {
  NOVA: 'Solicitada',
  EM_PRECIFICACAO: 'Em Precificação',
  AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
  ENVIADA: 'Enviada',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  FINALIZADA: 'Finalizada',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada'
};

const PRIORITY_LABEL = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' };

const parseItemIcmsCompra = (item) => {
  if (!item?.observacoes) return '';
  try {
    const parsed = JSON.parse(item.observacoes);
    return parsed?.icmsCompra ?? '';
  } catch {
    return '';
  }
};

const modalidadeLabel = (value) => ({
  VENDA: 'Venda',
  LOCACAO: 'Locação',
  LOCAÇÃO: 'Locação',
  SERVICO: 'Serviço',
  SERVICOS: 'Serviços'
}[value] || value || '-');

export const buildPreSalesBudgetPrintHtml = (item, options = {}) => {
  const hideCosts = Boolean(options?.hideCosts);
  const details = item?.calculoDetalhes && typeof item.calculoDetalhes === 'object' ? item.calculoDetalhes : {};
  const proposalDetails = details.dadosProposta && typeof details.dadosProposta === 'object' ? details.dadosProposta : {};
  const cotacoes = Array.isArray(details.cotacoes) ? details.cotacoes : [];
  const propostasPrecificadas = Array.isArray(details.propostasPrecificadas)
    ? details.propostasPrecificadas
    : details.propostaPrecificada ? [details.propostaPrecificada] : [];
  const itensSolicitados = Array.isArray(item?.items) ? item.items : [];
  const createdAt = item?.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-';
  const updatedAt = item?.updatedAt ? new Date(item.updatedAt).toLocaleString('pt-BR') : '-';
  const statusKey = String(item?.status || 'NOVA').toUpperCase();
  const statusText = STATUS_LABEL[statusKey] || statusKey;
  const clientName = proposalDetails.clienteOrgao || item?.nomeCliente || item?.lead?.name || '-';
  const premissas = proposalDetails.premissasProposta || '';

  const requestedRows = itensSolicitados.length > 0
    ? itensSolicitados.map((requestedItem) => {
        const quantidade = Number(requestedItem?.quantidade) || 1;
        if (hideCosts) {
          const precoUnitario = Number(requestedItem?.precoSugerido ?? requestedItem?.precoVenda ?? 0);
          const subtotalVenda = Number(requestedItem?.subtotalVenda) || (quantidade * precoUnitario);
          return `<tr>
            <td>${escapeHtml(requestedItem?.descricao || requestedItem?.product?.name || '-')}</td>
            <td style="text-align:center">${escapeHtml(quantidade)}</td>
            <td style="text-align:right">${escapeHtml(toCurrency(precoUnitario))}</td>
            <td style="text-align:right;font-weight:bold;color:#047857">${escapeHtml(toCurrency(subtotalVenda))}</td>
          </tr>`;
        }
        const icmsCompra = parseItemIcmsCompra(requestedItem);
        const custoUnitario = Number(requestedItem?.custoUnitario) || 0;
        return `<tr>
          <td>${escapeHtml(requestedItem?.descricao || requestedItem?.product?.name || '-')}</td>
          <td style="text-align:center">${escapeHtml(quantidade)}</td>
          <td style="text-align:right">${escapeHtml(toCurrency(custoUnitario))}</td>
          <td style="text-align:right">${escapeHtml(icmsCompra === '' ? '-' : `${icmsCompra}%`)}</td>
          <td style="text-align:right">${escapeHtml(toCurrency(quantidade * custoUnitario))}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="${hideCosts ? 4 : 5}" class="empty">Sem itens registrados.</td></tr>`;

  const quotationRows = !hideCosts && cotacoes.length > 0
    ? cotacoes.flatMap((cotacao) => {
        const itens = Array.isArray(cotacao?.itens) && cotacao.itens.length > 0
          ? cotacao.itens
          : [{ descricao: '-', quantidade: 0, custoUnitario: 0 }];
        return itens.map((quotedItem) => {
          const quantidade = Number(quotedItem?.quantidade) || 0;
          const custoUnitario = Number(quotedItem?.custoUnitario) || 0;
          return `<tr>
            <td>${escapeHtml(cotacao?.modalidade || '-')}</td>
            <td>${escapeHtml(cotacao?.distribuidor || '-')}</td>
            <td>${escapeHtml(cotacao?.fornecedor || '-')}</td>
            <td>${escapeHtml(cotacao?.numeroOrcamento || item?.numero || '-')}</td>
            <td>${escapeHtml(quotedItem?.descricao || '-')}</td>
            <td style="text-align:center">${escapeHtml(quantidade)}</td>
            <td style="text-align:right">${escapeHtml(toCurrency(custoUnitario))}</td>
            <td style="text-align:right">${escapeHtml(toCurrency(quantidade * custoUnitario))}</td>
          </tr>`;
        });
      }).join('')
    : '<tr><td colspan="8" class="empty">Sem cotações de distribuidores registradas.</td></tr>';

  const pricingRows = propostasPrecificadas.length > 0
    ? propostasPrecificadas.map((proposta) => {
        const finalPrice = Number(proposta?.result?.finalPrice) || 0;
        const monthlyPrice = Number(proposta?.result?.monthlyPrice) || 0;
        if (hideCosts) {
          return `<tr>
            <td>${escapeHtml(proposta?.number || '-')}</td>
            <td>${escapeHtml(proposta?.calculatorLabel || proposta?.calculatorType || '-')}</td>
            <td style="text-align:right;font-weight:bold;color:#0284c7">${escapeHtml(toCurrency(finalPrice))}</td>
            <td style="text-align:right;font-weight:bold;color:#047857">${escapeHtml(toCurrency(monthlyPrice))}</td>
            <td>${escapeHtml(proposta?.sentToReviewAt ? new Date(proposta.sentToReviewAt).toLocaleString('pt-BR') : '-')}</td>
          </tr>`;
        }
        const baseCost = Number(proposta?.result?.baseCost) || 0;
        const margin = Number(proposta?.pricing?.desiredMargin) || 0;
        return `<tr>
          <td>${escapeHtml(proposta?.number || '-')}</td>
          <td>${escapeHtml(proposta?.calculatorLabel || proposta?.calculatorType || '-')}</td>
          <td style="text-align:right">${escapeHtml(toCurrency(finalPrice))}</td>
          <td style="text-align:right">${escapeHtml(toCurrency(monthlyPrice))}</td>
          <td style="text-align:right">${escapeHtml(toCurrency(baseCost))}</td>
          <td style="text-align:right">${escapeHtml(`${margin.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)}</td>
          <td>${escapeHtml(proposta?.sentToReviewAt ? new Date(proposta.sentToReviewAt).toLocaleString('pt-BR') : '-')}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="${hideCosts ? 5 : 7}" class="empty">Sem proposta precificada em revisão.</td></tr>`;

  return `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Orçamento ${escapeHtml(item?.numero || '')}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 24px; color: #0f172a; background: #fff; font-family: Arial, Helvetica, sans-serif; }
        .header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px; }
        h1 { margin: 0; color: #0369a1; font-size: 28px; }
        h2 { margin: 22px 0 10px; color: #075985; font-size: 17px; }
        .muted { color: #64748b; font-size: 13px; margin-top: 6px; }
        .badge { display: inline-block; border: 1px solid #bae6fd; border-radius: 999px; background: #e0f2fe; color: #075985; padding: 6px 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
        .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
        .row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 13px; }
        .label { color: #475569; }
        .value { color: #0f172a; font-weight: 700; text-align: right; }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        th { background: #0f172a; color: #fff; padding: 8px; text-align: left; }
        td { border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .empty { color: #64748b; text-align: center; padding: 18px; }
        .description { white-space: pre-wrap; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; color: #334155; background: #f8fafc; }
        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; }
        @media print { body { margin: 12mm; } }
      </style>
      <script>
        window.addEventListener('load', function () {
          setTimeout(function () { window.focus(); window.print(); }, 400);
        }, { once: true });
      </script>
    </head>
    <body>
      <section class="header">
        <div>
          <h1>${hideCosts ? 'Orçamento Comercial Precificado' : 'Orçamento de Pré-vendas'}</h1>
          <div class="muted">Nº ${escapeHtml(item?.numero || '-')} · Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
        </div>
        <span class="badge">${escapeHtml(statusText)}</span>
      </section>
      <section class="grid">
        <article class="card">
          <div class="row"><span class="label">Título</span><span class="value">${escapeHtml(item?.titulo || '-')}</span></div>
          <div class="row"><span class="label">Cliente</span><span class="value">${escapeHtml(clientName)}</span></div>
          <div class="row"><span class="label">CNPJ / Documento</span><span class="value">${escapeHtml(proposalDetails.cnpjDocumento || '-')}</span></div>
          <div class="row"><span class="label">Modalidade</span><span class="value">${escapeHtml(modalidadeLabel(item?.modalidade))}</span></div>
          <div class="row"><span class="label">Prioridade</span><span class="value">${escapeHtml(PRIORITY_LABEL[item?.prioridade] || item?.prioridade || '-')}</span></div>
        </article>
        <article class="card">
          <div class="row"><span class="label">Solicitante</span><span class="value">${escapeHtml(item?.solicitante?.name || '-')}</span></div>
          <div class="row"><span class="label">Contato do Cliente</span><span class="value">${escapeHtml(proposalDetails.contatoCliente || '-')}</span></div>
          <div class="row"><span class="label">Email do Cliente</span><span class="value">${escapeHtml(proposalDetails.emailCliente || '-')}</span></div>
          <div class="row"><span class="label">Telefone do Cliente</span><span class="value">${escapeHtml(proposalDetails.telefoneCliente || '-')}</span></div>
          <div class="row"><span class="label">Gerente</span><span class="value">${escapeHtml(proposalDetails.gerenteConta || item?.solicitante?.name || '-')}</span></div>
          <div class="row"><span class="label">Email Gerente</span><span class="value">${escapeHtml(proposalDetails.emailGerente || item?.solicitante?.email || '-')}</span></div>
          <div class="row"><span class="label">Telefone Gerente</span><span class="value">${escapeHtml(proposalDetails.telefoneGerente || '-')}</span></div>
          <div class="row"><span class="label">Oportunidade</span><span class="value">${escapeHtml(item?.opportunity?.title || '-')}</span></div>
          <div class="row"><span class="label">Criado em</span><span class="value">${escapeHtml(createdAt)}</span></div>
          <div class="row"><span class="label">Atualizado em</span><span class="value">${escapeHtml(updatedAt)}</span></div>
        </article>
      </section>
      <h2>Descrição</h2>
      <section class="description">${escapeHtml(item?.descricao || 'Sem descrição.')}</section>
      ${premissas ? `
        <h2>Premissas da Proposta</h2>
        <section class="description">${escapeHtml(premissas)}</section>
      ` : ''}
      <h2>${hideCosts ? 'Produtos e Serviços Precificados' : 'Itens Solicitados'}</h2>
      <table>
        ${hideCosts ? `
          <thead><tr><th>Descrição</th><th style="text-align:center">Qtde</th><th style="text-align:right">Preço Unit. Venda</th><th style="text-align:right">Subtotal Venda</th></tr></thead>
        ` : `
          <thead><tr><th>Descrição</th><th style="text-align:center">Qtde</th><th style="text-align:right">Custo Unit.</th><th style="text-align:right">ICMS Compra</th><th style="text-align:right">Total</th></tr></thead>
        `}
        <tbody>${requestedRows}</tbody>
      </table>
      ${!hideCosts ? `
        <h2>Cotações de Distribuidores</h2>
        <table>
          <thead><tr><th>Modalidade</th><th>Distribuidor</th><th>Fornecedor</th><th>Orçamento</th><th>Item</th><th style="text-align:center">Qtde</th><th style="text-align:right">Custo Unit.</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${quotationRows}</tbody>
        </table>
      ` : ''}
      <h2>Proposta Precificada</h2>
      <table>
        ${hideCosts ? `
          <thead><tr><th>Nº Proposta</th><th>Tipo / Escopo</th><th style="text-align:right">Valor Final Venda</th><th style="text-align:right">Valor Mensal (MRR)</th><th>Enviada em</th></tr></thead>
        ` : `
          <thead><tr><th>Nº Proposta</th><th>Tipo</th><th style="text-align:right">Valor Final</th><th style="text-align:right">Valor Mensal</th><th style="text-align:right">Custo Base</th><th style="text-align:right">Margem</th><th>Enviada em</th></tr></thead>
        `}
        <tbody>${pricingRows}</tbody>
      </table>
      <section class="footer">${hideCosts ? 'Documento Comercial gerado com base no dimensionamento da Engenharia de Pré-Vendas.' : 'Documento gerado pelo módulo de Orçamentos de Pré-vendas.'}</section>
    </body>
    </html>
  `;
};

export const openPreSalesBudgetPdf = (item, options = {}) => {
  let hideCosts = options.hideCosts;
  if (hideCosts === undefined) {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = String(user.actualRole || user.role || '').trim().toUpperCase();
      if (!['PRE_SALES', 'PRE_VENDAS'].includes(role)) {
        hideCosts = true;
      }
    } catch {
      hideCosts = true;
    }
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Não foi possível abrir a janela do PDF. Libere pop-ups e tente novamente.');
    return;
  }

  // Auditoria corporativa mandatória: registra consulta técnica/administrativa a custos e margens de distribuidores
  if (!hideCosts) {
    logCostAccessAudit({
      action: 'CONSULTA_CUSTOS_MARGENS',
      resource: 'RELATORIO_PDF_ORCAMENTO',
      resourceId: item?.numero || item?.id || 'ORC-PDF',
      details: {
        tipo: 'Emissão de Relatório PDF Completo com Custos e Margens de Distribuidores',
        numeroOrcamento: item?.numero || 'ORC-PREVENDAS',
        totalItens: Array.isArray(item?.items) ? item.items.length : 0,
        motivo: 'Auditoria de custos pré-vendas e margens homologadas de distribuidores'
      }
    });
  }

  const htmlBlob = new Blob([buildPreSalesBudgetPrintHtml(item, { ...options, hideCosts })], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(htmlBlob);
  printWindow.location.href = blobUrl;
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};
