'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { normalizeUserRole } from '@/lib/permissions';
import { CheckCircle2, MailCheck, Send } from 'lucide-react';

interface EligibilityData {
  requiresApproval: boolean;
  reasons: Array<{ label: string; details?: string }>;
  hasPendingWorkflow: boolean;
  pendingWorkflow?: {
    id: string;
    status: string;
    created_at: string;
  } | null;
}

interface ProposalApprovalRequestButtonProps {
  proposalId?: string | number | null;
  disabled?: boolean;
  onRequested?: () => void;
  onApproved?: () => void;
}

const parseEmailError = (raw: unknown): string => {
  if (!raw || typeof raw !== 'string') return 'Falha no envio de e-mail. Verifique a configuração do Resend.';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
    if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error;
    return raw;
  } catch {
    return raw;
  }
};

export function ProposalApprovalRequestButton({
  proposalId,
  disabled = false,
  onRequested,
  onApproved,
}: ProposalApprovalRequestButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [approverEmail, setApproverEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [forceApproval, setForceApproval] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const proposalIdValue = proposalId !== undefined && proposalId !== null ? String(proposalId) : null;
  const userRole = normalizeUserRole(user?.role);
  const canApproveProposal = userRole === 'admin' || userRole === 'director';
  const tokenProposalId = searchParams.get('proposalId');
  const tokenFromUrl = searchParams.get('approvalToken');
  const rejectTokenFromUrl = searchParams.get('rejectToken');
  const approvalToken =
    proposalIdValue && tokenProposalId === proposalIdValue && tokenFromUrl ? tokenFromUrl : null;
  const rejectToken =
    proposalIdValue && tokenProposalId === proposalIdValue && rejectTokenFromUrl ? rejectTokenFromUrl : null;

  useEffect(() => {
    if (!open || !proposalIdValue) return;

    let cancelled = false;
    const loadEligibility = async () => {
      setIsLoadingEligibility(true);
      try {
        const response = await fetch(`/api/proposals/${proposalIdValue}/approval/eligibility`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Falha ao avaliar aprovação');
        }
        if (!cancelled) {
          setEligibility(payload.data);
          if (payload?.data?.requiresApproval) {
            setForceApproval(false);
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          setEligibility(null);
          toast({
            title: 'Erro',
            description: error?.message || 'Não foi possível validar a necessidade de aprovação.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEligibility(false);
        }
      }
    };

    loadEligibility();
    return () => {
      cancelled = true;
    };
  }, [open, proposalIdValue, toast]);

  const handleRequestApproval = async () => {
    if (!proposalIdValue) return;

    if (!approverEmail.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o e-mail do aprovador.',
        variant: 'destructive',
      });
      return;
    }

    if (eligibility && !eligibility.requiresApproval && !forceApproval) {
      toast({
        title: 'Ação necessária',
        description: 'Ative "forçar aprovação" para enviar uma proposta dentro do padrão.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/proposals/${proposalIdValue}/approval/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverEmail: approverEmail.trim(),
          notes: notes.trim() || null,
          forceApproval,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Falha ao solicitar aprovação');
      }

      if (payload?.emailSent === false) {
        const emailErrorMessage = parseEmailError(payload?.emailError);
        toast({
          title: 'Aprovação registrada, mas o e-mail falhou',
          description: `${payload?.message || 'Não foi possível entregar o e-mail.'} Detalhe: ${emailErrorMessage}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Aprovação solicitada',
          description:
            payload?.message ||
            (payload?.ccDropped
              ? 'Solicitação enviada ao aprovador sem cópia.'
              : 'Solicitação enviada com sucesso.'),
        });
      }

      onRequested?.();

      if (payload?.emailSent !== false) {
        setOpen(false);
        setNotes('');
        setForceApproval(false);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível enviar para aprovação.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!proposalIdValue) return;

    setIsApproving(true);
    try {
      const response = await fetch('/api/proposals/approval/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          approvalToken
            ? { token: approvalToken }
            : {
                proposalId: proposalIdValue,
                action: 'approve',
              }
        ),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Falha ao aprovar proposta');
      }

      toast({
        title: 'Proposta aprovada',
        description: payload?.message || 'A proposta foi aprovada com sucesso.',
      });

      onApproved?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao aprovar',
        description: error?.message || 'Não foi possível aprovar a proposta.',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!proposalIdValue) return;

    if (!rejectReason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da negação para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setIsRejecting(true);
    try {
      const bodyPayload = rejectToken
        ? { token: rejectToken, reason: rejectReason.trim() }
        : {
            proposalId: proposalIdValue,
            action: 'reject',
            reason: rejectReason.trim(),
          };

      const response = await fetch('/api/proposals/approval/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Falha ao negar proposta');
      }

      toast({
        title: 'Proposta negada',
        description: payload?.message || 'A proposta foi negada e o solicitante será notificado.',
      });

      setRejectModalOpen(false);
      setRejectReason('');
      onApproved?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao negar',
        description: error?.message || 'Não foi possível negar a proposta.',
        variant: 'destructive',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const canOpen = !!proposalIdValue && !disabled;

  return (
    <div className="flex items-center gap-2">
      {canApproveProposal && (
        <>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleApprove}
            disabled={!canOpen || isApproving}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isApproving ? 'Aprovando...' : 'Aprovar'}
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => setRejectModalOpen(true)}
            disabled={!canOpen || isRejecting}
          >
            {isRejecting ? 'Negando...' : 'Negar'}
          </Button>

          <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Negar proposta</DialogTitle>
                <DialogDescription>
                  Informe o motivo da negação. O solicitante receberá esta informação por e-mail.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Textarea
                  rows={4}
                  placeholder="Explique o motivo da negação..."
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setRejectModalOpen(false)} disabled={isRejecting}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={isRejecting}>
                  {isRejecting ? 'Enviando...' : 'Confirmar negação'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            className="bg-amber-600 text-white hover:bg-amber-700"
            disabled={!canOpen}
          >
            <MailCheck className="mr-2 h-4 w-4" />
            Enviar para Aprovação
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar proposta para aprovação</DialogTitle>
            <DialogDescription>
              Informe o e-mail do aprovador. O sistema enviará os links seguros de aprovar/rejeitar.
            </DialogDescription>
          </DialogHeader>

          {isLoadingEligibility ? (
            <p className="text-sm text-slate-500">Validando critérios de aprovação...</p>
          ) : eligibility ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-700">Critérios detectados:</p>
                {eligibility.reasons.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {eligibility.reasons.map((reason, index) => (
                      <li key={`${reason.label}-${index}`}>
                        <span className="font-medium">{reason.label}</span>
                        {reason.details ? `: ${reason.details}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-slate-500">Nenhum critério crítico encontrado.</p>
                )}
              </div>

              {eligibility.hasPendingWorkflow && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  Já existe aprovação pendente para esta proposta (workflow: {eligibility.pendingWorkflow?.id}). Clique
                  em confirmar para reenviar o e-mail.
                </div>
              )}

              {!eligibility.requiresApproval && !eligibility.hasPendingWorkflow && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Aprovação manual</p>
                      <p className="text-xs text-amber-700">
                        A proposta está dentro do padrão. Ative para enviar mesmo assim.
                      </p>
                    </div>
                    <Switch
                      checked={forceApproval}
                      onCheckedChange={setForceApproval}
                      aria-label="Forçar envio para aprovação"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">E-mail do aprovador</label>
                <Input
                  type="email"
                  placeholder="aprovador@empresa.com"
                  value={approverEmail}
                  onChange={(event) => setApproverEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Observações (opcional)</label>
                <Textarea
                  rows={3}
                  placeholder="Contexto adicional para o aprovador..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-500">Não foi possível carregar os critérios de aprovação.</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={handleRequestApproval}
              disabled={
                isSubmitting ||
                isLoadingEligibility ||
                !eligibility ||
                (!eligibility.requiresApproval && !forceApproval)
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Enviando...' : 'Confirmar envio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
