import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { status, userId, type } = req.query || {};
    
    const where = {};
    if (status) where.status = status;
    if (type) where.workflow = { type };

    // Se userId fornecido, buscar aprovações onde o usuário é aprovador
    if (userId) {
      where.steps = {
        some: {
          approverId: userId,
          status: 'PENDING'
        }
      };
    }

    const approvals = await prisma.approvalRequest.findMany({
      where,
      include: {
        workflow: true,
        requester: {
          select: { id: true, name: true, email: true }
        },
        steps: {
          include: {
            approver: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { stepNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return Response.json(approvals);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    // Buscar workflow
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: body.workflowId }
    });
    
    if (!workflow) {
      return Response.json({ error: 'Workflow not found' }, { status: 404 });
    }
    
    // Criar solicitação de aprovação
    const approval = await prisma.approvalRequest.create({
      data: {
        workflowId: body.workflowId,
        entityType: body.entityType,
        entityId: body.entityId,
        requesterId: body.requesterId,
        status: 'PENDING',
        data: body.data || {}
      }
    });
    
    // Criar steps baseados no workflow
    const steps = workflow.steps;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await prisma.approvalStep.create({
        data: {
          requestId: approval.id,
          stepNumber: i + 1,
          approverId: step.approverId,
          status: i === 0 ? 'PENDING' : 'PENDING' // Primeiro step fica pendente
        }
      });
    }
    
    return Response.json(approval);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    const { action, stepId, comments } = body;
    
    if (action === 'approve' || action === 'reject') {
      // Atualizar step
      const step = await prisma.approvalStep.update({
        where: { id: stepId },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          comments,
          approvedAt: new Date()
        }
      });
      
      // Buscar a solicitação completa
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: step.requestId },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' }
          }
        }
      });
      
      if (action === 'reject') {
        // Se rejeitado, marcar toda a solicitação como rejeitada
        await prisma.approvalRequest.update({
          where: { id: approval.id },
          data: { status: 'REJECTED' }
        });
      } else {
        // Se aprovado, verificar se é o último step
        const allApproved = approval.steps.every(s => 
          s.id === stepId ? true : s.status === 'APPROVED'
        );
        
        if (allApproved) {
          await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: { status: 'APPROVED' }
          });
        } else {
          // Ativar próximo step
          const nextStep = approval.steps.find(s => 
            s.stepNumber === step.stepNumber + 1
          );
          if (nextStep) {
            await prisma.approvalStep.update({
              where: { id: nextStep.id },
              data: { status: 'PENDING' }
            });
          }
        }
      }
      
      return Response.json({ success: true, action, status: approval.status });
    }
    
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }

  return new Response('Method not allowed', { status: 405 });
}