import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { normalizeUserRole } from '@/lib/permissions';
import { verifyProposalApprovalToken } from '@/lib/proposals/approval-token';
import { sendResendEmail } from '@/lib/email/resend';

const actionLabelMap = {
  approve: 'Aprovada',
  reject: 'Rejeitada',
} as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getApproverRoleMetadata = (role: string | null | undefined): {
  role: 'admin' | 'director' | null;
  roleLabel: 'Administrador' | 'Diretor' | null;
} => {
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === 'admin') {
    return { role: 'admin', roleLabel: 'Administrador' };
  }
  if (normalizedRole === 'director') {
    return { role: 'director', roleLabel: 'Diretor' };
  }
  return { role: null, roleLabel: null };
};

const getAuthTokenFromRequest = (request: NextRequest): string | null => {
  const tokenFromCookie = request.cookies.get('auth-token')?.value;
  if (tokenFromCookie) return tokenFromCookie;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);

  return null;
};

const extractEmailAddress = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim().toLowerCase();
};

const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(extractEmailAddress(value));

const normalizeEmailList = (emails: Array<string | null | undefined>): string[] => {
  const unique = new Set<string>();
  emails.forEach((email) => {
    if (!email || typeof email !== 'string') return;
    const normalized = extractEmailAddress(email);
    if (!normalized) return;
    if (!isValidEmail(normalized)) return;
    unique.add(normalized);
  });
  return Array.from(unique);
};

const getStringValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getProposalAccountManagerEmail = (proposal: any): string | null => {
  const accountManager = proposal?.account_manager;
  if (accountManager && typeof accountManager === 'object' && !Array.isArray(accountManager)) {
    const email = getStringValue((accountManager as Record<string, unknown>).email);
    if (email) return email;
  }

  const metadata = proposal?.metadata && typeof proposal.metadata === 'object'
    ? (proposal.metadata as Record<string, any>)
    : {};

  const metadataEmail =
    getStringValue(metadata?.accountManagerEmail) ||
    getStringValue(metadata?.fullAccountManagerData?.email);

  return metadataEmail || null;
};

const getFixedApprovalCcEmails = (): string[] => {
  const raw = process.env.PROPOSAL_APPROVAL_FIXED_CC_EMAILS || '';
  if (!raw.trim()) return [];
  return normalizeEmailList(raw.split(/[,\n;]+/));
};

const isResendSandboxRestrictionError = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  const value = raw.toLowerCase();
  return (
    value.includes('testing emails') ||
    value.includes('verify a domain') ||
    value.includes('only send testing emails')
  );
};

const isResendInvalidCcError = (raw: string | null | undefined): boolean => {
  if (!raw) return false;
  const value = raw.toLowerCase();
  return value.includes("invalid 'cc' field") || value.includes('invalid "cc" field');
};

const buildHtmlResponse = (title: string, description: string, isSuccess: boolean) => `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
    <div style="max-width:640px;background:#111827;border:1px solid #334155;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:22px;color:${isSuccess ? '#22c55e' : '#f87171'}">${title}</h1>
      <p style="margin:0;line-height:1.5">${description}</p>
    </div>
  </body>
</html>
`;

interface FinalizeApprovalPayload {
  workflowId: string;
  proposalId: string;
  approverId: string;
  action: 'approve' | 'reject';
}

