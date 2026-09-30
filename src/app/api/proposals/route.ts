import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions'
import { getCurrentUser } from '@/lib/auth'
import { evaluateProposalApprovalPolicy } from '@/lib/proposals/approval-policy'

const FORECAST_TEMPERATURE_LEVELS = [0, 25, 50, 75, 100] as const;
const CLIENT_PENDING_STATUS = 'Aguardando Aprovação do Cliente';
const APPROVED_STATUS_TOKENS = new Set(['aprovada', 'aprovado']);

const parseForecastTemperature = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (FORECAST_TEMPERATURE_LEVELS.includes(parsed as any)) return parsed;
  return FORECAST_TEMPERATURE_LEVELS.reduce(
    (closest, current) => (Math.abs(current - parsed) < Math.abs(closest - parsed) ? current : closest),
    FORECAST_TEMPERATURE_LEVELS[0]
  );
};

const normalizeStatusToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const resolveStatusForCreate = (status: unknown): string => {
  if (typeof status !== 'string') return CLIENT_PENDING_STATUS;
  const trimmedStatus = status.trim();
  if (!trimmedStatus) return CLIENT_PENDING_STATUS;

  const normalized = normalizeStatusToken(trimmedStatus);
  if (APPROVED_STATUS_TOKENS.has(normalized)) {
    return CLIENT_PENDING_STATUS;
  }

  return trimmedStatus;
};

