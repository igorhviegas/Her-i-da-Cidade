// Ponta a ponta: ordersService.ts REAL (via Vite SSR) contra o emulador do Firestore, com as regras reais. Rodar: npm run test:rules
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const rules = await readFile('firestore.rules', 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admins/admin-user'), { enabled: true, role: 'admin', active: true });
  await setDoc(doc(db, 'services/s1'), { title: 'Evento', category: 'Outro' });
  await setDoc(doc(db, 'clients/c1'), { name: 'Maria' });
});
const db = env.authenticatedContext('admin-user').firestore();
globalThis.__db = db;

const vite = await createServer({
  root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
  plugins: [{
    name: 'stub-firebase', enforce: 'pre',
    resolveId(id) { if (/lib\/firebase(\.ts)?$/.test(id)) return '\0stub-firebase'; },
    load(id) { if (id === '\0stub-firebase') return 'export const db = globalThis.__db; export const auth = { currentUser: { uid: "admin-user", email: "a@b.c" } };'; },
  }],
});
const orders = await vite.ssrLoadModule('/services/ordersService.ts');
const fin = await vite.ssrLoadModule('/services/eventFinance.js');

const input = (over = {}) => ({
  clientId: 'c1', serviceId: 's1', status: 'scheduled', eventDate: new Date(2026, 9, 10, 12), childName: 'Pedro', content: 'x',
  servicePrice: 1000, rushFee: 0, totalPaid: 1000, productionType: 'scheduled', source: 'manual',
  eventForm: { eventTime: '14:00', location: 'Rua A', imageAuthorization: true, extraWeb: 0, totalValue: 1000, entryValue: 500, cost: 150, observations: '', formType: 'Aniversário', ...over },
});
const ledger = async (id) => {
  const out = {};
  for (const kind of ['entry', 'final', 'cost']) { const s = await getDoc(doc(db, 'financeEntries', fin.ledgerId(id, kind))); if (s.exists()) out[kind] = s.data(); }
  return out;
};
const orderDoc = async (id) => (await getDoc(doc(db, 'orders', id))).data();
const step = (name) => console.log('  ok -', name);

// 1. criação: pedido + entrada, atomicamente
const created = await orders.createOrder(input());
let l = await ledger(created.id);
assert.deepEqual(Object.keys(l), ['entry']);
assert.equal(l.entry.amount, 500); assert.equal(l.entry.type, 'revenue'); assert.equal(l.entry.orderId, created.id);
assert.deepEqual((await orderDoc(created.id)).eventLedger, { entry: 500 });
assert.equal(l.entry.date.toMillis(), (await orderDoc(created.id)).createdAt.toMillis()); // data do lançamento = data de criação
step('criação grava pedido e entrada (R$ 500, data de criação)');

// 2. conclusão: 2ª parcela + despesa
await orders.updateOrder(created.id, { status: 'completed' });
l = await ledger(created.id);
assert.deepEqual(Object.keys(l).sort(), ['cost', 'entry', 'final']);
assert.equal(l.final.amount, 500); assert.equal(l.cost.amount, 150); assert.equal(l.cost.category, 'Despesa evento'); assert.equal(l.cost.type, 'expense');
const completedAt = (await orderDoc(created.id)).completedAt.toMillis();
assert.equal(l.final.date.toMillis(), completedAt); assert.equal(l.cost.date.toMillis(), completedAt);
assert.deepEqual((await orderDoc(created.id)).eventLedger, { entry: 500, final: 500, cost: 150 });
step('conclusão lança 2ª parcela (R$ 500) e Despesa evento (R$ 150) na data de conclusão');
const snapshot = JSON.stringify(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, [v.amount, v.date.toMillis(), v.createdAt.toMillis()]])));

// 3. repetir conclusão, reabrir, editar valores e concluir de novo: nada novo, nada alterado
await orders.updateOrder(created.id, { status: 'completed' });
await orders.updateOrder(created.id, { status: 'scheduled' });
await orders.updateOrder(created.id, { eventForm: { ...input().eventForm, totalValue: 2000, entryValue: 1000, cost: 999 } });
await new Promise((r) => setTimeout(r, 25));
await orders.updateOrder(created.id, { status: 'completed' });
l = await ledger(created.id);
assert.equal(JSON.stringify(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, [v.amount, v.date.toMillis(), v.createdAt.toMillis()]]))), snapshot);
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 3);
assert.deepEqual((await orderDoc(created.id)).eventLedger, { entry: 500, final: 500, cost: 150 });
assert.equal((await orderDoc(created.id)).eventForm.totalValue, 2000); // o pedido muda; o livro não
step('repetir, reabrir, editar valores e concluir de novo: 3 lançamentos intactos');

// 4. conclusões concorrentes: ainda um único conjunto
const racing = await orders.createOrder(input());
const results = await Promise.allSettled([orders.updateOrder(racing.id, { status: 'completed' }), orders.updateOrder(racing.id, { status: 'completed' })]);
assert.ok(results.every((r) => r.status === 'fulfilled'), JSON.stringify(results));
l = await ledger(racing.id);
assert.deepEqual(Object.keys(l).sort(), ['cost', 'entry', 'final']);
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 6);
step('duas conclusões simultâneas geram um único conjunto de lançamentos');

// 5. dados financeiros incompletos: conclusão bloqueada, nada lançado, status inalterado
const broken = await orders.createOrder(input());
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'orders', broken.id), { eventForm: { cost: null } }, { merge: true }); });
await assert.rejects(orders.updateOrder(broken.id, { status: 'completed' }), /incompletos/);
assert.deepEqual(Object.keys(await ledger(broken.id)), ['entry']);
assert.equal((await orderDoc(broken.id)).status, 'scheduled');
step('dados incompletos: conclusão recusada, nenhum lançamento novo');

// 6. pedido criado concluído, ou evento sem entrada válida, é recusado
await assert.rejects(orders.createOrder({ ...input(), status: 'completed' }), /não podem ser criados já concluídos/);
await assert.rejects(orders.createOrder(input({ entryValue: undefined })), /entrada/);
step('criação já concluída / sem entrada recusada');

// 7. pedido antigo (sem eventForm) continua sem livro
const { eventForm: _e, childName: _c, ...plain } = input();
const legacy = await orders.createOrder(plain);
await orders.updateOrder(legacy.id, { status: 'completed' });
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 7);
step('pedido comum não gera lançamentos no livro');

// 8. excluir o pedido leva os lançamentos junto
await orders.deleteOrder(created.id);
assert.deepEqual(await ledger(created.id), {});
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 4);
step('excluir o pedido remove seus lançamentos; os demais ficam');

await vite.close(); await env.cleanup();
console.log('E2E OK');
