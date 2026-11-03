'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Clock, User, ArrowRight, Loader2 } from 'lucide-react'

interface ProposalLog {
  id: string
  proposalId: string
  userId: string
  userName: string
  userEmail: string
  action: string
  actionLabel: string
  fieldName?: string
  oldValue?: any
  newValue?: any
  description?: string
  createdAt: Date
  createdAtFormatted: string
  createdAtTime: string
}

interface ProposalLogsModalProps {
  isOpen: boolean
  onClose: () => void
  proposalId: string
  proposalTitle: string
}

export function ProposalLogsModal({
  isOpen,
  onClose,
  proposalId,
  proposalTitle,
}: ProposalLogsModalProps) {
  const [logs, setLogs] = useState<ProposalLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && proposalId) {
      fetchLogs()
    }
  }, [isOpen, proposalId])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/proposals/${proposalId}/logs`)

      if (!response.ok) {
        throw new Error('Erro ao carregar logs')
      }

      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      console.error('Erro ao buscar logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300"
      case 'update':
        return "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
      case 'delete':
        return "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
      case 'approve':
        return "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
      case 'reject':
        return "bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300"
      case 'send':
        return "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300"
      case 'cancel':
        return "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]"
      case 'view':
        return "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]"
      default:
        return "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]"
    }
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined) {
      return '—'
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
      return JSON.stringify(value).substring(0, 50) + '...'
    }

    return String(value)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Logs
          </DialogTitle>
          <DialogDescription>
            {proposalTitle && (
              <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">
                Proposta: {proposalTitle}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium">{error}</p>
            <Button
              onClick={fetchLogs}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              Tentar Novamente
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum log registrado</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader className="bg-[rgb(var(--crm-surface-rgb)_/_1)]">
                <TableRow>
                  <TableHead className="w-32">Data/Hora</TableHead>
                  <TableHead className="w-32">Usuário</TableHead>
                  <TableHead className="w-24">Ação</TableHead>
                  <TableHead className="w-32">Campo</TableHead>
                  <TableHead className="flex-1">Alteração</TableHead>
                  <TableHead className="flex-1">Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]">
                    <TableCell className="text-sm font-medium">
                      <div className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        {log.createdAtFormatted}
                      </div>
                      <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        {log.createdAtTime}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        <div>
                          <div className="font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">
                            {log.userName}
                          </div>
                          <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                            {log.userEmail}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      <Badge className={getActionColor(log.action)}>
                        {log.actionLabel}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      {log.fieldName || '—'}
                    </TableCell>

                    <TableCell className="text-sm">
                      {log.fieldName ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded text-xs">
                            {formatValue(log.oldValue)}
                          </span>
                          <ArrowRight className="h-4 w-4 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                          <span className="px-2 py-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded text-xs">
                            {formatValue(log.newValue)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[rgb(var(--crm-muted-rgb)_/_1)]">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      <div className="max-w-xs truncate" title={log.description}>
                        {log.description || '—'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <div className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">
            <span className="font-medium">{logs.length}</span> ação(ões)
            registrada(s)
          </div>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
