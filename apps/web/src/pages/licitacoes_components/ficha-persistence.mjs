export async function salvarFicha(ficha, { headers, fetchImpl = fetch } = {}) {
  const response = await fetchImpl('/api/analise-tr/salvar-ficha', {
    method: 'POST', headers, body: JSON.stringify(ficha)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || 'Falha ao salvar a análise no servidor.');
  }
  return result;
}
