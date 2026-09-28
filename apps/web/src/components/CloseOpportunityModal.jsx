import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Trophy, XCircle } from 'lucide-react';
import Modal from './Modal';

const B2G_WIN_REASONS = [
  'Preço mais competitivo',
  'Melhor aderência técnica',
  'Desclassificação do concorrente',
  'Recurso deferido',
  'Relacionamento e estratégia',
  'Prazo ou condição de entrega',
  'Outro'
];

const B2G_LOSS_REASONS = [
  'Preço',
  'Desclassificação técnica',
  'Documentação ou habilitação',
  'Recurso indeferido',
  'Perdeu prazo',
  'Não atendeu ao edital',
  'Outro'
];

const B2G_NO_GO_REASONS = [
  'Margem inviável',
  'Risco jurídico ou técnico',
  'Prazo inviável',
  'Requisitos restritivos',
  'Sem aderência técnica',
  'Capacidade operacional',
  'Outro'
];

const B2B_WIN_REASONS = [
  'Preço ou condição comercial',
  'Relacionamento com o cliente',
  'Aderência técnica',
  'Prazo de entrega',
  'Atendimento e serviço',
  'Concorrente desclassificado',
  'Outro'
];

const B2B_LOSS_REASONS = [
  'Preço acima do esperado',
  'Concorrência venceu',
  'Prazo de entrega inviável',
  'Cliente optou por não investir',
  'Produto não atende aos requisitos',
  'Orçamento insuficiente do cliente',
  'Relacionamento com concorrente',
  'Decisão interna do cliente',
  'Outro'
];

const INITIAL_FORM = {
  competitorName: '',
  competitorPrice: '',
  ourPrice: '',
  priceDifference: '',
  outcomeReason: '',
  customReason: '',
  disqualificationReason: '',
  appealNotes: '',
  notes: ''
};

const normalizeDecision = (type) => {
  const token = String(type || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (token === 'GANHO' || token === 'WON') return 'WON';
  if (token === 'PERDIDO' || token === 'LOST') return 'LOST';
  if (token === 'NO_GO' || token === 'NOGO') return 'NO_GO';
  return token || 'WON';
};

const parseMoney = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMoneyForInput = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
};

const getReasonOptions = (clientType, decision) => {
  if (clientType === 'B2G') {
    if (decision === 'WON') return B2G_WIN_REASONS;
    if (decision === 'NO_GO') return B2G_NO_GO_REASONS;
    return B2G_LOSS_REASONS;
  }
  return decision === 'WON' ? B2B_WIN_REASONS : B2B_LOSS_REASONS;
};

