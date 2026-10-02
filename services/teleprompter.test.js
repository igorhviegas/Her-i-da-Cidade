import test from 'node:test';
import assert from 'node:assert/strict';
import { getTeleprompterText } from './teleprompter.js';


test('Convite/Personalizado: texto após "Detalhes:" incluindo linhas seguintes', () => {
  const order = { serviceId: '4', content: 'Aniversariante: Ana\nDetalhes: Olá!\n\nSegundo parágrafo' };
  assert.equal(getTeleprompterText({ order }), 'Olá!\n\nSegundo parágrafo');
  assert.equal(getTeleprompterText({ order: { ...order, serviceId: '3' } }), 'Olá!\n\nSegundo parágrafo');
});

test('sem marcador usa o conteúdo inteiro; vazio retorna string vazia', () => {
  assert.equal(getTeleprompterText({ order: { serviceId: '3', content: ' texto livre ' } }), 'texto livre');
  assert.equal(getTeleprompterText({ order: { serviceId: '4', content: '' } }), '');
});

test('roteiro usa o conteúdo do pedido, com fallback no roteiro vinculado', () => {
  assert.equal(getTeleprompterText({ order: { scriptId: 's', content: 'Roteiro A' }, script: { content: 'B' } }), 'Roteiro A');
  assert.equal(getTeleprompterText({ order: { scriptId: 's', content: '' }, script: { content: 'B' } }), 'B');
});

test('pedido incompatível retorna null, mesmo com "convite" no título (usa o id do serviço)', () => {
  assert.equal(getTeleprompterText({ order: { serviceId: '9', content: 'x' }, service: { title: 'Vídeo Convite' } }), null);
  assert.equal(getTeleprompterText({ order: { serviceId: '5', content: 'x' } }), null);
});
