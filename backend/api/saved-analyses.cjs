const express = require('express');
const PDFDocument = require('pdfkit');
const { prisma } = require('../lib/prisma.cjs');
const { requireRole } = require('../lib/auth');

const router = express.Router();

const USER_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'SELLER', 'PRE_SALES', 'USER'];
const ALLOWED_SCOPE_ROLES = new Set(['master', 'admin', 'user']);

const normalizeHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].trim().length > 0 ? value[0].trim() : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getScopeFromHeaders = (headers = {}) => {
  const companyId = normalizeHeaderValue(headers['x-company-id']);
  const userId = normalizeHeaderValue(headers['x-user-id']);
  const roleRaw = (normalizeHeaderValue(headers['x-user-role']) || 'user').toLowerCase();
  const role = ALLOWED_SCOPE_ROLES.has(roleRaw) ? roleRaw : 'user';

  if (!companyId || !userId) return null;
  return { companyId, userId, role };
};

const hasAccess = (record, scope) => {
  if (!record || !scope) return false;
  if (scope.role === 'master') return true;
  if (scope.role === 'admin') return record.companyId === scope.companyId;
  return record.companyId === scope.companyId && record.createdByUserId === scope.userId;
};

const parseSavePayload = (body = {}) => {
  const analysisId = typeof body.analysisId === 'string' ? body.analysisId.trim() : '';
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
  const processedAt = typeof body.processedAt === 'string' ? body.processedAt.trim() : '';

  if (!analysisId) {
    return { error: 'analysisId obrigatorio.' };
  }
  if (!fileName) {
    return { error: 'fileName obrigatorio.' };
  }
  if (!processedAt) {
    return { error: 'processedAt obrigatorio.' };
  }

  if (!body.extractedData || typeof body.extractedData !== 'object' || Array.isArray(body.extractedData)) {
    return { error: 'extractedData obrigatorio.' };
  }

  const analysisType = body.extractedData.analysisType;
  if (analysisType && analysisType !== 'edital' && analysisType !== 'tr') {
    return { error: 'extractedData.analysisType deve ser "edital" ou "tr".' };
  }

  return {
    analysisId,
    fileName,
    processedAt,
    extractedData: body.extractedData,
    originalFileDataUri:
      typeof body.originalFileDataUri === 'string' || body.originalFileDataUri === null
        ? body.originalFileDataUri
        : null,
    summaryPdfDataUri:
      typeof body.summaryPdfDataUri === 'string' || body.summaryPdfDataUri === null
        ? body.summaryPdfDataUri
        : null
  };
};

