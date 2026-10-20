import test from 'node:test';
import assert from 'node:assert/strict';
import { CollabFormError, submitCollabForm } from './collab.js';
import { TERMS_VERSION } from '../services/collab.js';
import { handleEventForm } from '../api/event-form.ts';

const input = {
  name: 'Mariana Souza', instagram: '@mari.souza', whatsapp: '(31) 99999-0000', ddi: '55', city: 'Belo Horizonte', contentType: 'Rotina de mãe de dois',
  children: [{ name: 'Theo', age: '4 anos' }], acceptTerms: true, childImage: 'yes', termsVersion: TERMS_VERSION,
};

/** Firestore falso: consultas por igualdade em collabPartners dentro da transação. */
function fakeDatabase(initial = {}) {
  const store = new Map(Object.entries(initial).map(([id, data]) => [id, data]));
  let generated = 0;
  const docRef = (id) => ({ id, path: id });
  return {
    store,
    collection() {
      const filters = [];
      const ref = {
        doc: () => docRef(`p${++generated}`),
        where(field, _op, value) { filters.push([field, value]); return ref; },
        limit() { return ref; },
        filters,
      };
      return ref;
    },
    async runTransaction(callback) {
      const staged = [];
      await callback({
        async get(query) {
          const docs = [...store.entries()].filter(([, data]) => query.filters.every(([field, value]) => data[field] === value))
            .map(([id, data]) => ({ ref: docRef(id), get: (field) => data[field] }));
          return { docs };
        },
        set(reference, value) { staged.push(() => store.set(reference.id, value)); },
        update(reference, value) { staged.push(() => store.set(reference.id, { ...store.get(reference.id), ...value })); },
      });
      staged.forEach((write) => write());
    },
  };
}

test('envio cria a ficha com status "Formulário recebido" e o aceite do termo', async () => {
  const database = fakeDatabase();
  const result = await submitCollabForm({ database, input, nowMs: 1_000 });
  assert.deepEqual(result, { firstName: 'Mariana' });
  const [partner] = database.store.values();
  assert.equal(partner.status, 'form');
  assert.equal(partner.whatsappNormalized, '5531999990000');
  assert.equal(partner.instagram, 'mari.souza');
  assert.deepEqual(partner.terms, { version: TERMS_VERSION, acceptedAtMs: 1_000, childImage: true });
  assert.deepEqual(partner.grants, []);
});

test('ficha já aberta pela equipe (mesmo @): atualiza os dados e mantém o andamento', async () => {
  const database = fakeDatabase({ abc: { name: 'Mari', instagram: 'mari.souza', status: 'contacted', couponCode: 'MARI5', notes: 'Indicação' } });
  await submitCollabForm({ database, input });
  assert.equal(database.store.size, 1);
  const partner = database.store.get('abc');
  assert.deepEqual([partner.name, partner.status, partner.couponCode, partner.notes], ['Mariana Souza', 'form', 'MARI5', 'Indicação']);

  database.store.set('abc', { ...database.store.get('abc'), status: 'published' });
  await submitCollabForm({ database, input });
  assert.equal(database.store.get('abc').status, 'published'); // não volta etapa
});

test('envio inválido ou com termo desatualizado é recusado sem gravar', async () => {
  const database = fakeDatabase();
  await assert.rejects(submitCollabForm({ database, input: { ...input, acceptTerms: false } }), (error) => error instanceof CollabFormError && error.code === 'validation_error');
  await assert.rejects(submitCollabForm({ database, input: { ...input, termsVersion: 'antigo' } }), (error) => error.code === 'terms_changed');
  await assert.rejects(submitCollabForm({ database, input: { ...input, whatsapp: '123' } }), /WhatsApp/);
  assert.equal(database.store.size, 0);
});

test('API: action "collab" passa pelo captcha e responde 409 quando o termo mudou', async () => {
  const call = async (body, deps) => {
    const res = { statusCode: 0, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handleEventForm({ method: 'POST', body, headers: {} }, res, { database: fakeDatabase(), captcha: async () => ({ ok: true }), ...deps });
    return res;
  };
  const ok = await call({ action: 'collab', ...input });
  assert.deepEqual([ok.statusCode, ok.body.result.firstName], [200, 'Mariana']);
  const stale = await call({ action: 'collab', ...input, termsVersion: 'x' });
  assert.equal(stale.statusCode, 409);
  const blocked = await call({ action: 'collab', ...input }, { captcha: async () => ({ ok: false }) });
  assert.equal(blocked.statusCode, 403);
});
