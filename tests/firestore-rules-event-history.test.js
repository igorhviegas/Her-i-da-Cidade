// Regras do histórico de eventos antigos (aba Mapa). Exige o emulador do Firestore (npm run test:rules).
import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

test('eventHistory: só administradores leem e gravam', async () => {
  const admin = env.authenticatedContext('admin-user').firestore();
  await assertSucceeds(setDoc(doc(admin, 'eventHistory/2024-05-10-ana'), { childName: 'Ana', eventDate: '2024-05-10', location: 'Rua A' }));
  await assertSucceeds(getDoc(doc(admin, 'eventHistory/2024-05-10-ana')));
  await assertFails(getDoc(doc(env.authenticatedContext('not-admin').firestore(), 'eventHistory/2024-05-10-ana')));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'eventHistory/x'), { childName: 'Spam' }));
});
