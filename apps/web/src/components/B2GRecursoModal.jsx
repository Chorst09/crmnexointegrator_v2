import { useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import Modal from './Modal';

const RECURSO_TYPES = [
  'Recurso Administrativo',
  'Recurso Hierárquico',
  'Mandado de Segurança',
  'Ação Judicial',
  'Impugnação',
  'Outro'
];

const B2GRecursoModal = ({
  isOpen,
  onClose,
  onConfirm,
  opportunityTitle = '',
}) => {
  const [form, setForm] = useState({
    recursoType: '',
    customRecursoType: '',
    recursoDescription: '',
    mainPoints: '',
    deadline: '',
    responsibleParty: '',
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
      recursoType: '',
      customRecursoType: '',
      recursoDescription: '',
      mainPoints: '',
      deadline: '',
      responsibleParty: '',
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

    if (!form.recursoType) {
      newErrors.recursoType = 'Selecione o tipo de recurso';
    }
    if (form.recursoType === 'Outro' && !form.customRecursoType.trim()) {
      newErrors.customRecursoType = 'Especifique o tipo de recurso';
    }
    if (!form.recursoDescription.trim()) {
      newErrors.recursoDescription = 'Descreva o motivo do recurso';
    }
    if (!form.mainPoints.trim()) {
      newErrors.mainPoints = 'Informe os pontos principais do recurso';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;

    const result = {
      recursoType: form.recursoType === 'Outro' ? form.customRecursoType.trim() : form.recursoType,
      recursoDescription: form.recursoDescription.trim(),
      mainPoints: form.mainPoints.trim(),
      deadline: form.deadline || null,
      responsibleParty: form.responsibleParty.trim(),
      observations: form.observations.trim(),
      createdAt: new Date().toISOString(),
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
      title="Registrar Recurso"
      size="default"
    >
      <div className="space-y-5 p-2">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-400/40 bg-amber-500/10">
          <AlertTriangle className="h-6 w-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--crm-text)]">
              Registro de Recurso
            </p>
            {opportunityTitle && (
              <p className="text-xs text-[color:var(--crm-muted)] mt-0.5 truncate max-w-[300px]">{opportunityTitle}</p>
            )}
            <p className="text-xs text-[color:var(--crm-muted)] mt-1">
              Preencha as informações obrigatórias sobre o recurso interposto.
            </p>
          </div>
        </div>

        {/* Recurso Type */}
        <div>
          <label className={labelCls}>Tipo de Recurso *</label>
          <div className="space-y-2">
            {RECURSO_TYPES.map(type => (
              <label
                key={type}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  form.recursoType === type
                    ? 'border-amber-400/60 bg-amber-500/10'
                    : 'border-[color:var(--crm-border)] hover:border-amber-300/30'
                }`}
              >
                <input
                  type="radio"
                  name="recursoType"
                  value={type}
                  checked={form.recursoType === type}
                  onChange={e => set('recursoType', e.target.value)}
                  className="accent-amber-500"
                />
                <span className="text-sm font-medium text-[color:var(--crm-ink)]">{type}</span>
              </label>
            ))}
          </div>
          {errors.recursoType && <p className={errorCls}>{errors.recursoType}</p>}
          {form.recursoType === 'Outro' && (
            <input
              type="text"
              value={form.customRecursoType}
              onChange={e => set('customRecursoType', e.target.value)}
              placeholder="Especifique o tipo de recurso..."
              className={inputCls + ' mt-2'}
            />
          )}
          {errors.customRecursoType && <p className={errorCls}>{errors.customRecursoType}</p>}
        </div>

        {/* Recurso Description */}
        <div>
          <label className={labelCls}>Motivo do Recurso *</label>
          <textarea
            className={inputCls + ' min-h-[100px] resize-none'}
            rows={4}
            placeholder="Descreva detalhadamente o motivo do recurso interposto..."
            value={form.recursoDescription}
            onChange={e => set('recursoDescription', e.target.value)}
          />
          {errors.recursoDescription && <p className={errorCls}>{errors.recursoDescription}</p>}
        </div>

        {/* Main Points */}
        <div>
          <label className={labelCls}>Pontos Principais do Recurso *</label>
          <textarea
            className={inputCls + ' min-h-[100px] resize-none'}
            rows={4}
            placeholder="Liste os principais argumentos e pontos do recurso:
1. 
2. 
3. 
4. 
5. "
            value={form.mainPoints}
            onChange={e => set('mainPoints', e.target.value)}
          />
          {errors.mainPoints && <p className={errorCls}>{errors.mainPoints}</p>}
        </div>

        {/* Deadline */}
        <div>
          <label className={labelCls}>Prazo para Impugnação</label>
          <input
            type="date"
            className={inputCls}
            value={form.deadline}
            onChange={e => set('deadline', e.target.value)}
          />
        </div>

        {/* Responsible Party */}
        <div>
          <label className={labelCls}>Responsável pelo Recurso</label>
          <input
            type="text"
            className={inputCls}
            placeholder="Ex: Dr. João Silva - Advogado"
            value={form.responsibleParty}
            onChange={e => set('responsibleParty', e.target.value)}
          />
        </div>

        {/* Observations */}
        <div>
          <label className={labelCls}>Observações Adicionais</label>
          <textarea
            className={inputCls + ' min-h-[60px] resize-none'}
            rows={2}
            placeholder="Informações complementares sobre o recurso..."
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
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-amber-600 hover:bg-amber-500 shadow-[0_8px_20px_rgba(245,158,11,0.3)]"
          >
            Confirmar Recurso
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default B2GRecursoModal;
