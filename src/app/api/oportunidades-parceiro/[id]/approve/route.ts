import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { normalizeUserRole } from '@/lib/permissions';

// POST - Aprovar ou negar oportunidade
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

    // Verificar permissões - apenas admin e diretor podem aprovar
    const userRole = normalizeUserRole(currentUser.role);
    if (userRole !== 'admin' && userRole !== 'director') {
      return NextResponse.json(
        { error: 'Sem permissão para aprovar oportunidades' },
        { status: 403 }
      );
    }

    const { action, observacoes } = await request.json();
    
    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { error: 'Ação inválida. Use "approve" ou "deny"' },
        { status: 400 }
      );
    }

    // Buscar oportunidade
    const oportunidade = await prisma.oportunidadeParceiro.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
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

    const statusAnterior = oportunidade.status;
    const novoStatus = action === 'approve' ? 'aprovado' : 'negado';

    // Atualizar status da oportunidade
    const oportunidadeAtualizada = await prisma.oportunidadeParceiro.update({
      where: { id },
      data: {
        status: novoStatus,
      },
      include: {
        creator: {
          select: {
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

    // Registrar no histórico
    await prisma.oportunidadeParceiroHistorico.create({
      data: {
        oportunidade_parceiro_id: id,
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        observacoes: observacoes || null,
        usuario_id: currentUser.id,
      },
    });

    // Enviar email de notificação ao criador
    try {
      await sendApprovalNotificationEmail({
        oportunidade: oportunidadeAtualizada,
        action,
        approverName: currentUser.full_name || currentUser.email,
        observacoes,
      });
    } catch (emailError) {
      console.error('Erro ao enviar email de notificação:', emailError);
      // Não falhar a operação se o email falhar
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Oportunidade aprovada com sucesso' : 'Oportunidade negada',
      oportunidade: oportunidadeAtualizada,
    });
  } catch (error) {
    console.error('Erro ao processar aprovação:', error);
    return NextResponse.json(
      { error: 'Erro ao processar aprovação' },
      { status: 500 }
    );
  }
}

// Função auxiliar para enviar email de notificação ao criador
async function sendApprovalNotificationEmail({
  oportunidade,
  action,
  approverName,
  observacoes,
}: {
  oportunidade: any;
  action: 'approve' | 'deny';
  approverName: string;
  observacoes?: string;
}) {
  const isApproved = action === 'approve';
  const creatorEmail = oportunidade.creator?.email;
  const creatorName = oportunidade.creator?.profile?.full_name || creatorEmail;

  if (!creatorEmail) {
    console.log('Email do criador não encontrado');
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  const emailContent = {
    to: [creatorEmail],
    subject: isApproved 
      ? `✅ Oportunidade Aprovada - ${oportunidade.numero_oportunidade_ext}`
      : `❌ Oportunidade Negada - ${oportunidade.numero_oportunidade_ext}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${isApproved ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'}; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ${isApproved ? '✅ Oportunidade Aprovada!' : '❌ Oportunidade Negada'}
          </h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
            Olá <strong>${creatorName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
            Sua oportunidade foi <strong style="color: ${isApproved ? '#059669' : '#dc2626'};">${isApproved ? 'APROVADA' : 'NEGADA'}</strong> por <strong>${approverName}</strong>.
          </p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isApproved ? '#10b981' : '#ef4444'};">
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
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Status:</td>
                <td style="padding: 8px 0; color: ${isApproved ? '#059669' : '#dc2626'}; font-weight: bold;">
                  ${isApproved ? '✅ APROVADO' : '❌ NEGADO'}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Aprovador:</td>
                <td style="padding: 8px 0; color: #1f2937;">${approverName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Data:</td>
                <td style="padding: 8px 0; color: #1f2937;">${new Date().toLocaleString('pt-BR')}</td>
              </tr>
            </table>
          </div>
          
          ${observacoes ? `
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>📝 Observações do Aprovador:</strong><br>
              ${observacoes}
            </p>
          </div>
          ` : ''}
          
          ${isApproved ? `
          <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #065f46; font-size: 14px;">
              <strong>🎉 Próximos Passos:</strong><br>
              Sua oportunidade foi aprovada! Você pode prosseguir com o processo comercial.
            </p>
          </div>
          ` : `
          <div style="background: #fee2e2; border: 1px solid #ef4444; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">
              <strong>ℹ️ Informação:</strong><br>
              Sua oportunidade foi negada. Revise as observações acima e entre em contato com o aprovador se necessário.
            </p>
          </div>
          `}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/gestao-oportunidades" 
               style="display: inline-block; background: ${isApproved ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              🔗 Acessar Sistema
            </a>
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
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Simuladores Double TI <noreply@chorstconsult.com.br>';
      
      console.log('📮 Enviando email de notificação...');
      console.log('  De:', fromEmail);
      console.log('  Para:', emailContent.to);
      console.log('  Assunto:', emailContent.subject);
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: emailContent.to,
          subject: emailContent.subject,
          html: emailContent.html,
        }),
      });

      if (resendResponse.ok) {
        const responseData = await resendResponse.json();
        console.log('✅ Email de notificação enviado com sucesso via Resend');
        console.log('  ID do email:', responseData.id);
        return;
      } else {
        const errorText = await resendResponse.text();
        console.error('❌ Erro ao enviar via Resend:', errorText);
      }
    } catch (error) {
      console.error('❌ Erro de conexão com Resend:', error);
    }
  } else {
    console.log('⚠️ RESEND_API_KEY não configurada');
  }

  console.log('📧 Email não enviado - Resend não configurado ou erro no envio');
}
