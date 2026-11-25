import { jsPDF } from 'jspdf';

export interface ProjectDeliverable {
  id: string;
  escopo: string;
  situacaoBase: string;
  evidenciaSugerida: string;
  entregaReal: string;
  aceiteReal: string;
  termoEvidencia: string;
}

export interface ProjectActionItem {
  id: string;
  prioridade: string;
  atividade: string;
  responsavel: string;
  prazo: string;
  status: string;
  dependencia?: string;
}

export interface ProjectPaymentMilestone {
  etapa: number;
  nome: string;
  percentual: number;
  condicao: string;
  referenciaEstimada: number;
  valorContratado: string;
  trdData: string;
  nfEmissao: string;
  previsaoBaixa: string;
}

export interface ProjectMonthlyReceivable {
  competencia: string;
  brutoAjustes: string;
  trdNf: string;
  vencimento: string;
  recebidoSaldo: string;
}

export interface ProjectRiskEntry {
  risco: string;
  acaoControle: string;
  responsavel: string;
  severidade: string;
}

export interface ProjectDecisionEntry {
  data: string;
  decisao: string;
  responsavelPrazo: string;
}

export interface ProjectActionUpdate {
  id: string;
  avancoImpedimento: string;
  novoPrazo: string;
  evidencia: string;
}

export interface ProjectExecutiveData {
  dataBase: string;
  emissao: string;
  proximaRevisao: string;
  situacaoGeral: string;
  resumoExecutivo: string;
  decisaoRequerida: string;
  contrato: {
    objeto: string;
    pregaoProtocolo: string;
    prazoPrevisto: string;
    contratoOS: string;
    gestorFiscalValor: string;
    baseEstimada: number;
    valorContratado: string;
    recebidoSaldo: string;
  };
  entregaveis: ProjectDeliverable[];
  planoAcao: ProjectActionItem[];
  dependenciasTecnicas: Array<{ codigo: string; descricao: string }>;
  atualizacoesAcoes: ProjectActionUpdate[];
  marcosPagamento: ProjectPaymentMilestone[];
  recebiveisMensais: ProjectMonthlyReceivable[];
  riscos: ProjectRiskEntry[];
  decisoes: ProjectDecisionEntry[];
  ritualAcompanhamento: string;
  fontes: string;
}

function brl(val: number) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function exportProjectExecutivePdf(projectName: string, data: ProjectExecutiveData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 16;

  const newPageIfNeeded = (needed = 24) => {
    if (y + needed > 280) {
      pdf.addPage();
      y = 18;
    }
  };

  const sectionHeader = (num: string, title: string) => {
    newPageIfNeeded(22);
    pdf.setFillColor(15, 39, 68);
    pdf.rect(margin, y, contentW, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(`${num}  ${title}`, margin + 3, y + 5.5);
    y += 12;
  };

  // Cabeçalho
  pdf.setFillColor(15, 39, 68);
  pdf.rect(0, 0, pageW, 24, 'F');
  pdf.setTextColor(125, 179, 219);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('GESTÃO DE PROJETOS / RELATÓRIO EXECUTIVO', margin, 8);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.text(projectName, margin, 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(
    `Data-base: ${data.dataBase || '-'}  |  Emissão: ${data.emissao || '-'}  |  Próxima revisão: ${data.proximaRevisao || '-'}`,
    margin,
    21.5
  );
  y = 31;

  // 01 Painel Executivo
  sectionHeader('01', 'Painel executivo');
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(`Situação geral: ${data.situacaoGeral}`, margin, y);
  y += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const resLines = pdf.splitTextToSize(data.resumoExecutivo || '', contentW);
  pdf.text(resLines, margin, y);
  y += resLines.length * 4.2 + 3;

  const contractRows: Array<[string, string]> = [
    ['Objeto', data.contrato.objeto],
    ['Pregão / protocolo', data.contrato.pregaoProtocolo],
    ['Prazo previsto', data.contrato.prazoPrevisto],
    ['Contrato / ordem de serviço', data.contrato.contratoOS],
    ['Gestor / fiscal / valor', data.contrato.gestorFiscalValor]
  ];
  contractRows.forEach(([k, v]) => {
    newPageIfNeeded(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${k}:`, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(v || '-'), margin + 48, y);
    y += 5;
  });

  if (data.decisaoRequerida) {
    newPageIfNeeded(12);
    pdf.setFont('helvetica', 'bold');
    const decLines = pdf.splitTextToSize(`Decisão requerida: ${data.decisaoRequerida}`, contentW);
    pdf.text(decLines, margin, y + 2);
    y += decLines.length * 4.2 + 5;
  }

  // 02 Controle de entregas
  sectionHeader('02', 'Controle de entregas');
  data.entregaveis.forEach((e) => {
    newPageIfNeeded(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(`${e.id} — ${e.escopo}`, margin, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.text(
      `Situação: ${e.situacaoBase} | Evidência: ${e.evidenciaSugerida} | Aceite: ${e.aceiteReal || 'A confirmar'} (${e.termoEvidencia || 'A confirmar'})`,
      margin + 3,
      y,
      { maxWidth: contentW - 3 }
    );
    pdf.setTextColor(15, 23, 42);
    y += 6;
  });

  // 03 Plano de ação
  sectionHeader('03', 'Plano de ação');
  data.planoAcao.forEach((a) => {
    newPageIfNeeded(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(`[${a.id} • ${a.prioridade}] ${a.atividade}`, margin, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Responsável: ${a.responsavel} | Prazo: ${a.prazo} | Status: ${a.status}`, margin + 3, y);
    pdf.setTextColor(15, 23, 42);
    y += 5.5;
  });

  // 04 Recebíveis da implantação
  sectionHeader('04', 'Recebíveis da implantação');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(
    `Base estimada: ${brl(data.contrato.baseEstimada)} | Valor contratado: ${data.contrato.valorContratado} | Recebido/saldo: ${data.contrato.recebidoSaldo}`,
    margin,
    y
  );
  y += 6;
  data.marcosPagamento.forEach((m) => {
    newPageIfNeeded(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(
      `${m.etapa}. ${m.nome} — ${m.percentual}% (${m.condicao}) — Ref: ${m.referenciaEstimada ? brl(m.referenciaEstimada) : '—'} | TRD: ${m.trdData}`,
      margin,
      y
    );
    y += 5;
  });

  // 05 Governança e operação
  sectionHeader('05', 'Governança e operação');
  data.riscos.forEach((r) => {
    newPageIfNeeded(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(`Risco: ${r.risco} (${r.responsavel})`, margin, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Controle: ${r.acaoControle}`, margin + 3, y);
    y += 5.5;
  });

  if (data.ritualAcompanhamento) {
    newPageIfNeeded(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Ritual de acompanhamento:', margin, y + 2);
    pdf.setFont('helvetica', 'normal');
    const ritLines = pdf.splitTextToSize(data.ritualAcompanhamento, contentW);
    pdf.text(ritLines, margin, y + 6);
    y += ritLines.length * 4.2 + 8;
  }

  if (data.fontes) {
    newPageIfNeeded(10);
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(7.5);
    const fLines = pdf.splitTextToSize(`Fontes: ${data.fontes}`, contentW);
    pdf.text(fLines, margin, y);
  }

  pdf.save(`Relatorio_Executivo_${projectName.replace(/\s+/g, '_')}.pdf`);
}
