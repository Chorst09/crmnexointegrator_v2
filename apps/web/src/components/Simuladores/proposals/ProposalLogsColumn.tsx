'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProposalLogsModal } from './ProposalLogsModal'
import { Clock } from 'lucide-react'

interface ProposalLogsColumnProps {
  proposalId: string
  proposalTitle: string
}

export function ProposalLogsColumn({
  proposalId,
  proposalTitle,
}: ProposalLogsColumnProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [logsCount, setLogsCount] = useState(0)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchLogsInfo()
  }, [proposalId])

  const fetchLogsInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/proposals/${proposalId}/logs/summary`)

      if (response.ok) {
        const data = await response.json()
        setLogsCount(data.count || 0)
        setLastAction(data.lastAction || null)
      }
    } catch (error) {
      console.error('Erro ao buscar informações de logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpenModal}
        disabled={loading}
        className="gap-2 text-sm"
      >
        <Clock className="h-4 w-4" />
        <div className="flex flex-col items-start">
          <span className="font-medium">{logsCount}</span>
          <span className="text-xs text-gray-600">
            {lastAction || 'Sem ações'}
          </span>
        </div>
      </Button>

      <ProposalLogsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        proposalId={proposalId}
        proposalTitle={proposalTitle}
      />
    </>
  )
}
