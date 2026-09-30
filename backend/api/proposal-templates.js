const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../lib/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Listar templates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active = 'true' } = req.query;
    
    const where = {};
    if (active === 'true') {
      where.isActive = true;
    }

    const templates = await prisma.proposalTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });
    
    res.json(templates);
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar template por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const template = await prisma.proposalTemplate.findUnique({
      where: { id },
      include: {
        proposals: {
          select: { id: true, number: true, title: true }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    res.json(template);
  } catch (error) {
    console.error('Erro ao buscar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar template
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      isDefault,
      coverEnabled,
      coverTitle,
      coverSubtitle,
      coverLogo,
      coverBackground,
      headerEnabled,
      headerLogo,
      headerText,
      headerHeight,
      footerEnabled,
      footerText,
      footerLogo,
      footerHeight,
      indexEnabled,
      indexTitle,
      sections,
      primaryColor,
      secondaryColor,
      fontFamily,
      fontSize,
      pageMargins,
      pageSize,
      pageOrientation
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome do template é obrigatório' });
    }

    // Se for definido como padrão, remover padrão dos outros
    if (isDefault) {
      await prisma.proposalTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const template = await prisma.proposalTemplate.create({
      data: {
        name,
        description,
        isDefault: isDefault || false,
        coverEnabled: coverEnabled !== undefined ? coverEnabled : true,
        coverTitle,
        coverSubtitle,
        coverLogo,
        coverBackground,
        headerEnabled: headerEnabled !== undefined ? headerEnabled : true,
        headerLogo,
        headerText,
        headerHeight: headerHeight || 80,
        footerEnabled: footerEnabled !== undefined ? footerEnabled : true,
        footerText,
        footerLogo,
        footerHeight: footerHeight || 60,
        indexEnabled: indexEnabled !== undefined ? indexEnabled : true,
        indexTitle: indexTitle || 'Índice',
        sections: sections || [
          { id: 'company', title: 'Informações da Empresa', enabled: true, order: 1 },
          { id: 'proposal', title: 'Detalhes da Proposta', enabled: true, order: 2 },
          { id: 'items', title: 'Itens da Proposta', enabled: true, order: 3 },
          { id: 'terms', title: 'Termos e Condições', enabled: true, order: 4 },
          { id: 'signature', title: 'Assinatura', enabled: true, order: 5 }
        ],
        primaryColor: primaryColor || '#3B82F6',
        secondaryColor: secondaryColor || '#64748B',
        fontFamily: fontFamily || 'Inter',
        fontSize: fontSize || 12,
        pageMargins: pageMargins || { top: 40, right: 40, bottom: 40, left: 40 },
        pageSize: pageSize || 'A4',
        pageOrientation: pageOrientation || 'portrait'
      }
    });
    
    res.status(201).json(template);
  } catch (error) {
    console.error('Erro ao criar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar template
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar se template existe
    const existingTemplate = await prisma.proposalTemplate.findUnique({
      where: { id }
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    // Se for definido como padrão, remover padrão dos outros
    if (updateData.isDefault) {
      await prisma.proposalTemplate.updateMany({
        where: { 
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    const template = await prisma.proposalTemplate.update({
      where: { id },
      data: updateData
    });
    
    res.json(template);
  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar template
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se template existe
    const template = await prisma.proposalTemplate.findUnique({
      where: { id },
      include: {
        proposals: true
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    // Não permitir deletar template padrão
    if (template.isDefault) {
      return res.status(400).json({ error: 'Não é possível deletar o template padrão' });
    }

    // Não permitir deletar se houver propostas usando o template
    if (template.proposals.length > 0) {
      return res.status(400).json({ 
        error: `Não é possível deletar. Existem ${template.proposals.length} proposta(s) usando este template` 
      });
    }

    await prisma.proposalTemplate.delete({
      where: { id }
    });

    res.json({ message: 'Template deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Duplicar template
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const originalTemplate = await prisma.proposalTemplate.findUnique({
      where: { id }
    });

    if (!originalTemplate) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    const { id: _, createdAt, updatedAt, proposals, ...templateData } = originalTemplate;

    const duplicatedTemplate = await prisma.proposalTemplate.create({
      data: {
        ...templateData,
        name: name || `${originalTemplate.name} (Cópia)`,
        isDefault: false
      }
    });

    res.status(201).json(duplicatedTemplate);
  } catch (error) {
    console.error('Erro ao duplicar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Definir como padrão
router.post('/:id/set-default', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Remover padrão de todos os templates
    await prisma.proposalTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });

    // Definir o template atual como padrão
    const template = await prisma.proposalTemplate.update({
      where: { id },
      data: { isDefault: true }
    });

    res.json(template);
  } catch (error) {
    console.error('Erro ao definir template padrão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;