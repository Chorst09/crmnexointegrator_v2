import { useState } from 'react';
import { PauseCircle, AlertCircle } from 'lucide-react';
import Modal from './Modal';

const SUSPENSO_REASONS = [
  'Impugnação de outros participantes',
  'Alteração no Edital',
  'Suspensão Judicial',
  'Questões Administrativas',
  'Falta de Documentação',
  'Prazo de Habilitação Estendido',
  'Recurso de Terceiros',
  'Fiscalização Pendente',
  'Outro'
];

const B2GSuspensoModal = ({
  isOpen,
  onClose,
  onConfirm,
  opportunityTitle = '',
}) => {
  const [form, setForm] = useState({
    suspensoReason: '',
    customSuspensoReason: '',
    suspensionDetails: '',
    expectedReturnDate: '',
    impactAnalysis: '',
    actionsToResolve: '',
    observations: '',
  });

  const [errors, setErrors] = useState({});

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const resetForm = () => {
    setForm({
      suspensoReason: '',
      customSuspensoReason: '',
      suspensionDetails: '',
      expectedReturnDate: '',
      impactAnalysis: '',
      actionsToResolve: '',
      observations: '',
    });
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = () => {
    const newErrors = {};

    if (!form.suspensoReason) {
      newErrors.suspensoReason = 'Selecione o motivo da suspensão';
    }
    if (form.suspensoReason === 'Outro' && !form.customSuspensoReason.trim()) {
      newErrors.customSuspensoReason = 'Especifique o motivo da suspensão';
    }
    if (!form.suspensionDetails.trim()) {
      newErrors.suspensionDetails = 'Descreva os detalhes da suspensão';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;

    const result = {
      suspensoReason: form.suspensoReason === 'Outro' ? form.customSuspensoReason.trim() : form.suspensoReason,
      suspensionDetails: form.suspensionDetails.trim(),
      expectedReturnDate: form.expectedReturnDate || null,
      impactAnalysis: form.impactAnalysis.trim(),
      actionsToResolve: form.actionsToResolve.trim(),
      observations: form.observations.trim(),
      suspendedAt: new Date().toISOString(),
    };
    onConfirm(result);
    resetForm();
  };

  const inputCls = 'w-full rounded-lg border border-[color:var(--crm-border)] bg-[color:var(--crm-surface)] text-[color:var(--crm-text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[color:var(--crm-muted)]/50';
  const labelCls = 'text-xs font-medium text-[color:var(--crm-muted)] mb-1 block';
  const errorCls = 'text-xs text-red-500 mt-1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Suspensão"
      size="default"
    >
      <div className="space-y-5 p-2">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-400/40 bg-slate-500/10">
          <PauseCircle className="h-6 w-6 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--crm-text)]">
              Registro de Suspensão
            </p>
            {opportunityTitle && (
              <p className="text-xs text-[color:var(--crm-muted)] mt-0.5 truncate max-w-[300px]">{opportunityTitle}</p>
            )}
            <p className="text-xs text-[color:var(--crm-muted)] mt-1">
              Informe o motivo da suspensão e os próximos passos.
            </p>
          </div>
        </div>

        {/* Suspension Reason */}
        <div>
          <label className={labelCls}>Motivo da Suspensão *</label>
          <div className="space-y-2">
            {SUSPENSO_REASONS.map(reason => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  form.suspensoReason === reason
                    ? 'border-slate-400/60 bg-slate-500/10'
                    : 'border-[color:var(--crm-border)] hover:border-slate-300/30'
                }`}
              >
                <input
                  type="radio"
                  name="suspensoReason"
                  value={reason}
                  checked={form.suspensoReason === reason}
                  onChange={e => set('suspensoReason', e.target.value)}
                  className="accent-slate-500"
                />
                <span className="text-sm font-medium text-[color:var(--crm-ink)]">{reason}</span>
              </label>
            ))}
          </div>
          {errors.suspensoReason && <p className={errorCls}>{errors.suspensoReason}</p>}
          {form.suspensoReason === 'Outro' && (
            <input
              type="text"
              value={form.customSuspensoReason}
              onChange={e => set('customSuspensoReason', e.target.value)}
              placeholder="Especifique o motivo da suspensão..."
              className={inputCls + ' mt-2'}
            />
          )}
          {errors.customSuspensoReason && <p className={errorCls}>{errors.customSuspensoReason}</p>}
        </div>

        {/* Suspension Details */}
        <div>
          <label className={labelCls}>Detalhes da Suspensão *</label>
          <textarea
            className={inputCls + ' min-h-[100px] resize-none'}
            rows={4}
            placeholder="Descreva detalhadamente o motivo e as circunstâncias da suspensão..."
            value={form.suspensionDetails}
            onChange={e => set('suspensionDetails', e.target.value)}
          />
          {errors.suspensionDetails && <p className={errorCls}>{errors.suspensionDetails}</p>}
        </div>

        {/* Expected Return Date */}
        <div>
          <label className={labelCls}>Data Prevista de Retomada</label>
          <input
            type="date"
            className={inputCls}
            value={form.expectedReturnDate}
            onChange={e => set('expectedReturnDate', e.target.value)}
          />
        </div>

        {/* Impact Analysis */}
        <div>
          <label className={labelCls}>Análise de Impacto</label>
          <textarea
            className={inputCls + ' min-h-[80px] resize-none'}
            rows={3}
            placeholder="Qual o impacto desta suspensão no andamento do edital?"
            value={form.impactAnalysis}
            onChange={e => set('impactAnalysis', e.target.value)}
          />
        </div>

        {/* Actions to Resolve */}
        <div>
          <label className={labelCls}>Ações para Resolução</label>
          <textarea
            className={inputCls + ' min-h-[80px] resize-none'}
            rows={3}
            placeholder="Quais ações estão sendo tomadas para resolver a suspensão?"
            value={form.actionsToResolve}
            onChange={e => set('actionsToResolve', e.target.value)}
          />
        </div>

        {/* Observations */}
        <div>
          <label className={labelCls}>Observações Adicionais</label>
          <textarea
            className={inputCls + ' min-h-[60px] resize-none'}
            rows={2}
            placeholder="Informações complementares..."
            value={form.observations}
            onChange={e => set('observations', e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[color:var(--crm-border)]">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-[color:var(--crm-border)] text-sm font-semibold text-[color:var(--crm-muted)] hover:bg-[color:var(--crm-surface)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-slate-600 hover:bg-slate-500 shadow-[0_8px_20px_rgba(100,116,139,0.3)]"
          >
            Confirmar Suspensão
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default B2GSuspensoModal;
