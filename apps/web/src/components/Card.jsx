export default function Card({ title, value }) {
  return (
    <div className="crm-panel crm-stat-card rounded-xl p-3.5 min-w-0">
      <div className="text-xs font-medium text-[var(--crm-muted)]">{title}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--crm-ink)]">{value}</div>
    </div>
  );
}
