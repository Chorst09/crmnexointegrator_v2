import { prisma } from '../lib/prisma.js';

const FLOW_MARKER = '[CRM_ACTIVITY_FLOW]';
const PRE_SALES_TARGET_SIGNATURE = '"targetArea":"PRE_VENDAS"';

export default async function handler(req) {
  if (req.method === 'GET') {
    try {
      // Buscar atividades do fluxo que tenham destino Pré-Vendas.
      // Não depende de enum específico no banco (evita quebra em ambientes sem migração desse enum).
      const solicitacoes = await prisma.activity.findMany({
        where: {
          AND: [
            { description: { contains: FLOW_MARKER } },
            { description: { contains: PRE_SALES_TARGET_SIGNATURE } }
          ]
        },
        include: {
          company: true,
          opportunity: true,
          assignedTo: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      // Transformar dados para o formato esperado pelo frontend
      const solicitacoesFormatadas = solicitacoes.map(activity => ({
        id: activity.id,
        numero: `SOL-${new Date(activity.createdAt).getFullYear()}-${String(activity.id).padStart(3, '0')}`,
        titulo: activity.subject,
        descricao: extractCleanDescription(activity.description),
        status: mapActivityStatusToSolicitacao(activity.status),
        prioridade: mapActivityPriorityToSolicitacao(activity.priority),
        solicitante: activity.assignedTo,
        createdAt: activity.createdAt,
        company: activity.company,
        opportunity: activity.opportunity,
        tiposPrecificacao: ['VENDA'], // Default
        observacoes: extractCleanDescription(activity.description)
      }));
      
      return Response.json(solicitacoesFormatadas);
    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
      return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const requestedAssignedToId = String(body.solicitanteId || '').trim();
      let assignedToId = req.user?.userId || null;

      if (requestedAssignedToId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: requestedAssignedToId },
          select: { id: true }
        });
        if (assignedUser?.id) {
          assignedToId = assignedUser.id;
        }
      }

      if (!assignedToId) {
        return Response.json({ error: 'Não foi possível definir o responsável da solicitação' }, { status: 400 });
      }

      // Cria solicitação como atividade comum, marcando fluxo para PRE_VENDAS no description.
      const descriptionWithFlow = ensurePreSalesFlowMetadata(body.descricao, {
        sourceArea: body.sourceArea || 'COMERCIAL',
        createdFrom: body.createdFrom || 'SOLICITACOES',
        createdByName: req.user?.name || ''
      });
      
      const activity = await prisma.activity.create({
        data: {
          type: 'TASK',
          subject: body.titulo,
          description: descriptionWithFlow,
          status: 'PENDING',
          priority: mapSolicitacaoPriorityToActivity(body.prioridade),
          companyId: body.companyId || undefined,
          opportunityId: body.opportunityId || undefined,
          assignedToId
        },
        include: {
          company: true,
          opportunity: true,
          assignedTo: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      const solicitacaoFormatada = {
        id: activity.id,
        numero: `SOL-${new Date(activity.createdAt).getFullYear()}-${String(activity.id).padStart(3, '0')}`,
        titulo: activity.subject,
        descricao: extractCleanDescription(activity.description),
        status: 'NOVA',
        prioridade: body.prioridade,
        solicitante: activity.assignedTo,
        createdAt: activity.createdAt,
        company: activity.company,
        opportunity: activity.opportunity,
        tiposPrecificacao: body.tiposPrecificacao || ['VENDA'],
        observacoes: extractCleanDescription(activity.description)
      };

      return Response.json(solicitacaoFormatada);
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    const { id, status } = body;
    
    const activity = await prisma.activity.update({
      where: { id },
      data: {
        status: mapSolicitacaoStatusToActivity(status),
        completedAt: ['FINALIZADA', 'APROVADO', 'REPROVADO'].includes(status) ? new Date() : null
      },
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const solicitacaoFormatada = {
      id: activity.id,
      numero: `SOL-${new Date(activity.createdAt).getFullYear()}-${String(activity.id).padStart(3, '0')}`,
      titulo: activity.subject,
      descricao: activity.description,
      status: status,
      prioridade: mapActivityPriorityToSolicitacao(activity.priority),
      solicitante: activity.assignedTo,
      createdAt: activity.createdAt,
      company: activity.company,
      opportunity: activity.opportunity
    };

    return Response.json(solicitacaoFormatada);
  }

  return new Response('Method not allowed', { status: 405 });
}

// Funções auxiliares para mapear status e prioridades
function mapActivityStatusToSolicitacao(activityStatus) {
  const mapping = {
    'PENDING': 'NOVA',
    'IN_PROGRESS': 'EM_PRECIFICACAO',
    'COMPLETED': 'FINALIZADA',
    'CANCELLED': 'CANCELADA'
  };
  return mapping[activityStatus] || 'NOVA';
}

function mapSolicitacaoStatusToActivity(solicitacaoStatus) {
  const mapping = {
    'NOVA': 'PENDING',
    'EM_PRECIFICACAO': 'IN_PROGRESS',
    'AGUARDANDO_APROVACAO': 'IN_PROGRESS',
    'ENVIADA': 'IN_PROGRESS',
    'APROVADO': 'COMPLETED',
    'REPROVADO': 'CANCELLED',
    'FINALIZADA': 'COMPLETED',
    'REJEITADA': 'CANCELLED',
    'CANCELADA': 'CANCELLED'
  };
  return mapping[solicitacaoStatus] || 'PENDING';
}

function mapActivityPriorityToSolicitacao(activityPriority) {
  const mapping = {
    'LOW': 'BAIXA',
    'MEDIUM': 'MEDIA',
    'HIGH': 'ALTA',
    'URGENT': 'ALTA'
  };
  return mapping[activityPriority] || 'MEDIA';
}

function mapSolicitacaoPriorityToActivity(solicitacaoPriority) {
  const mapping = {
    'BAIXA': 'LOW',
    'MEDIA': 'MEDIUM',
    'ALTA': 'HIGH'
  };
  return mapping[solicitacaoPriority] || 'MEDIUM';
}

function extractCleanDescription(description) {
  const value = String(description || '');
  const markerIdx = value.indexOf(FLOW_MARKER);
  if (markerIdx < 0) return value.trim();
  return value.slice(0, markerIdx).trim();
}

function ensurePreSalesFlowMetadata(description, meta = {}) {
  const base = String(description || '').trim();
  if (base.includes(FLOW_MARKER)) return base;

  const flow = {
    sourceArea: meta.sourceArea || 'COMERCIAL',
    targetArea: 'PRE_VENDAS',
    createdFrom: meta.createdFrom || 'SOLICITACOES',
    createdByName: meta.createdByName || '',
    createdAt: new Date().toISOString()
  };

  return `${base}\n\n${FLOW_MARKER}${JSON.stringify(flow)}`;
}
