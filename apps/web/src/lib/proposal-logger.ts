/**
 * Sistema de Log para Propostas
 * Registra todas as ações dos usuários (criação, edição, aprovação, etc.)
 * 
 * Uso:
 * await logProposalAction({
 *   proposalId: 'uuid',
 *   userId: 'uuid',
 *   action: 'update',
 *   fieldName: 'value',
 *   oldValue: 1000,
 *   newValue: 1500,
 *   description: 'Carlos atualizou o valor da proposta'
 * })
 */

import { prisma } from './prisma'

export interface ProposalLogInput {
  proposalId: string
  userId: string
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'send' | 'cancel' | 'view'
  fieldName?: string
  oldValue?: any
  newValue?: any
  description?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Registra uma ação em uma proposta
 */
export async function logProposalAction(input: ProposalLogInput) {
  try {
    const { proposalId, userId, action, fieldName, oldValue, newValue, description, ipAddress, userAgent } = input

    // Converter valores para JSON string se necessário
    const oldValueStr = oldValue !== undefined ? JSON.stringify(oldValue) : null
    const newValueStr = newValue !== undefined ? JSON.stringify(newValue) : null

    // Criar log no banco de dados
    const log = await prisma.proposalLog.create({
      data: {
        proposal_id: proposalId,
        user_id: userId,
        action,
        field_name: fieldName || null,
        old_value: oldValueStr,
        new_value: newValueStr,
        description: description || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        created_at: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            raw_user_meta_data: true,
          },
        },
      },
    })

    return log
  } catch (error) {
    console.error('[ProposalLogger] Erro ao registrar log:', error)
    // Não lançar erro - logging é secundário e não deve quebrar a aplicação
    return null
  }
}

/**
 * Obtém o histórico de logs de uma proposta
 */
export async function getProposalLogs(proposalId: string) {
  try {
    const logs = await prisma.proposalLog.findMany({
      where: {
        proposal_id: proposalId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            raw_user_meta_data: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    // Mapear os logs para formato legível
    return logs.map((log) => ({
      id: log.id,
      proposalId: log.proposal_id,
      userId: log.user_id,
      userName: getUserFullName(log.user),
      userEmail: log.user.email,
      action: log.action,
      actionLabel: getActionLabel(log.action),
      fieldName: log.field_name,
      oldValue: log.old_value ? JSON.parse(log.old_value) : null,
      newValue: log.new_value ? JSON.parse(log.new_value) : null,
      description: log.description,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at,
      createdAtFormatted: formatDate(log.created_at),
      createdAtTime: formatTime(log.created_at),
    }))
  } catch (error) {
    console.error('[ProposalLogger] Erro ao buscar logs:', error)
    return []
  }
}

/**
 * Obtém estatísticas de ações em uma proposta
 */
export async function getProposalLogStats(proposalId: string) {
  try {
    const logs = await prisma.proposalLog.findMany({
      where: {
        proposal_id: proposalId,
      },
    })

    const stats = {
      totalActions: logs.length,
      creates: logs.filter((l) => l.action === 'create').length,
      updates: logs.filter((l) => l.action === 'update').length,
      deletes: logs.filter((l) => l.action === 'delete').length,
      approves: logs.filter((l) => l.action === 'approve').length,
      rejects: logs.filter((l) => l.action === 'reject').length,
      sends: logs.filter((l) => l.action === 'send').length,
      cancels: logs.filter((l) => l.action === 'cancel').length,
      views: logs.filter((l) => l.action === 'view').length,
      uniqueUsers: new Set(logs.map((l) => l.user_id)).size,
      firstActionAt: logs.length > 0 ? logs[logs.length - 1].created_at : null,
      lastActionAt: logs.length > 0 ? logs[0].created_at : null,
    }

    return stats
  } catch (error) {
    console.error('[ProposalLogger] Erro ao buscar estatísticas:', error)
    return null
  }
}

/**
 * Registra uma mudança de valor em um campo específico
 */
export async function logFieldChange(
  proposalId: string,
  userId: string,
  fieldName: string,
  oldValue: any,
  newValue: any,
  userName?: string,
) {
  const description = `${userName || 'Usuário'} alterou ${fieldName} de ${formatValue(oldValue)} para ${formatValue(newValue)}`

  return logProposalAction({
    proposalId,
    userId,
    action: 'update',
    fieldName,
    oldValue,
    newValue,
    description,
  })
}

/**
 * Registra a criação de uma proposta
 */
export async function logProposalCreation(proposalId: string, userId: string, userName?: string) {
  return logProposalAction({
    proposalId,
    userId,
    action: 'create',
    description: `${userName || 'Usuário'} criou a proposta`,
  })
}

/**
 * Registra a aprovação de uma proposta
 */
export async function logProposalApproval(proposalId: string, userId: string, userName?: string, reason?: string) {
  return logProposalAction({
    proposalId,
    userId,
    action: 'approve',
    description: `${userName || 'Usuário'} aprovou a proposta${reason ? ': ' + reason : ''}`,
  })
}

/**
 * Registra a rejeição de uma proposta
 */
export async function logProposalRejection(proposalId: string, userId: string, userName?: string, reason?: string) {
  return logProposalAction({
    proposalId,
    userId,
    action: 'reject',
    description: `${userName || 'Usuário'} rejeitou a proposta${reason ? ': ' + reason : ''}`,
  })
}

/**
 * Obtém o último usuário que editou a proposta
 */
export async function getLastProposalEditor(proposalId: string) {
  try {
    const lastLog = await prisma.proposalLog.findFirst({
      where: {
        proposal_id: proposalId,
        action: {
          in: ['create', 'update'],
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            raw_user_meta_data: true,
          },
        },
      },
    })

    if (!lastLog) return null

    return {
      userId: lastLog.user_id,
      userName: getUserFullName(lastLog.user),
      userEmail: lastLog.user.email,
      action: lastLog.action,
      actionLabel: getActionLabel(lastLog.action),
      editedAt: lastLog.created_at,
      editedAtFormatted: formatDate(lastLog.created_at),
    }
  } catch (error) {
    console.error('[ProposalLogger] Erro ao buscar último editor:', error)
    return null
  }
}

// ========================
// FUNÇÕES AUXILIARES
// ========================

/**
 * Extrai o nome completo do usuário dos metadados
 */
function getUserFullName(user: any): string {
  if (!user) return 'Usuário Desconhecido'

  // Tentar extrair do raw_user_meta_data
  if (user.raw_user_meta_data?.full_name) {
    return user.raw_user_meta_data.full_name
  }

  // Tentar extrair do email
  if (user.email) {
    return user.email.split('@')[0]
  }

  return 'Usuário Desconhecido'
}

/**
 * Retorna label legível para uma ação
 */
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: 'Criou',
    update: 'Alterou',
    delete: 'Deletou',
    approve: 'Aprovou',
    reject: 'Rejeitou',
    send: 'Enviou',
    cancel: 'Cancelou',
    view: 'Visualizou',
  }
  return labels[action] || action
}

/**
 * Formata um valor para exibição
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'vazio'
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não'
  }

  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

/**
 * Formata uma data para exibição (DD/MM/YYYY)
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Formata uma hora para exibição (HH:MM:SS)
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(date))
}

/**
 * Formata data e hora juntos
 */
export function formatDateTime(date: Date): string {
  const d = new Date(date)
  const dateStr = formatDate(d)
  const timeStr = formatTime(d)
  return `${dateStr} às ${timeStr}`
}
