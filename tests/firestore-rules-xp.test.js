// Regras do XP. Exige Java 21+ e firebase-tools (emulador local; não toca em produção).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-xp.test.js"
import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;
before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'admins/admin-user'), { enabled: true }); });
});
after(async () => { await env?.cleanup(); });

const admin = () => env.authenticatedContext('admin-user').firestore();
const stranger = () => env.authenticatedContext('not-admin').firestore();

test('xpBaseline: administrador lê e cria uma única vez; ninguém altera nem apaga; quem não é admin não acessa', async () => {
  const ref = (db) => doc(db, 'xpBaseline/main');
  await assertFails(getDoc(ref(stranger())));
  await assertFails(setDoc(ref(stranger()), { total: 1 }));
  await assertSucceeds(setDoc(ref(admin()), { total: 1 }));
  await assertSucceeds(getDoc(ref(admin())));
  await assertFails(setDoc(ref(admin()), { total: 2 }));
  await assertFails(updateDoc(ref(admin()), { total: 2 }));
  await assertFails(deleteDoc(ref(admin())));
});
