import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  StockError, defaultConsumptionLines, describeShortages, findShortages, isLowStock, isPresentialService, lowStockMission, normalizeLines,
  validateMaterialInput, consumptionMovementId, movementSign,
} from './stockCalculations.js';
import { patrimonySummary } from './financeCalculations.js';

const teia = { id: 'teia', name: 'Teia', unit: 'unidade', balance: 3, minLevel: 3, defaultPerEvent: 1, active: true };

test('cadastro: valida nome, categoria, unidade e inteiros >= 0', () => {
  const ok = { name: 'Teia', category: 'Eventos', unit: 'un', defaultPerEvent: 0, minLevel: 0 };
  assert.deepEqual(validateMaterialInput(ok), []);
  assert.equal(validateMaterialInput({ ...ok, name: ' ', defaultPerEvent: -1, minLevel: 1.5 }).length, 3);
  assert.equal(validateMaterialInput({ ...ok, initialBalance: -2 }).length, 1);
});

test('consumo padrão vem do cadastro (inclusive zero) e só de materiais ativos', () => {
  const lines = defaultConsumptionLines([teia, { id: 'medalha', name: 'Medalha', balance: 1, minLevel: 0, defaultPerEvent: 0, active: true }, { ...teia, id: 'velho', active: false }]);
  assert.deepEqual(lines, [{ materialId: 'teia', quantity: 1 }, { materialId: 'medalha', quantity: 0 }]);
});

test('linhas: une repetidos, descarta zero e rejeita decimais/negativos', () => {
  assert.deepEqual(normalizeLines([{ materialId: 'a', quantity: 1 }, { materialId: 'a', quantity: 1 }, { materialId: 'b', quantity: 0 }]), [{ materialId: 'a', quantity: 2 }]);
  assert.throws(() => normalizeLines([{ materialId: 'a', quantity: 1.5 }]), StockError);
  assert.throws(() => normalizeLines([{ materialId: 'a', quantity: -1 }]), StockError);
  assert.throws(() => normalizeLines([{ materialId: 'a/b', quantity: 1 }]), StockError);
});

test('faltas: material, necessário, disponível e diferença', () => {
  const shortages = findShortages(new Map([['teia', teia]]), [{ materialId: 'teia', quantity: 5 }, { materialId: 'x', quantity: 1 }]);
  assert.deepEqual(shortages.map((s) => [s.name, s.required, s.available, s.missing]), [['Teia', 5, 3, 2], ['x', 1, 0, 1]]);
  assert.match(describeShortages(shortages), /Teia \(necessário 5, disponível 3, faltam 2\)/);
  assert.deepEqual(findShortages(new Map([['teia', teia]]), [{ materialId: 'teia', quantity: 3 }]), []);
});

test('estoque baixo: no limite ou abaixo; inativo não alerta', () => {
  assert.equal(isLowStock(teia), true);
  assert.equal(isLowStock({ ...teia, balance: 4 }), false);
  assert.equal(isLowStock({ ...teia, active: false }), false);
  assert.equal(lowStockMission(teia, 3).title, 'Comprar teia para reposição do estoque');
});

test('presencial pela categoria do serviço; ids de movimentação determinísticos; sinais', () => {
  assert.equal(isPresentialService({ category: 'Presencial' }), true);
  assert.equal(isPresentialService({ category: 'Pronta entrega' }), false);
  assert.equal(consumptionMovementId('o1', 2, 'teia'), 'consume_o1_2_teia');
  assert.deepEqual(['purchase', 'consumption', 'adjustment_in', 'adjustment_out', 'reversal'].map(movementSign), [1, -1, 1, -1, 1]);
});

test('estoque não entra no patrimônio nem no financeiro', async () => {
  assert.deepEqual(patrimonySummary([{ status: 'active', currentValue: 10, acquisitionValue: 20 }]), { activeCount: 1, currentTotal: 10, acquisitionTotal: 20 });
  const finance = await readFile(new URL('./financeCalculations.js', import.meta.url), 'utf8');
  assert.doesNotMatch(finance, /stock/i);
});

test('conclusão: updateOrder é o ponto único; presencial exige consumo, reabertura estorna, criação concluída é barrada', async () => {
  const source = await readFile(new URL('./ordersService.ts', import.meta.url), 'utf8');
  assert.match(source, /isPresentialService\(serviceSnapshot\.data\(\)\)/);
  assert.match(source, /'consumption_required'/);
  assert.match(source, /prepareOrderConsumption\(transaction, firestore/);
  assert.match(source, /prepareOrderReversal\(transaction, firestore/);
  assert.match(source, /stock\?\.apply\(\)/);
  assert.match(source, /delete safeUpdates\.materialConsumption/);
  const create = source.slice(source.indexOf('export async function createOrder'), source.indexOf('/** Cria uma única produção interna'));
  assert.match(create, /isPresentialService/);
});
