const express = require('express');
const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { contractScope, normalizeContract, LIVE_STATUSES } = require('./contract-service.cjs');
const { opportunityDocumentWhere, opportunityModuleAllowed } = require('./company-documents-router.cjs');
const companySelect = { id: true, name: true, document: true, accountManagerId: true, accountManagerName: true };
const attachmentSelect = { id: true, filename: true, originalName: true, mimeType: true, size: true, createdAt: true };
const include = { company: { select: companySelect }, opportunity: { select: { id: true, number: true, title: true } }, attachments: { select: attachmentSelect } };
function createContractsRouter({ prisma, authenticateToken, uploadDir }) {
  const router = express.Router();
  router.use(authenticateToken);
  router.use((req, res, next) => {
    // Permite acesso se tiver accessContracts ou accessManagement
    const hasAccess = String(req.user.actualRole || req.user.role).toUpperCase() === 'MASTER' || 
                      req.user.accessContracts || 
                      req.user.accessManagement;
    if (!hasAccess) return res.status(403).json({ error: 'Acesso negado ao módulo de Contratos.' });
    next();
  });
  const visible = (user, id) => prisma.contract.findFirst({ where: { id, ...contractScope(user) }, include });
  async function link(user, companyId, opportunityId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, ...contractScope(user).AND[0].company }, select: { id: true, tenantCompanyId: true } });
    if (!company) return false;
    if (!opportunityId) return true;
    const opportunity = await prisma.opportunity.findFirst({ where: { ...opportunityDocumentWhere(user), id: opportunityId, companyId, tenantCompanyId: company.tenantCompanyId }, include: { company: { select: { clientType: true, segment: true } } } });
    return opportunity && opportunityModuleAllowed(user, opportunity);
  }
  router.get('/reports/summary', async (req, res, next) => {
    try {
      const where = { ...contractScope(req.user), ...(req.query.companyId ? { companyId: req.query.companyId } : {}) };
      const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const today = new Date(day + 'T00:00:00Z'); const until = new Date(today); until.setUTCDate(until.getUTCDate() + 30);
      const [totalContracts, activeContracts, totalValue, expiringSoon] = await Promise.all([
        prisma.contract.count({ where }), prisma.contract.count({ where: { ...where, status: { in: LIVE_STATUSES } } }),
        prisma.contract.aggregate({ where, _sum: { value: true } }),
        prisma.contract.count({ where: { ...where, status: { in: LIVE_STATUSES }, endDate: { gte: today, lte: until } } })
      ]);
      res.json({ totalContracts, activeContracts, totalValue: totalValue._sum.value || 0, expiringSoon });
    } catch (error) { next(error); }
  });
  router.get('/', async (req, res, next) => {
    try {
      const where = { ...contractScope(req.user), ...(req.query.status ? { status: req.query.status } : {}), ...(req.query.companyId ? { companyId: req.query.companyId } : {}) };
      const pagination = req.query.page || req.query.limit ? { take: Math.max(1, Math.min(200, parseInt(req.query.limit) || 50)), skip: Math.max(0, (parseInt(req.query.page) || 1) - 1) * Math.max(1, Math.min(200, parseInt(req.query.limit) || 50)) } : {};
      res.json(await prisma.contract.findMany({ where, include: { company: include.company, opportunity: include.opportunity, _count: { select: { attachments: true } } }, orderBy: { createdAt: 'desc' }, ...pagination }));
    } catch (error) { next(error); }
  });
  router.get('/:id', async (req, res, next) => {
    try {
      const contract = await visible(req.user, req.params.id);
      if (!contract) return res.status(404).json({ error: 'Contrato não encontrado ou acesso negado.' });
      res.json(contract);
    } catch (error) { next(error); }
  });
  router.post('/', async (req, res, next) => {
    try {
      const body = req.body || {};
      if (!body.companyId || !await link(req.user, body.companyId, body.opportunityId)) return res.status(403).json({ error: 'Empresa ou oportunidade indisponível para este usuário.' });
      const result = normalizeContract({ status: 'DRAFT', value: 0, ...body });
      if (result.error) return res.status(400).json({ error: result.error });
      res.status(201).json(await prisma.contract.create({ data: { ...result.data, companyId: body.companyId, opportunityId: body.opportunityId || null }, include }));
    } catch (error) { next(error); }
  });
  router.put('/:id', async (req, res, next) => {
    try {
      const existing = await visible(req.user, req.params.id);
      if (!existing) return res.status(404).json({ error: 'Contrato não encontrado ou acesso negado.' });
      const body = req.body || {};
      const companyId = body.companyId || existing.companyId;
      const opportunityId = body.opportunityId === undefined ? existing.opportunityId : body.opportunityId || null;
      if (existing.sourceDocumentId && (companyId !== existing.companyId || opportunityId !== existing.opportunityId)) return res.status(400).json({ error: 'A cópia mantém a empresa e a oportunidade de origem.' });
      if (!await link(req.user, companyId, opportunityId)) return res.status(403).json({ error: 'Empresa ou oportunidade indisponível para este usuário.' });
      const result = normalizeContract(body, existing);
      if (result.error) return res.status(400).json({ error: result.error });
      res.json(await prisma.contract.update({ where: { id: existing.id }, data: { ...result.data, companyId, opportunityId }, include }));
    } catch (error) { next(error); }
  });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => fs.mkdir(uploadDir, { recursive: true }).then(() => cb(null, uploadDir), cb),
    filename: (_req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname).toLowerCase())
  });
  const types = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
  const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(types[path.extname(file.originalname).toLowerCase()] === file.mimetype ? null : new Error('Tipo de arquivo inválido.'), true) }).single('file');
  router.post('/:id/upload', async (req, res, next) => {
    try {
      if (!await visible(req.user, req.params.id)) return res.status(404).json({ error: 'Contrato não encontrado ou acesso negado.' });
      upload(req, res, async error => {
        if (error) return res.status(400).json({ error: 'Arquivo inválido. Limite de 10 MB.' });
        if (!req.file) return res.status(400).json({ error: 'Selecione um arquivo.' });
        try {
          const file = req.file;
          res.status(201).json(await prisma.contractAttachment.create({ data: { contractId: req.params.id, filename: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size, path: file.path }, select: attachmentSelect }));
        } catch (cause) { await fs.unlink(req.file.path).catch(() => {}); next(cause); }
      });
    } catch (error) { next(error); }
  });
  async function attachmentAccess(req, res, next) {
    try {
      const attachment = await prisma.contractAttachment.findUnique({ where: { id: req.params.attachmentId } });
      if (!attachment || !await visible(req.user, attachment.contractId)) return res.status(404).json({ error: 'Arquivo não encontrado ou acesso negado.' });
      req.contractAttachment = attachment; next();
    } catch (error) { next(error); }
  }
  router.get('/attachment/:attachmentId/download', attachmentAccess, (req, res, next) => {
    res.download(req.contractAttachment.path, req.contractAttachment.originalName, error => {
      if (error && !res.headersSent) error.code === 'ENOENT' ? res.status(404).json({ error: 'Arquivo não encontrado.' }) : next(error);
    });
  });
  router.delete('/attachment/:attachmentId', attachmentAccess, async (req, res, next) => {
    try {
      await prisma.contractAttachment.delete({ where: { id: req.params.attachmentId } });
      await fs.unlink(req.contractAttachment.path).catch(error => { if (error.code !== 'ENOENT') console.warn('Contrato: arquivo pendente de limpeza.'); });
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 'P2002') return res.status(409).json({ error: 'Já existe um contrato com esse número.' });
    console.error('Contratos:', error.message);
    res.status(500).json({ error: 'Não foi possível concluir a operação do contrato.' });
  });
  return router;
}
module.exports = { createContractsRouter };