const finalizeApprovalActionFromPayload = async (
  payload: FinalizeApprovalPayload,
  options?: { strictApprover?: boolean; reason?: string | null }
) => {
  const workflow = await prisma.approvalWorkflow.findUnique({
    where: { id: payload.workflowId },
    include: {
      approver: {
        select: {
          id: true,
          email: true,
          role: true,
          profile: {
            select: {
              full_name: true,
              role: true,
            },
          },
        },
      },
      requester: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              full_name: true,
            },
          },
        },
      },
    },
  });

  if (!workflow) {
    throw new Error('Fluxo de aprovação não encontrado');
  }

  if (workflow.entity_type !== 'proposal' || workflow.entity_id !== payload.proposalId) {
    throw new Error('Token de aprovação não corresponde à proposta');
  }

  const strictApprover = options?.strictApprover ?? true;
  const decisionReason =
    typeof options?.reason === 'string' && options.reason.trim().length > 0
      ? options.reason.trim()
      : null;
  if (strictApprover && workflow.current_approver !== payload.approverId) {
    throw new Error('Token inválido para este aprovador');
  }

  if (workflow.status !== 'pending') {
    return {
      alreadyHandled: true,
      resultStatus: workflow.status,
      proposal: await prisma.proposal.findUnique({ where: { id: workflow.entity_id } }),
      workflow,
    };
  }

  const decisionAt = new Date();
  const decisionAtIso = decisionAt.toISOString();
  const approverName = workflow.approver?.profile?.full_name || null;
  const approverEmail = workflow.approver?.email || null;
  const approverRoleMetadata = getApproverRoleMetadata(
    workflow.approver?.profile?.role || workflow.approver?.role || null
  );

  const result = await prisma.$transaction(async (tx) => {
    await tx.approvalStep.updateMany({
      where: {
        workflow_id: workflow.id,
        step_number: workflow.current_step,
        status: 'pending',
      },
      data: {
        status: payload.action === 'approve' ? 'approved' : 'rejected',
        approved_at: decisionAt,
        ...(decisionReason ? { comments: decisionReason } : {}),
      },
    });

    const updatedWorkflow = await tx.approvalWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: payload.action === 'approve' ? 'approved' : 'rejected',
        metadata: {
          ...((workflow.metadata || {}) as Record<string, any>),
          decision: payload.action,
          decisionAt: decisionAtIso,
          decidedBy: payload.approverId,
          decidedByRole: approverRoleMetadata.role,
          decidedByRoleLabel: approverRoleMetadata.roleLabel,
          decidedByName: approverName,
          decidedByEmail: approverEmail,
          decisionReason,
        },
      },
    });

    const proposal = await tx.proposal.findUnique({
      where: { id: workflow.entity_id },
    });

    if (!proposal) {
      throw new Error('Proposta não encontrada para finalizar aprovação');
    }

    const proposalMetadata = (proposal.metadata || {}) as Record<string, any>;

    const updatedProposal = await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        status: payload.action === 'approve' ? 'Aprovada' : 'Rejeitada',
        metadata: {
          ...proposalMetadata,
          approval: {
            ...(proposalMetadata.approval || {}),
            status: payload.action === 'approve' ? 'approved' : 'rejected',
            decisionAt: decisionAtIso,
            decidedBy: payload.approverId,
            decidedByRole: approverRoleMetadata.role,
            decidedByRoleLabel: approverRoleMetadata.roleLabel,
            decidedByName: approverName,
            decidedByEmail: approverEmail,
            reason: decisionReason,
          },
        },
      },
    });

    return {
      updatedWorkflow,
      updatedProposal,
    };
  });

  return {
    alreadyHandled: false,
    resultStatus: result.updatedWorkflow.status,
    proposal: result.updatedProposal,
    workflow,
  };
};

const finalizeApprovalAction = async (token: string, options?: { reason?: string | null }) => {
  const payload = verifyProposalApprovalToken(token);
  return finalizeApprovalActionFromPayload(payload, { strictApprover: true, reason: options?.reason });
};

