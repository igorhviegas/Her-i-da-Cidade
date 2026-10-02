// Estoque: regras do Firestore + transações (consumo, estorno, duplicidade, missões de reposição).
// Exige Java 21+, firebase-tools e @firebase/rules-unit-testing; não faz parte de `npm test`. Execução (sem tocar em produção):
//   firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/stock.test.js"
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, getDocs, collection, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { prepareMovements, prepareOrderConsumption, prepareOrderReversal } from '../services/stockTransactions.js';

let env;
before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-estoque', firestore: { rules } });
});
after(async () => { await env?.cleanup(); });

let adminDb;
const admin = () => (adminDb ??= env.authenticatedContext('admin-user').firestore());
const stranger = () => env.authenticatedContext('not-admin').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

const material = (overrides = {}) => ({ name: 'Teia', category: 'Eventos', unit: 'unidade', defaultPerEvent: 1, minLevel: 3, active: true, balance: 10, ...overrides });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin-user'), { role: 'superadmin', active: true });
    await setDoc(doc(db, 'stockMaterials/teia'), material());
    await setDoc(doc(db, 'stockMaterials/moldura'), material({ name: 'Moldura', balance: 4, minLevel: 0 }));
    await setDoc(doc(db, 'stockMaterials/medalha'), material({ name: 'Medalha', balance: 0, minLevel: 0, defaultPerEvent: 0 }));
    await setDoc(doc(db, 'orders/o1'), { status: 'recording', clientId: 'c', serviceId: 's' });
    await setDoc(doc(db, 'orders/o2'), { status: 'recording', clientId: 'c', serviceId: 's' });
  });
});

// Mesmo desenho de updateOrder: pedido + estoque na mesma transação.
const complete = (db, orderId, lines) => runTransaction(db, async (tx) => {
  const stock = await prepareOrderConsumption(tx, db, { orderId, lines, actor: 'admin@teste' });
  tx.update(doc(db, 'orders', orderId), { status: 'completed' });
  stock.apply();
});
const reopen = (db, orderId) => runTransaction(db, async (tx) => {
  const stock = await prepareOrderReversal(tx, db, { orderId, actor: 'admin@teste' });
  tx.update(doc(db, 'orders', orderId), { status: 'delivery' });
  stock.apply();
});
const data = async (db, path) => (await getDoc(doc(db, path))).data();
const movements = async (db) => (await getDocs(collection(db, 'stockMovements'))).docs.map((d) => ({ id: d.id, ...d.data() }));
const missions = async (db) => (await getDocs(collection(db, 'missions'))).docs.map((d) => ({ id: d.id, ...d.data() }));

test('regras: só administradores; materiais e movimentações não são excluídos; movimentação é imutável', async () => {
  await assertSucceeds(getDoc(doc(admin(), 'stockMaterials/teia')));
  await assertFails(getDoc(doc(stranger(), 'stockMaterials/teia')));
  await assertFails(getDoc(doc(anonymous(), 'stockMaterials/teia')));
  await assertFails(setDoc(doc(stranger(), 'stockMaterials/x'), material({ balance: 0 })));
  await assertFails(deleteDoc(doc(admin(), 'stockMaterials/teia')));
  await assertSucceeds(setDoc(doc(admin(), 'stockMaterials/novo'), material({ balance: 0 })));
  await assertSucceeds(updateDoc(doc(admin(), 'stockMaterials/teia'), { defaultPerEvent: 2, minLevel: 5 })); // cadastro, sem saldo
  await complete(admin(), 'o1', [{ materialId: 'teia', quantity: 1 }]);
  const [mov] = await movements(admin());
  await assertFails(updateDoc(doc(admin(), `stockMovements/${mov.id}`), { quantity: 99 }));
  await assertFails(deleteDoc(doc(admin(), `stockMovements/${mov.id}`)));
  await assertFails(getDoc(doc(stranger(), `stockMovements/${mov.id}`)));
});

test('regras: saldo não muda sem movimentação rastreável, nem fica negativo', async () => {
  await assertFails(updateDoc(doc(admin(), 'stockMaterials/teia'), { balance: 99 }));
  await assertFails(setDoc(doc(admin(), 'stockMaterials/novo'), material({ balance: 5 }))); // saldo inicial exige movimentação
  await assertFails(updateDoc(doc(admin(), 'stockMaterials/teia'), { balance: -1 }));
  // movimentação inconsistente com o saldo (balanceAfter diferente) é recusada
  await assertFails(runTransaction(admin(), async (tx) => {
    tx.set(doc(admin(), 'stockMovements/fake'), { materialId: 'teia', type: 'purchase', quantity: 5, delta: 5, balanceAfter: 15, date: new Date(), createdAt: new Date() });
    tx.update(doc(admin(), 'stockMaterials/teia'), { balance: 99, lastMovementId: 'fake' });
  }));
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 10);
});

test('consumo padrão e ajustado: baixa saldo, grava movimentações com pedido, responsável e id determinístico', async () => {
  await complete(admin(), 'o1', [{ materialId: 'teia', quantity: 2 }, { materialId: 'moldura', quantity: 1 }, { materialId: 'medalha', quantity: 0 }]);
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 8);
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 3);
  assert.equal((await data(admin(), 'stockMaterials/medalha')).balance, 0); // quantidade 0 não gera movimentação
  const list = await movements(admin());
  assert.deepEqual(list.map((m) => m.id).sort(), ['consume_o1_1_moldura', 'consume_o1_1_teia']);
  const teia = list.find((m) => m.materialId === 'teia');
  assert.equal(teia.type, 'consumption'); assert.equal(teia.orderId, 'o1'); assert.equal(teia.delta, -2); assert.equal(teia.balanceAfter, 8); assert.equal(teia.createdBy, 'admin@teste');
  assert.equal((await data(admin(), 'orders/o1')).status, 'completed');
  assert.equal((await data(admin(), 'stockConsumptions/o1')).status, 'consumed');
});

