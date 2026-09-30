import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendResendEmail } from '@/lib/email/resend';

const MIN_HOURS_FOR_REMINDER = Number(process.env.PROPOSAL_APPROVAL_REMINDER_HOURS ?? '24');
const REMINDER_INTERVAL_HOURS = Number(process.env.PROPOSAL_APPROVAL_REMINDER_INTERVAL_HOURS ?? '24');

const canRunReminder = (request: NextRequest) => {
  const cronSecret = process.env.APPROVAL_REMINDER_CRON_SECRET;
  if (!cronSecret) return true;

  const incomingHeader = request.headers.get('x-cron-secret');
  if (incomingHeader === cronSecret) return true;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7) === cronSecret;
  }

  return false;
};

export async function GET(request: NextRequest) {
  if (!canRunReminder(request)) {
    return NextResponse.json({ success: false, error: 'Não autorizado para executar lembretes' }, { status: 401 });
  }

  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - MIN_HOURS_FOR_REMINDER * 60 * 60 * 1000);
    const reminderWindow = new Date(now.getTime() - REMINDER_INTERVAL_HOURS * 60 * 60 * 1000);

    const pendingWorkflows = await prisma.approvalWorkflow.findMany({
      where: {
        entity_type: 'proposal',
        workflow_type: 'approval',
        status: 'pending',
        created_at: { lte: threshold },
      },
      include: {
        approver: {
          select: {
            email: true,
            profile: { select: { full_name: true } },
          },
        },
        requester: {
          select: {
            email: true,
            profile: { select: { full_name: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const proposalIds = pendingWorkflows.map((workflow) => workflow.entity_id);
    const proposals = proposalIds.length
      ? await prisma.proposal.findMany({
          where: { id: { in: proposalIds } },
          select: { id: true, base_id: true, title: true },
        })
      : [];
    const proposalMap = new Map(proposals.map((proposal) => [proposal.id, proposal]));

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const workflow of pendingWorkflows) {
      const metadata = (workflow.metadata || {}) as Record<string, any>;
      const reminderSentAtRaw = metadata.reminderSentAt ? new Date(metadata.reminderSentAt) : null;
      if (reminderSentAtRaw && reminderSentAtRaw > reminderWindow) {
        skipped += 1;
        continue;
      }

      const proposal = proposalMap.get(workflow.entity_id);
      const approverEmail = workflow.approver?.email;
      if (!approverEmail || !proposal) {
        skipped += 1;
        continue;
      }

      const approverName = workflow.approver?.profile?.full_name || approverEmail;
      const requesterName = workflow.requester?.profile?.full_name || workflow.requester?.email || 'Solicitante';
      const createdAtLabel = new Date(workflow.created_at).toLocaleString('pt-BR');

      const reminderText = [
        'Lembrete de aprovação pendente',
        '',
        `Olá ${approverName},`,
        'Existe uma solicitação de aprovação pendente aguardando sua análise.',
        `Proposta: ${proposal.base_id}`,
        `Título: ${proposal.title}`,
        `Solicitante: ${requesterName}`,
        `Solicitado em: ${createdAtLabel}`,
      ].join('\n');

      const emailResult = await sendResendEmail({
        to: [approverEmail],
        subject: `Lembrete de aprovação pendente - ${proposal.base_id}`,
        text: reminderText,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
            <p><strong>Lembrete de aprovação pendente</strong></p>
            <p>Olá ${approverName},</p>
            <p>Existe uma solicitação de aprovação pendente aguardando sua análise.</p>
            <p>Proposta: ${proposal.base_id}</p>
            <p>Título: ${proposal.title}</p>
            <p>Solicitante: ${requesterName}</p>
            <p>Solicitado em: ${createdAtLabel}</p>
          </div>
        `,
      });

      if (!emailResult.success) {
        failed += 1;
        continue;
      }

      await prisma.approvalWorkflow.update({
        where: { id: workflow.id },
        data: {
          metadata: {
            ...metadata,
            reminderSentAt: new Date().toISOString(),
            reminderCount: Number(metadata.reminderCount || 0) + 1,
          },
        },
      });
      sent += 1;
    }

    return NextResponse.json({
      success: true,
      checked: pendingWorkflows.length,
      sent,
      skipped,
      failed,
      thresholds: {
        minHoursForReminder: MIN_HOURS_FOR_REMINDER,
        intervalHours: REMINDER_INTERVAL_HOURS,
      },
    });
  } catch (error: any) {
    console.error('Erro ao processar lembretes de aprovação:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao processar lembretes' },
      { status: 500 }
    );
  }
}
