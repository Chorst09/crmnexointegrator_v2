export default function Card({ title, value }) {
  return (
    <div className="crm-panel p-5 min-w-[200px]">
      <div className="text-sm font-semibold text-[var(--crm-muted)]">{title}</div>
      <div className="mt-2 text-2xl font-bold text-[var(--crm-ink)]">{value}</div>
    </div>
  );
}
