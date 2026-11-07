export default function LeadNextActionFields({ value, onChange, sellers, prefix = 'lead', disabled = false }) {
  return (
    <fieldset disabled={disabled} className="crm-panel-muted space-y-3 p-4 md:col-span-2">
      <legend className="px-1 text-sm font-bold text-[var(--crm-ink)]">Próxima ação do lead</legend>
      <div>
        <label htmlFor={`${prefix}-action`} className="mb-1.5 block text-sm font-semibold">O que fazer?</label>
        <input id={`${prefix}-action`} className="crm-input" maxLength={1000} value={value.leadNextAction}
          onChange={(event) => onChange('leadNextAction', event.target.value)} placeholder="Ex.: ligar para apresentar a proposta" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-when`} className="mb-1.5 block text-sm font-semibold">Data e horário (seu fuso local)</label>
          <input id={`${prefix}-when`} type="datetime-local" className="crm-input" required={Boolean(value.leadNextAction.trim())}
            value={value.leadNextActionAt} onChange={(event) => onChange('leadNextActionAt', event.target.value)} />
        </div>
        <div>
          <label htmlFor={`${prefix}-reminder`} className="mb-1.5 block text-sm font-semibold">Lembrar por e-mail</label>
          <select id={`${prefix}-reminder`} className="crm-input" value={value.leadReminderMinutes}
            onChange={(event) => onChange('leadReminderMinutes', Number(event.target.value))}>
            <option value={0}>No horário</option><option value={15}>15 minutos antes</option>
            <option value={30}>30 minutos antes</option><option value={60}>1 hora antes</option><option value={1440}>1 dia antes</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${prefix}-owner`} className="mb-1.5 block text-sm font-semibold">Gerente de contas responsável</label>
          <select id={`${prefix}-owner`} className="crm-input" value={value.accountManagerId}
            onChange={(event) => onChange('accountManagerId', event.target.value)}>
            <option value="">Selecione o responsável</option>
            {value.accountManagerId && !sellers.some((seller) => seller.id === value.accountManagerId) && (
              <option value={value.accountManagerId}>Responsável atual</option>
            )}
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}{seller.email ? ` (${seller.email})` : ''}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-[var(--crm-muted)]">O responsável deve conectar sua agenda nesta tela. O CRM envia e atualiza o compromisso; alterações feitas na agenda não retornam ao lead. Duração: 30 minutos.</p>
    </fieldset>
  );
}
