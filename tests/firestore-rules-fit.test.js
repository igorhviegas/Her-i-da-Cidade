// Regras do Fit (users/{uid}/fitDaily). Exige Java 21+ e firebase-tools (emulador local; não toca em produção).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-fit.test.js"
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;
before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'admins/owner'), { enabled: true });
    await setDoc(doc(db, 'admins/other-admin'), { enabled: true }); // outro administrador do CRM
    await setDoc(doc(db, 'users/owner/fitDaily/2026-10-07'), { day: '2026-10-07', steps: 100 });
    await setDoc(doc(db, 'users/other-admin/fitDaily/2026-10-07'), { day: '2026-10-07', steps: 200 });
    await setDoc(doc(db, 'users/owner/private/tokens'), { secret: 'x' });
  });
});
after(async () => { await env?.cleanup(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const day = (db, owner) => doc(db, `users/${owner}/fitDaily/2026-10-07`);

test('fitDaily: o dono (administrador) lê os próprios dados', async () => {
  await assertSucceeds(getDoc(day(as('owner'), 'owner')));
  await assertSucceeds(getDocs(collection(as('owner'), 'users/owner/fitDaily')));
});

test('fitDaily: outro administrador, usuário comum e visitante não leem os dados do dono', async () => {
  await assertFails(getDoc(day(as('other-admin'), 'owner')));
  await assertFails(getDocs(collection(as('other-admin'), 'users/owner/fitDaily')));
  await assertFails(getDoc(day(as('stranger'), 'owner')));
  await assertFails(getDoc(day(env.unauthenticatedContext().firestore(), 'owner')));
  await assertSucceeds(getDoc(day(as('other-admin'), 'other-admin'))); // cada um só vê o próprio
});

test('fitDaily: usuário comum não lê nem os próprios dados (exige ser administrador)', async () => {
  await assertFails(getDoc(day(as('stranger'), 'stranger')));
});

test('fitDaily: nenhum cliente grava (nem o dono): a escrita é só do servidor', async () => {
  const db = as('owner');
  await assertFails(setDoc(doc(db, 'users/owner/fitDaily/2026-10-08'), { day: '2026-10-08', steps: 1 }));
  await assertFails(updateDoc(day(db, 'owner'), { steps: 999 }));
  await assertFails(deleteDoc(day(db, 'owner')));
  await assertFails(setDoc(day(as('other-admin'), 'owner'), { steps: 1 }));
});

test('outros caminhos sob users/ seguem negados, inclusive para o dono', async () => {
  await assertFails(getDoc(doc(as('owner'), 'users/owner')));
  await assertFails(getDoc(doc(as('owner'), 'users/owner/private/tokens')));
  await assertFails(setDoc(doc(as('owner'), 'users/owner/qualquer/x'), { a: 1 }));
});
