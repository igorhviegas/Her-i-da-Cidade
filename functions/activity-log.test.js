import test from 'node:test';
import assert from 'node:assert/strict';
import { activityLogId, prepareActivityLog } from './activity-log.js';

const when = new Date('2026-10-08T15:00:00Z');
const logRef = { path: 'activityLog/order_completed_o1' };
const configRef = { path: 'siteConfig/gamification' };

// Transação falsa: `exists` como método (SDK web) ou propriedade (Admin SDK).
function fakeTransaction({ logExists = false, difficulties, webStyle = true } = {}) {
  const reads = [];
  const snap = (exists, data) => ({ exists: webStyle ? () => exists : exists, data: () => data });
  return {
    reads,
    get: async (ref) => {
      reads.push(ref.path);
      if (ref === logRef) return snap(logExists, logExists ? { type: 'order_completed' } : undefined);
      return snap(difficulties !== undefined, difficulties !== undefined ? { difficulties } : undefined);
    },
  };
}

const spec = { type: 'order_completed', refId: 'o1', occurredAt: when, difficultyKey: 'service_3', meta: { serviceId: '3' } };

test('primeira conclusão: grava a dificuldade vigente como retrato do momento', async () => {
  for (const webStyle of [true, false]) {
    const tx = fakeTransaction({ difficulties: { service_3: 4 }, webStyle });
    const record = await prepareActivityLog(tx, { logRef, configRef }, spec);
    assert.deepEqual(record, { type: 'order_completed', refId: 'o1', difficulty: 4, difficultyKey: 'service_3', occurredAt: when, meta: { serviceId: '3' } });
  }
});

test('conclusão repetida (pedido reaberto e concluído de novo): não gera novo registro', async () => {
  for (const webStyle of [true, false]) {
    assert.equal(await prepareActivityLog(fakeTransaction({ logExists: true, difficulties: { service_3: 5 }, webStyle }), { logRef, configRef }, spec), null);
  }
});

test('mudar a configuração depois não altera o registro já criado (o primeiro vale para sempre)', async () => {
  const first = await prepareActivityLog(fakeTransaction({ difficulties: { service_3: 4 } }), { logRef, configRef }, spec);
  assert.equal(first.difficulty, 4);
  // configuração muda para 1, mas o evento já existe: nada novo é produzido, então o set nunca sobrescreve o documento
  assert.equal(await prepareActivityLog(fakeTransaction({ logExists: true, difficulties: { service_3: 1 } }), { logRef, configRef }, spec), null);
});

test('dificuldade ausente ou inválida fica nula (sem inventar valor); explícita (missão/tarefa) é preservada', async () => {
  assert.equal((await prepareActivityLog(fakeTransaction({}), { logRef, configRef }, spec)).difficulty, null);
  assert.equal((await prepareActivityLog(fakeTransaction({ difficulties: { service_3: 9 } }), { logRef, configRef }, spec)).difficulty, null);
  const tx = fakeTransaction({});
  const mission = await prepareActivityLog(tx, { logRef, configRef }, { type: 'mission', refId: 'm1', occurredAt: when, difficulty: 3 });
  assert.equal(mission.difficulty, 3);
  assert.deepEqual(tx.reads, [logRef.path]); // sem chave de configuração, não lê a configuração
});

test('ID do evento é determinístico por tipo e referência', () => {
  assert.equal(activityLogId('order_completed', 'abc'), 'order_completed_abc');
});
