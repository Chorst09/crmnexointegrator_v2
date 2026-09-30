const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { jsPDF } = require('jspdf');

const router = express.Router();

// POST /api/pdf-generator/orcamento
router.post('/orcamento', async (req, res) => {
  try {
    console.log('🟢 POST /api/pdf-generator/orcamento recebido');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    
    const { solicitacaoId, dadosPrecificacao, solicitacao } = req.body;
    
    let solicitacaoData = solicitacao;
    
    // Se não veio a solicitação no body, buscar no banco
    if (!solicitacaoData && solicitacaoId) {
      solicitacaoData = await prisma.activity.findUnique({
        where: { id: solicitacaoId },
        include: {
          company: true,
          opportunity: true,
          assignedTo: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    }
    
    if (!solicitacaoData) {
      return res.status(404).json({ error: 'Solicitação não encontrada' });
    }
    
    // Gerar PDF usando jsPDF
    const pdfBuffer = generatePDFBuffer(solicitacaoData, dadosPrecificacao);
    
    // Configurar headers para download
    const filename = `orcamento-${solicitacaoData.numero || solicitacaoData.id}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Enviar o PDF
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('🔴 Erro ao gerar PDF:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
});

// GET /api/pdf-generator/template/:tipo
router.get('/template/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    
    const templates = {
      orcamento: {
        titulo: 'ORÇAMENTO COMERCIAL',
        campos: ['numero', 'titulo', 'descricao', 'valor', 'prazo', 'condicoes'],
        formato: 'A4',
        orientacao: 'portrait'
      },
      precificacao: {
        titulo: 'ANÁLISE DE PRECIFICAÇÃO',
        campos: ['custos', 'impostos', 'margem', 'precoFinal', 'competitividade'],
        formato: 'A4',
        orientacao: 'portrait'
      }
    };
    
    const template = templates[tipo];
    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }
    
    res.json({ success: true, template });
    
  } catch (error) {
    console.error('🔴 Erro ao buscar template:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
});

function generatePDFBuffer(solicitacao, dadosPrecificacao = null) {
  const doc = new jsPDF();
  
  // Configurações
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const lineHeight = 7;
  let currentY = margin;
  
  // Função auxiliar para adicionar texto
  const addText = (text, x = margin, fontSize = 12, style = 'normal') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);
    doc.text(text, x, currentY);
    currentY += lineHeight;
  };
  
  // Função auxiliar para adicionar linha
  const addLine = () => {
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += lineHeight;
  };
  
  // Cabeçalho
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO COMERCIAL', pageWidth / 2, 25, { align: 'center' });
  
  currentY = 50;
  doc.setTextColor(0, 0, 0);
  
  // Informações do documento
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const horaAtual = new Date().toLocaleTimeString('pt-BR');
  const numero = solicitacao.numero || `SOL-${new Date().getFullYear()}-${(solicitacao.id || '').substring(0, 8)}`;
  
  addText(`NÚMERO: ${numero}`, margin, 14, 'bold');
  addText(`DATA: ${dataAtual} às ${horaAtual}`, margin, 12);
  currentY += 5;
  
  addLine();
  
  // Dados da Solicitação
  addText('DADOS DA SOLICITAÇÃO', margin, 16, 'bold');
  currentY += 3;
  
  addText(`Título: ${solicitacao.titulo || solicitacao.subject || 'Não informado'}`, margin, 12);
  addText(`Descrição: ${solicitacao.descricao || solicitacao.description || 'Não informado'}`, margin, 12);
  addText(`Prioridade: ${solicitacao.prioridade || solicitacao.priority || 'Não informado'}`, margin, 12);
  addText(`Status: ${solicitacao.status || 'Não informado'}`, margin, 12);
  
  if (solicitacao.solicitante || solicitacao.assignedTo) {
    const solicitante = solicitacao.solicitante || solicitacao.assignedTo;
    addText(`Solicitante: ${solicitante.name || 'Não informado'}`, margin, 12);
    addText(`Email: ${solicitante.email || 'Não informado'}`, margin, 12);
  }
  
  currentY += 5;
  addLine();
  
  // Dados do Cliente
  if (solicitacao.company) {
    addText('DADOS DO CLIENTE', margin, 16, 'bold');
    currentY += 3;
    
    addText(`Cliente: ${solicitacao.company.name || 'Não informado'}`, margin, 12);
    addText(`Segmento: ${solicitacao.company.segment || 'Não informado'}`, margin, 12);
    addText(`Cidade: ${solicitacao.company.city || 'Não informado'}`, margin, 12);
    
    currentY += 5;
    addLine();
  }
  
  // Oportunidade
  if (solicitacao.opportunity) {
    addText('OPORTUNIDADE', margin, 16, 'bold');
    currentY += 3;
    
    addText(`Oportunidade: ${solicitacao.opportunity.title || 'Não informado'}`, margin, 12);
    if (solicitacao.opportunity.value) {
      addText(`Valor Estimado: R$ ${solicitacao.opportunity.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, 12);
    }
    
    currentY += 5;
    addLine();
  }
  
  // Tipos de Precificação
  addText('TIPOS DE PRECIFICAÇÃO SOLICITADOS', margin, 16, 'bold');
  currentY += 3;
  
  addText('☐ Venda (Sales) - Precificação baseada em custos e margem', margin, 12);
  addText('☐ Locação (MaaS/Rental) - Cálculo de mensalidade', margin, 12);
  addText('☐ Serviços (Service/SaaS) - Precificação por projeto/hora', margin, 12);
  
  currentY += 5;
  addLine();
  
  // Análise de Precificação (se disponível)
  if (dadosPrecificacao) {
    addText('ANÁLISE DE PRECIFICAÇÃO', margin, 16, 'bold');
    currentY += 3;
    
    if (dadosPrecificacao.custoUnitario) {
      addText(`Custo Unitário: R$ ${parseFloat(dadosPrecificacao.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, 12);
    }
    if (dadosPrecificacao.quantidade) {
      addText(`Quantidade: ${dadosPrecificacao.quantidade} unidade(s)`, margin, 12);
    }
    if (dadosPrecificacao.frete) {
      addText(`Frete: R$ ${parseFloat(dadosPrecificacao.frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, 12);
    }
    if (dadosPrecificacao.margemDesejada) {
      addText(`Margem Desejada: ${dadosPrecificacao.margemDesejada}%`, margin, 12);
    }
    if (dadosPrecificacao.regimeTributario) {
      addText(`Regime Tributário: ${dadosPrecificacao.regimeTributario.replace('_', ' ')}`, margin, 12);
    }
    
    currentY += 5;
    addLine();
  }
  
  // Condições Comerciais
  addText('CONDIÇÕES COMERCIAIS', margin, 16, 'bold');
  currentY += 3;
  
  addText('Prazo de Entrega: A definir conforme disponibilidade', margin, 12);
  addText('Condições de Pagamento: A negociar', margin, 12);
  addText('Validade da Proposta: 30 dias', margin, 12);
  addText('Garantia: Conforme especificação do fabricante', margin, 12);
  
  currentY += 5;
  addLine();
  
  // Observações
  addText('OBSERVAÇÕES', margin, 16, 'bold');
  currentY += 3;
  
  const observacoes = solicitacao.observacoes || solicitacao.description || 'Nenhuma observação adicional.';
  
  // Quebrar texto longo em múltiplas linhas
  const maxWidth = pageWidth - (margin * 2);
  const lines = doc.splitTextToSize(observacoes, maxWidth);
  
  lines.forEach(line => {
    addText(line, margin, 12);
  });
  
  currentY += 5;
  addLine();
  
  // Rodapé
  addText('Valores sujeitos a alteração sem aviso prévio.', margin, 10);
  addText('Proposta válida mediante confirmação de disponibilidade.', margin, 10);
  addText('Impostos inclusos conforme regime tributário informado.', margin, 10);
  
  currentY += 10;
  addLine();
  
  // Contato
  addText('CONTATO', margin, 14, 'bold');
  currentY += 3;
  
  addText('Equipe Pré-Vendas', margin, 12);
  addText('Email: prevendas@empresa.com', margin, 12);
  addText('Telefone: (11) 9999-9999', margin, 12);
  addText('Website: www.empresa.com', margin, 12);
  
  // Rodapé final
  const footerY = doc.internal.pageSize.height - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Documento gerado automaticamente pelo Sistema CRM - ${dataAtual} às ${horaAtual}`, pageWidth / 2, footerY, { align: 'center' });
  
  // Retornar buffer do PDF
  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = router;