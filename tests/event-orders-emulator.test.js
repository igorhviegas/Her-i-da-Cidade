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

// 3. repetir conclusão, reabrir, editar valores e concluir de novo: os 3 lançamentos originais ficam intactos; a edição gera só AJUSTES
await orders.updateOrder(created.id, { status: 'completed' });
await orders.updateOrder(created.id, { status: 'scheduled' });
await orders.updateOrder(created.id, { eventForm: { ...input().eventForm, totalValue: 2000, entryValue: 1000, cost: 999 } });
await new Promise((r) => setTimeout(r, 25));
await orders.updateOrder(created.id, { status: 'completed' });
l = await ledger(created.id);
assert.equal(JSON.stringify(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, [v.amount, v.date.toMillis(), v.createdAt.toMillis()]]))), snapshot); // originais intactos
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 5); // + 2 ajustes (receita +1000, despesa +849)
assert.equal((await getDoc(doc(db, 'financeEntries', fin.ledgerId(created.id, 'adjrev', 1)))).data().amount, 1000);
assert.equal((await getDoc(doc(db, 'financeEntries', fin.ledgerId(created.id, 'adjcost', 1)))).data().amount, 849);
assert.equal((await orderDoc(created.id)).eventForm.totalValue, 2000);
step('repetir, reabrir, editar valores e concluir de novo: originais intactos; a edição vira ajustes (sem duplicar)');

// 4. conclusões concorrentes: ainda um único conjunto
const racing = await orders.createOrder(input());
const results = await Promise.allSettled([orders.updateOrder(racing.id, { status: 'completed' }), orders.updateOrder(racing.id, { status: 'completed' })]);
assert.ok(results.every((r) => r.status === 'fulfilled'), JSON.stringify(results));
l = await ledger(racing.id);
assert.deepEqual(Object.keys(l).sort(), ['cost', 'entry', 'final']);
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 8);
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
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 9);
step('pedido comum não gera lançamentos no livro');

// 8. excluir o pedido leva os lançamentos junto
await orders.deleteOrder(created.id);
assert.deepEqual(await ledger(created.id), {});
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, 4); // 9 − 5 lançamentos do pedido excluído (3 originais + 2 ajustes)
step('excluir o pedido remove seus lançamentos; os demais ficam');

// 9. pedido presencial vindo do ManyChat (rascunho): nada é lançado até o cadastro do evento ser salvo
const draftData = () => ({ clientId: 'c1', serviceId: 's1', status: 'scheduled', content: 'Pedido recebido via ManyChat.', servicePrice: 0, rushFee: 0, totalPaid: 0, productionType: 'scheduled', source: 'manychat', eventDraft: true, createdAt: new Date() });
const makeDraft = async () => {
  const ref = doc(collection(db, 'orders'));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'orders', ref.id), draftData()); });
  return ref.id;
};
const before = (await getDocs(collection(db, 'financeEntries'))).size;
const draftId = await makeDraft();
assert.equal((await getDocs(collection(db, 'financeEntries'))).size, before);
await assert.rejects(orders.updateOrder(draftId, { status: 'completed' }), /Complete os dados do evento/);
assert.equal((await orderDoc(draftId)).status, 'scheduled');
assert.deepEqual(await ledger(draftId), {});
step('rascunho do ManyChat: sem lançamentos e conclusão bloqueada');

const filled = { ...input().eventForm };
await orders.updateOrder(draftId, { eventForm: filled, childName: 'Pedro', eventDate: new Date(2026, 9, 10, 12), content: 'x', servicePrice: 1000, rushFee: 0, totalPaid: 1000 });
const draft = await orderDoc(draftId);
assert.equal(draft.eventDraft, undefined);
assert.deepEqual(draft.eventLedger, { entry: 500 });
l = await ledger(draftId);
assert.deepEqual(Object.keys(l), ['entry']);
assert.equal(l.entry.amount, 500);
step('cadastro do evento salvo: vira evento comum e lança só a entrada (R$ 500)');
const entryStamp = l.entry.createdAt.toMillis();

await orders.updateOrder(draftId, { eventForm: { ...filled, totalValue: 3000, entryValue: 1500 } }); // edição posterior
l = await ledger(draftId);
assert.deepEqual([Object.keys(l).length, l.entry.amount, l.entry.createdAt.toMillis()], [1, 500, entryStamp]);
assert.deepEqual((await orderDoc(draftId)).eventLedger, { entry: 500, adj: 1000, seq: 1 }); // a edição de entrada vira ajuste, não nova entrada
assert.equal((await getDoc(doc(db, 'financeEntries', fin.ledgerId(draftId, 'adjrev', 1)))).data().amount, 1000);
step('salvar de novo não lança outra entrada nem altera a existente (a mudança de valor vira ajuste)');

