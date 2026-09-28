import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions';
import { evaluateProposalApprovalPolicy } from '@/lib/proposals/approval-policy';

const getAuthTokenFromRequest = (request: NextRequest): string | null => {
  const tokenFromCookie = request.cookies.get('auth-token')?.value;
  if (tokenFromCookie) return tokenFromCookie;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);

  return null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getAuthTokenFromRequest(request);
    const currentUser = await getCurrentUser(token ?? undefined);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      select: {
        id: true,
        created_by: true,
        products: true,
        metadata: true,
      },
    });

    if (!proposal) {
      return NextResponse.json({ success: false, error: 'Proposta não encontrada' }, { status: 404 });
    }

    const permissions = getPermissionsForRole(normalizeUserRole(currentUser.role));
    const isOwner = proposal.created_by === currentUser.id;
    if (!permissions.canEditProposals || (!permissions.canViewAllProposals && !isOwner)) {
      return NextResponse.json({ success: false, error: 'Sem permissão para esta proposta' }, { status: 403 });
    }

    const metadata = (proposal.metadata || {}) as Record<string, any>;
    const approvalPolicy = evaluateProposalApprovalPolicy({
      products: proposal.products,
      metadata,
      appliedDirectorDiscountPercentage: metadata.appliedDirectorDiscountPercentage,
    });

    const pendingWorkflow = await prisma.approvalWorkflow.findFirst({
      where: {
        entity_type: 'proposal',
        entity_id: proposal.id,
        workflow_type: 'approval',
        status: 'pending',
      },
      select: {
        id: true,
        status: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        requiresApproval: approvalPolicy.requiresApproval,
        reasons: approvalPolicy.reasons,
        metrics: approvalPolicy.metrics,
        hasPendingWorkflow: !!pendingWorkflow,
        pendingWorkflow,
      },
    });
  } catch (error: any) {
    console.error('Erro ao avaliar elegibilidade de aprovação:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno ao avaliar elegibilidade' },
      { status: 500 }
    );
  }
}

