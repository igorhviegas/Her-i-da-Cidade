// Regras do módulo Instagram Analytics. Exige Java 21+ e firebase-tools (emulador local; não toca em produção).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-instagram.test.js"
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'admins/admin-user'), { enabled: true });
    await setDoc(doc(db, 'instagramMeta/profile'), { followers: 1 });
    await setDoc(doc(db, 'instagramMeta/day-2026-03-10'), { followers: 1 });
    await setDoc(doc(db, 'instagramPosts/p1'), { likes: 1 });
    await setDoc(doc(db, 'instagramPrivate/token'), { accessToken: 'segredo' });
    await setDoc(doc(db, 'instagramPrivate/lock'), { until: 0 });
    await setDoc(doc(db, 'instagramPrivate/daily'), { followers0: 1 });
  });
});

after(async () => { await env?.cleanup(); });

const admin = () => env.authenticatedContext('admin-user').firestore();
const stranger = () => env.authenticatedContext('not-admin').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

test('instagramMeta e instagramPosts: só administrador lê; ninguém escreve pelo cliente', async () => {
  for (const path of ['instagramMeta/profile', 'instagramMeta/day-2026-03-10', 'instagramPosts/p1']) {
    await assertSucceeds(getDoc(doc(admin(), path)));
    await assertFails(getDoc(doc(stranger(), path)));
    await assertFails(getDoc(doc(anonymous(), path)));
    await assertFails(setDoc(doc(admin(), path), { x: 1 }));
    await assertFails(updateDoc(doc(admin(), path), { x: 1 }));
    await assertFails(deleteDoc(doc(admin(), path)));
    await assertFails(setDoc(doc(stranger(), path), { x: 1 }));
  }
  await assertFails(setDoc(doc(admin(), 'instagramPosts/novo'), { likes: 1 }));
});

test('instagramPrivate (token e reserva): nenhum acesso pelo cliente, nem do administrador', async () => {
  for (const path of ['instagramPrivate/token', 'instagramPrivate/lock', 'instagramPrivate/daily']) {
    await assertFails(getDoc(doc(admin(), path)));
    await assertFails(setDoc(doc(admin(), path), { until: 0 }));
    await assertFails(updateDoc(doc(admin(), path), { until: 0 }));
    await assertFails(deleteDoc(doc(admin(), path)));
    await assertFails(getDoc(doc(stranger(), path)));
    await assertFails(getDoc(doc(anonymous(), path)));
  }
});

test('o arquivo de regras não ficou com coleções do Instagram abertas', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/instagramPrivate\/\{docId\}\s*\{\s*allow read, write: if false;/);
});
