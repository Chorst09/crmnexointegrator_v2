const { prepareContractCopy, createCopiedContract } = require('./contract-copy.cjs');
const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

const opportunitySelect = {
  id: true, companyId: true, tenantCompanyId: true, ownerId: true,
  number: true, title: true, projectName: true, stage: true,
  projectClientType: true, b2gStage: true, source: true, description: true,
  company: { select: { clientType: true, segment: true } }
};
const documentSelect = {
  id: true, originalName: true, mimeType: true, size: true, createdAt: true,
  documentType: true, opportunityId: true, opportunity: { select: opportunitySelect }
};
const normalizeRole = user => String(user.actualRole || user.role || '').trim().toUpperCase();
const opportunityDocumentWhere = user => {
  const role = normalizeRole(user);
  const where = {};
  if (role !== 'MASTER' && user.tenantCompanyId) where.tenantCompanyId = user.tenantCompanyId;
  if (!['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(role)) {
    if (!(user.userId || user.id)) return { ownerId: { in: [] } };
    where.ownerId = user.userId || user.id;
  }
  if (!['carlos.horst@doubletelecom.com.br', 'chorstconsult@gmail.com'].includes(String(user.email || '').trim().toLowerCase())) {
    const privateOwnerId = '0135bec0-498b-450b-86f6-c2a714014f3f';
    if (where.ownerId === privateOwnerId) return { ownerId: { in: [] } };
    if (!where.ownerId) where.ownerId = { not: privateOwnerId };
    where.owner = { email: { not: 'chorstconsult@gmail.com' } };
  }
  return where;
};
const opportunityModuleAllowed = (user, opportunity) => {
  const signals = /\bB2G\b|\bGOVERNO\b|\bGOV\b|\bLICIT|\bEDITA(?:L|IS)\b|TERMO DE REFER[ÊE]NCIA/i;
  let structuredGovernmentDescription = false;
  try {
    const description = JSON.parse(opportunity.description || '{}');
    structuredGovernmentDescription = Boolean(description?.noticeId || description?.numeroEdital || description?.orgaoEntidade || description?.faseAtual || description?.modalidade);
  } catch { /* Descriptions can be plain text. */ }
  const government = String(opportunity.number || '').toUpperCase().startsWith('B2G-') ||
    opportunity.projectClientType === 'B2G' || Boolean(opportunity.b2gStage) ||
    signals.test(opportunity.source || '') || signals.test(opportunity.description || '') || structuredGovernmentDescription ||
    opportunity.company?.clientType === 'B2G' || (!opportunity.company?.clientType && signals.test(opportunity.company?.segment || ''));
  return Boolean(government ? user.accessB2G : user.accessB2B);
};
const publicDocument = document => ({
  id: document.id, originalName: document.originalName, mimeType: document.mimeType,
  size: document.size, createdAt: document.createdAt, documentType: document.documentType,
  opportunityId: document.opportunityId,
  opportunity: document.opportunity ? Object.fromEntries(['id', 'number', 'title', 'projectName', 'stage'].map(key => [key, document.opportunity[key]])) : null
});

// Both entry points use the same records and files. The company endpoint remains
// compatible with older tabs; new uploads originate from the opportunity URL.
function createCompanyDocumentsRouter({ prisma, authenticateToken, canViewCompany, uploadDir, opportunityMode = false, contractUploadDir = path.join(uploadDir, 'contract-copies') }) {
  const router = express.Router();
  const readOpportunity = async (user, id, extra = {}) => {
    const opportunity = await prisma.opportunity.findFirst({
      where: { ...opportunityDocumentWhere(user), ...extra, id }, select: opportunitySelect
    });
    return opportunity && opportunityModuleAllowed(user, opportunity) ? opportunity : null;
  };
  const removeFile = async file => {
    if (file?.path) await fs.unlink(file.path).catch(error => {
      if (error.code !== 'ENOENT') console.error('Erro ao remover anexo:', error.message);
    });
  };
  const storage = multer.diskStorage({
    destination: (req, file, callback) => fs.mkdir(uploadDir, { recursive: true }).then(() => callback(null, uploadDir), callback),
    filename: (req, file, callback) => callback(null, randomUUID() + path.extname(file.originalname).toLowerCase())
  });
  const upload = multer({
    storage, limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2, fieldSize: 256 },
    fileFilter: (req, file, callback) => {
      const types = {
        '.pdf': ['application/pdf'], '.doc': ['application/msword'],
        '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        '.xls': ['application/vnd.ms-excel'], '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        '.txt': ['text/plain'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'], '.gif': ['image/gif']
      };
      callback(types[path.extname(file.originalname).toLowerCase()]?.includes(file.mimetype) ? null : new Error('Tipo de arquivo não permitido'), true);
    }
  }).single('file');
  const scopeAccess = async (req, res, next) => {
    try {
      if (opportunityMode) {
        const opportunity = await readOpportunity(req.user, req.params.id);
        if (!opportunity) return res.status(403).json({ error: 'Oportunidade indisponível para este usuário' });
        req.documentOpportunity = opportunity;
        req.documentCompany = { id: opportunity.companyId, tenantCompanyId: opportunity.tenantCompanyId };
      } else {
        const company = await prisma.company.findUnique({ where: { id: req.params.id }, select: { id: true, tenantCompanyId: true } });
        if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
        if (!await canViewCompany(prisma, req.user, company.id)) return res.status(403).json({ error: 'Acesso negado' });
        req.documentCompany = company;
      }
      next();
    } catch (error) { next(error); }
  };
  const documentAccess = async (req, res, next) => {
    try {
      const document = await prisma.companyDocument.findUnique({ where: { id: req.params.documentId } });
      if (!document) return res.status(404).json({ error: 'Documento não encontrado' });
      const allowed = document.opportunityId
        ? await readOpportunity(req.user, document.opportunityId, { companyId: document.companyId })
        : await canViewCompany(prisma, req.user, document.companyId);
      if (!allowed) return res.status(403).json({ error: 'Acesso negado' });
      req.companyDocument = document;
      next();
    } catch (error) { next(error); }
  };
  if (!opportunityMode) router.get('/:id/document-opportunities', authenticateToken, scopeAccess, async (req, res, next) => {
    try {
      const opportunities = await prisma.opportunity.findMany({
        where: { ...opportunityDocumentWhere(req.user), companyId: req.params.id, tenantCompanyId: req.documentCompany.tenantCompanyId },
        select: opportunitySelect, orderBy: { createdAt: 'desc' }
      });
      res.json(opportunities.filter(opportunity => opportunityModuleAllowed(req.user, opportunity))
        .map(opportunity => publicDocument({ opportunity }).opportunity));
    } catch (error) { next(error); }
  });
  router.get('/:id/documents', authenticateToken, scopeAccess, async (req, res, next) => {
    try {
      const documentType = req.query.documentType;
      if (documentType && !['CONTRACT', 'DOCUMENT'].includes(documentType)) return res.status(400).json({ error: 'Tipo de documento inválido' });
      const where = { companyId: req.documentCompany.id, ...(documentType ? { documentType } : {}) };
      if (opportunityMode) where.opportunityId = req.documentOpportunity.id;
      else where.OR = [{ opportunityId: null }, { opportunity: opportunityDocumentWhere(req.user) }];
      const documents = await prisma.companyDocument.findMany({ where, select: documentSelect, orderBy: { createdAt: 'desc' } });
      res.json(documents.filter(document => !document.opportunity || opportunityModuleAllowed(req.user, document.opportunity)).map(publicDocument));
    } catch (error) { next(error); }
  });
  router.post('/:id/documents', authenticateToken, scopeAccess, (req, res, next) => {
    upload(req, res, async error => {
      if (error) {
        await removeFile(req.file);
        return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'O arquivo deve ter no máximo 10 MB' : 'Arquivo inválido ou tipo não permitido' });
      }
      next();
    });
  }, async (req, res, next) => {
    let contractCopy;
    try {
      if (!req.file) return res.status(400).json({ error: 'Selecione um arquivo' });
      const submittedId = typeof req.body.opportunityId === 'string' ? req.body.opportunityId.trim() : '';
      const opportunityId = opportunityMode ? req.documentOpportunity.id : submittedId;
      const documentType = req.body.documentType || (opportunityMode ? '' : 'DOCUMENT');
      if (!opportunityId || !['CONTRACT', 'DOCUMENT'].includes(documentType) || (opportunityMode && submittedId && submittedId !== opportunityId)) {
        await removeFile(req.file);
        return res.status(400).json({ error: !opportunityId ? 'Informe a oportunidade à qual o arquivo pertence' : 'Tipo ou vínculo de documento inválido' });
      }
      const opportunity = opportunityMode ? req.documentOpportunity : await readOpportunity(req.user, opportunityId, {
        companyId: req.documentCompany.id, tenantCompanyId: req.documentCompany.tenantCompanyId
      });
      if (!opportunity) {
        await removeFile(req.file);
        return res.status(400).json({ error: 'Selecione uma oportunidade desta empresa disponível para seu usuário' });
      }
      const saveDocument = db => db.companyDocument.create({
        data: {
          filename: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype,
          size: req.file.size, path: req.file.path, companyId: opportunity.companyId, opportunityId, documentType
        }, select: documentSelect
      });
      let document;
      let contract;
      if (documentType === 'CONTRACT') {
        contractCopy = await prepareContractCopy(req.file, contractUploadDir);
        ({ document, contract } = await prisma.$transaction(async db => {
          const document = await saveDocument(db);
          const contract = await createCopiedContract(db, document, opportunity, contractCopy);
          return { document, contract };
        }));
      } else document = await saveDocument(prisma);
      res.status(201).json({ ...publicDocument(document), ...(contract ? { contractId: contract.id } : {}) });
    } catch (error) { await removeFile(contractCopy); await removeFile(req.file); next(error); }
  });
  router.get('/document/:documentId/download', authenticateToken, documentAccess, (req, res, next) => {
    const document = req.companyDocument;
    res.download(document.path, document.originalName, error => {
      if (error && !res.headersSent) {
        if (error.code === 'ENOENT') return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
        next(error);
      }
    });
  });
  router.delete('/document/:documentId', authenticateToken, documentAccess, async (req, res, next) => {
    try {
      await prisma.companyDocument.delete({ where: { id: req.params.documentId } });
      await removeFile(req.companyDocument);
      res.json({ message: 'Arquivo removido com sucesso' });
    } catch (error) { next(error); }
  });
  router.use((error, req, res, next) => {
    console.error('Erro em anexos da oportunidade:', error.message);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Não foi possível concluir a operação com o arquivo' });
  });
  return router;
}

module.exports = { createCompanyDocumentsRouter, opportunityDocumentWhere, opportunityModuleAllowed };
