const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const { canAccessCompany, canAccessCompanyDocument } = require('../lib/access-control.cjs');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/companies');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    const extname = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(extname) && allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido'));
  }
});

// Listar documentos da empresa
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const access = await canAccessCompany(prisma, req.user, id);

    if (access.missing) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    if (!access.allowed) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const documents = await prisma.companyDocument.findMany({
      where: { companyId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true
      }
    });

    res.json(documents);
  } catch (error) {
    console.error('Erro ao listar documentos da empresa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Upload de documento para empresa
router.post('/:id/documents', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const access = await canAccessCompany(prisma, req.user, id);

    if (access.missing) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    if (!access.allowed) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const document = await prisma.companyDocument.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        companyId: id
      }
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Erro ao fazer upload de documento:', error);
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Download de documento
router.get('/document/:documentId/download', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    const access = await canAccessCompanyDocument(prisma, req.user, documentId);

    if (access.missing) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    if (!access.allowed) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { document } = access;

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', document.mimeType);

    const fileStream = fs.createReadStream(document.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Erro ao fazer download do documento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar documento
router.delete('/document/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    const access = await canAccessCompanyDocument(prisma, req.user, documentId);

    if (access.missing) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    if (!access.allowed) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { document } = access;

    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    await prisma.companyDocument.delete({
      where: { id: documentId }
    });

    res.json({ message: 'Arquivo removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar documento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
