// Regras do Fit (users/{uid}/fitDaily). Exige Java 21+ e firebase-tools (emulador local; não toca em produção).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-fit.test.js"
import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

const ride = (extra = {}) => ({
  source: 'mywhoosh', sourceKey: 'mywhoosh_1_20261007T200427Z', sport: 'cycling', virtual: true, startedAt: new Date('2026-10-07T20:04:27Z'),
  durationSec: 625, movingSec: 622, distanceKm: 4.448, avgSpeedKmh: 25.74, maxSpeedKmh: 30.1, avgCadenceRpm: 92, createdAt: serverTimestamp(), ...extra,
});
const rideRef = (db, owner, id = 'mywhoosh_1_20261007T200427Z') => doc(db, `users/${owner}/fitRides/${id}`);

test('fitRides: o dono cria um resumo válido, lê e apaga; ninguém edita', async () => {
  const db = as('owner');
  await assertSucceeds(setDoc(rideRef(db, 'owner'), ride()));
  await assertSucceeds(getDoc(rideRef(db, 'owner')));
  await assertSucceeds(getDocs(collection(db, 'users/owner/fitRides')));
  await assertFails(updateDoc(rideRef(db, 'owner'), { distanceKm: 99 }));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ distanceKm: 99 }))); // sobrescrever = update
  await assertSucceeds(deleteDoc(rideRef(db, 'owner')));
  const { avgCadenceRpm: _avgCadenceRpm, ...withoutCadence } = ride(); // cadência é opcional
  await assertSucceeds(setDoc(rideRef(db, 'owner'), withoutCadence));
  await assertSucceeds(deleteDoc(rideRef(db, 'owner')));
});

test('fitRides: recusa campos extras (GPS, FC), tipos errados, valores implausíveis, esporte diferente e id diferente da chave', async () => {
  const db = as('owner');
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ lat: 24.8, lng: 55.3 })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ avgHeartRate: 120 })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ distanceKm: '4' })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ distanceKm: 0 })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ distanceKm: 5000 })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ avgSpeedKmh: 400 })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ durationSec: 100000 })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ sport: 'running' })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ startedAt: '2026-10-07' })));
  await assertFails(setDoc(rideRef(db, 'owner'), ride({ createdAt: new Date('2020-01-01') }))); // createdAt tem de ser o horário do servidor
  await assertFails(setDoc(rideRef(db, 'owner', 'outro-id'), ride())); // id do documento = sourceKey
});

test('fitRides: outro administrador, usuário comum e visitante não leem, criam nem apagam os treinos do dono', async () => {
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'users/owner/fitRides/mywhoosh_1_20261007T200427Z'), { source: 'mywhoosh' }); });
  for (const db of [as('other-admin'), as('stranger'), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(rideRef(db, 'owner')));
    await assertFails(setDoc(rideRef(db, 'owner', 'mywhoosh_1_20261007T200427Z'), ride()));
    await assertFails(deleteDoc(rideRef(db, 'owner')));
  }
  await assertFails(setDoc(rideRef(as('stranger'), 'stranger'), ride())); // usuário comum nem no próprio caminho
  await assertSucceeds(setDoc(rideRef(as('other-admin'), 'other-admin'), ride())); // cada administrador só no próprio
});

test('outros caminhos sob users/ seguem negados, inclusive para o dono', async () => {
  await assertFails(getDoc(doc(as('owner'), 'users/owner')));
  await assertFails(getDoc(doc(as('owner'), 'users/owner/private/tokens')));
  await assertFails(setDoc(doc(as('owner'), 'users/owner/qualquer/x'), { a: 1 }));
});
