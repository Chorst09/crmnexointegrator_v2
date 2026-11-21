export function buildProjectEntrySeries(issues = [], now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 41);
  start.setHours(0, 0, 0, 0);
  return Array.from({length:6}, (_, index) => {
    const from = new Date(start); from.setDate(from.getDate() + index * 7);
    const until = new Date(from); until.setDate(until.getDate() + 7);
    const rows = issues.filter(issue => {
      const date = new Date(issue.createdAt);
      return !Number.isNaN(date.getTime()) && date >= from && date < until && date <= end;
    });
    const count = statuses => rows.filter(issue => statuses.includes(issue.status)).length;
    return {
      label:from.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
      planejado:count(['PENDENTE','PLANEJAMENTO']),
      progresso:count(['EM PROGRESSO','EM ESPERA']),
      concluido:count(['CONCLUÍDO']),
      risco:count(['EM RISCO','ATUALIZAÇÃO NECESSÁRIA']),
      cancelado:count(['CANCELADO']),
      total:rows.length
    };
  });
}
