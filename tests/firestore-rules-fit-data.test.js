// Regras do Fit: peso manual, check-ins, biblioteca de exercícios, planos de treino e XP (activityLog). Exige Java 21+ e firebase-tools
// (emulador local; não toca em produção).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-fit-data.test.js"
import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

let env;
before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId: 'demo-heroi-da-cidade', firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'admins/owner'), { enabled: true });
    await setDoc(doc(db, 'admins/other-admin'), { enabled: true });
  });
});
after(async () => { await env?.cleanup(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const at = (db, owner, path) => doc(db, `users/${owner}/${path}`);

const weight = (extra = {}) => ({ day: '2026-10-07', kg: 72.5, updatedAt: serverTimestamp(), ...extra });
const checkin = (extra = {}) => ({ kind: 'gym', day: '2026-10-07', durationMin: 55, note: 'perna', workoutName: 'Treino A', exercisesDone: 6, exercisesTotal: 8, updatedAt: serverTimestamp(), ...extra });
const exercise = (extra = {}) => ({ name: 'Prancha', category: 'Abdômen', timerSec: 60, updatedAt: serverTimestamp(), ...extra });
const workout = (extra = {}) => ({ name: 'Treino A', exerciseIds: ['e1', 'e2'], updatedAt: serverTimestamp(), ...extra });

test('fitWeight: o dono cria, corrige e apaga; recusa kg implausível, id diferente do dia e campo extra', async () => {
  const db = as('owner');
  await assertSucceeds(setDoc(at(db, 'owner', 'fitWeight/2026-10-07'), weight()));
  await assertSucceeds(setDoc(at(db, 'owner', 'fitWeight/2026-10-07'), weight({ kg: 72 }))); // corrigir o dia
  await assertSucceeds(getDoc(at(db, 'owner', 'fitWeight/2026-10-07')));
  await assertFails(setDoc(at(db, 'owner', 'fitWeight/2026-10-08'), weight({ kg: 10 })));
  await assertFails(setDoc(at(db, 'owner', 'fitWeight/2026-10-08'), weight({ kg: 600 })));
  await assertFails(setDoc(at(db, 'owner', 'fitWeight/2026-10-08'), weight({ kg: '72' })));
  await assertFails(setDoc(at(db, 'owner', 'fitWeight/2026-10-09'), weight())); // day no corpo != id
  await assertFails(setDoc(at(db, 'owner', 'fitWeight/2026-10-07'), weight({ nota: 'x' })));
  await assertFails(setDoc(at(db, 'owner', 'fitWeight/2026-10-07'), weight({ updatedAt: new Date('2020-01-01') })));
  await assertFails(setDoc(at(db, 'owner', 'fitWeight/hoje'), weight({ day: 'hoje' })));
  await assertSucceeds(deleteDoc(at(db, 'owner', 'fitWeight/2026-10-07')));
});

test('fitCheckins: um por tipo e dia (id = tipo_dia); opcionais validados; correção permitida', async () => {
  const db = as('owner');
  await assertSucceeds(setDoc(at(db, 'owner', 'fitCheckins/gym_2026-10-07'), checkin()));
  await assertSucceeds(setDoc(at(db, 'owner', 'fitCheckins/gym_2026-10-07'), checkin({ durationMin: 60 })));
  await assertSucceeds(setDoc(at(db, 'owner', 'fitCheckins/functional_2026-10-07'), { kind: 'functional', day: '2026-10-07', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(at(db, 'owner', 'fitCheckins/gym_2026-10-08'), checkin())); // day != id
  await assertFails(setDoc(at(db, 'owner', 'fitCheckins/yoga_2026-10-07'), checkin({ kind: 'yoga' })));
  await assertFails(setDoc(at(db, 'owner', 'fitCheckins/gym_2026-10-10'), checkin({ day: '2026-10-10', durationMin: 0 })));
  await assertFails(setDoc(at(db, 'owner', 'fitCheckins/gym_2026-10-10'), checkin({ day: '2026-10-10', note: 'x'.repeat(301) })));
  await assertFails(setDoc(at(db, 'owner', 'fitCheckins/gym_2026-10-10'), checkin({ day: '2026-10-10', exercisesDone: 2.5 })));
  await assertFails(setDoc(at(db, 'owner', 'fitCheckins/gym_2026-10-10'), checkin({ day: '2026-10-10', local: 'Pratique' })));
  await assertSucceeds(deleteDoc(at(db, 'owner', 'fitCheckins/functional_2026-10-07')));
});

test('fitExercises e fitWorkouts: o dono cadastra, altera e apaga; timer só 5–3.600 s inteiro ou nulo; nome obrigatório', async () => {
  const db = as('owner');
  await assertSucceeds(setDoc(at(db, 'owner', 'fitExercises/e1'), exercise()));
  await assertSucceeds(setDoc(at(db, 'owner', 'fitExercises/e2'), exercise({ name: 'Supino', category: 'Peito', timerSec: null })));
  await assertSucceeds(setDoc(at(db, 'owner', 'fitExercises/e1'), exercise({ timerSec: 90 })));
  await assertFails(setDoc(at(db, 'owner', 'fitExercises/e3'), exercise({ timerSec: 4 })));
  await assertFails(setDoc(at(db, 'owner', 'fitExercises/e3'), exercise({ timerSec: 4000 })));
  await assertFails(setDoc(at(db, 'owner', 'fitExercises/e3'), exercise({ timerSec: 30.5 })));
  await assertFails(setDoc(at(db, 'owner', 'fitExercises/e3'), exercise({ name: '' })));
  await assertFails(setDoc(at(db, 'owner', 'fitExercises/e3'), exercise({ category: 'c'.repeat(41) })));
  await assertSucceeds(setDoc(at(db, 'owner', 'fitWorkouts/w1'), workout()));
  await assertSucceeds(setDoc(at(db, 'owner', 'fitWorkouts/w1'), workout({ exerciseIds: ['e2', 'e1'] })));
  await assertFails(setDoc(at(db, 'owner', 'fitWorkouts/w2'), workout({ name: '' })));
  await assertFails(setDoc(at(db, 'owner', 'fitWorkouts/w2'), workout({ exerciseIds: Array.from({ length: 61 }, (_, i) => `e${i}`) })));
  await assertFails(setDoc(at(db, 'owner', 'fitWorkouts/w2'), workout({ exerciseIds: 'e1' })));
  await assertSucceeds(deleteDoc(at(db, 'owner', 'fitWorkouts/w1')));
  await assertSucceeds(deleteDoc(at(db, 'owner', 'fitExercises/e2')));
});

test('peso, check-ins, exercícios e planos: outro administrador, usuário comum e visitante não leem nem gravam no caminho do dono', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/owner/fitWeight/2026-11-01'), { day: '2026-11-01', kg: 70 });
    await setDoc(doc(db, 'users/owner/fitCheckins/gym_2026-11-01'), { kind: 'gym', day: '2026-11-01' });
    await setDoc(doc(db, 'users/owner/fitExercises/x1'), { name: 'X', category: 'Y', timerSec: null });
    await setDoc(doc(db, 'users/owner/fitWorkouts/x1'), { name: 'X', exerciseIds: [] });
  });
  const cases = [['fitWeight/2026-11-01', weight({ day: '2026-11-01' })], ['fitCheckins/gym_2026-11-01', checkin({ day: '2026-11-01' })], ['fitExercises/x1', exercise()], ['fitWorkouts/x1', workout()]];
  for (const db of [as('other-admin'), as('stranger'), env.unauthenticatedContext().firestore()]) {
    for (const [path, data] of cases) {
      await assertFails(getDoc(at(db, 'owner', path)));
      await assertFails(setDoc(at(db, 'owner', path), data));
      await assertFails(deleteDoc(at(db, 'owner', path)));
    }
  }
});

// ---------- XP do Fit (activityLog) ----------
const xpEvent = (type, refId, xp, extra = {}) => ({ type, refId, difficulty: null, difficultyKey: null, occurredAt: serverTimestamp(), xp, meta: { x: 1 }, ...extra });
const logRef = (db, type, refId) => doc(db, `activityLog/${type}_${refId}`);

test('XP do Fit: pedalada vale até 50 XP/km do treino importado; origem inexistente, XP acima, repetição e hora do cliente são recusados', async () => {
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'users/owner/fitRides/r-xp'), { distanceKm: 4.448 }); });
  const db = as('owner');
  await assertFails(setDoc(logRef(db, 'fit_ride', 'r-xp'), xpEvent('fit_ride', 'r-xp', 223))); // 4,448 km -> no máximo 222
  await assertFails(setDoc(logRef(db, 'fit_ride', 'r-xp'), xpEvent('fit_ride', 'r-xp', 0)));
  await assertFails(setDoc(logRef(db, 'fit_ride', 'r-xp'), xpEvent('fit_ride', 'r-xp', 222.5)));
  await assertFails(setDoc(logRef(db, 'fit_ride', 'r-xp'), xpEvent('fit_ride', 'r-xp', 222, { occurredAt: new Date('2020-01-01') })));
  await assertFails(setDoc(logRef(db, 'fit_ride', 'r-xp'), xpEvent('fit_ride', 'r-xp', 222, { extra: 1 })));
  await assertFails(setDoc(doc(db, 'activityLog/fit_ride_outro'), xpEvent('fit_ride', 'r-xp', 222))); // id != tipo_refId
  await assertFails(setDoc(logRef(db, 'fit_ride', 'nao-existe'), xpEvent('fit_ride', 'nao-existe', 10)));
  await assertSucceeds(setDoc(logRef(db, 'fit_ride', 'r-xp'), xpEvent('fit_ride', 'r-xp', 222)));
  await assertFails(setDoc(logRef(db, 'fit_ride', 'r-xp'), xpEvent('fit_ride', 'r-xp', 222))); // coletar de novo = update
  await assertFails(deleteDoc(logRef(db, 'fit_ride', 'r-xp')));
});

