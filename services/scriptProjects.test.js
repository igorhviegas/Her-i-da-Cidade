import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProject, DEFAULT_ICON, matchesProject } from './scriptProjects.js';

test('cleanProject: apara e junta espaços, exige nome, limita tamanho e troca ícone inválido pelo padrão', () => {
  assert.deepEqual(cleanProject({ name: '  Séries   do  Aranha ', icon: 'Tv' }), { name: 'Séries do Aranha', icon: 'Tv' });
  assert.equal(cleanProject({ name: 'X', icon: '<svg>' }).icon, DEFAULT_ICON);
  assert.throws(() => cleanProject({ name: '  ', icon: 'Tv' }), /nome/);
  assert.throws(() => cleanProject({ name: 'x'.repeat(61), icon: 'Tv' }), /até 60/);
});

test('matchesProject: todos, sem projeto (inclui projeto excluído) e projeto específico', () => {
  const known = new Set(['caixinha', 'temas']);
  assert.equal(matchesProject(undefined, '', known), true);
  assert.equal(matchesProject(undefined, 'none', known), true);
  assert.equal(matchesProject('apagado', 'none', known), true);
  assert.equal(matchesProject('temas', 'none', known), false);
  assert.equal(matchesProject('temas', 'temas', known), true);
  assert.equal(matchesProject('caixinha', 'temas', known), false);
});
