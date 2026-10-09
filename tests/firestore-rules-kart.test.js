// Regras do Campeonato Viegas Kart. Exige Java 21+ e firebase-tools (emulador local; não toca em produção).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-kart.test.js"
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

const anonymous = () => env.unauthenticatedContext().firestore();
const stranger = () => env.authenticatedContext('not-admin').firestore();
const admin = () => env.authenticatedContext('admin-user').firestore();

const SAMPLES = {
  'kartPilots/igor-viegas': { name: 'Igor Viegas', aliases: [], active: true },
  'kartRaces/2026-08-15-1835': { date: '2026-08-15', heat: 'Bateria 18:35', weather: 'dry', extra: false, results: [] },
  'kartVideos/v1': { title: 'Dicas', youtubeId: 'dQw4w9WgXcQ', kind: 'tip', order: 1, active: true },
  'kartConfig/next': { date: '2026-12-12', time: '15:30' },
};

for (const [path, data] of Object.entries(SAMPLES)) {
  test(`${path.split('/')[0]}: qualquer pessoa lê (área pública); só administrador cria, altera e apaga`, async () => {
    await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), path), data); });

    // leitura pública, sem login
    await assertSucceeds(getDoc(doc(anonymous(), path)));
    await assertSucceeds(getDoc(doc(stranger(), path)));

    // escrita negada para visitante e para usuário logado que não é administrador
    for (const db of [anonymous(), stranger()]) {
      await assertFails(setDoc(doc(db, path), { ...data, hacked: true }));
      await assertFails(updateDoc(doc(db, path), { hacked: true }));
      await assertFails(deleteDoc(doc(db, path)));
    }

    // administrador faz tudo
    await assertSucceeds(updateDoc(doc(admin(), path), { note: 'ok' }));
    await assertSucceeds(setDoc(doc(admin(), path), data));
    await assertSucceeds(deleteDoc(doc(admin(), path)));
  });
}

test('coleções do kart não vazam para outras: coleção desconhecida segue negada', async () => {
  await assertFails(setDoc(doc(admin(), 'kartOutra/x'), { a: 1 }));
  await assertFails(getDoc(doc(anonymous(), 'kartOutra/x')));
});
