// Regras das Mamães em Collab (fichas e comissões pagas). Exige o emulador do Firestore (npm run test:rules).
import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { arrayUnion, deleteDoc, doc, getDoc, increment, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins/admin-user'), { active: true });
  });
});

after(async () => { await env?.cleanup(); });

const admin = () => env.authenticatedContext('admin-user').firestore();
const stranger = () => env.authenticatedContext('not-admin').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

test('fichas das criadoras: só administradores; o formulário público não grava pelo cliente', async () => {
  await assertSucceeds(setDoc(doc(admin(), 'collabPartners/p1'), { name: 'Mariana', status: 'form', children: [{ name: 'Theo', age: '4' }] }));
  await assertSucceeds(updateDoc(doc(admin(), 'collabPartners/p1'), { couponCode: 'MARI5' }));
  await assertFails(getDoc(doc(stranger(), 'collabPartners/p1')));
  await assertFails(getDoc(doc(anonymous(), 'collabPartners/p1')));
  await assertFails(setDoc(doc(anonymous(), 'collabPartners/p2'), { name: 'Spam' }));
  await assertFails(setDoc(doc(stranger(), 'collabPartners/p2'), { name: 'Spam' }));
  await assertSucceeds(deleteDoc(doc(admin(), 'collabPartners/p1')));
});

test('comissões pagas: id = parceira_semana, soma em um 2º pagamento, nunca apagadas', async () => {
  const path = 'collabPayouts/p1_2026-10-19';
  await assertSucceeds(setDoc(doc(admin(), path), { partnerId: 'p1', weekKey: '2026-10-19', orderIds: arrayUnion('o1'), amount: increment(3) }, { merge: true }));
  await assertSucceeds(setDoc(doc(admin(), path), { partnerId: 'p1', weekKey: '2026-10-19', orderIds: arrayUnion('o2'), amount: increment(3) }, { merge: true }));
  await assertFails(setDoc(doc(admin(), 'collabPayouts/p1_2026-10-26'), { partnerId: 'p2', weekKey: '2026-10-26', orderIds: [], amount: 3 }));
  await assertFails(setDoc(doc(admin(), 'collabPayouts/p1_semana'), { partnerId: 'p1', weekKey: 'semana', orderIds: [], amount: 3 }));
  await assertFails(updateDoc(doc(admin(), path), { amount: -1 }));
  await assertFails(deleteDoc(doc(admin(), path)));
  await assertFails(getDoc(doc(stranger(), path)));
  await assertFails(setDoc(doc(stranger(), 'collabPayouts/p9_2026-10-19'), { partnerId: 'p9', weekKey: '2026-10-19', orderIds: [], amount: 0 }));
});

test('limites de vagas em siteConfig/collab: só administradores', async () => {
  await assertSucceeds(setDoc(doc(admin(), 'siteConfig/collab'), { limits: { 2: 3 } }));
  await assertFails(getDoc(doc(anonymous(), 'siteConfig/collab')));
  await assertFails(setDoc(doc(stranger(), 'siteConfig/collab'), { limits: { 2: 99 } }));
});
