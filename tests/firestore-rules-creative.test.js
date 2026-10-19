// Regras da Caixinha de Perguntas (creativeQuestions). Exige Java 21+ e firebase-tools (emulador local).
// Execução: firebase emulators:exec --only firestore --project demo-heroi-da-cidade "node --test tests/firestore-rules-creative.test.js"
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
    await setDoc(doc(context.firestore(), 'contentScripts/s1'), { title: 'Resposta', content: 'texto' });
  });
});
after(async () => { await env?.cleanup(); });

const as = (uid) => env.authenticatedContext(uid).firestore();
const question = (extra = {}) => ({ text: 'Qual o pedido mais difícil?', category: 'Bastidores', notes: '', status: 'draft', answeredAt: null, scriptId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });

test('creativeQuestions: admin cria, lê, move, vincula roteiro existente e exclui; visitante não', async () => {
  const db = as('owner');
  const ref = doc(db, 'creativeQuestions/q1');
  await assertSucceeds(setDoc(ref, question()));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(updateDoc(ref, { status: 'answered', answeredAt: new Date(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { status: 'scripted', scriptId: 's1', updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(as('stranger'), 'creativeQuestions/q1')));
  await assertFails(updateDoc(doc(as('stranger'), 'creativeQuestions/q1'), { status: 'draft', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(as('stranger'), 'creativeQuestions/q1')));
  await assertSucceeds(deleteDoc(ref));
});

test('creativeQuestions: valida campos, status, datas e o vínculo com o roteiro', async () => {
  const db = as('owner');
  const bad = (extra) => setDoc(doc(db, 'creativeQuestions/bad'), question(extra));
  await assertFails(bad({ text: '' }));
  await assertFails(bad({ text: 'x'.repeat(501) }));
  await assertFails(bad({ category: 'x'.repeat(61) }));
  await assertFails(bad({ status: 'done' }));
  await assertFails(bad({ extra: 1 }));
  await assertFails(bad({ createdAt: new Date('2020-01-01') }));
  await assertFails(bad({ scriptId: 'nao-existe' }));
  await assertFails(setDoc(doc(as('stranger'), 'creativeQuestions/x'), question()));

  const ref = doc(db, 'creativeQuestions/q2');
  await assertSucceeds(setDoc(ref, question({ status: 'scripted', scriptId: 's1', answeredAt: new Date() })));
  await assertFails(updateDoc(ref, { createdAt: new Date('2020-01-01'), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { scriptId: 'outro-inexistente', updatedAt: serverTimestamp() }));
  // Roteiro excluído depois: a pergunta continua editável com o vínculo antigo.
  await env.withSecurityRulesDisabled(async (context) => { await deleteDoc(doc(context.firestore(), 'contentScripts/s1')); });
  await assertSucceeds(updateDoc(ref, { notes: 'ainda editável', updatedAt: serverTimestamp() }));
});
