/** Preserva o vendedor da proposta original ao criar novas versões. */
async function assignProposalOwner(prisma, data, input, user) {
  const actor = user?.email || user?.userId || user?.id;
  const match = data.baseId.match(/^(.*)_v(\d+)$/i);
  const version = match ? Number(match[2]) : data.version;
  const sourceId = input.sourceProposalId || input.metadata?.sourceProposalId;
  let source = null;
  if (sourceId || (match && version > 1)) {
    source = await prisma.simulatorProposal.findFirst({
      where: sourceId ? { id: String(sourceId), type: data.type }
        : { baseId: { in: [`${match[1]}_v1`, `${match[1]}_v${version - 1}`] }, type: data.type, client: data.client },
      orderBy: { version: 'asc' },
    });
    if (!source?.createdBy || source.createdBy === 'vendedor') {
      const error = new Error('Proposta original com vendedor válido não encontrada para criar nova versão');
      error.status = 400;
      throw error;
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
