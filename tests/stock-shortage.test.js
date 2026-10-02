// Estoque insuficiente: conclusão excepcional de administrador, pendências, papéis e regras do Firestore.
// Exige Java 21+, firebase-tools e @firebase/rules-unit-testing; não faz parte de `npm test`. Execução (sem tocar em produção):
//   firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/stock-shortage.test.js"
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { prepareOrderConsumption, prepareOrderReversal } from '../services/stockTransactions.js';

let env;
before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-estoque-falta', firestore: { rules } });
});
after(async () => { await env?.cleanup(); });

let adminDb; let editorDb; let strangerDb;
const admin = () => (adminDb ??= env.authenticatedContext('admin-user').firestore());
const editor = () => (editorDb ??= env.authenticatedContext('editor-user').firestore());
const stranger = () => (strangerDb ??= env.authenticatedContext('not-admin').firestore());

const material = (overrides = {}) => ({ name: 'Teia', category: 'Eventos', unit: 'unidade', defaultPerEvent: 1, minLevel: 3, active: true, balance: 10, ...overrides });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin-user'), { role: 'superadmin', active: true });
    await setDoc(doc(db, 'admins/editor-user'), { role: 'editor', active: true });
    await setDoc(doc(db, 'stockMaterials/teia'), material());
    await setDoc(doc(db, 'stockMaterials/moldura'), material({ name: 'Moldura', balance: 4, minLevel: 0 }));
    await setDoc(doc(db, 'stockMaterials/medalha'), material({ name: 'Medalha', balance: 0, minLevel: 0, defaultPerEvent: 0 }));
    for (const id of ['o1', 'o2']) await setDoc(doc(db, `orders/${id}`), { status: 'recording', clientId: 'c', serviceId: 's' });
  });
});

const complete = (db, orderId, lines, { allowShortage = false } = {}) => runTransaction(db, async (tx) => {
  const stock = await prepareOrderConsumption(tx, db, { orderId, lines, actor: 'admin@teste', allowShortage });
  tx.update(doc(db, 'orders', orderId), { status: 'completed' });
  stock.apply();
});
const exceptional = (db, orderId, lines) => complete(db, orderId, lines, { allowShortage: true });
const reopen = (db, orderId) => runTransaction(db, async (tx) => {
  const stock = await prepareOrderReversal(tx, db, { orderId, actor: 'admin@teste' });
  tx.update(doc(db, 'orders', orderId), { status: 'delivery' });
  stock.apply();
});
const data = async (db, path) => (await getDoc(doc(db, path))).data();
const list = async (db, name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));

test('sem autorização o bloqueio continua, mesmo para o papel editor', async () => {
  await assert.rejects(complete(editor(), 'o1', [{ materialId: 'moldura', quantity: 5 }]), (e) => e.code === 'insufficient_stock');
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 4);
  assert.equal((await list(admin(), 'stockPendings')).length, 0);
});

test('conclusão excepcional (admin): baixa só o disponível, registra pendência e nunca deixa saldo negativo', async () => {
  await exceptional(admin(), 'o1', [{ materialId: 'moldura', quantity: 6 }, { materialId: 'teia', quantity: 2 }, { materialId: 'medalha', quantity: 1 }]);
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 0);
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 8);
  assert.equal((await data(admin(), 'stockMaterials/medalha')).balance, 0);
  assert.equal((await data(admin(), 'orders/o1')).status, 'completed');
  const pendings = await list(admin(), 'stockPendings');
  assert.deepEqual(pendings.map((p) => [p.materialId, p.required, p.fulfilled, p.missing, p.status, p.cycle]).sort(), [['medalha', 1, 0, 1, 'open', 1], ['moldura', 6, 4, 2, 'open', 1]]);
  const moves = await list(admin(), 'stockMovements');
  assert.deepEqual(moves.map((m) => m.id).sort(), ['consume_o1_1_moldura', 'consume_o1_1_teia']); // medalha (0 disponível): só pendência
  const moldura = moves.find((m) => m.materialId === 'moldura');
  assert.deepEqual([moldura.quantity, moldura.requested, moldura.shortfall, moldura.balanceAfter], [4, 6, 2, 0]);
  const consumption = await data(admin(), 'stockConsumptions/o1');
  assert.equal(consumption.exceptional, true);
  assert.equal(consumption.exceptionApprovedBy, 'admin@teste');
  assert.deepEqual(consumption.shortfalls.map((s) => [s.materialId, s.missing]).sort(), [['medalha', 1], ['moldura', 2]]);
});

