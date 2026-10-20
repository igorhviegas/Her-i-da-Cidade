import test from 'node:test';
import assert from 'node:assert/strict';
import { answeredAtFor, cleanQuestion, filterQuestions, normalizeStatus, QUESTION_LIMITS } from './creativeQuestions.js';

test('cleanQuestion: apara textos, exige pergunta, respeita limites e valida status/roteiro', () => {
  assert.deepEqual(cleanQuestion({ text: '  Qual o carro dos sonhos? ', category: ' Carros ', notes: '', status: 'draft' }),
    { text: 'Qual o carro dos sonhos?', category: 'Carros', notes: '', status: 'draft', scriptId: null });
  assert.equal(cleanQuestion({ text: 'x', category: '', notes: '', status: 'scripted', scriptId: 'abc' }).scriptId, 'abc');
  assert.throws(() => cleanQuestion({ text: '   ', category: '', notes: '', status: 'draft' }), /Escreva a pergunta/);
  assert.throws(() => cleanQuestion({ text: 'x'.repeat(QUESTION_LIMITS.text + 1), category: '', notes: '', status: 'draft' }), /até 500/);
  assert.throws(() => cleanQuestion({ text: 'x', category: '', notes: '', status: 'done' }), /Status/);
  assert.throws(() => cleanQuestion({ text: 'x', category: '', notes: '', status: 'draft', scriptId: 'a/b' }), /Roteiro/);
});

test('answeredAtFor: só em Respondidos; preenche ao responder, mantém a data existente e limpa ao voltar', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const before = new Date('2026-10-01T12:00:00Z');
  assert.equal(answeredAtFor('answered', null, now), now);
  assert.equal(answeredAtFor('answered', before, now), before);
  assert.equal(answeredAtFor('scripted', before, now), null);
  assert.equal(answeredAtFor('draft', null, now), null);
});

test('normalizeStatus: status antigo ou desconhecido vira Rascunhos', () => {
  assert.equal(normalizeStatus('ready'), 'draft');
  assert.equal(normalizeStatus('x'), 'draft');
  assert.equal(normalizeStatus('scripted'), 'scripted');
  assert.equal(normalizeStatus('answered'), 'answered');
});

test('filterQuestions: busca sem acento em pergunta/categoria/observações e filtra categoria e status', () => {
  const list = [
    { text: 'Você já atendeu um famoso?', category: 'Bastidores', notes: '', status: 'scripted' },
    { text: 'Qual o pedido mais difícil?', category: 'Pedidos', notes: 'falar da chupeta', status: 'draft' },
  ];
  assert.equal(filterQuestions(list, { search: 'voce FAMOSO' }).length, 1);
  assert.equal(filterQuestions(list, { search: 'chupeta' })[0].category, 'Pedidos');
  assert.equal(filterQuestions(list, { category: 'Bastidores' }).length, 1);
  assert.equal(filterQuestions(list, { status: 'draft', search: 'famoso' }).length, 0);
  assert.equal(filterQuestions(list).length, 2);
});
