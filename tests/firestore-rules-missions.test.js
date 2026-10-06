// Regras do módulo Missões. Exige Java 21+, firebase-tools e o pacote @firebase/rules-unit-testing
// (devDependency), por isso não faz parte de `npm test`.
// Execução (sem tocar em produção):
//   firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-missions.test.js"
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins/admin-user'), { enabled: true });
  });
});

after(async () => { await env?.cleanup(); });

const admin = () => env.authenticatedContext('admin-user').firestore();
const stranger = () => env.authenticatedContext('not-admin').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

const COLLECTIONS = ['missions', 'recurringTasks', 'taskOccurrences', 'goals', 'goalCycles'];

test('coleções do módulo: somente administradores leem e escrevem', async () => {
  for (const name of COLLECTIONS) {
    const path = `${name}/doc1`;
    await assertSucceeds(setDoc(doc(admin(), path), { title: 'x' }));
    await assertSucceeds(getDoc(doc(admin(), path)));
    await assertSucceeds(updateDoc(doc(admin(), path), { title: 'y' }));
    await assertFails(getDoc(doc(stranger(), path)));
    await assertFails(setDoc(doc(stranger(), `${name}/doc2`), { title: 'x' }));
    await assertFails(getDoc(doc(anonymous(), path)));
    await assertFails(updateDoc(doc(anonymous(), path), { title: 'z' }));
    await assertFails(deleteDoc(doc(stranger(), path)));
    await assertSucceeds(deleteDoc(doc(admin(), path)));
  }
});

test('notifications: admin cria, lê e descarta; ninguém apaga', async () => {
  const path = 'notifications/mission_overdue_m1';
  await assertSucceeds(setDoc(doc(admin(), path), { dismissed: false, title: 'Missão atrasada' }));
  await assertSucceeds(updateDoc(doc(admin(), path), { dismissed: true, dismissedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(admin(), path)));
  await assertFails(getDoc(doc(stranger(), path)));
  await assertFails(setDoc(doc(stranger(), 'notifications/x'), { dismissed: false }));
});

test('activityLog: admin cria uma vez; atualizar, recriar por cima e apagar são negados', async () => {
  const path = 'activityLog/mission_m1';
  await assertSucceeds(setDoc(doc(admin(), path), { type: 'mission', refId: 'm1', difficulty: 3 }));
  await assertSucceeds(getDoc(doc(admin(), path)));
  await assertFails(updateDoc(doc(admin(), path), { difficulty: 5 }));
  await assertFails(setDoc(doc(admin(), path), { type: 'mission', refId: 'm1', difficulty: 5 })); // sobrescrever = update
  await assertFails(deleteDoc(doc(admin(), path)));
  await assertFails(setDoc(doc(stranger(), 'activityLog/mission_m2'), { type: 'mission' }));
  await assertFails(getDoc(doc(anonymous(), path)));
});

test('conclusão de missão: transação atualiza a missão, cria o registro e descarta o aviso', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'missions/m9'), { status: 'pending', difficulty: 2 });
    await setDoc(doc(context.firestore(), 'notifications/mission_overdue_m9'), { dismissed: false });
  });
  const firestore = admin();
  await assertSucceeds(runTransaction(firestore, async (transaction) => {
    const mission = await transaction.get(doc(firestore, 'missions/m9'));
    await transaction.get(doc(firestore, 'notifications/mission_overdue_m9'));
    transaction.update(doc(firestore, 'missions/m9'), { status: 'completed', completedAt: new Date() });
    transaction.set(doc(firestore, 'activityLog/mission_m9'), { type: 'mission', refId: 'm9', difficulty: mission.data().difficulty });
    transaction.update(doc(firestore, 'notifications/mission_overdue_m9'), { dismissed: true });
  }));
});

test('dificuldades (siteConfig/gamification): leitura e escrita só para admin; leitura pública continua só no documento public', async () => {
  await assertSucceeds(setDoc(doc(admin(), 'siteConfig/gamification'), { difficulties: { script_created: 4 } }, { merge: true }));
  await assertSucceeds(getDoc(doc(admin(), 'siteConfig/gamification')));
  await assertFails(getDoc(doc(anonymous(), 'siteConfig/gamification')));
  await assertFails(setDoc(doc(stranger(), 'siteConfig/gamification'), { difficulties: { script_created: 1 } }));
});

