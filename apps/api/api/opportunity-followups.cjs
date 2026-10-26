'use strict';

const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { prisma } = require('../lib/opportunity-prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const router = express.Router();

const FOLLOW_UP_UPLOAD_DIR = path.join(__dirname, '../uploads/opportunity-followups');
const MAX_ATTACHMENTS = 5;

const ensureUploadDir = () => {
  if (!fs.existsSync(FOLLOW_UP_UPLOAD_DIR)) {
    fs.mkdirSync(FOLLOW_UP_UPLOAD_DIR, { recursive: true });
  }
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      ensureUploadDir();
      cb(null, FOLLOW_UP_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.png';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: MAX_ATTACHMENTS
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
      return cb(null, true);
    }

    return cb(new Error('Envie apenas imagens de print em JPG, PNG, WEBP ou GIF.'));
  }
});

const ensureAuthenticated = (req, res, next) => {
  if (req.user?.id || req.user?.userId) return next();
  return authenticateToken(req, res, next);
};

const getRequestUserId = (req) => req.user?.id || req.user?.userId;

const parseAttachments = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// GET /api/opportunity-followups/:opportunityId
router.get('/:opportunityId', ensureAuthenticated, async (req, res) => {
  const { opportunityId } = req.params;
  try {
    const followUps = await prisma.opportunityFollowUp.findMany({
      where: { opportunityId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(followUps);
  } catch (err) {
    console.error('Erro ao listar acompanhamentos:', err);
    return res.status(500).json({ error: 'Erro ao listar acompanhamentos' });
  }
});

// POST /api/opportunity-followups
router.post('/', ensureAuthenticated, (req, res, next) => {
  upload.array('attachments', MAX_ATTACHMENTS)(req, res, (err) => {
    if (!err) return next();
    const message = err instanceof multer.MulterError
      ? (err.code === 'LIMIT_FILE_SIZE'
        ? 'Cada print deve ter no máximo 10 MB.'
        : err.code === 'LIMIT_FILE_COUNT'
          ? `Envie no máximo ${MAX_ATTACHMENTS} prints por acompanhamento.`
          : err.message)
      : err.message;
    return res.status(400).json({ error: message || 'Erro ao enviar anexos.' });
  });
}, async (req, res) => {
  const userId = getRequestUserId(req);
  const { opportunityId, type } = req.body;
  const content = String(req.body?.content || '').trim();
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];

  if (!opportunityId || (!content && uploadedFiles.length === 0)) {
    return res.status(400).json({ error: 'Informe o acompanhamento ou anexe ao menos um print.' });
  }
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  const VALID_TYPES = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP'];
  const normalizedType = VALID_TYPES.includes(String(type || '').toUpperCase())
    ? String(type).toUpperCase()
    : 'NOTE';

  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true }
    });
    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const followUp = await prisma.opportunityFollowUp.create({
      data: {
        opportunityId,
        userId,
        type: normalizedType,
        content: content || 'Print de conversa do WhatsApp anexado.',
        attachments: uploadedFiles.length > 0
          ? JSON.stringify(uploadedFiles.map((file) => ({
            name: file.originalname,
            filename: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            url: `/uploads/opportunity-followups/${file.filename}`,
            uploadedAt: new Date().toISOString()
          })))
          : null
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json(followUp);
  } catch (err) {
    console.error('Erro ao criar acompanhamento:', err);
    return res.status(500).json({ error: 'Erro ao criar acompanhamento' });
  }
});

// DELETE /api/opportunity-followups/:id
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  const userId = getRequestUserId(req);
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  try {
    const followUp = await prisma.opportunityFollowUp.findUnique({
      where: { id }
    });

    if (!followUp) {
      return res.status(404).json({ error: 'Acompanhamento não encontrado' });
    }

    const role = String(req.user?.actualRole || req.user?.role || '').toUpperCase();
    const isAdminOrMaster = ['ADMIN', 'MASTER'].includes(role);
    const isOwner = followUp.userId === userId;

    if (!isOwner && !isAdminOrMaster) {
      return res.status(403).json({ error: 'Você só pode remover seus próprios acompanhamentos' });
    }

    const attachments = parseAttachments(followUp.attachments);
    attachments.forEach((attachment) => {
      const filename = path.basename(String(attachment?.filename || attachment?.url || ''));
      if (!filename) return;
      fs.unlink(path.join(FOLLOW_UP_UPLOAD_DIR, filename), () => {});
    });

    await prisma.opportunityFollowUp.delete({ where: { id } });
    return res.json({ message: 'Acompanhamento removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover acompanhamento:', err);
    return res.status(500).json({ error: 'Erro ao remover acompanhamento' });
  }
});

module.exports = router;
