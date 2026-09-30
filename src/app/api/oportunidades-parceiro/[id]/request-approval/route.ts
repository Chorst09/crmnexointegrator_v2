import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// POST - Solicitar aprovação de oportunidade
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Obter usuário autenticado
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = await getCurrentUser(token);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Buscar oportunidade
    const oportunidade = await prisma.oportunidadeParceiro.findUnique({
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

    if (!oportunidade) {
      return NextResponse.json(
        { error: 'Oportunidade não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o usuário é o criador
    if (oportunidade.created_by !== currentUser.id) {
      return NextResponse.json(
        { error: 'Apenas o criador pode solicitar aprovação' },
        { status: 403 }
      );
    }

    // Buscar todos os diretores e admins para enviar email
    const approvers = await prisma.$queryRaw<Array<{
      id: string;
      email: string;
      full_name: string | null;
      role: string;
    }>>`
      SELECT 
        u.id,
        u.email,
        p.full_name,
        COALESCE(p.role, u.role) as role
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.account_status = 'approved'
        AND (u.role IN ('admin', 'director') OR p.role IN ('admin', 'director'))
    `;

    if (approvers.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum aprovador encontrado no sistema' },
        { status: 404 }
      );
    }

    // Enviar email para todos os aprovadores
    const emailPromises = approvers.map(approver =>
      sendApprovalRequestEmail({
        oportunidade,
        approver,
        requestorName: currentUser.full_name || currentUser.email,
      })
    );

    const emailResults = await Promise.allSettled(emailPromises);
    const successCount = emailResults.filter(r => r.status === 'fulfilled').length;

    return NextResponse.json({
      success: true,
      message: `Solicitação enviada para ${successCount} aprovador(es)`,
      emailsSent: successCount,
      totalApprovers: approvers.length,
    });
  } catch (error) {
    console.error('Erro ao solicitar aprovação:', error);
    return NextResponse.json(
      { error: 'Erro ao solicitar aprovação' },
      { status: 500 }
    );
  }
}

// Função auxiliar para enviar email de solicitação
async function sendApprovalRequestEmail({
  oportunidade,
  approver,
  requestorName,
}: {
  oportunidade: any;
  approver: any;
  requestorName: string;
}) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const approverName = approver.full_name || approver.email;
  
  const emailContent = {
    to: [approver.email],
    subject: `🔔 Nova Oportunidade Aguardando Aprovação - ${oportunidade.numero_oportunidade_ext}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Solicitação de Aprovação</h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
            Olá <strong>${approverName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
            Uma nova oportunidade de parceiro foi cadastrada e aguarda sua aprovação.
          </p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">📋 Detalhes da Oportunidade</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Número:</td>
                <td style="padding: 8px 0; color: #1f2937;">${oportunidade.numero_oportunidade_ext}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Fabricante:</td>
                <td style="padding: 8px 0; color: #1f2937;">${oportunidade.nome_fabricante}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Cliente:</td>
                <td style="padding: 8px 0; color: #1f2937;">${oportunidade.cliente_nome}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Contato:</td>
                <td style="padding: 8px 0; color: #1f2937;">${oportunidade.contato_nome}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Produto:</td>
                <td style="padding: 8px 0; color: #1f2937;">${oportunidade.produto_descricao}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Valor:</td>
                <td style="padding: 8px 0; color: #059669; font-weight: bold; font-size: 18px;">
                  ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(oportunidade.valor)}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Gerente:</td>
                <td style="padding: 8px 0; color: #1f2937;">${oportunidade.gerente_contas || 'Não informado'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Solicitante:</td>
                <td style="padding: 8px 0; color: #1f2937;">${requestorName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Data:</td>
                <td style="padding: 8px 0; color: #1f2937;">${new Date().toLocaleString('pt-BR')}</td>
              </tr>
            </table>
          </div>
          
          ${oportunidade.observacoes ? `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>📝 Observações:</strong><br>
              ${oportunidade.observacoes}
            </p>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/gestao-oportunidades" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              🔗 Acessar Sistema e Aprovar
            </a>
          </div>
          
          <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>ℹ️ Instruções:</strong><br>
              Acesse o sistema, revise os detalhes da oportunidade e clique em "Aprovar" ou "Negar" para processar a solicitação.
            </p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
            Este email foi enviado automaticamente pelo sistema Simuladores Double TI.<br>
            Não responda a este email.
          </p>
        </div>
      </div>
    `
  };

  // Tentar enviar via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Simuladores Double TI <onboarding@resend.dev>',
          to: emailContent.to,
          subject: emailContent.subject,
          html: emailContent.html,
        }),
      });

      if (resendResponse.ok) {
        console.log('✅ Email de solicitação enviado com sucesso para:', approver.email);
        return { success: true };
      } else {
        const errorText = await resendResponse.text();
        console.error('❌ Erro ao enviar via Resend:', errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error('❌ Erro de conexão com Resend:', error);
      return { success: false, error };
    }
  }

  console.log('📧 Email não enviado - Resend não configurado');
  console.log('📧 Email que seria enviado para:', approver.email);
  return { success: false, error: 'Resend não configurado' };
}