// Mesmos formatos de escrita usados por ordersService.ts e contentScriptsService.ts (pedido/roteiro + registro na mesma transação).
const validOrder = (overrides = {}) => ({
  clientId: 'c1', serviceId: '3', status: 'recording', content: 'x', servicePrice: 60, rushFee: 0, totalPaid: 60,
  productionType: 'recording', source: 'manual', createdAt: serverTimestamp(), ...overrides,
});

test('pedido: concluir e registrar atividade na mesma transação; reabrir e concluir de novo não regrava o registro', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'orders/o1'), { ...validOrder(), createdAt: new Date() });
  });
  const firestore = admin();
  const complete = () => runTransaction(firestore, async (transaction) => {
    const log = await transaction.get(doc(firestore, 'activityLog/order_completed_o1'));
    await transaction.get(doc(firestore, 'siteConfig/gamification'));
    transaction.update(doc(firestore, 'orders/o1'), { status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (!log.exists()) transaction.set(doc(firestore, 'activityLog/order_completed_o1'), { type: 'order_completed', refId: 'o1', difficulty: 4 });
  });
  await assertSucceeds(complete());
  await assertSucceeds(updateDoc(doc(firestore, 'orders/o1'), { status: 'delivery' })); // reabrir
  await assertSucceeds(complete()); // concluir de novo: o código só lê o registro existente e não escreve
  const log = await getDoc(doc(admin(), 'activityLog/order_completed_o1'));
  assert.equal(log.data().difficulty, 4);
  // se o código tentasse sobrescrever o registro existente, a regra negaria e derrubaria a transação inteira
  await assertFails(runTransaction(firestore, async (transaction) => {
    transaction.update(doc(firestore, 'orders/o1'), { status: 'completed', updatedAt: serverTimestamp() });
    transaction.set(doc(firestore, 'activityLog/order_completed_o1'), { type: 'order_completed', refId: 'o1', difficulty: 1 });
  }));
});

test('pedido que já nasce concluído (criação manual) grava pedido e registro na mesma transação', async () => {
  const firestore = admin();
  await assertSucceeds(runTransaction(firestore, async (transaction) => {
    await transaction.get(doc(firestore, 'activityLog/order_completed_o2'));
    transaction.set(doc(firestore, 'orders/o2'), validOrder({ status: 'completed', completedAt: new Date(), paidAt: new Date() }));
    transaction.set(doc(firestore, 'activityLog/order_completed_o2'), { type: 'order_completed', refId: 'o2', difficulty: null });
  }));
  const outsider = stranger();
  await assertFails(runTransaction(outsider, async (transaction) => {
    transaction.set(doc(outsider, 'orders/o3'), validOrder({ status: 'completed' }));
    transaction.set(doc(outsider, 'activityLog/order_completed_o3'), { type: 'order_completed' });
  }));
});

test('roteiro: marcar como pronto grava readyAt e o registro script_ready na mesma transação', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'contentScripts/s1'), { title: 't', content: 'c', productionStatus: 'draft' });
  });
  const firestore = admin();
  await assertSucceeds(runTransaction(firestore, async (transaction) => {
    await transaction.get(doc(firestore, 'contentScripts/s1'));
    await transaction.get(doc(firestore, 'activityLog/script_ready_s1'));
    transaction.update(doc(firestore, 'contentScripts/s1'), { productionStatus: 'ready', readyAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.set(doc(firestore, 'activityLog/script_ready_s1'), { type: 'script_ready', refId: 's1', difficulty: 4 });
  }));
  // excluir o roteiro de origem não apaga o histórico
  await assertSucceeds(deleteDoc(doc(firestore, 'contentScripts/s1')));
  await assertSucceeds(getDoc(doc(firestore, 'activityLog/script_ready_s1')));
});

test('instagramStats (retrato diário de seguidores): admin lê; ninguém escreve pelo cliente; não-admin e anônimo não leem', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'instagramStats/2026-10-08'), { day: '2026-10-08', followers: 1000 });
  });
  await assertSucceeds(getDoc(doc(admin(), 'instagramStats/2026-10-08')));
  await assertFails(setDoc(doc(admin(), 'instagramStats/2026-10-09'), { day: '2026-10-09', followers: 1 }));
  await assertFails(updateDoc(doc(admin(), 'instagramStats/2026-10-08'), { followers: 2 }));
  await assertFails(deleteDoc(doc(admin(), 'instagramStats/2026-10-08')));
  await assertFails(getDoc(doc(stranger(), 'instagramStats/2026-10-08')));
  await assertFails(getDoc(doc(anonymous(), 'instagramStats/2026-10-08')));
});
