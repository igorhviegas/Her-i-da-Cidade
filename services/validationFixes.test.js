// Regressões das falhas encontradas na validação prática (ver relatório). Verificações de código-fonte; o comportamento
// real foi exercitado no navegador contra o emulador e, para regras, em tests/firestore-rules.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('F3: editor não vê o rótulo nem a cor da conclusão excepcional', async () => {
  const modal = await read('../components/admin/StockConsumptionModal.tsx');
  assert.match(modal, /const asException = exceptional && canOverride/);
  assert.match(modal, /asException \? 'Concluir com pendências de estoque' : 'Concluir evento e baixar estoque'/);
});

test('F4: repetir a conclusão de um pedido já concluído não reescreve completedAt; reabrir e concluir de novo continua datando', async () => {
  const orders = await read('./ordersService.ts');
  assert.match(orders, /updates\.completedAt === undefined && currentData\.status === 'completed'\) \{/);
  assert.match(orders, /\} else if \(updates\.status === 'completed' && updates\.completedAt === undefined\) \{\s+payload\.completedAt = serverTimestamp\(\)/);
});
