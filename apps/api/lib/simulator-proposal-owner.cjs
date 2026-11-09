/** Preserva o vendedor da proposta original ao criar novas versões. */
async function assignProposalOwner(prisma, data, input, user) {
  const actor = user?.email || user?.userId || user?.id;
  const match = data.baseId.match(/^(.*)_v(\d+)$/i);
  const version = match ? Number(match[2]) : data.version;
  const sourceId = input.sourceProposalId || input.metadata?.sourceProposalId;
  let source = null;
  if (sourceId || (match && version > 1)) {
    if (sourceId) {
      source = await prisma.simulatorProposal.findFirst({
        where: { id: String(sourceId) },
        orderBy: { version: 'asc' },
      });
    } else {
      // Raiz do baseId sem o sufixo _vN final
      const root = match[1]; // ex: "Prop_Inter_Radio_005"

      // Tenta v1 e v{N-1} da raiz exata primeiro
      source = await prisma.simulatorProposal.findFirst({
        where: { baseId: { in: [`${root}_v1`, `${root}_v${version - 1}`] } },
        orderBy: { version: 'asc' },
      });

      // Fallback: busca qualquer proposta cuja raiz começa com o padrão
      // (cobre casos onde o baseId original recebeu UUID sufixado por colisão)
      if (!source) {
        // Extrai prefixo limpo antes de qualquer UUID (ex: "Prop_Inter_Radio_005")
        const cleanPrefix = root.replace(/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*$/i, '');
        if (cleanPrefix && cleanPrefix !== root) {
          source = await prisma.simulatorProposal.findFirst({
            where: { baseId: { startsWith: cleanPrefix } },
            orderBy: { version: 'asc' },
          });
        }
      }
    }

    if (!source?.createdBy || source.createdBy === 'vendedor') {
      // Não bloqueia com 400 — apenas usa o ator atual como dono
      if (actor) data.createdBy = actor;
      return data;
    }
    const identities = [user?.email, user?.userId, user?.id].filter(Boolean).map(x => String(x).toLowerCase());
    const elevated = ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(String(user?.role || '').toUpperCase());
    if (user && !elevated && !identities.includes(String(source.createdBy).toLowerCase())) {
      const error = new Error('Sem permissão para criar versão desta proposta');
      error.status = 403;
      throw error;
    }
    data.createdBy = source.createdBy;
    data.metadata = { ...data.metadata, sourceProposalId: source.id, ...(actor ? { versionEditedBy: actor } : {}) };
  } else if (!data.createdBy && actor) {
    data.createdBy = actor;
  }
  return data;
}
module.exports = { assignProposalOwner };