test('papel editor não faz conclusão excepcional, nem por escrita direta; pendências não nascem sozinhas', async () => {
  await assertFails(exceptional(editor(), 'o1', [{ materialId: 'moldura', quantity: 6 }]));
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 4);
  assert.equal((await data(admin(), 'orders/o1')).status, 'recording');
  assert.equal((await list(admin(), 'stockPendings')).length, 0);
  const pending = { orderId: 'o1', cycle: 1, materialId: 'moldura', required: 6, fulfilled: 4, missing: 2, status: 'open' };
  await assertFails(setDoc(doc(editor(), 'stockPendings/o1_1_moldura'), pending));
  await assertFails(setDoc(doc(editor(), 'stockConsumptions/o1'), { orderId: 'o1', status: 'consumed', cycle: 1, exceptional: true }));
  await assertFails(setDoc(doc(admin(), 'stockPendings/solta'), pending)); // nem o admin cria pendência sem consumo excepcional do ciclo
  await complete(editor(), 'o1', [{ materialId: 'moldura', quantity: 1 }]); // conclusão normal segue liberada
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 3);
});

test('pendências só podem ser anuladas; sem editar valores, resolver à mão ou excluir; leitura só de admins', async () => {
  await exceptional(admin(), 'o1', [{ materialId: 'moldura', quantity: 6 }]);
  const ref = (db) => doc(db, 'stockPendings/o1_1_moldura');
  await assertFails(updateDoc(ref(admin()), { missing: 0 }));
  await assertFails(updateDoc(ref(admin()), { status: 'resolved' }));
  await assertFails(deleteDoc(ref(admin())));
  await assertFails(getDoc(ref(stranger())));
});

test('reabertura devolve só o que foi baixado, anula (não apaga) a pendência; nova conclusão abre novo ciclo sem duplicar', async () => {
  await exceptional(admin(), 'o1', [{ materialId: 'moldura', quantity: 6 }, { materialId: 'medalha', quantity: 2 }]);
  await reopen(editor(), 'o1'); // reabrir não exige papel especial
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 4); // baixou 4 e devolveu 4, não 6
  assert.equal((await data(admin(), 'stockMaterials/medalha')).balance, 0);
  assert.deepEqual((await list(admin(), 'stockPendings')).map((p) => [p.id, p.status]).sort(), [['o1_1_medalha', 'voided'], ['o1_1_moldura', 'voided']]);
  assert.equal((await data(admin(), 'stockConsumptions/o1')).status, 'reversed');
  await reopen(admin(), 'o1'); // idempotente
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 4);
  await exceptional(admin(), 'o1', [{ materialId: 'moldura', quantity: 5 }]);
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 0);
  assert.deepEqual((await list(admin(), 'stockPendings')).map((p) => [p.id, p.status]).sort(), [['o1_1_medalha', 'voided'], ['o1_1_moldura', 'voided'], ['o1_2_moldura', 'open']]);
  assert.deepEqual((await list(admin(), 'stockMovements')).map((m) => m.id).sort(), ['consume_o1_1_moldura', 'consume_o1_2_moldura', 'reversal_o1_1_moldura']);
});

test('concorrência: duas conclusões excepcionais disputando o mesmo saldo nunca o deixam negativo', async () => {
  await Promise.all([exceptional(admin(), 'o1', [{ materialId: 'moldura', quantity: 3 }]), exceptional(admin(), 'o2', [{ materialId: 'moldura', quantity: 3 }])]);
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 0);
  assert.equal((await list(admin(), 'stockMovements')).reduce((sum, m) => sum + m.quantity, 0), 4);
  assert.equal((await list(admin(), 'stockPendings')).reduce((sum, p) => sum + p.missing, 0), 2); // pediram 6, havia 4
});

test('missões: material zerado sem missão ganha uma na conclusão excepcional; sem duplicar enquanto pendente', async () => {
  await exceptional(admin(), 'o1', [{ materialId: 'medalha', quantity: 1 }]); // saldo 0 e nenhuma movimentação
  let missions = (await list(admin(), 'missions')).filter((m) => m.materialId === 'medalha');
  assert.equal(missions.length, 1);
  assert.equal(missions[0].status, 'pending');
  assert.equal((await data(admin(), 'stockMaterials/medalha')).openMissionId, missions[0].id);
  await exceptional(admin(), 'o2', [{ materialId: 'medalha', quantity: 2 }]);
  missions = (await list(admin(), 'missions')).filter((m) => m.materialId === 'medalha');
  assert.equal(missions.length, 1);
});

test('missões: a baixa parcial que zera um material com mínimo cria uma única missão', async () => {
  await exceptional(admin(), 'o1', [{ materialId: 'moldura', quantity: 6 }]);
  await exceptional(admin(), 'o2', [{ materialId: 'moldura', quantity: 1 }]);
  assert.equal((await list(admin(), 'missions')).filter((m) => m.materialId === 'moldura').length, 1);
});