const notifyRequester = async (input: {
  proposal: any;
  workflow: any;
  action: 'approve' | 'reject';
  reason?: string | null;
}) => {
  const requesterEmail = input.workflow.requester?.email;
  const workflowMetadata = (input.workflow.metadata || {}) as Record<string, any>;
  const creatorEmailFromMetadata =
    typeof workflowMetadata.creatorEmail === 'string' ? workflowMetadata.creatorEmail : null;
  const creatorEmailFromProposal =
    typeof input.proposal?.creator?.email === 'string' ? input.proposal.creator.email : null;
  let creatorEmail = creatorEmailFromMetadata || creatorEmailFromProposal || null;
  if (!creatorEmail && typeof input.proposal?.created_by === 'string' && input.proposal.created_by) {
    const creatorUser = await prisma.user.findUnique({
      where: { id: input.proposal.created_by },
      select: { email: true },
    });
    creatorEmail = creatorUser?.email || null;
  }
  const workflowAccountManagerEmail =
    typeof workflowMetadata.accountManagerEmail === 'string' ? workflowMetadata.accountManagerEmail : null;
  const proposalAccountManagerEmail = getProposalAccountManagerEmail(input.proposal);

  const accountManagerEmail = normalizeEmailList([
    workflowAccountManagerEmail,
    proposalAccountManagerEmail,
  ])[0] || null;

  const recipients = normalizeEmailList([
    requesterEmail,
    creatorEmail,
    accountManagerEmail,
    workflowAccountManagerEmail,
    proposalAccountManagerEmail,
    ...getFixedApprovalCcEmails(),
  ]);
  if (recipients.length === 0) {
    console.error('❌ Notificação aprovação: nenhum destinatário válido.', {
      requesterEmail,
      creatorEmail,
      accountManagerEmail,
      workflowAccountManagerEmail,
      proposalAccountManagerEmail,
    });
    return { success: false, reason: 'Sem destinatário para notificação' };
  }
  console.log('📧 Notificação aprovação - destinatários:', recipients);

  const approverName =
    input.workflow.approver?.profile?.full_name || input.workflow.approver?.email || 'Aprovador';
  const requesterName =
    input.workflow.requester?.profile?.full_name || input.workflow.requester?.email || 'Solicitante';
  const decisionReason =
    typeof input.reason === 'string' && input.reason.trim().length > 0 ? input.reason.trim() : null;

  const decisionLabel = input.action === 'approve' ? 'Aprovada' : 'Rejeitada';
  const decisionText = [
    `Proposta ${decisionLabel}`,
    '',
    'Olá,',
    requesterName ? `Solicitante: ${requesterName}` : '',
    `A proposta ${input.proposal.base_id} foi ${input.action === 'approve' ? 'aprovada' : 'rejeitada'} por ${approverName}.`,
    `Status atual: ${actionLabelMap[input.action]}`,
    decisionReason ? `Motivo: ${decisionReason}` : '',
    `Data: ${new Date().toLocaleString('pt-BR')}`,
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  const subject = `Proposta ${input.proposal.base_id} ${input.action === 'approve' ? 'aprovada' : 'rejeitada'}`;
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <p><strong>Proposta ${decisionLabel}</strong></p>
      <p>Olá,</p>
      ${requesterName ? `<p>Solicitante: ${requesterName}</p>` : ''}
      <p>A proposta ${input.proposal.base_id} foi ${input.action === 'approve' ? 'aprovada' : 'rejeitada'} por ${approverName}.</p>
      <p>Status atual: ${actionLabelMap[input.action]}</p>
      ${decisionReason ? `<p>Motivo: ${decisionReason}</p>` : ''}
      <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
  `;

  const results = [];
  for (const recipient of recipients) {
    const result = await sendResendEmail({
      to: [recipient],
      subject,
      text: decisionText,
      html: htmlBody,
    });
    results.push({ recipient, ...result });
  }

  const successCount = results.filter((r) => r.success).length;
  if (successCount === 0) {
    console.error('❌ Notificação aprovação: falha ao enviar para todos.', results);
    return { success: false, reason: 'Falha ao enviar notificações', results };
  }

  console.log('✅ Notificação aprovação enviada.', {
    successCount,
    total: results.length,
  });
  return { success: true, results };
};

const parseApprovalAction = (value: unknown): 'approve' | 'reject' => {
  if (value === 'reject') return 'reject';
  return 'approve';
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new NextResponse(
      buildHtmlResponse('Token ausente', 'Nenhum token de aprovação foi informado.', false),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    const payload = verifyProposalApprovalToken(token);
    const outcome = await finalizeApprovalAction(token, {
      reason: request.nextUrl.searchParams.get('reason'),
    });

    if (!outcome.alreadyHandled) {
      if (outcome.proposal) {
        await notifyRequester({
          proposal: outcome.proposal,
          workflow: outcome.workflow,
          action: payload.action,
          reason: request.nextUrl.searchParams.get('reason'),
        });
      }
    }

    if (outcome.alreadyHandled) {
      return new NextResponse(
        buildHtmlResponse(
          'Solicitação já processada',
          `Esta solicitação já foi processada anteriormente com status "${outcome.resultStatus}".`,
          true
        ),
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return new NextResponse(
      buildHtmlResponse(
        payload.action === 'approve' ? 'Proposta aprovada' : 'Proposta rejeitada',
        `A proposta ${outcome.proposal?.base_id || outcome.workflow.entity_id} foi ${payload.action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso.`,
        true
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error: any) {
    return new NextResponse(
      buildHtmlResponse('Falha na aprovação', error?.message || 'Token inválido ou expirado.', false),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tokenFromBody = typeof body?.token === 'string' ? body.token.trim() : '';
    let action = parseApprovalAction(body?.action);
    const reasonFromBody =
      typeof body?.reason === 'string' && body.reason.trim().length > 0 ? body.reason.trim() : null;
    let outcome: Awaited<ReturnType<typeof finalizeApprovalActionFromPayload>> | Awaited<ReturnType<typeof finalizeApprovalAction>>;

    if (tokenFromBody) {
      const payload = verifyProposalApprovalToken(tokenFromBody);
      action = payload.action;
      outcome = await finalizeApprovalAction(tokenFromBody, { reason: reasonFromBody });
    } else {
      const proposalId = typeof body?.proposalId === 'string' ? body.proposalId.trim() : '';
      if (!proposalId) {
        return NextResponse.json(
          { success: false, error: 'Informe o ID da proposta para aprovar.' },
          { status: 400 }
        );
      }

      const token = getAuthTokenFromRequest(request);
      const currentUser = await getCurrentUser(token ?? undefined);
      if (!currentUser) {
        return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });
      }

      const normalizedRole = normalizeUserRole(currentUser.role);
      if (normalizedRole !== 'admin' && normalizedRole !== 'director') {
        return NextResponse.json(
          { success: false, error: 'Somente Diretor e Administrador podem aprovar propostas.' },
          { status: 403 }
        );
      }

      const pendingWorkflow = await prisma.approvalWorkflow.findFirst({
        where: {
          entity_type: 'proposal',
          entity_id: proposalId,
          workflow_type: 'approval',
          status: 'pending',
        },
        select: {
          id: true,
          current_approver: true,
        },
        orderBy: { created_at: 'desc' },
      });

      if (!pendingWorkflow) {
        return NextResponse.json(
          { success: false, error: 'Não existe aprovação pendente para esta proposta.' },
          { status: 404 }
        );
      }

      if (pendingWorkflow.current_approver !== currentUser.id) {
        return NextResponse.json(
          { success: false, error: 'Somente o aprovador responsável pode aprovar esta proposta.' },
          { status: 403 }
        );
      }

      outcome = await finalizeApprovalActionFromPayload(
        {
          workflowId: pendingWorkflow.id,
          proposalId,
          approverId: currentUser.id,
          action,
        },
        { strictApprover: true, reason: reasonFromBody }
      );
    }

    if (!outcome.alreadyHandled && outcome.proposal) {
      await notifyRequester({
        proposal: outcome.proposal,
        workflow: outcome.workflow,
        action,
        reason: reasonFromBody,
      });
    }

    if (outcome.alreadyHandled) {
      return NextResponse.json({
        success: true,
        alreadyHandled: true,
        status: outcome.resultStatus,
        action,
        message: `Esta solicitação já foi processada anteriormente com status "${outcome.resultStatus}".`,
      });
    }

    return NextResponse.json({
      success: true,
      alreadyHandled: false,
      status: outcome.resultStatus,
      action,
      proposalId: outcome.proposal?.id || outcome.workflow.entity_id,
      message: `Proposta ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso.`,
    });
  } catch (error: any) {
    const message = error?.message || 'Erro interno ao processar decisão de aprovação.';
    const normalized = message.toLowerCase();
    const isClientError =
      normalized.includes('token') ||
      normalized.includes('inválido') ||
      normalized.includes('expirado') ||
      normalized.includes('não corresponde') ||
      normalized.includes('não encontrado');

    return NextResponse.json(
      { success: false, error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
