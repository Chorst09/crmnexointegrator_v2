export default function SellerProfile({ seller }) {
  if (!seller) return null;
  const fields = [
    ['Nome', seller.name], ['E-mail', seller.email], ['Telefone', seller.phone],
    ['Perfil', seller.role], ['Região', seller.region?.name]
  ];
  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm" aria-label="Cadastro do responsável">
      {fields.filter(([, value]) => value).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-[var(--crm-muted)]">{label}</dt>
          <dd className="break-words text-[var(--crm-ink)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
