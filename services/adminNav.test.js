import test from 'node:test';
import assert from 'node:assert/strict';
import { moveNavItem, resolveNavOrder, shiftNavItem } from './adminNav.js';

const ids = ['a', 'b', 'c', 'd'];

test('resolveNavOrder: respeita a ordem salva, ignora lixo e repetidos, e acrescenta módulos novos no fim', () => {
  assert.deepEqual(resolveNavOrder(ids, ['c', 'a']), ['c', 'a', 'b', 'd']);
  assert.deepEqual(resolveNavOrder(ids, ['d', 'x', 'd', 'b', 'c', 'a']), ['d', 'b', 'c', 'a']);
  for (const bad of [null, undefined, 'abc', 42, {}, []]) assert.deepEqual(resolveNavOrder(ids, bad), ids);
});

test('moveNavItem: antes/depois do alvo, sem perder itens e ignorando posições inválidas', () => {
  assert.deepEqual(moveNavItem(ids, 'd', 'a'), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveNavItem(ids, 'a', 'c', 'after'), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveNavItem(ids, 'a', 'b', 'before'), ids);
  assert.equal(moveNavItem(ids, 'a', 'a'), ids);
  assert.equal(moveNavItem(ids, 'zzz', 'a'), ids);
  assert.equal(moveNavItem(ids, 'a', 'zzz'), ids);
});

test('shiftNavItem: sobe/desce uma posição e para nas pontas', () => {
  assert.deepEqual(shiftNavItem(ids, 'c', -1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(shiftNavItem(ids, 'c', 1), ['a', 'b', 'd', 'c']);
  assert.equal(shiftNavItem(ids, 'a', -1), ids);
  assert.equal(shiftNavItem(ids, 'd', 1), ids);
});
