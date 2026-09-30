'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, User, ArrowRight, Loader2 } from 'lucide-react'
import { getCRMAuthHeaders } from '@/config/api'

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

      const response = await fetch(`/api/proposals/${proposalId}/logs`, {
        headers: getCRMAuthHeaders(),
      })

      if (response.status === 404) {
        setLogs([])
        return
      }

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
        return 'bg-green-100 text-green-800'
      case 'update':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      case 'approve':
        return 'bg-emerald-100 text-emerald-800'
      case 'reject':
        return 'bg-orange-100 text-orange-800'
      case 'send':
        return 'bg-purple-100 text-purple-800'
      case 'cancel':
        return 'bg-gray-100 text-gray-800'
      case 'view':
        return 'bg-slate-100 text-slate-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
              <span className="text-sm font-medium text-gray-700">
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
            <p className="text-gray-500">Nenhum log registrado</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader className="bg-gray-50">
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
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="text-sm font-medium">
                      <div className="font-semibold text-gray-900">
                        {log.createdAtFormatted}
                      </div>
                      <div className="text-xs text-gray-500">
                        {log.createdAtTime}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {log.userName}
                          </div>
                          <div className="text-xs text-gray-500">
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

                    <TableCell className="text-sm font-medium text-gray-700">
                      {log.fieldName || '—'}
                    </TableCell>

                    <TableCell className="text-sm">
                      {log.fieldName ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">
                            {formatValue(log.oldValue)}
                          </span>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                            {formatValue(log.newValue)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-gray-600">
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
          <div className="text-sm text-gray-600">
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