const getAuthTokenFromRequest = (request: NextRequest): string | null => {
  const tokenFromCookie = request.cookies.get('auth-token')?.value;
  if (tokenFromCookie) return tokenFromCookie;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

export async function GET(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    const currentUser = await getCurrentUser(token ?? undefined);

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const all = searchParams.get('all') === 'true' // Novo parâmetro para buscar todas
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const dashboard = searchParams.get('dashboard') === 'true' // Novo parâmetro para dashboard

    const skip = (page - 1) * limit

    // Construir filtros
    const where: any = {}
    
    // Aplicar filtro de permissões baseado na função do usuário
    const permissions = getPermissionsForRole(normalizeUserRole(currentUser.role))
    
    // ✅ CORREÇÃO BUG #1: Usar APENAS permissions, não param dashboard
    // Se o usuário NÃO pode visualizar todas as propostas, filtrar apenas as suas
    // Admins/Diretores: canViewAllProposals = true → veem TODAS
    // Usuários comuns: canViewAllProposals = false → veem APENAS as suas
    if (!permissions.canViewAllProposals) {
      // Buscar base_ids das propostas criadas pelo usuário para incluir todas as versões
      const userProposals = await prisma.proposal.findMany({
        where: { created_by: currentUser.id },
        select: { base_id: true }
      });
      
      const userBasePrefixes = new Set<string>();
      for (const p of userProposals) {
        // Extrair prefixo sem versão (ex: Prop_Inter_Fibra_001 de Prop_Inter_Fibra_001_v2)
        const prefix = p.base_id.replace(/_v\d+$/, '');
        userBasePrefixes.add(prefix);
      }
      
      if (userBasePrefixes.size > 0) {
        // Buscar propostas onde:
        // 1. created_by = usuário atual, OU
        // 2. base_id começa com algum dos prefixos do usuário (versões criadas por outros)
        where.OR = [
          { created_by: currentUser.id },
          {
            base_id: {
              in: Array.from(userBasePrefixes).flatMap(prefix => {
                // Gerar possíveis sufixos de versão (v1, v2, v3, ..., v20)
                return Array.from({ length: 20 }, (_, i) => `${prefix}_v${i + 1}`);
              })
            }
          }
        ];
      } else {
        where.created_by = currentUser.id;
      }
    }
    
    if (status) {
      where.status = status
    }
    
    if (type) {
      where.type = type
    }
    
    if (search) {
      const searchFilter = [
        { title: { contains: search, mode: 'insensitive' } },
        { base_id: { contains: search, mode: 'insensitive' } }
      ];
      if (where.OR) {
        // Combinar com filtro de permissões existente
        where.AND = [
          { OR: where.OR },
          { OR: searchFilter }
        ];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    // Buscar propostas com ou sem paginação
    const [proposalsRaw, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        skip: all ? undefined : skip,
        take: all ? undefined : limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          base_id: true,
          title: true,
          status: true,
          type: true,
          value: true,
          total_setup: true,
          total_monthly: true,
          contract_period: true,
          date: true,
          expiry_date: true,
          created_at: true,
          updated_at: true,
          version: true,
          client: true,
          client_data: true,
          account_manager: true,
          created_by: true,
          products: true,
          items_data: true,
          metadata: true,
          creator: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  full_name: true,
                  role: true
                }
              }
            }
          }
        }
      }),
      prisma.proposal.count({ where })
    ])

    // Transformar para camelCase para compatibilidade com frontend
    const proposals = proposalsRaw.map(p => {
      // Garantir que products seja um array (parse se for string)
      let products = p.products
      if (typeof products === 'string') {
        try {
          products = JSON.parse(products)
        } catch (e) {
          products = []
        }
      }
      
      // Extrair descontos do metadata  
      const metadata = p.metadata as any || {}
      
      // Debug para propostas de Internet Fibra
      if (p.type === 'FIBER' && p.base_id) {
        console.log(`📊 Proposta ${p.base_id}:`, {
          isExistingClient: metadata.isExistingClient,
          previousMonthlyFee: metadata.previousMonthlyFee
        });
      }
      
      return {
        ...p,
        createdBy: p.created_by,
        baseId: p.base_id,
        totalSetup: p.total_setup,
        totalMonthly: p.total_monthly,
        contractPeriod: p.contract_period,
        expiryDate: p.expiry_date,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        clientData: p.client_data,
        accountManager: p.account_manager,
        itemsData: p.items_data,
        products: Array.isArray(products) ? products : [],
        // Incluir descontos do metadata
        applySalespersonDiscount: metadata.applySalespersonDiscount || false,
        appliedDirectorDiscountPercentage: metadata.appliedDirectorDiscountPercentage || 0,
        baseTotalMonthly: metadata.baseTotalMonthly || p.total_monthly,
        changes: metadata.changes || null,
        // Incluir dados de cliente existente do metadata
        isExistingClient: metadata.isExistingClient || false,
        previousMonthlyFee: metadata.previousMonthlyFee || null,
        forecastTemperature: parseForecastTemperature(metadata.forecastTemperature),
        approvalPolicy: metadata.approvalPolicy || null,
        approval: metadata.approval || null,
        // Manter metadata original para compatibilidade
        metadata: p.metadata
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        proposals,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Erro ao buscar propostas:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let body: any
  let currentUser: any = null
  
  try {
    // Obter usuário autenticado
    const token = getAuthTokenFromRequest(request);
    currentUser = await getCurrentUser(token ?? undefined);

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    body = await request.json()
    
    console.log('📥 Recebendo proposta:', {
      type: body.type,
      title: body.title,
      userId: currentUser.id,
      userRole: currentUser.role,
      hasAccountManager: !!body.accountManager,
      accountManagerType: typeof body.accountManager,
      applySalespersonDiscount: body.applySalespersonDiscount,
      appliedDirectorDiscountPercentage: body.appliedDirectorDiscountPercentage,
      baseTotalMonthly: body.baseTotalMonthly,
      fields: Object.keys(body)
    })
    
    // Aceitar tanto snake_case quanto camelCase
    const {
      title,
      client,
      account_manager,
      accountManager,
      type,
      value,
      total_setup,
      totalSetup,
      total_monthly,
      totalMonthly,
      contract_period,
      contractPeriod,
      expiry_date,
      expiryDate,
      products,
      items_data,
      itemsData,
      client_data,
      clientData,
      metadata,
      base_id,
      baseId,
      date,
      status,
      version,
      forecastTemperature
    } = body

    // Gerar base_id único
    let finalBaseId = base_id || baseId
    
    // Se não foi fornecido um base_id, gerar um único
    if (!finalBaseId) {
      finalBaseId = `PROP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase()
    }
    
    console.log('🆔 Tentando salvar proposta com base_id:', finalBaseId)

    // Verificar se já existe uma proposta com este base_id
    const existingProposal = await prisma.proposal.findUnique({
      where: { base_id: finalBaseId }
    })

    if (existingProposal) {
      console.log('⚠️ base_id já existe, gerando um novo com sufixo único')
      // Se já existe, adicionar um sufixo único
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 6)
      finalBaseId = `${finalBaseId}_${timestamp}${random}`.toUpperCase()
      console.log('🆔 Novo base_id gerado:', finalBaseId)
    }

    const parsedForecastTemperature = parseForecastTemperature(metadata?.forecastTemperature ?? forecastTemperature);
    const approvalPolicy = evaluateProposalApprovalPolicy({
      products: products || [],
      metadata: metadata || {},
      appliedDirectorDiscountPercentage: metadata?.appliedDirectorDiscountPercentage ?? body.appliedDirectorDiscountPercentage,
    });
    const approvalPolicyToSave = approvalPolicy as any;
    const statusToSave = resolveStatusForCreate(status);

    // Construir metadata com descontos e dados de cliente existente
    // Priorizar valores do metadata enviado, depois do body
    const metadataToSave = {
      applySalespersonDiscount: metadata?.applySalespersonDiscount ?? body.applySalespersonDiscount ?? false,
      appliedDirectorDiscountPercentage: metadata?.appliedDirectorDiscountPercentage ?? body.appliedDirectorDiscountPercentage ?? 0,
      baseTotalMonthly: metadata?.baseTotalMonthly ?? body.baseTotalMonthly ?? total_monthly ?? totalMonthly ?? 0,
      changes: metadata?.changes ?? body.changes ?? null,
      isExistingClient: metadata?.isExistingClient ?? body.isExistingClient ?? false,
      previousMonthlyFee: metadata?.previousMonthlyFee ?? body.previousMonthlyFee ?? 0,
      forecastTemperature: parsedForecastTemperature ?? 50,
      approvalPolicy: approvalPolicyToSave
    }
    
    console.log('💾 Metadata recebido:', metadata);
    console.log('💾 Salvando metadata:', metadataToSave)

    // Se é uma nova versão (version > 1), preservar o created_by da proposta original
    // para que o usuário que criou a proposta original continue vendo todas as versões
    let createdByUserId = currentUser.id;
    const proposalVersion = version || 1;
    if (proposalVersion > 1) {
      // ✅ CORREÇÃO BUG #3: Buscar v1 diretamente por base_id e version, não por regex
      const originalProposal = await prisma.proposal.findFirst({
        where: {
          base_id: finalBaseId,
          version: 1
        },
        select: { created_by: true }
      });
      if (originalProposal?.created_by) {
        createdByUserId = originalProposal.created_by;
        console.log(`✅ Preservando created_by original: ${createdByUserId}`);
      } else {
        console.log(`⚠️ Versão original (v1) não encontrada para base_id: ${finalBaseId}`);
      }
    }

    const dataToCreate = {
      base_id: finalBaseId,
      title,
      client: client || {},
      account_manager: account_manager || accountManager || null,
      type: type || 'standard',
      status: statusToSave,
      value: value || 0,
      total_setup: total_setup || totalSetup || 0,
      total_monthly: total_monthly || totalMonthly || 0,
      contract_period: contract_period || contractPeriod || 12,
      date: date ? new Date(date) : new Date(),
      expiry_date: expiry_date || expiryDate ? new Date(expiry_date || expiryDate) : null,
      version: proposalVersion,
      products: products || [],
      items_data: items_data || itemsData || [],
      client_data: client_data || clientData || null,
      metadata: metadataToSave,
      created_by: createdByUserId
    }
    
    const proposal = await prisma.proposal.create({
      data: dataToCreate,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                full_name: true,
                role: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: proposal
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ Erro ao criar proposta:', error)
    console.error('❌ Erro detalhado:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    })
    
    // Se ainda assim houver erro de duplicata, tentar uma última vez com ID completamente aleatório
    if (error.code === 'P2002' && error.meta?.target?.includes('base_id')) {
      console.log('🔄 Tentando novamente com ID completamente aleatório')
      try {
        const randomBaseId = `PROP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`.toUpperCase()
        
        const fallbackParsedForecastTemperature = parseForecastTemperature(body.metadata?.forecastTemperature ?? body.forecastTemperature);
        const fallbackApprovalPolicy = evaluateProposalApprovalPolicy({
          products: body.products || [],
          metadata: body.metadata || {},
          appliedDirectorDiscountPercentage:
            body.metadata?.appliedDirectorDiscountPercentage ?? body.appliedDirectorDiscountPercentage,
        });
        const fallbackApprovalPolicyToSave = fallbackApprovalPolicy as any;
        const fallbackStatusToSave = resolveStatusForCreate(body.status);

        // Preservar created_by da proposta original no retry também
        let retryCreatedByUserId = currentUser.id;
        if (body.version && body.version > 1) {
          const retryBaseWithoutVersion = randomBaseId.replace(/_v\d+$/, '');
          const retryOriginal = await prisma.proposal.findFirst({
            where: {
              base_id: { startsWith: retryBaseWithoutVersion },
              created_by: { not: null }
            },
            orderBy: { version: 'asc' },
            select: { created_by: true }
          });
          if (retryOriginal?.created_by) {
            retryCreatedByUserId = retryOriginal.created_by;
          }
        }

        const proposal = await prisma.proposal.create({
          data: {
            base_id: randomBaseId,
            title: body.title,
            client: body.client || {},
            account_manager: body.account_manager || body.accountManager || null,
            type: body.type || 'standard',
            status: fallbackStatusToSave,
            value: body.value || 0,
            total_setup: body.total_setup || body.totalSetup || 0,
            total_monthly: body.total_monthly || body.totalMonthly || 0,
            contract_period: body.contract_period || body.contractPeriod || 12,
            date: body.date ? new Date(body.date) : new Date(),
            expiry_date: body.expiry_date || body.expiryDate ? new Date(body.expiry_date || body.expiryDate) : null,
            version: body.version || 1,
            products: body.products || [],
            items_data: body.items_data || body.itemsData || [],
            client_data: body.client_data || body.clientData || null,
            metadata: {
              ...(body.metadata || {}),
              forecastTemperature: fallbackParsedForecastTemperature ?? 50,
              approvalPolicy: fallbackApprovalPolicyToSave
            },
            created_by: retryCreatedByUserId
          },
          include: {
            creator: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    full_name: true,
                    role: true
                  }
                }
              }
            }
          }
        })
        
        console.log('✅ Proposta salva com ID alternativo:', randomBaseId)
        
        return NextResponse.json({
          success: true,
          data: proposal
        }, { status: 201 })
      } catch (retryError: any) {
        console.error('❌ Erro na segunda tentativa:', retryError)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Erro ao salvar proposta após múltiplas tentativas',
            details: retryError.message 
          },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