test('XP do Fit: passos de um dia valem 1 XP a cada 10, com teto de 2.000 (20.000 passos); check-in vale até 500; só com a origem existente', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/owner/fitDaily/2026-10-01'), { day: '2026-10-01', steps: 8000 });
    await setDoc(doc(db, 'users/owner/fitDaily/2026-10-02'), { day: '2026-10-02', steps: 50000 });
    await setDoc(doc(db, 'users/owner/fitDaily/2026-10-03'), { day: '2026-10-03', walkRunKm: 1 }); // sem passos
    await setDoc(doc(db, 'users/owner/fitCheckins/gym_2026-10-05'), { kind: 'gym', day: '2026-10-05' });
  });
  const db = as('owner');
  await assertFails(setDoc(logRef(db, 'fit_steps', '2026-10-01'), xpEvent('fit_steps', '2026-10-01', 801)));
  await assertSucceeds(setDoc(logRef(db, 'fit_steps', '2026-10-01'), xpEvent('fit_steps', '2026-10-01', 800)));
  await assertFails(setDoc(logRef(db, 'fit_steps', '2026-10-02'), xpEvent('fit_steps', '2026-10-02', 2001)));
  await assertSucceeds(setDoc(logRef(db, 'fit_steps', '2026-10-02'), xpEvent('fit_steps', '2026-10-02', 2000)));
  await assertFails(setDoc(logRef(db, 'fit_steps', '2026-10-03'), xpEvent('fit_steps', '2026-10-03', 1))); // dia sem passos
  await assertFails(setDoc(logRef(db, 'fit_steps', '2026-10-04'), xpEvent('fit_steps', '2026-10-04', 1))); // dia inexistente
  await assertFails(setDoc(logRef(db, 'fit_checkin', 'gym_2026-10-05'), xpEvent('fit_checkin', 'gym_2026-10-05', 501)));
  await assertSucceeds(setDoc(logRef(db, 'fit_checkin', 'gym_2026-10-05'), xpEvent('fit_checkin', 'gym_2026-10-05', 500)));
  await assertFails(setDoc(logRef(db, 'fit_checkin', 'gym_2026-10-06'), xpEvent('fit_checkin', 'gym_2026-10-06', 500))); // check-in inexistente
});

test('XP do Fit: outro administrador não coleta XP com dados do dono; eventos de outros tipos continuam como antes', async () => {
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'users/owner/fitRides/r-dono'), { distanceKm: 10 }); });
  await assertFails(setDoc(logRef(as('other-admin'), 'fit_ride', 'r-dono'), xpEvent('fit_ride', 'r-dono', 100)));
  await assertFails(setDoc(logRef(as('stranger'), 'fit_ride', 'r-dono'), xpEvent('fit_ride', 'r-dono', 100)));
  await assertSucceeds(setDoc(doc(as('other-admin'), 'activityLog/mission_abc'), { type: 'mission', refId: 'abc', difficulty: 3, occurredAt: new Date() })); // regra antiga intacta
  await assertFails(setDoc(doc(as('stranger'), 'activityLog/mission_zzz'), { type: 'mission', refId: 'zzz', difficulty: 3, occurredAt: new Date() }));
});
