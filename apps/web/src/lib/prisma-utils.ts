import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

// =====================================================
// TIPOS UTILITÁRIOS
// =====================================================

// Tipos para incluir relacionamentos
// export type UserWithProfile = Prisma.UserGetPayload<{
//   include: { profile: true; user_compat: true }
// }>;

// export type OportunidadeWithRelations = Prisma.OportunidadeGetPayload<{
//   include: {
//     cliente: true;
//     responsavel: { include: { profile: true } };
//     fornecedores: { include: { fornecedor: true } };
//     atividades: true;
//     notificacoes: true;
//   }
// }>;

// export type ProposalWithCreator = Prisma.ProposalGetPayload<{
//   include: { creator: { include: { profile: true } } }
// }>;

// =====================================================
// FUNÇÕES DE VALIDAÇÃO
// =====================================================

export const validators = {
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidCNPJ(cnpj: string): boolean {
    const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
    return cnpjRegex.test(cnpj);
  },

  isValidCPF(cpf: string): boolean {
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    return cpfRegex.test(cpf);
  }
};

// =====================================================
// FUNÇÕES DE AUDITORIA
// =====================================================

export const auditService = {
  async logAction(params: {
    userId?: string;
    action: string;
    tableName: string;
    recordId?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          user_id: params.userId,
          action: params.action,
          table_name: params.tableName,
          record_id: params.recordId,
          old_values: params.oldValues ? JSON.parse(JSON.stringify(params.oldValues)) : null,
          new_values: params.newValues ? JSON.parse(JSON.stringify(params.newValues)) : null,
          ip_address: params.ipAddress,
          user_agent: params.userAgent
        }
      });
    } catch (error) {
      console.error('Erro ao registrar log de auditoria:', error);
    }
  },

  async getAuditLogs(filters?: {
    userId?: string;
    tableName?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.userId) where.user_id = filters.userId;
    if (filters?.tableName) where.table_name = filters.tableName;
    if (filters?.action) where.action = filters.action;
    if (filters?.startDate || filters?.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = filters.startDate;
      if (filters.endDate) where.created_at.lte = filters.endDate;
    }

    return await prisma.auditLog.findMany({
      where,
      include: {
        user: { include: { profile: true } }
      },
      orderBy: { created_at: 'desc' },
      take: filters?.limit || 100
    });
  }
};

// =====================================================
// FUNÇÕES DE CONFIGURAÇÃO DO SISTEMA
// =====================================================

export const configService = {
  async getConfig(key: string): Promise<any> {
    const config = await prisma.systemConfig.findUnique({
      where: { config_key: key }
    });
    return config?.config_value;
  },

  async setConfig(key: string, value: any, description?: string): Promise<void> {
    await prisma.systemConfig.upsert({
      where: { config_key: key },
      update: {
        config_value: JSON.parse(JSON.stringify(value)),
        updated_at: new Date()
      },
      create: {
        config_key: key,
        config_value: JSON.parse(JSON.stringify(value)),
        description
      }
    });
  },

  async getAllConfigs(): Promise<Record<string, any>> {
    const configs = await prisma.systemConfig.findMany();
    const result: Record<string, any> = {};

    configs.forEach((config: any) => {
      result[config.config_key] = config.config_value;
    });

    return result;
  }
};

// =====================================================
// FUNÇÕES DE TEMPLATES
// =====================================================

export const templateService = {
  async getTemplates(type?: string) {
    return await prisma.documentTemplate.findMany({
      where: {
        is_active: true,
        ...(type && { type })
      },
      include: {
        creator: { include: { profile: true } }
      },
      orderBy: { name: 'asc' }
    });
  },

  async createTemplate(data: {
    name: string;
    type: string;
    template: any;
    createdBy?: string;
  }) {
    return await prisma.documentTemplate.create({
      data: {
        name: data.name,
        type: data.type,
        template: JSON.parse(JSON.stringify(data.template)),
        created_by: data.createdBy
      }
    });
  },

  async updateTemplate(id: string, data: {
    name?: string;
    template?: any;
    is_active?: boolean;
  }) {
    return await prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.template && { template: JSON.parse(JSON.stringify(data.template)) }),
        ...(data.is_active !== undefined && { is_active: data.is_active })
      }
    });
  }
};