const generateAnalysisPdf = (extractedData, fileName) => {
  const data = extractedData || {};
  const analysisType = data.analysisType === 'tr' ? 'Termo de Referência' : 'Edital';
  const isTr = data.analysisType === 'tr';

  const extraInfo = data.extraInfo || {};
  const resultados = data.resultados || extraInfo.resultados || {};
  const general = data.general || {};
  const deadlines = data.deadlines || {};

  const recomendacao = data.recomendacao || extraInfo.recomendacao || '';
  const scoreAderencia = data.scoreAderencia ?? extraInfo.scoreAderencia ?? null;
  const resumoExecutivo = data.resumoExecutivo || data.trSummary || '';
  const pontosChave = data.pontosChave || resultados.pontosChave || [];
  const riscos = data.riscos || data.risks || resultados.riscos || [];
  const oportunidades = data.oportunidades || resultados.oportunidades || [];
  const proximasAcoes = data.proximasAcoes || resultados.proximasAcoes || [];
  const checklistDocumentacao = data.checklistDocumentacao || resultados.checklistDocumentacao || [];
  const items = data.items || [];
  const requirements = data.requirements || {};

  const trSummary = data.trSummary || '';
  const analyzedModel = data.analyzedModel || {};
  const termRequirements = data.termRequirements || [];
  const technicalNotebook = data.technicalNotebook || [];
  const compliantEquipment = data.compliantEquipment || [];
  const complianceOverview = data.complianceOverview || {};

  const title = fileName || 'Resumo da Análise';
  const now = new Date().toLocaleDateString('pt-BR');

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(chunks);
    const base64 = pdfBuffer.toString('base64');
    doc._pdfBase64 = `data:application/pdf;base64,${base64}`;
  });

  const addSectionTitle = (text) => {
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d');
    doc.text(text, { underline: false });
    doc.moveDown(0.5);
  };

  const addBodyText = (text, opts = {}) => {
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    doc.text(text, opts);
  };

  const addBulletList = (items) => {
    if (!items || items.length === 0) return;
    items.forEach((item) => {
      if (typeof item === 'string' && item.trim()) {
        doc.fontSize(9).font('Helvetica').fillColor('#333333');
        doc.text(`  •  ${item}`, { indent: 10 });
      }
    });
  };

  const addField = (label, value) => {
    const v = value && value !== 'Não identificado' ? value : '—';
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    doc.text(`${label}: `, { continued: true });
    doc.font('Helvetica-Bold').text(v);
  };

  // ---------- HEADER ----------
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a365d');
  doc.text('Resumo da Análise', { align: 'center' });
  doc.fontSize(11).font('Helvetica').fillColor('#666666');
  doc.text(`B2G - Licitações Públicas  |  ${analysisType}  |  ${now}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.strokeColor('#1a365d').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // ---------- 1. INFORMAÇÕES GERAIS ----------
  addSectionTitle('1. Informações Gerais');
  if (general.agency) addField('Órgão', general.agency);
  if (general.modality) addField('Modalidade', general.modality);
  if (general.portal) addField('Portal', general.portal);
  if (general.objectSummary) addField('Objeto', general.objectSummary);
  if (general.openingDate) addField('Data de Abertura', general.openingDate);
  if (general.openingTime) addField('Horário de Abertura', general.openingTime);
  if (deadlines.publicationDate) addField('Data de Publicação', deadlines.publicationDate);
  if (deadlines.proposalDeadline) addField('Prazo para Propostas', deadlines.proposalDeadline);
  if (deadlines.impugnationDeadline) addField('Prazo para Impugnação', deadlines.impugnationDeadline);
  if (deadlines.clarificationDeadline) addField('Prazo para Esclarecimentos', deadlines.clarificationDeadline);
  if (deadlines.contractTerm) addField('Prazo do Contrato', deadlines.contractTerm);

  // ---------- 2. RESUMO EXECUTIVO ----------
  if (resumoExecutivo) {
    addSectionTitle('2. Resumo Executivo');
    addBodyText(resumoExecutivo, { align: 'justify' });
  }

  // ---------- 3. RECOMENDAÇÃO ----------
  if (recomendacao) {
    addSectionTitle('3. Recomendação');
    const scoreText = scoreAderencia != null ? ` (Aderência: ${scoreAderencia}%)` : '';
    const recLabels = { GO: 'GO — Recomendado', GO_COM_RESSALVAS: 'GO com Ressalvas', NO_GO: 'NO GO — Não Recomendado' };
    const label = recLabels[recomendacao] || recomendacao;
    doc.fontSize(11).font('Helvetica-Bold');
    if (recomendacao === 'GO') doc.fillColor('#16a34a');
    else if (recomendacao === 'NO_GO') doc.fillColor('#dc2626');
    else doc.fillColor('#ea580c');
    doc.text(`${label}${scoreText}`);
    doc.fillColor('#333333');
  }

  // ---------- 4. PONTOS-CHAVE ----------
  if (pontosChave.length > 0) {
    addSectionTitle('4. Pontos-Chave');
    addBulletList(pontosChave);
  }

  // ---------- 5. RISCOS ----------
  if (riscos.length > 0) {
    addSectionTitle('5. Riscos');
    addBulletList(riscos);
  }

  // ---------- 6. OPORTUNIDADES ----------
  if (oportunidades.length > 0) {
    addSectionTitle('6. Oportunidades');
    addBulletList(oportunidades);
  }

  // ---------- 7. PRÓXIMAS AÇÕES ----------
  if (proximasAcoes.length > 0) {
    addSectionTitle('7. Próximas Ações');
    addBulletList(proximasAcoes);
  }

  // ---------- 8. CHECKLIST DOCUMENTAÇÃO ----------
  if (checklistDocumentacao.length > 0) {
    addSectionTitle('8. Checklist de Documentação');
    checklistDocumentacao.forEach((item) => {
      const i = typeof item === 'string' ? { item, status: 'pendente', details: '' } : item;
      const statusLabels = { ok: '✓ OK', em_andamento: '⟳ Em andamento', pendente: '○ Pendente' };
      const statusLabel = statusLabels[i.status] || i.status || '—';
      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      doc.text(`  •  ${i.item || '—'}  [${statusLabel}]`);
      if (i.details) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666');
        doc.text(`       ${i.details}`, { indent: 10 });
      }
    });
  }

  // ---------- 9. ITENS (Edital) ----------
  if (!isTr && items.length > 0) {
    addSectionTitle('9. Itens / Lotes');
    items.forEach((item) => {
      const name = item.name || item.item || '—';
      const qty = item.quantity || item.quantidade || '—';
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
      doc.text(`  ${name}`);
      doc.fontSize(8).font('Helvetica').fillColor('#555555');
      doc.text(`     Quantidade: ${qty}`, { indent: 10 });
      const specs = item.specs || item.especificacoes || '';
      if (specs) doc.text(`     Especificações: ${specs}`, { indent: 10 });
    });
  }

  // ---------- 9. TR: ANÁLISE TÉCNICA ----------
  if (isTr) {
    if (trSummary) {
      addSectionTitle('9. Resumo do TR');
      addBodyText(trSummary, { align: 'justify' });
    }

    if (analyzedModel && analyzedModel.modelName) {
      addSectionTitle('10. Modelo Analisado');
      addField('Modelo', analyzedModel.modelName);
      if (analyzedModel.manufacturer) addField('Fabricante', analyzedModel.manufacturer);
      if (analyzedModel.providedSpecs) addField('Especificações Informadas', analyzedModel.providedSpecs);
    }

    if (complianceOverview && complianceOverview.totalRequirements > 0) {
      addSectionTitle('11. Visão Geral de Conformidade');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
      doc.text(`Requisitos Atendidos: ${complianceOverview.metRequirements} / ${complianceOverview.totalRequirements}`);
      const pct = complianceOverview.totalRequirements > 0
        ? Math.round((complianceOverview.metRequirements / complianceOverview.totalRequirements) * 100)
        : 0;
      doc.fontSize(9).font('Helvetica').fillColor('#555555');
      doc.text(`Conformidade: ${pct}%`);
      doc.fontSize(9).font('Helvetica-Bold');
      if (complianceOverview.fullCompliance) {
        doc.fillColor('#16a34a').text('Status: Totalmente em conformidade');
      } else {
        doc.fillColor('#ea580c').text('Status: Parcialmente em conformidade');
      }
      doc.fillColor('#333333');
    }

    if (technicalNotebook.length > 0) {
      addSectionTitle('12. Caderno Técnico');
      technicalNotebook.forEach((row) => {
        if (!row || !row.termRequirement) return;
        const statusIcon = row.meetsRequirement === 'ATENDE' ? '✓' : '✗';
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
        doc.text(`  ${statusIcon}  ${row.termRequirement}`);
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#555555');
        if (row.datasheetEvidence) doc.text(`     Evidência: ${row.datasheetEvidence}`, { indent: 10 });
        if (row.rationale) doc.text(`     Justificativa: ${row.rationale}`, { indent: 10 });
      });
    }

    if (compliantEquipment.length > 0) {
      addSectionTitle('13. Equipamentos Conformes');
      compliantEquipment.forEach((eq) => {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
        doc.text(`  •  ${eq.model || eq.modelName || '—'}`);
        doc.fontSize(8).font('Helvetica').fillColor('#555555');
        if (eq.manufacturer) doc.text(`     Fabricante: ${eq.manufacturer}`, { indent: 10 });
        if (eq.rationale) doc.text(`     ${eq.rationale}`, { indent: 10 });
      });
    }

    if (termRequirements.length > 0) {
      addSectionTitle('14. Requisitos do TR');
      addBulletList(termRequirements);
    }
  }

  // ---------- 10. EXIGÊNCIAS (Edital) ----------
  if (!isTr) {
    const hasReqs = requirements.legal?.length > 0 || requirements.technical?.length > 0
      || requirements.economic?.length > 0 || requirements.fiscal?.length > 0;
    if (hasReqs) {
      addSectionTitle('10. Exigências');
      const reqLabels = { legal: 'Jurídicas', technical: 'Técnicas', economic: 'Econômicas', fiscal: 'Fiscais' };
      Object.entries(reqLabels).forEach(([key, label]) => {
        const reqs = requirements[key] || [];
        if (reqs.length > 0) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a365d');
          doc.text(`  ${label}:`);
          addBulletList(reqs);
        }
      });
    }
  }

  // ---------- FOOTER ----------
  doc.moveDown(2);
  doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(7).font('Helvetica').fillColor('#999999');
  doc.text(`Documento gerado em ${now} pelo Nexos B2G.`, { align: 'center' });

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(doc._pdfBase64));
    doc.on('error', reject);
    doc.end();
  });
};

const buildListWhere = (scope) => {
  if (scope.role === 'master') return {};
  if (scope.role === 'admin') return { companyId: scope.companyId };
  return {
    companyId: scope.companyId,
    createdByUserId: scope.userId
  };
};

router.get('/saved', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const records = await prisma.savedAnalysis.findMany({
      where: buildListWhere(scope),
      orderBy: [{ createdAt: 'desc' }]
    });

    return res.json(records);
  } catch (error) {
    console.error('Erro ao listar análises salvas:', error);
    const message = error instanceof Error ? error.message : 'Falha ao listar resumos salvos.';
    return res.status(500).json({ message });
  }
});

router.get('/saved/:id', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ message: 'Id obrigatorio.' });
    }

    const record = await prisma.savedAnalysis.findUnique({ where: { id } });
    if (!record || !hasAccess(record, scope)) {
      return res.status(404).json({ message: 'Registro nao encontrado.' });
    }

    return res.json(record);
  } catch (error) {
    console.error('Erro ao carregar análise salva:', error);
    const message = error instanceof Error ? error.message : 'Falha ao carregar resumo salvo.';
    return res.status(500).json({ message });
  }
});

router.post('/saved', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const parsed = parseSavePayload(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    let pdfDataUri = parsed.summaryPdfDataUri;
    if (!pdfDataUri && parsed.extractedData) {
      try {
        pdfDataUri = await generateAnalysisPdf(parsed.extractedData, parsed.fileName);
      } catch (pdfErr) {
        console.error('Erro ao gerar PDF:', pdfErr);
      }
    }

    const existing = await prisma.savedAnalysis.findFirst({
      where: {
        companyId: scope.companyId,
        analysisId: parsed.analysisId
      }
    });

    if (existing) {
      if (!hasAccess(existing, scope)) {
        return res.status(403).json({ message: 'Sem permissao para atualizar este registro.' });
      }

      const updated = await prisma.savedAnalysis.update({
        where: { id: existing.id },
        data: {
          fileName: parsed.fileName,
          processedAt: parsed.processedAt,
          extractedData: parsed.extractedData,
          originalFileDataUri: parsed.originalFileDataUri,
          summaryPdfDataUri: pdfDataUri
        }
      });

      return res.json(updated);
    }

    const created = await prisma.savedAnalysis.create({
      data: {
        analysisId: parsed.analysisId,
        companyId: scope.companyId,
        createdByUserId: scope.userId,
        fileName: parsed.fileName,
        processedAt: parsed.processedAt,
        extractedData: parsed.extractedData,
        originalFileDataUri: parsed.originalFileDataUri,
        summaryPdfDataUri: pdfDataUri
      }
    });

    return res.json(created);
  } catch (error) {
    console.error('Erro ao salvar análise:', error);
    const message = error instanceof Error ? error.message : 'Falha ao salvar resumo.';
    return res.status(500).json({ message });
  }
});

router.delete('/saved/:id', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ message: 'Id obrigatorio.' });
    }

    const record = await prisma.savedAnalysis.findUnique({ where: { id } });
    if (!record || !hasAccess(record, scope)) {
      return res.status(404).json({ message: 'Registro nao encontrado.' });
    }

    await prisma.savedAnalysis.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao remover análise salva:', error);
    const message = error instanceof Error ? error.message : 'Falha ao remover resumo salvo.';
    return res.status(500).json({ message });
  }
});

module.exports = router;
