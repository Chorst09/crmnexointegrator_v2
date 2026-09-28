import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  console.log('Handler chamado com método:', req.method);
  
  if (req.method === 'GET') {
    const { userId, status, type } = req.query || {};
    
    const where = {};
    if (userId) where.assignedToId = userId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (req.user?.role === 'SELLER') where.assignedToId = req.user.userId;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' }
      ]
    });
    
    return Response.json(activities);
  }

  if (req.method === 'POST') {
    try {
      console.log('POST request recebido');
      const body = await req.json();
      console.log('Body:', JSON.stringify(body, null, 2));

      const assignedToId = req.user?.role === 'SELLER'
        ? req.user.userId
        : (body.assignedToId || req.user?.userId);

      if (!assignedToId) {
        return Response.json({ error: 'assignedToId é obrigatório' }, { status: 400 });
      }
      
      // Preparar dados básicos
      const activityData = {
        type: body.type || 'TASK',
        subject: body.subject || 'Atividade sem título',
        description: body.description || '',
        status: 'PENDING',
        priority: body.priority || 'MEDIUM',
        assignedToId
      };

      console.log('Activity data:', JSON.stringify(activityData, null, 2));

      const activity = await prisma.activity.create({
        data: activityData
      });

      console.log('Atividade criada com ID:', activity.id);

      return Response.json({ success: true, activity });
    } catch (error) {
      console.error('Erro completo:', error);
      return Response.json({ 
        error: 'Erro interno do servidor', 
        message: error.message,
        stack: error.stack 
      }, { status: 500 });
    }
  }

  if (req.method === 'PUT') {
    const body = await req.json();

    if (!body.id) return Response.json({ error: 'id é obrigatório' }, { status: 400 });
    if (req.user?.role === 'SELLER') {
      const existing = await prisma.activity.findUnique({
        where: { id: body.id },
        select: { assignedToId: true }
      });
      if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
      if (existing.assignedToId !== req.user.userId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const activity = await prisma.activity.update({
      where: { id: body.id },
      data: {
        subject: body.subject,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        completedAt: body.status === 'COMPLETED' ? new Date() : null
      },
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    return Response.json(activity);
  }

  return new Response('Method not allowed', { status: 405 });
}
