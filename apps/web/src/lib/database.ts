import { Pool, PoolClient } from 'pg';
import { prisma } from './prisma';
import { resolveDatabaseUrl } from './database-url';

// Configuração do pool de conexões PostgreSQL (mantido para compatibilidade)
const pool = new Pool({
  connectionString: resolveDatabaseUrl() || 'postgresql://postgres@localhost:5432/simuladores_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Função para executar queries (mantida para compatibilidade)
export async function query(text: string, params?: any[]): Promise<any> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// =====================================================
// FUNÇÕES PRISMA PARA SUBSTITUIR QUERIES DIRETAS
// =====================================================

// Funções de autenticação usando Prisma
export const authService = {
  async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      include: { profile: true, user_compat: true }
    });
  },

  async createUser(userData: {
    email: string;
    encrypted_password: string;
    full_name: string;
    role: string;
    created_by_admin?: boolean;
  }) {
    return await prisma.$transaction(async (tx: any) => {
      // Criar usuário
      const user = await tx.user.create({
        data: {
          email: userData.email,
          encrypted_password: userData.encrypted_password,
          email_confirmed_at: new Date(),
          role: 'authenticated',
          account_status: userData.created_by_admin ? 'approved' : 'pending',
          password_changed: userData.created_by_admin ? null : new Date() // null = precisa trocar senha
        }
      });

      // Criar perfil
      await tx.profile.create({
        data: {
          id: user.id,
          full_name: userData.full_name,
          email: userData.email,
          role: userData.role
        }
      });

      // Criar entrada de compatibilidade
      await tx.userCompat.create({
        data: {
          id: user.id,
          email: userData.email,
          role: userData.role
        }
      });

      return user;
    });
  }
};

// Funções de CRM usando Prisma
export const crmService = {
  async getClientes(status?: string) {
    return await prisma.cliente.findMany({
      where: status ? { status } : undefined,
      orderBy: { nome_razao_social: 'asc' }
    });
  },

  async getFornecedores(status?: string) {
    return await prisma.fornecedor.findMany({
      where: status ? { status } : undefined,
      orderBy: { nome_razao_social: 'asc' }
    });
  },

  async getOportunidades(filters?: {
    fase?: string;
    cliente_id?: string;
    responsavel_id?: string;
  }) {
    return await prisma.oportunidade.findMany({
      where: filters,
      include: {
        cliente: true,
        responsavel: { include: { profile: true } },
        fornecedores: { include: { fornecedor: true } },
        atividades: true
      },
      orderBy: { created_at: 'desc' }
    });
  },

  async createOportunidade(data: any) {
    const { fornecedores, ...oportunidadeData } = data;

    return await prisma.$transaction(async (tx: any) => {
      // Criar oportunidade
      const oportunidade = await tx.oportunidade.create({
        data: oportunidadeData,
        include: {
          cliente: true,
          responsavel: { include: { profile: true } }
        }
      });

      // Criar associações com fornecedores se houver
      if (fornecedores && fornecedores.length > 0) {
        await tx.oportunidadeFornecedor.createMany({
          data: fornecedores.map((fornecedorId: string) => ({
            oportunidade_id: oportunidade.id,
            fornecedor_id: fornecedorId
          }))
        });
      }

      return oportunidade;
    });
  },

  async createCliente(data: any) {
    return await prisma.cliente.create({
      data
    });
  },

  async createFornecedor(data: any) {
    return await prisma.fornecedor.create({
      data
    });
  }
};

