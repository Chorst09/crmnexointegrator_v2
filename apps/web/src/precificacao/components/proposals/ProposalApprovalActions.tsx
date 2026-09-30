'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProposalApprovalActionsProps {
  approvalToken?: string | null;
  rejectToken?: string | null;
  proposalId: string;
  proposalTitle?: string;
  onApprovalComplete?: () => void;
}

export function ProposalApprovalActions({
  approvalToken,
  rejectToken,
  proposalId,
  proposalTitle,
  onApprovalComplete,
}: ProposalApprovalActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const { toast } = useToast();

  const handleApprovalDecision = async (action: 'approve' | 'reject') => {
    setIsProcessing(true);
    
    try {
      const token = action === 'approve' ? approvalToken : rejectToken;
      
      if (!token) {
        toast({
          title: 'Erro',
          description: 'Token de aprovação não encontrado',
          variant: 'destructive',
        });
        return;
      }

      console.log(`📝 Enviando decisão de ${action === 'approve' ? 'aprovação' : 'rejeição'}...`);
      
      const response = await fetch('/api/proposals/approval/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          action,
          reason: reason.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar decisão');
      }

      console.log('✅ Decisão processada com sucesso:', data);

      toast({
        title: action === 'approve' ? '✅ Proposta Aprovada' : '❌ Proposta Rejeitada',
        description: data.message || `A proposta foi ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso. O solicitante receberá um email de notificação.`,
      });

      // Aguardar um pouco para o usuário ver a mensagem
      setTimeout(() => {
        if (onApprovalComplete) {
          onApprovalComplete();
        } else {
          // Redirecionar para dashboard
          window.location.href = '/';
        }
      }, 2000);

    } catch (error: any) {
      console.error('❌ Erro ao processar decisão:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao processar decisão de aprovação',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionClick = (action: 'approve' | 'reject') => {
    if (action === 'reject' && !showReasonInput) {
      setActionType(action);
      setShowReasonInput(true);
      return;
    }
    
    handleApprovalDecision(action);
  };

  if (!approvalToken && !rejectToken) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-xl font-bold text-foreground mb-2">
            Aprovação de Proposta
          </h3>
          <p className="text-muted-foreground mb-4">
            Você foi solicitado para aprovar esta proposta. Revise os detalhes abaixo e tome sua decisão.
          </p>
          
          {proposalTitle && (
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Proposta:</strong> {proposalTitle}
            </p>
          )}

          {showReasonInput && (
            <div className="mb-4">
              <Label htmlFor="rejection-reason" className="text-foreground mb-2">
                {actionType === 'reject' ? 'Motivo da Rejeição (opcional)' : 'Observações (opcional)'}
              </Label>
              <Textarea
                id="rejection-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={actionType === 'reject' ? 'Explique o motivo da rejeição...' : 'Adicione observações...'}
                className="bg-background border-input text-foreground"
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-3">
            {approvalToken && (
              <Button
                onClick={() => handleActionClick('approve')}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isProcessing && actionType === 'approve' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar Proposta
                  </>
                )}
              </Button>
            )}

            {rejectToken && (
              <Button
                onClick={() => handleActionClick('reject')}
                disabled={isProcessing}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                {isProcessing && actionType === 'reject' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar Proposta
                  </>
                )}
              </Button>
            )}

            {showReasonInput && (
              <Button
                onClick={() => {
                  setShowReasonInput(false);
                  setReason('');
                  setActionType(null);
                }}
                variant="outline"
                disabled={isProcessing}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
