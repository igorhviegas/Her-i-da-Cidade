import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('conclusão excepcional: updateOrder repassa a autorização e as regras exigem papel admin/superadmin', async () => {
  const orders = await read('./ordersService.ts');
  assert.match(orders, /allowShortage: updates\.allowStockShortage === true/);
  assert.match(orders, /delete safeUpdates\.allowStockShortage/);
  const rules = await read('../firestore.rules');
  assert.match(rules, /function canOverrideStock\(\)/);
  assert.match(rules, /get\('role', ''\) in \['admin', 'superadmin'\]/);
  assert.match(rules, /match \/stockPendings\/\{pendingId\}/);
  assert.match(rules, /allow create: if canOverrideStock\(\)/);
  assert.equal(rules, (await read('../firestore.rules.txt')));
});

test('interface: só admin/superadmin vê a opção; confirmação explícita; usuários comuns continuam bloqueados', async () => {
  const page = await read('../components/admin/AdminOrdersPage.tsx');
  assert.match(page, /adminData\?\.role === 'admin' \|\| adminData\?\.role === 'superadmin'/);
  assert.match(page, /allowStockShortage: allowShortage/);
  const modal = await read('../components/admin/StockConsumptionModal.tsx');
  assert.match(modal, /exceptional && !\(canOverride && acknowledged\)/);
  assert.match(modal, /Conclusão excepcional \(somente administradores\)/);
  assert.match(modal, /exceptional && !canOverride/);
  assert.match(modal, /setAcknowledged\(false\)/); // mudar quantidades invalida a ciência
});