// =====================================================
// FUNÇÕES DE ANEXOS
// =====================================================

export const attachmentService = {
  async createAttachment(data: {
    filename: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    filePath: string;
    entityType: string;
    entityId: string;
    uploadedBy?: string;
  }) {
    return await prisma.attachment.create({
      data: {
        filename: data.filename,
        original_name: data.originalName,
        mime_type: data.mimeType,
        file_size: data.fileSize,
        file_path: data.filePath,
        entity_type: data.entityType,
        entity_id: data.entityId,
        uploaded_by: data.uploadedBy
      }
    });
  },

  async getAttachments(entityType: string, entityId: string) {
    return await prisma.attachment.findMany({
      where: {
        entity_type: entityType,
        entity_id: entityId
      },
      include: {
        uploader: { include: { profile: true } }
      },
      orderBy: { created_at: 'desc' }
    });
  },

  async deleteAttachment(id: string) {
    return await prisma.attachment.delete({
      where: { id }
    });
  }
};

// =====================================================
// FUNÇÕES DE ESTATÍSTICAS
// =====================================================

export const statsService = {
  async getDashboardStats(userId?: string) {
    const [
      totalOportunidades,
      oportunidadesAbertas,
      totalClientes,
      totalFornecedores,
      pipelineTotal,
      oportunidadesPorFase
    ] = await Promise.all([
      // Total de oportunidades
      prisma.oportunidade.count({
        where: userId ? { responsavel_id: userId } : undefined
      }),

      // Oportunidades abertas
      prisma.oportunidade.count({
        where: {
          fase: { in: ['aguardando_aprovacao', 'aprovada'] },
          ...(userId && { responsavel_id: userId })
        }
      }),

      // Total de clientes
      prisma.cliente.count({
        where: { status: 'ativo' }
      }),

      // Total de fornecedores
      prisma.fornecedor.count({
        where: { status: 'ativo' }
      }),

      // Pipeline total
      prisma.oportunidade.aggregate({
        where: {
          fase: { in: ['aguardando_aprovacao', 'aprovada'] },
          ...(userId && { responsavel_id: userId })
        },
        _sum: { valor_estimado: true }
      }),

      // Oportunidades por fase
      prisma.oportunidade.groupBy({
        by: ['fase'],
        where: userId ? { responsavel_id: userId } : undefined,
        _count: { id: true },
        _sum: { valor_estimado: true }
      })
    ]);

    return {
      totalOportunidades,
      oportunidadesAbertas,
      totalClientes,
      totalFornecedores,
      pipelineTotal: pipelineTotal._sum.valor_estimado || 0,
      oportunidadesPorFase: oportunidadesPorFase.reduce((acc: any, item: any) => {
        acc[item.fase] = {
          count: item._count.id,
          value: Number(item._sum.valor_estimado || 0)
        };
        return acc;
      }, {} as Record<string, { count: number; value: number }>)
    };
  }
};

// =====================================================
// MIDDLEWARE PARA TRANSAÇÕES COM AUDITORIA
// =====================================================

export const withAudit = async <T>(
  operation: () => Promise<T>,
  auditParams: {
    userId?: string;
    action: string;
    tableName: string;
    recordId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<T> => {
  try {
    const result = await operation();

    // Log da ação bem-sucedida
    await auditService.logAction({
      ...auditParams,
      newValues: result
    });

    return result;
  } catch (error) {
    // Log do erro
    await auditService.logAction({
      ...auditParams,
      action: `${auditParams.action}_ERROR`,
      newValues: { error: error instanceof Error ? error.message : 'Unknown error' }
    });

    throw error;
  }
};

const prismaUtils = {
  validators,
  auditService,
  configService,
  templateService,
  attachmentService,
  statsService,
  withAudit
};

export default prismaUtils;