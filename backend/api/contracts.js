const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../lib/auth');
const { getTenantCompanyId, mergeRelationWhere } = require('../lib/tenantScope.cjs');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/contracts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    // Permitir apenas certos tipos de arquivo
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

const router = express.Router();
const prisma = new PrismaClient();

const scopeContractWhere = (req, where = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  return tenantCompanyId ? mergeRelationWhere(where, 'company', { tenantCompanyId }) : where;
};

const canAccessCompany = (req, company = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  if (!tenantCompanyId) return true;
  return String(company?.tenantCompanyId || '') === tenantCompanyId;
};

const canAccessContract = (req, contract = {}) => {
  if (!contract) return false;
  if (contract.company) return canAccessCompany(req, contract.company);
  const tenantCompanyId = getTenantCompanyId(req.user);
  return !tenantCompanyId;
};

// Relatório resumido de contratos
router.get('/reports/summary', authenticateToken, async (req, res) => {
  try {
    const { status, companyId, startDate, endDate } = req.query;

    let where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    where = scopeContractWhere(req, where);

    const [totalContracts, activeContracts, totalValue] = await Promise.all([
      prisma.contract.count({ where }),
      prisma.contract.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.contract.aggregate({
        where,
        _sum: { value: true }
      })
    ]);

    res.json({
      totalContracts,
      activeContracts,
      totalValue: totalValue._sum.value || 0
    });
  } catch (error) {
    console.error('Erro ao gerar resumo de contratos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar contratos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, companyId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    where = scopeContractWhere(req, where);

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true, tenantCompanyId: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.contract.count({ where })
    ]);

    res.json(contracts);
  } catch (error) {
    console.error('Erro ao listar contratos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar contrato por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true, document: true, tenantCompanyId: true }
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
            createdAt: true
          }
        }
      }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }

    if (!canAccessContract(req, contract)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json(contract);
  } catch (error) {
    console.error('Erro ao buscar contrato:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar contrato
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      number, 
      title, 
      description, 
      value, 
      startDate, 
      endDate, 
      status,
      companyId,
      slaResponseTime,
      slaResolutionTime,
      slaAvailability,
      slaDescription
    } = req.body;

    if (!number || !title || !value || !startDate || !endDate || !companyId) {
      return res.status(400).json({ 
        error: 'Número, título, valor, datas e empresa são obrigatórios' 
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantCompanyId: true }
    });
    if (!company || !canAccessCompany(req, company)) {
      return res.status(403).json({ error: 'Empresa não pertence a este tenant' });
    }

    const contractData = {
      number,
      title,
      description,
      value: parseFloat(value),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      companyId
    };

    if (status) contractData.status = status;

    // Adicionar campos de SLA se fornecidos
    if (slaResponseTime) contractData.slaResponseTime = parseInt(slaResponseTime);
    if (slaResolutionTime) contractData.slaResolutionTime = parseInt(slaResolutionTime);
    if (slaAvailability) contractData.slaAvailability = parseFloat(slaAvailability);
    if (slaDescription) contractData.slaDescription = slaDescription;

    const contract = await prisma.contract.create({
      data: contractData,
      include: {
        company: {
          select: { id: true, name: true, document: true, tenantCompanyId: true }
        },
        attachments: true
      }
    });

    res.status(201).json(contract);
  } catch (error) {
    console.error('Erro ao criar contrato:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar contrato
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      number, 
      title, 
      description, 
      value, 
      startDate, 
      endDate, 
      status,
      slaResponseTime,
      slaResolutionTime,
      slaAvailability,
      slaDescription
    } = req.body;

    const updateData = {};
    if (number) updateData.number = number;
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (value) updateData.value = parseFloat(value);
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (status) updateData.status = status;
    
    // Campos de SLA
    if (slaResponseTime !== undefined) updateData.slaResponseTime = slaResponseTime ? parseInt(slaResponseTime) : null;
    if (slaResolutionTime !== undefined) updateData.slaResolutionTime = slaResolutionTime ? parseInt(slaResolutionTime) : null;
    if (slaAvailability !== undefined) updateData.slaAvailability = slaAvailability ? parseFloat(slaAvailability) : null;
    if (slaDescription !== undefined) updateData.slaDescription = slaDescription;

    const currentContract = await prisma.contract.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, tenantCompanyId: true }
        }
      }
    });

    if (!currentContract) {
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }

    if (!canAccessContract(req, currentContract)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const contract = await prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: { id: true, name: true, document: true, tenantCompanyId: true }
        },
        attachments: true
      }
    });

    res.json(contract);
  } catch (error) {
    console.error('Erro ao atualizar contrato:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Upload de arquivo para contrato
router.post('/:id/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    // Verificar se o contrato existe
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, tenantCompanyId: true }
        }
      }
    });

    if (!contract) {
      // Remover arquivo se contrato não existir
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Contrato não encontrado' });
    }

    if (!canAccessContract(req, contract)) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Salvar informações do arquivo no banco
    const attachment = await prisma.contractAttachment.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        contractId: id
      }
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    // Remover arquivo em caso de erro
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Download de arquivo
router.get('/attachment/:attachmentId/download', authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const attachment = await prisma.contractAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        contract: {
          include: {
            company: {
              select: { id: true, tenantCompanyId: true }
            }
          }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    if (!canAccessContract(req, attachment.contract)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Verificar se o arquivo existe no sistema de arquivos
    if (!fs.existsSync(attachment.path)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Type', attachment.mimeType);
    
    const fileStream = fs.createReadStream(attachment.path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Erro ao fazer download:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar arquivo
router.delete('/attachment/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const attachment = await prisma.contractAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        contract: {
          include: {
            company: {
              select: { id: true, tenantCompanyId: true }
            }
          }
        }
      }
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    if (!canAccessContract(req, attachment.contract)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Remover arquivo do sistema de arquivos
    if (fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    // Remover registro do banco
    await prisma.contractAttachment.delete({
      where: { id: attachmentId }
    });

    res.json({ message: 'Arquivo removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