test('estoque insuficiente: bloqueia, informa a falta e não altera pedido nem saldos', async () => {
  await assert.rejects(complete(admin(), 'o1', [{ materialId: 'teia', quantity: 3 }, { materialId: 'moldura', quantity: 5 }, { materialId: 'medalha', quantity: 1 }]), (error) => {
    assert.equal(error.code, 'insufficient_stock');
    assert.deepEqual(error.details.map((d) => [d.name, d.required, d.available, d.missing]).sort(), [['Medalha', 1, 0, 1], ['Moldura', 5, 4, 1]]);
    return true;
  });
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 10);
  assert.equal((await data(admin(), 'orders/o1')).status, 'recording');
  assert.equal((await movements(admin())).length, 0);
});

test('duplicidade: conclusões simultâneas e repetidas baixam uma única vez', async () => {
  const results = await Promise.allSettled([complete(admin(), 'o1', [{ materialId: 'teia', quantity: 2 }]), complete(admin(), 'o1', [{ materialId: 'teia', quantity: 2 }])]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 8);
  await assert.rejects(complete(admin(), 'o1', [{ materialId: 'teia', quantity: 2 }]), (e) => e.code === 'already_consumed');
  assert.equal((await movements(admin())).length, 1);
});

test('reabertura estorna; nova conclusão usa novo ciclo; reabrir pedido sem consumo não faz nada', async () => {
  await complete(admin(), 'o1', [{ materialId: 'teia', quantity: 2 }]);
  await reopen(admin(), 'o1');
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 10);
  assert.equal((await data(admin(), 'stockConsumptions/o1')).status, 'reversed');
  await reopen(admin(), 'o1'); // idempotente
  await complete(admin(), 'o1', [{ materialId: 'teia', quantity: 1 }]);
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 9);
  assert.equal((await data(admin(), 'stockConsumptions/o1')).cycle, 2);
  assert.deepEqual((await movements(admin())).map((m) => m.id).sort(), ['consume_o1_1_teia', 'consume_o1_2_teia', 'reversal_o1_1_teia']);
  await reopen(admin(), 'o2'); // sem consumo
  assert.equal((await movements(admin())).length, 3);
});

test('material inativo não é consumido; entrada e ajuste usam a mesma trilha', async () => {
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'stockMaterials/teia'), { active: false }));
  await assert.rejects(complete(admin(), 'o1', [{ materialId: 'teia', quantity: 1 }]), (e) => e.code === 'inactive_material');
  const entry = (type, quantity) => runTransaction(admin(), async (tx) => { const p = await prepareMovements(tx, admin(), [{ materialId: 'moldura', type, quantity, note: 'x' }], { actor: 'a' }); p.apply(); });
  await entry('purchase', 10);
  await entry('adjustment_out', 2);
  assert.equal((await data(admin(), 'stockMaterials/moldura')).balance, 12);
  assert.deepEqual((await movements(admin())).map((m) => m.type).sort(), ['adjustment_out', 'purchase']);
  await assert.rejects(entry('adjustment_out', 99), (e) => e.code === 'insufficient_stock');
});

test('missões: criada ao atingir o limite, sem duplicar enquanto pendente, e novo ciclo depois de concluída', async () => {
  await complete(admin(), 'o1', [{ materialId: 'teia', quantity: 7 }]); // 10 -> 3 (= mínimo)
  let list = await missions(admin());
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Comprar teia para reposição do estoque');
  assert.equal(list[0].status, 'pending'); assert.equal(list[0].source, 'stock'); assert.equal(list[0].materialId, 'teia');
  assert.match(list[0].description, /Estoque atual de Teia: 3 unidade/);
  await complete(admin(), 'o2', [{ materialId: 'teia', quantity: 1 }]); // 2, ainda baixo
  assert.equal((await missions(admin())).length, 1);
  // reposição recupera o estoque, missão segue pendente: nova queda não duplica
  const buy = (quantity) => runTransaction(admin(), async (tx) => { const p = await prepareMovements(tx, admin(), [{ materialId: 'teia', type: 'purchase', quantity }], { actor: 'a' }); p.apply(); });
  const drop = (quantity) => runTransaction(admin(), async (tx) => { const p = await prepareMovements(tx, admin(), [{ materialId: 'teia', type: 'adjustment_out', quantity, note: 'x' }], { actor: 'a' }); p.apply(); });
  await buy(20); await drop(19);
  assert.equal((await missions(admin())).length, 1);
  // missão concluída pela interface atual do To Do → nova queda abre novo ciclo
  await updateDoc(doc(admin(), `missions/${list[0].id}`), { status: 'completed' });
  await buy(10); await drop(11);
  list = await missions(admin());
  assert.equal(list.length, 2);
  assert.equal(list.filter((m) => m.status === 'pending').length, 1);
});

test('missões: eventos simultâneos que cruzam o limite criam uma única missão', async () => {
  await Promise.all([complete(admin(), 'o1', [{ materialId: 'teia', quantity: 7 }]), complete(admin(), 'o2', [{ materialId: 'teia', quantity: 1 }])]);
  assert.equal((await data(admin(), 'stockMaterials/teia')).balance, 2);
  assert.equal((await missions(admin())).length, 1);
});
