// Regras do Clarim Semanal (clarimEditions e pages). Exige Java 21+ e firebase-tools (emulador local).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-clarim.test.js"
import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;
before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins/owner'), { enabled: true });
    await setDoc(doc(context.firestore(), 'admins/other'), { enabled: true });
  });
});
after(async () => { await env?.cleanup(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const edition = (extra = {}) => ({ number: 1, periodStart: '2026-10-12', periodEnd: '2026-10-18', status: 'draft', publishedAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
const page = (extra = {}) => ({ template: 'news', order: 0, fields: { headline: 'Agenda aberta' }, photos: {}, ads: {}, sources: [], services: [], approval: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });

test('clarimEditions: admin cria, lê, publica e exclui; visitante não; número e criação fixos', async () => {
  const db = as('owner');
  const ref = doc(db, 'clarimEditions/e1');
  await assertSucceeds(setDoc(ref, edition()));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, { status: 'published', publishedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { number: 2, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { createdAt: new Date('2020-01-01'), updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(as('stranger'), 'clarimEditions/e1')));
  await assertFails(setDoc(doc(as('stranger'), 'clarimEditions/x'), edition()));
  const bad = (extra) => setDoc(doc(db, 'clarimEditions/bad'), edition(extra));
  await assertFails(bad({ periodStart: '12/10/2026' }));
  await assertFails(bad({ periodStart: '2026-10-19' }));
  await assertFails(bad({ status: 'archived' }));
  await assertFails(bad({ number: 0 }));
  await assertFails(bad({ extra: true }));
  await assertSucceeds(deleteDoc(ref));
});

test('pages: aprovação só em nome de quem está logado, com a hora do servidor', async () => {
  const db = as('owner');
  await assertSucceeds(setDoc(doc(db, 'clarimEditions/e2'), edition()));
  const ref = doc(db, 'clarimEditions/e2/pages/p1');
  await assertFails(setDoc(ref, page({ approval: { by: 'owner', at: serverTimestamp(), hash: 'abc' } })));
  await assertFails(setDoc(ref, page({ template: 'poster' })));
  await assertFails(setDoc(ref, page({ sources: ['a', 'b', 'c', 'd'] })));
  await assertSucceeds(setDoc(ref, page()));
  await assertFails(updateDoc(ref, { approval: { by: 'other', at: serverTimestamp(), hash: 'abc' }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { approval: { by: 'owner', at: new Date('2026-01-01'), hash: 'abc' }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { approval: { by: 'owner', at: serverTimestamp(), hash: 'abc' }, updatedAt: serverTimestamp() }));
  // salvar outros campos mantendo a aprovação gravada vale; trocar o template não
  await assertSucceeds(updateDoc(ref, { fields: { headline: 'Outra' }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { template: 'cover', updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(as('stranger'), 'clarimEditions/e2/pages/p1')));
  await assertFails(deleteDoc(doc(as('stranger'), 'clarimEditions/e2/pages/p1')));
  await assertSucceeds(updateDoc(ref, { approval: null, updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(ref));
});
