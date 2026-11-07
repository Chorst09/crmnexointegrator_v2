// Explicit ownership wins over legacy opportunity ownership.
export function resolveCompanyAccountManager(company = {}, users = []) {
  const id = company.accountManagerId;
  const name = company.accountManagerName || '';
  if (id) return { id, name: users.find(user => user.id === id)?.name || name || 'Responsável atual' };
  const matchingNames = name ? users.filter(user => user.name?.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()) : [];
  if (name) return { id: matchingNames.length === 1 ? matchingNames[0].id : null, name };
  const owners = new Map();
  for (const opportunity of company.opportunities || []) {
    const ownerId = opportunity.ownerId || opportunity.owner?.id;
    if (ownerId) owners.set(ownerId, opportunity.owner);
  }
  if (owners.size !== 1) return { id: null, name: '' };
  const [ownerId, owner] = [...owners][0];
  return { id: ownerId, name: users.find(user => user.id === ownerId)?.name || owner?.name || 'Responsável atual' };
}

export function accountManagerOptions(users, currentUser, manager) {
  const options = new Map(users.map(user => [user.id, user]));
  const selfId = currentUser.id || currentUser.userId;
  if (selfId && !options.has(selfId)) options.set(selfId, { ...currentUser, id: selfId });
  if (manager.id && !options.has(manager.id)) options.set(manager.id, { id: manager.id, name: manager.name || 'Responsável atual' });
  return [...options.values()];
}