await orders.updateOrder(draftId, { eventForm: { ...filled, totalValue: 1000, entryValue: 500 } });
await orders.updateOrder(draftId, { status: 'completed' });
l = await ledger(draftId);
assert.deepEqual(Object.keys(l).sort(), ['cost', 'entry', 'final']);
assert.deepEqual([l.final.amount, l.cost.amount], [500, 150]);
step('conclusão após o cadastro: 2ª parcela e despesa, uma vez cada');

const noCost = await makeDraft();
await orders.updateOrder(noCost, { eventForm: { ...filled, cost: null }, childName: 'Ana', eventDate: new Date(2026, 9, 11, 12), content: 'x', servicePrice: 1000, rushFee: 0, totalPaid: 1000 });
await assert.rejects(orders.updateOrder(noCost, { status: 'completed' }), /informe o custo/);
assert.deepEqual(Object.keys(await ledger(noCost)), ['entry']);
step('rascunho completado sem custo: conclusão exige o custo e nada é lançado');

// 10. alterar valores com reflexo no Financeiro: ajustes (diferença com sinal), sem reescrever lançamentos
const ids = (rec) => Object.keys(rec).sort();
const allLedger = async (id) => {
  const out = {};
  for (const entryId of fin.ledgerIdsFor(id, (await orderDoc(id)).eventLedger)) { const s = await getDoc(doc(db, 'financeEntries', entryId)); if (s.exists()) out[entryId] = s.data(); }
  return out;
};
const adjOrder = await orders.createOrder(input()); // entrada 500
const A = adjOrder.id;
await orders.updateOrder(A, { eventForm: { ...input().eventForm, entryValue: 700 } }); // antes de concluir: só a entrada conta
let all = await allLedger(A);
assert.deepEqual(ids(all), [`evt-${A}-adjrev-1`, `evt-${A}-entry`]);
assert.equal(all[`evt-${A}-adjrev-1`].amount, 200);
assert.equal(all[`evt-${A}-entry`].amount, 500); // original intacto
assert.deepEqual((await orderDoc(A)).eventLedger, { entry: 500, adj: 200, seq: 1 });
await orders.updateOrder(A, { eventForm: { ...input().eventForm, entryValue: 700 } }); // mesmo valor de novo: nada novo
assert.equal(Object.keys(await allLedger(A)).length, 2);
step('antes da conclusão: mudar a entrada lança o ajuste (+R$ 200) sem tocar na entrada original');

await orders.updateOrder(A, { status: 'completed' });
all = await allLedger(A);
assert.equal(all[`evt-${A}-final`].amount, 300); // total 1000 − (500 + 200): receita total fecha em 1000
step('conclusão considera a entrada ajustada: 2ª parcela R$ 300 (receita total R$ 1.000)');

await orders.updateOrder(A, { eventForm: { ...input().eventForm, entryValue: 700, totalValue: 1200, cost: 100 } });
all = await allLedger(A);
assert.equal(all[`evt-${A}-adjrev-2`].amount, 200); // 1200 − (500 + 300 + 200)
assert.equal(all[`evt-${A}-adjcost-2`].amount, -50); // 100 − 150
assert.equal(all[`evt-${A}-final`].amount, 300); assert.equal(all[`evt-${A}-cost`].amount, 150); // originais intactos
assert.deepEqual((await orderDoc(A)).eventLedger, { entry: 500, final: 300, cost: 150, adj: 400, adjCost: -50, seq: 2 });
step('depois da conclusão: total e custo alterados geram ajustes (+R$ 200 receita, −R$ 50 despesa)');

// reabrir/concluir e salvar de novo não repete ajustes
await orders.updateOrder(A, { status: 'scheduled' });
await orders.updateOrder(A, { eventForm: { ...input().eventForm, entryValue: 700, totalValue: 1200, cost: 100 } });
await orders.updateOrder(A, { status: 'completed' });
assert.equal(Object.keys(await allLedger(A)).length, 6); // entrada, 2ª parcela, custo, 2 ajustes de receita e 1 de despesa
step('reabrir, salvar igual e concluir de novo: nenhum ajuste repetido');

// edições simultâneas idênticas: um único ajuste
const B = (await orders.createOrder(input())).id;
const edit = { eventForm: { ...input().eventForm, entryValue: 800 } };
const raced = await Promise.allSettled([orders.updateOrder(B, edit), orders.updateOrder(B, edit)]);
assert.ok(raced.every((r) => r.status === 'fulfilled'), JSON.stringify(raced));
assert.deepEqual(ids(await allLedger(B)), [`evt-${B}-adjrev-1`, `evt-${B}-entry`]);
step('duas edições simultâneas iguais geram um único ajuste');

// excluir o pedido leva o histórico junto, inclusive os ajustes
await orders.deleteOrder(A);
assert.deepEqual(await getDoc(doc(db, 'financeEntries', `evt-${A}-adjrev-2`)).then((s) => s.exists()), false);
assert.deepEqual(await getDoc(doc(db, 'financeEntries', `evt-${A}-entry`)).then((s) => s.exists()), false);
step('excluir o pedido remove entrada, parcelas, custo e ajustes');

await vite.close(); await env.cleanup();
console.log('E2E OK');