const CloseOpportunityModal = ({
  isOpen,
  onClose,
  onConfirm,
  type = 'WON',
  clientType = 'B2B',
  opportunityTitle = '',
  opportunity = null
}) => {
  const decision = normalizeDecision(type);
  const isB2G = String(clientType).toUpperCase() === 'B2G';
  const isWon = decision === 'WON';
  const isNoGo = decision === 'NO_GO';
  const isLoss = decision === 'LOST';

  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      ...INITIAL_FORM,
      ourPrice: formatMoneyForInput(opportunity?.value)
    });
    setError('');
  }, [isOpen, opportunity?.value, decision]);

  const reasonOptions = useMemo(() => getReasonOptions(isB2G ? 'B2G' : 'B2B', decision), [decision, isB2G]);

  const set = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const resetAndClose = () => {
    setForm(INITIAL_FORM);
    setError('');
    onClose();
  };

  const getReason = () =>
    form.outcomeReason === 'Outro' ? form.customReason.trim() : form.outcomeReason;

  const handleConfirm = () => {
    const reason = getReason();
    const competitorName = form.competitorName.trim();

    if (!reason) {
      setError(isNoGo ? 'Informe o motivo do NO GO.' : 'Informe o motivo da decisão.');
      return;
    }

    if ((isWon || isLoss) && !competitorName) {
      setError(isWon ? 'Informe de qual concorrente ganhou.' : 'Informe para qual concorrente perdeu.');
      return;
    }

    const ourPrice = parseMoney(form.ourPrice);
    const competitorPrice = parseMoney(form.competitorPrice);
    const typedDifference = parseMoney(form.priceDifference);
    const priceDifference = typedDifference ?? (
      ourPrice !== null && competitorPrice !== null
        ? Number(Math.abs(ourPrice - competitorPrice).toFixed(2))
        : null
    );

    const stageDecisionDetails = {
      type,
      decision,
      clientType: isB2G ? 'B2G' : 'B2B',
      b2gStage: isB2G ? (decision === 'WON' ? 'GANHO' : decision === 'NO_GO' ? 'NO_GO' : 'PERDIDO') : null,
      competitorName: competitorName || null,
      wonFromCompetitor: isWon ? competitorName : null,
      lostToCompetitor: isLoss ? competitorName : null,
      ourPrice,
      finalPrice: ourPrice,
      competitorPrice,
      priceDifference,
      reason,
      winReason: isWon ? reason : null,
      lossReason: isLoss ? reason : null,
      noGoReason: isNoGo ? reason : null,
      disqualificationReason: form.disqualificationReason.trim() || null,
      appealNotes: form.appealNotes.trim() || null,
      notes: form.notes.trim() || null,
      recordedAt: new Date().toISOString()
    };

    onConfirm({
      type,
      decision,
      stageDecisionDetails,
      lossReason: isLoss || isNoGo ? reason : null
    });
    setForm(INITIAL_FORM);
    setError('');
  };

  const title = isNoGo
    ? 'Registrar NO GO'
    : isWon
      ? 'Registrar Ganho'
      : 'Registrar Perda';
  const HeaderIcon = isNoGo ? Ban : isWon ? Trophy : XCircle;
  const tone = isNoGo ? 'amber' : isWon ? 'emerald' : 'red';
  const heading = isNoGo
    ? 'Informe o motivo para não seguir'
    : isWon
      ? 'Informe os dados do ganho'
      : 'Informe os dados da perda';

  const inputCls = 'w-full rounded-xl border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] text-[color:var(--crm-ink)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[color:var(--crm-muted)]/50';
  const labelCls = 'text-xs font-semibold text-[color:var(--crm-muted)] mb-1 block';

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={title}
      size="large"
    >
      <div className="space-y-5 p-2">
        <div className={`flex items-center gap-3 rounded-xl border p-4 ${
          tone === 'emerald'
            ? 'border-emerald-400/40 bg-emerald-500/10'
            : tone === 'amber'
              ? 'border-amber-400/45 bg-amber-500/10'
              : 'border-red-400/40 bg-red-500/10'
        }`}>
          <HeaderIcon className={`h-6 w-6 shrink-0 ${
            tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-300' : 'text-red-400'
          }`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--crm-ink)]">{heading}</p>
            {opportunityTitle && (
              <p className="mt-0.5 truncate text-xs text-[color:var(--crm-muted)]">{opportunityTitle}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!isNoGo && (
          <div>
            <label className={labelCls}>
              {isWon ? 'Ganho de qual concorrente' : 'Perdido para qual concorrente'}
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder={isWon ? 'Ex: concorrente derrotado' : 'Ex: concorrente vencedor'}
              value={form.competitorName}
              onChange={(event) => set('competitorName', event.target.value)}
            />
          </div>
        )}

        {!isNoGo && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>{isWon ? 'Preço fechado (R$)' : 'Nosso preço (R$)'}</label>
              <input
                type="text"
                inputMode="decimal"
                className={inputCls}
                placeholder="0,00"
                value={form.ourPrice}
                onChange={(event) => set('ourPrice', event.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Preço do concorrente (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                className={inputCls}
                placeholder="0,00"
                value={form.competitorPrice}
                onChange={(event) => set('competitorPrice', event.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Diferença de preço (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                className={inputCls}
                placeholder="0,00"
                value={form.priceDifference}
                onChange={(event) => set('priceDifference', event.target.value)}
              />
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>
            {isNoGo ? 'Motivo do NO GO' : isWon ? 'Ganho por qual motivo' : 'Perdido por qual motivo'}
          </label>
          <select
            className={inputCls}
            value={form.outcomeReason}
            onChange={(event) => set('outcomeReason', event.target.value)}
          >
            <option value="">Selecione...</option>
            {reasonOptions.map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
          {form.outcomeReason === 'Outro' && (
            <textarea
              value={form.customReason}
              onChange={(event) => set('customReason', event.target.value)}
              placeholder="Descreva o motivo..."
              className={`${inputCls} mt-2 min-h-[70px] resize-none`}
              rows={2}
            />
          )}
        </div>

        {isB2G && !isNoGo && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Desclassificação</label>
              <textarea
                className={`${inputCls} min-h-[86px] resize-none`}
                rows={3}
                placeholder="Ex: motivo de desclassificação nossa ou do concorrente"
                value={form.disqualificationReason}
                onChange={(event) => set('disqualificationReason', event.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Recurso</label>
              <textarea
                className={`${inputCls} min-h-[86px] resize-none`}
                rows={3}
                placeholder="Ex: recurso deferido, indeferido, prazo ou observações"
                value={form.appealNotes}
                onChange={(event) => set('appealNotes', event.target.value)}
              />
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Acompanhamento</label>
          <textarea
            className={`${inputCls} min-h-[100px] resize-none`}
            rows={4}
            placeholder="Registre o contexto da decisão, próximos passos e observações relevantes."
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[color:var(--crm-border)] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={resetAndClose}
            className="crm-btn crm-btn-secondary min-w-[130px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`crm-btn min-w-[180px] text-white ${
              tone === 'emerald'
                ? 'border border-emerald-300/45 bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)]'
                : tone === 'amber'
                  ? 'border border-amber-300/45 bg-[linear-gradient(135deg,#d97706_0%,#f59e0b_100%)]'
                  : 'border border-red-400/45 bg-[linear-gradient(135deg,#dc2626_0%,#b91c1c_100%)]'
            } hover:brightness-110`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CloseOpportunityModal;
