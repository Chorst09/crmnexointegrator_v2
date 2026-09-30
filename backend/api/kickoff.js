const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../lib/auth');
const { getTenantCompanyId, mergeRelationWhere } = require('../lib/tenantScope.cjs');

const router = express.Router();
const prisma = new PrismaClient();

// ===== HELPERS =====

const MEETING_INCLUDE = {
  opportunity: {
    select: { id: true, number: true, title: true, value: true, stage: true, projectType: true, projectMonths: true }
  },
  company: {
    select: { id: true, name: true, document: true, segment: true, clientType: true, tenantCompanyId: true }
  },
  owner: {
    select: { id: true, name: true, email: true }
  },
  template: {
    select: { id: true, name: true, phase: true }
  },
  participants: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true, position: true } }
    },
    orderBy: { createdAt: 'asc' }
  },
  agendaItems: {
    orderBy: { order: 'asc' }
  },
  checklistItems: {
    include: {
      completedBy: { select: { id: true, name: true } }
    },
    orderBy: { order: 'asc' }
  },
  actionItems: {
    include: {
      assignee: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  },
  history: {
    include: {
      user: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  }
};

const buildHistoryEntry = (eventType, title, description = null, data = null, userId = null, meetingId = null) => {
  const entry = { eventType, title, description, data };
  if (userId) entry.user = { connect: { id: userId } };
  if (meetingId) entry.meeting = { connect: { id: meetingId } };
  return entry;
};

const parseDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const scopeMeetingWhere = (req, where = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  let scoped = { ...where };
  if (tenantCompanyId) {
    scoped = mergeRelationWhere(scoped, 'company', { tenantCompanyId });
  } else if (req.user.role === 'SELLER') {
    scoped.ownerId = req.user.userId;
  }
  return scoped;
};

const canAccessTenantCompany = (req, company = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  if (!tenantCompanyId) return true;
  return String(company?.tenantCompanyId || '') === tenantCompanyId;
};

const canAccessMeeting = (req, meeting = {}) => {
  if (!meeting) return false;
  if (meeting.company) return canAccessTenantCompany(req, meeting.company);
  const tenantCompanyId = getTenantCompanyId(req.user);
  if (tenantCompanyId) return false;
  return req.user.role !== 'SELLER' || meeting.ownerId === req.user.userId;
};

const findAccessibleMeeting = async (req, id, include = null) => {
  const meeting = await prisma.kickoffMeeting.findUnique({
    where: { id },
    ...(include ? { include } : { include: { company: { select: { id: true, tenantCompanyId: true } } } })
  });
  if (!meeting) return { error: 'Reunião não encontrada', status: 404 };
  if (!canAccessMeeting(req, meeting)) return { error: 'Acesso negado', status: 403 };
  return { meeting };
};

// ===== TEMPLATES =====

// GET /api/kickoff/templates?phase=ENTENDIMENTO_OPORTUNIDADE
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { phase } = req.query;
    const where = { isActive: true };
    if (phase) where.phase = phase;

    const templates = await prisma.kickoffTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });

    res.json({ templates });
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/kickoff/templates
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    if (!['MASTER', 'ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { name, description, phase, agenda, checklist, isDefault } = req.body;

    if (!name || !phase) {
      return res.status(400).json({ error: 'Nome e fase são obrigatórios' });
    }

    const template = await prisma.kickoffTemplate.create({
      data: {
        name,
        description,
        phase,
        agenda: Array.isArray(agenda) ? agenda : [],
        checklist: Array.isArray(checklist) ? checklist : [],
        isDefault: Boolean(isDefault)
      }
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Erro ao criar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/kickoff/templates/:id
router.put('/templates/:id', authenticateToken, async (req, res) => {
  try {
    if (!['MASTER', 'ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { name, description, phase, agenda, checklist, isDefault, isActive } = req.body;

    const data = {};
    if (name) data.name = name;
    if (description !== undefined) data.description = description;
    if (phase) data.phase = phase;
    if (agenda !== undefined) data.agenda = agenda;
    if (checklist !== undefined) data.checklist = checklist;
    if (isDefault !== undefined) data.isDefault = Boolean(isDefault);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const template = await prisma.kickoffTemplate.update({
      where: { id },
      data
    });

    res.json(template);
  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kickoff/templates/:id
router.delete('/templates/:id', authenticateToken, async (req, res) => {
  try {
    if (!['MASTER', 'ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    await prisma.kickoffTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== REUNIÕES =====

// GET /api/kickoff/meetings?status=&phase=&opportunityId=&companyId=&search=
router.get('/meetings', authenticateToken, async (req, res) => {
  try {
    const { status, phase, opportunityId, companyId, search, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    let where = {};
    if (status) where.status = status;
    if (phase) where.phase = phase;
    if (opportunityId) where.opportunityId = opportunityId;
    if (companyId) where.companyId = companyId;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    where = scopeMeetingWhere(req, where);

    const [meetings, total] = await Promise.all([
      prisma.kickoffMeeting.findMany({
        where,
        include: {
          opportunity: { select: { id: true, number: true, title: true, value: true } },
          company: { select: { id: true, name: true, document: true, tenantCompanyId: true } },
          owner: { select: { id: true, name: true, email: true } },
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              contact: { select: { id: true, name: true, email: true, phone: true } }
            }
          },
          _count: {
            select: {
              agendaItems: true,
              checklistItems: true,
              actionItems: true,
              participants: true
            }
          }
        },
        orderBy: { scheduledDate: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.kickoffMeeting.count({ where })
    ]);

    res.json({
      meetings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar reuniões:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/kickoff/meetings/:id
router.get('/meetings/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const accessCheck = await findAccessibleMeeting(req, id, MEETING_INCLUDE);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }
    const { meeting } = accessCheck;

    res.json(meeting);
  } catch (error) {
    console.error('Erro ao buscar reunião:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/kickoff/opportunities/:id/preview
// Herda automaticamente os dados do cliente a partir da oportunidade (B2B, B2G ou Pré-vendas)
router.get('/opportunities/:id/preview', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            contacts: {
              orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }]
            }
          }
        },
        owner: { select: { id: true, name: true, email: true } },
        products: {
          include: { product: { select: { id: true, name: true } } }
        }
      }
    });

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    if (!canAccessTenantCompany(req, opportunity.company)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json({
      opportunity: {
        id: opportunity.id,
        number: opportunity.number,
        title: opportunity.title,
        value: opportunity.value,
        stage: opportunity.stage,
        projectType: opportunity.projectType,
        projectMonths: opportunity.projectMonths,
        b2gStage: opportunity.b2gStage
      },
      company: {
        id: opportunity.company.id,
        name: opportunity.company.name,
        document: opportunity.company.document,
        segment: opportunity.company.segment,
        clientType: opportunity.company.clientType
      },
      contacts: opportunity.company.contacts,
      owner: opportunity.owner,
      products: opportunity.products
    });
  } catch (error) {
    console.error('Erro ao buscar preview da oportunidade:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/kickoff/meetings
router.post('/meetings', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      phase,
      platform,
      meetingLink,
      scheduledDate,
      startTime,
      endTime,
      opportunityId,
      templateId,
      participants = [],
      agendaItems = [],
      checklistItems = []
    } = req.body;

    if (!title || !phase || !scheduledDate || !opportunityId) {
      return res.status(400).json({ error: 'Título, fase, data e oportunidade são obrigatórios' });
    }

    // Validar oportunidade e herdar companyId automaticamente
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, companyId: true, tenantCompanyId: true }
    });

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const tenantCompanyId = getTenantCompanyId(req.user);
    if (tenantCompanyId && String(opportunity.tenantCompanyId || '') !== tenantCompanyId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Gerar número sequencial
    const year = new Date().getFullYear();
    const count = await prisma.kickoffMeeting.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });
    const number = `KICK${year}${String(count + 1).padStart(4, '0')}`;

    // Se template informado e não houver pauta/checklist explícitos, carregar do template
    let finalTemplateId = templateId;
    let resolvedAgenda = agendaItems;
    let resolvedChecklist = checklistItems;

    if (finalTemplateId && resolvedAgenda.length === 0 && resolvedChecklist.length === 0) {
      const template = await prisma.kickoffTemplate.findUnique({ where: { id: finalTemplateId } });
      if (template) {
        resolvedAgenda = Array.isArray(template.agenda) ? template.agenda : [];
        resolvedChecklist = Array.isArray(template.checklist) ? template.checklist : [];
      }
    } else if (!finalTemplateId) {
      // Se não veio template, buscar o template padrão da fase
      const defaultTemplate = await prisma.kickoffTemplate.findFirst({
        where: { phase, isDefault: true, isActive: true }
      });
      if (defaultTemplate) {
        finalTemplateId = defaultTemplate.id;
        if (resolvedAgenda.length === 0) resolvedAgenda = Array.isArray(defaultTemplate.agenda) ? defaultTemplate.agenda : [];
        if (resolvedChecklist.length === 0) resolvedChecklist = Array.isArray(defaultTemplate.checklist) ? defaultTemplate.checklist : [];
      }
    }

    const meeting = await prisma.kickoffMeeting.create({
      data: {
        number,
        title,
        description,
        phase,
        status: 'AGENDADA',
        platform: platform || 'MEET',
        meetingLink,
        scheduledDate: new Date(scheduledDate),
        startTime,
        endTime,
        opportunityId,
        companyId: opportunity.companyId,
        ownerId: req.user.userId,
        templateId: finalTemplateId || null,
        agendaItems: {
          create: resolvedAgenda.map((item, index) => ({
            title: item.title || item,
            description: item.description,
            durationMinutes: item.durationMinutes || 15,
            order: index + 1
          }))
        },
        checklistItems: {
          create: resolvedChecklist.map((item, index) => ({
            title: item.title || item,
            order: index + 1
          }))
        },
        participants: {
          create: participants.map((p) => ({
            userId: p.userId || null,
            contactId: p.contactId || null,
            role: p.role || (p.contactId ? 'EXTERNO' : 'INTERNO'),
            status: p.status || 'CONVIDADO',
            isRequired: p.isRequired !== undefined ? Boolean(p.isRequired) : true
          }))
        },
        history: {
          create: [buildHistoryEntry('CRIACAO', 'Reunião criada', `Reunião ${number} agendada`, { phase }, req.user.userId)]
        }
      },
      include: MEETING_INCLUDE
    });

    res.status(201).json(meeting);
  } catch (error) {
    console.error('Erro ao criar reunião:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/kickoff/meetings/:id
router.put('/meetings/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      phase,
      platform,
      meetingLink,
      scheduledDate,
      startTime,
      endTime,
      opportunityId,
      templateId
    } = req.body;

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const data = {};
    if (title) data.title = title;
    if (description !== undefined) data.description = description;
    if (phase) data.phase = phase;
    if (platform) data.platform = platform;
    if (meetingLink !== undefined) data.meetingLink = meetingLink;
    if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (opportunityId) {
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, companyId: true, tenantCompanyId: true }
      });
      if (!opportunity) return res.status(404).json({ error: 'Oportunidade não encontrada' });
      const tenantCompanyId = getTenantCompanyId(req.user);
      if (tenantCompanyId && String(opportunity.tenantCompanyId || '') !== tenantCompanyId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      data.opportunityId = opportunity.id;
      data.companyId = opportunity.companyId;
    }
    if (templateId !== undefined) data.templateId = templateId;

    const meeting = await prisma.kickoffMeeting.update({
      where: { id },
      data: {
        ...data,
        history: {
          create: [buildHistoryEntry('EDICAO', 'Reunião atualizada', 'Dados da reunião foram alterados', data, req.user.userId)]
        }
      },
      include: MEETING_INCLUDE
    });

    res.json(meeting);
  } catch (error) {
    console.error('Erro ao atualizar reunião:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/kickoff/meetings/:id/status  { status: 'REALIZADA' }
router.patch('/meetings/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actualStartTime, actualEndTime } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }

    const validStatuses = ['AGENDADA', 'REALIZADA', 'CANCELADA', 'REAGENDADA'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }
    const existing = accessCheck.meeting;

    const data = { status };
    if (status === 'REALIZADA') {
      data.actualStartTime = parseDateTime(actualStartTime) || existing.actualStartTime || new Date();
      data.actualEndTime = parseDateTime(actualEndTime) || existing.actualEndTime || null;
    }
    if (status === 'CANCELADA') {
      data.actualStartTime = null;
      data.actualEndTime = null;
    }

    const meeting = await prisma.kickoffMeeting.update({
      where: { id },
      data: {
        ...data,
        history: {
          create: [buildHistoryEntry('MUDANCA_STATUS', `Status alterado para ${status}`, `Reunião ${existing.number} teve seu status atualizado`, { from: existing.status, to: status }, req.user.userId)]
        }
      },
      include: MEETING_INCLUDE
    });

    res.json(meeting);
  } catch (error) {
    console.error('Erro ao alterar status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/kickoff/meetings/:id/notes  { meetingNotes: '...' }
router.put('/meetings/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { meetingNotes } = req.body;

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const meeting = await prisma.kickoffMeeting.update({
      where: { id },
      data: {
        meetingNotes: meetingNotes || '',
        history: {
          create: [buildHistoryEntry('ATA', 'Ata da reunião atualizada', 'Anotações/ata da reunião foram salvas', null, req.user.userId)]
        }
      },
      include: MEETING_INCLUDE
    });

    res.json(meeting);
  } catch (error) {
    console.error('Erro ao salvar ata:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kickoff/meetings/:id
router.delete('/meetings/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    await prisma.kickoffMeeting.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir reunião:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== PARTICIPANTES =====

// POST /api/kickoff/meetings/:id/participants
router.post('/meetings/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, contactId, role, status, isRequired } = req.body;

    if (!userId && !contactId) {
      return res.status(400).json({ error: 'Informe um usuário interno ou contato externo' });
    }

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const participant = await prisma.kickoffParticipant.create({
      data: {
        meetingId: id,
        userId: userId || null,
        contactId: contactId || null,
        role: role || (contactId ? 'EXTERNO' : 'INTERNO'),
        status: status || 'CONVIDADO',
        isRequired: isRequired !== undefined ? Boolean(isRequired) : true
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        contact: { select: { id: true, name: true, email: true, phone: true, position: true } }
      }
    });

    const participantName = participant.user?.name || participant.contact?.name || 'Participante';
    await prisma.kickoffHistory.create({
      data: buildHistoryEntry('PARTICIPANTE', 'Participante adicionado', `${participantName} foi adicionado à reunião`, null, req.user.userId, id)
    });

    res.status(201).json(participant);
  } catch (error) {
    console.error('Erro ao adicionar participante:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/kickoff/participants/:id  { status: 'CONFIRMADO' }
router.patch('/participants/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, role, isRequired } = req.body;

    const data = {};
    if (status) data.status = status;
    if (role) data.role = role;
    if (isRequired !== undefined) data.isRequired = Boolean(isRequired);

    const existingParticipant = await prisma.kickoffParticipant.findUnique({
      where: { id },
      include: {
        meeting: {
          include: { company: { select: { id: true, tenantCompanyId: true } } }
        }
      }
    });
    if (!existingParticipant) return res.status(404).json({ error: 'Participante não encontrado' });
    if (!canAccessMeeting(req, existingParticipant.meeting)) return res.status(403).json({ error: 'Acesso negado' });

    const participant = await prisma.kickoffParticipant.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } }
      }
    });

    res.json(participant);
  } catch (error) {
    console.error('Erro ao atualizar participante:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kickoff/participants/:id
router.delete('/participants/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existingParticipant = await prisma.kickoffParticipant.findUnique({
      where: { id },
      include: {
        meeting: {
          include: { company: { select: { id: true, tenantCompanyId: true } } }
        }
      }
    });
    if (!existingParticipant) return res.status(404).json({ error: 'Participante não encontrado' });
    if (!canAccessMeeting(req, existingParticipant.meeting)) return res.status(403).json({ error: 'Acesso negado' });

    await prisma.kickoffParticipant.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover participante:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== PAUTA (AGENDA) =====

// POST /api/kickoff/meetings/:id/agenda
router.post('/meetings/:id/agenda', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tratativa, durationMinutes } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }
    const meeting = accessCheck.meeting;

    const count = await prisma.kickoffAgendaItem.count({ where: { meetingId: id } });

    const item = await prisma.kickoffAgendaItem.create({
      data: {
        meetingId: id,
        title,
        description,
        tratativa,
        durationMinutes: durationMinutes || 15,
        order: count + 1
      }
    });

    await prisma.kickoffHistory.create({
      data: buildHistoryEntry('PAUTA', 'Item de pauta adicionado', `${title} foi adicionado à pauta`, null, req.user.userId, id)
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Erro ao adicionar item de pauta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/kickoff/agenda/:id  { title?, description?, tratativa?, durationMinutes? }
router.patch('/agenda/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tratativa, durationMinutes } = req.body;

    const existing = await prisma.kickoffAgendaItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Item de pauta não encontrado' });
    const accessCheck = await findAccessibleMeeting(req, existing.meetingId);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const data = {};
    if (title) data.title = title;
    if (description !== undefined) data.description = description;
    if (tratativa !== undefined) data.tratativa = tratativa;
    if (durationMinutes !== undefined) data.durationMinutes = Number(durationMinutes) || 15;

    const item = await prisma.kickoffAgendaItem.update({
      where: { id },
      data
    });

    if (tratativa !== undefined) {
      await prisma.kickoffHistory.create({
        data: buildHistoryEntry(
          'TRATATIVA',
          'Tratativa registrada',
          `${tratativa ? `Tratativa registrada no item "${existing.title}"` : `Tratativa removida do item "${existing.title}"`}`,
          null,
          req.user.userId,
          existing.meetingId
        )
      });
    }

    res.json(item);
  } catch (error) {
    console.error('Erro ao atualizar item de pauta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kickoff/agenda/:id
router.delete('/agenda/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.kickoffAgendaItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Item de pauta não encontrado' });
    const accessCheck = await findAccessibleMeeting(req, existing.meetingId);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    await prisma.kickoffAgendaItem.delete({ where: { id } });

    await prisma.kickoffHistory.create({
      data: buildHistoryEntry('PAUTA', 'Item de pauta removido', `"${existing.title}" foi removido da pauta`, null, req.user.userId, existing.meetingId)
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover item de pauta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== CHECKLIST =====

// POST /api/kickoff/meetings/:id/checklist
router.post('/meetings/:id/checklist', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const count = await prisma.kickoffChecklistItem.count({ where: { meetingId: id } });

    const item = await prisma.kickoffChecklistItem.create({
      data: {
        meetingId: id,
        title,
        order: count + 1
      }
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Erro ao adicionar item de checklist:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/kickoff/checklist/:id  { isCompleted: true }
router.patch('/checklist/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isCompleted } = req.body;

    const existing = await prisma.kickoffChecklistItem.findUnique({
      where: { id },
      select: { id: true, meetingId: true }
    });
    if (!existing) return res.status(404).json({ error: 'Item de checklist não encontrado' });
    const accessCheck = await findAccessibleMeeting(req, existing.meetingId);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const item = await prisma.kickoffChecklistItem.update({
      where: { id },
      data: {
        isCompleted: Boolean(isCompleted),
        completedAt: isCompleted ? new Date() : null,
        completedById: isCompleted ? req.user.userId : null
      },
      include: {
        completedBy: { select: { id: true, name: true } }
      }
    });

    res.json(item);
  } catch (error) {
    console.error('Erro ao atualizar checklist:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kickoff/checklist/:id
router.delete('/checklist/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.kickoffChecklistItem.findUnique({
      where: { id },
      select: { id: true, meetingId: true }
    });
    if (!existing) return res.status(404).json({ error: 'Item de checklist não encontrado' });
    const accessCheck = await findAccessibleMeeting(req, existing.meetingId);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    await prisma.kickoffChecklistItem.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover item de checklist:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== PLANOS DE AÇÃO (ACTION ITEMS) =====

// POST /api/kickoff/meetings/:id/action-items  { createTask: true }
router.post('/meetings/:id/action-items', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, dueDate, assigneeId, createTask = true } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const accessCheck = await findAccessibleMeeting(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }
    const meeting = accessCheck.meeting;

    let taskId = null;
    // Integração com o módulo de Gestão de Tarefas (Activity)
    if (createTask) {
      try {
        const activity = await prisma.activity.create({
          data: {
            type: 'TASK',
            subject: `[Kickoff ${meeting.number}] ${title}`,
            description: description || `Tarefa gerada a partir da reunião de kickoff ${meeting.number}`,
            status: 'PENDING',
            priority: priority || 'MEDIUM',
            dueDate: dueDate ? new Date(dueDate) : null,
            assignedToId: assigneeId || req.user.userId,
            companyId: meeting.companyId,
            opportunityId: meeting.opportunityId,
            tenantCompanyId: getTenantCompanyId(req.user)
          },
          select: { id: true }
        });
        taskId = activity.id;
      } catch (taskError) {
        console.error('Erro ao criar tarefa vinculada:', taskError);
      }
    }

    const actionItem = await prisma.kickoffActionItem.create({
      data: {
        meetingId: id,
        title,
        description,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId || null,
        taskId
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      }
    });

    await prisma.kickoffHistory.create({
      data: buildHistoryEntry('ACAO', 'Plano de ação criado', `${title} foi adicionado como ação pós-reunião`, { taskId }, req.user.userId, id)
    });

    res.status(201).json({ actionItem, taskCreated: Boolean(taskId), taskId });
  } catch (error) {
    console.error('Erro ao criar plano de ação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/kickoff/action-items/:id
router.patch('/action-items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assigneeId } = req.body;

    const existing = await prisma.kickoffActionItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Ação não encontrada' });
    const accessCheck = await findAccessibleMeeting(req, existing.meetingId);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    const data = {};
    if (title) data.title = title;
    if (description !== undefined) data.description = description;
    if (status) {
      data.status = status;
      data.completedAt = status === 'CONCLUIDO' ? new Date() : (status === 'PENDENTE' || status === 'EM_ANDAMENTO' ? null : existing.completedAt);
    }
    if (priority) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;

    const actionItem = await prisma.kickoffActionItem.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      }
    });

    // Sincronizar status com a tarefa vinculada (Activity)
    if (actionItem.taskId && status) {
      const activityStatusMap = {
        PENDENTE: 'PENDING',
        EM_ANDAMENTO: 'IN_PROGRESS',
        CONCLUIDO: 'COMPLETED',
        CANCELADO: 'CANCELLED'
      };
      const mappedStatus = activityStatusMap[status];
      if (mappedStatus) {
        await prisma.activity
          .update({
            where: { id: actionItem.taskId },
            data: {
              status: mappedStatus,
              completedAt: mappedStatus === 'COMPLETED' ? new Date() : null
            }
          })
          .catch((err) => console.error('Erro ao sincronizar tarefa:', err.message));
      }
    }

    res.json(actionItem);
  } catch (error) {
    console.error('Erro ao atualizar plano de ação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/kickoff/action-items/:id
router.delete('/action-items/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.kickoffActionItem.findUnique({
      where: { id },
      select: { id: true, meetingId: true }
    });
    if (!existing) return res.status(404).json({ error: 'Ação não encontrada' });
    const accessCheck = await findAccessibleMeeting(req, existing.meetingId);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({ error: accessCheck.error });
    }

    await prisma.kickoffActionItem.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir plano de ação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== DASHBOARD/RESUMO =====

// GET /api/kickoff/stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const where = scopeMeetingWhere(req, {});

    const [byStatus, byPhase, total, pendingActions] = await Promise.all([
      prisma.kickoffMeeting.groupBy({ by: ['status'], where, _count: { status: true } }),
      prisma.kickoffMeeting.groupBy({ by: ['phase'], where, _count: { phase: true } }),
      prisma.kickoffMeeting.count({ where }),
      prisma.kickoffActionItem.count({
        where: { status: { in: ['PENDENTE', 'EM_ANDAMENTO'] }, assigneeId: req.user.userId }
      })
    ]);

    res.json({ byStatus, byPhase, total, pendingActions });
  } catch (error) {
    console.error('Erro ao gerar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