// Funções de comissões usando Prisma
const toFiniteNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const commissionService = {
  async getChannelSeller() {
    const record = await prisma.commissionChannelSeller.findFirst();
    if (!record) return null;

    return {
      ...record,
      months_12: toFiniteNumber(record.months_12),
      months_24: toFiniteNumber(record.months_24),
      months_36: toFiniteNumber(record.months_36),
      months_48: toFiniteNumber(record.months_48),
      months_60: toFiniteNumber(record.months_60),
    };
  },

  async getChannelDirector() {
    const record = await prisma.commissionChannelDirector.findFirst();
    if (!record) return null;

    return {
      ...record,
      months_12: toFiniteNumber(record.months_12),
      months_24: toFiniteNumber(record.months_24),
      months_36: toFiniteNumber(record.months_36),
      months_48: toFiniteNumber(record.months_48),
      months_60: toFiniteNumber(record.months_60),
    };
  },

  async getSeller() {
    const record = await prisma.commissionSeller.findFirst();
    if (!record) return null;

    return {
      ...record,
      months_12: toFiniteNumber(record.months_12),
      months_24: toFiniteNumber(record.months_24),
      months_36: toFiniteNumber(record.months_36),
      months_48: toFiniteNumber(record.months_48),
      months_60: toFiniteNumber(record.months_60),
    };
  },

  async getChannelInfluencer() {
    const records = await prisma.commissionChannelInfluencer.findMany({
      orderBy: { revenue_min: 'asc' }
    });

    return records.map((record) => ({
      ...record,
      revenue_min: toFiniteNumber(record.revenue_min),
      revenue_max: toFiniteNumber(record.revenue_max),
      months_12: toFiniteNumber(record.months_12),
      months_24: toFiniteNumber(record.months_24),
      months_36: toFiniteNumber(record.months_36),
      months_48: toFiniteNumber(record.months_48),
      months_60: toFiniteNumber(record.months_60),
    }));
  },

  async getChannelIndicator() {
    const records = await prisma.commissionChannelIndicator.findMany({
      orderBy: { revenue_min: 'asc' }
    });

    return records.map((record) => ({
      ...record,
      revenue_min: toFiniteNumber(record.revenue_min),
      revenue_max: toFiniteNumber(record.revenue_max),
      months_12: toFiniteNumber(record.months_12),
      months_24: toFiniteNumber(record.months_24),
      months_36: toFiniteNumber(record.months_36),
      months_48: toFiniteNumber(record.months_48),
      months_60: toFiniteNumber(record.months_60),
    }));
  },

  async updateCommissionTable(table: string, id: string | undefined, data: any) {
    // Remover o id do data para evitar conflitos
    const { id: _, ...updateData } = data;
    
    // Converter valores para Decimal (números)
    const convertedData: any = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (key.startsWith('months_') || key.startsWith('revenue_')) {
        // Converter para número
        convertedData[key] = parseFloat(String(value));
      } else {
        convertedData[key] = value;
      }
    }
    
    const normalizeSingle = (record: any) => ({
      ...record,
      months_12: toFiniteNumber(record.months_12),
      months_24: toFiniteNumber(record.months_24),
      months_36: toFiniteNumber(record.months_36),
      months_48: toFiniteNumber(record.months_48),
      months_60: toFiniteNumber(record.months_60),
    });

    const normalizeRange = (record: any) => ({
      ...record,
      revenue_min: toFiniteNumber(record.revenue_min),
      revenue_max: toFiniteNumber(record.revenue_max),
      months_12: toFiniteNumber(record.months_12),
      months_24: toFiniteNumber(record.months_24),
      months_36: toFiniteNumber(record.months_36),
      months_48: toFiniteNumber(record.months_48),
      months_60: toFiniteNumber(record.months_60),
    });

    const isUuid = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    switch (table) {
      case 'channel_seller':
        if (isUuid(id)) {
          return normalizeSingle(await prisma.commissionChannelSeller.update({
            where: { id },
            data: convertedData
          }));
        }
        {
          const updated = await prisma.commissionChannelSeller.updateMany({ data: convertedData });
          if (updated.count === 0) {
            return normalizeSingle(await prisma.commissionChannelSeller.create({ data: convertedData }));
          }
          const record = await prisma.commissionChannelSeller.findFirst({ orderBy: { created_at: 'asc' } });
          if (!record) throw new Error('Tabela channel_seller está vazia');
          return normalizeSingle(record);
        }
      case 'channel_director':
        if (isUuid(id)) {
          return normalizeSingle(await prisma.commissionChannelDirector.update({
            where: { id },
            data: convertedData
          }));
        }
        {
          const updated = await prisma.commissionChannelDirector.updateMany({ data: convertedData });
          if (updated.count === 0) {
            return normalizeSingle(await prisma.commissionChannelDirector.create({ data: convertedData }));
          }
          const record = await prisma.commissionChannelDirector.findFirst({ orderBy: { created_at: 'asc' } });
          if (!record) throw new Error('Tabela channel_director está vazia');
          return normalizeSingle(record);
        }
      case 'seller':
        if (isUuid(id)) {
          return normalizeSingle(await prisma.commissionSeller.update({
            where: { id },
            data: convertedData
          }));
        }
        {
          const updated = await prisma.commissionSeller.updateMany({ data: convertedData });
          if (updated.count === 0) {
            return normalizeSingle(await prisma.commissionSeller.create({ data: convertedData }));
          }
          const record = await prisma.commissionSeller.findFirst({ orderBy: { created_at: 'asc' } });
          if (!record) throw new Error('Tabela seller está vazia');
          return normalizeSingle(record);
        }
      case 'channel_influencer':
        if (!isUuid(id)) throw new Error('ID inválido para channel_influencer');
        return normalizeRange(await prisma.commissionChannelInfluencer.update({
          where: { id },
          data: convertedData
        }));
      case 'channel_indicator':
        if (!isUuid(id)) throw new Error('ID inválido para channel_indicator');
        return normalizeRange(await prisma.commissionChannelIndicator.update({
          where: { id },
          data: convertedData
        }));
      default:
        throw new Error('Tabela de comissão inválida');
    }
  }
};

// Funções de propostas usando Prisma
export const proposalService = {
  async getProposals(filters?: {
    status?: string;
    type?: string;
    created_by?: string;
  }) {
    return await prisma.proposal.findMany({
      where: filters,
      include: {
        creator: { include: { profile: true } }
      },
      orderBy: { created_at: 'desc' }
    });
  },

  async createProposal(data: any) {
    return await prisma.proposal.create({
      data,
      include: {
        creator: { include: { profile: true } }
      }
    });
  },

  async updateProposal(id: string, data: any) {
    return await prisma.proposal.update({
      where: { id },
      data,
      include: {
        creator: { include: { profile: true } }
      }
    });
  }
};

// Função para contatos
export const contactService = {
  async createContact(data: {
    name: string;
    email: string;
    message: string;
  }) {
    return await prisma.contact.create({
      data
    });
  },

  async getContacts() {
    return await prisma.contact.findMany({
      orderBy: { created_at: 'desc' }
    });
  }
};

// Exportar Prisma
export { prisma };

// Função para executar transações
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Função para verificar a conexão
export async function checkConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    return !!result;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

// Função para fechar o pool (útil para testes)
export async function closePool(): Promise<void> {
  await pool.end();
}

// Pool exportado como named export para compatibilidade
export { pool };
