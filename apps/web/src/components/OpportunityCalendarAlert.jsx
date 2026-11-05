import { useId, useState } from 'react';
import { Bell, X } from 'lucide-react';

const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeCalendar = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

export default function OpportunityCalendarAlert({ opportunity, notes = '' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState('');
  const [provider, setProvider] = useState('google');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  function generate() {
    const start = new Date(when);
    if (!title.trim() || !when || !Number.isFinite(start.getTime()) || start <= new Date()) {
      setError('Informe a ação e uma data e horário futuros.');
      return;
    }
    setError('');
    const end = new Date(start.getTime() + 30 * 60000);
    const details = [description.trim(), `Oportunidade: ${opportunity.title || opportunity.name || opportunity.id}`,
      opportunity.company?.name ? `Cliente: ${opportunity.company.name}` : '',
      `${window.location.origin}/oportunidades?opportunityId=${encodeURIComponent(opportunity.id)}`].filter(Boolean).join('\n\n');
    if (provider === 'ics') {
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Double CRM//Alertas//PT-BR', 'BEGIN:VEVENT',
        `UID:${crypto.randomUUID()}@doublecrm`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(end)}`, `SUMMARY:${escapeCalendar(title.trim())}`, `DESCRIPTION:${escapeCalendar(details)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Lembrete da oportunidade',
        'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
      // Fold at 75 UTF-8 octets, including the continuation space (RFC 5545).
      const encoder = new TextEncoder();
      const folded = lines.map(line => {
        let result = '', length = 0;
        for (const char of line) {
          const size = encoder.encode(char).length;
          if (length + size > 75) { result += '\r\n '; length = 1; }
          result += char; length += size;
        }
        return result;
      }).join('\r\n') + '\r\n';
      const url = URL.createObjectURL(new Blob([folded], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'alerta-oportunidade.ics'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Arquivo gerado. Importe-o na sua agenda e confira o lembrete de 15 minutos.');
      return;
    }
    const params = provider === 'google'
      ? new URLSearchParams({ action: 'TEMPLATE', text: title.trim(), dates: `${stamp(start)}/${stamp(end)}`, details })
      : new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: title.trim(), startdt: start.toISOString(), enddt: end.toISOString(), body: details });
    const base = provider === 'google' ? 'https://calendar.google.com/calendar/render' : provider === 'microsoft' ? 'https://outlook.office.com/calendar/0/deeplink/compose' : 'https://outlook.live.com/calendar/0/deeplink/compose';
    window.open(`${base}?${params}`, '_blank', 'noopener,noreferrer');
    setStatus('Conclua o salvamento na agenda aberta e confira a notificação do compromisso. Se a aba não abriu, permita pop-ups e tente novamente.');
  }

  return <div className="mb-4">
    <button type="button" className="crm-btn crm-btn-secondary" aria-expanded={open} aria-controls={`${id}-panel`}
      onClick={() => {
        if (!open) {
          setTitle(`Contato com ${opportunity.company?.name || opportunity.title || opportunity.name || 'cliente'}`);
          setDescription(notes); setError(''); setStatus('');
        }
        setOpen(!open);
      }}><Bell className="h-4 w-4" /> Gerar alerta</button>
    {open && <section id={`${id}-panel`} aria-label="Gerar alerta na agenda" className="crm-panel-muted mt-3 space-y-3 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-[var(--crm-ink)]">Alerta na agenda</h4>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar alerta"><X className="h-4 w-4" /></button>
      </div>
      <label className="block text-sm" htmlFor={`${id}-title`}>Ação / título</label>
      <input id={`${id}-title`} className="crm-input" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm" htmlFor={`${id}-when`}>Data e horário (seu fuso local)</label>
          <input id={`${id}-when`} type="datetime-local" className="crm-input" value={when} onChange={e => setWhen(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm" htmlFor={`${id}-provider`}>Agenda</label>
          <select id={`${id}-provider`} className="crm-input" value={provider} onChange={e => { setProvider(e.target.value); setStatus(''); }}>
            <option value="google">Google Agenda</option><option value="microsoft">Microsoft 365 (trabalho)</option>
            <option value="outlook">Outlook.com (pessoal)</option><option value="ics">Arquivo de calendário (.ics)</option>
          </select></div>
      </div>
      <label className="block text-sm" htmlFor={`${id}-description`}>Descrição</label>
      <textarea id={`${id}-description`} className="crm-input" rows={3} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} />
      <p className="text-xs text-[var(--crm-muted)]">Duração: 30 minutos. No Google ou Microsoft, salve o compromisso e ajuste o lembrete na própria agenda. O arquivo .ics inclui lembrete de 15 minutos. O alerta só é criado após salvar ou importar na agenda.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {status && <p role="status" className="text-sm text-[var(--crm-ink)]">{status}</p>}
      <button type="button" className="crm-btn crm-btn-secondary" onClick={generate}>{provider === 'ics' ? 'Baixar alerta (.ics)' : 'Abrir na agenda'}</button>
    </section>}
  </div>;
}
