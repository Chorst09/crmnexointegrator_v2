export function cn(...inputs: any[]): string {
  return inputs.filter(Boolean).join(' ');
}

export function formatarData(dataStr?: string | null): string {
  if (!dataStr) return 'Não informada';
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dataStr;
  }
}

export function formatarDataHora(dataStr?: string | null): string {
  if (!dataStr) return 'Não informada';
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dataStr;
  }
}
