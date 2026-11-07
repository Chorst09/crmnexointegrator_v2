import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCompanyAccountManager as resolve, accountManagerOptions } from '../../apps/web/src/utils/company-account-manager.mjs';
const users = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }];
test('explicit manager takes precedence over opportunity owners', () => {
  assert.deepEqual(resolve({ accountManagerId: 'b', opportunities: [{ ownerId: 'a', owner: users[0] }] }, users), { id: 'b', name: 'Bruno' });
});
test('legacy company inherits its single opportunity owner', () => {
  assert.deepEqual(resolve({ opportunities: [{ ownerId: 'a', owner: users[0] }, { ownerId: 'a' }] }, users), { id: 'a', name: 'Ana' });
});
test('multiple owners do not cause an arbitrary assignment', () => {
  assert.deepEqual(resolve({ opportunities: [{ ownerId: 'a' }, { ownerId: 'b' }] }, users), { id: null, name: '' });
});
test('legacy manager name resolves to a unique user', () => {
  assert.deepEqual(resolve({ accountManagerName: 'Ana' }, users), { id: 'a', name: 'Ana' });
});
test('ambiguous legacy names remain visible without guessing a user', () => {
  assert.deepEqual(resolve({ accountManagerName: 'Ana' }, [...users, { id: 'c', name: 'Ana' }]), { id: null, name: 'Ana' });
});
test('current manager remains in options even if user endpoint omits them', () => {
  const options = accountManagerOptions([], { userId: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' });
  assert.deepEqual(options.map(u => u.id), ['a', 'b']);
});
