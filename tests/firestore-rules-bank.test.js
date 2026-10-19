// Regras do extrato do Banco Inter (bankTransactions) e das regras de categoria. Exige Java 21+ e firebase-tools (emulador local).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-bank.test.js"
import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;
before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'admins/owner'), { enabled: true }); });
});
after(async () => { await env?.cleanup(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const tx = (extra = {}) => ({ date: '2026-10-01', monthKey: '2026-10', amount: 350, kind: 'in', title: 'Pix recebido', description: 'Fulano', balance: 1350, source: 'csv', category: null, importedAt: serverTimestamp(), ...extra });

test('bankTransactions: admin importa e só muda a categoria; ninguém apaga; outros não leem', async () => {
  const db = as('owner');
  const ref = doc(db, 'bankTransactions/c_2026-10-01_35000_135000_0');
  await assertSucceeds(setDoc(ref, tx()));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, { category: 'Serviços (clientes)' }));
  await assertSucceeds(updateDoc(ref, { category: null }));
  await assertFails(updateDoc(ref, { amount: 1 }));
  await assertFails(updateDoc(ref, { category: 'x'.repeat(61) }));
  await assertFails(deleteDoc(ref));
  await assertFails(setDoc(doc(db, 'bankTransactions/b'), tx({ amount: -1 })));
  await assertFails(setDoc(doc(db, 'bankTransactions/b'), tx({ date: '2026-11-01' }))); // fora do monthKey
  await assertFails(setDoc(doc(db, 'bankTransactions/b'), tx({ kind: 'x' })));
  await assertFails(setDoc(doc(db, 'bankTransactions/b'), tx({ extra: 1 })));
  await assertFails(setDoc(doc(db, 'bankTransactions/b'), tx({ importedAt: new Date('2020-01-01') })));
  await assertFails(getDoc(doc(as('stranger'), 'bankTransactions/c_2026-10-01_35000_135000_0')));
  await assertFails(setDoc(doc(as('stranger'), 'bankTransactions/c'), tx()));
});

test('bankCategoryRules: admin grava e apaga; campos validados', async () => {
  const db = as('owner');
  const ref = doc(db, 'bankCategoryRules/out%7Cpagamento%7Cadobe');
  await assertSucceeds(setDoc(ref, { key: 'out|pagamento|adobe', category: 'Assinaturas e software', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { key: 'out|pagamento|adobe', category: '', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { key: 'k', category: 'c', updatedAt: serverTimestamp(), x: 1 }));
  await assertSucceeds(deleteDoc(ref));
  await assertFails(getDoc(doc(as('stranger'), 'bankCategoryRules/x')));
});

test('bankSettings/categories: admin salva listas e ocultas; outro id, campo extra e visitante falham', async () => {
  const db = as('owner');
  const settings = (extra = {}) => ({ in: ['Serviços (clientes)'], out: ['Tarifas bancárias'], hidden: ['Transferência entre contas'], updatedAt: serverTimestamp(), ...extra });
  await assertSucceeds(setDoc(doc(db, 'bankSettings/categories'), settings()));
  await assertSucceeds(getDoc(doc(db, 'bankSettings/categories')));
  await assertFails(setDoc(doc(db, 'bankSettings/outro'), settings()));
  await assertFails(setDoc(doc(db, 'bankSettings/categories'), settings({ x: 1 })));
  await assertFails(setDoc(doc(db, 'bankSettings/categories'), settings({ hidden: 'x' })));
  await assertFails(getDoc(doc(as('stranger'), 'bankSettings/categories')));
});
