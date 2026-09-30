import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { normalizeUserRole } from '@/lib/permissions';

// GET - Listar oportunidades de parceiros
export async function GET(request: NextRequest) {
  try {
    // Obter usuário autenticado
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = await getCurrentUser(token);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const fabricante = searchParams.get('fabricante');
    const status = searchParams.get('status');
    const gerenteContas = searchParams.get('gerenteContas');

    const where: any = {};
    if (fabricante) where.nome_fabricante = fabricante;
    if (status) where.status = status;
    if (gerenteContas) where.gerente_contas = gerenteContas;

    // Controle de permissões:
    // - Usuário: vê apenas suas próprias oportunidades
    // - Administrador e Diretor: veem todas
    const userRole = normalizeUserRole(currentUser.role);
    if (userRole !== 'admin' && userRole !== 'director') {
      // Usuário comum: filtrar por created_by
      where.created_by = currentUser.id;
    }

    const oportunidades = await prisma.oportunidadeParceiro.findMany({
      where,
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
        historico: {
          orderBy: { created_at: 'desc' },
          take: 5,
          include: {
            usuario: {
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
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(oportunidades);
  } catch (error) {
    console.error('Erro ao buscar oportunidades:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar oportunidades' },
      { status: 500 }
    );
  }
}

// POST - Criar nova oportunidade de parceiro
export async function POST(request: NextRequest) {
  try {
    // Obter usuário autenticado
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = await getCurrentUser(token);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('📥 Dados recebidos:', body);
    
    const {
      nome_fabricante,
      numero_oportunidade_ext,
      cliente_nome,
      contato_nome,
      contato_email,
      contato_telefone,
      produto_descricao,
      valor,
      gerente_contas,
      data_expiracao,
      observacoes,
      acompanhamentos,
    } = body;

    // Validações
    if (!nome_fabricante || !numero_oportunidade_ext || !cliente_nome || 
        !contato_nome || !contato_email || !produto_descricao || !valor || !data_expiracao) {
      console.log('❌ Validação falhou - campos faltando');
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Preparar dados, removendo created_by se for null/undefined
    const dataToCreate: any = {
      nome_fabricante,
      numero_oportunidade_ext,
      cliente_nome,
      contato_nome,
      contato_email,
      produto_descricao,
      valor,
      data_expiracao: new Date(data_expiracao),
    };

    // Adicionar campos opcionais apenas se tiverem valor
    if (contato_telefone) dataToCreate.contato_telefone = contato_telefone;
    if (gerente_contas) dataToCreate.gerente_contas = gerente_contas;
    if (observacoes) dataToCreate.observacoes = observacoes;
    if (acompanhamentos) dataToCreate.acompanhamentos = acompanhamentos;
    dataToCreate.created_by = currentUser.id;

    console.log('💾 Tentando criar com dados:', dataToCreate);

    const oportunidade = await prisma.oportunidadeParceiro.create({
      data: dataToCreate,
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

    console.log('✅ Oportunidade criada com sucesso:', oportunidade.id);

    // Enviar email de solicitação de aprovação automaticamente
    console.log('📧 Iniciando envio de emails de aprovação...');
    try {
      await sendApprovalRequestToDirectors({
        oportunidade,
        requestorName: currentUser.full_name || currentUser.email,
      });
      console.log('✅ Processo de envio de emails concluído');
    } catch (emailError) {
      console.error('❌ Erro ao enviar emails de aprovação:', emailError);
      // Não falhar a operação se o email falhar
    }

    return NextResponse.json(oportunidade, { status: 201 });
  } catch (error: any) {
    console.error('❌ Erro ao criar oportunidade:', error);
    console.error('Código do erro:', error.code);
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Número de oportunidade já existe' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: `Erro ao criar oportunidade: ${error.message}` },
      { status: 500 }
    );
  }
}


// Função auxiliar para enviar email de solicitação de aprovação aos diretores
async function sendApprovalRequestToDirectors({
  oportunidade,
  requestorName,
}: {
  oportunidade: any;
  requestorName: string;
}) {
  console.log('🔍 Buscando aprovadores no sistema...');
  try {
    // Buscar todos os diretores e admins da tabela auth.users
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

    console.log(`✅ Encontrados ${approvers.length} aprovador(es)`);
    
    if (approvers.length === 0) {
      console.log('⚠️ Nenhum aprovador encontrado no sistema');
      return;
    }

    approvers.forEach((approver, index) => {
      console.log(`  ${index + 1}. ${approver.full_name || approver.email} (${approver.email})`);
    });

    console.log(`📧 Enviando emails para ${approvers.length} aprovador(es)...`);

    // Enviar email para cada aprovador
    const emailPromises = approvers.map(approver =>
      sendApprovalRequestEmail({
        oportunidade,
        approver,
        requestorName,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ ${successCount}/${approvers.length} emails enviados com sucesso`);
    if (failedCount > 0) {
      console.log(`❌ ${failedCount} emails falharam`);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar emails de aprovação:', error);
    throw error;
  }
}

// Função auxiliar para enviar email individual
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
    console.log(`📤 Enviando email para ${approver.email}...`);
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

      const responseData = await resendResponse.json();

      if (resendResponse.ok) {
        console.log(`✅ Email enviado com sucesso para: ${approver.email} (ID: ${responseData.id})`);
        return { success: true, id: responseData.id };
      } else {
        console.error(`❌ Erro ao enviar via Resend para ${approver.email}`);
        console.error('Status:', resendResponse.status);
        console.error('Resposta:', JSON.stringify(responseData, null, 2));
        return { success: false, error: responseData };
      }
    } catch (error) {
      console.error(`❌ Erro de conexão com Resend ao enviar para ${approver.email}:`, error);
      return { success: false, error };
    }
  }

  console.log('⚠️ RESEND_API_KEY não configurada - email não enviado');
  console.log('📧 Email que seria enviado para:', approver.email);
  return { success: false, error: 'Resend não configurado' };
}
