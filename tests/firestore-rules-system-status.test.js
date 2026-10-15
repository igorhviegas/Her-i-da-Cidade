// Regras de systemStatus (telemetria das rotinas). Exige Java 21+ e firebase-tools (emulador local; não toca em produção).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-system-status.test.js"
import test, { after, before } from 'node:test';
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
    await setDoc(doc(db, 'systemStatus/missions'), { job: 'missions', ok: true, lastRunAt: '2026-10-15T03:00:00.000Z' }); // como o servidor grava
  });
});
after(async () => { await env?.cleanup(); });

const admin = () => env.authenticatedContext('admin-user').firestore();
const stranger = () => env.authenticatedContext('not-admin').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

test('systemStatus: administrador lê; ninguém grava pelo navegador (nem administrador); quem não é admin não lê', async () => {
  const ref = (db) => doc(db, 'systemStatus/missions');
  await assertSucceeds(getDoc(ref(admin())));
  await assertFails(getDoc(ref(stranger())));
  await assertFails(getDoc(ref(anonymous())));
  await assertFails(setDoc(ref(admin()), { ok: false }));
  await assertFails(updateDoc(ref(admin()), { ok: false }));
  await assertFails(deleteDoc(ref(admin())));
  await assertFails(setDoc(doc(admin(), 'systemStatus/novo'), { ok: true }));
});
