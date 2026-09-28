import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions';
import { evaluateProposalApprovalPolicy } from '@/lib/proposals/approval-policy';
import { signProposalApprovalToken } from '@/lib/proposals/approval-token';
import { getCalculatorTabForProposal } from '@/lib/proposals/calculator-tab';
import { sendResendEmail } from '@/lib/email/resend';

const DIRECTOR_PENDING_STATUS = 'Aguardando Aprovação Diretoria';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const isValidEmail = (value: string) => EMAIL_REGEX.test(extractEmailAddress(value));

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

const getAllowedApproverEmails = (): string[] => {
  const raw = process.env.PROPOSAL_APPROVAL_ALLOWED_EMAILS || '';
  if (!raw.trim()) return [];
  return normalizeEmailList(raw.split(/[,\n;]+/));
};

const parseResendErrorBody = (raw: string | null | undefined): string => {
  if (!raw) return 'Falha no envio (sem detalhes).';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
    if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error;
    return raw;
  } catch {
    return raw;
  }
};

const sendApprovalRequestEmail = async (input: {
  workflowId: string;
  proposalId: string;
  approverId: string;
  approverEmail: string;
  proposalBaseId: string;
  proposalTitle: string;
  proposalType?: string | null;
  requestorName: string;
  reasons: Array<{ label: string; details?: string }>;
  notes?: string | null;
  ccRecipients: string[];
  baseUrl: string;
}) => {
  console.log('📧 Preparando email de aprovação de proposta...');
  console.log('  Para:', input.approverEmail);
  console.log('  CC:', input.ccRecipients);
  console.log('  Proposta:', input.proposalBaseId);
  
  const baseUrl = input.baseUrl;
  const approveToken = signProposalApprovalToken({
    workflowId: input.workflowId,
    proposalId: input.proposalId,
    approverId: input.approverId,
    action: 'approve',
  });
  const rejectToken = signProposalApprovalToken({
    workflowId: input.workflowId,
    proposalId: input.proposalId,
    approverId: input.approverId,
    action: 'reject',
  });

  const calculatorTab = getCalculatorTabForProposal({
    type: input.proposalType,
    base_id: input.proposalBaseId,
  });
  // Remover prefixo 'calculator-' se existir
  const calculatorPath = calculatorTab.replace(/^calculator-/, '');
  
  const approveParams = new URLSearchParams({
    proposalId: input.proposalId,
    approvalToken: approveToken,
  });
  const approveLink = `${baseUrl}/calculators/${calculatorPath}?${approveParams.toString()}`;
  const rejectParams = new URLSearchParams({
    proposalId: input.proposalId,
    rejectToken,
  });
  const rejectLink = `${baseUrl}/calculators/${calculatorPath}?${rejectParams.toString()}`;
  const reasonListHtml = input.reasons
    .map((reason) => `<li>${reason.label}${reason.details ? `: ${reason.details}` : ''}</li>`)
    .join('');
  const reasonListText = input.reasons
    .map((reason) => `- ${reason.label}${reason.details ? `: ${reason.details}` : ''}`)
    .join('\n');
  const approvalText = [
    'Olá,',
    '',
    'Você tem uma proposta aguardando aprovação.',
    `Proposta: ${input.proposalBaseId}`,
    `Título: ${input.proposalTitle}`,
    `Solicitante: ${input.requestorName}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    '',
    'Motivos:',
    reasonListText || '- Nenhum informado',
    input.notes ? `Observações: ${input.notes}` : '',
    '',
    'Aprovar:',
    approveLink,
    '',
    'Rejeitar:',
    rejectLink,
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  return sendResendEmail({
    to: [input.approverEmail],
    cc: input.ccRecipients,
    subject: `Aprovação necessária - Proposta ${input.proposalBaseId}`,
    text: approvalText,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto;">
        <p>Olá,</p>
        <p>Você tem uma proposta aguardando aprovação.</p>
        <p>Proposta: <strong>${input.proposalBaseId}</strong></p>
        <p>Título: ${input.proposalTitle}</p>
        <p>Solicitante: ${input.requestorName}</p>
        <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
        <p>Motivos:</p>
        <ul>${reasonListHtml}</ul>
        ${input.notes ? `<p>Observações: ${input.notes}</p>` : ''}
        <p>Aprovar: <a href="${approveLink}">Abrir proposta para aprovação</a></p>
        <p>Rejeitar: <a href="${rejectLink}">Abrir proposta para rejeição</a></p>
        <p>Ao aprovar, você será direcionado para a calculadora para revisar antes de confirmar.</p>
      </div>
    `,
  }).then(result => {
    console.log('📬 Resultado do envio de email:');
    console.log('  Sucesso:', result.success);
    console.log('  Status:', result.status);
    console.log('  From usado:', result.fromUsed);
    if (!result.success) {
      console.error('  Erro:', result.body);
    }
    return result;
  });
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🔔 Recebida solicitação de aprovação de proposta');
  try {
    const token = getAuthTokenFromRequest(request);
    const currentUser = await getCurrentUser(token ?? undefined);
    if (!currentUser) {
      console.log('❌ Usuário não autenticado');
      return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });
    }

    console.log('✅ Usuário autenticado:', currentUser.email);

    const { id } = await params;
    console.log('📄 ID da proposta:', id);
    
    const { approverEmail, notes, forceApproval } = await request.json();
    console.log('📧 Email do aprovador:', approverEmail);
    console.log('📝 Notas:', notes || 'Nenhuma');
    console.log('🔄 Forçar aprovação:', forceApproval || false);
    
    const forceApprovalEnabled = forceApproval === true;

    if (!approverEmail || typeof approverEmail !== 'string' || !isValidEmail(approverEmail)) {
      return NextResponse.json({ success: false, error: 'Email do aprovador inválido' }, { status: 400 });
    }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        creator: {
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

    if (!proposal) {
      return NextResponse.json({ success: false, error: 'Proposta não encontrada' }, { status: 404 });
    }

    const permissions = getPermissionsForRole(normalizeUserRole(currentUser.role));
    const isOwner = proposal.created_by === currentUser.id;
    if (!permissions.canEditProposals || (!permissions.canViewAllProposals && !isOwner)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para solicitar aprovação desta proposta' },
        { status: 403 }
      );
    }

    const proposalMetadata = (proposal.metadata || {}) as Record<string, any>;
    const rawAccountManagerEmail = getProposalAccountManagerEmail(proposal);
    const normalizedAccountManagerEmail =
      rawAccountManagerEmail && isValidEmail(rawAccountManagerEmail)
        ? extractEmailAddress(rawAccountManagerEmail)
        : null;
    const fallbackAccountManagerEmail =
      currentUser?.email && isValidEmail(currentUser.email)
        ? extractEmailAddress(currentUser.email)
        : null;
    const accountManagerEmail = normalizedAccountManagerEmail || fallbackAccountManagerEmail;
    const evaluatedPolicy = evaluateProposalApprovalPolicy({
      products: proposal.products,
      metadata: proposalMetadata,
      appliedDirectorDiscountPercentage: proposalMetadata.appliedDirectorDiscountPercentage,
    });
    const manualReason = {
      code: 'MANUAL_OVERRIDE',
      label: 'Aprovação solicitada manualmente',
      details: 'Solicitação enviada manualmente pelo responsável da proposta.',
    } as const;

    const approvalPolicy =
      !evaluatedPolicy.requiresApproval && forceApprovalEnabled
        ? {
            ...evaluatedPolicy,
            requiresApproval: true,
            reasons: [...evaluatedPolicy.reasons, manualReason],
          }
        : evaluatedPolicy;
    const approvalPolicyToSave = approvalPolicy as any;
    const approvalReasonsToSave = approvalPolicy.reasons as any;

    if (!approvalPolicy.requiresApproval) {
      return NextResponse.json(
        {
          success: false,
          error: 'Esta proposta está dentro do padrão e não requer aprovação interna. Ative o envio manual para continuar.',
          approvalPolicy,
        },
        { status: 400 }
      );
    }

    const normalizedApproverEmail = extractEmailAddress(approverEmail);
    const allowedApproverEmails = getAllowedApproverEmails();

    if (
      allowedApproverEmails.length > 0 &&
      !allowedApproverEmails.includes(normalizedApproverEmail)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Aprovador não autorizado. Use um dos emails permitidos ou atualize a lista de aprovadores.',
        },
        { status: 400 }
      );
    }
    
    // Tentar buscar o aprovador no banco
    let approver = await prisma.user.findUnique({
      where: { email: normalizedApproverEmail },
      include: {
        profile: {
          select: {
            full_name: true,
            role: true,
          },
        },
      },
    });

    if (!approver) {
      approver = await prisma.user.findFirst({
        where: {
          OR: [
            { email: approverEmail.trim() },
            { email: normalizedApproverEmail },
            { email: approverEmail.trim().toLowerCase() },
            { email: approverEmail.trim().toUpperCase() },
          ],
        },
        include: {
          profile: {
            select: {
              full_name: true,
              role: true,
            },
          },
        },
      });
    }

    // Se o aprovador não existe no banco, criar registro mínimo (uuid válido)
    if (!approver) {
      console.log('⚠️ Aprovador não encontrado no banco, criando cadastro mínimo');
      console.log('📧 Email:', normalizedApproverEmail);

      const approverName = normalizedApproverEmail.split('@')[0];

      approver = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: normalizedApproverEmail,
            email_confirmed_at: new Date(),
            role: 'director',
            account_status: 'approved',
          },
        });

        await tx.profile.create({
          data: {
            id: createdUser.id,
            full_name: approverName,
            email: normalizedApproverEmail,
            role: 'director',
          },
        });

        await tx.userCompat.create({
          data: {
            id: createdUser.id,
            email: normalizedApproverEmail,
            role: 'director',
          },
        });

        return tx.user.findUnique({
          where: { id: createdUser.id },
          include: {
            profile: {
              select: {
                full_name: true,
                role: true,
              },
            },
          },
        });
      });
    } else {
      // Validar apenas se o aprovador existe no banco
      if (approver.account_status !== 'approved' && !approver.is_super_admin) {
        return NextResponse.json({ success: false, error: 'Aprovador sem conta ativa para aprovação' }, { status: 400 });
      }

      const approverRole = normalizeUserRole(approver.profile?.role || approver.role);
      if (approverRole !== 'admin' && approverRole !== 'director') {
        return NextResponse.json(
          { success: false, error: 'Aprovador precisa ser administrador ou diretor' },
          { status: 400 }
        );
      }
    }

    if (!approver) {
      return NextResponse.json({ success: false, error: 'Aprovador inválido' }, { status: 400 });
    }

    const proposalCreatorEmail = proposal.creator?.email?.trim().toLowerCase() || null;
    const approverEmailNormalized = extractEmailAddress(approver?.email || normalizedApproverEmail);
    const ccRecipients = normalizeEmailList([
      proposalCreatorEmail,
      accountManagerEmail,
      ...getFixedApprovalCcEmails(),
    ]).filter((email) => !approverEmailNormalized || email !== approverEmailNormalized);

    const baseUrl = process.env.NEXTAUTH_URL || request.headers.get('origin') || 'http://localhost:3000';

    const pendingWorkflow = await prisma.approvalWorkflow.findFirst({
      where: {
        entity_type: 'proposal',
        entity_id: proposal.id,
        status: 'pending',
      },
      select: {
        id: true,
        current_approver: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (pendingWorkflow) {
      if (pendingWorkflow.current_approver !== approver.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Já existe uma aprovação pendente com outro aprovador para esta proposta.',
            workflowId: pendingWorkflow.id,
          },
          { status: 409 }
        );
      }

      const firstAttempt = await sendApprovalRequestEmail({
        workflowId: pendingWorkflow.id,
        proposalId: proposal.id,
        approverId: approver.id,
        approverEmail: extractEmailAddress(approver.email),
        proposalBaseId: proposal.base_id,
        proposalTitle: proposal.title,
        proposalType: proposal.type,
        requestorName: currentUser.full_name || currentUser.email,
        reasons: approvalPolicy.reasons,
        notes: notes || null,
        ccRecipients,
        baseUrl,
      });
      let resendResult = firstAttempt;
      let finalCcRecipients = ccRecipients;
      let ccDropped = false;

      if (!firstAttempt.success && ccRecipients.length > 0) {
        const secondAttempt = await sendApprovalRequestEmail({
          workflowId: pendingWorkflow.id,
          proposalId: proposal.id,
          approverId: approver.id,
          approverEmail: extractEmailAddress(approver.email),
          proposalBaseId: proposal.base_id,
          proposalTitle: proposal.title,
          proposalType: proposal.type,
          requestorName: currentUser.full_name || currentUser.email,
          reasons: approvalPolicy.reasons,
          notes: notes || null,
          ccRecipients: [],
          baseUrl,
        });
        if (secondAttempt.success) {
          resendResult = secondAttempt;
          finalCcRecipients = [];
          ccDropped = true;
        }
      }

      if (resendResult.success) {
        await prisma.proposal.update({
          where: { id: proposal.id },
          data: {
            status: DIRECTOR_PENDING_STATUS,
            metadata: {
              ...proposalMetadata,
              ...(accountManagerEmail ? { accountManagerEmail } : {}),
              approvalPolicy: approvalPolicyToSave,
              approval: {
                ...(proposalMetadata.approval || {}),
                status: 'pending',
                workflowId: pendingWorkflow.id,
                approverId: approver.id,
                approverEmail: approver.email,
                ccRecipients: finalCcRecipients,
                emailSent: true,
                emailSentAt: new Date().toISOString(),
                ccDropped,
              },
            },
          },
        });
      } else {
        await prisma.proposal.update({
          where: { id: proposal.id },
          data: {
            status: DIRECTOR_PENDING_STATUS,
            metadata: {
              ...proposalMetadata,
              ...(accountManagerEmail ? { accountManagerEmail } : {}),
              approvalPolicy: approvalPolicyToSave,
              approval: {
                ...(proposalMetadata.approval || {}),
                status: 'pending',
                workflowId: pendingWorkflow.id,
                approverId: approver.id,
                approverEmail: approver.email,
                ccRecipients: finalCcRecipients,
                emailSent: false,
                emailStatus: resendResult.status,
                emailError: parseResendErrorBody(resendResult.body),
                emailLastAttemptAt: new Date().toISOString(),
                ccDropped,
              },
            },
          },
        });
      }

      return NextResponse.json(
        {
          success: true,
          message: resendResult.success
            ? ccDropped
              ? 'Aprovação pendente encontrada. E-mail reenviado ao aprovador sem cópia para garantir a entrega.'
              : 'Aprovação pendente encontrada. E-mail reenviado com sucesso.'
            : 'Aprovação pendente encontrada, mas o reenvio de e-mail falhou.',
          workflowId: pendingWorkflow.id,
          emailSent: resendResult.success,
          emailStatus: resendResult.status,
          emailError: resendResult.success ? null : parseResendErrorBody(resendResult.body),
          notifiedCc: finalCcRecipients,
          ccDropped,
          pendingWorkflowReused: true,
        },
        { status: 200 }
      );
    }

    const createdAtIso = new Date().toISOString();
    const transactionResult = await prisma.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.create({
        data: {
          entity_type: 'proposal',
          entity_id: proposal.id,
          workflow_type: 'approval',
          current_step: 1,
          total_steps: 1,
          status: 'pending',
          requested_by: currentUser.id,
          current_approver: approver.id,
          metadata: {
            approvalPolicy: approvalPolicyToSave,
            notes: notes || null,
            forceApproval: forceApprovalEnabled,
            creatorEmail: proposalCreatorEmail,
            accountManagerEmail,
            ccRecipients,
            reminderSentAt: null,
            reminderCount: 0,
          },
        },
      });

      await tx.approvalStep.create({
        data: {
          workflow_id: workflow.id,
          step_number: 1,
          approver_id: approver.id,
          status: 'pending',
          comments: notes || null,
        },
      });

      const updatedProposal = await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: DIRECTOR_PENDING_STATUS,
          metadata: {
            ...proposalMetadata,
            ...(accountManagerEmail ? { accountManagerEmail } : {}),
            approvalPolicy: approvalPolicyToSave,
            approval: {
              status: 'pending',
              workflowId: workflow.id,
              requestedAt: createdAtIso,
              requestedBy: currentUser.id,
              approverId: approver.id,
              approverEmail: approver.email,
              reasons: approvalReasonsToSave,
              notes: notes || null,
              forceApproval: forceApprovalEnabled,
              creatorEmail: proposalCreatorEmail,
              accountManagerEmail,
              ccRecipients,
              emailSent: false,
            },
          },
        },
      });

      return { workflow, updatedProposal };
    });

    const firstAttempt = await sendApprovalRequestEmail({
      workflowId: transactionResult.workflow.id,
      proposalId: proposal.id,
      approverId: approver.id,
      approverEmail: extractEmailAddress(approver.email),
      proposalBaseId: proposal.base_id,
      proposalTitle: proposal.title,
      proposalType: proposal.type,
      requestorName: currentUser.full_name || currentUser.email,
      reasons: approvalPolicy.reasons,
      notes: notes || null,
      ccRecipients,
      baseUrl,
    });
    let emailResult = firstAttempt;
    let finalCcRecipients = ccRecipients;
    let ccDropped = false;

    if (!firstAttempt.success && ccRecipients.length > 0) {
      const secondAttempt = await sendApprovalRequestEmail({
        workflowId: transactionResult.workflow.id,
        proposalId: proposal.id,
        approverId: approver.id,
        approverEmail: extractEmailAddress(approver.email),
        proposalBaseId: proposal.base_id,
        proposalTitle: proposal.title,
        proposalType: proposal.type,
        requestorName: currentUser.full_name || currentUser.email,
        reasons: approvalPolicy.reasons,
        notes: notes || null,
        ccRecipients: [],
        baseUrl,
      });
      if (secondAttempt.success) {
        emailResult = secondAttempt;
        finalCcRecipients = [];
        ccDropped = true;
      }
    }

    if (emailResult.success) {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          metadata: {
            ...(transactionResult.updatedProposal.metadata as any),
            approval: {
              ...((transactionResult.updatedProposal.metadata as any)?.approval || {}),
              ccRecipients: finalCcRecipients,
              emailSent: true,
              emailSentAt: new Date().toISOString(),
              ccDropped,
            },
          },
        },
      });
    } else {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          metadata: {
            ...(transactionResult.updatedProposal.metadata as any),
            approval: {
              ...((transactionResult.updatedProposal.metadata as any)?.approval || {}),
              ccRecipients: finalCcRecipients,
              emailSent: false,
              emailStatus: emailResult.status,
              emailError: parseResendErrorBody(emailResult.body),
              emailLastAttemptAt: new Date().toISOString(),
              ccDropped,
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: emailResult.success
        ? ccDropped
          ? 'Solicitação enviada ao aprovador sem cópia para garantir a entrega.'
          : 'Solicitação enviada para aprovação com sucesso'
        : 'Solicitação registrada, mas o envio de e-mail falhou',
      workflowId: transactionResult.workflow.id,
      emailSent: emailResult.success,
      emailStatus: emailResult.status,
      emailError: emailResult.success ? null : parseResendErrorBody(emailResult.body),
      notifiedCc: finalCcRecipients,
      ccDropped,
      approvalPolicy,
    });
  } catch (error: any) {
    console.error('Erro ao solicitar aprovação da proposta:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno ao solicitar aprovação' },
      { status: 500 }
    );
  }
}
